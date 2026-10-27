/**
 * Tests for the Tank Duel simulation runner: single duels, seed determinism,
 * pairings and scripted novice human behaviour.
 */
import { describe, expect, it } from 'vitest';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld, stepMatch } from '../src/engine/match.ts';
import { NO_INPUT } from '../src/engine/types.ts';
import { createRng } from '@woodgrain-88/kit';
import { playDuel, type Contender } from '../src/sim/duel.ts';
import { createNovice } from '../src/sim/novice.ts';
import { pairing } from '../src/sim/sweep.ts';

describe('simulation runner', () => {
  it('finishes playDuel within maxSeconds on game-5 and produces deterministic outcomes for the same seed', () => {
    const contenders: readonly [Contender, Contender] = [
      { kind: 'kid', kid: 'dee' },
      { kind: 'kid', kid: 'moss' },
    ];
    const outcome1 = playDuel('game-5', contenders, 42, { maxSeconds: 30 });
    const outcome2 = playDuel('game-5', contenders, 42, { maxSeconds: 30 });

    expect(outcome1.channel).toBe('game-5');
    expect(outcome1.seed).toBe(42);
    expect(outcome1.seconds).toBeLessThanOrEqual(30.1);
    expect(outcome1.seconds).toBeGreaterThan(0);
    expect(outcome1).toEqual(outcome2);
  });

  it('swaps sides by seed index in pairing and counts draws and scoreless matches correctly', () => {
    const a: Contender = { kind: 'kid', kid: 'pip' };
    const b: Contender = { kind: 'kid', kid: 'lou' };

    // With a tiny maxSeconds limit, neither tank has time to score, ensuring 0-0 draws.
    const result = pairing('game-5', a, b, [10, 11], { maxSeconds: 0.05 });

    expect(result.matches).toBe(2);
    expect(result.scoreless).toBe(2);
    expect(result.draws).toBe(2);
    expect(result.aRate).toBe(0.5);
    expect(result.totals).toEqual([0, 0]);
  });

  it('fires at an opponent dead ahead on the Open Field within 2 s, and never fires while its shell is in the air', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);
    const rng = createRng(12345);
    const novice = createNovice(0, channel, world, rng);

    // Setup Open Field match with the opponent directly dead ahead on the horizontal line.
    let state = createMatch(
      channel,
      { scoring: 'timed', handicap: [false, false], wiring: false },
      world,
    );
    const leader0 = state.vehicles.find((v) => v.side === 0 && v.slot === 0);
    const leader1 = state.vehicles.find((v) => v.side === 1 && v.slot === 0);
    if (!leader0 || !leader1) {
      throw new Error('Expected both leader vehicles to exist on spawn');
    }

    state = {
      ...state,
      vehicles: [
        { ...leader0, position: { x: 10, y: 20 }, heading: 0 },
        { ...leader1, position: { x: 30, y: 20 }, heading: 8 },
      ],
    };

    const dt = 1 / 60;
    let firedWithin2s = false;
    let firedWithShellInAir = false;

    for (let frame = 0; frame < 120; frame++) {
      const input0 = novice.think(state, world, dt);
      const hasLiveShell = state.shells[0] !== null;

      if (input0.fire) {
        if (state.time <= 2.0) {
          firedWithin2s = true;
        }
        if (hasLiveShell) {
          firedWithShellInAir = true;
        }
      }

      const step = stepMatch(state, [input0, NO_INPUT], dt, world);
      state = step.state;
    }

    expect(firedWithin2s).toBe(true);
    expect(firedWithShellInAir).toBe(false);
  });
});
