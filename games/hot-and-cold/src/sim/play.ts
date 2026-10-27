/**
 * Plays whole matches headless, for the balance simulations and tests: the
 * engine ticks, each seat's player hears what happened and answers with what
 * it holds. Nothing here draws or makes a sound.
 */
import {
  createMatch,
  IDLE,
  startMatch,
  stepMatch,
  type MatchResult,
  type MatchSetup,
  type SeatInput,
} from '../engine/match.ts';
import type { KidPlayer } from '../ai/kid.ts';

export interface Played {
  readonly result: MatchResult | null;
  readonly ticks: number;
  /** Checks made by each seat over the whole match. */
  readonly checks: readonly [number, number];
}

/** A safety stop: no real match runs anywhere near this long. */
const MAX_TICKS = 400_000;

export function playMatch(
  setup: MatchSetup,
  players: readonly [KidPlayer | null, KidPlayer | null],
): Played {
  const match = createMatch(setup);
  let events = startMatch(match);
  while (!match.result && match.tick < MAX_TICKS) {
    for (const player of players) player?.hear(events, match);
    const inputs: [SeatInput, SeatInput] = [
      players[0]?.input(match) ?? IDLE,
      players[1]?.input(match) ?? IDLE,
    ];
    events = stepMatch(match, inputs);
  }
  for (const player of players) player?.hear(events, match);
  return {
    result: match.result,
    ticks: match.tick,
    checks: [match.seats[0].checks, match.seats[1].checks],
  };
}
