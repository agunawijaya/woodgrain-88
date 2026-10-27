/**
 * Tests for the procedural heightmap toolkit: creation at texel centres, edge
 * wrapping, separable box blur, normal map generation, RGBA painting, and colour utilities.
 */
import { describe, expect, it } from 'vitest';
import {
  blurHeightmap,
  createHeightmap,
  greyFromHeight,
  heightAt,
  hexToRgb,
  mixRgb,
  normalMapFromHeight,
  paintRgba,
  smoothstep,
} from '../src/heightmap.ts';
import { createGradientNoise, fbm } from '../src/noise.ts';

describe('createHeightmap and heightAt', () => {
  it('samples at texel centres u = (x + 0.5) / width and v = (y + 0.5) / height', () => {
    const width = 4;
    const height = 2;
    const sampledCoords: [number, number][] = [];

    const map = createHeightmap(width, height, (u, v) => {
      sampledCoords.push([u, v]);
      return u + v;
    });

    expect(map.width).toBe(4);
    expect(map.height).toBe(2);
    expect(map.data.length).toBe(8);

    // Texel (0, 0): u = 0.5 / 4 = 0.125, v = 0.5 / 2 = 0.25
    expect(sampledCoords[0]).toEqual([0.125, 0.25]);
    // Texel (3, 1): u = 3.5 / 4 = 0.875, v = 1.5 / 2 = 0.75
    expect(sampledCoords[7]).toEqual([0.875, 0.75]);
  });

  it('wraps texel coordinates seamlessly, including negative indices', () => {
    const map = createHeightmap(4, 4, (u, v) => u * 10 + v);

    const base00 = heightAt(map, 0, 0);
    const wrapX = heightAt(map, 4, 0);
    const wrapNegX = heightAt(map, -4, 0);
    const wrapY = heightAt(map, 0, 4);
    const wrapNegY = heightAt(map, 0, -4);

    expect(wrapX).toBe(base00);
    expect(wrapNegX).toBe(base00);
    expect(wrapY).toBe(base00);
    expect(wrapNegY).toBe(base00);

    // Coordinate -1 should equal coordinate width - 1
    expect(heightAt(map, -1, 2)).toBe(heightAt(map, 3, 2));
    expect(heightAt(map, 2, -1)).toBe(heightAt(map, 2, 3));
  });

  it('throws on non-positive or non-integer dimensions', () => {
    expect(() => createHeightmap(0, 4, () => 0)).toThrow();
    expect(() => createHeightmap(4, -1, () => 0)).toThrow();
    expect(() => createHeightmap(3.5, 4, () => 0)).toThrow();
  });
});

describe('blurHeightmap', () => {
  it('preserves the mean height to within 1e-5', () => {
    const noise = createGradientNoise(888);
    const map = createHeightmap(32, 32, (u, v) => fbm(noise, u, v, { frequency: 4, octaves: 3 }));

    let sumBefore = 0;
    for (const height of map.data) {
      sumBefore += height;
    }
    const meanBefore = sumBefore / map.data.length;

    const blurred = blurHeightmap(map, 3);

    let sumAfter = 0;
    for (const height of blurred.data) {
      sumAfter += height;
    }
    const meanAfter = sumAfter / blurred.data.length;

    expect(Math.abs(meanBefore - meanAfter)).toBeLessThan(1e-5);
  });

  it('smooths a single spike across a (2r + 1) squared box with uniform energy distribution', () => {
    // 16x16 map with zeros everywhere except a spike of 1.0 at (8, 8)
    const map = createHeightmap(16, 16, () => 0);
    map.data[8 * 16 + 8] = 1.0;

    const radius = 2;
    const blurred = blurHeightmap(map, radius);

    // Box size is 2 * 2 + 1 = 5. Peak value should be 1 / (5 * 5) = 0.04
    const expectedValue = 1 / 25;
    const peak = heightAt(blurred, 8, 8);
    expect(Math.abs(peak - expectedValue)).toBeLessThan(1e-6);

    // Check that all texels within the 5x5 window received the same blurred value
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const val = heightAt(blurred, 8 + dx, 8 + dy);
        expect(Math.abs(val - expectedValue)).toBeLessThan(1e-6);
      }
    }

    // A texel outside the window should remain zero
    expect(heightAt(blurred, 8 + radius + 1, 8)).toBe(0);
  });

  it('returns an independent copy when radius is 0', () => {
    const map = createHeightmap(4, 4, (u) => u);
    const copy = blurHeightmap(map, 0);

    expect(copy.data).not.toBe(map.data);
    expect(Array.from(copy.data)).toEqual(Array.from(map.data));
  });

  it('throws on negative or non-integer radius', () => {
    const map = createHeightmap(4, 4, () => 0);
    expect(() => blurHeightmap(map, -1)).toThrow();
    expect(() => blurHeightmap(map, 1.5)).toThrow();
  });
});

describe('normalMapFromHeight', () => {
  it('produces flat normals (128, 128, 255, 255) for a constant height field', () => {
    const map = createHeightmap(8, 8, () => 0.5);
    const normals = normalMapFromHeight(map, 1.0);

    expect(normals.length).toBe(8 * 8 * 4);
    for (let i = 0; i < normals.length; i += 4) {
      expect(normals[i]).toBe(128); // R: nx = 0 -> round(0.5 * 255) = 128
      expect(normals[i + 1]).toBe(128); // G: ny = 0 -> round(0.5 * 255) = 128
      expect(normals[i + 2]).toBe(255); // B: nz = 1 -> round(1.0 * 255) = 255
      expect(normals[i + 3]).toBe(255); // A: 255
    }
  });

  it('tilts red below 128 on a +x rising ramp', () => {
    // Ramp rising along +x: height proportional to x
    const map = createHeightmap(16, 16, (_u, _v) => _u);
    const normals = normalMapFromHeight(map, 2.0);

    // Internal texels (excluding wrap boundary) have positive dh/dx, so normal.x < 0 -> red < 128
    const r = normals[(4 * 16 + 4) * 4] ?? 0;
    const g = normals[(4 * 16 + 4) * 4 + 1] ?? 0;
    const b = normals[(4 * 16 + 4) * 4 + 2] ?? 0;

    expect(r).toBeLessThan(128);
    expect(g).toBe(128);
    expect(b).toBeGreaterThan(128);
  });

  it('tilts green below 128 on a +y rising ramp', () => {
    // Ramp rising along +y: height proportional to v
    const map = createHeightmap(16, 16, (_u, _v) => _v);
    const normals = normalMapFromHeight(map, 2.0);

    const r = normals[(4 * 16 + 4) * 4] ?? 0;
    const g = normals[(4 * 16 + 4) * 4 + 1] ?? 0;
    const b = normals[(4 * 16 + 4) * 4 + 2] ?? 0;

    expect(r).toBe(128);
    expect(g).toBeLessThan(128);
    expect(b).toBeGreaterThan(128);
  });

  it('tiles seamlessly across left and right edges for periodic noise', () => {
    const size = 32;
    const noise = createGradientNoise(54321);
    const map = createHeightmap(size, size, (u, v) =>
      fbm(noise, u, v, { frequency: 4, octaves: 3 }),
    );
    const normals = normalMapFromHeight(map, 1.5);

    // In a seamlessly tiling map, the central difference computed at column 0
    // uses column size - 1 as its left neighbor, and column size - 1 uses column 0
    // as its right neighbor. We verify this by building a double-width (64x32) tiled map
    // and comparing the normal at the seam (x = 32) against the normal at x = 0.
    const doubleMap = createHeightmap(size * 2, size, (u, v) => {
      // Repeat the tile twice horizontally
      const tileU = (u * 2) % 1;
      return fbm(noise, tileU, v, { frequency: 4, octaves: 3 });
    });
    const doubleNormals = normalMapFromHeight(doubleMap, 1.5);

    for (let y = 0; y < size; y++) {
      const idxSingleLeft = (y * size + 0) * 4;
      const idxDoubleSeam = (y * (size * 2) + size) * 4;

      // The normals across the seam in the doubled world match the single tiled map's column 0
      const diffR = Math.abs((normals[idxSingleLeft] ?? 0) - (doubleNormals[idxDoubleSeam] ?? 0));
      const diffG = Math.abs(
        (normals[idxSingleLeft + 1] ?? 0) - (doubleNormals[idxDoubleSeam + 1] ?? 0),
      );
      const diffB = Math.abs(
        (normals[idxSingleLeft + 2] ?? 0) - (doubleNormals[idxDoubleSeam + 2] ?? 0),
      );

      expect(diffR).toBeLessThanOrEqual(1);
      expect(diffG).toBeLessThanOrEqual(1);
      expect(diffB).toBeLessThanOrEqual(1);

      // The rightmost column of tile 1 in doubleMap also matches the single map's rightmost column
      const idxSingleRight = (y * size + (size - 1)) * 4;
      const idxDoubleRight = (y * (size * 2) + (size - 1)) * 4;
      expect(normals[idxSingleRight]).toBe(doubleNormals[idxDoubleRight]);
      expect(normals[idxSingleRight + 1]).toBe(doubleNormals[idxDoubleRight + 1]);
      expect(normals[idxSingleRight + 2]).toBe(doubleNormals[idxDoubleRight + 2]);
    }
  });
});

describe('greyFromHeight', () => {
  it('maps linearly from [low, high] to [0, 255] and clamps outliers', () => {
    const map = createHeightmap(4, 1, (u) => {
      // Texel 0: -0.5 (below low 0.0)
      // Texel 1: 0.0 (low)
      // Texel 2: 0.5 (mid)
      // Texel 3: 1.5 (above high 1.0)
      const values = [-0.5, 0.0, 0.5, 1.5];
      const x = Math.floor(u * 4);
      return values[x] ?? 0;
    });

    const grey = greyFromHeight(map, 0.0, 1.0);

    expect(grey[0]).toBe(0); // Clamped low
    expect(grey[1]).toBe(0);
    expect(grey[2]).toBe(0);
    expect(grey[3]).toBe(255);

    expect(grey[4]).toBe(0); // Exact low

    expect(grey[8]).toBe(128); // Midpoint: round(0.5 * 255) = 128
    expect(grey[9]).toBe(128);
    expect(grey[10]).toBe(128);
    expect(grey[11]).toBe(255);

    expect(grey[12]).toBe(255); // Clamped high
    expect(grey[13]).toBe(255);
    expect(grey[14]).toBe(255);
    expect(grey[15]).toBe(255);
  });
});

describe('paintRgba', () => {
  it('stores texels in row-major layout with alpha 255 and clamped components', () => {
    const width = 3;
    const height = 2;

    const bytes = paintRgba(width, height, (x, y, u, v) => {
      // Return custom colors verifying coordinates
      if (x === 1 && y === 1) {
        expect(u).toBeCloseTo(1.5 / 3);
        expect(v).toBeCloseTo(1.5 / 2);
        return [-10, 300, 127.4];
      }
      return [0, 0, 0];
    });

    const targetIdx = (1 * width + 1) * 4;
    expect(bytes[targetIdx]).toBe(0); // Clamped -10 -> 0
    expect(bytes[targetIdx + 1]).toBe(255); // Clamped 300 -> 255
    expect(bytes[targetIdx + 2]).toBe(127); // Rounded 127.4 -> 127
    expect(bytes[targetIdx + 3]).toBe(255); // Alpha
  });

  it('throws on non-positive or non-integer dimensions', () => {
    expect(() => paintRgba(0, 4, () => [0, 0, 0])).toThrow();
    expect(() => paintRgba(4, -2, () => [0, 0, 0])).toThrow();
    expect(() => paintRgba(1.5, 4, () => [0, 0, 0])).toThrow();
  });
});

describe('colour utilities: mixRgb, hexToRgb, smoothstep', () => {
  it('blends colours with mixRgb and clamps parameter t', () => {
    const black = [0, 0, 0] as const;
    const white = [200, 100, 50] as const;

    expect(mixRgb(black, white, 0)).toEqual([0, 0, 0]);
    expect(mixRgb(black, white, 1)).toEqual([200, 100, 50]);
    expect(mixRgb(black, white, 0.5)).toEqual([100, 50, 25]);
    // Clamping
    expect(mixRgb(black, white, -0.5)).toEqual([0, 0, 0]);
    expect(mixRgb(black, white, 1.5)).toEqual([200, 100, 50]);
  });

  it('parses valid 6-character hex strings case-insensitively with or without hash', () => {
    expect(hexToRgb('#a1b2c3')).toEqual([161, 178, 195]);
    expect(hexToRgb('a1b2c3')).toEqual([161, 178, 195]);
    expect(hexToRgb('#A1B2C3')).toEqual([161, 178, 195]);
    expect(hexToRgb('00ff80')).toEqual([0, 255, 128]);
  });

  it('throws on malformed hex strings', () => {
    expect(() => hexToRgb('#fff')).toThrow();
    expect(() => hexToRgb('fff')).toThrow();
    expect(() => hexToRgb('#12345')).toThrow();
    expect(() => hexToRgb('1234567')).toThrow();
    expect(() => hexToRgb('not-a-hex')).toThrow();
    expect(() => hexToRgb('')).toThrow();
  });

  it('computes smoothstep Hermite transitions', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBe(0.5);
    // Smooth derivative near boundaries
    expect(smoothstep(0, 1, 0.1)).toBeCloseTo(0.1 * 0.1 * (3 - 2 * 0.1));
  });
});

describe('performance', () => {
  it('generates a 512x512 heightmap and its normal map in under 1.5 s', () => {
    const startTime = performance.now();
    const noise = createGradientNoise(42);

    const map = createHeightmap(512, 512, (u, v) => fbm(noise, u, v, { frequency: 4, octaves: 4 }));
    const normals = normalMapFromHeight(map, 2.0);

    const elapsed = performance.now() - startTime;
    expect(map.data.length).toBe(512 * 512);
    expect(normals.length).toBe(512 * 512 * 4);
    expect(elapsed).toBeLessThan(1500);
  });
});
