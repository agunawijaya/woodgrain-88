/**
 * A hit in Deep Space: a white flash tinted with the shooter's colour, a ring
 * of light racing out, sparks, and shards of the hull tumbling away in the
 * victim's colour. No fireball and no smoke column: the arena's ground
 * explosion is a tank's, and in space a blast flashes, scatters and is gone,
 * leaving the spinning ship itself in plain sight.
 */
import type { ParticleField } from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  AdditiveBlending,
  CircleGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  TetrahedronGeometry,
  Vector3,
  type Camera,
} from 'three';

const SHARDS = 18;
const SHARD_LIFE = 0.9;
const FLASH_LIFE = 0.28;
const RING_LIFE = 0.6;

interface Shard {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly spin: Vector3;
  readonly turn: Vector3;
  readonly size: number;
  age: number;
}

interface Moment {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  readonly life: number;
  readonly grow: (t: number) => number;
  age: number;
}

export interface DeepBursts {
  readonly root: Group;
  burst(at: Vector3, shooter: Color, victim: Color, full: boolean): void;
  update(dt: number, camera: Camera): void;
  dispose(): void;
}

export function createDeepBursts(options: {
  readonly night: boolean;
  readonly glow: ParticleField;
  readonly rng: Rng;
}): DeepBursts {
  const { night, glow, rng } = options;
  const root = new Group();
  root.name = 'deep-bursts';

  const shardGeometry = new TetrahedronGeometry(1, 0);
  const shardMaterial = new MeshStandardMaterial({
    color: night ? '#9aa3b8' : '#e8ecf3',
    metalness: 0.4,
    roughness: 0.4,
    emissive: '#000000',
  });
  const shardMesh = new InstancedMesh(shardGeometry, shardMaterial, SHARDS * 2);
  shardMesh.count = 0;
  shardMesh.frustumCulled = false;
  root.add(shardMesh);
  const shards: { shard: Shard; colour: Color }[] = [];
  const scratch = new Object3D();

  const flashMap = flashTexture();
  const flashGeometry = new PlaneGeometry(1, 1);
  // By day the flash is a flat painted disc, the chart's way of drawing a burst.
  const discGeometry = new CircleGeometry(0.5, 48).rotateX(-Math.PI / 2);
  const ringGeometry = new RingGeometry(0.8, 1, 56).rotateX(-Math.PI / 2);
  const moments: Moment[] = [];

  function moment(
    mesh: Mesh,
    material: MeshBasicMaterial,
    life: number,
    grow: (t: number) => number,
  ): void {
    root.add(mesh);
    moments.push({ mesh, material, life, grow, age: 0 });
  }

  function sparks(at: Vector3, colour: Color, count: number): void {
    for (let index = 0; index < count; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(3, 10);
      glow.emit({
        x: at.x,
        y: at.y,
        z: at.z,
        vx: Math.cos(angle) * speed,
        vy: rng.float(-0.3, 1.2),
        vz: Math.sin(angle) * speed,
        drag: 3,
        life: rng.float(0.3, 0.7),
        size: rng.float(0.08, 0.17),
        sizeEnd: 0.02,
        colour,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.035,
        fadeIn: 0,
      });
    }
  }

  return {
    root,
    burst(at, shooter, victim, full) {
      // By night a flash of light; by day light added to the pale dome only washes out, so the
      // flash is painted in the shooter's own colour, the way the chart prints its stars.
      const flashColour = night
        ? shooter.clone().lerp(new Color('#ffffff'), 0.6).multiplyScalar(3.6)
        : shooter.clone().lerp(new Color('#fff4c2'), 0.25);
      const flashMaterial = new MeshBasicMaterial({
        map: night ? flashMap : null,
        color: flashColour,
        transparent: true,
        depthWrite: false,
        blending: night ? AdditiveBlending : NormalBlending,
      });
      const flash = new Mesh(night ? flashGeometry : discGeometry, flashMaterial);
      flash.position.copy(at);
      // A painted flash sits over the hull it struck, or the hull would hide it.
      if (!night) {
        flash.position.y += 0.5;
        flash.renderOrder = 20;
        flashMaterial.depthTest = false;
      }
      moment(flash, flashMaterial, FLASH_LIFE, (t) => 1.2 + Math.sqrt(t) * 3.4);

      const ringMaterial = new MeshBasicMaterial({
        color: shooter
          .clone()
          .lerp(new Color('#ffffff'), 0.4)
          .multiplyScalar(night ? 2 : 1),
        transparent: true,
        depthWrite: false,
        blending: night ? AdditiveBlending : NormalBlending,
      });
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.position.copy(at).setY(0.25);
      moment(ring, ringMaterial, RING_LIFE, (t) => 0.4 + t * 2.8);
      if (!night) {
        // An ink line just outside the shock ring keeps it crisp against the dome.
        const inkMaterial = new MeshBasicMaterial({
          color: '#16203a',
          transparent: true,
          depthWrite: false,
        });
        const ink = new Mesh(ringGeometry, inkMaterial);
        ink.position.copy(at).setY(0.24);
        moment(ink, inkMaterial, RING_LIFE, (t) => 0.46 + t * 2.95);
      }

      if (!full) return;
      const hot = shooter
        .clone()
        .lerp(new Color('#ffffff'), 0.3)
        .multiplyScalar(night ? 3.4 : 1.8);
      sparks(at, hot, 80);
      sparks(at, victim.clone().multiplyScalar(night ? 3 : 1.6), 28);
      for (let index = 0; index < SHARDS; index++) {
        if (shards.length >= SHARDS * 2) shards.shift();
        const angle = rng.float(0, Math.PI * 2);
        const speed = rng.float(1.5, 5);
        shards.push({
          shard: {
            position: at.clone(),
            velocity: new Vector3(
              Math.cos(angle) * speed,
              rng.float(-0.4, 0.8),
              Math.sin(angle) * speed,
            ),
            spin: new Vector3(rng.float(-9, 9), rng.float(-9, 9), rng.float(-9, 9)),
            turn: new Vector3(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6)),
            size: rng.float(0.05, 0.13),
            age: 0,
          },
          colour: index % 2 === 0 ? victim : new Color(night ? '#9aa3b8' : '#e8ecf3'),
        });
      }
    },
    update(dt, camera) {
      for (const item of [...moments]) {
        item.age += dt;
        const t = Math.min(1, item.age / item.life);
        item.mesh.scale.setScalar(item.grow(t));
        if (item.mesh.geometry === flashGeometry) item.mesh.quaternion.copy(camera.quaternion);
        item.material.opacity = (1 - t) ** 1.6;
        if (t >= 1) {
          item.mesh.removeFromParent();
          item.material.dispose();
          moments.splice(moments.indexOf(item), 1);
        }
      }
      let live = 0;
      for (const { shard, colour } of shards) {
        shard.age += dt;
        if (shard.age >= SHARD_LIFE) continue;
        shard.velocity.multiplyScalar(Math.exp(-dt * 1.4));
        shard.position.addScaledVector(shard.velocity, dt);
        shard.turn.addScaledVector(shard.spin, dt);
        const fade = 1 - shard.age / SHARD_LIFE;
        scratch.position.copy(shard.position);
        scratch.rotation.set(shard.turn.x, shard.turn.y, shard.turn.z);
        scratch.scale.setScalar(shard.size * Math.sqrt(fade));
        scratch.updateMatrix();
        shardMesh.setMatrixAt(live, scratch.matrix);
        shardMesh.setColorAt(live, colour);
        live++;
      }
      shardMesh.count = live;
      shardMesh.instanceMatrix.needsUpdate = true;
      if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      shardGeometry.dispose();
      shardMaterial.dispose();
      shardMesh.dispose();
      flashGeometry.dispose();
      discGeometry.dispose();
      flashMap.dispose();
      ringGeometry.dispose();
      for (const item of moments) item.material.dispose();
    },
  };
}

/** The flash: white at the heart, falling off fast, so it reads as a pop and not a ball. */
function flashTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the flash');
  const centre = size / 2;
  const gradient = context.createRadialGradient(centre, centre, 0, centre, centre, centre);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
