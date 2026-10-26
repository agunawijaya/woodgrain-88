/**
 * Unit tests for micro-challenge briefs, runtime evaluation, and manifest validation.
 */
import { describe, expect, it } from 'vitest';
import type { StampedEvent } from '../src/events.ts';
import {
  briefFor,
  MICRO_DEFAULT_SECONDS,
  type MicroChallengeDef,
  startMicro,
  validateMicroChallenges,
} from '../src/micro.ts';

const SPLAT_CHALLENGE: MicroChallengeDef = {
  id: 'quick-three',
  channel: 'open-field',
  title: 'Three Quick Splats',
  goal: 'Splat 3 tanks in Open Field',
  pass: {
    metric: { kind: 'count', event: 'splat' },
    target: 3,
  },
};

function makeEvent(partial: Partial<StampedEvent> & { type: string }, seq = 1): StampedEvent {
  return {
    game: partial.game ?? 'paint-tanks',
    mode: partial.mode ?? 'power-cycle-run',
    channel: partial.channel ?? 'open-field',
    at: partial.at ?? '2026-10-25T21:00:00.000Z',
    seq,
    type: partial.type,
    ...(partial.data !== undefined ? { data: partial.data } : {}),
  };
}

describe('briefFor and startMicro', () => {
  it('fills default seconds in briefFor and preserves explicit seconds', () => {
    expect(briefFor(SPLAT_CHALLENGE)).toEqual({
      id: 'quick-three',
      goal: 'Splat 3 tanks in Open Field',
      seconds: MICRO_DEFAULT_SECONDS,
    });

    expect(briefFor({ ...SPLAT_CHALLENGE, seconds: 30 }).seconds).toBe(30);
  });

  it('passes before timeout, ignores events from other channels, and ignores events after pass', () => {
    let nowMs = 1000;
    const run = startMicro('paint-tanks', SPLAT_CHALLENGE, () => nowMs);

    expect(run.state).toBe('running');
    expect(run.value).toBe(0);
    expect(run.remainingSeconds()).toBe(45);

    // Events from another channel or another game are ignored.
    run.handle(makeEvent({ type: 'splat', channel: 'billiard-walls' }, 1));
    run.handle(makeEvent({ type: 'splat', game: 'other-game' }, 2));
    expect(run.value).toBe(0);

    nowMs = 6000;
    run.handle(makeEvent({ type: 'splat' }, 3));
    nowMs = 11_000;
    run.handle(makeEvent({ type: 'splat' }, 4));
    expect(run.state).toBe('running');
    expect(run.value).toBe(2);
    expect(run.remainingSeconds()).toBe(35);

    nowMs = 19_000;
    run.handle(makeEvent({ type: 'splat' }, 5));
    expect(run.check()).toBe('passed');
    expect(run.state).toBe('passed');
    expect(run.value).toBe(3);

    // Further events after passing are ignored.
    nowMs = 21_000;
    run.handle(makeEvent({ type: 'splat' }, 6));
    expect(run.value).toBe(3);

    expect(run.finish()).toEqual({
      game: 'paint-tanks',
      challenge: 'quick-three',
      passed: true,
      score: 3,
      seconds: 18,
    });
  });

  it('fails at timeout, clamps remainingSeconds to 0, and caps result seconds at challenge length', () => {
    let nowMs = 0;
    const run = startMicro('paint-tanks', { ...SPLAT_CHALLENGE, seconds: 30 }, () => nowMs);

    nowMs = 10_000;
    run.handle(makeEvent({ type: 'splat' }, 1));
    expect(run.check()).toBe('running');

    nowMs = 35_000;
    expect(run.remainingSeconds()).toBe(0);
    expect(run.check()).toBe('failed');
    expect(run.state).toBe('failed');

    // Further events after failing are ignored.
    run.handle(makeEvent({ type: 'splat' }, 2));
    run.handle(makeEvent({ type: 'splat' }, 3));
    expect(run.value).toBe(1);

    expect(run.finish()).toEqual({
      game: 'paint-tanks',
      challenge: 'quick-three',
      passed: false,
      score: 1,
      seconds: 30,
    });
  });

  it('turns a still-running challenge into failed when abandoned via finish', () => {
    let nowMs = 5000;
    const sumChallenge: MicroChallengeDef = {
      id: 'score-burst',
      channel: 'open-field',
      title: 'Score Burst',
      goal: 'Earn 50 points',
      seconds: 40,
      pass: {
        metric: { kind: 'sum', event: 'scored', field: 'points' },
        target: 50,
      },
    };
    const run = startMicro('paint-tanks', sumChallenge, () => nowMs);

    nowMs = 17_000;
    run.handle(makeEvent({ type: 'scored', data: { points: 20 } }, 1));
    expect(run.state).toBe('running');

    const result = run.finish();
    expect(run.state).toBe('failed');
    expect(result).toEqual({
      game: 'paint-tanks',
      challenge: 'score-burst',
      passed: false,
      score: 20,
      seconds: 12,
    });
  });
});

describe('validateMicroChallenges', () => {
  it('accepts valid challenges and flags id, channel, seconds, target, title, and goal issues', () => {
    const valid = validateMicroChallenges([SPLAT_CHALLENGE], ['open-field', 'billiard-walls']);
    expect(valid).toEqual([]);

    const invalid: readonly MicroChallengeDef[] = [
      {
        id: 'Bad_Id',
        channel: 'open-field',
        title: 'Bad Id',
        goal: 'Splat 1 tank',
        pass: { metric: { kind: 'count', event: 'splat' }, target: 1 },
      },
      {
        id: 'dup-id',
        channel: 'missing-channel',
        title: 'Unknown Channel',
        goal: 'Splat 1 tank',
        seconds: 10,
        pass: { metric: { kind: 'count', event: 'splat' }, target: 1 },
      },
      {
        id: 'dup-id',
        channel: 'open-field',
        title: 'This Micro Challenge Title Exceeds Thirty Two Characters',
        goal: '   ',
        seconds: 120,
        pass: { metric: { kind: 'count', event: 'splat' }, target: 0 },
      },
    ];

    const problems = validateMicroChallenges(invalid, ['open-field']);
    expect(problems.length).toBeGreaterThanOrEqual(7);
  });
});
