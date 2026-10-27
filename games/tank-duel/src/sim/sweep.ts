/**
 * Pairings for Tank Duel balance work: one contender against another over a
 * list of seeds, swapping sides every match so neither spawn favours anyone.
 */
import { playDuel, type Contender, type DuelOptions } from './duel.ts';

export interface PairingResult {
  readonly channel: string;
  readonly a: Contender;
  readonly b: Contender;
  readonly matches: number;
  /** Contender a's share: wins plus half the draws, over matches. */
  readonly aRate: number;
  readonly draws: number;
  /** Matches that ended 0–0. */
  readonly scoreless: number;
  /** Combined score of each match, in order. */
  readonly totals: readonly number[];
  readonly bankHits: number;
}

/** Seeds 1..count, or any stable list; used everywhere so reports are reproducible. */
export function seeds(count: number, offset = 0): number[] {
  const list: number[] = [];
  for (let i = 0; i < count; i++) {
    list.push(offset + i + 1);
  }
  return list;
}

/** Plays `seeds.length` matches; even-indexed seeds put a on side 0, odd ones on side 1. */
export function pairing(
  channelId: string,
  a: Contender,
  b: Contender,
  seedList: readonly number[],
  options?: DuelOptions,
): PairingResult {
  let aScoreShare = 0;
  let draws = 0;
  let scoreless = 0;
  let totalBankHits = 0;
  const totals: number[] = [];

  for (let index = 0; index < seedList.length; index++) {
    const seed = seedList[index];
    if (seed === undefined) {
      continue;
    }

    const aSide = index % 2 === 0 ? 0 : 1;
    const contenders: readonly [Contender, Contender] = aSide === 0 ? [a, b] : [b, a];

    const outcome = playDuel(channelId, contenders, seed, options);

    if (outcome.winner === aSide) {
      aScoreShare += 1;
    } else if (outcome.winner === null) {
      draws++;
      aScoreShare += 0.5;
    }

    const matchTotal = outcome.scores[0] + outcome.scores[1];
    totals.push(matchTotal);

    if (outcome.scores[0] === 0 && outcome.scores[1] === 0) {
      scoreless++;
    }

    totalBankHits += outcome.bankHits;
  }

  const matches = seedList.length;
  const aRate = matches > 0 ? aScoreShare / matches : 0;

  return {
    channel: channelId,
    a,
    b,
    matches,
    aRate,
    draws,
    scoreless,
    totals,
    bankHits: totalBankHits,
  };
}
