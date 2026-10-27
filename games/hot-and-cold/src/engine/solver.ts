/**
 * Where can the flag be? Given what is known about checks on this field,
 * the solver keeps every story of the flag that fits: for a still flag, the
 * square it sits on; for a moving one, where it started and which way it is
 * heading, followed through every move since. From the stories that fit it
 * gives each square's chance of holding the flag now, the candidate squares
 * (for the possibility fog), and how much a check on a square would tell
 * (for the Kids who plan their checks).
 *
 * Memories can be wrong: a misremembered clue may contradict the rest. Then
 * the solver keeps the stories that break the fewest facts, as a person
 * trusts the bulk of what they know, and says the facts did not all agree.
 */
import type { Clue } from './board.ts';
import { HEADINGS, stepFlag } from './flag.ts';
import { BEARINGS, bearingTowards, kingDistance, SQUARE_COUNT, type Square } from './grid.ts';
import type { FlagMotion } from './rules.ts';

/** What someone knows about one check: where, what it said, and how often the flag had moved. */
export interface Fact {
  readonly square: Square;
  readonly clue: Clue;
  readonly flagMoves: number;
}

export interface FlagBelief {
  /** For each square, the chance the flag stands there now; all zero only with no story at all. */
  readonly chance: Float64Array;
  /** Squares that could hold the flag now. */
  readonly candidates: readonly Square[];
  /** Whether some story fits every fact. */
  readonly consistent: boolean;
  /** How many stories remain. */
  readonly stories: number;
  /** Where each remaining story puts the flag now, one entry per story. */
  readonly positions: readonly Square[];
}

/** The square kinds still hidden on a field, for weighing what a check might show. */
export interface KindOdds {
  readonly bomb: number;
  readonly distance: number;
  readonly arrow: number;
}

/** A fresh square on a cartridge field: 8 bombs and 27 distances among the 62 squares without the flag. */
export const CARTRIDGE_ODDS: KindOdds = { bomb: 8 / 62, distance: 27 / 62, arrow: 27 / 62 };

/**
 * Every story's square after each number of moves, worked out once per motion. A still flag has
 * 63 stories (one per square); a moving one 63 × 8 (square and heading).
 */
interface Paths {
  readonly stories: number;
  readonly length: number;
  readonly squares: Uint8Array;
}

const PATHS = new Map<FlagMotion, Paths>();
const MOVES_TRACED = 160;

function pathsFor(motion: FlagMotion): Paths {
  const known = PATHS.get(motion);
  if (known) return known;
  const headings = motion === 'still' ? 1 : HEADINGS.length;
  const stories = SQUARE_COUNT * headings;
  const length = MOVES_TRACED + 1;
  const squares = new Uint8Array(stories * length);
  for (let start = 0; start < SQUARE_COUNT; start++) {
    for (let index = 0; index < headings; index++) {
      const story = start * headings + index;
      let square = start;
      let heading = HEADINGS[index] ?? { east: 0, south: 0 };
      for (let move = 0; move < length; move++) {
        squares[story * length + move] = square;
        const next = stepFlag(square, heading, motion);
        square = next.square;
        heading = next.heading;
      }
    }
  }
  const paths = { stories, length, squares };
  PATHS.set(motion, paths);
  return paths;
}

function positionOf(paths: Paths, story: number, moves: number): Square {
  const move = Math.min(moves, paths.length - 1);
  return paths.squares[story * paths.length + move] ?? 0;
}

/** Whether a story with the flag on `flag` at the time of the fact agrees with it. */
export function agrees(fact: Fact, flag: Square): boolean {
  const { clue, square } = fact;
  if (clue.kind === 'flag') return flag === square;
  if (flag === square) return false;
  if (clue.kind === 'distance') return kingDistance(square, flag) === clue.distance;
  if (clue.kind === 'arrow') return bearingTowards(square, flag) === clue.bearing;
  return true;
}

/**
 * The flag's whereabouts after `now` moves, from what is known. Facts from later than `now` (a
 * muddled count) are read as if they happened now.
 */
export function believe(motion: FlagMotion, facts: readonly Fact[], now: number): FlagBelief {
  const paths = pathsFor(motion);
  const misses = new Uint16Array(paths.stories);
  let fewest = Infinity;
  for (let story = 0; story < paths.stories; story++) {
    let broken = 0;
    for (const fact of facts) {
      const at = positionOf(paths, story, Math.min(fact.flagMoves, now));
      if (!agrees(fact, at)) broken++;
    }
    misses[story] = broken;
    if (broken < fewest) fewest = broken;
  }
  const chance = new Float64Array(SQUARE_COUNT);
  const positions: Square[] = [];
  for (let story = 0; story < paths.stories; story++) {
    if (misses[story] !== fewest) continue;
    const square = positionOf(paths, story, now);
    positions.push(square);
    chance[square] = (chance[square] ?? 0) + 1;
  }
  const candidates: Square[] = [];
  for (let square = 0; square < SQUARE_COUNT; square++) {
    const count = chance[square] ?? 0;
    if (count > 0) candidates.push(square);
    chance[square] = count / Math.max(1, positions.length);
  }
  return {
    chance,
    candidates,
    consistent: fewest === 0,
    stories: positions.length,
    positions,
  };
}

/** Stories kept a fact at a time, never forgetting: exact and cheap for a long hunt. */
export interface StoryTracker {
  add(fact: Fact): void;
  /** The belief after `now` moves; facts must have been added in the order they happened. */
  believe(now: number): FlagBelief;
}

/**
 * The exact solver, for whoever forgets nothing: the possibility fog and the simulations'
 * perfect hunter. Each fact removes the stories it rules out, once.
 */
export function trackStories(motion: FlagMotion): StoryTracker {
  const paths = pathsFor(motion);
  let alive = Array.from({ length: paths.stories }, (_, story) => story);
  return {
    add(fact) {
      alive = alive.filter((story) => agrees(fact, positionOf(paths, story, fact.flagMoves)));
    },
    believe(now) {
      const chance = new Float64Array(SQUARE_COUNT);
      const positions = alive.map((story) => positionOf(paths, story, now));
      for (const square of positions) chance[square] = (chance[square] ?? 0) + 1;
      const candidates: Square[] = [];
      for (let square = 0; square < SQUARE_COUNT; square++) {
        if ((chance[square] ?? 0) > 0) candidates.push(square);
        chance[square] = (chance[square] ?? 0) / Math.max(1, positions.length);
      }
      return {
        chance,
        candidates,
        consistent: alive.length > 0,
        stories: positions.length,
        positions,
      };
    },
  };
}

/**
 * How many bits a check on `square` now is expected to tell about the flag, given the remaining
 * stories. `knownKind` is the square's kind if it has been checked before; otherwise the odds of
 * each kind are used. A check that may find the flag outright is worth its full entropy then.
 */
export function expectedInformation(
  belief: FlagBelief,
  square: Square,
  knownKind: 'bomb' | 'distance' | 'arrow' | null,
  odds: KindOdds = CARTRIDGE_ODDS,
): number {
  const total = belief.positions.length;
  if (total <= 1) return 0;
  const { distances, bearings } = pairTables();
  BY_DISTANCE.fill(0);
  BY_BEARING.fill(0);
  let onSquare = 0;
  const row = square * SQUARE_COUNT;
  for (const flag of belief.positions) {
    if (flag === square) {
      onSquare++;
      continue;
    }
    const distance = distances[row + flag] ?? 0;
    const bearing = bearings[row + flag] ?? 0;
    BY_DISTANCE[distance] = (BY_DISTANCE[distance] ?? 0) + 1;
    BY_BEARING[bearing] = (BY_BEARING[bearing] ?? 0) + 1;
  }
  const elsewhere = total - onSquare;
  if (elsewhere === 0) return Math.log2(total);
  const kinds: KindOdds =
    knownKind === null
      ? odds
      : {
          bomb: knownKind === 'bomb' ? 1 : 0,
          distance: knownKind === 'distance' ? 1 : 0,
          arrow: knownKind === 'arrow' ? 1 : 0,
        };
  const remaining =
    kinds.bomb * Math.log2(elsewhere) +
    kinds.distance * spread(BY_DISTANCE, elsewhere) +
    kinds.arrow * spread(BY_BEARING, elsewhere);
  return Math.log2(total) - (elsewhere / total) * remaining;
}

/** The entropy left on average once a reading splits `total` stories into these groups. */
function spread(groups: Int32Array, total: number): number {
  let sum = 0;
  for (const count of groups) if (count > 0) sum += (count / total) * Math.log2(count);
  return sum;
}

const BY_DISTANCE = new Int32Array(9);
const BY_BEARING = new Int32Array(8);
let PAIRS: { distances: Uint8Array; bearings: Uint8Array } | null = null;

/** King distances and bearing indexes for every pair of squares, worked out once. */
function pairTables(): { distances: Uint8Array; bearings: Uint8Array } {
  if (PAIRS) return PAIRS;
  const distances = new Uint8Array(SQUARE_COUNT * SQUARE_COUNT);
  const bearings = new Uint8Array(SQUARE_COUNT * SQUARE_COUNT);
  for (let from = 0; from < SQUARE_COUNT; from++) {
    for (let to = 0; to < SQUARE_COUNT; to++) {
      if (from === to) continue;
      distances[from * SQUARE_COUNT + to] = kingDistance(from, to);
      bearings[from * SQUARE_COUNT + to] = BEARINGS.indexOf(bearingTowards(from, to));
    }
  }
  PAIRS = { distances, bearings };
  return PAIRS;
}
