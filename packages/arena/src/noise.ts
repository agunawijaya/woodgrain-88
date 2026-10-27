/**
 * The noise every texture on the table is painted with. Gradient noise for
 * sand ripples and dirt, its fractal sums for detail at every scale, and
 * cellular noise for gravel, stones and cracks. All of it can tile, so a
 * small texture repeats across the board without a visible seam, and all of
 * it is seeded, so the same board looks the same on every machine.
 */

/** Gradient noise in roughly [-1, 1], 0 at every lattice point. */
export interface Noise2D {
  /**
   * With `period` (a positive integer), the lattice wraps every `period` units so the noise tiles.
   */
  sample(x: number, y: number, period?: number): number;
}

export interface FractalOptions {
  /** Lattice cells across one tile for the first octave; an integer so the tile repeats. */
  readonly frequency: number;
  readonly octaves: number;
  /** Frequency multiplier per octave, an integer (default 2). */
  readonly lacunarity?: number;
  /** Amplitude multiplier per octave (default 0.5). */
  readonly gain?: number;
}

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

// 8 unit-length gradient vectors evenly distributed around the unit circle.
// Computing dot products via closed-form switch avoids array allocations and indexing checks.
function dotUnitGradient(index: number, dx: number, dy: number): number {
  switch (index & 7) {
    case 0:
      return dx;
    case 1:
      return Math.SQRT1_2 * (dx + dy);
    case 2:
      return dy;
    case 3:
      return Math.SQRT1_2 * (-dx + dy);
    case 4:
      return -dx;
    case 5:
      return Math.SQRT1_2 * (-dx - dy);
    case 6:
      return -dy;
    case 7:
      return Math.SQRT1_2 * (dx - dy);
    default:
      return 0;
  }
}

// Quintic blend curve (6t^5 - 15t^4 + 10t^3) with zero first and second derivatives at 0 and 1.
function quinticFade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** A deterministic hash of two integers and a seed to [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = ((seed | 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0xcc9e2d51);
  h = (h << 13) | (h >>> 19);
  h = Math.imul(h ^ (y | 0), 0x1b873593);
  h = (h << 15) | (h >>> 17);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Perlin-style gradient noise with a quintic fade, from a 32-bit seed. */
export function createGradientNoise(seed: number): Noise2D {
  return {
    sample(x: number, y: number, period?: number): number {
      if (period !== undefined && (!Number.isInteger(period) || period <= 0)) {
        throw new Error(`Period must be a positive integer, got ${period}`);
      }

      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const dx = x - x0;
      const dy = y - y0;

      // Wrap lattice coordinates when period is supplied so opposite tile edges share gradients.
      let gx0 = x0;
      let gy0 = y0;
      let gx1 = x0 + 1;
      let gy1 = y0 + 1;

      if (period !== undefined) {
        gx0 = ((x0 % period) + period) % period;
        gy0 = ((y0 % period) + period) % period;
        gx1 = (gx0 + 1) % period;
        gy1 = (gy0 + 1) % period;
      }

      const g00 = Math.floor(hash2(gx0, gy0, seed) * 8) & 7;
      const g10 = Math.floor(hash2(gx1, gy0, seed) * 8) & 7;
      const g01 = Math.floor(hash2(gx0, gy1, seed) * 8) & 7;
      const g11 = Math.floor(hash2(gx1, gy1, seed) * 8) & 7;

      const d00 = dotUnitGradient(g00, dx, dy);
      const d10 = dotUnitGradient(g10, dx - 1, dy);
      const d01 = dotUnitGradient(g01, dx, dy - 1);
      const d11 = dotUnitGradient(g11, dx - 1, dy - 1);

      const u = quinticFade(dx);
      const v = quinticFade(dy);

      const nx0 = d00 + u * (d10 - d00);
      const nx1 = d01 + u * (d11 - d01);
      const val = nx0 + v * (nx1 - nx0);

      if (val === 0) {
        return 0;
      }

      // Maximum value of 2D unit-gradient Perlin noise is 1/sqrt(2);
      // scaling by sqrt(2) spans [-1, 1].
      const scaled = val * Math.SQRT2;
      return scaled < -1 ? -1 : scaled > 1 ? 1 : scaled;
    },
  };
}

// Incommensurate irrational step constants keep fractal octaves from aligning at the origin.
const OCTAVE_OFFSET_X = 31.4159265;
const OCTAVE_OFFSET_Y = 47.1828182;

function validateFractalOptions(options: FractalOptions): {
  frequency: number;
  octaves: number;
  lacunarity: number;
  gain: number;
} {
  const frequency = options.frequency;
  const octaves = options.octaves;
  const lacunarity = options.lacunarity ?? 2;
  const gain = options.gain ?? 0.5;

  if (!Number.isInteger(frequency) || frequency <= 0) {
    throw new Error(`frequency must be a positive integer, got ${frequency}`);
  }
  if (!Number.isInteger(octaves) || octaves < 1) {
    throw new Error(`octaves must be at least 1, got ${octaves}`);
  }
  if (!Number.isInteger(lacunarity) || lacunarity <= 0) {
    throw new Error(`lacunarity must be a positive integer, got ${lacunarity}`);
  }

  return { frequency, octaves, lacunarity, gain };
}

/** Fractal noise over one tile (u, v in [0, 1)), tiling, normalised to [-1, 1]. */
export function fbm(noise: Noise2D, u: number, v: number, options: FractalOptions): number {
  const { frequency, octaves, lacunarity, gain } = validateFractalOptions(options);

  let sum = 0;
  let totalAmplitude = 0;
  let currentFreq = frequency;
  let currentAmp = 1.0;

  for (let k = 0; k < octaves; k++) {
    const ox = (k + 1) * OCTAVE_OFFSET_X;
    const oy = (k + 1) * OCTAVE_OFFSET_Y;
    const val = noise.sample(u * currentFreq + ox, v * currentFreq + oy, currentFreq);

    sum += val * currentAmp;
    totalAmplitude += currentAmp;

    currentFreq *= lacunarity;
    currentAmp *= gain;
  }

  const result = sum / totalAmplitude;
  return result < -1 ? -1 : result > 1 ? 1 : result;
}

/** Ridged fractal noise over one tile, tiling, in [0, 1]: sharp crests for cracks and ripples. */
export function ridged(noise: Noise2D, u: number, v: number, options: FractalOptions): number {
  const { frequency, octaves, lacunarity, gain } = validateFractalOptions(options);

  let sum = 0;
  let totalAmplitude = 0;
  let currentFreq = frequency;
  let currentAmp = 1.0;

  for (let k = 0; k < octaves; k++) {
    const ox = (k + 1) * OCTAVE_OFFSET_X;
    const oy = (k + 1) * OCTAVE_OFFSET_Y;
    const val = noise.sample(u * currentFreq + ox, v * currentFreq + oy, currentFreq);
    const ridge = 1 - Math.abs(val);

    sum += ridge * ridge * currentAmp;
    totalAmplitude += currentAmp;

    currentFreq *= lacunarity;
    currentAmp *= gain;
  }

  const result = sum / totalAmplitude;
  return result < 0 ? 0 : result > 1 ? 1 : result;
}

/** Worley noise with one jittered feature point per cell. */
export function createCellularNoise(seed: number, cells: number): CellularNoise {
  if (!Number.isInteger(cells) || cells <= 0) {
    throw new Error(`cells must be a positive integer, got ${cells}`);
  }

  return {
    sample(u: number, v: number): CellularSample {
      // Wrap u and v into the unit tile [0, 1) to tile seamlessly across edges
      const su = ((u % 1) + 1) % 1;
      const sv = ((v % 1) + 1) % 1;

      const x = su * cells;
      const y = sv * cells;
      const cx = Math.floor(x);
      const cy = Math.floor(y);

      let f1 = Infinity;
      let f2 = Infinity;
      let bestWx = 0;
      let bestWy = 0;

      for (let dj = -1; dj <= 1; dj++) {
        const ny = cy + dj;
        const wy = ((ny % cells) + cells) % cells;

        for (let di = -1; di <= 1; di++) {
          const nx = cx + di;
          const wx = ((nx % cells) + cells) % cells;

          // Jitter the feature point position within the cell
          const px = nx + hash2(wx, wy, seed);
          const py = ny + hash2(wx, wy, seed + 2);

          const dx = px - x;
          const dy = py - y;
          const dist = Math.hypot(dx, dy);

          if (dist < f1) {
            f2 = f1;
            f1 = dist;
            bestWx = wx;
            bestWy = wy;
          } else if (dist < f2) {
            f2 = dist;
          }
        }
      }

      const cell = hash2(bestWx, bestWy, seed + 1);
      return { f1, f2, cell };
    },
  };
}
