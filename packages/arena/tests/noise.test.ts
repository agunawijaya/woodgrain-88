/**
 * Tests for procedural noise generation: 2D gradient noise, fractal Brownian
 * motion, ridged fractals, cellular (Worley) noise, and integer coordinate hashing.
 */
import { describe, expect, it } from 'vitest';
import { createCellularNoise, createGradientNoise, fbm, hash2, ridged } from '../src/noise.ts';

describe('hash2', () => {
  it('returns values in [0, 1) deterministically across positive and negative inputs', () => {
    const v1 = hash2(42, -17, 12345);
    const v2 = hash2(42, -17, 12345);
    expect(v1).toBe(v2);

    const testCoords = [
      [0, 0],
      [-1, -1],
      [100, -200],
      [-32768, 32767],
      [-1000000, 1000000],
    ] as const;

    for (const [x, y] of testCoords) {
      const val = hash2(x, y, 999);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('scrambles different coordinates and seeds to distinct values', () => {
    const a = hash2(10, 20, 1);
    const b = hash2(11, 20, 1);
    const c = hash2(10, 21, 1);
    const d = hash2(10, 20, 2);

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });
});

describe('createGradientNoise', () => {
  it('is deterministic for the same seed and differs for different seeds', () => {
    const noiseA = createGradientNoise(100);
    const noiseB = createGradientNoise(100);
    const noiseC = createGradientNoise(200);

    const sampleA = noiseA.sample(1.35, 2.78);
    const sampleB = noiseB.sample(1.35, 2.78);
    const sampleC = noiseC.sample(1.35, 2.78);

    expect(sampleA).toBe(sampleB);
    expect(sampleA).not.toBe(sampleC);
  });

  it('evaluates to exactly zero at integer lattice points', () => {
    const noise = createGradientNoise(42);
    const latticePoints = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-5, 8],
      [100, -50],
      [-17, -23],
    ] as const;

    for (const [x, y] of latticePoints) {
      expect(noise.sample(x, y)).toBe(0);
    }
  });

  it('stays within [-1, 1] over 10 000 samples and spans beyond +/-0.5', () => {
    const noise = createGradientNoise(777);
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < 10000; i++) {
      // Deterministic pseudo-random coordinates spread over several lattice cells
      const x = ((i * 0.173) % 50) - 25;
      const y = ((i * 0.281) % 50) - 25;
      const val = noise.sample(x, y);

      expect(val).toBeGreaterThanOrEqual(-1);
      expect(val).toBeLessThanOrEqual(1);

      if (val < min) min = val;
      if (val > max) max = val;
    }

    expect(min).toBeLessThan(-0.5);
    expect(max).toBeGreaterThan(0.5);
  });

  it('tiles seamlessly across periods in x and y, including negative coordinates', () => {
    const noise = createGradientNoise(55);
    const period = 8;
    const testPoints = [
      [0.25, 0.75],
      [3.14, 2.71],
      [-1.5, 4.2],
      [-9.8, -3.4],
    ] as const;

    for (const [x, y] of testPoints) {
      const base = noise.sample(x, y, period);
      const wrapX = noise.sample(x + period, y, period);
      const wrapY = noise.sample(x, y + period, period);
      const wrapBoth = noise.sample(x + period * 3, y - period * 2, period);

      expect(Math.abs(base - wrapX)).toBeLessThan(1e-12);
      expect(Math.abs(base - wrapY)).toBeLessThan(1e-12);
      expect(Math.abs(base - wrapBoth)).toBeLessThan(1e-12);
    }
  });

  it('does not wrap coordinates when period is omitted', () => {
    const noise = createGradientNoise(88);
    const val1 = noise.sample(1.23, 4.56);
    const val2 = noise.sample(1.23 + 8, 4.56);
    expect(val1).not.toBe(val2);
  });

  it('throws on non-positive or non-integer period', () => {
    const noise = createGradientNoise(10);
    expect(() => noise.sample(1, 1, 0)).toThrow();
    expect(() => noise.sample(1, 1, -4)).toThrow();
    expect(() => noise.sample(1, 1, 2.5)).toThrow();
  });
});

describe('fbm and ridged fractals', () => {
  it('tiles across opposite edges and matches across integer shifts', () => {
    const noise = createGradientNoise(1234);
    const opts = { frequency: 4, octaves: 4, lacunarity: 2, gain: 0.5 };

    for (let v = 0.1; v < 0.9; v += 0.2) {
      // Direct tile shift of 1 tile matches exactly because every octave period divides into the tile
      const left = fbm(noise, 0.35, v, opts);
      const right = fbm(noise, 1.35, v, opts);
      expect(Math.abs(left - right)).toBeLessThan(1e-12);

      // Boundary continuity: u near 0 matches u near 1
      const atZero = fbm(noise, 1e-9, v, opts);
      const atOne = fbm(noise, 1 - 1e-9, v, opts);
      expect(Math.abs(atZero - atOne)).toBeLessThan(1e-4);
    }

    for (let u = 0.1; u < 0.9; u += 0.2) {
      const bottom = ridged(noise, u, 0.42, opts);
      const top = ridged(noise, u, 1.42, opts);
      expect(Math.abs(bottom - top)).toBeLessThan(1e-12);

      const atZeroV = ridged(noise, u, 1e-9, opts);
      const atOneV = ridged(noise, u, 1 - 1e-9, opts);
      expect(Math.abs(atZeroV - atOneV)).toBeLessThan(1e-4);
    }
  });

  it('normalises fbm output to [-1, 1] and ridged to [0, 1]', () => {
    const noise = createGradientNoise(321);
    const opts = { frequency: 3, octaves: 5, lacunarity: 2, gain: 0.5 };

    let minFbm = Infinity;
    let maxFbm = -Infinity;
    let minRidged = Infinity;
    let maxRidged = -Infinity;

    for (let i = 0; i < 2000; i++) {
      const u = (i * 0.0013) % 1;
      const v = (i * 0.0029) % 1;

      const fVal = fbm(noise, u, v, opts);
      expect(fVal).toBeGreaterThanOrEqual(-1);
      expect(fVal).toBeLessThanOrEqual(1);
      if (fVal < minFbm) minFbm = fVal;
      if (fVal > maxFbm) maxFbm = fVal;

      const rVal = ridged(noise, u, v, opts);
      expect(rVal).toBeGreaterThanOrEqual(0);
      expect(rVal).toBeLessThanOrEqual(1);
      if (rVal < minRidged) minRidged = rVal;
      if (rVal > maxRidged) maxRidged = rVal;
    }

    expect(minFbm).toBeLessThan(-0.2);
    expect(maxFbm).toBeGreaterThan(0.2);
    expect(minRidged).toBeLessThan(0.3);
    expect(maxRidged).toBeGreaterThan(0.6);
  });

  it('throws on invalid options such as non-positive frequency or zero octaves', () => {
    const noise = createGradientNoise(1);
    expect(() => fbm(noise, 0.5, 0.5, { frequency: 0, octaves: 3 })).toThrow();
    expect(() => fbm(noise, 0.5, 0.5, { frequency: 2.5, octaves: 3 })).toThrow();
    expect(() => fbm(noise, 0.5, 0.5, { frequency: 4, octaves: 0 })).toThrow();
    expect(() => fbm(noise, 0.5, 0.5, { frequency: 4, octaves: 3, lacunarity: 1.5 })).toThrow();
    expect(() => fbm(noise, 0.5, 0.5, { frequency: 4, octaves: 3, lacunarity: 0 })).toThrow();
  });
});

describe('createCellularNoise', () => {
  it('guarantees f1 <= f2 and outputs values in valid ranges', () => {
    const cellular = createCellularNoise(4321, 6);

    for (let i = 0; i < 1000; i++) {
      const u = (i * 0.0017) % 1;
      const v = (i * 0.0031) % 1;
      const sample = cellular.sample(u, v);

      expect(sample.f1).toBeGreaterThanOrEqual(0);
      expect(sample.f2).toBeGreaterThanOrEqual(sample.f1);
      expect(sample.cell).toBeGreaterThanOrEqual(0);
      expect(sample.cell).toBeLessThan(1);
    }
  });

  it('tiles across tile boundaries and maintains stable cell ids near feature points', () => {
    const cellular = createCellularNoise(999, 4);

    for (let v = 0.1; v < 0.9; v += 0.2) {
      const atZero = cellular.sample(1e-9, v);
      const atOne = cellular.sample(1 - 1e-9, v);

      expect(Math.abs(atZero.f1 - atOne.f1)).toBeLessThan(1e-4);
      expect(Math.abs(atZero.f2 - atOne.f2)).toBeLessThan(1e-4);
      expect(atZero.cell).toBe(atOne.cell);
    }

    // Proximity to the same feature point gives constant cell identifier
    const centerSample = cellular.sample(0.5, 0.5);
    const nearbySample = cellular.sample(0.501, 0.501);
    expect(nearbySample.cell).toBe(centerSample.cell);
  });

  it('throws on non-positive or non-integer cell counts', () => {
    expect(() => createCellularNoise(1, 0)).toThrow();
    expect(() => createCellularNoise(1, -2)).toThrow();
    expect(() => createCellularNoise(1, 3.5)).toThrow();
  });
});
