/**
 * Height fields and the bytes made from them. A texture starts as heights
 * (how high each texel of sand or concrete stands); the normal map that
 * makes it catch the light, and the colour and roughness images, are all
 * derived from those heights here. Edges wrap so tiles stay seamless.
 */

/** A height field, row-major, row 0 at v = 0. Heights are free-form (usually 0–1). */
export interface Heightmap {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

export type Rgb = readonly [number, number, number];

/** Fills a heightmap by sampling `heightAt(u, v)` at texel centres: u = (x + 0.5) / width. */
export function createHeightmap(
  width: number,
  height: number,
  sampleHeight: (u: number, v: number) => number,
): Heightmap {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`width must be a positive integer, got ${width}`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`height must be a positive integer, got ${height}`);
  }

  const data = new Float32Array(width * height);
  const invW = 1 / width;
  const invH = 1 / height;

  // Row 0 corresponds to v = 0 (OpenGL DataTexture layout with flipY false)
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) * invH;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) * invW;
      data[rowOffset + x] = sampleHeight(u, v);
    }
  }

  return { width, height, data };
}

/** The height at a texel, wrapping at the edges (tiles are seamless). */
export function heightAt(map: Heightmap, x: number, y: number): number {
  const w = map.width;
  const h = map.height;
  const wx = ((Math.floor(x) % w) + w) % w;
  const wy = ((Math.floor(y) % h) + h) % h;
  return map.data[wy * w + wx] ?? 0;
}

/** A box blur of the given radius in texels (0 returns a copy), wrapping at the edges. */
export function blurHeightmap(map: Heightmap, radius: number): Heightmap {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new Error(`radius must be a non-negative integer, got ${radius}`);
  }

  const w = map.width;
  const h = map.height;

  if (radius === 0) {
    return { width: w, height: h, data: new Float32Array(map.data) };
  }

  const src = map.data;
  const temp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const windowSize = 2 * radius + 1;
  const invWindow = 1 / windowSize;

  // Horizontal blur pass across each row with wrap-around
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const kx = ((k % w) + w) % w;
      sum += src[rowOffset + kx] ?? 0;
    }
    temp[rowOffset] = sum * invWindow;

    for (let x = 1; x < w; x++) {
      const addX = (((x + radius) % w) + w) % w;
      const subX = (((x - radius - 1) % w) + w) % w;
      sum += (src[rowOffset + addX] ?? 0) - (src[rowOffset + subX] ?? 0);
      temp[rowOffset + x] = sum * invWindow;
    }
  }

  // Vertical blur pass down each column with wrap-around
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const ky = ((k % h) + h) % h;
      sum += temp[ky * w + x] ?? 0;
    }
    out[x] = sum * invWindow;

    for (let y = 1; y < h; y++) {
      const addY = (((y + radius) % h) + h) % h;
      const subY = (((y - radius - 1) % h) + h) % h;
      sum += (temp[addY * w + x] ?? 0) - (temp[subY * w + x] ?? 0);
      out[y * w + x] = sum * invWindow;
    }
  }

  return { width: w, height: h, data: out };
}

/**
 * A tangent-space normal map, RGBA bytes (alpha 255), from central differences
 * that wrap at the edges. `strength` scales the slopes:
 * the normal is normalize(-dh/dx · strength, -dh/dy · strength, 1),
 * where dh/dx is the change in height per texel along +x (u) and dh/dy along +y (rows, v).
 */
export function normalMapFromHeight(map: Heightmap, strength: number): Uint8Array {
  const w = map.width;
  const h = map.height;
  const src = map.data;
  const out = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    // Toroidal wrapping along column coordinates
    const yPrev = y === 0 ? h - 1 : y - 1;
    const yNext = y === h - 1 ? 0 : y + 1;
    const rowOffset = y * w;
    const prevRowOffset = yPrev * w;
    const nextRowOffset = yNext * w;

    for (let x = 0; x < w; x++) {
      // Toroidal wrapping along row coordinates
      const xPrev = x === 0 ? w - 1 : x - 1;
      const xNext = x === w - 1 ? 0 : x + 1;

      // Central differences span 2 texels; dividing by 2 yields rate of change per texel
      const dhdx = ((src[rowOffset + xNext] ?? 0) - (src[rowOffset + xPrev] ?? 0)) * 0.5;
      const dhdy = ((src[nextRowOffset + x] ?? 0) - (src[prevRowOffset + x] ?? 0)) * 0.5;

      const nxUnnorm = -dhdx * strength;
      const nyUnnorm = -dhdy * strength;
      const nzUnnorm = 1.0;

      const invLen = 1 / Math.hypot(nxUnnorm, nyUnnorm, nzUnnorm);
      const nx = nxUnnorm * invLen;
      const ny = nyUnnorm * invLen;
      const nz = nzUnnorm * invLen;

      const idx = (rowOffset + x) * 4;
      // Encode unit normal coordinates [-1, 1] to byte range [0, 255]
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  return out;
}

/** A grey RGBA byte image from a heightmap mapped linearly from [low, high] to [0, 255], clamped. */
export function greyFromHeight(map: Heightmap, low: number, high: number): Uint8Array {
  const len = map.width * map.height;
  const out = new Uint8Array(len * 4);
  const range = high - low;
  const invRange = range === 0 ? 0 : 1 / range;

  for (let i = 0; i < len; i++) {
    const h = map.data[i] ?? 0;
    const t = range === 0 ? (h >= high ? 1 : 0) : (h - low) * invRange;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    const byte = Math.round(clamped * 255);

    const idx = i * 4;
    out[idx] = byte;
    out[idx + 1] = byte;
    out[idx + 2] = byte;
    out[idx + 3] = 255;
  }

  return out;
}

function clampByte(val: number): number {
  const rounded = Math.round(val);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}

/** RGBA bytes from a colour per texel (components 0–255, rounded and clamped; alpha 255). */
export function paintRgba(
  width: number,
  height: number,
  colourAt: (x: number, y: number, u: number, v: number) => Rgb,
): Uint8Array {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`width must be a positive integer, got ${width}`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`height must be a positive integer, got ${height}`);
  }

  const out = new Uint8Array(width * height * 4);
  const invW = 1 / width;
  const invH = 1 / height;

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) * invH;
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) * invW;
      const [r, g, b] = colourAt(x, y, u, v);

      const idx = (rowOffset + x) * 4;
      out[idx] = clampByte(r);
      out[idx + 1] = clampByte(g);
      out[idx + 2] = clampByte(b);
      out[idx + 3] = 255;
    }
  }

  return out;
}

/** Linear mix of two colours, t clamped to [0, 1]. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const clampedT = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    a[0] + (b[0] - a[0]) * clampedT,
    a[1] + (b[1] - a[1]) * clampedT,
    a[2] + (b[2] - a[2]) * clampedT,
  ] as const;
}

const HEX_REGEX = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** '#a1b2c3' or 'a1b2c3' to [161, 178, 195]; throws on anything else. */
export function hexToRgb(hex: string): Rgb {
  const match = HEX_REGEX.exec(hex);
  if (!match) {
    throw new Error(`Invalid hex colour: "${hex}". Expected '#rrggbb' or 'rrggbb'.`);
  }
  const r = parseInt(match[1] ?? '', 16);
  const g = parseInt(match[2] ?? '', 16);
  const b = parseInt(match[3] ?? '', 16);
  return [r, g, b] as const;
}

/** 0 below edge0, 1 above edge1, a smooth Hermite step between (GLSL smoothstep). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
