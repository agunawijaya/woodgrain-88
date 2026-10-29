/**
 * Toy Trains' view: wind-up locomotives laying their own track across a
 * play mat.
 *
 * - Each locomotive puffs steam as it rolls, faster as the speed rises.
 * - A derailment tips the engine onto its side with a cartoon clonk: a burst star, a puff of dust
 *   and a flash.
 * - The trap closing: a red-and-white buffer stop springs up at the sealing piece, and the
 *   cells the rival is shut into are chalked in its colour.
 * - By night each engine's headlamp throws a cone of light ahead of it.
 */
import { createParticleField, type ParticleField } from '@woodgrain-88/arena';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SpotLight,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Seat } from '../../engine/types.ts';
import { cellCentre } from '../../look/board-space.ts';
import { createPocketMarks } from '../../look/pocket-marks.ts';
import { coloursOf, type TrailView, type ViewOptions } from '../../look/look.ts';
import { createTrailView, type LookParts } from '../../look/trail-rig.ts';
import { actionPoint } from '../../look/watcher.ts';
import { createConductor } from './conductor.ts';
import { createLoco, type Loco } from './loco.ts';
import { createPlayroom } from './playroom.ts';
import { BED_HEIGHT, createTrack, MAT_TOP } from './track.ts';

interface Pop {
  readonly root: Group;
  age: number;
  readonly life: number;
  readonly kind: 'star' | 'stop';
}

export function createTrainsView(options: ViewOptions): TrailView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('trains');
  const root = new Group();
  root.name = 'trains';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };

  const room = createPlayroom({ night, rng: rng.fork('room') });
  root.add(room.root);
  const pocket = createPocketMarks({ floor: MAT_TOP, glow: night, strength: night ? 0.6 : 0.62 });
  root.add(pocket.mesh);
  const track = createTrack({ seats: options.seats });
  for (const mesh of track.meshes) root.add(mesh);

  const steam: ParticleField = createParticleField('smoke', 900, options.stage.lights.palette);
  const sparkle: ParticleField = createParticleField('glow', 400, options.stage.lights.palette);
  root.add(steam.mesh, sparkle.mesh);

  function puff(at: Vector3, speedStage: number): void {
    if (options.reducedEffects) return;
    steam.emit({
      x: at.x,
      y: at.y,
      z: at.z,
      vx: rng.float(-0.1, 0.1),
      vy: 0.9 + speedStage * 0.2,
      vz: rng.float(-0.1, 0.1),
      drag: 1.6,
      lift: 0.6,
      life: rng.float(0.8, 1.2),
      size: 0.16,
      sizeEnd: 0.55,
      colour: new Color(night ? '#c9cfe0' : '#ffffff'),
      colourEnd: new Color(night ? '#7d869c' : '#eef0f4'),
      alpha: night ? 0.55 : 0.8,
      alphaEnd: 0,
      seed: rng.next(),
    });
  }

  const locos = options.seats.map((colours, seat) =>
    createLoco({ seat: seat as Seat, colours, night, onPuff: puff }),
  );

  const conductor = createConductor({ night });
  root.add(conductor.root);

  // The way the camera looks across the mat, for telling which engines head away from it.
  const lookingAcross = options.stage.camera.getWorldDirection(new Vector3()).setY(0).normalize();
  const beams = night ? locos.map((loco) => addBeam(loco, lookingAcross, keep, own)) : [];

  const starGeometry = keep(burstStarGeometry());
  const starMaterial = own(
    new MeshBasicMaterial({
      color: new Color('#ffe46b').multiplyScalar(night ? 1.8 : 1),
      transparent: true,
    }),
  );
  const starOutline = own(new MeshBasicMaterial({ color: '#2b2622', transparent: true }));
  const stopBody = keep(new RoundedBoxGeometry(0.62, 0.42, 0.34, 2, 0.05));
  const stopBeam = keep(new RoundedBoxGeometry(0.78, 0.16, 0.12, 2, 0.04));
  const stopRed = own(new MeshStandardMaterial({ color: '#d8352c', roughness: 0.45 }));
  const stopWhite = own(new MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.45 }));
  const pops: Pop[] = [];

  function popStar(at: Vector3): void {
    const group = new Group();
    const outline = new Mesh(starGeometry, starOutline);
    outline.scale.setScalar(1.12);
    const star = new Mesh(starGeometry, starMaterial);
    star.position.z = 0.01;
    group.add(outline, star);
    group.position.copy(at).setY(1.3);
    // Face the camera, so the clonk reads as a comic burst and not a shape on the floor.
    group.quaternion.copy(options.stage.camera.quaternion);
    root.add(group);
    pops.push({ root: group, age: 0, life: 0.7, kind: 'star' });
  }

  function popBufferStop(at: Vector3, yaw: number): void {
    const group = new Group();
    const body = new Mesh(stopBody, stopRed);
    body.position.y = 0.21;
    const beam = new Mesh(stopBeam, stopWhite);
    beam.position.set(0, 0.36, 0.18);
    const stripe = new Mesh(stopBeam, stopRed);
    stripe.scale.set(0.3, 1.05, 1.05);
    stripe.position.copy(beam.position);
    group.add(body, beam, stripe);
    group.traverse((child) => {
      if (child instanceof Mesh) child.castShadow = true;
    });
    group.position.copy(at).setY(MAT_TOP + BED_HEIGHT);
    group.rotation.y = yaw;
    group.scale.setScalar(0.01);
    root.add(group);
    pops.push({ root: group, age: 0, life: Infinity, kind: 'stop' });
  }

  function updatePops(dt: number): void {
    for (const pop of [...pops]) {
      pop.age += dt;
      if (pop.kind === 'star') {
        const grow = Math.min(1, pop.age / 0.12);
        pop.root.scale.setScalar(0.35 + grow * 0.45);
        const fade = Math.max(0, 1 - Math.max(0, pop.age - 0.35) / 0.35);
        starMaterial.opacity = fade;
        starOutline.opacity = fade;
      } else {
        // Springs up past full size and settles, like a toy piece snapped into place.
        const t = Math.min(1, pop.age / 0.45);
        const spring = 1 + Math.sin(t * Math.PI * 2.5) * (1 - t) * 0.35;
        pop.root.scale.setScalar(Math.max(0.01, t < 0.2 ? t * 5 : spring));
      }
      if (pop.age > pop.life) {
        pop.root.removeFromParent();
        pops.splice(pops.indexOf(pop), 1);
      }
    }
  }

  const parts: LookParts = {
    root,
    pieces: track,
    remixStyle: {
      wall: night ? '#9a6a3a' : '#c98b4a',
      wallHeight: 0.6,
      lane: night ? '#ffd23f' : '#e0a800',
      night,
    },
    riders: locos,
    reset(edges) {
      room.setEdges(edges);
      pocket.hide();
      for (const pop of pops) pop.root.removeFromParent();
      pops.length = 0;
      steam.clear();
      sparkle.clear();
    },
    crash(crash, at, direction) {
      conductor.react(crash, at);
      popStar(at.clone().addScaledVector(direction, 0.2));
      if (!options.reducedEffects) {
        for (let index = 0; index < 14; index++) {
          steam.emit({
            x: at.x + rng.float(-0.3, 0.3),
            y: 0.2,
            z: at.z + rng.float(-0.3, 0.3),
            vx: rng.float(-0.8, 0.8),
            vy: rng.float(0.4, 1.2),
            vz: rng.float(-0.8, 0.8),
            drag: 2.5,
            life: rng.float(0.6, 1.1),
            size: 0.25,
            sizeEnd: 0.7,
            colour: new Color('#e9dfcf'),
            alpha: 0.7,
            alphaEnd: 0,
            seed: rng.next(),
          });
        }
        for (let index = 0; index < 18; index++) {
          const angle = rng.float(0, Math.PI * 2);
          sparkle.emit({
            x: at.x,
            y: 0.5,
            z: at.z,
            vx: Math.cos(angle) * rng.float(1, 2.5),
            vy: rng.float(1, 3),
            vz: Math.sin(angle) * rng.float(1, 2.5),
            lift: -8,
            life: rng.float(0.35, 0.6),
            size: 0.1,
            sizeEnd: 0.03,
            colour: new Color('#ffe8a0').multiplyScalar(night ? 2.2 : 1.3),
            alpha: 1,
            alphaEnd: 0,
            fadeIn: 0,
          });
        }
      }
      options.stage.lights.flash(at.clone().setY(1), '#fff1c8', night ? 18 : 6, 0.35);
    },
    trap(seat, cells, seal) {
      pocket.show(cells, coloursOf(options.seats, seat).main);
      const at = cellCentre(seal);
      popBufferStop(at, rng.pick([0, Math.PI / 2]));
      options.stage.lights.flash(at.clone().setY(1.2), '#ffe2b0', night ? 14 : 5, 0.5);
    },
    update(dt, clock) {
      conductor.follow(
        actionPoint(
          locos.filter((_, seat) => seat < options.players).map((loco) => loco.root.position),
        ),
      );
      conductor.update(dt, clock);
      updatePops(dt);
      pocket.update(dt);
      for (const beam of beams) beam.update(clock);
      steam.update(dt, options.stage.camera);
      sparkle.update(dt, options.stage.camera);
    },
    dispose() {
      conductor.dispose();
      room.dispose();
      track.dispose();
      steam.dispose();
      sparkle.dispose();
      pocket.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
  return createTrailView(options, parts);
}

/**
 * A headlamp's beam: a real spotlight that throws a warm pool on the mat ahead of the engine,
 * and a faint cone of light in the air to show where it comes from. Seen from behind, the cone
 * lies along the line of sight and its glow piles up into a blown-out blob, so an engine heading
 * away from the camera dims its cone and softens its pool.
 */
function addBeam(
  loco: Loco,
  lookingAcross: Vector3,
  keep: <T extends BufferGeometry>(geometry: T) => T,
  own: <T extends Material>(material: T) => T,
): { update(clock: number): void } {
  const geometry = keep(new ConeGeometry(0.55, 1.8, 24, 1, true));
  geometry.translate(0, -0.9, 0);
  geometry.rotateZ(Math.PI / 2);
  const material = own(
    new MeshBasicMaterial({
      color: new Color('#ffd796').multiplyScalar(0.35),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const cone = new Mesh(geometry, material);
  cone.rotation.z = -0.35;
  loco.lamp.add(cone);
  const spot = new SpotLight('#ffd08a', 26, 9, 0.5, 0.75, 1.4);
  spot.position.set(0, 0, 0);
  spot.target.position.set(3, -2, 0);
  loco.lamp.add(spot, spot.target);
  const forward = new Vector3();
  const source = new Vector3();
  return {
    update(clock) {
      const flicker = 1 + Math.sin(clock * 21) * 0.03;
      spot.target.getWorldPosition(forward).sub(spot.getWorldPosition(source));
      const away = Math.max(0, forward.setY(0).normalize().dot(lookingAcross));
      material.opacity = 0.16 * flicker * (1 - AWAY_CONE_DIMMING * away);
      spot.intensity = 26 * flicker * (1 - AWAY_POOL_DIMMING * away);
    },
  };
}

/** How much an engine heading straight away from the camera dims its headlamp's cone and pool. */
const AWAY_CONE_DIMMING = 1;
const AWAY_POOL_DIMMING = 0.75;

/** A comic burst: an eight-pointed star with uneven points. */
function burstStarGeometry(): ShapeGeometry {
  const shape = new Shape();
  const points = 16;
  for (let index = 0; index <= points; index++) {
    const angle = (index / points) * Math.PI * 2;
    const radius = index % 2 === 0 ? (index % 4 === 0 ? 0.62 : 0.5) : 0.24;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new ShapeGeometry(shape);
}
