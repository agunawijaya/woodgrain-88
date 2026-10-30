/**
 * Head-to-head sweeps for Gravity Duel simulations: plays many seeded matches
 * between two contenders, swapping which seat each one sits in every other
 * match so neither side is favoured by a starting spot, and totals up what
 * happened to each contender rather than to each seat.
 */
import type { SwitchPosition } from '@woodgrain-88/kit';
import type { Seat } from '../engine/types.ts';
import { simulate, type Contender, type SimResult } from './duel.ts';

export interface SweepOptions {
  readonly target?: number;
  readonly clockTicks?: number;
  readonly switches?: readonly [SwitchPosition, SwitchPosition];
}

/** One contender's counters, averaged over every match it played. */
export interface ContenderAverages {
  readonly starCrashes: number;
  readonly hits: number;
  readonly selfHits: number;
  readonly cloakBurnouts: number;
  readonly shotsFired: number;
  readonly docks: number;
}

export interface SweepResult {
  readonly matches: number;
  /** Share of matches the first contender won, with the seats swapped every other match. */
  readonly winRate: number;
  readonly draws: number;
  readonly first: ContenderAverages;
  readonly second: ContenderAverages;
}

interface Totals {
  starCrashes: number;
  hits: number;
  selfHits: number;
  cloakBurnouts: number;
  shotsFired: number;
  docks: number;
}

function emptyTotals(): Totals {
  return { starCrashes: 0, hits: 0, selfHits: 0, cloakBurnouts: 0, shotsFired: 0, docks: 0 };
}

function addSeat(totals: Totals, result: SimResult, seat: Seat): void {
  totals.starCrashes += result.starCrashes[seat];
  totals.hits += result.hits[seat];
  totals.selfHits += result.selfHits[seat];
  totals.cloakBurnouts += result.cloakBurnouts[seat];
  totals.shotsFired += result.shotsFired[seat];
  totals.docks += result.docks[seat];
}

function averageOf(totals: Totals, matches: number): ContenderAverages {
  if (matches === 0) return emptyTotals();
  return {
    starCrashes: totals.starCrashes / matches,
    hits: totals.hits / matches,
    selfHits: totals.selfHits / matches,
    cloakBurnouts: totals.cloakBurnouts / matches,
    shotsFired: totals.shotsFired / matches,
    docks: totals.docks / matches,
  };
}

/** Plays `matches` consecutive duels between two contenders, alternating which one sits in seat 0. */
export function sweep(
  first: Contender,
  second: Contender,
  variation: number,
  matches: number,
  seedBase: number,
  extra?: SweepOptions,
): SweepResult {
  let firstWins = 0;
  let draws = 0;
  const firstTotals = emptyTotals();
  const secondTotals = emptyTotals();

  for (let i = 0; i < matches; i++) {
    const swapped = i % 2 === 1;
    const seats: readonly [Contender, Contender] = swapped ? [second, first] : [first, second];
    const firstSeat: Seat = swapped ? 1 : 0;
    const secondSeat: Seat = swapped ? 0 : 1;

    const result = simulate({
      variation,
      seats,
      seed: seedBase + i,
      ...(extra?.target !== undefined ? { target: extra.target } : {}),
      ...(extra?.clockTicks !== undefined ? { clockTicks: extra.clockTicks } : {}),
      ...(extra?.switches !== undefined ? { switches: extra.switches } : {}),
    });

    if (result.winner === null) draws += 1;
    else if (result.winner === firstSeat) firstWins += 1;

    addSeat(firstTotals, result, firstSeat);
    addSeat(secondTotals, result, secondSeat);
  }

  return {
    matches,
    winRate: matches > 0 ? firstWins / matches : 0,
    draws,
    first: averageOf(firstTotals, matches),
    second: averageOf(secondTotals, matches),
  };
}
