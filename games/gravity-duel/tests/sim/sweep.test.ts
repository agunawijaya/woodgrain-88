/**
 * Seat-swapping in `sweep`: a contender that always wins from either seat
 * must still show up as winning regardless of which seat it starts the
 * match in, and the totals must be attributed to the contender, not the
 * seat it happened to be sitting in that match.
 */
import { describe, expect, it } from 'vitest';
import { sweep } from '../../src/sim/sweep.ts';

describe('sweep', () => {
  it('swaps seats every other match and still credits the stronger contender', () => {
    const lou = { kind: 'kid' as const, kid: 'lou' as const, mode: 'human' as const };
    const idle = { kind: 'idle' as const };

    const result = sweep(lou, idle, 1, 6, 1000, { target: 2 });

    expect(result.matches).toBe(6);
    expect(result.winRate).toBe(1);
    expect(result.draws).toBe(0);
    // Lou's own shots land on the idle rival in every match, seat or no seat.
    expect(result.first.hits).toBeGreaterThan(0);
    expect(result.second.hits).toBe(0);
  });

  it('swapping the same two contenders gives the mirrored win rate', () => {
    const lou = { kind: 'kid' as const, kid: 'lou' as const, mode: 'human' as const };
    const idle = { kind: 'idle' as const };

    const louFirst = sweep(lou, idle, 1, 6, 2000, { target: 2 });
    const idleFirst = sweep(idle, lou, 1, 6, 2000, { target: 2 });

    expect(louFirst.winRate).toBe(1);
    expect(idleFirst.winRate).toBe(0);
  });
});
