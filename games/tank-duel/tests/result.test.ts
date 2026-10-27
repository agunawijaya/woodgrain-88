/**
 * Tests for Tank Duel's result adapter: converting match engine outcomes,
 * scores, hits and channel rules into the kit's GameResult representation.
 */
import { describe, expect, it } from 'vitest';
import { emojiSummary } from '@woodgrain-88/kit';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld } from '../src/engine/match.ts';
import type { MatchEvent, MatchState } from '../src/engine/types.ts';
import { vec } from '../src/engine/vec.ts';
import {
  buildResult,
  emojiLine,
  scoreLabel,
  scoredPoints,
  type MatchSummary,
  type ScoredPoint,
} from '../src/session/result.ts';

function makeMatchState(overrides: Partial<MatchState> = {}): MatchState {
  const channel = overrides.channel ?? channelById('game-1');
  const world = createWorld(channel);
  const base = createMatch(
    channel,
    overrides.options ?? {
      scoring: 'timed',
      handicap: [false, false],
      wiring: false,
    },
    world,
  );
  return {
    ...base,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  const final =
    overrides.final ??
    makeMatchState({
      over: true,
      winner: 0,
      scores: [7, 4],
    });

  return {
    final,
    seats: overrides.seats ?? [
      { name: 'Seat 1', kid: null },
      { name: 'Moss', kid: 'moss' },
    ],
    points: overrides.points ?? [
      { side: 0, points: 1 },
      { side: 1, points: 1 },
      { side: 0, points: 1 },
    ],
    durationMs: overrides.durationMs ?? 45120.4,
    bestBank: overrides.bestBank ?? 0,
    ...overrides,
  };
}

describe('result', () => {
  describe('scoreLabel', () => {
    it('formats scores with seat 1 first separated by an en dash', () => {
      expect(scoreLabel([7, 4])).toBe('7–4');
      expect(scoreLabel([0, 10])).toBe('0–10');
      expect(scoreLabel([12, 12])).toBe('12–12');
    });
  });

  describe('scoredPoints', () => {
    it('keeps only hit events in original order and maps shooter to side', () => {
      const events: readonly MatchEvent[] = [
        {
          kind: 'fired',
          side: 0,
          at: vec(10, 10),
          direction: vec(1, 0),
          shot: 'straight',
        },
        {
          kind: 'hit',
          shooter: 0,
          victim: 1,
          vehicle: 1,
          at: vec(25, 10),
          direction: vec(1, 0),
          bounces: 0,
          points: 1,
          path: [vec(10, 10), vec(25, 10)],
        },
        {
          kind: 'bounced',
          side: 1,
          at: vec(30, 20),
          normal: vec(0, 1),
          bounces: 1,
          corner: false,
        },
        {
          kind: 'hit',
          shooter: 1,
          victim: 0,
          vehicle: 0,
          at: vec(15, 20),
          direction: vec(-1, 0),
          bounces: 1,
          points: 1,
          path: [vec(30, 20), vec(15, 20)],
        },
        {
          kind: 'hit',
          shooter: 0,
          victim: 1,
          vehicle: 1,
          at: vec(40, 30),
          direction: vec(0, 1),
          bounces: 3,
          points: 3,
          path: [vec(10, 10), vec(20, 20), vec(40, 30)],
        },
        {
          kind: 'match-over',
          winner: 0,
        },
      ];

      const scored = scoredPoints(events);

      expect(scored).toEqual([
        { side: 0, points: 1 },
        { side: 1, points: 1 },
        { side: 0, points: 3 },
      ]);
    });

    it('returns an empty array when events contain no hits', () => {
      const events: readonly MatchEvent[] = [
        {
          kind: 'fired',
          side: 0,
          at: vec(10, 10),
          direction: vec(1, 0),
          shot: 'straight',
        },
        {
          kind: 'warning',
        },
        {
          kind: 'match-over',
          winner: null,
        },
      ];

      expect(scoredPoints(events)).toEqual([]);
      expect(scoredPoints([])).toEqual([]);
    });
  });

  describe('emojiLine', () => {
    it('maps seat 1 hits to green squares and seat 2 hits to red squares in order', () => {
      const points: readonly ScoredPoint[] = [
        { side: 0, points: 1 },
        { side: 0, points: 1 },
        { side: 1, points: 1 },
        { side: 0, points: 1 },
      ];

      const line = emojiLine(points);

      expect(line).toBe('🟩🟩🟥🟩');
      expect(emojiSummary(line)).toEqual(['🟩', '🟩', '🟥', '🟩']);
    });

    it('enforces the last 12 rule when 15 hits occur by discarding early hits', () => {
      const points15: ScoredPoint[] = [
        { side: 1, points: 1 },
        { side: 1, points: 1 },
        { side: 1, points: 1 },
        ...Array.from({ length: 12 }, () => ({ side: 0 as const, points: 1 })),
      ];

      const line = emojiLine(points15);

      expect(line).toBe('🟩'.repeat(12));
      const summary = emojiSummary(line);
      expect(summary).not.toBeNull();
      expect(summary?.length).toBe(12);
    });

    it('represents a multi-point hit as exactly one square', () => {
      const multiPoints: readonly ScoredPoint[] = [
        { side: 0, points: 3 },
        { side: 1, points: 2 },
      ];

      const line = emojiLine(multiPoints);

      expect(line).toBe('🟩🟥');
      expect(emojiSummary(line)).toEqual(['🟩', '🟥']);
    });

    it('returns empty string when there are no points', () => {
      expect(emojiLine([])).toBe('');
    });
  });

  describe('buildResult', () => {
    it('sets won, winnerSeat, score and scoreLabel correctly for seat 1 win', () => {
      const final = makeMatchState({
        over: true,
        winner: 0,
        scores: [7, 4],
      });
      const summary = makeSummary({ final });

      const result = buildResult(summary);

      expect(result.won).toBe(true);
      expect(result.winnerSeat).toBe(1);
      expect(result.score).toBe(7);
      expect(result.scoreLabel).toBe('7–4');
      expect(result.presentation).toBe('game');
    });

    it('sets won, winnerSeat, score and scoreLabel correctly for seat 2 win', () => {
      const final = makeMatchState({
        over: true,
        winner: 1,
        scores: [3, 8],
      });
      const summary = makeSummary({ final });

      const result = buildResult(summary);

      expect(result.won).toBe(false);
      expect(result.winnerSeat).toBe(2);
      expect(result.score).toBe(3);
      expect(result.scoreLabel).toBe('3–8');
    });

    it('treats a draw as not won with null winnerSeat', () => {
      const final = makeMatchState({
        over: true,
        winner: null,
        scores: [5, 5],
      });
      const summary = makeSummary({ final });

      const result = buildResult(summary);

      expect(result.won).toBe(false);
      expect(result.winnerSeat).toBeNull();
      expect(result.score).toBe(5);
      expect(result.scoreLabel).toBe('5–5');
    });

    it('omits emoji property entirely when there are no hits', () => {
      const summary = makeSummary({ points: [] });

      const result = buildResult(summary);

      expect('emoji' in result).toBe(false);
      expect(result.emoji).toBeUndefined();
    });

    it('includes emoji property that passes emojiSummary when hits exist', () => {
      const summary = makeSummary({
        points: [
          { side: 0, points: 1 },
          { side: 1, points: 1 },
        ],
      });

      const result = buildResult(summary);

      expect(result.emoji).toBe('🟩🟥');
      const parsed = emojiSummary(result.emoji ?? '');
      expect(parsed).toEqual(['🟩', '🟥']);
    });

    it('orders details correctly and omits Best bank when bestBank is 0', () => {
      const channel = channelById('game-1');
      const final = makeMatchState({
        channel,
        options: { scoring: 'timed', handicap: [false, false], wiring: false },
        over: true,
        winner: 0,
        scores: [2, 1],
      });
      const summary = makeSummary({
        final,
        seats: [
          { name: 'Pilot 1', kid: null },
          { name: 'Lou', kid: 'lou' },
        ],
        bestBank: 0,
      });

      const result = buildResult(summary);

      expect(result.details).toEqual([
        { label: 'Opponent', value: 'Lou' },
        { label: 'Rule', value: 'Timed round' },
        { label: 'Channel', value: 'CH 01 · Guided · Sandbags' },
      ]);
    });

    it('includes Best bank with multiplication sign when bestBank is greater than 0', () => {
      const channel = channelById('game-7');
      const final = makeMatchState({
        channel,
        options: { scoring: 'first-to-10', handicap: [false, false], wiring: false },
        over: true,
        winner: 0,
        scores: [10, 6],
      });
      const summary = makeSummary({
        final,
        seats: [
          { name: 'Commander', kid: null },
          { name: 'Pip', kid: 'pip' },
        ],
        bestBank: 3,
      });

      const result = buildResult(summary);

      expect(result.details).toEqual([
        { label: 'Opponent', value: 'Pip' },
        { label: 'Rule', value: 'First to 10' },
        { label: 'Best bank', value: '×3' },
        { label: 'Channel', value: 'CH 07 · Bouncing · Open Field' },
      ]);
    });

    it('formats Last Tank rule label from roundsToWin', () => {
      const channel = channelById('last-tank');
      const final = makeMatchState({
        channel,
        options: { scoring: 'timed', handicap: [false, false], wiring: false },
        over: true,
        winner: 0,
        scores: [5, 2],
      });
      const summary = makeSummary({
        final,
        seats: [
          { name: 'Ace', kid: null },
          { name: 'Dee', kid: 'dee' },
        ],
        bestBank: 1,
      });

      const result = buildResult(summary);

      expect(result.details).toEqual([
        { label: 'Opponent', value: 'Dee' },
        { label: 'Rule', value: 'First to 5 rounds' },
        { label: 'Best bank', value: '×1' },
        { label: 'Channel', value: 'CH 31 · Last Tank' },
      ]);
    });

    it('rounds durationMs to a whole number', () => {
      const summaryFloat = makeSummary({ durationMs: 12345.67 });
      const summaryExact = makeSummary({ durationMs: 12345 });

      expect(buildResult(summaryFloat).durationMs).toBe(12346);
      expect(buildResult(summaryExact).durationMs).toBe(12345);
    });

    it('never mutates the summary or its nested structures', () => {
      const points = Object.freeze([{ side: 0 as const, points: 1 }]);
      const seats = Object.freeze([
        Object.freeze({ name: 'Seat 1', kid: null }),
        Object.freeze({ name: 'Rosa', kid: 'rosa' as const }),
      ] as const);
      const final = Object.freeze(
        makeMatchState({
          over: true,
          winner: 0,
          scores: [3, 1],
        }),
      );
      const summary: MatchSummary = Object.freeze({
        final,
        seats,
        points,
        durationMs: 20000,
        bestBank: 2,
      });

      expect(() => buildResult(summary)).not.toThrow();
    });
  });
});
