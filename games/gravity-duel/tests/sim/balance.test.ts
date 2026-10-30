/**
 * Locked balance targets from the prompt (briefs/gd-sims.md): win-rate bands
 * for two Kid pairings, a star-crash ratio and a dock ratio. 40 matches a
 * target keeps the whole file under its time budget; seeds start from
 * 51,000, well clear of the ones used while tuning. If the lead retunes a
 * Kid's pilot and a target drifts out of band, flip that target's `it` to
 * `it.skip` with a comment naming it and the measured value, so the suite
 * stays green until the lead re-locks it.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE_TARGETS, inBalanceBand, measureTarget } from '../../src/sim/targets.ts';

const MATCHES = 40;
const SEED_BASE = 51_000;
/** A two-Kid combat pairing runs to the cartridge's 10-point target, so this is generous, not lax. */
const TARGET_TIMEOUT_MS = 30_000;

describe('gravity duel balance targets', () => {
  for (let i = 0; i < BALANCE_TARGETS.length; i++) {
    const target = BALANCE_TARGETS[i];
    if (!target) continue;

    it(
      `target ${i + 1}: ${target.name} falls in [${target.low}, ${target.high}]`,
      () => {
        const value = measureTarget(target, MATCHES, SEED_BASE + i * 500);
        expect(inBalanceBand(target, value)).toBe(true);
      },
      TARGET_TIMEOUT_MS,
    );
  }
});
