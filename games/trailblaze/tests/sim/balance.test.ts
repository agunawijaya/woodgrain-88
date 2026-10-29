/**
 * Locked balance targets and speed-up comparisons for Trailblaze.
 *
 * These run hundreds of Kid and computer matches, so they run only when asked:
 * `TRAILBLAZE_BALANCE=1 pnpm vitest run --project trailblaze tests/sim/balance.test.ts`.
 *
 * Seeds start from 31,000 upward (unseen during tuning). Bands allow
 * BALANCE_TOLERANCE either side for sampling noise.
 */
import { describe, expect, it } from 'vitest';
import { pairing } from '../../src/sim/sweep.ts';
import { BALANCE_TARGETS, inBalanceBand } from '../../src/sim/targets.ts';

const TEN_MINUTES_MS = 600_000;
const MATCHES = 160;
const SEED_BASE = 31_000;

describe.skipIf(!process.env.TRAILBLAZE_BALANCE)('trailblaze balance targets', () => {
  for (let i = 0; i < BALANCE_TARGETS.length; i++) {
    const target = BALANCE_TARGETS[i];
    if (!target) continue;

    it(
      `target ${i + 1}: ${target.name} falls in [${target.low}, ${target.high}]`,
      () => {
        const seedBase = SEED_BASE + i * 200;
        const result = pairing(
          target.first,
          target.second,
          target.variation,
          MATCHES,
          seedBase,
          target.fixedSeats ? { fixedSeats: true } : {},
        );

        expect(inBalanceBand(target, result.winRate)).toBe(true);
      },
      TEN_MINUTES_MS,
    );
  }

  it(
    "Dee's win rate against Moss in variation 3 is at least 0.08 above her rate in variation 1",
    () => {
      const dee = { kind: 'kid' as const, kid: 'dee' as const, mode: 'human' as const };
      const moss = { kind: 'kid' as const, kid: 'moss' as const, mode: 'human' as const };

      const var1 = pairing(dee, moss, 1, MATCHES, SEED_BASE + 600);
      const var3 = pairing(dee, moss, 3, MATCHES, SEED_BASE + 800);

      expect(var3.winRate - var1.winRate).toBeGreaterThanOrEqual(0.08);
    },
    TEN_MINUTES_MS,
  );

  it(
    "Lou's win rate against Pip in variation 3 is below his rate in variation 1",
    () => {
      const lou = { kind: 'kid' as const, kid: 'lou' as const, mode: 'human' as const };
      const pip = { kind: 'kid' as const, kid: 'pip' as const, mode: 'human' as const };

      const var1 = pairing(lou, pip, 1, MATCHES, SEED_BASE + 1000);
      const var3 = pairing(lou, pip, 3, MATCHES, SEED_BASE + 1200);

      expect(var3.winRate).toBeLessThan(var1.winRate);
    },
    TEN_MINUTES_MS,
  );
});
