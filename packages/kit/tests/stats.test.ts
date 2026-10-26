/**
 * Tests for per-game play statistics, score bests, versus seat wins and
 * collection-wide totals.
 */
import { describe, expect, it } from 'vitest';
import { createStatsBook } from '../src/stats.ts';
import type { StatsData } from '../src/store/types.ts';
import { memoryRepo } from './helpers/memory-repo.ts';

describe('stats book', () => {
  it('returns zeroed stats with null best and lastPlayedAt for an unplayed game', () => {
    const repo = memoryRepo<StatsData>({ games: {} });
    const book = createStatsBook(repo, () => new Date('2026-10-25T12:00:00.000Z'));

    expect(book.game('paint-tanks')).toEqual({
      plays: 0,
      best: null,
      timePlayedMs: 0,
      lastPlayedAt: null,
      versusWins: { 1: 0, 2: 0 },
    });
    expect(book.totals()).toEqual({
      plays: 0,
      timePlayedMs: 0,
      gamesPlayed: 0,
      lastPlayedAt: null,
      versusMatches: 0,
    });
  });

  it('records plays, clamps negative or non-finite durations to 0, and updates best by order', () => {
    let clock = new Date('2026-10-25T10:00:00.000Z');
    const repo = memoryRepo<StatsData>({ games: {} });
    const book = createStatsBook(repo, () => clock);

    const first = book.recordPlay('paint-tanks', {
      durationMs: 45_000,
      score: 120,
      order: 'higher',
    });
    expect(first).toEqual({
      plays: 1,
      best: 120,
      timePlayedMs: 45_000,
      lastPlayedAt: '2026-10-25T10:00:00.000Z',
      versusWins: { 1: 0, 2: 0 },
    });

    clock = new Date('2026-10-25T11:00:00.000Z');
    book.recordPlay('paint-tanks', {
      durationMs: -500,
      score: 90,
      order: 'higher',
      versusWinner: 1,
    });
    clock = new Date('2026-10-25T12:00:00.000Z');
    book.recordPlay('paint-tanks', {
      durationMs: Number.NaN,
      score: 180,
      order: 'higher',
      versusWinner: 2,
    });
    clock = new Date('2026-10-25T13:00:00.000Z');
    const afterFour = book.recordPlay('paint-tanks', {
      durationMs: Number.POSITIVE_INFINITY,
      order: 'higher',
      versusWinner: 1,
    });

    expect(afterFour).toEqual({
      plays: 4,
      best: 180,
      timePlayedMs: 45_000,
      lastPlayedAt: '2026-10-25T13:00:00.000Z',
      versusWins: { 1: 2, 2: 1 },
    });

    // Lower-is-better game (e.g. golf strokes) keeps the smaller score as best.
    book.recordPlay('green-nine', { durationMs: 60_000, score: 74, order: 'lower' });
    book.recordPlay('green-nine', { durationMs: 55_000, score: 78, order: 'lower' });
    const golf = book.recordPlay('green-nine', { durationMs: 50_000, score: 69, order: 'lower' });
    expect(golf.best).toBe(69);
    expect(golf.plays).toBe(3);
    expect(golf.timePlayedMs).toBe(165_000);
  });

  it('aggregates totals across three games and updates after forgetting a game', () => {
    let clock = new Date('2026-10-25T09:00:00.000Z');
    const repo = memoryRepo<StatsData>({
      games: {
        // An entry with 0 plays should not count towards gamesPlayed.
        'idle-entry': {
          plays: 0,
          best: null,
          timePlayedMs: 0,
          lastPlayedAt: null,
          versusWins: { 1: 0, 2: 0 },
        },
      },
    });
    const book = createStatsBook(repo, () => clock);

    // Game 1: two plays, one versus win for seat 1.
    book.recordPlay('paint-tanks', {
      durationMs: 30_000,
      score: 10,
      order: 'higher',
      versusWinner: 1,
    });
    clock = new Date('2026-10-25T10:00:00.000Z');
    book.recordPlay('paint-tanks', {
      durationMs: 40_000,
      score: 15,
      order: 'higher',
    });

    // Game 2: one play, latest timestamp overall, one versus win for seat 2.
    clock = new Date('2026-10-26T18:00:00.000Z');
    book.recordPlay('sky-duel', {
      durationMs: 25_000,
      score: 8,
      order: 'higher',
      versusWinner: 2,
    });

    // Game 3: two plays on an earlier timestamp, one versus win for seat 2.
    clock = new Date('2026-10-26T12:00:00.000Z');
    book.recordPlay('green-nine', {
      durationMs: 50_000,
      score: 72,
      order: 'lower',
    });
    book.recordPlay('green-nine', {
      durationMs: 55_000,
      score: 70,
      order: 'lower',
      versusWinner: 2,
    });

    expect(book.totals()).toEqual({
      plays: 5,
      timePlayedMs: 200_000,
      gamesPlayed: 3,
      lastPlayedAt: '2026-10-26T18:00:00.000Z',
      versusMatches: 3,
    });

    book.forget('sky-duel');
    expect(book.game('sky-duel').plays).toBe(0);
    expect(book.totals()).toEqual({
      plays: 4,
      timePlayedMs: 175_000,
      gamesPlayed: 2,
      lastPlayedAt: '2026-10-26T12:00:00.000Z',
      versusMatches: 2,
    });
  });
});
