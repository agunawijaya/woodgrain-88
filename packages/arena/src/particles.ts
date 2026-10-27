/**
 * Particles for every effect on the table: dust behind tracks, smoke that
 * rolls off a burning wreck, fire, sparks off a ricochet. Two looks share one
 * engine. "smoke" is soft, lit like the scene (bright on its sun side, glowing
 * orange near fire) and sorted back to front; a smoke particle with `heat`
 * glows by itself instead, which is how flames are drawn, so fire and smoke
 * sort together and overlapping flames never add up to a white blob. "glow" is additive and brighter
 * than white so bloom catches it; with `stretch` a glow particle is drawn as
 * a streak along its motion, which is how sparks and tracer bits read.
 *
 * Simulation runs on the CPU in flat typed arrays, deterministic for a given
 * sequence of spawns and steps, so hero frames and tests can replay a moment.
 */
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  Vector4,
  BufferAttribute,
  type Camera,
  type IUniform,
} from 'three';
import type { LightPalette } from './lighting.ts';

export type ParticleLook = 'smoke' | 'glow';

export interface ParticleSpawn {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx?: number;
  readonly vy?: number;
  readonly vz?: number;
  /** Seconds. */
  readonly life: number;
  /** Diameter in world units at birth and at death. */
  readonly size: number;
  readonly sizeEnd?: number;
  /** Linear RGB; glow colours may exceed 1 to bloom. */
  readonly colour: Color;
  readonly colourEnd?: Color;
  readonly alpha?: number;
  readonly alphaEnd?: number;
  /** Fraction of velocity lost per second (air drag). */
  readonly drag?: number;
  /** Upward acceleration in units/s²: positive rises like hot smoke, negative falls. */
  readonly lift?: number;
  readonly rotation?: number;
  readonly spin?: number;
  /** Glow only: streak length in seconds of travel; 0 for a round sprite. */
  readonly stretch?: number;
  /** Bounciness on the table top (y = 0); 0 lets it settle and die there. */
  readonly bounce?: number;
  /** A per-particle number for the shader's noise, so no two puffs look alike. */
  readonly seed?: number;
  /** Smoke only: 0 is lit by the scene, 1 glows by itself (flames); between is smoke lit from within. */
  readonly heat?: number;
  /** Seconds to fade in; by default a twelfth of the life, at most a quarter second. Tracers use 0. */
  readonly fadeIn?: number;
}

/** Up to four lights (fire, flashes) that colour nearby smoke. */
export interface GlowSource {
  readonly position: Vector3;
  readonly colour: Color;
  readonly strength: number;
}

export interface ParticleField {
  readonly mesh: Mesh;
  readonly look: ParticleLook;
  readonly count: number;
  emit(spawn: ParticleSpawn): void;
  update(dt: number, camera: Camera): void;
  setGlowSources(sources: readonly GlowSource[]): void;
  clear(): void;
  dispose(): void;
}

const MAX_GLOW_SOURCES = 4;

/** Per-particle state, one slot per index in each array. */
class ParticleState {
  readonly position: Float32Array;
  readonly velocity: Float32Array;
  readonly colourStart: Float32Array;
  readonly colourEnd: Float32Array;
  /** age, life, sizeStart, sizeEnd */
  readonly timing: Float32Array;
  /** alphaStart, alphaEnd, drag, lift */
  readonly motion: Float32Array;
  /** rotation, spin, stretch, bounce */
  readonly turn: Float32Array;
  readonly seed: Float32Array;
  readonly heat: Float32Array;
  readonly fadeIn: Float32Array;
  count = 0;

  constructor(readonly capacity: number) {
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.colourStart = new Float32Array(capacity * 3);
    this.colourEnd = new Float32Array(capacity * 3);
    this.timing = new Float32Array(capacity * 4);
    this.motion = new Float32Array(capacity * 4);
    this.turn = new Float32Array(capacity * 4);
    this.seed = new Float32Array(capacity);
    this.heat = new Float32Array(capacity);
    this.fadeIn = new Float32Array(capacity);
  }

  /** Moves slot `from` into slot `to` (used to keep live particles packed at the front). */
  move(from: number, to: number): void {
    this.position.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.velocity.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.colourStart.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.colourEnd.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.timing.copyWithin(to * 4, from * 4, from * 4 + 4);
    this.motion.copyWithin(to * 4, from * 4, from * 4 + 4);
    this.turn.copyWithin(to * 4, from * 4, from * 4 + 4);
    this.seed[to] = this.seed[from] ?? 0;
    this.heat[to] = this.heat[from] ?? 0;
    this.fadeIn[to] = this.fadeIn[from] ?? 0;
  }
}

const VERTEX = /* glsl */ `
  attribute vec3 iPosition;
  attribute vec3 iVelocity;
  attribute vec4 iColour;
  attribute vec4 iShape; // size, rotation, stretch, seed
  attribute float iAge;
  attribute float iHeat;

  varying vec2 vCorner;
  varying vec4 vColour;
  varying float vSeed;
  varying float vAge;
  varying float vHeat;
  varying vec3 vWorld;

  void main() {
    vec4 viewPosition = viewMatrix * vec4(iPosition, 1.0);
    vec2 corner = position.xy;
    float size = iShape.x;
    vec2 offset;
    if (iShape.z > 0.0) {
      vec2 viewVelocity = (viewMatrix * vec4(iVelocity, 0.0)).xy;
      float speed = length(viewVelocity);
      vec2 along = speed > 1e-4 ? viewVelocity / speed : vec2(1.0, 0.0);
      vec2 across = vec2(-along.y, along.x);
      float halfLength = size * 0.5 + speed * iShape.z * 0.5;
      offset = along * corner.x * halfLength + across * corner.y * size * 0.5;
      // Shift the streak back along its path so its head sits on the particle.
      offset -= along * speed * iShape.z * 0.5;
    } else {
      float c = cos(iShape.y);
      float s = sin(iShape.y);
      offset = mat2(c, s, -s, c) * corner * size * 0.5;
    }
    viewPosition.xy += offset;
    gl_Position = projectionMatrix * viewPosition;
    vCorner = corner;
    vColour = iColour;
    vSeed = iShape.w;
    vAge = iAge;
    vHeat = iHeat;
    vWorld = iPosition;
  }
`;

const NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm3(vec2 p) {
    return valueNoise(p) * 0.55 + valueNoise(p * 2.03 + 7.1) * 0.3 + valueNoise(p * 4.1 + 3.7) * 0.15;
  }
`;

const SMOKE_FRAGMENT = /* glsl */ `
  uniform vec3 keyDirectionView;
  uniform vec3 keyColour;
  uniform vec3 ambientColour;
  uniform vec4 glowPositions[${MAX_GLOW_SOURCES}];
  uniform vec3 glowColours[${MAX_GLOW_SOURCES}];

  varying vec2 vCorner;
  varying vec4 vColour;
  varying float vSeed;
  varying float vAge;
  varying float vHeat;
  varying vec3 vWorld;
  ${NOISE}

  void main() {
    float radius = length(vCorner);
    // Billowing edge: the noise churns slowly as the puff ages.
    float churn = fbm3(vCorner * 1.6 + vec2(vSeed * 17.0, vSeed * 5.0 + vAge * 0.8));
    float edge = 1.0 - smoothstep(0.45, 1.0, radius + (churn - 0.5) * 0.6);
    if (edge <= 0.002) discard;

    // A fake sphere normal gives each puff a lit side and a shaded side.
    vec3 normal = normalize(vec3(vCorner * 0.85, sqrt(max(0.0, 1.0 - radius * radius)) + 0.25));
    float facing = dot(normal, keyDirectionView) * 0.5 + 0.5;
    float body = 0.7 + 0.3 * churn;
    vec3 lit = vColour.rgb * body * (ambientColour + keyColour * facing * 0.9);
    // Flames: hottest in the middle of each puff, cooling to their ragged edge.
    vec3 flame = mix(vColour.rgb * 0.4, vColour.rgb * 1.35, smoothstep(0.1, 0.9, edge) * (0.6 + 0.5 * churn));
    lit = mix(lit, flame, vHeat);

    for (int index = 0; index < ${MAX_GLOW_SOURCES}; index++) {
      vec4 glow = glowPositions[index];
      if (glow.w <= 0.0) continue;
      float near = distance(vWorld, glow.xyz);
      lit += vColour.rgb * glowColours[index] * glow.w / (1.0 + near * near * 0.35);
    }
    gl_FragColor = vec4(lit, vColour.a * mix(edge, smoothstep(0.0, 0.3, edge), vHeat));
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  varying vec2 vCorner;
  varying vec4 vColour;
  varying float vSeed;
  varying float vAge;
  varying vec3 vWorld;
  ${NOISE}

  void main() {
    float radius = length(vCorner);
    float flicker = 0.75 + 0.5 * fbm3(vCorner * 2.2 + vec2(vSeed * 11.0, vAge * 3.0));
    float core = exp(-radius * radius * 3.2) * flicker;
    if (core < 0.003) discard;
    gl_FragColor = vec4(vColour.rgb * vColour.a * core, 1.0);
  }
`;

interface SmokeUniforms {
  [name: string]: IUniform;
  keyDirectionView: IUniform<Vector3>;
  keyColour: IUniform<Color>;
  ambientColour: IUniform<Color>;
  glowPositions: IUniform<Vector4[]>;
  glowColours: IUniform<Color[]>;
}

export function createParticleField(
  look: ParticleLook,
  capacity: number,
  palette: LightPalette,
): ParticleField {
  const state = new ParticleState(capacity);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const positions = instanced(capacity, 3);
  const velocities = instanced(capacity, 3);
  const colours = instanced(capacity, 4);
  const shapes = instanced(capacity, 4);
  const ages = instanced(capacity, 1);
  const heats = instanced(capacity, 1);
  geometry.setAttribute('iPosition', positions);
  geometry.setAttribute('iVelocity', velocities);
  geometry.setAttribute('iColour', colours);
  geometry.setAttribute('iShape', shapes);
  geometry.setAttribute('iAge', ages);
  geometry.setAttribute('iHeat', heats);
  geometry.instanceCount = 0;

  const smokeUniforms: SmokeUniforms = {
    keyDirectionView: { value: new Vector3(0, 1, 0) },
    keyColour: { value: new Color() },
    ambientColour: { value: new Color() },
    glowPositions: { value: Array.from({ length: MAX_GLOW_SOURCES }, () => new Vector4()) },
    glowColours: { value: Array.from({ length: MAX_GLOW_SOURCES }, () => new Color()) },
  };

  const material = new ShaderMaterial({
    name: look === 'smoke' ? 'ArenaSmoke' : 'ArenaGlow',
    uniforms: look === 'smoke' ? smokeUniforms : {},
    vertexShader: VERTEX,
    fragmentShader: look === 'smoke' ? SMOKE_FRAGMENT : GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: look === 'smoke' ? NormalBlending : AdditiveBlending,
  });

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  // Glow draws after smoke so fire sits in front of its own smoke.
  mesh.renderOrder = look === 'smoke' ? 10 : 11;
  mesh.name = `particles-${look}`;

  const order = new Uint32Array(capacity);
  const depth = new Float32Array(capacity);
  const viewDirection = new Vector3();

  function emit(spawn: ParticleSpawn): void {
    if (state.count >= capacity) return;
    const slot = state.count++;
    state.position.set([spawn.x, spawn.y, spawn.z], slot * 3);
    state.velocity.set([spawn.vx ?? 0, spawn.vy ?? 0, spawn.vz ?? 0], slot * 3);
    const end = spawn.colourEnd ?? spawn.colour;
    state.colourStart.set([spawn.colour.r, spawn.colour.g, spawn.colour.b], slot * 3);
    state.colourEnd.set([end.r, end.g, end.b], slot * 3);
    state.timing.set(
      [0, Math.max(1e-3, spawn.life), spawn.size, spawn.sizeEnd ?? spawn.size],
      slot * 4,
    );
    const alpha = spawn.alpha ?? 1;
    state.motion.set([alpha, spawn.alphaEnd ?? 0, spawn.drag ?? 0, spawn.lift ?? 0], slot * 4);
    state.turn.set(
      [spawn.rotation ?? 0, spawn.spin ?? 0, spawn.stretch ?? 0, spawn.bounce ?? 0],
      slot * 4,
    );
    state.seed[slot] = spawn.seed ?? slot * 0.137;
    state.heat[slot] = spawn.heat ?? 0;
    state.fadeIn[slot] = spawn.fadeIn ?? Math.min(0.25, spawn.life / 12);
  }

  function simulate(dt: number): void {
    let slot = 0;
    while (slot < state.count) {
      const age = (state.timing[slot * 4] ?? 0) + dt;
      const life = state.timing[slot * 4 + 1] ?? 1;
      if (age >= life) {
        state.count--;
        if (slot !== state.count) state.move(state.count, slot);
        continue;
      }
      state.timing[slot * 4] = age;
      step(slot, dt);
      slot++;
    }
  }

  function step(slot: number, dt: number): void {
    const p = slot * 3;
    const drag = Math.max(0, 1 - (state.motion[slot * 4 + 2] ?? 0) * dt);
    const lift = state.motion[slot * 4 + 3] ?? 0;
    let vx = (state.velocity[p] ?? 0) * drag;
    let vy = ((state.velocity[p + 1] ?? 0) + lift * dt) * drag;
    let vz = (state.velocity[p + 2] ?? 0) * drag;
    const x = (state.position[p] ?? 0) + vx * dt;
    let y = (state.position[p + 1] ?? 0) + vy * dt;
    const z = (state.position[p + 2] ?? 0) + vz * dt;
    if (y < 0) {
      const bounce = state.turn[slot * 4 + 3] ?? 0;
      y = 0;
      vy = -vy * bounce;
      vx *= 0.55;
      vz *= 0.55;
    }
    state.position[p] = x;
    state.position[p + 1] = y;
    state.position[p + 2] = z;
    state.velocity[p] = vx;
    state.velocity[p + 1] = vy;
    state.velocity[p + 2] = vz;
    state.turn[slot * 4] = (state.turn[slot * 4] ?? 0) + (state.turn[slot * 4 + 1] ?? 0) * dt;
  }

  function sortBackToFront(camera: Camera): void {
    camera.getWorldDirection(viewDirection);
    for (let slot = 0; slot < state.count; slot++) {
      order[slot] = slot;
      depth[slot] =
        (state.position[slot * 3] ?? 0) * viewDirection.x +
        (state.position[slot * 3 + 1] ?? 0) * viewDirection.y +
        (state.position[slot * 3 + 2] ?? 0) * viewDirection.z;
    }
    const live = order.subarray(0, state.count);
    live.sort((a, b) => (depth[b] ?? 0) - (depth[a] ?? 0));
  }

  function upload(): void {
    for (let drawn = 0; drawn < state.count; drawn++) {
      const slot = look === 'smoke' ? (order[drawn] ?? drawn) : drawn;
      const t = (state.timing[slot * 4] ?? 0) / (state.timing[slot * 4 + 1] ?? 1);
      const eased = 1 - (1 - t) * (1 - t);
      const size = lerp(state.timing[slot * 4 + 2] ?? 1, state.timing[slot * 4 + 3] ?? 1, eased);
      // Fading in is measured in seconds, so long-lived puffs (clouds) appear as fast as short ones.
      const fadeTime = state.fadeIn[slot] ?? 0;
      const fadeIn = fadeTime > 0 ? Math.min(1, (state.timing[slot * 4] ?? 0) / fadeTime) : 1;
      const alpha = lerp(state.motion[slot * 4] ?? 1, state.motion[slot * 4 + 1] ?? 0, t) * fadeIn;
      positions.array.set(state.position.subarray(slot * 3, slot * 3 + 3), drawn * 3);
      velocities.array.set(state.velocity.subarray(slot * 3, slot * 3 + 3), drawn * 3);
      colours.array[drawn * 4] = lerp(
        state.colourStart[slot * 3] ?? 0,
        state.colourEnd[slot * 3] ?? 0,
        t,
      );
      colours.array[drawn * 4 + 1] = lerp(
        state.colourStart[slot * 3 + 1] ?? 0,
        state.colourEnd[slot * 3 + 1] ?? 0,
        t,
      );
      colours.array[drawn * 4 + 2] = lerp(
        state.colourStart[slot * 3 + 2] ?? 0,
        state.colourEnd[slot * 3 + 2] ?? 0,
        t,
      );
      colours.array[drawn * 4 + 3] = alpha;
      shapes.array[drawn * 4] = size;
      shapes.array[drawn * 4 + 1] = state.turn[slot * 4] ?? 0;
      shapes.array[drawn * 4 + 2] = state.turn[slot * 4 + 2] ?? 0;
      shapes.array[drawn * 4 + 3] = state.seed[slot] ?? 0;
      ages.array[drawn] = t;
      heats.array[drawn] = state.heat[slot] ?? 0;
    }
    for (const attribute of [positions, velocities, colours, shapes, ages, heats]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, state.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
    geometry.instanceCount = state.count;
  }

  function matchLights(camera: Camera): void {
    if (look !== 'smoke') return;
    smokeUniforms.keyDirectionView.value
      .copy(palette.keyDirection)
      .transformDirection(camera.matrixWorldInverse);
    smokeUniforms.keyColour.value.copy(palette.key);
    smokeUniforms.ambientColour.value.copy(palette.ambient);
  }

  return {
    mesh,
    look,
    get count() {
      return state.count;
    },
    emit,
    update(dt, camera) {
      simulate(dt);
      if (look === 'smoke') sortBackToFront(camera);
      matchLights(camera);
      upload();
    },
    setGlowSources(sources) {
      for (let index = 0; index < MAX_GLOW_SOURCES; index++) {
        const source = sources[index];
        const position = smokeUniforms.glowPositions.value[index];
        const colour = smokeUniforms.glowColours.value[index];
        if (!position || !colour) continue;
        if (source) {
          position.set(source.position.x, source.position.y, source.position.z, source.strength);
          colour.copy(source.colour);
        } else {
          position.w = 0;
        }
      }
    },
    clear() {
      state.count = 0;
      geometry.instanceCount = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}

function instanced(
  capacity: number,
  itemSize: number,
): InstancedBufferAttribute & { array: Float32Array } {
  const attribute = new InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute as InstancedBufferAttribute & { array: Float32Array };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
