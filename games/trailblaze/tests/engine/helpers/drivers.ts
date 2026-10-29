/**
 * Test drivers for Trailblaze's engine: a pure-stick space-filling rider that
 * inspects only `match.riders`, a deterministic seeded stick stream generator,
 * and tick-stepping helpers.
 */
import { columnOf, rowOf } from '../../../src/engine/grid.ts';
import { vectorOf } from '../../../src/engine/headings.ts';
import { stepMatch } from '../../../src/engine/match.ts';
import {
  IDLE,
  type Heading,
  type Match,
  type MatchEvent,
  type Stick,
} from '../../../src/engine/types.ts';

/**
 * Steers seat 0 across the 38x18 open interior of variation 1 using only its
 * current position in `match.riders[0]`:
 *
 * 1. Ride right from (10, 10) to (38, 10), then turn up into row 9.
 * 2. Boustrophedon across rows 9 down to 2 between columns 2 and 38, leaving
 *    column 1 open as a vertical return lane.
 * 3. Ride left across row 1 from column 38 to column 1, then down column 1
 *    from row 1 to row 11.
 * 4. Boustrophedon across rows 11 down to 18 between columns 1 and 38, laying
 *    676 trail cells (98.8% of the 684 open cells) before hitting the bottom wall.
 */
export function spaceFillingStick(match: Readonly<Match>): Stick {
  const rider = match.riders[0];
  if (!rider) return IDLE;
  const col = columnOf(rider.cell);
  const row = rowOf(rider.cell);
  const desired = desiredHeadingAt(col, row);
  const vec = vectorOf(desired);
  return { east: vec.east, south: vec.south, fire: false };
}

function desiredHeadingAt(col: number, row: number): Heading {
  if (row === 10 && col >= 10) {
    return col < 38 ? 'right' : 'up';
  }
  if (row >= 2 && row <= 9) {
    if (col === 1) return 'down';
    if (row % 2 === 1) {
      return col > 2 ? 'left' : 'up';
    }
    return col < 38 ? 'right' : 'up';
  }
  if (row === 1) {
    return col > 1 ? 'left' : 'down';
  }
  if (row === 10 && col < 10) {
    return 'down';
  }
  if (row % 2 === 1) {
    return col < 38 ? 'right' : 'down';
  }
  return col > 1 ? 'left' : 'down';
}

const AXES: readonly (-1 | 0 | 1)[] = [-1, 0, 1];

/**
 * Deterministic 32-bit PRNG (Mulberry32) producing repeatable stick pairs
 * without touching `Math.random`.
 */
export function createSeededStickStream(seed: number): () => readonly [Stick, Stick] {
  let state = seed >>> 0;
  function nextUint32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }

  function nextStick(): Stick {
    const bits = nextUint32();
    const east = AXES[bits % 3] ?? 0;
    const south = AXES[((bits >>> 2) | 0) % 3] ?? 0;
    const fire = ((bits >>> 4) & 3) === 0;
    return { east, south, fire };
  }

  return () => [nextStick(), nextStick()];
}

export function runTicks(
  match: Match,
  ticks: number,
  sticks: readonly Stick[] = [IDLE, IDLE],
): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    events.push(...stepMatch(match, sticks));
  }
  return events;
}
