/**
 * The table's effects, built from particles, ground paint, flash lights and
 * camera shake: the explosion that ends a duel, muzzle flashes, ricochet
 * sparks and dust. An explosion is a short choreography rather than one
 * burst: a white flash and a shock ring first, then the fireball, sparks and
 * flying debris, then smoke that keeps rolling up for seconds after, lit
 * orange from below while the fire lasts. Reduced intensity (a setting, and
 * always with reduced motion) keeps only a bright pop and the scorch mark.
 */
import type { Rng } from '@woodgrain-88/kit';
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Camera,
  type IUniform,
  type Object3D,
} from 'three';
import type { GroundPaint } from './ground-paint.ts';
import type { LightRig } from './lighting.ts';
import { createParticleField, type GlowSource, type ParticleField } from './particles.ts';
import type { CameraShake } from './shake.ts';

export type EffectIntensity = 'full' | 'reduced';

export interface EffectsOptions {
  readonly parent: Object3D;
  readonly lights: LightRig;
  readonly rng: Rng;
  readonly intensity: EffectIntensity;
  readonly groundPaint?: GroundPaint;
  readonly shake?: CameraShake;
}

export interface ExplosionOptions {
  /** Size multiplier: 1 for a tank, smaller for a plane in the air. */
  readonly scale?: number;
  /** The direction the killing shot travelled; debris and fire lean along it. */
  readonly push?: Vector3;
  /** Paint colour for some of the debris, so the wreck reads as the tank that was hit. */
  readonly paint?: Color;
  /** Leave a scorch mark (false for explosions in the air). */
  readonly scorch?: boolean;
  /**
   * The smoke, when not a tank's black soot: its colour as it rises and as it thins, and how much of
   * it there is (1 the full column). A blast in snow throws up a pale plume that clears quickly.
   */
  readonly smoke?: { readonly colour: Color; readonly thin: Color; readonly amount: number };
}

export interface Effects {
  readonly smoke: ParticleField;
  readonly glow: ParticleField;
  explosion(at: Vector3, options?: ExplosionOptions): void;
  muzzleFlash(at: Vector3, direction: Vector3): void;
  ricochet(at: Vector3, normal: Vector3): void;
  dust(at: Vector3, amount: number): void;
  /** Flames and smoke rising from something for a while, following it as it moves (a hit tank spinning). */
  burn(follow: () => Vector3, seconds: number): void;
  setIntensity(intensity: EffectIntensity): void;
  update(dt: number, camera: Camera): void;
  dispose(): void;
}

const HOT = {
  flash: new Color(4, 3.2, 2.2),
  fireStart: new Color(1.9, 0.95, 0.28),
  fireEnd: new Color(0.4, 0.07, 0.02),
  sparkStart: new Color(6, 3.2, 0.9),
  sparkEnd: new Color(2, 0.45, 0.05),
  ember: new Color(4, 1.4, 0.25),
  muzzle: new Color(8, 6, 3),
  ricochet: new Color(5, 4.6, 3.4),
};

const SOOT = new Color(0.11, 0.1, 0.095);
const SOOT_THIN = new Color(0.3, 0.29, 0.28);
const DUST = new Color(0.55, 0.45, 0.31);
const DUST_THIN = new Color(0.68, 0.58, 0.44);
const GUN_SMOKE = new Color(0.42, 0.41, 0.4);
const FIRE_GLOW = new Color(1, 0.42, 0.12);
const DEBRIS_METAL = new Color('#2f2b27');
const MAX_DEBRIS = 64;

/** How much bigger than a tank a tank's explosion is: the blast should dwarf what it hits. */
const BLAST = 2;

interface Burner {
  readonly follow: () => Vector3;
  left: number;
  timer: number;
}

interface Scheduled {
  readonly at: number;
  readonly run: () => void;
}

interface Fire {
  readonly position: Vector3;
  age: number;
  readonly duration: number;
  readonly strength: number;
}

interface Chunk {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly spin: Vector3;
  readonly rotation: Quaternion;
  readonly scale: Vector3;
  age: number;
  readonly life: number;
  smokeTimer: number;
}

interface RingUniforms {
  [name: string]: IUniform;
  progress: IUniform<number>;
  strength: IUniform<number>;
}

export function createEffects(options: EffectsOptions): Effects {
  const { rng, lights } = options;
  const smoke = createParticleField('smoke', 2400, lights.palette);
  const glow = createParticleField('glow', 2400, lights.palette);
  options.parent.add(smoke.mesh, glow.mesh);

  const debris = createDebris();
  options.parent.add(debris.mesh);
  const rings = Array.from({ length: 4 }, () => createShockRing());
  for (const ring of rings) options.parent.add(ring.mesh);

  let intensity = options.intensity;
  let clock = 0;
  const schedule: Scheduled[] = [];
  const fires: Fire[] = [];

  function later(delay: number, run: () => void): void {
    schedule.push({ at: clock + delay, run });
  }

  function spread(radius: number): number {
    return rng.float(-radius, radius);
  }

  function flash(at: Vector3, size: number, life: number): void {
    glow.emit({
      x: at.x,
      y: at.y,
      z: at.z,
      life,
      size,
      sizeEnd: size * 1.4,
      colour: HOT.flash,
      fadeIn: 0,
      alpha: 1,
      alphaEnd: 0,
    });
  }

  function fireball(at: Vector3, scale: number, push: Vector3, count: number): void {
    for (let index = 0; index < count; index++) {
      const speed = rng.float(1.5, 5.5) * scale;
      const direction = new Vector3(spread(1), rng.float(0.3, 1.4), spread(1))
        .normalize()
        .addScaledVector(push, 0.45);
      smoke.emit({
        x: at.x + spread(0.5 * scale),
        y: at.y + rng.float(0, 0.4) * scale,
        z: at.z + spread(0.5 * scale),
        vx: direction.x * speed,
        vy: direction.y * speed,
        vz: direction.z * speed,
        drag: 2.8,
        lift: 3,
        life: rng.float(0.45, 0.95),
        size: rng.float(0.9, 1.4) * scale,
        sizeEnd: rng.float(2.2, 3) * scale,
        colour: HOT.fireStart,
        colourEnd: HOT.fireEnd,
        alpha: rng.float(0.8, 1),
        alphaEnd: 0,
        heat: 1,
        rotation: rng.float(0, Math.PI * 2),
        spin: spread(2),
        seed: rng.next(),
      });
    }
  }

  function smokeColumn(
    at: Vector3,
    scale: number,
    count: number,
    lifeScale: number,
    colour = SOOT,
    colourEnd = SOOT_THIN,
  ): void {
    for (let index = 0; index < count; index++) {
      later((index / count) * 1.4, () => {
        smoke.emit({
          x: at.x + spread(0.5 * scale),
          y: at.y + rng.float(0.2, 0.9) * scale,
          z: at.z + spread(0.5 * scale),
          vx: spread(1),
          vy: rng.float(3, 5),
          vz: spread(1),
          drag: 0.7,
          lift: 3.2,
          life: rng.float(2.8, 4.4) * lifeScale,
          size: rng.float(1.1, 1.8) * scale,
          sizeEnd: rng.float(4.5, 6.5) * scale,
          colour,
          colourEnd,
          alpha: rng.float(0.85, 0.95),
          alphaEnd: 0,
          rotation: rng.float(0, Math.PI * 2),
          spin: spread(0.6),
          seed: rng.next(),
        });
      });
    }
  }

  /** Sand thrown out along the ground: from above, the blast's footprint reads as a ring. */
  function dustRing(at: Vector3, scale: number): void {
    for (let index = 0; index < 18; index++) {
      const angle = (index / 18) * Math.PI * 2 + rng.float(-0.15, 0.15);
      const speed = rng.float(7, 11) * scale * 0.5;
      smoke.emit({
        x: at.x + Math.cos(angle) * 0.6,
        y: 0.25,
        z: at.z + Math.sin(angle) * 0.6,
        vx: Math.cos(angle) * speed,
        vy: rng.float(0.2, 0.8),
        vz: Math.sin(angle) * speed,
        drag: 3.2,
        lift: 0.3,
        life: rng.float(1.1, 1.8),
        size: rng.float(0.9, 1.3) * scale * 0.5,
        sizeEnd: rng.float(2.4, 3.2) * scale * 0.5,
        colour: DUST,
        colourEnd: DUST_THIN,
        alpha: 0.6,
        alphaEnd: 0,
        rotation: rng.float(0, Math.PI * 2),
        seed: rng.next(),
      });
    }
  }

  /** A few additive puffs inside the fireball: its white-hot heart, the part bloom catches. */
  function hotCore(at: Vector3, scale: number): void {
    for (let index = 0; index < 6; index++) {
      glow.emit({
        x: at.x + spread(0.4 * scale),
        y: at.y + rng.float(0.2, 0.8) * scale,
        z: at.z + spread(0.4 * scale),
        vy: rng.float(0.5, 2),
        drag: 3,
        life: rng.float(0.22, 0.4),
        size: rng.float(1.2, 1.8) * scale,
        sizeEnd: 0.6 * scale,
        colour: new Color(2.6, 1.7, 0.7),
        alpha: 0.8,
        alphaEnd: 0,
        seed: rng.next(),
      });
    }
  }

  function smokeBurst(at: Vector3, scale: number, colour = SOOT, colourEnd = SOOT_THIN): void {
    for (let index = 0; index < 9; index++) {
      const direction = new Vector3(spread(1), rng.float(0.2, 0.9), spread(1)).normalize();
      const speed = rng.float(2, 4.5) * scale;
      smoke.emit({
        x: at.x + direction.x * 0.4,
        y: at.y + 0.3,
        z: at.z + direction.z * 0.4,
        vx: direction.x * speed,
        vy: direction.y * speed,
        vz: direction.z * speed,
        drag: 2.6,
        lift: 1.2,
        life: rng.float(1.6, 2.6),
        size: rng.float(1.4, 2) * scale,
        sizeEnd: rng.float(4, 5.5) * scale,
        colour,
        colourEnd,
        alpha: 0.9,
        alphaEnd: 0,
        rotation: rng.float(0, Math.PI * 2),
        spin: spread(0.8),
        seed: rng.next(),
      });
    }
  }

  function sparks(
    at: Vector3,
    count: number,
    speedRange: [number, number],
    around?: Vector3,
  ): void {
    for (let index = 0; index < count; index++) {
      const direction = new Vector3(spread(1), rng.float(0.15, 1.2), spread(1));
      if (around) direction.addScaledVector(around, 1.4);
      direction.normalize();
      const speed = rng.float(speedRange[0], speedRange[1]);
      glow.emit({
        x: at.x,
        y: at.y,
        z: at.z,
        vx: direction.x * speed,
        vy: direction.y * speed,
        vz: direction.z * speed,
        lift: -24,
        drag: 0.6,
        bounce: 0.35,
        life: rng.float(0.35, 1),
        size: rng.float(0.06, 0.11),
        colour: HOT.sparkStart,
        colourEnd: HOT.sparkEnd,
        alpha: 1,
        alphaEnd: 0.2,
        stretch: 0.035,
        seed: rng.next(),
      });
    }
  }

  function embers(at: Vector3, count: number): void {
    for (let index = 0; index < count; index++) {
      glow.emit({
        x: at.x + spread(0.8),
        y: at.y + rng.float(0.2, 1),
        z: at.z + spread(0.8),
        vx: spread(1.5),
        vy: rng.float(1.5, 3.5),
        vz: spread(1.5),
        drag: 1.4,
        lift: 0.8,
        life: rng.float(1.4, 2.6),
        size: rng.float(0.07, 0.13),
        colour: HOT.ember,
        colourEnd: HOT.fireEnd,
        alpha: 1,
        alphaEnd: 0,
        seed: rng.next(),
      });
    }
  }

  function explosion(at: Vector3, explosionOptions: ExplosionOptions = {}): void {
    const scale = explosionOptions.scale ?? 1;
    const push = (explosionOptions.push ?? new Vector3()).clone().setY(0).normalize();
    const full = intensity === 'full';

    flash(at, 6 * scale, full ? 0.14 : 0.2);
    lights.flash(at.clone().setY(at.y + 1.5), '#ff9a4a', full ? 80 : 50, full ? 0.7 : 0.35);
    if (explosionOptions.scorch !== false) {
      options.groundPaint?.stamp({
        kind: 'scorch',
        x: at.x,
        z: at.z,
        width: 6.5 * scale,
        length: 6.5 * scale,
        angle: rng.float(0, Math.PI),
        strength: 1,
      });
    }

    const smokeColour = explosionOptions.smoke?.colour ?? SOOT;
    const smokeThin = explosionOptions.smoke?.thin ?? SOOT_THIN;
    const smokeAmount = explosionOptions.smoke?.amount ?? 1;
    if (!full) {
      fireball(at, scale * 0.7, push, 6);
      smokeColumn(at, scale * 0.6, Math.ceil(5 * smokeAmount), 0.4, smokeColour, smokeThin);
      return;
    }

    fires.push({ position: at.clone().setY(at.y + 1.2), age: 0, duration: 1.4, strength: 3 });
    const blast = scale * BLAST;
    const ring = rings.find((candidate) => candidate.idle()) ?? rings[0];
    ring?.start(at, 6 * blast);
    // Dark smoke from the first instant frames the fire; the column keeps rolling after it.
    smokeBurst(at, blast, smokeColour, smokeThin);
    dustRing(at, blast);
    fireball(at, blast, push, 18);
    hotCore(at, blast);
    later(0.07, () => fireball(at.clone().addScaledVector(push, 0.8), blast * 0.8, push, 10));
    later(0.16, () => fireball(at.clone().setY(at.y + 0.8), blast * 0.7, push, 8));
    sparks(at, 46, [8, 20]);
    embers(at, 22);
    smokeColumn(
      at,
      blast,
      Math.ceil(46 * smokeAmount),
      1.15 * Math.max(0.4, smokeAmount),
      smokeColour,
      smokeThin,
    );
    debris.burst(at, push, scale, explosionOptions.paint ?? DEBRIS_METAL);
    options.shake?.addTrauma(0.55 * scale);
  }

  function muzzleFlash(at: Vector3, direction: Vector3): void {
    const forward = direction.clone().normalize();
    glow.emit({
      x: at.x,
      y: at.y,
      z: at.z,
      life: 0.07,
      size: 1.1,
      sizeEnd: 1.5,
      colour: HOT.muzzle,
      fadeIn: 0,
      alpha: 1,
      alphaEnd: 0,
    });
    lights.flash(at, '#ffd08a', 45, 0.09);
    if (intensity === 'reduced') return;
    for (let index = 0; index < 3; index++) {
      smoke.emit({
        x: at.x + forward.x * 0.2,
        y: at.y,
        z: at.z + forward.z * 0.2,
        vx: forward.x * rng.float(1.5, 3) + spread(0.4),
        vy: rng.float(0.3, 0.9),
        vz: forward.z * rng.float(1.5, 3) + spread(0.4),
        drag: 2.5,
        lift: 0.6,
        life: rng.float(0.7, 1.2),
        size: 0.45,
        sizeEnd: 1.7,
        colour: GUN_SMOKE,
        alpha: 0.5,
        alphaEnd: 0,
        rotation: rng.float(0, Math.PI * 2),
        seed: rng.next(),
      });
    }
  }

  function ricochet(at: Vector3, normal: Vector3): void {
    glow.emit({
      x: at.x,
      y: at.y,
      z: at.z,
      life: 0.09,
      size: 0.9,
      sizeEnd: 0.4,
      colour: HOT.ricochet,
      fadeIn: 0,
      alpha: 1,
      alphaEnd: 0,
    });
    lights.flash(at, '#ffe2b0', 22, 0.08);
    if (intensity === 'reduced') return;
    sparks(at, 12, [4, 10], normal);
  }

  function dust(at: Vector3, amount: number): void {
    if (intensity === 'reduced' && amount < 1) return;
    const count = Math.max(1, Math.round(amount * 3));
    for (let index = 0; index < count; index++) {
      smoke.emit({
        x: at.x + spread(0.3),
        y: Math.max(0.05, at.y),
        z: at.z + spread(0.3),
        vx: spread(0.6),
        vy: rng.float(0.2, 0.6),
        vz: spread(0.6),
        drag: 1.8,
        lift: 0.15,
        life: rng.float(0.7, 1.3),
        size: rng.float(0.35, 0.55),
        sizeEnd: rng.float(1.2, 1.8),
        colour: DUST,
        colourEnd: DUST_THIN,
        alpha: rng.float(0.25, 0.4),
        alphaEnd: 0,
        rotation: rng.float(0, Math.PI * 2),
        seed: rng.next(),
      });
    }
  }

  const burners: Burner[] = [];

  function burn(follow: () => Vector3, seconds: number): void {
    burners.push({ follow, left: seconds, timer: 0 });
  }

  function feedBurners(dt: number): void {
    for (let index = burners.length - 1; index >= 0; index--) {
      const burner = burners[index];
      if (!burner) continue;
      burner.left -= dt;
      burner.timer -= dt;
      if (burner.left <= 0) {
        burners.splice(index, 1);
        continue;
      }
      if (burner.timer > 0) continue;
      burner.timer = 1 / 30;
      const at = burner.follow();
      smoke.emit({
        x: at.x + spread(0.5),
        y: at.y + rng.float(0.3, 0.8),
        z: at.z + spread(0.5),
        vx: spread(0.4),
        vy: rng.float(1.5, 3),
        vz: spread(0.4),
        drag: 1.5,
        lift: 2,
        life: rng.float(0.4, 0.7),
        size: rng.float(0.9, 1.5),
        sizeEnd: 0.5,
        colour: HOT.fireStart,
        colourEnd: HOT.fireEnd,
        alpha: 0.9,
        alphaEnd: 0,
        heat: 1,
        seed: rng.next(),
      });
      if (intensity === 'full' && rng.chance(0.6)) {
        smoke.emit({
          x: at.x + spread(0.4),
          y: at.y + 1,
          z: at.z + spread(0.4),
          vx: spread(0.5),
          vy: rng.float(1.5, 2.5),
          vz: spread(0.5),
          drag: 0.8,
          lift: 1.8,
          life: rng.float(1.6, 2.6),
          size: rng.float(1, 1.5),
          sizeEnd: rng.float(4, 5.5),
          colour: SOOT,
          colourEnd: SOOT_THIN,
          alpha: 0.8,
          alphaEnd: 0,
          rotation: rng.float(0, Math.PI * 2),
          spin: spread(0.5),
          seed: rng.next(),
        });
      }
    }
  }

  function runSchedule(): void {
    for (let index = schedule.length - 1; index >= 0; index--) {
      const item = schedule[index];
      if (item && item.at <= clock) {
        schedule.splice(index, 1);
        item.run();
      }
    }
  }

  function fireLight(): GlowSource[] {
    const sources: GlowSource[] = [];
    for (let index = fires.length - 1; index >= 0; index--) {
      const fire = fires[index];
      if (!fire) continue;
      if (fire.age >= fire.duration) {
        fires.splice(index, 1);
        continue;
      }
      const left = 1 - fire.age / fire.duration;
      sources.push({
        position: fire.position,
        colour: FIRE_GLOW,
        strength: fire.strength * left * left,
      });
    }
    return sources;
  }

  return {
    smoke,
    glow,
    explosion,
    muzzleFlash,
    ricochet,
    dust,
    burn,
    setIntensity(next) {
      intensity = next;
    },
    update(dt, camera) {
      clock += dt;
      runSchedule();
      feedBurners(dt);
      for (const fire of fires) fire.age += dt;
      smoke.setGlowSources(fireLight());
      debris.update(dt, (at) => {
        if (intensity === 'full') {
          smoke.emit({
            x: at.x,
            y: at.y,
            z: at.z,
            life: rng.float(0.5, 0.9),
            size: 0.25,
            sizeEnd: 0.9,
            colour: SOOT,
            alpha: 0.55,
            alphaEnd: 0,
            lift: 0.8,
            seed: rng.next(),
          });
        }
      });
      for (const ring of rings) ring.update(dt);
      smoke.update(dt, camera);
      glow.update(dt, camera);
    },
    dispose() {
      smoke.dispose();
      glow.dispose();
      debris.dispose();
      for (const ring of rings) ring.dispose();
    },
  };

  function createDebris() {
    const geometry = new IcosahedronGeometry(0.17, 0);
    const material = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.65,
      metalness: 0.35,
    });
    const mesh = new InstancedMesh(geometry, material, MAX_DEBRIS);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.count = 0;
    mesh.frustumCulled = false;
    const chunks: Chunk[] = [];
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3();
    const colours: Color[] = [];

    return {
      mesh,
      burst(at: Vector3, push: Vector3, scale: number, paint: Color) {
        for (let index = 0; index < 12 && chunks.length < MAX_DEBRIS; index++) {
          const direction = new Vector3(spread(1), rng.float(0.6, 1.6), spread(1))
            .addScaledVector(push, 0.6)
            .normalize();
          const speed = rng.float(5, 11) * scale;
          chunks.push({
            position: at.clone().setY(at.y + 0.3),
            velocity: direction.multiplyScalar(speed),
            spin: new Vector3(spread(14), spread(14), spread(14)),
            rotation: new Quaternion().setFromAxisAngle(
              new Vector3(spread(1), 1, spread(1)).normalize(),
              rng.float(0, 6),
            ),
            scale: new Vector3(
              rng.float(0.5, 1.4),
              rng.float(0.3, 0.8),
              rng.float(0.5, 1.2),
            ).multiplyScalar(scale),
            age: 0,
            life: rng.float(2.5, 4),
            smokeTimer: 0,
          });
          colours.push(rng.chance(0.45) ? paint.clone() : DEBRIS_METAL.clone());
        }
      },
      update(dt: number, trail: (at: Vector3) => void) {
        for (let index = chunks.length - 1; index >= 0; index--) {
          const chunk = chunks[index];
          if (!chunk) continue;
          chunk.age += dt;
          if (chunk.age >= chunk.life) {
            chunks.splice(index, 1);
            colours.splice(index, 1);
            continue;
          }
          const airborne = chunk.position.y > 0.08 || chunk.velocity.y > 0.5;
          chunk.velocity.y -= 22 * dt;
          chunk.position.addScaledVector(chunk.velocity, dt);
          if (chunk.position.y < 0.06) {
            chunk.position.y = 0.06;
            chunk.velocity.set(
              chunk.velocity.x * 0.45,
              Math.abs(chunk.velocity.y) * 0.28,
              chunk.velocity.z * 0.45,
            );
            chunk.spin.multiplyScalar(0.5);
          }
          axis.copy(chunk.spin);
          const rate = axis.length();
          if (rate > 1e-4) {
            turn.setFromAxisAngle(axis.divideScalar(rate), rate * dt);
            chunk.rotation.premultiply(turn);
          }
          chunk.smokeTimer -= dt;
          if (airborne && chunk.age < 0.9 && chunk.smokeTimer <= 0) {
            chunk.smokeTimer = 0.045;
            trail(chunk.position);
          }
        }
        mesh.count = chunks.length;
        chunks.forEach((chunk, index) => {
          const shrink = Math.min(1, (chunk.life - chunk.age) / 0.6);
          matrix.compose(
            chunk.position,
            chunk.rotation,
            chunk.scale.clone().multiplyScalar(shrink),
          );
          mesh.setMatrixAt(index, matrix);
          mesh.setColorAt(index, colours[index] ?? DEBRIS_METAL);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        mesh.removeFromParent();
      },
    };
  }
}

/** A ring of hot air racing out along the ground in the first instant of a blast. */
function createShockRing() {
  const uniforms: RingUniforms = { progress: { value: 1 }, strength: { value: 0 } };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float progress;
      uniform float strength;
      varying vec2 vUv;
      void main() {
        float radius = length(vUv);
        // Squared by hand: pow() of a negative base is undefined on some GPUs.
        float offset = (radius - progress) / (0.06 + progress * 0.12);
        float ring = exp(-offset * offset);
        float inner = (1.0 - smoothstep(0.0, progress, radius)) * 0.25;
        float fade = (1.0 - progress) * (1.0 - progress);
        gl_FragColor = vec4(vec3(2.4, 1.6, 0.9) * (ring + inner) * fade * strength, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  mesh.renderOrder = 8;
  let age = 1;
  const duration = 0.42;

  return {
    mesh,
    idle: () => !mesh.visible,
    start(at: Vector3, radius: number) {
      mesh.position.set(at.x, 0.04, at.z);
      mesh.scale.setScalar(radius * 2);
      age = 0;
      uniforms.strength.value = 1;
      mesh.visible = true;
    },
    update(dt: number) {
      if (!mesh.visible) return;
      age += dt;
      uniforms.progress.value = Math.min(1, age / duration);
      if (age >= duration) mesh.visible = false;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}
