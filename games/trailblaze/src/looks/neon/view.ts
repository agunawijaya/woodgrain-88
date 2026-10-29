/**
 * The Neon Grid's view: light-bikes on a glass grid, laying walls of light.
 *
 * - A crash breaks the bike into tumbling shards of light and makes its walls flicker.
 * - The trap closing: sparks shoot up from the sealing wall, a ring of light races out across
 *   the glass from it, and the floor of the pocket the rival is shut into pulses in its colour.
 * - Speed-up stretches the bikes' light into streaks behind them.
 */
import { createParticleField, type ParticleField } from '@woodgrain-88/arena';
import {
  AdditiveBlending,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  RingGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import type { Seat } from '../../engine/types.ts';
import { cellCentre } from '../../look/board-space.ts';
import { createPocketMarks } from '../../look/pocket-marks.ts';
import type { TrailView, ViewOptions } from '../../look/look.ts';
import { createTrailView, type LookParts } from '../../look/trail-rig.ts';
import { actionPoint } from '../../look/watcher.ts';
import { createNeonArena } from './arena.ts';
import { createBike } from './bike.ts';
import { createHost } from './host.ts';
import { createNeonWalls, WALL_HEIGHT } from './walls.ts';

const SHARDS_PER_CRASH = 64;
const SHARD_CAPACITY = SHARDS_PER_CRASH * 4;
const GRAVITY = 9;

interface Shard {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly spin: Vector3;
  readonly rotation: Vector3;
  readonly size: number;
  age: number;
  readonly life: number;
}

interface Flicker {
  readonly seat: Seat;
  age: number;
}

interface Shockwave {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  age: number;
}

export function createNeonView(options: ViewOptions): TrailView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('neon');
  const root = new Group();
  root.name = 'neon';
  const arena = createNeonArena({ night, seats: options.seats });
  root.add(arena.root);
  const walls = createNeonWalls({ seats: options.seats, night });
  for (const mesh of walls.meshes) root.add(mesh);
  const host = createHost({ night, seats: options.seats });
  root.add(host.root);
  const riders = options.seats.map((colours, seat) =>
    createBike({ seat: seat as Seat, colours, night }),
  );
  const seatColour = options.seats.map((colours) => new Color(colours.main));
  const colourOf = (seat: Seat): Color => seatColour[seat] ?? new Color('#ffffff');

  const glow: ParticleField = createParticleField('glow', 1600, options.stage.lights.palette);
  root.add(glow.mesh);

  const shardMaterial = new MeshBasicMaterial({ color: '#ffffff', vertexColors: false });
  const shardGeometry = new TetrahedronGeometry(1, 0);
  const shardMesh = new InstancedMesh(shardGeometry, shardMaterial, SHARD_CAPACITY);
  shardMesh.count = 0;
  shardMesh.frustumCulled = false;
  shardMesh.setColorAt(0, new Color());
  root.add(shardMesh);
  const shards: { shard: Shard; colour: Color }[] = [];

  const pocket = createPocketMarks({ floor: 0, glow: night, strength: night ? 0.55 : 0.5 });
  root.add(pocket.mesh);

  const ringGeometry = new RingGeometry(0.42, 0.5, 64);
  ringGeometry.rotateX(-Math.PI / 2);
  const shockwaves: Shockwave[] = [];
  const flickers: Flicker[] = [];
  let speedStage = 0;
  const scratch = new Object3D();

  function burst(at: Vector3, colour: Color, count: number, speed: number): void {
    const hot = colour.clone().multiplyScalar(night ? 3 : 1.6);
    for (let index = 0; index < count; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const pace = rng.float(0.4, 1) * speed;
      glow.emit({
        x: at.x,
        y: at.y + rng.float(0.1, WALL_HEIGHT),
        z: at.z,
        vx: Math.cos(angle) * pace,
        vy: rng.float(0.5, 3),
        vz: Math.sin(angle) * pace,
        lift: -6,
        drag: 1.5,
        life: rng.float(0.4, 0.9),
        size: rng.float(0.08, 0.16),
        sizeEnd: 0.02,
        colour: hot,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.05,
        bounce: 0.3,
        fadeIn: 0,
      });
    }
  }

  const blastGeometry = new SphereGeometry(1, 24, 16);
  const blasts: { mesh: Mesh; material: MeshBasicMaterial; age: number }[] = [];

  /** The bike goes up in a ball of light that swells and burns out in a moment. */
  function blowUp(at: Vector3, colour: Color): void {
    const material = new MeshBasicMaterial({
      color: colour
        .clone()
        .lerp(new Color('#ffffff'), 0.5)
        .multiplyScalar(night ? 3 : 1.4),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(blastGeometry, material);
    mesh.position.copy(at).setY(0.45);
    root.add(mesh);
    blasts.push({ mesh, material, age: 0 });
  }

  function updateBlasts(dt: number): void {
    for (const blast of [...blasts]) {
      blast.age += dt;
      const t = blast.age / 0.45;
      blast.mesh.scale.setScalar(0.2 + Math.sqrt(Math.min(1, t)) * 1.6);
      blast.material.opacity = Math.max(0, 1 - t);
      if (t >= 1) {
        blast.mesh.removeFromParent();
        blast.material.dispose();
        blasts.splice(blasts.indexOf(blast), 1);
      }
    }
  }

  function spawnShards(at: Vector3, direction: Vector3, colour: Color): void {
    for (let index = 0; index < SHARDS_PER_CRASH; index++) {
      if (shards.length >= SHARD_CAPACITY) shards.shift();
      const spread = new Vector3(rng.float(-1, 1), 0, rng.float(-1, 1)).multiplyScalar(2.2);
      shards.push({
        shard: {
          position: at.clone().add(new Vector3(0, rng.float(0.15, 0.5), 0)),
          velocity: direction
            .clone()
            .multiplyScalar(rng.float(-1.5, 1))
            .add(spread)
            .setY(rng.float(1.5, 4.5)),
          spin: new Vector3(rng.float(-12, 12), rng.float(-12, 12), rng.float(-12, 12)),
          rotation: new Vector3(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6)),
          size: rng.float(0.04, 0.11),
          age: 0,
          life: rng.float(1.2, 2.2),
        },
        colour:
          index % 4 === 0 ? new Color('#ffffff') : colour.clone().multiplyScalar(night ? 2.5 : 1.2),
      });
    }
  }

  function updateShards(dt: number): void {
    let live = 0;
    for (const { shard, colour } of shards) {
      shard.age += dt;
      if (shard.age >= shard.life) continue;
      shard.velocity.y -= GRAVITY * dt;
      shard.position.addScaledVector(shard.velocity, dt);
      if (shard.position.y < shard.size) {
        shard.position.y = shard.size;
        shard.velocity.multiplyScalar(0.45);
        shard.velocity.y = Math.abs(shard.velocity.y) * 0.5;
      }
      shard.rotation.addScaledVector(shard.spin, dt);
      const fade = 1 - Math.max(0, (shard.age - shard.life * 0.6) / (shard.life * 0.4));
      scratch.position.copy(shard.position);
      scratch.rotation.set(shard.rotation.x, shard.rotation.y, shard.rotation.z);
      scratch.scale.setScalar(shard.size * fade);
      scratch.updateMatrix();
      shardMesh.setMatrixAt(live, scratch.matrix);
      shardMesh.setColorAt(live, colour);
      live++;
    }
    shardMesh.count = live;
    shardMesh.instanceMatrix.needsUpdate = true;
    if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
  }

  function sendShockwave(at: Vector3, colour: Color): void {
    const material = new MeshBasicMaterial({
      color: colour.clone().multiplyScalar(night ? 2.2 : 1),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    });
    const mesh = new Mesh(ringGeometry, material);
    mesh.position.copy(at).setY(0.02);
    root.add(mesh);
    shockwaves.push({ mesh, material, age: 0 });
  }

  function sparkColumn(at: Vector3, colour: Color): void {
    const hot = colour
      .clone()
      .lerp(new Color('#ffffff'), 0.5)
      .multiplyScalar(night ? 3 : 1.6);
    for (let index = 0; index < 34; index++) {
      glow.emit({
        x: at.x + rng.float(-0.12, 0.12),
        y: rng.float(0.1, WALL_HEIGHT),
        z: at.z + rng.float(-0.12, 0.12),
        vx: rng.float(-0.4, 0.4),
        vy: rng.float(3, 7),
        vz: rng.float(-0.4, 0.4),
        lift: -9,
        drag: 0.8,
        life: rng.float(0.5, 1),
        size: rng.float(0.07, 0.13),
        sizeEnd: 0.02,
        colour: hot,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.06,
        fadeIn: 0,
      });
    }
  }

  function updateMoments(dt: number, clock: number): void {
    for (const flicker of flickers) {
      flicker.age += dt;
      const settling = Math.min(1, flicker.age / 1.6);
      const stutter = Math.sin(clock * 53) * Math.sin(clock * 31) > 0.2 ? 0.25 : 1;
      walls.setFlicker(flicker.seat, settling >= 1 ? 0.75 : stutter * (0.6 + 0.4 * settling));
    }
    for (const wave of [...shockwaves]) {
      wave.age += dt;
      const t = wave.age / 0.8;
      wave.mesh.scale.setScalar(1 + t * 4);
      wave.material.opacity = Math.max(0, 1 - t) ** 2;
      if (t >= 1) {
        wave.mesh.removeFromParent();
        wave.material.dispose();
        shockwaves.splice(shockwaves.indexOf(wave), 1);
      }
    }
  }

  function streaks(): void {
    if (speedStage < 2 || options.reducedEffects) return;
    riders.forEach((rider, seat) => {
      if (!rider.root.visible || seat >= options.players) return;
      const at = rider.root.position;
      glow.emit({
        x: at.x,
        y: 0.3,
        z: at.z,
        life: 0.25,
        size: 0.18,
        sizeEnd: 0.05,
        colour: colourOf(seat as Seat)
          .clone()
          .multiplyScalar(night ? 2 : 1.2),
        alpha: 0.6,
        alphaEnd: 0,
        fadeIn: 0,
      });
    });
  }

  const parts: LookParts = {
    root,
    pieces: walls,
    remixStyle: {
      wall: night ? '#d5ddff' : '#2a3550',
      wallHeight: 0.82,
      lane: night ? '#7dff6a' : '#2f9e44',
      night,
    },
    riders,
    reset(edges) {
      arena.setEdges(edges);
      flickers.length = 0;
      walls.setFlicker(0, 1);
      walls.setFlicker(1, 1);
      pocket.hide();
      shards.length = 0;
      glow.clear();
    },
    crash(crash, at, direction) {
      const colour = colourOf(crash.seat);
      if (!options.reducedEffects) {
        spawnShards(at, direction, colour);
        burst(at, colour, 140, 6);
        burst(at, new Color('#ffffff'), 40, 3);
        blowUp(at, colour);
      }
      options.stage.lights.flash(at.clone().setY(0.8), colour, night ? 70 : 24, 0.7);
      host.react(crash, at);
      flickers.push({ seat: crash.seat, age: 0 });
    },
    trap(seat, cells, seal) {
      pocket.show(cells, colourOf(seat));
      const sealer = (1 - seat) as Seat;
      const at = cellCentre(seal);
      sendShockwave(at, colourOf(sealer));
      if (!options.reducedEffects) sparkColumn(at, colourOf(sealer));
      options.stage.lights.flash(at.clone().setY(1), colourOf(sealer), night ? 30 : 10, 0.8);
    },
    setSpeedStage(stage) {
      speedStage = stage;
    },
    update(dt, clock) {
      host.follow(
        actionPoint(
          riders.filter((_, seat) => seat < options.players).map((bike) => bike.root.position),
        ),
      );
      host.update(dt, clock);
      updateBlasts(dt);
      updateShards(dt);
      updateMoments(dt, clock);
      pocket.update(dt);
      if (dt > 0) streaks();
      glow.update(dt, options.stage.camera);
    },
    dispose() {
      host.dispose();
      blastGeometry.dispose();
      for (const blast of blasts) blast.material.dispose();
      arena.dispose();
      walls.dispose();
      glow.dispose();
      shardGeometry.dispose();
      shardMaterial.dispose();
      shardMesh.dispose();
      pocket.dispose();
      ringGeometry.dispose();
      for (const wave of shockwaves) wave.material.dispose();
    },
  };
  return createTrailView(options, parts);
}
