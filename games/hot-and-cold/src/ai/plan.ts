/**
 * Choosing where to check next. Every square gets a value from what the Kid
 * believes: how likely the flag is there, how much a check there would tell,
 * how far it is to walk, and (for some Kids) how a bomb nearby or the rival
 * changes things. The Kid heads for the best one. In the races, time costs
 * squares; in turns and hunt for hunt only checks count, so distance hardly
 * matters.
 */
import type { Rng } from '@woodgrain-88/kit';
import type { SquareKind } from '../engine/board.ts';
import { kingDistance, SQUARE_COUNT, type Square } from '../engine/grid.ts';
import type { PlayStyle } from '../engine/rules.ts';
import { expectedInformation, type FlagBelief } from '../engine/solver.ts';
import { stepsBetween } from './path.ts';
import type { HuntStyle } from './styles.ts';

export interface PlanInput {
  readonly belief: FlagBelief;
  readonly here: Square;
  /** The rival explorer, if it is on the field. */
  readonly rival: Square | null;
  /** Where the rival last checked, for the Kids who follow it. */
  readonly rivalLastCheck: Square | null;
  /** Kinds of squares the Kid remembers seeing checked. */
  readonly knownKinds: ReadonlyMap<Square, SquareKind>;
  /** Whether a remembered check of the square already says all a check could (a still flag). */
  readonly settled: ReadonlySet<Square>;
  readonly style: HuntStyle;
  readonly play: PlayStyle;
  readonly rng: Rng;
}

export function chooseTarget(input: PlanInput): Square {
  const { belief, style, rng } = input;
  if (style.wander > 0 && rng.chance(style.wander)) return wanderTarget(input);
  if (belief.candidates.length <= style.commitAt) return likeliest(input);
  let best = input.here;
  let bestValue = -Infinity;
  for (let square = 0; square < SQUARE_COUNT; square++) {
    const value = valueOf(input, square);
    if (value > bestValue) {
      bestValue = value;
      best = square;
    }
  }
  return best;
}

/** Squares the Kid cannot sensibly aim for: a remembered bomb, a settled square, the rival's spot. */
function outOfBounds(input: PlanInput, square: Square): boolean {
  return (
    input.knownKinds.get(square) === 'bomb' || input.settled.has(square) || square === input.rival
  );
}

function valueOf(input: PlanInput, square: Square): number {
  const { belief, style, knownKinds, here, play } = input;
  if (outOfBounds(input, square)) return -Infinity;
  const chance = belief.chance[square] ?? 0;
  const kind = knownKinds.get(square) ?? null;
  const information = expectedInformation(belief, square, kind === 'bomb' ? null : kind);
  const timeMatters = play === 'race' || play === 'clock';
  const travel = stepsBetween(here, square) * style.travelCost * (timeMatters ? 1 : 0.1);
  return (
    style.flagWeight * chance +
    style.infoWeight * information -
    travel -
    style.bombShy * nearBombs(knownKinds, square) +
    style.contest * rivalry(input, square, chance)
  );
}

/** Remembered bombs next to a square: Moss reads them as a warning, whatever the rules say. */
function nearBombs(knownKinds: ReadonlyMap<Square, SquareKind>, square: Square): number {
  let count = 0;
  for (const [known, kind] of knownKinds) {
    if (kind === 'bomb' && kingDistance(known, square) === 1) count++;
  }
  return count;
}

/**
 * Racing the rival: a likely square the Kid can reach first is worth more; and squares close to
 * where the rival last checked carry the rival's conclusion, which Benny and Rosa follow.
 */
function rivalry(input: PlanInput, square: Square, chance: number): number {
  const { rival, rivalLastCheck, here } = input;
  let value = 0;
  if (rival !== null) {
    const lead = stepsBetween(rival, square) - stepsBetween(here, square);
    value += chance * Math.max(-1, Math.min(1, lead / 2));
  }
  if (rivalLastCheck !== null) value += 0.15 / (1 + stepsBetween(rivalLastCheck, square));
  return value;
}

function likeliest(input: PlanInput): Square {
  const { belief, here, knownKinds } = input;
  let best = here;
  let bestValue = -Infinity;
  for (const square of belief.candidates) {
    if (knownKinds.get(square) === 'bomb' || square === input.rival) continue;
    const value = (belief.chance[square] ?? 0) - stepsBetween(here, square) * 0.001;
    if (value > bestValue) {
      bestValue = value;
      best = square;
    }
  }
  return best;
}

/** A nearby square the Kid has not checked, picked at random: Pip's hunches. */
function wanderTarget(input: PlanInput): Square {
  const nearby: Square[] = [];
  for (let square = 0; square < SQUARE_COUNT; square++) {
    const steps = stepsBetween(input.here, square);
    if (steps >= 1 && steps <= 3 && !outOfBounds(input, square)) nearby.push(square);
  }
  return nearby.length > 0 ? input.rng.pick(nearby) : likeliest(input);
}
