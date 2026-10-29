/**
 * Pure rule helpers for Trailblaze's Remix channels: Fading Trails, Shrinking Arena,
 * and Boost Lanes.
 *
 * Durations and timings are measured in 20 ms ticks to match the engine's cadence.
 */
import { columnOf, rowOf } from './grid.ts';
import { BORDER, CELL_COUNT, COLUMNS, EMPTY, ROWS, type Cell, type Match } from './types.ts';

/**
 * The innermost ring that can become a border wall.
 * Ring 7 leaves a strip of 4 open rows (rows 8–11) across the centre of the arena.
 */
export const LAST_RING = 7;

/**
 * Calculates the concentric ring distance of a cell to the nearest arena perimeter edge.
 * Ring 0 corresponds to the arena's outer border wall.
 */
export function ringOfCell(cell: Cell): number {
  const col = columnOf(cell);
  const row = rowOf(cell);
  return Math.min(col, row, COLUMNS - 1 - col, ROWS - 1 - row);
}

/** Precomputed cell indices for each concentric ring (0 to 9), in ascending index order. */
const RING_CELLS: readonly (readonly Cell[])[] = Array.from({ length: 10 }, (_, ring) => {
  const cells: Cell[] = [];
  for (let c = 0; c < CELL_COUNT; c++) {
    if (ringOfCell(c) === ring) {
      cells.push(c);
    }
  }
  return Object.freeze(cells);
});

/**
 * Returns every cell belonging to ring `r` in ascending index order.
 */
export function ringCells(ring: number): readonly Cell[] {
  return RING_CELLS[ring] ?? [];
}

/**
 * Checks whether a cell belongs to a specific concentric ring.
 */
export function isRingCell(cell: Cell, ring: number): boolean {
  return ringOfCell(cell) === ring;
}

/**
 * Determines whether the arena should close in another ring on the current tick.
 * Only bordered arenas shrink, and shrinking caps at LAST_RING.
 */
export function shouldShrink(match: Readonly<Match>): boolean {
  const shrinkEvery = match.setup.rules.remix?.shrinkEvery;
  if (shrinkEvery === undefined || match.setup.rules.edges !== 'bordered') {
    return false;
  }
  if (match.phase !== 'running' || match.shrunk >= LAST_RING) {
    return false;
  }
  return match.roundTick === (match.shrunk + 1) * shrinkEvery;
}

/**
 * Closes the next concentric border ring, turning all cells in the ring into BORDER
 * and clearing their trail timestamps to -1.
 */
export function applyShrink(match: Match): { ring: number; cells: readonly Cell[] } | null {
  if (!shouldShrink(match)) return null;

  const ring = match.shrunk + 1;
  const cells = ringCells(ring);
  for (const cell of cells) {
    match.cells[cell] = BORDER;
    match.laidAt[cell] = -1;
  }
  match.shrunk = ring;
  return { ring, cells };
}

/**
 * Erases any trail cell whose age has reached `fadeAfter` ticks, restoring it to EMPTY.
 * Border cells never fade. Returns the list of erased cells in ascending index order.
 */
export function fadeTrails(match: Match): Cell[] {
  const fadeAfter = match.setup.rules.remix?.fadeAfter;
  if (fadeAfter === undefined) return [];

  const erased: Cell[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const content = match.cells[cell];
    // Border cells never fade; only trail cells (seats 0..3) fade.
    if (content !== undefined && content >= 0) {
      const laidTick = match.laidAt[cell];
      if (laidTick !== undefined && match.tick - laidTick >= fadeAfter) {
        match.cells[cell] = EMPTY;
        match.laidAt[cell] = -1;
        erased.push(cell);
      }
    }
  }
  return erased;
}

/**
 * Checks whether a given cell is marked as a boost lane in the match's remix rules.
 */
export function isBoostLane(match: Readonly<Match>, cell: Cell): boolean {
  const lanes = match.setup.rules.remix?.boostLanes;
  if (!lanes || lanes.length === 0) return false;
  return lanes.includes(cell);
}

/**
 * Half steps occur ceil(stepPeriod / 2) ticks after each full step.
 * Since untilStep counts down from stepPeriod to 0, this tick matches when
 * untilStep reaches `stepPeriod - ceil(stepPeriod / 2)`.
 */
export function isHalfStepTick(match: Readonly<Match>): boolean {
  const lanes = match.setup.rules.remix?.boostLanes;
  if (!lanes || lanes.length === 0) return false;
  const halfStepOffset = Math.ceil(match.stepPeriod / 2);
  return match.untilStep === match.stepPeriod - halfStepOffset;
}
