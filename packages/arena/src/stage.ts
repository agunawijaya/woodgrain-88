/**
 * The stage: one WebGL canvas filling its host, with the tabletop camera,
 * both lighting rigs, a procedural studio environment for reflections on
 * paint and metal, and the finishing chain. Games add their board and
 * models to `scene` and call `render` from the kit's loop.
 */
import type { Appearance } from '@woodgrain-88/kit';
import {
  ACESFilmicToneMapping,
  Color,
  PCFShadowMap,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type OrthographicCamera,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createTableCamera, frameTable, type TableFraming } from './camera.ts';
import { createLightRig, type LightRig } from './lighting.ts';
import { createPostChain, type PostChain, type Quality } from './post.ts';

export interface StageOptions {
  readonly host: HTMLElement;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly framing: TableFraming;
  /** Device pixel ratio cap; the default keeps 1080p laptops at full sharpness. */
  readonly maxPixelRatio?: number;
  /**
   * Keeps the drawing buffer readable after a frame: for screenshots and tests, and for a picture
   * another canvas copies later (the Den TV).
   */
  readonly preserveDrawingBuffer?: boolean;
  /** A fixed picture size in CSS pixels, for a canvas that is never laid out (the Den TV). */
  readonly size?: { readonly width: number; readonly height: number };
}

/** A small camera offset for shake, in world units and radians. */
export interface ShakeOffset {
  readonly x: number;
  readonly y: number;
  readonly roll: number;
}

export interface Stage {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  readonly lights: LightRig;
  readonly canvas: HTMLCanvasElement;
  readonly appearance: Appearance;
  setAppearance(appearance: Appearance): void;
  setFraming(framing: TableFraming): void;
  /** Fixes the picture size (CSS pixels) instead of following the host's layout. */
  setSize(width: number, height: number): void;
  setShake(offset: ShakeOffset): void;
  resize(): void;
  render(): void;
  dispose(): void;
}

const SHADOW_MAP_SIZE: Record<Quality, number> = { high: 4096, medium: 2048, low: 1024 };
const ENVIRONMENT_INTENSITY: Record<Appearance, number> = { light: 0.3, dark: 0.04 };

export function createStage(options: StageOptions): Stage {
  const renderer = new WebGLRenderer({
    antialias: options.quality === 'low',
    powerPreference: 'high-performance',
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  options.host.append(canvas);

  const scene = new Scene();
  scene.background = new Color('#000000');
  const camera = createTableCamera();
  const environment = studioEnvironment(renderer);
  scene.environment = environment;

  const halfWidth = options.framing.width / 2;
  const halfDepth = options.framing.depth / 2;
  const lights = createLightRig(options.appearance, {
    halfWidth,
    halfDepth,
    shadowMapSize: SHADOW_MAP_SIZE[options.quality],
  });
  scene.add(lights.group);

  const post: PostChain | null =
    options.quality === 'low'
      ? null
      : createPostChain(renderer, scene, camera, options.quality, options.appearance);

  let framing = options.framing;
  let appearance = options.appearance;
  let shake: ShakeOffset = { x: 0, y: 0, roll: 0 };
  const restingPosition = new Vector3();

  function applyAppearance(next: Appearance): void {
    appearance = next;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY[next];
    lights.setAppearance(next);
    post?.setAppearance(next);
  }

  let fixedSize = options.size ?? null;

  function resize(): void {
    const width = Math.max(1, fixedSize?.width ?? options.host.clientWidth);
    const height = Math.max(1, fixedSize?.height ?? options.host.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, options.maxPixelRatio ?? 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    frameTable(camera, framing, width / height);
    restingPosition.copy(camera.position);
    post?.setSize(width, height, pixelRatio);
    post?.setFocus(focusBandFor(camera, framing));
  }

  const observer = new ResizeObserver(resize);
  observer.observe(options.host);
  applyAppearance(options.appearance);
  resize();

  return {
    renderer,
    scene,
    camera,
    lights,
    canvas,
    get appearance() {
      return appearance;
    },
    setAppearance: applyAppearance,
    setFraming(next) {
      framing = next;
      resize();
    },
    setSize(width, height) {
      fixedSize = { width, height };
      resize();
    },
    setShake(offset) {
      shake = offset;
    },
    resize,
    render() {
      camera.position.copy(restingPosition);
      camera.translateX(shake.x);
      camera.translateY(shake.y);
      camera.rotation.z = shake.roll;
      camera.updateMatrixWorld();
      if (post) post.render();
      else renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      post?.dispose();
      lights.dispose();
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

/** A soft, neutral studio for reflections, generated rather than loaded: no image files. */
function studioEnvironment(renderer: WebGLRenderer): Texture {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = generator.fromScene(room, 0.04).texture;
  room.dispose();
  generator.dispose();
  return texture;
}

/** The screen band the board fills, so tilt-shift blurs only the table around it. */
function focusBandFor(
  camera: OrthographicCamera,
  framing: TableFraming,
): { center: number; halfHeight: number } {
  camera.updateMatrixWorld();
  const elevation = framing.elevation ?? 0;
  const far = new Vector3(0, elevation + framing.height * 0.5, -framing.depth / 2).project(camera);
  const near = new Vector3(0, elevation, framing.depth / 2).project(camera);
  const top = (far.y + 1) / 2;
  const bottom = (near.y + 1) / 2;
  return { center: (top + bottom) / 2, halfHeight: (top - bottom) / 2 + 0.05 };
}
