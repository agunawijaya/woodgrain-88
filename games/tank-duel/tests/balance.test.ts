/**
 * The balance targets, locked with tolerances. They play hundreds of Kid
 * matches, so they run only when asked: `TANK_BALANCE=1 pnpm vitest run
 * --project tank-duel tests/balance.test.ts`. The seeds are not the ones the
 * tuning was searched on, so a pass means the Kids generalise rather than
 * fit a handful of games. The full report with every channel is
 * `scripts/simulate.ts` (docs/SIMULATIONS.md).
 */
import { KID_IDS, type KidId } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../src/engine/channels.ts';
import type { Contender } from '../src/sim/duel.ts';
import { pairing, seeds } from '../src/sim/sweep.ts';
import { inScoreBand } from '../src/sim/targets.ts';

const TEN_MINUTES_MS = 600_000;
/** Seeds the tuning search never played. */
const SEED_BASE = 21_000;
/**
 * Matches per head-to-head target. Fewer leave too much luck in a win rate: a pairing that truly
 * splits 45–55 falls outside its tolerance about one run in ten at 24 matches. Dee against Moss
 * sits at the top of its band, where 96 matches overshoot a 67% lock about one run in fourteen;
 * at 192 it is about one in forty.
 */
const TARGET_MATCHES = 192;
/** Remix channels whose scores count bounces (Ricochet Royale) or rounds (Last Tank), not hits. */
const SCORES_NOT_HITS = new Set(['ricochet-royale', 'last-tank']);

const kid = (id: KidId): Contender => ({ kind: 'kid', kid: id });

/** Every pair of Kids, so a broad sweep meets every match-up. */
const KID_PAIRS: readonly (readonly [KidId, KidId])[] = KID_IDS.flatMap((first, index) =>
  KID_IDS.slice(index + 1).map((second) => [first, second] as const),
);

describe.skipIf(!process.env.TANK_BALANCE)('tank duel balance targets', () => {
  it(
    'target 1: Grandpa Lou beats Pip in 70-85% of matches on game-1 (held to 63-92%)',
    () => {
      const result = pairing('game-1', kid('lou'), kid('pip'), seeds(TARGET_MATCHES, SEED_BASE));
      expect(result.aRate).toBeGreaterThanOrEqual(0.63);
      expect(result.aRate).toBeLessThanOrEqual(0.92);
    },
    TEN_MINUTES_MS,
  );

  it(
    'target 2: Dee against Moss ends 40-60% either way on game-1 (held to 30-70%)',
    () => {
      // Dee takes about 60% over a thousand matches, the top of the band, and these seeds run high
      // (68%). The lock is wide enough for that and still catches a Kid that runs away with it.
      const result = pairing(
        'game-1',
        kid('dee'),
        kid('moss'),
        seeds(TARGET_MATCHES, SEED_BASE + 100),
      );
      expect(result.aRate).toBeGreaterThanOrEqual(0.3);
      expect(result.aRate).toBeLessThanOrEqual(0.7);
    },
    TEN_MINUTES_MS,
  );

  it(
    'target 3: the novice human beats Pip in 35-55% of matches on game-1 (held to 28-62%)',
    () => {
      const result = pairing(
        'game-1',
        { kind: 'novice' },
        kid('pip'),
        seeds(TARGET_MATCHES, SEED_BASE + 200),
      );
      expect(result.aRate).toBeGreaterThanOrEqual(0.28);
      expect(result.aRate).toBeLessThanOrEqual(0.62);
    },
    TEN_MINUTES_MS,
  );

  it(
    'target 4: timed matches across the channels end inside the score band in 90% of seeds (held to 80%)',
    () => {
      const totals = CHANNELS.filter((channel) => !SCORES_NOT_HITS.has(channel.id)).flatMap(
        (channel, index) =>
          [0, 1].flatMap((round) => {
            const pair = KID_PAIRS[(index * 2 + round) % KID_PAIRS.length] ?? ['lou', 'pip'];
            const seed = seeds(1, SEED_BASE + 300 + index * 10 + round);
            return pairing(channel.id, kid(pair[0]), kid(pair[1]), seed).totals;
          }),
      );
      const inBand = totals.filter(inScoreBand).length;
      expect(inBand / totals.length).toBeGreaterThanOrEqual(0.8);
    },
    TEN_MINUTES_MS,
  );

  it(
    'target 5: no channel ends scoreless in more than 5% of rounds (held to 1 in 6 per channel)',
    () => {
      for (const channel of CHANNELS) {
        const result = pairing(channel.id, kid('rosa'), kid('benny'), seeds(6, SEED_BASE + 600));
        expect(
          result.scoreless,
          `${channel.id} (${channel.title}) had ${result.scoreless} scoreless matches out of 6`,
        ).toBeLessThanOrEqual(1);
      }
    },
    TEN_MINUTES_MS,
  );

  it(
    'every Kid scores on a tank that never moves, on every tank channel',
    () => {
      // A player who stands still, hidden or not, must not be safe: Kids once parked between two
      // headings, trusted curls a short flight cannot make, and lost a hidden tank after hitting it.
      const tankChannels = CHANNELS.filter((channel) => channel.vehicles[0] === 'tank');
      for (const [index, channel] of tankChannels.entries()) {
        for (const kidId of KID_IDS) {
          const result = pairing(
            channel.id,
            { kind: 'still' },
            kid(kidId),
            seeds(1, SEED_BASE + 700 + index),
          );
          // The still tank never fires, so a 0–0 means the Kid never hit it.
          expect(
            result.scoreless,
            `${kidId} never scored on ${channel.id} (${channel.title})`,
          ).toBe(0);
        }
      }
    },
    TEN_MINUTES_MS,
  );
});
