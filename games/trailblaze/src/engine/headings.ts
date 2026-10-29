/**
 * Compass headings, unit step vectors, and joystick-to-heading decoding for
 * 4-way cardinal and 8-way diagonal steering.
 *
 * Under 4-way steering, pushing a diagonal resolves to horizontal (east or
 * west) before vertical, matching the 1977 program's bit-shift scan order
 * (right, left, down, up) where the vertical pass runs only when 8-way
 * steering is enabled.
 */
import type { Heading, Stick } from './types.ts';

export const HEADINGS: readonly Heading[] = [
  'up',
  'down',
  'left',
  'right',
  'up-left',
  'up-right',
  'down-left',
  'down-right',
];

interface StepVector {
  readonly east: -1 | 0 | 1;
  readonly south: -1 | 0 | 1;
}

const VECTORS: Readonly<Record<Heading, StepVector>> = {
  up: { east: 0, south: -1 },
  down: { east: 0, south: 1 },
  left: { east: -1, south: 0 },
  right: { east: 1, south: 0 },
  'up-left': { east: -1, south: -1 },
  'up-right': { east: 1, south: -1 },
  'down-left': { east: -1, south: 1 },
  'down-right': { east: 1, south: 1 },
};

const OPPOSITES: Readonly<Record<Heading, Heading>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
  'up-left': 'down-right',
  'up-right': 'down-left',
  'down-left': 'up-right',
  'down-right': 'up-left',
};

export function vectorOf(heading: Heading): { east: -1 | 0 | 1; south: -1 | 0 | 1 } {
  const vec = VECTORS[heading];
  return { east: vec.east, south: vec.south };
}

export function opposite(heading: Heading): Heading {
  return OPPOSITES[heading];
}

export function isDiagonal(heading: Heading): boolean {
  const vec = VECTORS[heading];
  return vec.east !== 0 && vec.south !== 0;
}

/** The heading a stick asks for under 4- or 8-way steering, or null when centred. */
export function headingFromStick(stick: Stick, steering: 4 | 8): Heading | null {
  const { east, south } = stick;
  if (east === 0 && south === 0) return null;

  if (steering === 8 && east !== 0 && south !== 0) {
    if (east === 1) return south === -1 ? 'up-right' : 'down-right';
    return south === -1 ? 'up-left' : 'down-left';
  }

  // In 4-way mode (or single-axis pushes in 8-way mode), horizontal directions
  // are tested and acted upon before vertical directions.
  if (east === 1) return 'right';
  if (east === -1) return 'left';
  if (south === 1) return 'down';
  return 'up';
}
