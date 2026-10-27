/**
 * A moving flag. In the moving variations the flag takes one step along a
 * fixed direction every time a check misses it (a bomb included). A bouncing
 * flag reflects off the field's edge, so from the last column it steps back
 * to the one before; a wrapping flag leaves one edge and comes back in at the
 * other, as the explorers do. The direction is one of the eight compass
 * points, chosen when the round starts, never standing still.
 */
import { COLUMNS, ROWS, spotOf, squareAt, type Square } from './grid.ts';
import type { FlagMotion } from './rules.ts';

export interface Heading {
  readonly east: -1 | 0 | 1;
  readonly south: -1 | 0 | 1;
}

/** The eight headings a moving flag can take, clockwise from north. */
export const HEADINGS: readonly Heading[] = [
  { east: 0, south: -1 },
  { east: 1, south: -1 },
  { east: 1, south: 0 },
  { east: 1, south: 1 },
  { east: 0, south: 1 },
  { east: -1, south: 1 },
  { east: -1, south: 0 },
  { east: -1, south: -1 },
];

export interface FlagStep {
  readonly square: Square;
  readonly heading: Heading;
}

/** One step of a moving flag; a still flag stays put. */
export function stepFlag(square: Square, heading: Heading, motion: FlagMotion): FlagStep {
  if (motion === 'still') return { square, heading };
  const { column, row } = spotOf(square);
  const across = moveAlong(column, heading.east, COLUMNS, motion);
  const down = moveAlong(row, heading.south, ROWS, motion);
  return {
    square: squareAt(across.position, down.position),
    heading: { east: across.direction, south: down.direction },
  };
}

function moveAlong(
  position: number,
  direction: -1 | 0 | 1,
  size: number,
  motion: 'bounce' | 'wrap',
): { position: number; direction: -1 | 0 | 1 } {
  const next = position + direction;
  if (next >= 0 && next < size) return { position: next, direction };
  if (motion === 'wrap') return { position: (next + size) % size, direction };
  // Past an edge: land one square back inside and travel the other way along this axis.
  const flipped = direction === 1 ? -1 : 1;
  return { position: position + flipped, direction: flipped };
}
