/**
 * The 40-column by 20-row arena grid, cell index arithmetic, edge wraparound,
 * perimeter wall checks, and starting coordinates for both seats.
 */
import { vectorOf } from './headings.ts';
import { COLUMNS, ROWS, type Cell, type Heading, type MatchSetup, type Seat } from './types.ts';

export function cellAt(column: number, row: number): Cell {
  return row * COLUMNS + column;
}

export function columnOf(cell: Cell): number {
  return cell % COLUMNS;
}

export function rowOf(cell: Cell): number {
  return Math.floor(cell / COLUMNS);
}

/**
 * The cell one step along `heading`, wrapping at every edge (the cartridge's arithmetic wraps
 * even in bordered arenas; the border cells are what stop a rider there).
 */
export function stepFrom(cell: Cell, heading: Heading): { cell: Cell; wrapped: boolean } {
  const { east, south } = vectorOf(heading);
  const rawColumn = columnOf(cell) + east;
  const rawRow = rowOf(cell) + south;
  const wrapped = rawColumn < 0 || rawColumn >= COLUMNS || rawRow < 0 || rawRow >= ROWS;
  const nextColumn = (rawColumn + COLUMNS) % COLUMNS;
  const nextRow = (rawRow + ROWS) % ROWS;
  return { cell: cellAt(nextColumn, nextRow), wrapped };
}

export function isBorderCell(cell: Cell): boolean {
  const column = columnOf(cell);
  const row = rowOf(cell);
  return row === 0 || row === ROWS - 1 || column === 0 || column === COLUMNS - 1;
}

/**
 * Computes the Chebyshev distance between two cells, wrapping across board
 * boundaries when the arena rules permit it.
 */
export function chebyshevDistance(cellA: Cell, cellB: Cell, wraparound: boolean): number {
  const colA = columnOf(cellA);
  const rowA = rowOf(cellA);
  const colB = columnOf(cellB);
  const rowB = rowOf(cellB);

  let dx = Math.abs(colA - colB);
  let dy = Math.abs(rowA - rowB);

  if (wraparound) {
    dx = Math.min(dx, COLUMNS - dx);
    dy = Math.min(dy, ROWS - dy);
  }

  return Math.max(dx, dy);
}

export interface StartSpot {
  readonly cell: Cell;
  readonly heading: Heading;
}

export const START: readonly [StartSpot, StartSpot] = [
  { cell: cellAt(10, 10), heading: 'right' },
  { cell: cellAt(30, 10), heading: 'left' },
];

export const FOUR_WAY_START: readonly [StartSpot, StartSpot, StartSpot, StartSpot] = [
  { cell: cellAt(5, 4), heading: 'right' },
  { cell: cellAt(34, 15), heading: 'left' },
  { cell: cellAt(34, 4), heading: 'down' },
  { cell: cellAt(5, 15), heading: 'up' },
];

/**
 * Starting spot for a seat under the match's setup. Throws if the seat does not ride.
 */
export function startOf(setup: Pick<MatchSetup, 'players'>, seat: Seat): StartSpot {
  if (setup.players === 4) return FOUR_WAY_START[seat];
  if (seat === 0 || seat === 1) return START[seat];
  throw new Error(`seat ${String(seat)} does not ride in a duel`);
}
