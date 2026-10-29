/**
 * Head-to-head pairings for Trailblaze simulations: pits one contender against
 * another across a series of seeded matches, alternating seats to eliminate
 * spawn bias, and measuring the first contender's win rate.
 */
import type { Seat } from '../engine/types.ts';
import { playDuel, type Contender } from './duel.ts';

export interface PairingResult {
  readonly matches: number;
  /** Share of matches the first contender won, with the seats swapped every other match. */
  readonly winRate: number;
  readonly ties: number;
  readonly unfinished: number;
  readonly totalRounds?: number;
  readonly totalTicks?: number;
}

export interface PairingOptions {
  /** When true, seats are not alternated (e.g. computer stays on seat 0 in variation 2). */
  readonly fixedSeats?: boolean;
  readonly target?: number;
  readonly maxTicks?: number;
}

/** Plays `matches` consecutive duels between two contenders, alternating seats or keeping them fixed. */
export function pairing(
  first: Contender,
  second: Contender,
  variation: number,
  matches: number,
  seedBase: number,
  options?: PairingOptions,
): PairingResult {
  let firstWins = 0;
  let ties = 0;
  let unfinished = 0;
  let totalRounds = 0;
  let totalTicks = 0;

  const fixed =
    options?.fixedSeats ??
    (variation === 2 && (second.kind === 'computer' || first.kind === 'computer'));

  for (let i = 0; i < matches; i++) {
    const seed = seedBase + i;

    let firstSeat: Seat;
    let seats: readonly [Contender, Contender];

    if (fixed) {
      if (second.kind === 'computer') {
        firstSeat = 1;
        seats = [second, first];
      } else {
        firstSeat = 0;
        seats = [first, second];
      }
    } else {
      if (i % 2 === 0) {
        firstSeat = 0;
        seats = [first, second];
      } else {
        firstSeat = 1;
        seats = [second, first];
      }
    }

    const outcome = playDuel({
      variation,
      seats,
      seed,
      ...(options?.target !== undefined ? { target: options.target } : {}),
      ...(options?.maxTicks !== undefined ? { maxTicks: options.maxTicks } : {}),
    });

    totalRounds += outcome.rounds;
    totalTicks += outcome.ticks;

    if (!outcome.finished) {
      unfinished += 1;
    } else if (outcome.winner === firstSeat) {
      firstWins += 1;
    } else if (outcome.winner === null) {
      ties += 1;
      firstWins += 0.5;
    }
  }

  const winRate = matches > 0 ? firstWins / matches : 0;

  return {
    matches,
    winRate,
    ties,
    unfinished,
    totalRounds,
    totalTicks,
  };
}
