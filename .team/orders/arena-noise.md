---
id: arena-noise
kind: engine
model: gemini-3.8-flash-high
fence:
  - packages/arena/src/noise.ts
  - packages/arena/src/heightmap.ts
  - packages/arena/tests/noise.test.ts
  - packages/arena/tests/heightmap.test.ts
acceptance:
  - pnpm exec vitest run --project arena packages/arena/tests/noise.test.ts packages/arena/tests/heightmap.test.ts
  - pnpm exec eslint packages/arena/src/noise.ts packages/arena/src/heightmap.ts packages/arena/tests/noise.test.ts packages/arena/tests/heightmap.test.ts
  - pnpm exec prettier --check packages/arena/src/noise.ts packages/arena/src/heightmap.ts packages/arena/tests/noise.test.ts packages/arena/tests/heightmap.test.ts
  - pnpm exec tsc -p packages/arena/tsconfig.json
reads:
  - tsconfig.base.json
---

## Goal

The pure maths every procedural texture in `packages/arena` is painted with: seeded gradient noise
that can tile, fractal sums of it, cellular (Worley) noise for stones and cracks, and a small
heightmap toolkit that turns a height field into a tangent-space normal map and RGBA bytes. Zero raster
assets is a hard rule of the project: every ground, wall and cloud texture is generated from this at
load time. No DOM, no three.js, no `Math.random`: the same seed always paints the same texture.

## Context

- Textures are square tiles that repeat across a 64 × 40 tabletop, so tiling must be seamless: noise
  sampled over one tile (u, v in [0, 1)) must match across the tile's opposite edges.
- Sizes are powers of two from 64 to 1024 texels. A 512 × 512 heightmap plus its normal map should take
  well under 150 ms in Node; avoid per-texel allocations (no objects or arrays created inside the
  per-texel loops).
- Normal maps follow the OpenGL convention three.js expects (green is +v). Data row 0 is v = 0
  (three.js `DataTexture` with `flipY` false).

## Interface to implement

```ts
// packages/arena/src/noise.ts

/** Gradient noise in roughly [-1, 1], 0 at every lattice point. */
export interface Noise2D {
  /** With `period` (a positive integer), the lattice wraps every `period` units so the noise tiles. */
  sample(x: number, y: number, period?: number): number;
}

/** Perlin-style gradient noise with a quintic fade, from a 32-bit seed. */
export function createGradientNoise(seed: number): Noise2D;

export interface FractalOptions {
  /** Lattice cells across one tile for the first octave; an integer so the tile repeats. */
  readonly frequency: number;
  readonly octaves: number;
  /** Frequency multiplier per octave, an integer (default 2). */
  readonly lacunarity?: number;
  /** Amplitude multiplier per octave (default 0.5). */
  readonly gain?: number;
}

/** Fractal noise over one tile (u, v in [0, 1)), tiling, normalised to [-1, 1]. */
export function fbm(noise: Noise2D, u: number, v: number, options: FractalOptions): number;
/** Ridged fractal noise over one tile, tiling, in [0, 1]: sharp crests for cracks and ripples. */
export function ridged(noise: Noise2D, u: number, v: number, options: FractalOptions): number;

export interface CellularSample {
  /** Distance to the nearest feature point, in cell widths. */
  readonly f1: number;
  /** Distance to the second nearest, in cell widths. */
  readonly f2: number;
  /** A stable id in [0, 1) for the nearest point's cell, for colouring stones one by one. */
  readonly cell: number;
}

export interface CellularNoise {
  /** Samples one tile (u, v in [0, 1)); `cells` feature cells across, wrapping so it tiles. */
  sample(u: number, v: number): CellularSample;
}

/** Worley noise with one jittered feature point per cell. */
export function createCellularNoise(seed: number, cells: number): CellularNoise;

/** A deterministic hash of two integers and a seed to [0, 1). */
export function hash2(x: number, y: number, seed: number): number;
```

```ts
// packages/arena/src/heightmap.ts

/** A height field, row-major, row 0 at v = 0. Heights are free-form (usually 0–1). */
export interface Heightmap {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

/** Fills a heightmap by sampling `height(u, v)` at texel centres: u = (x + 0.5) / width. */
export function createHeightmap(
  width: number,
  height: number,
  heightAt: (u: number, v: number) => number,
): Heightmap;

/** The height at a texel, wrapping at the edges (tiles are seamless). */
export function heightAt(map: Heightmap, x: number, y: number): number;

/** A box blur of the given radius in texels (0 returns a copy), wrapping at the edges. */
export function blurHeightmap(map: Heightmap, radius: number): Heightmap;

/**
 * A tangent-space normal map, RGBA bytes (alpha 255), from central differences that wrap at the edges.
 * `strength` scales the slopes: the normal is normalize(-dh/dx · strength, -dh/dy · strength, 1),
 * where dh/dx is the change in height per texel along +x (u) and dh/dy along +y (rows, v).
 */
export function normalMapFromHeight(map: Heightmap, strength: number): Uint8Array;

/** A grey RGBA byte image from a heightmap mapped linearly from [low, high] to [0, 255], clamped. */
export function greyFromHeight(map: Heightmap, low: number, high: number): Uint8Array;

export type Rgb = readonly [number, number, number];

/** RGBA bytes from a colour per texel (components 0–255, rounded and clamped; alpha 255). */
export function paintRgba(
  width: number,
  height: number,
  colourAt: (x: number, y: number, u: number, v: number) => Rgb,
): Uint8Array;

/** Linear mix of two colours, t clamped to [0, 1]. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb;

/** '#a1b2c3' or 'a1b2c3' to [161, 178, 195]; throws on anything else. */
export function hexToRgb(hex: string): Rgb;

/** 0 below edge0, 1 above edge1, a smooth Hermite step between (GLSL smoothstep). */
export function smoothstep(edge0: number, edge1: number, x: number): number;
```

## Behaviour and edge cases

1. **Determinism.** Same seed and inputs, same output, across calls and instances. Different seeds
   give visibly different noise (the tests compare samples).
2. **Gradient noise.** Classic 2D gradient noise: hash each lattice corner (with `hash2`) to one of
   at least 8 unit gradient directions, dot with the offset, blend with the quintic fade
   6t⁵ − 15t⁴ + 10t³. Output scaled so typical values span about [-1, 1] and never exceed 1.0 in
   absolute value (clamp after scaling). Exactly 0 at integer lattice points.
3. **Tiling.** With `period` p, lattice coordinates are taken modulo p (also for negative x and y), so
   `sample(x, y, p) === sample(x + p, y, p) === sample(x, y + p, p)` (to 1e-12). Without a period
   there is no wrap. A period that is not a positive integer throws.
4. **Fractals.** Octave k samples at frequency `frequency · lacunarity^k` with that frequency as the
   period, at (u · f, v · f), so the sum tiles over u, v in [0, 1). `fbm` divides by the sum of the
   amplitudes so the result stays in [-1, 1]. `ridged` uses `1 − |noise|` per octave, squared, then
   normalised the same way to [0, 1]. Each octave also offsets its sample position by a fixed
   per-octave amount (any constant you choose, the same every run) so octaves do not line up at the
   origin. `frequency` and `lacunarity` must be positive integers; `octaves` at least 1; else throw.
5. **Cellular.** One feature point per cell, at a position jittered by `hash2` inside its cell.
   Sample the 3 × 3 neighbouring cells with wrap-around (cells index modulo `cells`), measuring
   distances in cell widths with the wrap taken into account, so the pattern tiles. `cell` is
   `hash2(cellX, cellY, seed + 1)` of the nearest point's (wrapped) cell. `f1 <= f2` always.
6. **hash2** mixes its inputs with integer arithmetic (`Math.imul` and shifts), works for negative
   integers and returns values in [0, 1).
7. **Heightmaps.** `heightAt` wraps x and y (also negative). `blurHeightmap` is separable (horizontal
   then vertical), wraps, and keeps the mean height (to 1e-5). `normalMapFromHeight`: a flat map gives
   (128, 128, 255, 255) everywhere (127.5 rounds up); a ramp rising along +x tilts the normal towards
   -x (red below 128); a ramp rising along +y (down the rows) gives green below 128. Encode with
   `Math.round((n · 0.5 + 0.5) · 255)`.
8. **Colours.** `paintRgba` passes texel coordinates and u, v at texel centres. `mixRgb` clamps t.
   `hexToRgb` accepts upper and lower case.
9. Throw a clear `Error` for non-positive or non-integer sizes.

## Tests required

`packages/arena/tests/noise.test.ts`: determinism and seed difference; zero at lattice points; range
over 10,000 samples within [-1, 1] and actually reaching beyond ±0.5; tiling in x and y with a period,
including negative coordinates; no wrap without a period; `fbm` and `ridged` tile across u = 0 / u = 1
and v = 0 / v = 1 (compare samples at u = 1e-9 and u = 1 - 1e-9 for closeness, and exact equality of
u and u + 1); their ranges; bad options throw; cellular: `f1 <= f2`, tiling across edges, stable `cell`
ids, values in range; `hash2` range and determinism for negative inputs.

`packages/arena/tests/heightmap.test.ts`: `createHeightmap` sampling at texel centres; `heightAt` wrap;
blur keeps the mean and smooths a single spike; the flat, +x ramp and +y ramp normal map cases; the
normal map of a tiling heightmap (built from `fbm`) has matching texels across its left and right edges
(compare the first and last columns' neighbours); `greyFromHeight` clamping; `paintRgba` layout (index of
x, y is (y · width + x) · 4); `mixRgb`, `hexToRgb` (good and bad input), `smoothstep`; a 512 × 512
heightmap plus normal map finishes in under 1.5 s (a loose bound so slow machines pass).

## Out of scope

three.js textures and materials (the lead writes those on top of these bytes), GPU code, colour
palettes, anything outside the four files in the fence.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`: index typed arrays with
`?? 0` where needed, never `!`). Intention-revealing names, small functions, comments only where they
explain why. No `any`, no commented-out code. Prettier: single quotes, width 100, trailing commas.
Import with `.ts` extensions.
