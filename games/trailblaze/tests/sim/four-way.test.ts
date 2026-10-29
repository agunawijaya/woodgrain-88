/**
 * Simulation tests for Four Way bot matches:
 * - Rejection of Computer 1977
 * - Exactly 4 seats required
 * - Full Four Way match simulation between 4 Kids
 */
import { describe, expect, it } from 'vitest';
import { playFourWay } from '../../src/sim/duel.ts';

describe('playFourWay', () => {
  it('throws when seat count is not exactly 4', () => {
    expect(() =>
      playFourWay({
        seats: [{ kind: 'idle' }, { kind: 'idle' }],
        seed: 123,
      }),
    ).toThrow('Four Way requires exactly 4 seats');
  });

  it('throws when any contender is Computer 1977', () => {
    expect(() =>
      playFourWay({
        seats: [
          { kind: 'kid', kid: 'pip' },
          { kind: 'computer', lookahead: 3 },
          { kind: 'idle' },
          { kind: 'idle' },
        ],
        seed: 456,
      }),
    ).toThrow('Computer 1977 is not supported in Four Way');
  });

  it('runs a headless Four Way match between 4 Kids to target score 2', () => {
    const result = playFourWay({
      seats: [
        { kind: 'kid', kid: 'pip' },
        { kind: 'kid', kid: 'dee' },
        { kind: 'kid', kid: 'lou' },
        { kind: 'kid', kid: 'rosa' },
      ],
      seed: 98765,
      target: 2,
    });

    expect(result.finished).toBe(true);
    expect(result.scores).toHaveLength(4);
    expect(result.winner).not.toBeNull();
    const winningScore = result.winner !== null ? result.scores[result.winner] : 0;
    expect(winningScore).toBeGreaterThanOrEqual(2);
    expect(result.rounds).toBeGreaterThanOrEqual(2);
    expect(result.ticks).toBeGreaterThan(0);
    expect(result.longestRoundSteps).toBeGreaterThan(0);
  });
});
