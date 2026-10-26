/**
 * Tests for personal record boards: keys, higher- and lower-is-better ordering,
 * tie preservation, top-ten trimming, overall best lookup and forgetting a game.
 */
import { describe, expect, it } from 'vitest';
import { boardKey, compareRuns, createRecordsBook } from '../src/records.ts';
import { RECORDS_PER_BOARD, type RecordsData, type RunRecord } from '../src/store/types.ts';
import { memoryRepo } from './helpers/memory-repo.ts';

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    score: 100,
    at: '2026-10-25T12:00:00.000Z',
    seed: 42,
    durationMs: 30_000,
    channel: '01',
    mode: 'normal',
    ...overrides,
  };
}

describe('records book', () => {
  it('builds board keys from game id, channel and run mode', () => {
    expect(boardKey('paint-tanks', '01', 'normal')).toBe('paint-tanks/01/normal');
    expect(boardKey('green-nine', '03', 'daily')).toBe('green-nine/03/daily');
  });

  it('compares runs under higher and lower score orders with 0 on ties', () => {
    const high = makeRun({ score: 250 });
    const low = makeRun({ score: 120 });
    const tied = makeRun({ score: 250, seed: 99 });

    expect(compareRuns(high, low, 'higher')).toBeLessThan(0);
    expect(compareRuns(low, high, 'higher')).toBeGreaterThan(0);
    expect(compareRuns(high, tied, 'higher')).toBe(0);

    expect(compareRuns(low, high, 'lower')).toBeLessThan(0);
    expect(compareRuns(high, low, 'lower')).toBeGreaterThan(0);
    expect(compareRuns(high, tied, 'lower')).toBe(0);
  });

  it('tracks top runs and newBest on a higher-is-better board and keeps earlier ties first', () => {
    const repo = memoryRepo<RecordsData>({ boards: {} });
    const book = createRecordsBook(repo);

    expect(book.best('paint-tanks', '01', 'normal')).toBeNull();
    expect(book.top('paint-tanks', '01', 'normal')).toEqual([]);

    const first = makeRun({ score: 100, seed: 1, at: '2026-10-25T10:00:00.000Z' });
    expect(book.submit('paint-tanks', first, 'higher')).toEqual({ rank: 1, newBest: true });

    // Tying the top score places second behind the earlier run and is not a new best.
    const tiedTop = makeRun({ score: 100, seed: 2, at: '2026-10-25T11:00:00.000Z' });
    expect(book.submit('paint-tanks', tiedTop, 'higher')).toEqual({ rank: 2, newBest: false });

    // Beating the top score takes rank 1 and marks newBest.
    const better = makeRun({ score: 150, seed: 3, at: '2026-10-25T12:00:00.000Z' });
    expect(book.submit('paint-tanks', better, 'higher')).toEqual({ rank: 1, newBest: true });

    // Another 100 goes after both earlier 100s.
    const thirdTie = makeRun({ score: 100, seed: 4, at: '2026-10-25T13:00:00.000Z' });
    expect(book.submit('paint-tanks', thirdTie, 'higher')).toEqual({ rank: 4, newBest: false });

    const top = book.top('paint-tanks', '01', 'normal');
    expect(top.map((run) => ({ score: run.score, seed: run.seed }))).toEqual([
      { score: 150, seed: 3 },
      { score: 100, seed: 1 },
      { score: 100, seed: 2 },
      { score: 100, seed: 4 },
    ]);
    expect(book.best('paint-tanks', '01', 'normal')?.seed).toBe(3);

    // Mutating the returned array does not mutate stored records.
    top.pop();
    expect(book.top('paint-tanks', '01', 'normal')).toHaveLength(4);
  });

  it('orders lower-is-better games such as golf strokes with smallest score first', () => {
    const repo = memoryRepo<RecordsData>({ boards: {} });
    const book = createRecordsBook(repo);

    const r1 = book.submit('green-nine', makeRun({ score: 72, seed: 10 }), 'lower');
    expect(r1).toEqual({ rank: 1, newBest: true });

    const r2 = book.submit('green-nine', makeRun({ score: 75, seed: 11 }), 'lower');
    expect(r2).toEqual({ rank: 2, newBest: false });

    const r3 = book.submit('green-nine', makeRun({ score: 68, seed: 12 }), 'lower');
    expect(r3).toEqual({ rank: 1, newBest: true });

    const r4 = book.submit('green-nine', makeRun({ score: 68, seed: 13 }), 'lower');
    expect(r4).toEqual({ rank: 2, newBest: false });

    expect(book.top('green-nine', '01', 'normal').map((r) => [r.score, r.seed])).toEqual([
      [68, 12],
      [68, 13],
      [72, 10],
      [75, 11],
    ]);
    expect(book.best('green-nine', '01', 'normal')?.score).toBe(68);
  });

  it('trims the board to ten and returns rank null when an eleventh run is worse than all ten', () => {
    const repo = memoryRepo<RecordsData>({ boards: {} });
    const book = createRecordsBook(repo);

    for (let i = 1; i <= RECORDS_PER_BOARD; i++) {
      const outcome = book.submit('paint-tanks', makeRun({ score: i * 10, seed: i }), 'higher');
      expect(outcome).toEqual({ rank: 1, newBest: true });
    }

    expect(book.top('paint-tanks', '01', 'normal')).toHaveLength(RECORDS_PER_BOARD);

    // A run worse than all ten (score 5 < 10) falls off the end.
    const eleventhWorse = book.submit('paint-tanks', makeRun({ score: 5, seed: 99 }), 'higher');
    expect(eleventhWorse).toEqual({ rank: null, newBest: false });
    expect(book.top('paint-tanks', '01', 'normal')).toHaveLength(RECORDS_PER_BOARD);
    expect(book.top('paint-tanks', '01', 'normal').map((r) => r.score)).toEqual([
      100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
    ]);

    // A run that ties the 10th place (score 10) also lands at index 10 (11th) and falls off.
    const tiedLast = book.submit('paint-tanks', makeRun({ score: 10, seed: 100 }), 'higher');
    expect(tiedLast).toEqual({ rank: null, newBest: false });
    expect(book.top('paint-tanks', '01', 'normal')[9]?.seed).toBe(1);

    // A run that places 5th pushes the old 10th off the board.
    const fifthPlace = book.submit('paint-tanks', makeRun({ score: 65, seed: 55 }), 'higher');
    expect(fifthPlace).toEqual({ rank: 5, newBest: false });
    expect(book.top('paint-tanks', '01', 'normal')).toHaveLength(RECORDS_PER_BOARD);
    expect(book.top('paint-tanks', '01', 'normal').map((r) => r.score)).toEqual([
      100, 90, 80, 70, 65, 60, 50, 40, 30, 20,
    ]);
  });

  it('finds bestOverall across all channels and modes of a game and forgets only that game', () => {
    const repo = memoryRepo<RecordsData>({ boards: {} });
    const book = createRecordsBook(repo);

    expect(book.bestOverall('paint-tanks', 'higher')).toBeNull();

    book.submit('paint-tanks', makeRun({ score: 120, channel: '01', mode: 'normal' }), 'higher');
    book.submit('paint-tanks', makeRun({ score: 240, channel: '02', mode: 'daily' }), 'higher');
    book.submit('paint-tanks', makeRun({ score: 180, channel: '03', mode: 'challenge' }), 'higher');
    book.submit('paint-tanks-deluxe', makeRun({ score: 999 }), 'higher');

    const overall = book.bestOverall('paint-tanks', 'higher');
    expect(overall?.score).toBe(240);
    expect(overall?.channel).toBe('02');
    expect(overall?.mode).toBe('daily');

    book.forget('paint-tanks');
    expect(book.bestOverall('paint-tanks', 'higher')).toBeNull();
    expect(book.top('paint-tanks', '01', 'normal')).toEqual([]);
    expect(book.bestOverall('paint-tanks-deluxe', 'higher')?.score).toBe(999);
  });
});
