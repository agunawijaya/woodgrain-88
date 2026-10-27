/**
 * Hot & Cold's balance targets, locked with some room for chance. The solver
 * and field checks are quick and always run. The Kid-against-Kid races play
 * thousands of matches, so they run only when asked:
 * `HC_BALANCE=1 pnpm vitest run --project hot-and-cold games/hot-and-cold/tests/balance.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { cartridgeRules, shortened } from '../src/engine/rules.ts';
import { duel, huntChecks, median, solveField, type Hunter } from '../src/sim/measure.ts';

describe('every field can be solved', () => {
  for (const motion of ['still', 'bounce', 'wrap'] as const) {
    it(`never loses the flag and finds it well within 75 checks (${motion} flag, 3,000 fields)`, () => {
      for (let field = 0; field < 3000; field++) {
        const checks = solveField(`balance/${motion}/${field}`, motion);
        expect(checks, `field ${field}`).toBeGreaterThan(0);
        expect(checks, `field ${field}`).toBeLessThanOrEqual(30);
      }
    });
  }
});

describe('hunting alone', () => {
  const hunts = (hunter: Hunter) =>
    Array.from({ length: 200 }, (_, hunt) =>
      huntChecks(cartridgeRules(5), `balance-hunt/${hunt}`, hunter),
    );
  const perfect = hunts({ kid: 'lou', memory: 'sharp', clues: 'notebook', perfect: true });

  it('takes the perfect hunter a median of 4 to 8 checks on a still flag', () => {
    expect(median(perfect)).toBeGreaterThanOrEqual(4);
    expect(median(perfect)).toBeLessThanOrEqual(8);
  });

  it('costs Lou in Classic Memory at most 2 checks more than perfect, at the median', () => {
    const lou = hunts({ kid: 'lou', memory: 'human', clues: 'classic' });
    expect(median(lou)).toBeLessThanOrEqual(median(perfect) + 2);
  });
});

describe.skipIf(!process.env.HC_BALANCE)(
  'the Kids in the race (variation 1, Classic Memory)',
  () => {
    const race = shortened(cartridgeRules(1));

    it('lets Lou beat Pip in 75–90% of races to 5 (locked at 72–93% over 900)', () => {
      const record = duel(race, 'lou', 'pip', 'classic', 900, 'locked');
      const share = record.firstWins / record.matches;
      expect(share).toBeGreaterThanOrEqual(0.72);
      expect(share).toBeLessThanOrEqual(0.93);
    }, 120_000);

    it('lets Moss beat Dee in 50–70% of races to 5 (locked at 47–73% over 900)', () => {
      const record = duel(race, 'moss', 'dee', 'classic', 900, 'locked');
      const share = record.firstWins / record.matches;
      expect(share).toBeGreaterThanOrEqual(0.47);
      expect(share).toBeLessThanOrEqual(0.73);
    }, 120_000);
  },
);
