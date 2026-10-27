/**
 * The field: nine columns by seven rows, 63 squares numbered row by row from
 * the top-left corner, as in 1978. Explorers wrap round every edge when they
 * walk, but clues never do: a distance or a bearing is measured straight
 * across the field, so the flag is never "one step away" through a wall.
 */
export const COLUMNS = 9;
export const ROWS = 7;
export const SQUARE_COUNT = COLUMNS * ROWS;

/** A square's number, 0–62: row × 9 + column. */
export type Square = number;

export interface Spot {
  readonly column: number;
  readonly row: number;
}

/** Seat 1 starts top left, seat 2 bottom right; a bomb sends an explorer back here. */
export const HOME_SQUARES = [0, SQUARE_COUNT - 1] as const;

/**
 * Eight compass bearings, clockwise from north (up the field). The index times
 * 45° is the bearing's angle, which is how every look turns its arrows.
 */
export const BEARINGS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type Bearing = (typeof BEARINGS)[number];

export function spotOf(square: Square): Spot {
  return { column: square % COLUMNS, row: Math.floor(square / COLUMNS) };
}

export function squareAt(column: number, row: number): Square {
  return row * COLUMNS + column;
}

export function isSquare(value: number): value is Square {
  return Number.isInteger(value) && value >= 0 && value < SQUARE_COUNT;
}

/** The chess king's distance: the larger of the column and row differences, 1–8 on this field. */
export function kingDistance(from: Square, to: Square): number {
  const a = spotOf(from);
  const b = spotOf(to);
  return Math.max(Math.abs(a.column - b.column), Math.abs(a.row - b.row));
}

/**
 * The 1978 arrow: it points along a row or column only when the flag shares
 * it, and diagonally otherwise, however steep the true line. So an arrow says
 * which of eight regions the flag is in, not the exact line to it.
 */
export function bearingTowards(from: Square, to: Square): Bearing {
  const a = spotOf(from);
  const b = spotOf(to);
  const east = Math.sign(b.column - a.column);
  const south = Math.sign(b.row - a.row);
  return BEARING_BY_SIGNS[south + 1]?.[east + 1] ?? 'n';
}

const BEARING_BY_SIGNS: readonly (readonly Bearing[])[] = [
  ['nw', 'n', 'ne'],
  ['w', 'n', 'e'],
  ['sw', 's', 'se'],
];

/** Degrees clockwise from north. */
export function bearingDegrees(bearing: Bearing): number {
  return BEARINGS.indexOf(bearing) * 45;
}

/** One step in any of the eight directions, wrapping round every edge as the explorers do. */
export function stepFrom(square: Square, east: number, south: number): Square {
  const { column, row } = spotOf(square);
  return squareAt((column + east + COLUMNS) % COLUMNS, (row + south + ROWS) % ROWS);
}

/**
 * The step between two neighbouring squares, wrap included: east and south are each −1, 0 or 1.
 * Returns null when the squares are not neighbours on the wrapped field.
 */
export function stepBetween(
  from: Square,
  to: Square,
): { readonly east: number; readonly south: number } | null {
  const a = spotOf(from);
  const b = spotOf(to);
  const east = wrappedOffset(b.column - a.column, COLUMNS);
  const south = wrappedOffset(b.row - a.row, ROWS);
  if (Math.abs(east) > 1 || Math.abs(south) > 1 || (east === 0 && south === 0)) return null;
  return { east, south };
}

function wrappedOffset(difference: number, size: number): number {
  const forward = (difference + size) % size;
  return forward > size / 2 ? forward - size : forward;
}
