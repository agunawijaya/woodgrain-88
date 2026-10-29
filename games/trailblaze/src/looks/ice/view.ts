/**
 * Ice Trail's view: two skaters gliding over a frozen lake, freezing the air
 * into a wall of ice behind them.
 *
 * - Frost streams from each skater's trailing hand and their breath clouds in the cold; at
 *   speed, wind streaks sweep past.
 * - A crash freezes the skater solid with a crystalline crack: a burst of ice glints and a ring
 *   of frost on the ice.
 * - The trap closing: a cluster of crystals bursts up at the sealing cell, and frost creeps over
 *   the floor of the pocket the rival is shut into.
 */
import { createParticleField, type ParticleField } from '@woodgrain-88/arena';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NormalBlending,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Seat } from '../../engine/types.ts';
import { cellCentre } from '../../look/board-space.ts';
import { createPocketMarks } from '../../look/pocket-marks.ts';
import { coloursOf, rivalColours, type TrailView, type ViewOptions } from '../../look/look.ts';
import { createTrailView, type LookParts } from '../../look/trail-rig.ts';
import { createIceWalls, ICE_TOP } from './ice-wall.ts';
import { createLake } from './lake.ts';
import { createSkater, type Skater } from './skater.ts';
import { createSnowman } from './snowman.ts';
import { actionPoint } from '../../look/watcher.ts';

interface Growth {
  readonly root: Group;
  age: number;
  readonly kind: 'crystal' | 'ring';
}

export function createIceView(options: ViewOptions): TrailView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('ice');
  const root = new Group();
  root.name = 'ice';
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

  const lake = createLake({ night, rng: rng.fork('lake') });
  root.add(lake.root);
  const pocket = createPocketMarks({ floor: ICE_TOP, glow: night, strength: night ? 0.55 : 0.7 });
  root.add(pocket.mesh);
  const walls = createIceWalls({ seats: options.seats, night });
  for (const mesh of walls.meshes) root.add(mesh);
  const skaters = options.seats.map((colours, seat) =>
    createSkater({ seat: seat as Seat, colours, night }),
  ) as [Skater, Skater];

  const snowman = createSnowman({ night, rng: rng.fork('snowman') });
  root.add(snowman.root);

  const glints: ParticleField = createParticleField('glow', 1400, options.stage.lights.palette);
  const breath: ParticleField = createParticleField('smoke', 500, options.stage.lights.palette);
  root.add(glints.mesh, breath.mesh);
  const frostColour = new Color('#dff3ff').multiplyScalar(night ? 1.8 : 1.1);

  const crystal = keep(crystalBurstGeometry());
  const ring = keep(new RingGeometry(0.2, 0.32, 40));
  ring.rotateX(-Math.PI / 2);
  const growths: Growth[] = [];
  let speedStage = 0;
  let emitClock = 0;
  const scratch = new Vector3();

  function glint(at: Vector3, count: number, speed: number, colour: Color): void {
    for (let index = 0; index < count; index++) {
      const angle = rng.float(0, Math.PI * 2);
      glints.emit({
        x: at.x,
        y: at.y,
        z: at.z,
        vx: Math.cos(angle) * rng.float(0.3, 1) * speed,
        vy: rng.float(0.5, 2.5),
        vz: Math.sin(angle) * rng.float(0.3, 1) * speed,
        lift: -6,
        drag: 1.4,
        life: rng.float(0.4, 0.9),
        size: rng.float(0.05, 0.1),
        sizeEnd: 0.02,
        colour,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.03,
        fadeIn: 0,
      });
    }
  }

  function grow(at: Vector3, kind: Growth['kind'], tint: Color): void {
    const group = new Group();
    if (kind === 'crystal') {
      const material = own(
        new MeshPhysicalMaterial({
          color: new Color('#eaf7ff').lerp(tint, 0.3),
          emissive: tint,
          emissiveIntensity: night ? 1.1 : 0.25,
          roughness: 0.05,
          clearcoat: 1,
          transparent: true,
          opacity: 0.85,
          flatShading: true,
        }),
      );
      const mesh = new Mesh(crystal, material);
      mesh.castShadow = true;
      group.add(mesh);
    } else {
      const material = own(
        new MeshBasicMaterial({
          color: frostColour,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: night ? AdditiveBlending : NormalBlending,
        }),
      );
      group.add(new Mesh(ring, material));
    }
    group.position.copy(at).setY(ICE_TOP + 0.01);
    group.scale.setScalar(0.01);
    root.add(group);
    growths.push({ root: group, age: 0, kind });
  }

  function updateGrowths(dt: number): void {
    for (const growth of [...growths]) {
      growth.age += dt;
      if (growth.kind === 'crystal') {
        const t = Math.min(1, growth.age / 0.35);
        growth.root.scale.set(1, Math.max(0.01, t * (1 + Math.sin(t * Math.PI) * 0.25)), 1);
      } else {
        const t = growth.age / 0.9;
        growth.root.scale.setScalar(0.5 + t * 4);
        growth.root.traverse((child) => {
          if (child instanceof Mesh)
            (child.material as MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - t));
        });
        if (t >= 1) {
          growth.root.removeFromParent();
          growths.splice(growths.indexOf(growth), 1);
        }
      }
    }
  }

  function streamFrost(dt: number): void {
    emitClock += dt;
    if (emitClock < 0.05 || options.reducedEffects) return;
    emitClock = 0;
    skaters.forEach((skater, seat) => {
      if (seat >= options.players || !skater.root.visible) return;
      const hand = skater.handPosition(scratch);
      glints.emit({
        x: hand.x,
        y: hand.y,
        z: hand.z,
        vy: -0.2,
        drag: 2,
        life: 0.7,
        size: 0.07,
        sizeEnd: 0.02,
        colour: frostColour,
        alpha: 0.9,
        alphaEnd: 0,
      });
      if (rng.chance(0.25)) {
        const mouth = skater.breathPosition(scratch);
        breath.emit({
          x: mouth.x,
          y: mouth.y,
          z: mouth.z,
          vy: 0.15,
          drag: 2,
          life: 0.7,
          size: 0.06,
          sizeEnd: 0.22,
          colour: new Color('#ffffff'),
          alpha: night ? 0.35 : 0.5,
          alphaEnd: 0,
          seed: rng.next(),
        });
      }
      if (speedStage >= 2) {
        const at = skater.root.position;
        glints.emit({
          x: at.x + rng.float(-1.2, 1.2),
          y: rng.float(0.15, 0.7),
          z: at.z + rng.float(-1.2, 1.2),
          vx: rng.float(-3, -2),
          life: 0.3,
          size: 0.04,
          colour: new Color('#ffffff').multiplyScalar(0.8),
          alpha: 0.6,
          alphaEnd: 0,
          stretch: 0.08,
          fadeIn: 0,
        });
      }
    });
  }

  const parts: LookParts = {
    root,
    pieces: walls,
    remixStyle: {
      wall: night ? '#a9bedb' : '#f4f8ff',
      wallHeight: 0.5,
      lane: night ? '#8ff5e2' : '#1fa38a',
      night,
    },
    riders: skaters,
    reset(edges) {
      lake.setEdges(edges);
      pocket.hide();
      for (const growth of growths) growth.root.removeFromParent();
      growths.length = 0;
      glints.clear();
      breath.clear();
    },
    crash(crash, at) {
      snowman.react(crash, at);
      const tint = new Color(coloursOf(options.seats, crash.seat).main);
      if (!options.reducedEffects) glint(at.clone().setY(0.4), 40, 2.4, frostColour);
      grow(at, 'ring', tint);
      options.stage.lights.flash(at.clone().setY(0.8), '#cfeaff', night ? 12 : 7, 0.45);
    },
    trap(seat, cells, seal) {
      pocket.show(cells, '#f4fbff');
      const at = cellCentre(seal);
      grow(at, 'crystal', new Color(rivalColours(options.seats, seat).main));
      if (!options.reducedEffects) glint(at.clone().setY(0.6), 30, 1.8, frostColour);
      options.stage.lights.flash(at.clone().setY(1.2), '#d8f0ff', night ? 18 : 6, 0.6);
    },
    setSpeedStage(stage) {
      speedStage = stage;
    },
    update(dt, clock) {
      snowman.follow(
        actionPoint(
          skaters.filter((_, seat) => seat < options.players).map((skater) => skater.root.position),
        ),
      );
      snowman.update(dt, clock);
      updateGrowths(dt);
      if (dt > 0) streamFrost(dt);
      pocket.update(dt);
      glints.update(dt, options.stage.camera);
      breath.update(dt, options.stage.camera);
    },
    dispose() {
      snowman.dispose();
      lake.dispose();
      walls.dispose();
      glints.dispose();
      breath.dispose();
      pocket.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
  return createTrailView(options, parts);
}

/** A burst of crystals fanning up and out from one point. */
function crystalBurstGeometry(): BufferGeometry {
  const spikes = Array.from({ length: 7 }, (_, index) => {
    const height = index === 0 ? 1.3 : 0.7 + (index % 3) * 0.18;
    const spike = new ConeGeometry(index === 0 ? 0.2 : 0.13, height, 5);
    spike.translate(0, height / 2, 0);
    if (index > 0) {
      const angle = (index / 6) * Math.PI * 2;
      spike.rotateZ(Math.cos(angle) * 0.55);
      spike.rotateX(Math.sin(angle) * 0.55);
    }
    return spike;
  });
  return mergeGeometries(spikes);
}
