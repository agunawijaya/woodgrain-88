/**
 * Headless match runner for bot-vs-bot Tank Duel simulations.
 *
 * Runs a complete duel at 60 steps per second with seeded pseudorandomness,
 * supports Kid commanders, the scripted novice and a tank left standing, and
 * records scores, hits, bank bounces and match duration.
 */
import { createRng, type KidId, type Rng } from '@woodgrain-88/kit';
import type { DuelTuning } from '../ai/tuning.ts';
import { createCommander } from '../ai/commander.ts';
import { channelById } from '../engine/channels.ts';
import { createMatch, createWorld, stepMatch, type MatchWorld } from '../engine/match.ts';
import {
  NO_INPUT,
  type ChannelRules,
  type MatchOptions,
  type ScoringRule,
  type Side,
} from '../engine/types.ts';
import { createNovice, type Player } from './novice.ts';

/** Who plays a seat: a Kid, the scripted novice, or nobody at all (a tank that never moves). */
export type Contender =
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'novice' }
  | { readonly kind: 'still' };

/** A seat nobody touches: the stick stays centred and the tank stands where it spawned. */
const STILL: Player = { think: () => NO_INPUT };

function playerFor(
  contender: Contender,
  side: Side,
  channel: ChannelRules,
  world: MatchWorld,
  rng: Rng,
  tuning: DuelTuning | undefined,
): Player {
  switch (contender.kind) {
    case 'kid':
      return createCommander(contender.kid, side, channel, world, rng, tuning);
    case 'novice':
      return createNovice(side, channel, world, rng, tuning);
    case 'still':
      return STILL;
  }
}

export interface DuelOutcome {
  readonly channel: string;
  readonly seed: number;
  readonly scores: readonly [number, number];
  readonly winner: Side | null;
  readonly seconds: number;
  readonly hits: number;
  /** Scoring hits that had bounced at least once. */
  readonly bankHits: number;
}

export interface DuelOptions {
  readonly scoring?: ScoringRule;
  /** Stop early (a safety net for tests); the match counts as finished on points. */
  readonly maxSeconds?: number;
  /** The Kids' handling, when a simulation is trying out a retune. */
  readonly tuning?: DuelTuning;
  /** Plays with the Reverse gear setting on, to check it keeps the balance. */
  readonly reverseGear?: boolean;
  /** Plays with the Own ricochets setting on, to check it keeps the balance. */
  readonly ownRicochets?: boolean;
}

const STEP_DT = 1 / 60;

/** Plays one whole match headless at 60 steps a second. */
export function playDuel(
  channelId: string,
  contenders: readonly [Contender, Contender],
  seed: number,
  options?: DuelOptions,
): DuelOutcome {
  const channel = channelById(channelId);
  const world = createWorld(channel);

  const scoring: ScoringRule = options?.scoring ?? 'timed';
  const matchOptions: MatchOptions = {
    scoring,
    handicap: [false, false],
    wiring: false,
    reverseGear: options?.reverseGear ?? false,
    ownRicochets: options?.ownRicochets ?? false,
  };

  let state = createMatch(channel, matchOptions, world);

  const rootRng = createRng(seed);
  const rng0 = rootRng.fork('seat-0');
  const rng1 = rootRng.fork('seat-1');

  const player0 = playerFor(contenders[0], 0, channel, world, rng0, options?.tuning);
  const player1 = playerFor(contenders[1], 1, channel, world, rng1, options?.tuning);

  let hits = 0;
  let bankHits = 0;
  const maxSeconds = options?.maxSeconds;

  while (!state.over) {
    if (maxSeconds !== undefined && state.time >= maxSeconds - 1e-9) {
      break;
    }

    const input0 = player0.think(state, world, STEP_DT);
    const input1 = player1.think(state, world, STEP_DT);

    const step = stepMatch(state, [input0, input1], STEP_DT, world);
    state = step.state;

    for (const event of step.events) {
      if (event.kind === 'hit') {
        hits++;
        if (event.bounces >= 1) {
          bankHits++;
        }
      }
    }
  }

  let winner: Side | null = state.winner;
  if (!state.over && maxSeconds !== undefined && state.time >= maxSeconds - 1e-9) {
    if (state.scores[0] > state.scores[1]) {
      winner = 0;
    } else if (state.scores[1] > state.scores[0]) {
      winner = 1;
    } else {
      winner = null;
    }
  }

  return {
    channel: channel.id,
    seed,
    scores: state.scores,
    winner,
    seconds: state.time,
    hits,
    bankHits,
  };
}
