/**
 * Determinism and smoke checks for `simulate`: the same options must replay
 * bit-for-bit, and a Kid against an idle seat (or an idle-versus-idle match)
 * must finish sensibly without ever touching the wall clock.
 */
import { describe, expect, it } from 'vitest';
import { simulate, type SimOptions } from '../../src/sim/duel.ts';

describe('simulate', () => {
  it('replays identically for the same options', () => {
    const options: SimOptions = {
      variation: 1,
      seats: [
        { kind: 'kid', kid: 'lou', mode: 'human' },
        { kind: 'kid', kid: 'pip', mode: 'human' },
      ],
      seed: 'determinism-check',
      target: 3,
    };

    const first = simulate(options);
    const second = simulate(options);

    expect(first).toEqual(second);
  });

  it('a Kid never loses to an idle rival', () => {
    // An idle rival never fires, so it can never score; but it also never
    // feeds the mutual reload (NOTES.md, Missiles), so a Kid that burns
    // through its 8 missiles without a hit can run dry and never reach the
    // target at all. The only safe invariant against a stick nobody holds
    // is that the idle seat stays at zero.
    for (const seed of [1, 2, 3]) {
      const result = simulate({
        variation: 1,
        seats: [{ kind: 'kid', kid: 'lou', mode: 'human' }, { kind: 'idle' }],
        seed,
        target: 2,
      });

      expect(result.winner).not.toBe(1);
      expect(result.scores[1]).toBe(0);
    }
  });

  it('two idle seats run out the clock with a drawn score', () => {
    const result = simulate({
      variation: 1,
      seats: [{ kind: 'idle' }, { kind: 'idle' }],
      seed: 7,
      clockTicks: 200,
    });

    expect(result.reason).toBe('clock');
    expect(result.winner).toBeNull();
    expect(result.scores).toEqual([0, 0]);
    expect(result.ticks).toBe(200);
  });
});
