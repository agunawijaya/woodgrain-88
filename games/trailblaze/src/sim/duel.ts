/**
 * Headless match runner for bot-vs-bot Trailblaze simulations.
 *
 * Runs full matches between Kids, Computer 1977 and idle seats,
 * stepping the fixed-tick engine and routing events to Kid reflexes.
 */
import type { KidId, MemoryMode, ReflexProfile, Seed, SwitchPosition } from '@woodgrain-88/kit';
import { createComputer1977, type Lookahead } from '../ai/computer-1977.ts';
import { createKidRider, type KidRider } from '../ai/kid.ts';
import { CARTRIDGE_TARGET, createMatch, startMatch, stepMatch } from '../engine/match.ts';
import { IDLE, type MatchSetup, type Seat, type StepPilot, type Stick } from '../engine/types.ts';
import { variationRules } from '../engine/variations.ts';

export type Contender =
  | {
      readonly kind: 'kid';
      readonly kid: KidId;
      readonly mode?: MemoryMode;
      readonly profile?: ReflexProfile;
    }
  | { readonly kind: 'computer'; readonly lookahead: Lookahead }
  | { readonly kind: 'idle' };

export interface DuelOptions {
  readonly variation: number;
  readonly seats: readonly [Contender, Contender];
  readonly target?: number; // default CARTRIDGE_TARGET
  readonly seed: Seed;
  /** Stop a match that runs this long (a safety net); counted as unfinished. */
  readonly maxTicks?: number; // default 50 * 60 * 30
}

export interface DuelResult {
  readonly winner: Seat | null; // null for a tie or an unfinished match
  readonly scores: readonly [number, number];
  readonly rounds: number;
  readonly ticks: number;
  readonly finished: boolean;
  /** Steps survived in each round, both riders together (the longest point played). */
  readonly longestRoundSteps: number;
}

export interface FourWayOptions {
  readonly seats: readonly Contender[];
  readonly seed: Seed;
  readonly target?: number; // default CARTRIDGE_TARGET
  /** Stop a match that runs this long (a safety net); counted as unfinished. */
  readonly maxTicks?: number; // default 50 * 60 * 30
}

export interface FourWayResult {
  readonly winner: Seat | null;
  readonly scores: readonly number[];
  readonly rounds: number;
  readonly ticks: number;
  readonly finished: boolean;
  readonly longestRoundSteps: number;
}

const DEFAULT_MAX_TICKS = 50 * 60 * 30; // 30 minutes at 50 Hz

/** Plays one full match headless at 50 ticks a second until a winner emerges or maxTicks is reached. */
export function playDuel(options: DuelOptions): DuelResult {
  const rules = variationRules(options.variation);
  const target = options.target ?? CARTRIDGE_TARGET;
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS;

  const c0 = options.seats[0];
  const c1 = options.seats[1];

  const pilot0: StepPilot | null = c0.kind === 'computer' ? createComputer1977(c0.lookahead) : null;
  const pilot1: StepPilot | null = c1.kind === 'computer' ? createComputer1977(c1.lookahead) : null;

  const switch0: SwitchPosition = c0.kind === 'computer' && c0.lookahead === 6 ? 'A' : 'B';
  const switch1: SwitchPosition = c1.kind === 'computer' && c1.lookahead === 6 ? 'A' : 'B';

  const setup: MatchSetup = {
    rules,
    players: 2,
    switches: [switch0, switch1],
    target,
    pilots: [pilot0, pilot1],
  };

  const match = createMatch(setup);

  const kid0: KidRider | null =
    c0.kind === 'kid'
      ? createKidRider({
          kid: c0.kid,
          seat: 0,
          mode: c0.mode ?? 'human',
          seed: `${options.seed}/kid0`,
          ...(c0.profile ? { profile: c0.profile } : {}),
        })
      : null;

  const kid1: KidRider | null =
    c1.kind === 'kid'
      ? createKidRider({
          kid: c1.kid,
          seat: 1,
          mode: c1.mode ?? 'human',
          seed: `${options.seed}/kid1`,
          ...(c1.profile ? { profile: c1.profile } : {}),
        })
      : null;

  const startEvents = startMatch(match);
  kid0?.hear(startEvents, match);
  kid1?.hear(startEvents, match);

  let longestRoundSteps = 0;

  while (match.phase !== 'over' && match.tick < maxTicks) {
    const s0: Stick = kid0 ? kid0.stick(match) : IDLE;
    const s1: Stick = kid1 ? kid1.stick(match) : IDLE;

    const events = stepMatch(match, [s0, s1]);
    kid0?.hear(events, match);
    kid1?.hear(events, match);

    if (match.steps > longestRoundSteps) {
      longestRoundSteps = match.steps;
    }
  }

  const finished = match.phase === 'over';
  const winner = finished ? match.winner : null;

  return {
    winner,
    scores: [match.riders[0]?.score ?? 0, match.riders[1]?.score ?? 0],
    rounds: match.round,
    ticks: match.tick,
    finished,
    longestRoundSteps,
  };
}

/** Plays a Four Way match between up to four contenders (Kids or idle seats). */
export function playFourWay(options: FourWayOptions): FourWayResult {
  if (options.seats.length !== 4) {
    throw new Error('Four Way requires exactly 4 seats');
  }
  for (const c of options.seats) {
    if (c.kind === 'computer') {
      throw new Error('Computer 1977 is not supported in Four Way');
    }
  }

  const rules = variationRules(1);
  const target = options.target ?? CARTRIDGE_TARGET;
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS;

  const setup: MatchSetup = {
    rules,
    players: 4,
    switches: ['B', 'B', 'B', 'B'],
    target,
  };

  const match = createMatch(setup);

  const kids: (KidRider | null)[] = options.seats.map((c, seat) => {
    if (c.kind === 'kid') {
      return createKidRider({
        kid: c.kid,
        seat: seat as Seat,
        mode: c.mode ?? 'human',
        seed: `${options.seed}/kid${seat}`,
        ...(c.profile ? { profile: c.profile } : {}),
      });
    }
    return null;
  });

  const startEvents = startMatch(match);
  for (const kid of kids) {
    kid?.hear(startEvents, match);
  }

  let longestRoundSteps = 0;

  while (match.phase !== 'over' && match.tick < maxTicks) {
    const sticks: Stick[] = kids.map((kid) => (kid ? kid.stick(match) : IDLE));
    const events = stepMatch(match, sticks);
    for (const kid of kids) {
      kid?.hear(events, match);
    }

    if (match.steps > longestRoundSteps) {
      longestRoundSteps = match.steps;
    }
  }

  const finished = match.phase === 'over';
  const winner = finished ? match.winner : null;

  return {
    winner,
    scores: match.riders.map((r) => r.score),
    rounds: match.round,
    ticks: match.tick,
    finished,
    longestRoundSteps,
  };
}
