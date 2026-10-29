/**
 * Breadth-first flood fill over reachable EMPTY cells for territory evaluation
 * and bot lookahead.
 *
 * Buffers are allocated once at module load and stamped per call so calling
 * `openSpace` on every step visits at most O(cells visited) without allocating.
 */
import { stepFrom } from './grid.ts';
import { HEADINGS } from './headings.ts';
import { CELL_COUNT, EMPTY, type Cell, type Heading, type Match } from './types.ts';

const CARDINAL_HEADINGS: readonly Heading[] = ['up', 'down', 'left', 'right'];

const queue = new Int32Array(CELL_COUNT);
const visitedAt = new Int32Array(CELL_COUNT);
let currentStamp = 0;

/**
 * How many empty cells a rider standing on `from` could reach, counting up to `limit` and
 * stopping there. Movement follows the rules: 8-connected under 8-way steering (a rider slips
 * between two trail cells that touch only at a corner), 4-connected otherwise, across edges only
 * in wraparound arenas. `from` itself is not counted.
 */
export function openSpace(match: Readonly<Match>, from: Cell, limit: number): number {
  return flood(match, from, limit);
}

/** The empty cells reachable from `from`, as above, in breadth-first order, at most `limit`. */
export function pocketCells(match: Readonly<Match>, from: Cell, limit: number): Cell[] {
  const count = flood(match, from, limit);
  const result: Cell[] = new Array<Cell>(count);
  for (let i = 0; i < count; i++) {
    result[i] = queue[i + 1] ?? 0;
  }
  return result;
}

function nextStamp(): number {
  currentStamp += 1;
  if (currentStamp >= 0x7fffffff) {
    visitedAt.fill(0);
    currentStamp = 1;
  }
  return currentStamp;
}

function flood(match: Readonly<Match>, from: Cell, limit: number): number {
  if (limit <= 0) return 0;

  const stamp = nextStamp();
  const headings = match.setup.rules.steering === 8 ? HEADINGS : CARDINAL_HEADINGS;
  const wraparound = match.setup.rules.edges === 'wraparound';
  const cells = match.cells;

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
      if (cells[next] !== EMPTY) continue;

      visitedAt[next] = stamp;
      queue[tail] = next;
      tail += 1;
      count += 1;
      if (count >= limit) break;
    }
  }

  return count;
}
