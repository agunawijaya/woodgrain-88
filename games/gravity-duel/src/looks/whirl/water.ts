/**
 * The Whirlpool's water, seen from above: the sea turning round the middle,
 * faster the closer it gets, foam drawn out into spiral streaks, and at the
 * centre the vortex's dark eye with its ring of foam (the deadly thing a sub
 * must never touch). By day turquoise with sunlight caustics rippling on it;
 * by night dark water where the churn lights up with bioluminescence.
 *
 * One shader on one plane, procedural, nothing loaded.
 */
import { Mesh, PlaneGeometry, ShaderMaterial } from 'three';

export interface Water {
  readonly mesh: Mesh;
  update(clock: number): void;
  dispose(): void;
}

const VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform float uVortex;
  uniform float uEye;
  varying vec2 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p *= 2.1;
      amp *= 0.5;
    }
    return sum;
  }

  // Sunlight focused by the waves: bright wandering lines where cells meet.
  float caustic(vec2 p) {
    vec2 q = p * 0.9;
    float c = 0.0;
    for (int i = 0; i < 3; i++) {
      q += vec2(sin(q.y * 1.7 + uTime * 0.6), cos(q.x * 1.5 - uTime * 0.5)) * 0.35;
      c += abs(sin(q.x + q.y)) * 0.33;
    }
    return pow(1.0 - c, 6.0);
  }

  void main() {
    vec2 p = vWorld;
    float r = length(p);
    float angle = atan(p.y, p.x);
    // The current: the water turns faster toward the eye and drifts slowly inward.
    float swirl = uVortex * uTime * 1.6 / (r * 0.35 + 0.6);
    float drift = uVortex * uTime * 0.25;
    float a = angle + swirl;
    vec2 flow = vec2(cos(a), sin(a)) * (r + drift * 0.0);
    vec2 sea = mix(p + vec2(uTime * 0.15, uTime * 0.05), flow, uVortex * smoothstep(14.0, 4.0, r));

    float ripples = fbm(sea * 0.35) * 0.6 + fbm(sea * 1.1) * 0.4;
    // Foam drawn out into a spiral that winds into the eye.
    float spiral = sin(angle * 3.0 + log(r + 0.5) * 7.0 - uTime * 2.4 * uVortex);
    // Thin streaks of foam that thicken and thin along their length. The variation is sampled on
    // the untwisted sea: on the twisted one the noise aliases into blocks near the eye.
    float streaks = smoothstep(0.74, 0.97, spiral) * smoothstep(9.0, 2.0, r) * uVortex;
    streaks *= 0.55 + 0.45 * fbm(p * 0.5 + vec2(uTime * 0.08, 0.0));
    float eyeRing = (1.0 - smoothstep(0.0, 0.32, abs(r - 1.25))) * uEye;
    float eye = (1.0 - smoothstep(0.85, 1.1, r)) * uEye;
    float deepening = smoothstep(9.0, 1.2, r) * uVortex;

    vec3 dayShallow = vec3(0.16, 0.64, 0.7);
    vec3 dayDeep = vec3(0.03, 0.32, 0.45);
    vec3 day = mix(dayShallow, dayDeep, deepening * 0.85 + ripples * 0.25);
    day += vec3(0.85, 0.95, 0.9) * caustic(sea) * 0.35 * (1.0 - deepening * 0.6);
    day = mix(day, vec3(0.93, 0.98, 0.98), clamp(streaks * 0.75 + eyeRing * 0.85, 0.0, 1.0));
    day = mix(day, vec3(0.0, 0.06, 0.1), eye);

    vec3 nightBase = mix(vec3(0.008, 0.04, 0.06), vec3(0.0, 0.012, 0.025), deepening + ripples * 0.3);
    // Bioluminescence: round motes, one at most per small cell, each pulsing on its own beat.
    vec2 cell = floor(sea * 5.0);
    vec2 inCell = fract(sea * 5.0) - 0.5;
    float mote = step(0.97, hash(cell)) * (1.0 - smoothstep(0.05, 0.16, length(inCell)));
    float sparkle = mote * (0.5 + 0.5 * sin(uTime * 4.0 + hash(cell) * 30.0));
    vec3 glow = vec3(0.1, 0.9, 0.85);
    vec3 night = nightBase + glow * (streaks * 0.45 + sparkle * (0.5 + streaks) + eyeRing * 0.5);
    night = mix(night, vec3(0.0), eye);

    gl_FragColor = vec4(mix(day, night, uNight), 1.0);
    #include <colorspace_fragment>
  }
`;

export function createWater(options: {
  readonly night: boolean;
  /** The current turns round the middle (the star's vortex, or the beacon's calm swirl). */
  readonly vortex: boolean;
  /** The deadly dark eye in its ring of foam; the beacon's swirl has none. */
  readonly eye: boolean;
}): Water {
  const geometry = new PlaneGeometry(70, 44, 1, 1).rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: options.night ? 1 : 0 },
      uVortex: { value: options.vortex ? 1 : 0 },
      uEye: { value: options.eye ? 1 : 0 },
    },
  });
  const mesh = new Mesh(geometry, material);
  return {
    mesh,
    update(clock) {
      const time = material.uniforms.uTime;
      if (time) time.value = clock;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
