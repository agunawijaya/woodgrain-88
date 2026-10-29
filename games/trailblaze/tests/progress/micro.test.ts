/**
 * Tests for Trailblaze micro-challenges: 45-second Power Cycle Run tasks,
 * schema validation against existing channels, and metric targets.
 */
import { validateMicroChallenges } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../src/channels.ts';
import { TRAILBLAZE_MICRO_CHALLENGES } from '../../src/progress/micro.ts';

describe('micro-challenges', () => {
  it('defines 4 micro-challenges all running for 45 seconds', () => {
    expect(TRAILBLAZE_MICRO_CHALLENGES).toHaveLength(4);

    for (const micro of TRAILBLAZE_MICRO_CHALLENGES) {
      expect(micro.seconds).toBe(45);
      expect(micro.title.length).toBeGreaterThan(0);
      expect(micro.title.length).toBeLessThanOrEqual(32);
      expect(micro.goal.trim().length).toBeGreaterThan(0);
      expect(micro.pass.target).toBeGreaterThan(0);
    }
  });

  it('validates without issues against existing Trailblaze channels', () => {
    const channelIds = CHANNELS.map((ch) => ch.def.id);
    const problems = validateMicroChallenges(TRAILBLAZE_MICRO_CHALLENGES, channelIds);
    expect(problems).toEqual([]);
  });

  it('binds each challenge to the expected channel and goal', () => {
    const topSpeed = TRAILBLAZE_MICRO_CHALLENGES.find((m) => m.id === 'top-speed-30');
    expect(topSpeed).toMatchObject({
      channel: 'game-3',
      pass: { metric: { kind: 'max', event: 'ride', field: 'topSpeedSeconds' }, target: 30 },
    });

    const trapDee = TRAILBLAZE_MICRO_CHALLENGES.find((m) => m.id === 'trap-dee');
    expect(trapDee).toMatchObject({
      channel: 'game-1',
      pass: { metric: { kind: 'sum', event: 'point-won', field: 'trappedDee' }, target: 1 },
    });

    const fill300 = TRAILBLAZE_MICRO_CHALLENGES.find((m) => m.id === 'fill-300');
    expect(fill300).toMatchObject({
      channel: 'game-1',
      pass: { metric: { kind: 'sum', event: 'solo-cells', field: 'cells' }, target: 300 },
    });

    const wrapPoint = TRAILBLAZE_MICRO_CHALLENGES.find((m) => m.id === 'wrap-point');
    expect(wrapPoint).toMatchObject({
      channel: 'game-8',
      pass: { metric: { kind: 'sum', event: 'point-won', field: 'wraparound' }, target: 1 },
    });
  });
});
