/**
 * Drawing like a child with crayons and a pencil, on canvases: a crayon line
 * is laid down as several thin, slightly wandering passes with gaps where the
 * wax skipped on the paper's tooth; a filled shape is hatched back and forth
 * inside its outline. Every mark is seeded, so a drawing comes out the same
 * each time, and a second seed gives the same drawing redrawn, which is how
 * Paper Sky's lines boil like a hand-drawn cartoon.
 */
import type { Rng } from '@woodgrain-88/kit';
import { CanvasTexture, SRGBColorSpace } from 'three';

export type Point = readonly [number, number];

export interface Pad {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  /** Canvas pixels per drawing unit. */
  readonly scale: number;
}

/** A transparent canvas `width` by `height` drawing units, with (0, 0) in its middle. */
export function createPad(width: number, height: number, scale: number): Pad {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas to draw on');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  return { canvas, context, scale };
}

export function padTexture(pad: Pad): CanvasTexture {
  const texture = new CanvasTexture(pad.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A crayon line through the points: a few wandering passes, the wax skipping now and then. */
export function crayonLine(
  pad: Pad,
  points: readonly Point[],
  colour: string,
  width: number,
  rng: Rng,
  options: { readonly closed?: boolean; readonly passes?: number; readonly wobble?: number } = {},
): void {
  const { context } = pad;
  const passes = options.passes ?? 3;
  const wobble = options.wobble ?? width * 0.35;
  const path = options.closed ? [...points, points[0] ?? [0, 0]] : points;
  context.strokeStyle = colour;
  for (let pass = 0; pass < passes; pass++) {
    context.globalAlpha = rng.float(0.55, 0.85);
    context.lineWidth = width * rng.float(0.55, 0.85);
    context.beginPath();
    path.forEach(([x, y], index) => {
      const jx = x + rng.float(-wobble, wobble);
      const jy = y + rng.float(-wobble, wobble);
      if (index === 0) context.moveTo(jx, jy);
      else context.lineTo(jx, jy);
    });
    context.stroke();
  }
  // The paper's tooth: little gaps where the wax did not take.
  context.globalCompositeOperation = 'destination-out';
  context.globalAlpha = 0.35;
  for (let gap = 0; gap < path.length * 3; gap++) {
    const [x, y] = path[Math.floor(rng.float(0, path.length))] ?? [0, 0];
    context.beginPath();
    context.arc(
      x + rng.float(-width, width),
      y + rng.float(-width, width),
      width * rng.float(0.1, 0.25),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
}

/** Fills a closed outline by hatching it back and forth, as a child colours in. */
export function crayonFill(
  pad: Pad,
  outline: readonly Point[],
  colour: string,
  rng: Rng,
  spacing = 0.06,
): void {
  const { context } = pad;
  context.save();
  context.beginPath();
  outline.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.closePath();
  context.clip();
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const left = Math.min(...xs) - 0.2;
  const right = Math.max(...xs) + 0.2;
  const top = Math.min(...ys) - 0.2;
  const bottom = Math.max(...ys) + 0.2;
  const slant = rng.float(0.4, 0.8);
  context.strokeStyle = colour;
  for (let y = top - (right - left) * slant; y < bottom; y += spacing) {
    context.globalAlpha = rng.float(0.5, 0.85);
    context.lineWidth = spacing * rng.float(1.2, 1.9);
    context.beginPath();
    context.moveTo(left, y + rng.float(-0.02, 0.02));
    context.lineTo(right, y + (right - left) * slant + rng.float(-0.03, 0.03));
    context.stroke();
  }
  context.restore();
  context.globalAlpha = 1;
}

/** Points round a circle, for suns, portholes and wheels. */
export function circle(cx: number, cy: number, radius: number, steps = 28): Point[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
  });
}
