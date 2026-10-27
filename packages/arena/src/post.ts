/**
 * The finishing chain that makes the table read as a photographed miniature:
 * bloom so tracers, muzzle flashes and fire glow, a gentle tilt-shift blur on
 * the table beyond the board (the shallow focus of a macro lens), a vignette
 * and a per-appearance grade. The board itself always stays sharp; blur
 * never touches what the players need to read.
 */
import type { Appearance } from '@woodgrain-88/kit';
import {
  HalfFloatType,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type IUniform,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export type Quality = 'high' | 'medium' | 'low';

export interface FocusBand {
  /** Screen height fraction (0 bottom, 1 top) of the middle of the sharp band. */
  readonly center: number;
  /** Half the sharp band's height, as a screen fraction. */
  readonly halfHeight: number;
}

export interface PostChain {
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  setAppearance(appearance: Appearance): void;
  setFocus(band: FocusBand): void;
  dispose(): void;
}

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface TiltUniforms {
  [name: string]: IUniform;
  tDiffuse: IUniform<null>;
  texel: IUniform<Vector2>;
  maxBlur: IUniform<number>;
  focusCenter: IUniform<number>;
  focusHalfHeight: IUniform<number>;
}

/** One direction of a separable Gaussian whose radius grows with distance from the focus band. */
function tiltShiftMaterial(horizontal: boolean): ShaderMaterial & { uniforms: TiltUniforms } {
  const uniforms: TiltUniforms = {
    tDiffuse: { value: null },
    texel: { value: new Vector2(1 / 1920, 1 / 1080) },
    maxBlur: { value: 3.2 },
    focusCenter: { value: 0.5 },
    focusHalfHeight: { value: 0.32 },
  };
  const direction = horizontal ? 'vec2(texel.x, 0.0)' : 'vec2(0.0, texel.y)';
  const material = new ShaderMaterial({
    name: horizontal ? 'TableTiltShiftH' : 'TableTiltShiftV',
    uniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 texel;
      uniform float maxBlur;
      uniform float focusCenter;
      uniform float focusHalfHeight;
      varying vec2 vUv;

      void main() {
        float away = abs(vUv.y - focusCenter) - focusHalfHeight;
        float amount = smoothstep(0.0, 0.2, away) * maxBlur;
        if (amount < 0.01) {
          gl_FragColor = texture2D(tDiffuse, vUv);
          return;
        }
        vec2 stepUv = ${direction} * amount;
        vec4 sum = texture2D(tDiffuse, vUv) * 0.2270;
        sum += texture2D(tDiffuse, vUv + stepUv * 1.3846) * 0.3162;
        sum += texture2D(tDiffuse, vUv - stepUv * 1.3846) * 0.3162;
        sum += texture2D(tDiffuse, vUv + stepUv * 3.2308) * 0.0703;
        sum += texture2D(tDiffuse, vUv - stepUv * 3.2308) * 0.0703;
        gl_FragColor = sum;
      }
    `,
  });
  return material as ShaderMaterial & { uniforms: TiltUniforms };
}

interface FinishUniforms {
  [name: string]: IUniform;
  tDiffuse: IUniform<null>;
  vignette: IUniform<number>;
  lift: IUniform<Vector3>;
  gain: IUniform<Vector3>;
  saturation: IUniform<number>;
  grain: IUniform<number>;
  seed: IUniform<number>;
}

function finishMaterial(): ShaderMaterial & { uniforms: FinishUniforms } {
  const uniforms: FinishUniforms = {
    tDiffuse: { value: null },
    vignette: { value: 0.3 },
    lift: { value: new Vector3() },
    gain: { value: new Vector3(1, 1, 1) },
    saturation: { value: 1 },
    grain: { value: 0.01 },
    seed: { value: 0 },
  };
  const material = new ShaderMaterial({
    name: 'TableFinish',
    uniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float vignette;
      uniform vec3 lift;
      uniform vec3 gain;
      uniform float saturation;
      uniform float grain;
      uniform float seed;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453);
      }

      void main() {
        vec4 colour = texture2D(tDiffuse, vUv);
        vec3 graded = colour.rgb * gain + lift;
        float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
        graded = mix(vec3(luma), graded, saturation);
        vec2 fromCentre = (vUv - 0.5) * vec2(1.0, 0.82);
        graded *= 1.0 - vignette * smoothstep(0.3, 0.85, length(fromCentre));
        graded += (hash(gl_FragCoord.xy) - 0.5) * grain * (0.3 + luma);
        gl_FragColor = vec4(max(graded, 0.0), colour.a);
      }
    `,
  });
  return material as ShaderMaterial & { uniforms: FinishUniforms };
}

export interface Grade {
  readonly lift: readonly [number, number, number];
  readonly gain: readonly [number, number, number];
  readonly saturation: number;
  readonly vignette: number;
  readonly bloom: number;
}

/** A game's own finish over the defaults. */
export interface FinishOptions {
  readonly grades?: Partial<Record<Appearance, Partial<Grade>>>;
  /** False for a scene with no miniature to sell (a flat screen seen head on). */
  readonly tiltShift?: boolean;
}

const GRADES: Record<Appearance, Grade> = {
  light: {
    lift: [0.003, 0.002, 0],
    gain: [1.02, 1, 0.97],
    saturation: 1.05,
    vignette: 0.24,
    bloom: 0.3,
  },
  dark: {
    lift: [0, 0.003, 0.012],
    gain: [1, 0.97, 1.05],
    saturation: 0.95,
    vignette: 0.55,
    bloom: 0.7,
  },
};

export function createPostChain(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  quality: Quality,
  appearance: Appearance,
  options: FinishOptions = {},
): PostChain {
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples: quality === 'high' ? 4 : 0,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const gradeFor = (next: Appearance): Grade => ({ ...GRADES[next], ...options.grades?.[next] });

  // A high threshold: only things brighter than lit paint (tracers, fire, lamps) glow.
  const bloom = new UnrealBloomPass(new Vector2(1, 1), gradeFor(appearance).bloom, 0.5, 0.95);
  composer.addPass(bloom);

  const tiltMaterials = [tiltShiftMaterial(true), tiltShiftMaterial(false)];
  if (quality !== 'low' && options.tiltShift !== false) {
    for (const material of tiltMaterials) composer.addPass(new ShaderPass(material));
  }

  const finish = finishMaterial();
  composer.addPass(new ShaderPass(finish));
  composer.addPass(new OutputPass());

  let frame = 0;

  function setAppearance(next: Appearance): void {
    const grade = gradeFor(next);
    bloom.strength = grade.bloom;
    finish.uniforms.lift.value.set(...grade.lift);
    finish.uniforms.gain.value.set(...grade.gain);
    finish.uniforms.saturation.value = grade.saturation;
    finish.uniforms.vignette.value = grade.vignette;
  }

  setAppearance(appearance);

  return {
    render() {
      frame = (frame + 1) % 997;
      finish.uniforms.seed.value = frame * 0.618;
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      for (const material of tiltMaterials) {
        material.uniforms.texel.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
        // Blur is measured in device pixels; keep the look the same on dense screens.
        material.uniforms.maxBlur.value = 3.2 * pixelRatio;
      }
    },
    setAppearance,
    setFocus(band) {
      for (const material of tiltMaterials) {
        material.uniforms.focusCenter.value = band.center;
        material.uniforms.focusHalfHeight.value = band.halfHeight;
      }
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      finish.dispose();
      for (const material of tiltMaterials) material.dispose();
      target.dispose();
    },
  };
}
