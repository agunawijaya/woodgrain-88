/**
 * Mummy's Wrap's view: two cartoon mummies shuffling through a tomb, each
 * unrolling a bandage that sticks to the floor as a wall.
 *
 * - Feet scuff up little puffs of sand as they shuffle.
 * - A crash winds the mummy into a cocoon, with a puff of dust and a flutter of linen scraps.
 * - The trap closing: a big bandage bow ties itself at the sealing cell, and the floor of the
 *   pocket the rival is shut into darkens with its colour.
 * - By night sparks rise from the torches.
 */
import { createParticleField, type ParticleField } from '@woodgrain-88/arena';
import type { Vector3 } from 'three';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Seat } from '../../engine/types.ts';
import { cellCentre } from '../../look/board-space.ts';
import { createPocketMarks } from '../../look/pocket-marks.ts';
import {
  coloursOf,
  rivalColours,
  type SeatColours,
  type TrailView,
  type ViewOptions,
} from '../../look/look.ts';
import { createTrailView, type LookParts } from '../../look/trail-rig.ts';
import { createBandages, FLOOR_TOP } from './bandage.ts';
import { actionPoint } from '../../look/watcher.ts';
import { createMummy } from './mummy.ts';
import { createPriest } from './priest.ts';
import { createTomb } from './tomb.ts';

interface Bow {
  readonly root: Group;
  age: number;
}

export function createMummyView(options: ViewOptions): TrailView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('mummy');
  const root = new Group();
  root.name = 'mummy';
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

  const tomb = createTomb({ night, rng: rng.fork('tomb') });
  root.add(tomb.root);
  const pocket = createPocketMarks({ floor: FLOOR_TOP, glow: false, strength: 0.6 });
  root.add(pocket.mesh);
  const bandages = createBandages({ seats: options.seats });
  for (const mesh of bandages.meshes) root.add(mesh);
  const mummies = options.seats.map((colours, seat) =>
    createMummy({ seat: seat as Seat, colours, night }),
  );

  const priest = createPriest({ night, stage: options.stage });
  root.add(priest.root);

  const dust: ParticleField = createParticleField('smoke', 900, options.stage.lights.palette);
  const sparks: ParticleField = createParticleField('glow', 600, options.stage.lights.palette);
  root.add(dust.mesh, sparks.mesh);
  const sand = new Color(night ? '#a07c55' : '#e6c894');

  const loop = keep(new TorusGeometry(0.22, 0.08, 10, 24));
  loop.scale(1, 0.65, 1);
  const knot = keep(new SphereGeometry(0.12, 14, 10));
  const tailEnd = keep(new PlaneGeometry(0.16, 0.42));
  const bows: Bow[] = [];
  let shuffleClock = 0;

  function puffSand(at: Vector3, amount: number, spread: number): void {
    for (let index = 0; index < amount; index++) {
      dust.emit({
        x: at.x + rng.float(-spread, spread),
        y: FLOOR_TOP + 0.05,
        z: at.z + rng.float(-spread, spread),
        vx: rng.float(-0.4, 0.4),
        vy: rng.float(0.2, 0.6),
        vz: rng.float(-0.4, 0.4),
        drag: 2.2,
        life: rng.float(0.5, 0.9),
        size: 0.14,
        sizeEnd: 0.45,
        colour: sand,
        alpha: 0.5,
        alphaEnd: 0,
        seed: rng.next(),
      });
    }
  }

  function tieBow(at: Vector3, colours: SeatColours, yaw: number): void {
    const material = own(new MeshStandardMaterial({ color: '#f1e6cc', roughness: 0.9 }));
    const dyed = own(new MeshStandardMaterial({ color: colours.main, roughness: 0.8 }));
    const group = new Group();
    for (const side of [-1, 1]) {
      const ear = new Mesh(loop, material);
      ear.position.set(side * 0.22, 0, 0);
      ear.rotation.z = side * 0.35;
      const end = new Mesh(tailEnd, material);
      end.position.set(side * 0.1, -0.24, 0.02);
      end.rotation.z = side * 0.4;
      group.add(ear, end);
    }
    const middle = new Mesh(knot, dyed);
    group.add(middle);
    group.traverse((child) => {
      if (child instanceof Mesh) child.castShadow = true;
    });
    group.position.copy(at).setY(FLOOR_TOP + 0.62);
    group.rotation.y = yaw;
    group.scale.setScalar(0.01);
    root.add(group);
    bows.push({ root: group, age: 0 });
  }

  function emberFrom(torch: Vector3): void {
    sparks.emit({
      x: torch.x + rng.float(-0.1, 0.1),
      y: torch.y,
      z: torch.z + rng.float(-0.1, 0.1),
      vx: rng.float(-0.2, 0.2),
      vy: rng.float(0.8, 1.6),
      vz: rng.float(-0.2, 0.2),
      drag: 0.5,
      life: rng.float(0.8, 1.6),
      size: 0.07,
      sizeEnd: 0.02,
      colour: new Color('#ffb860').multiplyScalar(2.6),
      alpha: 1,
      alphaEnd: 0,
    });
  }

  const parts: LookParts = {
    root,
    pieces: bandages,
    remixStyle: {
      wall: night ? '#7a6649' : '#b49a72',
      wallHeight: 0.7,
      lane: night ? '#ffcf4a' : '#c8920e',
      night,
    },
    riders: mummies,
    reset(edges) {
      tomb.setEdges(edges);
      pocket.hide();
      for (const bow of bows) bow.root.removeFromParent();
      bows.length = 0;
      dust.clear();
    },
    crash(crash, at) {
      priest.react(crash, at);
      puffSand(at, options.reducedEffects ? 4 : 16, 0.35);
      if (!options.reducedEffects) {
        for (let index = 0; index < 12; index++) {
          sparks.emit({
            x: at.x,
            y: 0.6,
            z: at.z,
            vx: rng.float(-1.4, 1.4),
            vy: rng.float(0.6, 2),
            vz: rng.float(-1.4, 1.4),
            lift: -5,
            drag: 1.5,
            life: rng.float(0.5, 0.9),
            size: 0.08,
            sizeEnd: 0.04,
            colour: new Color(coloursOf(options.seats, crash.seat).main).multiplyScalar(
              night ? 1.8 : 1.2,
            ),
            alpha: 0.9,
            alphaEnd: 0,
          });
        }
      }
      // A warm glow at the cocoon's feet, kept low: the winding is the moment, not a flash.
      options.stage.lights.flash(at.clone().setY(0.6), '#ffd9a0', night ? 3 : 1.2, 0.4);
    },
    trap(seat, cells, seal) {
      pocket.show(cells, coloursOf(options.seats, seat).deep);
      const at = cellCentre(seal);
      tieBow(at, rivalColours(options.seats, seat), rng.float(-0.4, 0.4));
      puffSand(at, options.reducedEffects ? 4 : 12, 0.3);
      options.stage.lights.flash(at.clone().setY(1.2), '#ffe1a8', night ? 14 : 5, 0.5);
    },
    update(dt, clock) {
      tomb.update(dt, clock);
      priest.follow(
        actionPoint(
          mummies.filter((_, seat) => seat < options.players).map((mummy) => mummy.root.position),
        ),
      );
      priest.update(dt, clock);
      shuffleClock += dt;
      if (shuffleClock > 0.22 && !options.reducedEffects) {
        shuffleClock = 0;
        mummies.forEach((mummy, seat) => {
          if (mummy.root.visible && seat < options.players) puffSand(mummy.root.position, 1, 0.1);
        });
      }
      if (dt > 0 && !options.reducedEffects) {
        for (const torch of tomb.torches) if (rng.chance(dt * 6)) emberFrom(torch.flame);
      }
      for (const bow of bows) {
        bow.age += dt;
        const t = Math.min(1, bow.age / 0.5);
        bow.root.scale.setScalar(
          Math.max(0.01, 1 + Math.sin(t * Math.PI * 2.5) * (1 - t) * 0.4) * Math.min(1, t * 4),
        );
      }
      pocket.update(dt);
      dust.update(dt, options.stage.camera);
      sparks.update(dt, options.stage.camera);
    },
    dispose() {
      priest.dispose();
      tomb.dispose();
      bandages.dispose();
      dust.dispose();
      sparks.dispose();
      pocket.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
  return createTrailView(options, parts);
}
