/**
 * Tests for the Versus Night state machine and stored records: setup validation,
 * deterministic raffle drawing, phase transitions, series completion, rematches,
 * rivalry key calculation, and stored series folding.
 */
import { describe, expect, it } from 'vitest';
import type { VersusData } from '../src/store/types.ts';
import { VERSUS_RECENT_LIMIT } from '../src/store/types.ts';
import {
  drawNextGame,
  recordGame,
  recordSeries,
  rematch,
  rivalryKey,
  seatName,
  startSeries,
  validateVersusSetup,
  winsNeeded,
  type VersusSeat,
  type VersusSetup,
} from '../src/versus.ts';

function createValidSetup(overrides?: Partial<VersusSetup>): VersusSetup {
  return {
    seats: [
      { kind: 'human', name: 'Player One' },
      { kind: 'kid', kid: 'dee' },
    ],
    bestOf: 3,
    pool: ['tank-duel', 'disc-duel', 'canyon-bomber'],
    seed: 42,
    ...overrides,
  };
}

function createEmptyVersusData(): VersusData {
  return {
    seriesPlayed: 0,
    recent: [],
    rivalries: {},
  };
}

describe('Versus Night', () => {
  it('behaviour 1: validateVersusSetup reports each of the required setup problems', () => {
    // Valid setup has no problems.
    expect(validateVersusSetup(createValidSetup())).toEqual([]);

    // 1. Human name that fails validateDisplayName (empty or whitespace).
    const invalidNameSetup = createValidSetup({
      seats: [
        { kind: 'human', name: '   ' },
        { kind: 'kid', kid: 'dee' },
      ],
    });
    const invalidNameProblems = validateVersusSetup(invalidNameSetup);
    expect(invalidNameProblems.length).toBeGreaterThan(0);
    expect(invalidNameProblems.some((p) => p.toLowerCase().includes('name'))).toBe(true);

    // 2. Two kids (at least one seat must be human).
    const twoKidsSetup = createValidSetup({
      seats: [
        { kind: 'kid', kid: 'dee' },
        { kind: 'kid', kid: 'moss' },
      ],
    });
    const twoKidsProblems = validateVersusSetup(twoKidsSetup);
    expect(twoKidsProblems.some((p) => p.toLowerCase().includes('human'))).toBe(true);

    // 3. Same kid in both seats.
    const sameKidSetup = createValidSetup({
      seats: [
        { kind: 'kid', kid: 'dee' },
        { kind: 'kid', kid: 'dee' },
      ],
    });
    const sameKidProblems = validateVersusSetup(sameKidSetup);
    expect(sameKidProblems.some((p) => p.toLowerCase().includes('same kid'))).toBe(true);

    // 4. bestOf other than 3 or 5.
    const badBestOfSetup = createValidSetup({
      bestOf: 7 as unknown as 3 | 5,
    });
    const badBestOfProblems = validateVersusSetup(badBestOfSetup);
    expect(badBestOfProblems.some((p) => p.includes('3 or 5'))).toBe(true);

    // 5. Empty pool.
    const emptyPoolSetup = createValidSetup({
      pool: [],
    });
    const emptyPoolProblems = validateVersusSetup(emptyPoolSetup);
    expect(emptyPoolProblems.some((p) => p.toLowerCase().includes('pool'))).toBe(true);

    // 6. Pool with duplicate ids.
    const dupPoolSetup = createValidSetup({
      pool: ['tank-duel', 'disc-duel', 'tank-duel'],
    });
    const dupPoolProblems = validateVersusSetup(dupPoolSetup);
    expect(dupPoolProblems.some((p) => p.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('behaviour 2: winsNeeded returns 2 for bestOf 3 and 3 for bestOf 5', () => {
    expect(winsNeeded(3)).toBe(2);
    expect(winsNeeded(5)).toBe(3);
  });

  it('seatName returns the typed name for human seats and the kid name for kid seats', () => {
    const humanSeat: VersusSeat = { kind: 'human', name: 'Robin' };
    const louSeat: VersusSeat = { kind: 'kid', kid: 'lou' };
    const deeSeat: VersusSeat = { kind: 'kid', kid: 'dee' };

    expect(seatName(humanSeat)).toBe('Robin');
    expect(seatName(louSeat)).toBe('Grandpa Lou');
    expect(seatName(deeSeat)).toBe('Dee');
  });

  it('startSeries initializes a new series in phase drawing and throws on invalid setup', () => {
    const valid = createValidSetup();
    const series = startSeries(valid);

    expect(series.setup).toEqual(valid);
    expect(series.phase).toBe('drawing');
    expect(series.games).toEqual([]);
    expect(series.current).toBeNull();
    expect(series.wins).toEqual([0, 0]);
    expect(series.winner).toBeNull();
    expect(series.draws).toBe(0);

    const invalid = createValidSetup({ pool: [] });
    expect(() => startSeries(invalid)).toThrow(/invalid/i);
  });

  it('behaviour 3: calling a transition from the wrong phase throws an Error naming the phases', () => {
    const setup = createValidSetup();
    const seriesDrawing = startSeries(setup);

    // Recording while in 'drawing' phase.
    expect(() => recordGame(seriesDrawing, 1)).toThrow(/drawing/);

    // Drawing while in 'playing' phase.
    const seriesPlaying = drawNextGame(seriesDrawing);
    expect(seriesPlaying.phase).toBe('playing');
    expect(() => drawNextGame(seriesPlaying)).toThrow(/playing/);

    // Drawing or recording while in 'finished' phase.
    const seriesWon1 = recordGame(seriesPlaying, 1);
    const seriesNext = drawNextGame(seriesWon1);
    const seriesFinished = recordGame(seriesNext, 1);
    expect(seriesFinished.phase).toBe('finished');

    expect(() => drawNextGame(seriesFinished)).toThrow(/finished/);
    expect(() => recordGame(seriesFinished, 1)).toThrow(/finished/);
  });

  it('behaviour 4: raffle draws with series RNG, never draws consecutive repeats for multi-game pool, and draws single game for one-game pool', () => {
    // Multi-game pool test: no consecutive duplicates across 30 draws.
    const multiSetup = createValidSetup({
      pool: ['game-a', 'game-b', 'game-c'],
      seed: 9876,
    });
    let series = startSeries(multiSetup);
    let previousGame: string | null = null;

    for (let i = 0; i < 30; i++) {
      series = drawNextGame(series);
      expect(series.current).not.toBeNull();
      if (previousGame !== null) {
        expect(series.current).not.toBe(previousGame);
      }
      previousGame = series.current;
      // Record a draw (winner: null) so the series never finishes and stays in 'between'.
      series = recordGame(series, null);
    }

    // One-game pool test: always draws that single game.
    const singleSetup = createValidSetup({
      pool: ['only-game'],
      seed: 1234,
    });
    let singleSeries = startSeries(singleSetup);

    for (let i = 0; i < 5; i++) {
      singleSeries = drawNextGame(singleSeries);
      expect(singleSeries.current).toBe('only-game');
      singleSeries = recordGame(singleSeries, null);
    }
  });

  it('behaviour 5: the same seed always gives the same sequence of draws even across recordGame calls', () => {
    const seed = 54321;
    const pool = ['game-1', 'game-2', 'game-3', 'game-4'];

    const setupA = createValidSetup({ seed, pool });
    let seriesA = startSeries(setupA);
    const drawsA: (string | null)[] = [];

    // Series A: seat 1 wins, seat 2 wins, draw.
    seriesA = drawNextGame(seriesA);
    drawsA.push(seriesA.current);
    seriesA = recordGame(seriesA, 1);

    seriesA = drawNextGame(seriesA);
    drawsA.push(seriesA.current);
    seriesA = recordGame(seriesA, 2);

    seriesA = drawNextGame(seriesA);
    drawsA.push(seriesA.current);
    seriesA = recordGame(seriesA, null);

    seriesA = drawNextGame(seriesA);
    drawsA.push(seriesA.current);

    const setupB = createValidSetup({ seed, pool });
    let seriesB = startSeries(setupB);
    const drawsB: (string | null)[] = [];

    // Series B: seat 2 wins, draw, seat 1 wins (different outcomes, same draw order).
    seriesB = drawNextGame(seriesB);
    drawsB.push(seriesB.current);
    seriesB = recordGame(seriesB, 2);

    seriesB = drawNextGame(seriesB);
    drawsB.push(seriesB.current);
    seriesB = recordGame(seriesB, null);

    seriesB = drawNextGame(seriesB);
    drawsB.push(seriesB.current);
    seriesB = recordGame(seriesB, 1);

    seriesB = drawNextGame(seriesB);
    drawsB.push(seriesB.current);

    expect(drawsA).toEqual(drawsB);
  });

  it('behaviour 6: recordGame updates games, wins, and transitions to between or finished', () => {
    const setup = createValidSetup({ bestOf: 3 });
    let series = startSeries(setup);

    // Match 1: Seat 1 wins.
    series = drawNextGame(series);
    const game1 = series.current;
    series = recordGame(series, 1);

    expect(series.games).toEqual([{ game: game1, winner: 1 }]);
    expect(series.wins).toEqual([1, 0]);
    expect(series.winner).toBeNull();
    expect(series.phase).toBe('between');

    // Match 2: Draw.
    series = drawNextGame(series);
    const game2 = series.current;
    series = recordGame(series, null);

    expect(series.games).toEqual([
      { game: game1, winner: 1 },
      { game: game2, winner: null },
    ]);
    expect(series.wins).toEqual([1, 0]);
    expect(series.winner).toBeNull();
    expect(series.phase).toBe('between');

    // Match 3: Seat 1 wins, reaching winsNeeded(3) = 2.
    series = drawNextGame(series);
    const game3 = series.current;
    series = recordGame(series, 1);

    expect(series.games).toEqual([
      { game: game1, winner: 1 },
      { game: game2, winner: null },
      { game: game3, winner: 1 },
    ]);
    expect(series.wins).toEqual([2, 0]);
    expect(series.winner).toBe(1);
    expect(series.phase).toBe('finished');
  });

  it('behaviour 7: the series never ends in a tie; draws are replayed until someone reaches winsNeeded', () => {
    const setup = createValidSetup({ bestOf: 3 });
    let series = startSeries(setup);

    // 8 drawn games in a row.
    for (let i = 0; i < 8; i++) {
      series = drawNextGame(series);
      series = recordGame(series, null);
      expect(series.phase).toBe('between');
      expect(series.wins).toEqual([0, 0]);
      expect(series.winner).toBeNull();
    }

    // Seat 2 wins game 9.
    series = drawNextGame(series);
    series = recordGame(series, 2);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([0, 1]);

    // Another draw on game 10.
    series = drawNextGame(series);
    series = recordGame(series, null);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([0, 1]);

    // Seat 2 wins game 11, reaching 2 wins.
    series = drawNextGame(series);
    series = recordGame(series, 2);
    expect(series.phase).toBe('finished');
    expect(series.winner).toBe(2);
    expect(series.wins).toEqual([0, 2]);
    expect(series.games.length).toBe(11);
  });

  it('behaviour 8: rematch keeps the seats, bestOf and pool, resets games, wins, draws, and uses the new seed', () => {
    const setup = createValidSetup({ bestOf: 5, seed: 111 });
    let series = startSeries(setup);

    series = drawNextGame(series);
    series = recordGame(series, 1);
    series = drawNextGame(series);
    series = recordGame(series, 2);

    const rematched = rematch(series, 999);

    expect(rematched.setup.seats).toEqual(series.setup.seats);
    expect(rematched.setup.bestOf).toBe(5);
    expect(rematched.setup.pool).toEqual(series.setup.pool);
    expect(rematched.setup.seed).toBe(999);

    expect(rematched.phase).toBe('drawing');
    expect(rematched.games).toEqual([]);
    expect(rematched.current).toBeNull();
    expect(rematched.wins).toEqual([0, 0]);
    expect(rematched.winner).toBeNull();
    expect(rematched.draws).toBe(0);
  });

  it('behaviour 9: rivalryKey normalizes, trims, lowercases, and sorts names joined by pipe', () => {
    expect(rivalryKey(['Ana', 'bo'])).toBe(rivalryKey([' BO ', 'ana']));
    expect(rivalryKey(['Ana', 'bo'])).toBe('ana|bo');
    expect(rivalryKey(['  Charlie ', 'ALICE  '])).toBe('alice|charlie');
    expect(rivalryKey(['dee', 'dee'])).toBe('dee|dee');
  });

  it('behaviour 10: recordSeries folds finished series into VersusData without mutating inputs', () => {
    const setup: VersusSetup = {
      seats: [
        { kind: 'human', name: 'Ana' },
        { kind: 'human', name: 'Bo' },
      ],
      bestOf: 3,
      pool: ['game-a', 'game-b'],
      seed: 100,
    };

    let series = startSeries(setup);

    // Cannot record an unfinished series.
    const initialData = createEmptyVersusData();
    expect(() => recordSeries(initialData, series, '2026-10-26T12:00:00.000Z')).toThrow(
      /not finished/,
    );

    // Play series: Game 1: Ana (1), Game 2: Bo (2), Game 3: Ana (1). Ana wins 2-1.
    series = drawNextGame(series);
    series = recordGame(series, 1);
    series = drawNextGame(series);
    series = recordGame(series, 2);
    series = drawNextGame(series);
    series = recordGame(series, 1);

    expect(series.phase).toBe('finished');
    expect(series.winner).toBe(1);

    const timestamp1 = '2026-10-26T12:00:00.000Z';
    const data1 = recordSeries(initialData, series, timestamp1);

    // Verify initialData was not mutated.
    expect(initialData.seriesPlayed).toBe(0);
    expect(initialData.recent).toEqual([]);
    expect(initialData.rivalries).toEqual({});

    // Verify data1 updates.
    expect(data1.seriesPlayed).toBe(1);
    expect(data1.recent.length).toBe(1);

    const record = data1.recent[0];
    expect(record).toBeDefined();
    if (record !== undefined) {
      expect(record.at).toBe(timestamp1);
      expect(record.names).toEqual(['Ana', 'Bo']);
      expect(record.kids).toEqual([null, null]);
      expect(record.bestOf).toBe(3);
      expect(record.winner).toBe(1);
      expect(record.games.length).toBe(3);
    }

    const key = rivalryKey(['Ana', 'Bo']);
    expect(key).toBe('ana|bo');
    const rivalry = data1.rivalries[key];
    expect(rivalry).toBeDefined();
    if (rivalry !== undefined) {
      expect(rivalry.names).toEqual(['Ana', 'Bo']);
      expect(rivalry.series).toEqual([1, 0]);
      expect(rivalry.games).toEqual([2, 1]);
      expect(rivalry.lastAt).toBe(timestamp1);
    }

    // Second series: Bo is Seat 1, Ana is Seat 2. Bo wins 2-0.
    const setup2: VersusSetup = {
      seats: [
        { kind: 'human', name: 'Bo' },
        { kind: 'human', name: 'Ana' },
      ],
      bestOf: 3,
      pool: ['game-a', 'game-b'],
      seed: 200,
    };
    let series2 = startSeries(setup2);
    series2 = drawNextGame(series2);
    series2 = recordGame(series2, 1); // Bo wins
    series2 = drawNextGame(series2);
    series2 = recordGame(series2, 1); // Bo wins
    expect(series2.winner).toBe(1);

    const timestamp2 = '2026-10-26T13:00:00.000Z';
    const data2 = recordSeries(data1, series2, timestamp2);

    expect(data2.seriesPlayed).toBe(2);
    expect(data2.recent.length).toBe(2);
    const rivalry2 = data2.rivalries[key];
    expect(rivalry2).toBeDefined();
    if (rivalry2 !== undefined) {
      expect(rivalry2.names).toEqual(['Ana', 'Bo']);
      // Ana had 1 series, Bo gets 1 series -> [1, 1].
      expect(rivalry2.series).toEqual([1, 1]);
      // Ana had 2 games, Bo had 1 + 2 = 3 games -> [2, 3].
      expect(rivalry2.games).toEqual([2, 3]);
      expect(rivalry2.lastAt).toBe(timestamp2);
    }

    // Verify recent trimming to VERSUS_RECENT_LIMIT.
    let dataMany = createEmptyVersusData();
    for (let i = 0; i < VERSUS_RECENT_LIMIT + 5; i++) {
      const at = `2026-10-26T${String(i).padStart(2, '0')}:00:00.000Z`;
      dataMany = recordSeries(dataMany, series, at);
    }
    expect(dataMany.recent.length).toBe(VERSUS_RECENT_LIMIT);
  });

  it('runs a full best-of-5 played to 3–2 with a draw in the middle checked game by game', () => {
    const setup: VersusSetup = {
      seats: [
        { kind: 'human', name: 'Player One' },
        { kind: 'kid', kid: 'lou' },
      ],
      bestOf: 5,
      pool: ['tank-duel', 'disc-duel', 'canyon-bomber'],
      seed: 777,
    };

    let series = startSeries(setup);
    expect(series.phase).toBe('drawing');
    expect(series.wins).toEqual([0, 0]);
    expect(series.games).toHaveLength(0);
    expect(series.current).toBeNull();
    expect(series.draws).toBe(0);

    // Game 1: Seat 1 wins.
    series = drawNextGame(series);
    expect(series.phase).toBe('playing');
    expect(series.draws).toBe(1);
    const game1 = series.current;
    expect(typeof game1).toBe('string');
    series = recordGame(series, 1);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([1, 0]);
    expect(series.games).toEqual([{ game: game1, winner: 1 }]);

    // Game 2: Seat 2 wins.
    series = drawNextGame(series);
    expect(series.phase).toBe('playing');
    expect(series.draws).toBe(2);
    const game2 = series.current;
    expect(game2).not.toBe(game1);
    series = recordGame(series, 2);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([1, 1]);
    expect(series.games).toHaveLength(2);

    // Game 3: Draw (middle draw).
    series = drawNextGame(series);
    expect(series.phase).toBe('playing');
    expect(series.draws).toBe(3);
    const game3 = series.current;
    expect(game3).not.toBe(game2);
    series = recordGame(series, null);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([1, 1]);
    expect(series.games).toHaveLength(3);
    expect(series.games[2]?.winner).toBeNull();

    // Game 4: Seat 1 wins.
    series = drawNextGame(series);
    expect(series.phase).toBe('playing');
    expect(series.draws).toBe(4);
    const game4 = series.current;
    expect(game4).not.toBe(game3);
    series = recordGame(series, 1);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([2, 1]);
    expect(series.games).toHaveLength(4);

    // Game 5: Seat 2 wins.
    series = drawNextGame(series);
    expect(series.phase).toBe('playing');
    expect(series.draws).toBe(5);
    const game5 = series.current;
    expect(game5).not.toBe(game4);
    series = recordGame(series, 2);
    expect(series.phase).toBe('between');
    expect(series.wins).toEqual([2, 2]);
    expect(series.games).toHaveLength(5);

    // Game 6: Seat 1 wins (reaches 3 wins needed for best-of-5).
    series = drawNextGame(series);
    expect(series.phase).toBe('playing');
    expect(series.draws).toBe(6);
    const game6 = series.current;
    expect(game6).not.toBe(game5);
    series = recordGame(series, 1);
    expect(series.phase).toBe('finished');
    expect(series.wins).toEqual([3, 2]);
    expect(series.winner).toBe(1);
    expect(series.games).toHaveLength(6);

    // Verify recording this series into store data.
    const at = '2026-10-26T18:00:00.000Z';
    const stored = recordSeries(createEmptyVersusData(), series, at);
    expect(stored.seriesPlayed).toBe(1);
    expect(stored.recent[0]?.names).toEqual(['Player One', 'Grandpa Lou']);
    expect(stored.recent[0]?.kids).toEqual([null, 'lou']);
    expect(stored.recent[0]?.winner).toBe(1);
  });
});
