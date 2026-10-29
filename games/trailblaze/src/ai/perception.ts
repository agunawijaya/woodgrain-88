/**
 * A Kid's perception of the Trailblaze arena.
 *
 * A human player only takes in what is near their head in sharp focus; walls
 * and trails far away are felt as "open over there". A Kid's perception
 * models this: cells within Chebyshev distance of `radius` from the rider's
 * head are seen accurately (blocked by trail or border), while cells beyond
 * that radius are perceived as empty.
 */
import { columnOf, rowOf, stepFrom } from '../engine/grid.ts';
import { HEADINGS } from '../engine/headings.ts';
import {
  CELL_COUNT,
  COLUMNS,
  EMPTY,
  ROWS,
  type Cell,
  type Heading,
  type Match,
} from '../engine/types.ts';

const CARDINAL_HEADINGS: readonly Heading[] = ['up', 'down', 'left', 'right'];

/**
 * What a Kid can see of the board: cells within `radius` of its head (Chebyshev distance, across
 * edges in a wraparound arena) as they are; cells beyond it as empty, because a person only
 * registers far-off walls as "open over there".
 */
export interface Perception {
  /** True when the Kid believes the cell is blocked (trail or border). */
  blocked(cell: Cell): boolean;
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

/**
 * Builds the Kid's perception snapshot around `head` with the given `radius`.
 * An optional pre-allocated buffer can be passed to avoid allocations per decision.
 */
export function perceive(
  match: Readonly<Match>,
  head: Cell,
  radius: number,
  outMask?: Uint8Array,
): Perception {
  const mask = outMask ?? new Uint8Array(CELL_COUNT);
  const wraparound = match.setup.rules.edges === 'wraparound';
  const cells = match.cells;

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const dist = chebyshevDistance(head, cell, wraparound);
    if (dist <= radius) {
      mask[cell] = cells[cell] !== EMPTY ? 1 : 0;
    } else {
      mask[cell] = 0;
    }
  }

  return {
    blocked(cell: Cell): boolean {
      return mask[cell] === 1;
    },
  };
}

/** Free cells counted along a heading from `from`, as the Kid perceives them, up to `limit`. */
export function rayLength(
  match: Readonly<Match>,
  view: Perception,
  from: Cell,
  heading: Heading,
  limit: number,
): number {
  if (limit <= 0) return 0;
  const wraparound = match.setup.rules.edges === 'wraparound';
  let current = from;
  let count = 0;

  for (let step = 0; step < limit; step++) {
    const nextStep = stepFrom(current, heading);
    if (nextStep.wrapped && !wraparound) {
      break;
    }
    const nextCell = nextStep.cell;
    if (view.blocked(nextCell)) {
      break;
    }
    count += 1;
    current = nextCell;
    if (current === from) {
      break;
    }
  }

  return count;
}

const defaultQueue = new Int32Array(CELL_COUNT);
const defaultVisitedAt = new Int32Array(CELL_COUNT);
let defaultStamp = 0;

/** Empty cells the Kid believes it could reach from `from`, by the engine's connectivity, up to `limit`. */
export function believedSpace(
  match: Readonly<Match>,
  view: Perception,
  from: Cell,
  limit: number,
  queueBuffer?: Int32Array,
  visitedBuffer?: Int32Array,
): number {
  if (limit <= 0) return 0;

  const queue = queueBuffer ?? defaultQueue;
  const visitedAt = visitedBuffer ?? defaultVisitedAt;

  defaultStamp += 1;
  if (defaultStamp >= 0x7fffffff) {
    visitedAt.fill(0);
    defaultStamp = 1;
  }
  const stamp = defaultStamp;

  const headings = match.setup.rules.steering === 8 ? HEADINGS : CARDINAL_HEADINGS;
  const wraparound = match.setup.rules.edges === 'wraparound';

  queue[0] = from;
  visitedAt[from] = stamp;

  let head = 0;
  let tail = 1;
  let count = 0;

  while (head < tail && count < limit) {
    const current = queue[head] ?? from;
    head += 1;

    for (const heading of headings) {
      const step = stepFrom(current, heading);
      if (step.wrapped && !wraparound) continue;

      const next = step.cell;
      if (visitedAt[next] === stamp) continue;
      if (view.blocked(next)) continue;

      visitedAt[next] = stamp;
      queue[tail] = next;
      tail += 1;
      count += 1;
      if (count >= limit) break;
    }
  }

  return count;
}
