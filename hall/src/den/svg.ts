/**
 * Small helpers for writing the Den's SVG as strings: escaping, attribute
 * lists, and the procedural textures (woodgrain, shag) that make flat shapes
 * read as wood and carpet. Textures are seeded so the room looks the same on
 * every visit and in every screenshot.
 */
import { createRng, type Rng } from '@woodgrain-88/kit';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type AttrValue = string | number | undefined | null | false;

export function attrs(values: Record<string, AttrValue>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${key}="${escapeXml(String(value))}"`)
    .join(' ');
}

export const n = (value: number) => Math.round(value * 100) / 100;

/**
 * Wavy grain lines across a board: each line drifts and wobbles a little,
 * a few curl round a knot. Returned as one path's data so a whole plank is a
 * single element.
 */
export function woodgrainPath(
  x: number,
  y: number,
  width: number,
  height: number,
  options: { lines: number; seed: string; vertical?: boolean },
): string {
  const rng = createRng(options.seed);
  const vertical = options.vertical ?? false;
  const along = vertical ? height : width;
  const across = vertical ? width : height;
  const parts: string[] = [];
  for (let i = 0; i < options.lines; i++) {
    const base = ((i + 0.5) / options.lines) * across + rng.float(-0.25, 0.25) * (across / options.lines);
    const segments = 4 + rng.int(0, 3);
    const step = along / segments;
    const amplitude = rng.float(0.6, 2.4);
    const points: [number, number][] = [];
    for (let s = 0; s <= segments; s++) {
      points.push([s * step, base + rng.float(-amplitude, amplitude)]);
    }
    const toXY = ([a, b]: [number, number]) => (vertical ? [x + b, y + a] : [x + a, y + b]);
    const [sx, sy] = toXY(points[0] ?? [0, base]);
    let d = `M${n(sx ?? 0)} ${n(sy ?? 0)}`;
    for (let s = 1; s < points.length; s++) {
      const prev = points[s - 1] ?? [0, 0];
      const point = points[s] ?? [0, 0];
      const control = toXY([(prev[0] + point[0]) / 2, prev[1] + rng.float(-amplitude, amplitude) * 1.4]);
      const end = toXY(point);
      d += `Q${n(control[0] ?? 0)} ${n(control[1] ?? 0)} ${n(end[0] ?? 0)} ${n(end[1] ?? 0)}`;
    }
    parts.push(d);
  }
  return parts.join('');
}

/** Short tufts scattered over an area: the shag carpet's pile. */
export function shagPath(x: number, y: number, width: number, height: number, count: number, seed: string): string {
  const rng: Rng = createRng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const tx = x + rng.float(0, width);
    const ty = y + rng.float(0, height);
    const length = rng.float(2.5, 5.5);
    const lean = rng.float(-1.6, 1.6);
    d += `M${n(tx)} ${n(ty)}l${n(lean)} ${n(-length)}`;
  }
  return d;
}

/** A rectangle with rounded corners as path data, for shapes that need to be one path. */
export function roundedRectPath(x: number, y: number, width: number, height: number, r: number): string {
  const radius = Math.min(r, width / 2, height / 2);
  return (
    `M${n(x + radius)} ${n(y)}h${n(width - 2 * radius)}a${n(radius)} ${n(radius)} 0 0 1 ${n(radius)} ${n(radius)}` +
    `v${n(height - 2 * radius)}a${n(radius)} ${n(radius)} 0 0 1 ${n(-radius)} ${n(radius)}` +
    `h${n(-(width - 2 * radius))}a${n(radius)} ${n(radius)} 0 0 1 ${n(-radius)} ${n(-radius)}` +
    `v${n(-(height - 2 * radius))}a${n(radius)} ${n(radius)} 0 0 1 ${n(radius)} ${n(-radius)}Z`
  );
}
