/**
 * @woodgrain-88/arena: the shared three.js toolkit for tabletop dioramas.
 * A stage (renderer, fair tilted camera, day and night lighting, finishing),
 * procedural surfaces, ground paint for marks that stay, particles, ribbons,
 * explosions and other effects, camera shake, a frame budget and disposal.
 * Game-specific models stay in each game. It is loaded only with the games
 * that use it, never with the Hall.
 */
export { createTableCamera, frameTable, unitsPerPixel, type TableFraming } from './camera.ts';
export { createFrameBudget, type BudgetOptions, type FrameBudget } from './budget.ts';
export { disposeMaterial, disposeTree } from './dispose.ts';
export {
  createEffects,
  type EffectIntensity,
  type Effects,
  type EffectsOptions,
  type ExplosionOptions,
} from './effects.ts';
export {
  createGroundPaint,
  type GroundPaint,
  type GroundPaintOptions,
  type PaintResponse,
  type Stamp,
  type StampKind,
} from './ground-paint.ts';
export {
  blurHeightmap,
  createHeightmap,
  greyFromHeight,
  heightAt,
  hexToRgb,
  mixRgb,
  normalMapFromHeight,
  paintRgba,
  smoothstep,
  type Heightmap,
  type Rgb,
} from './heightmap.ts';
export {
  createLightRig,
  type DayMood,
  type LightMood,
  type NightMood,
  type LightPalette,
  type LightRig,
  type LightRigOptions,
} from './lighting.ts';
export {
  createCellularNoise,
  createGradientNoise,
  fbm,
  hash2,
  ridged,
  type CellularNoise,
  type CellularSample,
  type FractalOptions,
  type Noise2D,
} from './noise.ts';
export {
  createParticleField,
  type GlowSource,
  type ParticleField,
  type ParticleLook,
  type ParticleSpawn,
} from './particles.ts';
export {
  createPostChain,
  type FinishOptions,
  type FocusBand,
  type Grade,
  type PostChain,
  type Quality,
} from './post.ts';
export { createRibbon, type Ribbon, type RibbonStyle } from './ribbon.ts';
export { createCameraShake, type CameraShake, type ShakeOptions } from './shake.ts';
export { projectBoxUvs } from './uv.ts';
export { weatherMaterial, type WeatherOptions } from './weathering.ts';
export { createStage, type ShakeOffset, type Stage, type StageOptions } from './stage.ts';
export {
  bakeSurface,
  brickRecipe,
  burlapRecipe,
  concreteRecipe,
  disposeSurface,
  repeatSurface,
  sandRecipe,
  tableWoodRecipe,
  type SurfaceMaps,
  type SurfaceRecipe,
} from './textures.ts';
