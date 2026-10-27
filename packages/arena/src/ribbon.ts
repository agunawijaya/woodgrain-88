/**
 * Ribbons: camera-facing strips that follow a moving point. A "glow"
 * ribbon is a tracer's hot streak or the lingering line of a bank shot; a
 * "smoke" ribbon is the soft, widening trail a guided shell leaves as it
 * curls. Each point remembers when it was laid, so the tail fades and thins
 * on its own while the head stays bright.
 */
import type { Color } from 'three';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type Camera,
  type IUniform,
} from 'three';

export interface RibbonStyle {
  readonly look: 'glow' | 'smoke';
  /** Width in world units at the head and at the tail. */
  readonly width: number;
  readonly widthEnd?: number;
  /** Linear RGB; glow colours above 1 bloom. */
  readonly colour: Color;
  readonly colourEnd?: Color;
  readonly alpha?: number;
  /** Seconds a point takes to fade out completely. */
  readonly fade: number;
  readonly maxPoints: number;
}

export interface Ribbon {
  readonly mesh: Mesh;
  /** Lays a new head point. Points closer than `minSpacing` to the last one only move the head. */
  push(point: Vector3): void;
  /**
   * Replaces the path at once (a traced bank shot). `ages` says how long ago each point was laid,
   * one number for all of them or one per point, so a path can fade from its tail.
   */
  setPath(points: readonly Vector3[], ages?: number | readonly number[]): void;
  /** Fades the whole ribbon, for paths that linger after their shell is gone. */
  opacity: number;
  update(dt: number, camera: Camera): void;
  clear(): void;
  dispose(): void;
}

interface RibbonUniforms {
  [name: string]: IUniform;
  headColour: IUniform<Color>;
  tailColour: IUniform<Color>;
  alpha: IUniform<number>;
}

const VERTEX = /* glsl */ `
  attribute float aFade;
  attribute float aSide;
  attribute float aAlong;
  varying float vFade;
  varying float vSide;
  varying float vAlong;
  void main() {
    vFade = aFade;
    vSide = aSide;
    vAlong = aAlong;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 headColour;
  uniform vec3 tailColour;
  uniform float alpha;
  varying float vFade;
  varying float vSide;
  varying float vAlong;
  void main() {
    float core = exp(-vSide * vSide * 3.5);
    float life = pow(1.0 - vFade, 1.6);
    vec3 colour = mix(headColour, tailColour, vFade);
    gl_FragColor = vec4(colour * core * life * alpha, 1.0);
  }
`;

const SMOKE_FRAGMENT = /* glsl */ `
  uniform vec3 headColour;
  uniform vec3 tailColour;
  uniform float alpha;
  varying float vFade;
  varying float vSide;
  varying float vAlong;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  void main() {
    float wisp = noise(vAlong * 1.7) * 0.5 + noise(vAlong * 4.3 + vSide * 2.0) * 0.5;
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide) + (wisp - 0.5) * 0.5);
    float life = (1.0 - vFade) * (1.0 - vFade);
    vec3 colour = mix(headColour, tailColour, vFade);
    gl_FragColor = vec4(colour, edge * life * alpha * (0.7 + 0.3 * wisp));
  }
`;

const MIN_SPACING = 0.12;

export function createRibbon(style: RibbonStyle): Ribbon {
  const capacity = Math.max(2, style.maxPoints);
  const points: Vector3[] = [];
  const ages: number[] = [];
  const geometry = new BufferGeometry();
  const positions = dynamicAttribute(capacity * 2, 3);
  const fades = dynamicAttribute(capacity * 2, 1);
  const sides = new BufferAttribute(new Float32Array(capacity * 2), 1);
  const along = dynamicAttribute(capacity * 2, 1);
  for (let index = 0; index < capacity; index++) {
    sides.array[index * 2] = -1;
    sides.array[index * 2 + 1] = 1;
  }
  geometry.setAttribute('position', positions);
  geometry.setAttribute('aFade', fades);
  geometry.setAttribute('aSide', sides);
  geometry.setAttribute('aAlong', along);
  geometry.setIndex(stripIndices(capacity));
  geometry.setDrawRange(0, 0);

  const uniforms: RibbonUniforms = {
    headColour: { value: style.colour.clone() },
    tailColour: { value: (style.colourEnd ?? style.colour).clone() },
    alpha: { value: style.alpha ?? 1 },
  };
  const material = new ShaderMaterial({
    name: style.look === 'glow' ? 'ArenaRibbonGlow' : 'ArenaRibbonSmoke',
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: style.look === 'glow' ? GLOW_FRAGMENT : SMOKE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: style.look === 'glow' ? AdditiveBlending : NormalBlending,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = style.look === 'glow' ? 12 : 9;

  const toCamera = new Vector3();
  const tangent = new Vector3();
  const across = new Vector3();
  let opacity = 1;

  function dropFaded(): void {
    while (ages.length > 0 && (ages[0] ?? 0) >= style.fade) {
      ages.shift();
      points.shift();
    }
  }

  function rebuild(camera: Camera): void {
    camera.getWorldDirection(toCamera).negate();
    const count = points.length;
    let distance = 0;
    for (let index = 0; index < count; index++) {
      const point = points[index];
      if (!point) continue;
      const previous = points[Math.max(0, index - 1)] ?? point;
      const next = points[Math.min(count - 1, index + 1)] ?? point;
      tangent.subVectors(next, previous);
      if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
      across.crossVectors(tangent, toCamera).normalize();
      const fade = Math.min(1, (ages[index] ?? 0) / style.fade);
      const halfWidth = (style.width + ((style.widthEnd ?? style.width) - style.width) * fade) / 2;
      if (index > 0) distance += point.distanceTo(previous);
      for (const side of [-1, 1]) {
        const vertex = index * 2 + (side > 0 ? 1 : 0);
        positions.array[vertex * 3] = point.x + across.x * halfWidth * side;
        positions.array[vertex * 3 + 1] = point.y + across.y * halfWidth * side;
        positions.array[vertex * 3 + 2] = point.z + across.z * halfWidth * side;
        fades.array[vertex] = fade;
        along.array[vertex] = distance;
      }
    }
    for (const attribute of [positions, fades, along]) attribute.needsUpdate = true;
    geometry.setDrawRange(0, Math.max(0, count - 1) * 6);
  }

  return {
    mesh,
    get opacity() {
      return opacity;
    },
    set opacity(value: number) {
      opacity = value;
      uniforms.alpha.value = (style.alpha ?? 1) * value;
    },
    push(point) {
      const head = points.at(-1);
      if (head && head.distanceToSquared(point) < MIN_SPACING * MIN_SPACING && points.length > 1) {
        head.copy(point);
        ages[ages.length - 1] = 0;
        return;
      }
      if (points.length >= capacity) {
        points.shift();
        ages.shift();
      }
      points.push(point.clone());
      ages.push(0);
    },
    setPath(path, laid = 0) {
      points.length = 0;
      ages.length = 0;
      const first = Math.max(0, path.length - capacity);
      for (let index = first; index < path.length; index++) {
        const point = path[index];
        if (!point) continue;
        points.push(point.clone());
        ages.push(typeof laid === 'number' ? laid : (laid[index] ?? 0));
      }
    },
    update(dt, camera) {
      for (let index = 0; index < ages.length; index++) ages[index] = (ages[index] ?? 0) + dt;
      dropFaded();
      rebuild(camera);
    },
    clear() {
      points.length = 0;
      ages.length = 0;
      geometry.setDrawRange(0, 0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}

function dynamicAttribute(
  count: number,
  itemSize: number,
): BufferAttribute & { array: Float32Array } {
  const attribute = new BufferAttribute(new Float32Array(count * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute as BufferAttribute & { array: Float32Array };
}

/** Two triangles between each pair of neighbouring point pairs. */
function stripIndices(capacity: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < capacity - 1; index++) {
    const a = index * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return indices;
}
