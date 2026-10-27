/**
 * Ground paint: a texture laid over the board that remembers what happened
 * on it. Explosions leave soot and, for a few seconds, glowing embers; tanks
 * press tread marks into the sand that fade slowly, and walkers leave boot
 * prints the same way; walls get a soft contact
 * shadow at their feet once, when the board is built. Marks are drawn as
 * small procedural stamps into a render target, so nothing is loaded and the
 * cost per frame is a handful of quads.
 *
 * Channels: R soot, G tread marks, B contact shadow (permanent), A ember heat.
 */
import {
  CustomBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MaxEquation,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SrcColorFactor,
  BufferAttribute,
  Vector4,
  WebGLRenderTarget,
  ZeroFactor,
  AddEquation,
  DynamicDrawUsage,
  type IUniform,
  type MeshStandardMaterial,
  type Texture,
  type WebGLRenderer,
} from 'three';

export type StampKind = 'scorch' | 'track' | 'contact' | 'scuff' | 'print';

export interface Stamp {
  readonly kind: StampKind;
  /** Centre on the table, world x and z. */
  readonly x: number;
  readonly z: number;
  /** Full size along the stamp's own axes, world units. */
  readonly width: number;
  readonly length: number;
  /** Rotation about the vertical axis, radians (0 = length along +x). */
  readonly angle?: number;
  readonly strength?: number;
  /** Contact shadows: how far the shadow reaches beyond the wall on each side, world units. */
  readonly margin?: number;
}

export interface GroundPaint {
  readonly texture: Texture;
  /** World area covered: minX, minZ, width, depth. */
  readonly area: Vector4;
  stamp(stamp: Stamp): void;
  /** Fades marks by elapsed time: embers in seconds, soot and tracks over minutes. */
  age(dt: number): void;
  /**
   * Clears every mark of play (soot, tracks, embers) at the next flush, keeping the permanent
   * contact shadows: a fresh board for the next round.
   */
  wipeMarks(): void;
  /** Draws pending stamps and fading into the texture; call once per frame before rendering. */
  flush(renderer: WebGLRenderer): void;
  /** Hooks the paint into a ground material: soot darkens, tracks compact the sand, embers glow. */
  applyTo(material: MeshStandardMaterial, options?: PaintResponse): void;
  dispose(): void;
}

const KIND_CODE: Record<StampKind, number> = {
  scorch: 0,
  track: 1,
  contact: 2,
  scuff: 3,
  print: 4,
};
const MAX_PENDING = 512;
/** Fraction kept per second for each channel: soot and tracks linger, embers die in seconds. */
const KEEP_PER_SECOND = [0.996, 0.985, 1, 0.55] as const;

const STAMP_VERTEX = /* glsl */ `
  attribute vec4 iPlace;  // x, z, angle, unused
  attribute vec4 iShape;  // width, length, kind, strength
  attribute float iMargin;
  uniform vec4 area;
  varying vec2 vLocal;
  varying vec2 vWorld;
  varying float vKind;
  varying float vStrength;
  varying vec2 vCore;
  varying float vAngle;
  void main() {
    vec2 local = position.xy; // -0.5..0.5
    float c = cos(iPlace.z);
    float s = sin(iPlace.z);
    vec2 scaled = vec2(local.x * iShape.y, local.y * iShape.x);
    vec2 world = iPlace.xy + vec2(scaled.x * c - scaled.y * s, scaled.x * s + scaled.y * c);
    vec2 uv = (world - area.xy) / area.zw;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
    vLocal = local * 2.0;
    vWorld = world;
    vKind = iShape.z;
    vStrength = iShape.w;
    // The wall's own footprint as a fraction of the stamp, per axis; the rest is falloff.
    vCore = vec2(1.0 - 2.0 * iMargin / iShape.y, 1.0 - 2.0 * iMargin / iShape.x);
    vAngle = iPlace.z;
  }
`;

const STAMP_FRAGMENT = /* glsl */ `
  varying vec2 vLocal;
  varying vec2 vWorld;
  varying float vKind;
  varying float vStrength;
  varying vec2 vCore;
  varying float vAngle;

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

  vec4 scorch() {
    float radius = length(vLocal);
    float ragged = valueNoise(vWorld * 1.6) * 0.35 + valueNoise(vWorld * 5.0) * 0.15;
    float soot = 1.0 - smoothstep(0.25, 1.0, radius + ragged - 0.2);
    float heat = (1.0 - smoothstep(0.0, 0.55, radius + ragged * 0.6)) * (0.6 + 0.4 * valueNoise(vWorld * 7.0));
    return vec4(soot * vStrength, 0.0, 0.0, heat * vStrength);
  }

  vec4 track() {
    // Two treads either side of the stamp's centre line, with cross grooves
    // phased by world position so stamps laid along a path line up.
    float across = abs(vLocal.y);
    float tread = smoothstep(0.42, 0.5, across) * (1.0 - smoothstep(0.88, 0.98, across));
    vec2 heading = vec2(cos(vAngle), sin(vAngle));
    float along = dot(vWorld, heading);
    float groove = 0.55 + 0.45 * smoothstep(0.35, 0.5, abs(fract(along * 3.2) - 0.5));
    float ends = 1.0 - smoothstep(0.7, 1.0, abs(vLocal.x));
    return vec4(0.0, tread * groove * ends * vStrength, 0.0, 0.0);
  }

  vec4 contact() {
    // A soft shadow that is darkest against the wall and fades out over the margin.
    vec2 outside = max(abs(vLocal) - vCore, 0.0) / max(vec2(1e-3), 1.0 - vCore);
    float shade = 1.0 - smoothstep(0.0, 1.0, length(outside));
    return vec4(0.0, 0.0, shade * shade * vStrength, 0.0);
  }

  vec4 scuff() {
    float radius = length(vLocal);
    float soot = (1.0 - smoothstep(0.1, 1.0, radius + valueNoise(vWorld * 6.0) * 0.3)) * 0.7;
    return vec4(soot * vStrength, 0.0, 0.0, soot * 0.6 * vStrength);
  }

  vec4 bootPrint() {
    // One boot sole along the stamp's length (toe towards +x): a broad toe pad and a smaller
    // heel, with the arch between pressing in less. It compacts the ground like a tread.
    float toe = 1.0 - smoothstep(0.7, 1.0, length(vec2((vLocal.x - 0.3) / 0.68, vLocal.y / 0.92)));
    float heel = 1.0 - smoothstep(0.7, 1.0, length(vec2((vLocal.x + 0.62) / 0.36, vLocal.y / 0.78)));
    float arch = (1.0 - smoothstep(0.5, 0.95, abs(vLocal.y))) * 0.45 * step(abs(vLocal.x + 0.2), 0.3);
    return vec4(0.0, max(max(toe, heel), arch) * vStrength, 0.0, 0.0);
  }

  void main() {
    vec4 paint = vKind < 0.5 ? scorch()
      : vKind < 1.5 ? track()
      : vKind < 2.5 ? contact()
      : vKind < 3.5 ? scuff()
      : bootPrint();
    gl_FragColor = paint;
  }
`;

interface FadeUniforms {
  [name: string]: IUniform;
  keep: IUniform<Vector4>;
}

/** How a ground answers its paint. */
export interface PaintResponse {
  /** How much a full-strength track or print darkens the ground: 0.26 suits sand. */
  readonly trackShade?: number;
}

export interface GroundPaintOptions {
  /** World area covered: the board, centred on the origin. */
  readonly width: number;
  readonly depth: number;
  /** Texels per world unit. */
  readonly resolution: number;
}

export function createGroundPaint(options: GroundPaintOptions): GroundPaint {
  const target = new WebGLRenderTarget(
    Math.round(options.width * options.resolution),
    Math.round(options.depth * options.resolution),
  );
  target.texture.name = 'ground-paint';
  const area = new Vector4(-options.width / 2, -options.depth / 2, options.width, options.depth);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const places = new InstancedBufferAttribute(new Float32Array(MAX_PENDING * 4), 4);
  const shapes = new InstancedBufferAttribute(new Float32Array(MAX_PENDING * 4), 4);
  const margins = new InstancedBufferAttribute(new Float32Array(MAX_PENDING), 1);
  for (const attribute of [places, shapes, margins]) attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('iPlace', places);
  geometry.setAttribute('iShape', shapes);
  geometry.setAttribute('iMargin', margins);
  geometry.instanceCount = 0;

  // Max blending: overlapping stamps keep the strongest mark instead of piling up to black.
  const stampMaterial = new ShaderMaterial({
    uniforms: { area: { value: area } },
    vertexShader: STAMP_VERTEX,
    fragmentShader: STAMP_FRAGMENT,
    blending: CustomBlending,
    blendEquation: MaxEquation,
    blendEquationAlpha: MaxEquation,
    depthTest: false,
    depthWrite: false,
  });
  const stamps = new Mesh(geometry, stampMaterial);
  stamps.frustumCulled = false;

  // Fading multiplies what is there: dst · keep.
  const fadeUniforms: FadeUniforms = { keep: { value: new Vector4(1, 1, 1, 1) } };
  const fadeMaterial = new ShaderMaterial({
    uniforms: fadeUniforms,
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec4 keep; void main() { gl_FragColor = keep; }`,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: ZeroFactor,
    blendDst: SrcColorFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: SrcColorFactor,
    depthTest: false,
    depthWrite: false,
  });
  fadeMaterial.blendEquationAlpha = AddEquation;
  const fadeQuad = new Mesh(new PlaneGeometry(1, 1), fadeMaterial);
  fadeQuad.frustumCulled = false;

  let pending = 0;
  let fadeSeconds = 0;
  let cleared = false;
  let wipe = false;
  const applied = new WeakSet<MeshStandardMaterial>();

  function drawWith(renderer: WebGLRenderer, mesh: Mesh): void {
    scene.clear();
    scene.add(mesh);
    renderer.render(scene, camera);
  }

  return {
    texture: target.texture,
    area,
    stamp(stamp) {
      if (pending >= MAX_PENDING) return;
      places.array.set([stamp.x, stamp.z, stamp.angle ?? 0, 0], pending * 4);
      shapes.array.set(
        [stamp.width, stamp.length, KIND_CODE[stamp.kind], stamp.strength ?? 1],
        pending * 4,
      );
      margins.array[pending] = stamp.margin ?? 0;
      pending++;
    },
    age(dt) {
      fadeSeconds += dt;
    },
    wipeMarks() {
      wipe = true;
      pending = 0;
    },
    flush(renderer) {
      const previousTarget = renderer.getRenderTarget();
      const previousAutoClear = renderer.autoClear;
      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      if (!cleared) {
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, false, false);
        cleared = true;
      }
      if (wipe) {
        fadeUniforms.keep.value.set(0, 0, 1, 0);
        drawWith(renderer, fadeQuad);
        wipe = false;
      }
      // Fading in quarter-second steps keeps 8-bit precision from stalling faint marks.
      if (fadeSeconds >= 0.25) {
        fadeUniforms.keep.value.set(
          ...(KEEP_PER_SECOND.map((keep) => Math.pow(keep, fadeSeconds)) as [
            number,
            number,
            number,
            number,
          ]),
        );
        drawWith(renderer, fadeQuad);
        fadeSeconds = 0;
      }
      if (pending > 0) {
        for (const attribute of [places, shapes, margins]) attribute.needsUpdate = true;
        geometry.instanceCount = pending;
        drawWith(renderer, stamps);
        pending = 0;
      }
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
    },
    applyTo(material, response = {}) {
      if (applied.has(material)) return;
      applied.add(material);
      const trackShade = (response.trackShade ?? 0.26).toFixed(3);
      const previous = material.onBeforeCompile.bind(material);
      // The shade is written into the shader, so grounds that differ must not share a program.
      const previousKey = material.customProgramCacheKey.bind(material);
      material.customProgramCacheKey = () => `${previousKey()}|paint:${trackShade}`;
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        shader.uniforms.groundPaint = { value: target.texture };
        shader.uniforms.paintArea = { value: area };
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec2 vPaintUv;\nuniform vec4 paintArea;',
          )
          .replace(
            '#include <worldpos_vertex>',
            [
              '#include <worldpos_vertex>',
              'vec4 paintLocal = vec4(transformed, 1.0);',
              '#ifdef USE_INSTANCING',
              'paintLocal = instanceMatrix * paintLocal;',
              '#endif',
              'vec2 paintWorld = (modelMatrix * paintLocal).xz;',
              'vPaintUv = (paintWorld - paintArea.xy) / paintArea.zw;',
            ].join('\n'),
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec2 vPaintUv;\nuniform sampler2D groundPaint;',
          )
          .replace(
            '#include <map_fragment>',
            [
              '#include <map_fragment>',
              'vec4 paint = texture2D(groundPaint, vPaintUv);',
              'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.16, 0.14, 0.13), paint.r);',
              `diffuseColor.rgb *= 1.0 - paint.g * ${trackShade};`,
              'diffuseColor.rgb *= 1.0 - paint.b * 0.55;',
            ].join('\n'),
          )
          .replace(
            '#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * 0.82, paint.g);',
          )
          .replace(
            '#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * paint.a * paint.a * 3.0;',
          );
      };
      material.needsUpdate = true;
    },
    dispose() {
      target.dispose();
      geometry.dispose();
      stampMaterial.dispose();
      fadeMaterial.dispose();
      fadeQuad.geometry.dispose();
    },
  };
}
