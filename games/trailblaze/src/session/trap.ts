/**
 * Spotting the sealed trap: breadth-first flood fill detects when a running
 * rider has been shut into a pocket of 40 or fewer cells by an opponent, leaving
 * all other riding riders outside the pocket.
 */
import { chebyshevDistance } from '../engine/grid.ts';
import { pocketCells } from '../engine/space.ts';
import {
  FOUR_WAY_SEATS,
  SEATS,
  type Cell,
  type Laid,
  type Match,
  type Seat,
} from '../engine/types.ts';

export interface Trap {
  readonly seat: Seat; // the rider shut in
  readonly pocket: readonly Cell[];
  /** The cell whose laying closed the pocket: a cell another rider laid this step. */
  readonly seal: Cell;
}

/** Pocket size at or below which a shut-in rider counts as trapped. */
export const TRAP_POCKET = 40;

/**
 * After a step: riders still running whose reachable space has just become a sealed pocket of at
 * most TRAP_POCKET cells, with no other riding rider inside it. `alreadyTrapped` holds seats reported
 * earlier this round, which are not reported again.
 */
export function spotTraps(
  match: Readonly<Match>,
  laid: readonly Laid[],
  alreadyTrapped: ReadonlySet<Seat>,
): Trap[] {
  if (match.phase !== 'running') {
    return [];
  }

  const traps: Trap[] = [];
  const seats: readonly Seat[] =
    match.setup.players === 1 ? [0] : match.setup.players === 4 ? FOUR_WAY_SEATS : SEATS;

  for (const seat of seats) {
    const rider = match.riders[seat];
    if (!rider || alreadyTrapped.has(seat) || rider.crashed) continue;

    const pocket = pocketCells(match, rider.cell, TRAP_POCKET + 1);
    if (pocket.length > TRAP_POCKET) {
      continue;
    }

    const otherRidingRiders = seats.filter((s) => {
      const other = match.riders[s];
      return s !== seat && other !== undefined && !other.crashed;
    });

    const anyOtherInside = otherRidingRiders.some((s) => {
      const other = match.riders[s];
      return other !== undefined && pocket.includes(other.cell);
    });

    if (anyOtherInside) {
      continue;
    }

    const otherLaid = laid.find((entry) => entry.seat !== seat);
    let seal: Cell;
    if (otherLaid !== undefined) {
      seal = otherLaid.cell;
    } else {
      const wraparound = match.setup.rules.edges === 'wraparound';
      let nearestDist = Infinity;
      let nearestHead = rider.cell;
      for (const otherSeat of seats) {
        if (otherSeat === seat) continue;
        const otherRider = match.riders[otherSeat];
        if (!otherRider) continue;
        const dist = chebyshevDistance(rider.cell, otherRider.cell, wraparound);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestHead = otherRider.cell;
        }
      }
      seal = nearestHead;
    }

    traps.push({ seat, pocket, seal });
  }

  return traps;
}
