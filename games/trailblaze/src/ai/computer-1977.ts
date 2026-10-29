/**
 * The 1977 cartridge's computer opponent ("Computer 1977"), rebuilt as a step
 * pilot for Trailblaze.
 *
 * How it thinks:
 * - On every movement step, after both riders write their newly vacated trail
 *   cells, the computer scans outward from its current cell along the four
 *   cardinal axes in the fixed order `up`, `down`, `left`, `right`, counting
 *   consecutive empty cells along each ray.
 * - Its lookahead horizon is 3 cells on difficulty switch B and 6 cells on
 *   difficulty switch A.
 * - Starting with `up` as the default heading and `best = min(up, lookahead)`,
 *   each subsequent ray (`down`, `left`, `right`) is compared against `best`:
 *   - If the ray is strictly shorter than `best`, it is ignored.
 *   - If `best` is currently below `lookahead`, any later ray with `distance >= best`
 *     replaces the heading and (for `down` and `left`) stores its raw, uncapped
 *     distance into `best`. That uncapped store forces any remaining ray to beat
 *     the full open distance rather than just the lookahead, and also means that
 *     when all four rays are blocked at 0, each subsequent ray passes `0 >= 0`
 *     on the sub-lookahead branch and leaves the final heading as `right`.
 *   - If `best` has already reached or exceeded `lookahead` and the new ray is
 *     at least `best`, the computer checks bit 6 of the free-running tick
 *     counter: for 64 ticks (bit 6 = 1) it keeps the earlier ray, and for the
 *     other 64 ticks (bit 6 = 0) it switches to the later ray (clamping `best`
 *     to `lookahead` on `down` and `left`).
 *   - On the final `right` ray, the cartridge writes the `right` direction byte
 *     whenever `right` wins, without writing `best` again.
 */
import type { SwitchPosition } from '@woodgrain-88/kit';
import { columnOf, rowOf, stepFrom } from '../engine/grid.ts';
import {
  COLUMNS,
  EMPTY,
  ROWS,
  type Cell,
  type Heading,
  type Match,
  type Seat,
  type StepPilot,
} from '../engine/types.ts';

/** How far the computer reads along a ray: 3 cells on switch B, 6 on switch A. */
export type Lookahead = 3 | 6;

export function lookaheadFor(position: SwitchPosition): Lookahead {
  return position === 'A' ? 6 : 3;
}

export type CardinalHeading = 'up' | 'down' | 'left' | 'right';

export interface ComputerDecision {
  /** Free cells counted along each ray from the rider's cell, in scan order. */
  readonly rays: Readonly<Record<CardinalHeading, number>>;
  /** The best distance as the computer held it after the scan (it can exceed the lookahead). */
  readonly best: number;
  readonly heading: CardinalHeading;
  /** True on the 64-tick half where a tie goes to the later ray in the scan order. */
  readonly tiesGoLate: boolean;
}

/** One decision, exposed for tests, the Kid comparisons and the results panel. */
export function computerDecision(
  match: Readonly<Match>,
  seat: Seat,
  lookahead: Lookahead,
): ComputerDecision {
  const rider = match.riders[seat];
  if (!rider) throw new Error(`no rider in seat ${String(seat)}`);
  const origin = rider.cell;
  const wraparound = match.setup.rules.edges === 'wraparound';

  const rays: Record<CardinalHeading, number> = {
    up: countRay(match.cells, origin, 'up', wraparound),
    down: countRay(match.cells, origin, 'down', wraparound),
    left: countRay(match.cells, origin, 'left', wraparound),
    right: countRay(match.cells, origin, 'right', wraparound),
  };

  const tiesGoLate = (match.tick & 64) === 0;
  let heading: CardinalHeading = 'up';
  let best = Math.min(rays.up, lookahead);

  // Down and Left update both `best` and `heading` when they win.
  for (const dir of ['down', 'left'] as const) {
    const candidate = rays[dir];
    if (candidate < best) {
      continue;
    }

    if (best < lookahead) {
      // Hook 1: upgrading when `best < lookahead` stores the raw distance
      // without clamping it to `lookahead`.
      best = candidate;
      heading = dir;
      continue;
    }

    if (!tiesGoLate) {
      continue;
    }

    best = Math.min(candidate, lookahead);
    heading = dir;
  }

  // Right runs the same comparison against `best`, but in the cartridge only
  // updates `heading` when it wins, leaving `best` as held after Left.
  if (rays.right >= best && (best < lookahead || tiesGoLate)) {
    heading = 'right';
  }

  return {
    rays,
    best,
    heading,
    tiesGoLate,
  };
}

/** The computer as a pilot for any seat. */
export function createComputer1977(lookahead: Lookahead): StepPilot {
  return (match: Readonly<Match>, seat: Seat): Heading =>
    computerDecision(match, seat, lookahead).heading;
}

function countRay(
  cells: Int8Array,
  origin: Cell,
  direction: CardinalHeading,
  wraparound: boolean,
): number {
  const maxSteps = maxRaySteps(origin, direction, wraparound);
  let current = origin;
  let free = 0;

  for (let step = 0; step < maxSteps; step++) {
    current = stepFrom(current, direction).cell;
    if (cells[current] !== EMPTY) {
      break;
    }
    free += 1;
  }

  return free;
}

function maxRaySteps(origin: Cell, direction: CardinalHeading, wraparound: boolean): number {
  if (wraparound) {
    return direction === 'up' || direction === 'down' ? ROWS : COLUMNS;
  }
  switch (direction) {
    case 'up':
      return rowOf(origin);
    case 'down':
      return ROWS - 1 - rowOf(origin);
    case 'left':
      return columnOf(origin);
    case 'right':
      return COLUMNS - 1 - columnOf(origin);
  }
}
