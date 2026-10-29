/**
 * Smoke tests for Trailblaze simulations: fast deterministic checks verifying
 * that Kids, Computer 1977 and idle contenders run to completion, resolve scores
 * accurately, and produce repeatable outcomes.
 */
import { describe, expect, it } from 'vitest';
import { playDuel, type DuelOptions } from '../../src/sim/duel.ts';

describe('trailblaze simulation smoke tests', () => {
  it('two Kid matches to 2 points finish with a winner or a tie and correct score sums', () => {
    for (const seed of [101, 102]) {
      const result = playDuel({
        variation: 1,
        seats: [
          { kind: 'kid', kid: 'lou', mode: 'human' },
          { kind: 'kid', kid: 'pip', mode: 'human' },
        ],
        target: 2,
        seed,
      });

      expect(result.finished).toBe(true);
      expect([0, 1, null]).toContain(result.winner);

      const totalScore = result.scores[0] + result.scores[1];
      expect(totalScore).toBeGreaterThanOrEqual(2);

      if (result.winner === 0) {
        expect(result.scores[0]).toBeGreaterThanOrEqual(2);
      } else if (result.winner === 1) {
        expect(result.scores[1]).toBeGreaterThanOrEqual(2);
      } else {
        expect(result.scores[0]).toBeGreaterThanOrEqual(2);
        expect(result.scores[1]).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('a Kid-against-idle match ends with the Kid winning', () => {
    const result = playDuel({
      variation: 1,
      seats: [{ kind: 'kid', kid: 'lou', mode: 'human' }, { kind: 'idle' }],
      target: 2,
      seed: 201,
    });

    expect(result.finished).toBe(true);
    expect(result.winner).toBe(0);
    expect(result.scores[0]).toBe(2);
    expect(result.scores[1]).toBe(0);
  });

  it('a computer-against-idle match in variation 2 runs and finishes', () => {
    const result = playDuel({
      variation: 2,
      seats: [{ kind: 'computer', lookahead: 3 }, { kind: 'idle' }],
      target: 2,
      seed: 301,
    });

    expect(result.finished).toBe(true);
    expect(result.winner).toBe(0);
    expect(result.scores[0]).toBe(2);
  });

  it('the same seed gives the same result', () => {
    const options: DuelOptions = {
      variation: 1,
      seats: [
        { kind: 'kid', kid: 'moss', mode: 'human' },
        { kind: 'kid', kid: 'dee', mode: 'human' },
      ],
      target: 2,
      seed: 401,
    };

    const first = playDuel(options);
    const second = playDuel(options);

    expect(first).toEqual(second);
  });
});
