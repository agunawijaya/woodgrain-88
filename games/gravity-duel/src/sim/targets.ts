/**
 * Gravity Duel's balance targets as data, taken straight from the prompt
 * (briefs/gd-sims.md): two win-rate bands, two ratios between a pair of
 * Kids, and the perfect docker's own pass/fail check. `scripts/simulate.ts`
 * and `tests/sim/balance.test.ts` both read this list, so retuning the Kids
 * never means retyping a target.
 */
import type { SwitchPosition } from '@woodgrain-88/kit';
import { sweep, type ContenderAverages, type SweepResult } from './sweep.ts';
import type { Contender } from './duel.ts';

export type BalanceMeasure = 'win-rate' | 'star-crash-ratio' | 'dock-ratio';

export interface BalanceTarget {
  readonly name: string;
  readonly first: Contender;
  readonly second: Contender;
  readonly variation: number;
  readonly measure: BalanceMeasure;
  /** The measured value must be at least `low`; at most `high`, or unbounded above when it is Infinity. */
  readonly low: number;
  readonly high: number;
}

/** How far a sampled value may stray outside its band: sampling noise at a few hundred matches. */
export const BALANCE_TOLERANCE = 0.05;

export const BALANCE_TARGETS: readonly BalanceTarget[] = [
  {
    name: 'Lou beats Pip',
    first: { kind: 'kid', kid: 'lou' },
    second: { kind: 'kid', kid: 'pip' },
    variation: 1,
    measure: 'win-rate',
    low: 0.75,
    high: 0.9,
  },
  {
    name: 'Moss beats Dee',
    first: { kind: 'kid', kid: 'moss' },
    second: { kind: 'kid', kid: 'dee' },
    variation: 1,
    measure: 'win-rate',
    low: 0.55,
    high: 0.7,
  },
  {
    name: 'Dee swallowed more',
    first: { kind: 'kid', kid: 'dee' },
    second: { kind: 'kid', kid: 'moss' },
    variation: 4,
    measure: 'star-crash-ratio',
    low: 2.0,
    high: Infinity,
  },
  {
    name: 'Lou docks more than Pip',
    first: { kind: 'kid', kid: 'lou' },
    second: { kind: 'kid', kid: 'pip' },
    variation: 8,
    measure: 'dock-ratio',
    low: 1.5,
    high: Infinity,
  },
];

/** The perfect docker's own target: not a pairing, a single contender proving the docking rule. */
export interface PerfectDockerTarget {
  readonly name: string;
  readonly variation: number;
  readonly switchPosition: SwitchPosition;
  readonly target: number;
  readonly seeds: readonly number[];
}

export const PERFECT_DOCKER_TARGET: PerfectDockerTarget = {
  name: 'Perfect docker docks all',
  variation: 14,
  switchPosition: 'B',
  target: 10,
  seeds: Array.from({ length: 20 }, (_, index) => index + 1),
};

/** Divides two per-match averages into the ratio a target measures; never divides by zero. */
function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator === 0 ? 0 : Infinity;
  return numerator / denominator;
}

function perKid(averages: ContenderAverages, measure: BalanceMeasure): number {
  if (measure === 'star-crash-ratio') return averages.starCrashes;
  return averages.docks;
}

/** Runs a target's pairing and reduces it to the one number its band judges. */
export function measureTarget(target: BalanceTarget, matches: number, seedBase: number): number {
  const result: SweepResult = sweep(
    target.first,
    target.second,
    target.variation,
    matches,
    seedBase,
  );
  if (target.measure === 'win-rate') return result.winRate;
  return ratio(perKid(result.first, target.measure), perKid(result.second, target.measure));
}

export function inBalanceBand(target: BalanceTarget, value: number): boolean {
  const low = target.low - BALANCE_TOLERANCE;
  if (value < low) return false;
  if (target.high === Infinity) return true;
  return value <= target.high + BALANCE_TOLERANCE;
}
