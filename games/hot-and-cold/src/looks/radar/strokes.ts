/**
 * Vector strokes for the Radar Room: polylines turned into flat ribbons of
 * triangles (WebGL draws lines one pixel wide), lying on the scope's face.
 * Every symbol on the scope is drawn from these: blips, bearings, range
 * squares, the lock reticle and the seven-segment numerals.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';

export type Point = readonly [number, number];

/**
 * A ribbon `width` wide along the points, in the x–z plane (y up). Corners are mitred so a closed
 * square ring has clean corners.
 */
export function strokeGeometry(
  points: readonly Point[],
  width: number,
  closed = false,
): BufferGeometry {
  const half = width / 2;
  const count = points.length;
  const left: Point[] = [];
  const right: Point[] = [];
  const at = (index: number): Point => points[(index + count) % count] ?? [0, 0];
  for (let index = 0; index < count; index++) {
    const here = at(index);
    const before = closed || index > 0 ? at(index - 1) : null;
    const after = closed || index < count - 1 ? at(index + 1) : null;
    const inDir = before ? unit(here[0] - before[0], here[1] - before[1]) : null;
    const outDir = after ? unit(after[0] - here[0], after[1] - here[1]) : null;
    const direction =
      inDir && outDir
        ? unit(inDir[0] + outDir[0], inDir[1] + outDir[1])
        : (inDir ?? outDir ?? [1, 0]);
    const normal: Point = [-direction[1], direction[0]];
    // Mitre: widen the corner so both edges keep the stroke's width.
    const reference = outDir ?? inDir ?? direction;
    const cosine = Math.max(0.25, Math.abs(normal[0] * -reference[1] + normal[1] * reference[0]));
    const reach = half / cosine;
    left.push([here[0] + normal[0] * reach, here[1] + normal[1] * reach]);
    right.push([here[0] - normal[0] * reach, here[1] - normal[1] * reach]);
  }
  const positions: number[] = [];
  const segments = closed ? count : count - 1;
  for (let index = 0; index < segments; index++) {
    const next = (index + 1) % count;
    const a = left[index] ?? [0, 0];
    const b = right[index] ?? [0, 0];
    const c = left[next] ?? [0, 0];
    const d = right[next] ?? [0, 0];
    // Wound so the ribbon faces up, towards the camera.
    positions.push(a[0], 0, a[1], c[0], 0, c[1], b[0], 0, b[1]);
    positions.push(b[0], 0, b[1], c[0], 0, c[1], d[0], 0, d[1]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Several strokes in one geometry. */
export function strokesGeometry(
  paths: readonly { readonly points: readonly Point[]; readonly closed?: boolean }[],
  width: number,
): BufferGeometry {
  const positions: number[] = [];
  for (const path of paths) {
    const part = strokeGeometry(path.points, width, path.closed ?? false);
    positions.push(...(part.getAttribute('position').array as Float32Array));
    part.dispose();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function unit(x: number, y: number): Point {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

/**
 * Seven-segment numerals, slanted a little like an instrument readout: which segments light for
 * each digit, and where each segment runs in a cell one unit wide and two tall (y down).
 */
const SEGMENTS: Readonly<Record<string, readonly [Point, Point]>> = {
  a: [
    [0.1, 0],
    [0.9, 0],
  ],
  b: [
    [1, 0.1],
    [1, 0.9],
  ],
  c: [
    [1, 1.1],
    [1, 1.9],
  ],
  d: [
    [0.1, 2],
    [0.9, 2],
  ],
  e: [
    [0, 1.1],
    [0, 1.9],
  ],
  f: [
    [0, 0.1],
    [0, 0.9],
  ],
  g: [
    [0.1, 1],
    [0.9, 1],
  ],
};

const LIT: Readonly<Record<number, readonly string[]>> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'd', 'c'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'f', 'g', 'c', 'd'],
};

/** A digit's lit segments as strokes, centred on the origin, `height` tall, on the x–z plane. */
export function sevenSegment(digit: number, height: number, width: number): BufferGeometry {
  const scale = height / 2;
  const slant = 0.12;
  const paths = (LIT[digit] ?? []).map((name) => {
    const [from, to] = SEGMENTS[name] ?? [
      [0, 0],
      [0, 0],
    ];
    const place = (point: Point): Point => [
      (point[0] - 0.5 + (1 - point[1]) * slant) * scale,
      (point[1] - 1) * scale,
    ];
    return { points: [place(from), place(to)] };
  });
  return strokesGeometry(paths, width);
}
