/**
 * Procedural surfaces for the tabletop: every texture is computed from noise
 * when a game loads (the project ships no image files). A surface starts as a
 * tiling height field; its colour, roughness and normal maps are all derived
 * from those heights, so the shading always agrees with the shape: the grit
 * that catches the light is the grit that is darker in the colour map.
 *
 * Recipes here are shared by every diorama game: sand, concrete, burlap,
 * brick and the wooden table. Games add their own with `bakeSurface`.
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import {
  createHeightmap,
  hexToRgb,
  mixRgb,
  normalMapFromHeight,
  paintRgba,
  smoothstep,
  type Heightmap,
  type Rgb,
} from './heightmap.ts';
import {
  createCellularNoise,
  createGradientNoise,
  fbm,
  ridged,
  type CellularSample,
} from './noise.ts';

export interface SurfaceMaps {
  readonly map: DataTexture;
  readonly normalMap: DataTexture;
  readonly roughnessMap: DataTexture;
}

export interface SurfaceRecipe {
  /** Texels per side; a power of two. */
  readonly size: number;
  /** Height in roughly [0, 1] over one tile; must tile. */
  height(u: number, v: number): number;
  /** sRGB colour, 0–255 per channel, for a texel of the given height. */
  colour(height: number, u: number, v: number): Rgb;
  /** Roughness in [0, 1]. */
  roughness(height: number, u: number, v: number): number;
  readonly normalStrength: number;
}

export function bakeSurface(recipe: SurfaceRecipe): SurfaceMaps {
  const { size } = recipe;
  const heights = createHeightmap(size, size, (u, v) => recipe.height(u, v));
  const map = texture(
    paintRgba(size, size, (x, y, u, v) => recipe.colour(texel(heights, x, y), u, v)),
    size,
    true,
  );
  const normalMap = texture(normalMapFromHeight(heights, recipe.normalStrength), size, false);
  // three.js reads roughness from the green channel.
  const roughnessMap = texture(
    paintRgba(size, size, (x, y, u, v) => {
      const value = Math.round(recipe.roughness(texel(heights, x, y), u, v) * 255);
      return [value, value, value];
    }),
    size,
    false,
  );
  return { map, normalMap, roughnessMap };
}

/** Sets how many times a surface repeats across the mesh's UV range. */
export function repeatSurface(surface: SurfaceMaps, x: number, y: number): SurfaceMaps {
  for (const map of [surface.map, surface.normalMap, surface.roughnessMap]) map.repeat.set(x, y);
  return surface;
}

export function disposeSurface(surface: SurfaceMaps): void {
  surface.map.dispose();
  surface.normalMap.dispose();
  surface.roughnessMap.dispose();
}

function texel(map: Heightmap, x: number, y: number): number {
  return map.data[y * map.width + x] ?? 0;
}

function texture(bytes: Uint8Array, size: number, colour: boolean): DataTexture {
  const result = new DataTexture(bytes, size, size, RGBAFormat, UnsignedByteType);
  result.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
  result.wrapS = RepeatWrapping;
  result.wrapT = RepeatWrapping;
  result.magFilter = LinearFilter;
  result.minFilter = LinearMipmapLinearFilter;
  result.generateMipmaps = true;
  result.anisotropy = 8;
  result.needsUpdate = true;
  return result;
}

/** Packed sand with wind ripples, fine grit and a scatter of small pebbles. */
export function sandRecipe(seed: number, size = 512): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const warp = createGradientNoise(seed + 11);
  const pebbles = createCellularNoise(seed + 23, 14);
  const light = hexToRgb('#d9ba84');
  const dark = hexToRgb('#a8875a');
  const pebbleLight = hexToRgb('#a89a86');
  const pebbleDark = hexToRgb('#7d6f5e');
  const pebbleAt = (u: number, v: number): { bump: number; sample: CellularSample } => {
    const sample = pebbles.sample(u, v);
    const isPebble = sample.cell > 0.86 ? 1 : 0;
    return { bump: isPebble * smoothstep(0.26, 0.08, sample.f1), sample };
  };

  return {
    size,
    normalStrength: 3.4,
    height(u, v) {
      const bend = fbm(warp, u, v, { frequency: 3, octaves: 2 }) * 1.3;
      // Wind ripples, broken up so they read as sand rather than water.
      const ripple = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (u * 7 + v * 2 + bend));
      const breakUp = smoothstep(-0.2, 0.5, fbm(warp, u + 0.4, v, { frequency: 5, octaves: 2 }));
      const grit = fbm(noise, u, v, { frequency: 48, octaves: 3 }) * 0.5 + 0.5;
      const swell = fbm(noise, u, v, { frequency: 4, octaves: 4 }) * 0.5 + 0.5;
      return ripple * breakUp * 0.1 + grit * 0.2 + swell * 0.36 + pebbleAt(u, v).bump * 0.6;
    },
    colour(height, u, v) {
      const { bump, sample } = pebbleAt(u, v);
      const mottle = fbm(noise, u + 0.37, v + 0.11, { frequency: 6, octaves: 3 }) * 0.5 + 0.5;
      const sand = mixRgb(dark, light, smoothstep(0.2, 0.8, height * 0.7 + mottle * 0.55));
      const stone = mixRgb(pebbleDark, pebbleLight, sample.cell * 1.6 - 0.6);
      return mixRgb(sand, stone, smoothstep(0.05, 0.4, bump));
    },
    roughness(height, u, v) {
      return 0.93 - pebbleAt(u, v).bump * 0.2 - height * 0.04;
    },
  };
}

/** Cast concrete: fine pores, a few pits, and soft weather stains. */
export function concreteRecipe(seed: number, size = 256): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const pits = createCellularNoise(seed + 5, 18);
  const base = hexToRgb('#a29d93');
  const stained = hexToRgb('#77726a');
  const warm = hexToRgb('#ada392');
  return {
    size,
    normalStrength: 2.4,
    height(u, v) {
      const pores = fbm(noise, u, v, { frequency: 32, octaves: 3 }) * 0.5 + 0.5;
      const pit = pits.sample(u, v);
      const hole = pit.cell > 0.7 ? smoothstep(0.12, 0.04, pit.f1) : 0;
      return 0.6 + pores * 0.3 - hole * 0.5;
    },
    colour(height, u, v) {
      const stain = smoothstep(
        0.1,
        0.8,
        fbm(noise, u + 0.5, v, { frequency: 3, octaves: 4 }) * 0.5 + 0.5,
      );
      const tone = mixRgb(
        warm,
        base,
        fbm(noise, u, v + 0.3, { frequency: 5, octaves: 2 }) * 0.5 + 0.5,
      );
      return mixRgb(mixRgb(tone, stained, stain * 0.55), stained, smoothstep(0.55, 0.3, height));
    },
    roughness(height) {
      return 0.82 + (1 - height) * 0.12;
    },
  };
}

/** Woven burlap for sandbags: an over-under weave with frayed fibres. */
export function burlapRecipe(seed: number, size = 256): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const threads = 40;
  const light = hexToRgb('#c9b083');
  const dark = hexToRgb('#8f7650');
  return {
    size,
    normalStrength: 2,
    height(u, v) {
      const warp = Math.abs(Math.sin(Math.PI * u * threads));
      const weft = Math.abs(Math.sin(Math.PI * v * threads));
      const over = (Math.floor(u * threads) + Math.floor(v * threads)) % 2 === 0;
      const weave = over ? warp * 0.7 + weft * 0.3 : weft * 0.7 + warp * 0.3;
      const fibre = fbm(noise, u, v, { frequency: 64, octaves: 2 }) * 0.5 + 0.5;
      return weave * 0.75 + fibre * 0.25;
    },
    colour(height, u, v) {
      const dirt = fbm(noise, u + 0.2, v + 0.7, { frequency: 4, octaves: 3 }) * 0.5 + 0.5;
      return mixRgb(mixRgb(dark, light, height), dark, smoothstep(0.55, 0.9, dirt) * 0.5);
    },
    roughness() {
      return 0.97;
    },
  };
}

/** Old brick with sunken mortar, each brick its own shade, chipped at the edges. */
export function brickRecipe(seed: number, size = 256): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const rows = 8;
  const perRow = 4;
  const mortar = hexToRgb('#b3a58c');
  const brickShades = ['#9a4b33', '#7f3d2a', '#a85a3c', '#8c4630', '#6f3725'].map(hexToRgb);
  const brickAt = (u: number, v: number) => {
    const row = Math.floor(v * rows);
    const shifted = u * perRow + (row % 2 === 0 ? 0 : 0.5);
    const column = Math.floor(shifted);
    const inBrick = { x: shifted - column, y: v * rows - row };
    const id =
      (((row * 7 + ((column % perRow) + perRow) * 13) % brickShades.length) + brickShades.length) %
      brickShades.length;
    return { inBrick, id };
  };
  return {
    size,
    normalStrength: 3,
    height(u, v) {
      const { inBrick } = brickAt(u, v);
      const chip = fbm(noise, u, v, { frequency: 24, octaves: 2 }) * 0.06;
      const edge = Math.min(
        inBrick.x,
        1 - inBrick.x,
        ((inBrick.y * perRow) / rows) * 2,
        (((1 - inBrick.y) * perRow) / rows) * 2,
      );
      const face = smoothstep(0.02 + chip, 0.07 + chip, edge);
      const grain = ridged(noise, u, v, { frequency: 16, octaves: 3 }) * 0.15;
      return face * (0.85 + grain);
    },
    colour(height, u, v) {
      const { id } = brickAt(u, v);
      const shade = brickShades[id] ?? mortar;
      const soot = fbm(noise, u + 0.4, v + 0.9, { frequency: 3, octaves: 3 }) * 0.5 + 0.5;
      const brick = mixRgb(shade, [52, 34, 26], smoothstep(0.5, 0.85, soot) * 0.6);
      return mixRgb(mortar, brick, smoothstep(0.3, 0.6, height));
    },
    roughness(height) {
      return 0.9 - height * 0.08;
    },
  };
}

/** Walnut table planks running along u, with grain and dark seams between boards. */
export function tableWoodRecipe(seed: number, size = 512): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const planks = 4;
  const light = hexToRgb('#7a5236');
  const dark = hexToRgb('#4a2e1c');
  return {
    size,
    normalStrength: 1.2,
    height(u, v) {
      const inPlank = (v * planks) % 1;
      const seam = smoothstep(0, 0.012, inPlank) * smoothstep(1, 0.988, inPlank);
      const grain = Math.sin(
        Math.PI * 2 * (v * planks * 9 + fbm(noise, u, v, { frequency: 3, octaves: 3 }) * 1.6),
      );
      return seam * (0.8 + grain * 0.06);
    },
    colour(height, u, v) {
      const plank = Math.floor(v * planks);
      const tone = 0.45 + (0.4 * (((plank * 2654435761) >>> 0) % 1000)) / 1000;
      const figure = fbm(noise, u + plank * 0.31, v, { frequency: 6, octaves: 4 }) * 0.5 + 0.5;
      const grain = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * planks * 18 + figure * 2.2));
      const wood = mixRgb(dark, light, tone * 0.7 + grain * 0.3);
      return mixRgb([30, 18, 11], wood, smoothstep(0.2, 0.7, height));
    },
    roughness(height) {
      return 0.46 + (1 - height) * 0.3;
    },
  };
}
