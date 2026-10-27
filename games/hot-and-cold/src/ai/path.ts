/**
 * Getting about the field. The field wraps on every edge, so the way to a
 * square may run off one side and in at the other; a king's step at a time,
 * the shortest way is the larger of the wrapped column and row gaps. The
 * other explorer is an obstacle: the Kid walks the shortest way round it.
 */
import { COLUMNS, ROWS, SQUARE_COUNT, spotOf, stepFrom, type Square } from '../engine/grid.ts';

export interface Move {
  readonly east: -1 | 0 | 1;
  readonly south: -1 | 0 | 1;
}

function wrappedGap(from: number, to: number, size: number): number {
  const forward = (to - from + size) % size;
  return forward > size / 2 ? forward - size : forward;
}

/** Steps between two squares on the wrapped field. */
export function stepsBetween(from: Square, to: Square): number {
  const a = spotOf(from);
  const b = spotOf(to);
  return Math.max(
    Math.abs(wrappedGap(a.column, b.column, COLUMNS)),
    Math.abs(wrappedGap(a.row, b.row, ROWS)),
  );
}

const MOVES: readonly Move[] = [
  { east: 0, south: -1 },
  { east: 1, south: -1 },
  { east: 1, south: 0 },
  { east: 1, south: 1 },
  { east: 0, south: 1 },
  { east: -1, south: 1 },
  { east: -1, south: 0 },
  { east: -1, south: -1 },
];

/**
 * The next step towards `to`, the shortest way round `blocked` (the other explorer); null when
 * already there or when there is no way at all. A walk out from the target over the wrapped field
 * gives every square its distance; the step goes to the neighbour nearest the target.
 */
export function nextMove(from: Square, to: Square, blocked: Square | null): Move | null {
  if (from === to || to === blocked) return null;
  const distance = new Int16Array(SQUARE_COUNT).fill(-1);
  distance[to] = 0;
  const queue: Square[] = [to];
  // The queue grows as the walk spreads; iterating it visits every square added along the way.
  for (const square of queue) {
    for (const move of MOVES) {
      const next = stepFrom(square, move.east, move.south);
      if (next === blocked || (distance[next] ?? 0) >= 0) continue;
      distance[next] = (distance[square] ?? 0) + 1;
      queue.push(next);
    }
  }
  let best: Move | null = null;
  let bestDistance = Infinity;
  let bestSpan = Infinity;
  for (const move of MOVES) {
    const next = stepFrom(from, move.east, move.south);
    const left = distance[next] ?? -1;
    if (next === blocked || left < 0) continue;
    // Of equally short steps, the one nearest the straight line: no zig-zags, no needless wraps.
    const span = straightSpan(next, to);
    if (left < bestDistance || (left === bestDistance && span < bestSpan)) {
      bestDistance = left;
      bestSpan = span;
      best = move;
    }
  }
  return best;
}

/** The straight-line distance between two squares, the short way round the wrapped field. */
function straightSpan(from: Square, to: Square): number {
  const a = spotOf(from);
  const b = spotOf(to);
  return Math.hypot(wrappedGap(a.column, b.column, COLUMNS), wrappedGap(a.row, b.row, ROWS));
}
