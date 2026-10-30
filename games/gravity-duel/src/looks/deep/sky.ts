/**
 * Deep Space's backdrop, drawn under the field: by night black space with a
 * star field and a slow nebula in two colours; by day the inside of a bright
 * planetarium dome, a pale sky with the stars printed small and dark and the
 * constellation lines faint between them. Round the star the backdrop bends:
 * a lens that pulls the stars inward and a ripple that runs into the well, so
 * the pull everyone feels is something you can see.
 *
 * Everything is one shader on one plane, procedural, nothing loaded.
 */
import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';

export interface DeepSky {
  readonly mesh: Mesh;
  update(clock: number): void;
  dispose(): void;
}

/** The plane reaches well past the field so the backdrop fills any screen shape. */
const SKY_SIZE = new Vector2(64, 40);

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
  uniform float uWell;
  varying vec2 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
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
    for (int i = 0; i < 5; i++) {
      sum += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  // One star per cell at most, placed and sized by the cell's hash.
  float starLayer(vec2 p, float cell, float density, float sharp) {
    vec2 grid = p / cell;
    vec2 id = floor(grid);
    vec2 inside = fract(grid) - 0.5;
    float present = step(1.0 - density, hash(id));
    vec2 offset = vec2(hash(id + 7.1), hash(id + 3.3)) - 0.5;
    float size = mix(0.02, 0.09, hash(id + 1.7));
    float d = length(inside - offset * 0.7);
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + hash(id) * 3.0) + hash(id) * 40.0);
    return present * smoothstep(size, size * sharp, d) * twinkle;
  }

  void main() {
    vec2 p = vWorld;
    float r = length(p);
    // The lens: near the star the backdrop is sampled from further out, pulling it inward.
    vec2 dir = r > 0.0001 ? p / r : vec2(0.0);
    float lens = uWell * 2.4 / (r + 1.2);
    // A ripple that runs inward, slowly, a faint ring every few units.
    float ripple = sin(r * 2.2 + uTime * 1.6) * exp(-r * 0.22) * uWell;
    vec2 q = p + dir * (lens + ripple * 0.18);

    float stars = starLayer(q, 0.9, 0.16, 0.2) + starLayer(q + 13.0, 0.45, 0.09, 0.35) * 0.7;
    float cloud = fbm(q * 0.11 + vec2(uTime * 0.004, 0.0));
    float wisps = fbm(q * 0.27 - vec2(0.0, uTime * 0.006) + cloud * 2.0);
    float glowNearStar = exp(-r * 0.35);

    // Night: black space, a violet and teal nebula, white stars.
    vec3 night = vec3(0.004, 0.006, 0.016);
    night += vec3(0.11, 0.035, 0.16) * smoothstep(0.45, 0.85, cloud) * 0.9;
    night += vec3(0.02, 0.12, 0.14) * smoothstep(0.5, 0.9, wisps) * 0.7;
    night += vec3(0.5, 0.28, 0.08) * glowNearStar * 0.18;
    night += vec3(0.9, 0.93, 1.0) * stars * 1.6;
    night += vec3(0.25, 0.3, 0.6) * abs(ripple) * 0.08;

    // Day: a planetarium dome with the house lights up: a pale sky, the stars printed small and
    // navy, the lens a faint darker ring. Contrast comes from crisp shapes, not from the sky.
    vec3 day = mix(vec3(0.70, 0.78, 0.90), vec3(0.62, 0.71, 0.86), smoothstep(0.35, 0.85, cloud));
    day = mix(day, vec3(0.78, 0.84, 0.94), smoothstep(0.55, 0.9, wisps) * 0.4);
    day = mix(day, vec3(0.92, 0.84, 0.70), glowNearStar * 0.4);
    day = mix(day, vec3(0.06, 0.09, 0.2), stars * 0.85);
    day -= vec3(0.06, 0.05, 0.03) * abs(ripple);
    // The star chart printed on the dome: rings round the star every three units, which double
    // as the well's contour lines, and spokes every thirty degrees, all faint and navy.
    float ringLine = 1.0 - smoothstep(0.0, 0.035, abs(fract(r / 3.0 + 0.5) - 0.5) * 3.0);
    float angle = atan(p.y, p.x);
    float spokeLine = 1.0 - smoothstep(0.0, 0.02, abs(fract(angle / 0.5236 + 0.5) - 0.5) * 0.5236 * r);
    float chart = max(ringLine * 0.16 * smoothstep(1.4, 2.4, r), spokeLine * 0.07 * smoothstep(2.4, 4.0, r));
    day = mix(day, vec3(0.12, 0.17, 0.32), chart);

    gl_FragColor = vec4(mix(day, night, uNight), 1.0);
    #include <colorspace_fragment>
  }
`;

export function createDeepSky(options: {
  readonly night: boolean;
  readonly well: boolean;
}): DeepSky {
  const geometry = new PlaneGeometry(SKY_SIZE.x, SKY_SIZE.y).rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: options.night ? 1 : 0 },
      uWell: { value: options.well ? 1 : 0 },
    },
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.y = -0.05;
  mesh.renderOrder = -1;
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
