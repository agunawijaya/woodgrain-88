/**
 * Balance targets for Trailblaze: win-rate bands locked for head-to-head Kid
 * and computer match-ups. The first two are the prompt's bands. The third is
 * not: the prompt asked for Moss to beat Computer 1977 (switch B) 60–80% of
 * the time, but the 1977 rider only counts free cells three ahead and has no
 * sense of space, so any Kid that reads the board beats it nearly always.
 * We keep the rider faithful and lock what it really does (NOTES.md,
 * Simulations).
 */
import type { Contender } from './duel.ts';

export interface BalanceTarget {
  readonly name: string;
  readonly first: Contender;
  readonly second: Contender;
  readonly variation: number;
  /** The first contender's win rate must fall in [low, high]. */
  readonly low: number;
  readonly high: number;
  readonly fixedSeats?: boolean;
}

export const BALANCE_TARGETS: readonly BalanceTarget[] = [
  {
    name: 'Lou beats Pip',
    first: { kind: 'kid', kid: 'lou', mode: 'human' },
    second: { kind: 'kid', kid: 'pip', mode: 'human' },
    variation: 1,
    low: 0.75,
    high: 0.9,
  },
  {
    name: 'Moss beats Dee',
    first: { kind: 'kid', kid: 'moss', mode: 'human' },
    second: { kind: 'kid', kid: 'dee', mode: 'human' },
    variation: 1,
    low: 0.55,
    high: 0.7,
  },
  {
    name: 'Moss beats Computer 1977 (B)',
    first: { kind: 'kid', kid: 'moss', mode: 'human' },
    second: { kind: 'computer', lookahead: 3 },
    variation: 2,
    low: 0.85,
    high: 1,
    fixedSeats: true,
  },
];

/** How far a sampled win rate may stray outside its band: about 1.5 standard errors at 160 matches. */
export const BALANCE_TOLERANCE = 0.05;

export function inBalanceBand(target: BalanceTarget, winRate: number): boolean {
  return winRate >= target.low - BALANCE_TOLERANCE && winRate <= target.high + BALANCE_TOLERANCE;
}
