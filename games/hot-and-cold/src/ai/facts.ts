/**
 * What a Kid remembers about Hot & Cold: checks, as facts for the kit's
 * memory model. Two checks of the same square while the flag stood still are
 * one fact; once the flag has moved they are different facts. Misremembering
 * stays close to the truth, as a person's does: a distance is off by one, an
 * arrow turned a notch, or the clue pinned to the square next door.
 */
import type { FactAdapter, Rng } from '@woodgrain-88/kit';
import type { Clue } from '../engine/board.ts';
import { BEARINGS, stepFrom } from '../engine/grid.ts';
import type { Fact } from '../engine/solver.ts';

export const FACT_ADAPTER: FactAdapter<Fact> = {
  key: (fact) => `${fact.square}@${fact.flagMoves}`,
  distort(fact, rng) {
    if (rng.chance(0.3)) {
      const east = rng.pick([-1, 0, 1] as const);
      const south = rng.pick(east === 0 ? ([-1, 1] as const) : ([-1, 0, 1] as const));
      return { ...fact, square: stepFrom(fact.square, east, south) };
    }
    return { ...fact, clue: distortClue(fact.clue, rng) };
  },
};

function distortClue(clue: Clue, rng: Rng): Clue {
  if (clue.kind === 'distance') {
    // Always one away from the truth, and never off the field's scale of 1 to 8.
    const down = clue.distance === 8 || (clue.distance > 1 && rng.chance(0.5));
    return { kind: 'distance', distance: clue.distance + (down ? -1 : 1) };
  }
  if (clue.kind === 'arrow') {
    const index = BEARINGS.indexOf(clue.bearing);
    const turned = BEARINGS[(index + (rng.chance(0.5) ? 1 : 7)) % BEARINGS.length];
    return turned ? { kind: 'arrow', bearing: turned } : clue;
  }
  return clue;
}

/** Bombs and finds stick; a distance of 1 or 2 is a surprise worth remembering too. */
export function isStriking(clue: Clue): boolean {
  return (
    clue.kind === 'bomb' || clue.kind === 'flag' || (clue.kind === 'distance' && clue.distance <= 2)
  );
}
