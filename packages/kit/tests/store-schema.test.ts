// Unit tests for repository schema defaults, sanitisation rules and envelope upgrades.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../src/input.ts';
import { KID_IDS } from '../src/kids.ts';
import {
  defaults,
  emptyDenLife,
  sanitize,
  upgrade,
  type SchemaContext,
} from '../src/store/schema.ts';
import {
  EVENT_LOG_LIMIT,
  RECORDS_PER_BOARD,
  VERSUS_RECENT_LIMIT,
  type SessionSummary,
} from '../src/store/types.ts';

function makeContext(): SchemaContext {
  let counter = 0;
  return {
    now: () => new Date('2026-10-25T12:00:00Z'),
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
  };
}

describe('defaults', () => {
  it('returns the documented defaults for every repository', () => {
    const ctx = makeContext();

    expect(defaults('profile', ctx)).toEqual({
      id: 'id-1',
      displayName: 'Player',
      avatar: { hue: 28, shape: 'round', pattern: 'plain' },
      createdAt: '2026-10-25T12:00:00.000Z',
    });

    expect(defaults('settings', ctx)).toEqual({
      appearance: 'system',
      volume: { master: 0.8, sfx: 0.8, music: 0.8, ambience: 0.4 },
      muted: false,
      reducedMotion: 'system',
      screenShake: true,
      crtEffects: true,
      colorBlindHints: false,
      roomAmbience: false,
      controls: { bindings: null, padSeats: [1, 2] },
      introSeen: false,
      hintsSeen: {},
      games: {},
      difficulty: { left: 'B', right: 'B' },
      showGrowth: true,
      shareWithName: false,
      versusBestOf: 3,
      runSound: 'normal',
    });

    expect(defaults('progress', ctx)).toEqual({
      games: {},
      den: emptyDenLife(),
    });
    expect(defaults('records', ctx)).toEqual({ boards: {} });
    expect(defaults('stats', ctx)).toEqual({ games: {} });
    expect(defaults('saves', ctx)).toEqual({ games: {} });
    expect(defaults('event-log', ctx)).toEqual({ sessions: [] });
  });
});

describe('emptyDenLife', () => {
  it('has the exact shape and returns distinct fresh objects each call', () => {
    const d1 = emptyDenLife();
    const d2 = emptyDenLife();

    expect(d1).toEqual({
      streak: { days: {}, best: 0 },
      daily: {},
      kids: {},
      jacket: { placements: [], lookedAt: null },
      versus: { seriesPlayed: 0, recent: [], rivalries: {} },
      runs: { free: [], daily: {} },
      growthSeen: {},
      counterCompletedAt: null,
    });

    expect(d1).not.toBe(d2);
    expect(d1.streak).not.toBe(d2.streak);
    expect(d1.streak.days).not.toBe(d2.streak.days);
    expect(d1.daily).not.toBe(d2.daily);
    expect(d1.kids).not.toBe(d2.kids);
    expect(d1.jacket).not.toBe(d2.jacket);
    expect(d1.jacket.placements).not.toBe(d2.jacket.placements);
    expect(d1.versus).not.toBe(d2.versus);
    expect(d1.versus.recent).not.toBe(d2.versus.recent);
    expect(d1.versus.rivalries).not.toBe(d2.versus.rivalries);
    expect(d1.runs).not.toBe(d2.runs);
    expect(d1.runs.free).not.toBe(d2.runs.free);
    expect(d1.runs.daily).not.toBe(d2.runs.daily);
    expect(d1.growthSeen).not.toBe(d2.growthSeen);
  });
});

describe('sanitize', () => {
  it('rejects values that are not plain objects', () => {
    const ctx = makeContext();

    expect(sanitize('profile', null, ctx)).toBeNull();
    expect(sanitize('profile', undefined, ctx)).toBeNull();
    expect(sanitize('profile', 'text', ctx)).toBeNull();
    expect(sanitize('profile', 42, ctx)).toBeNull();
    expect(sanitize('profile', [1, 2], ctx)).toBeNull();
  });

  it('fills missing profile fields, drops unknown keys, wraps hue and trims/caps displayName', () => {
    const ctx = makeContext();

    const clean = sanitize(
      'profile',
      {
        displayName: '   TwentyCharactersLongExtra   ',
        avatar: { hue: -32, shape: 'tall', pattern: 'invalid', extra: true },
        unknownField: 'drop-me',
      },
      ctx,
    );

    expect(clean).toEqual({
      id: 'id-1',
      displayName: 'TwentyCharactersLong',
      avatar: { hue: 328, shape: 'tall', pattern: 'plain' },
      createdAt: '2026-10-25T12:00:00.000Z',
    });

    const blankName = sanitize(
      'profile',
      {
        id: ' fixed-id ',
        displayName: '   ',
        avatar: { hue: 390, shape: 'Unknown', pattern: 'dots' },
      },
      ctx,
    );

    expect(blankName).toEqual({
      id: 'fixed-id',
      displayName: 'Player',
      avatar: { hue: 30, shape: 'round', pattern: 'dots' },
      createdAt: '2026-10-25T12:00:00.000Z',
    });
  });

  it('clamps volumes, validates enums, bindings and padSeats, and drops unknown keys', () => {
    const ctx = makeContext();

    const sanitized = sanitize(
      'settings',
      {
        appearance: 'neon',
        volume: { master: 1.5, sfx: -0.2, music: Number.NaN, ambience: 0.25, extra: 1 },
        muted: 'yes',
        reducedMotion: 'on',
        controls: {
          layout: 'solo',
          bindings: DEFAULT_BINDINGS,
          padSeats: [2, 1],
        },
        hintsSeen: { pause: true, bad: 'nope' },
        games: { tank: { speed: 2 }, bad: 'not-an-object' },
        stray: 123,
      },
      ctx,
    );

    expect(sanitized).toEqual({
      appearance: 'system',
      volume: { master: 1, sfx: 0, music: 0.8, ambience: 0.25 },
      muted: false,
      reducedMotion: 'on',
      screenShake: true,
      crtEffects: true,
      colorBlindHints: false,
      roomAmbience: false,
      controls: {
        bindings: DEFAULT_BINDINGS,
        padSeats: [2, 1],
      },
      introSeen: false,
      hintsSeen: { pause: true },
      games: { tank: { speed: 2 } },
      difficulty: { left: 'B', right: 'B' },
      showGrowth: true,
      shareWithName: false,
      versusBestOf: 3,
      runSound: 'normal',
    });

    const badControls = sanitize(
      'settings',
      {
        controls: {
          layout: 'invalid',
          bindings: { 1: { keys: {}, pad: {} } },
          padSeats: [1, 3],
        },
      },
      ctx,
    );

    expect(badControls?.controls).toEqual({
      bindings: null,
      padSeats: [1, 2],
    });
  });

  it('sanitises settings v2 fields: difficulty, versusBestOf, runSound and boolean defaults', () => {
    const ctx = makeContext();

    const customValid = sanitize(
      'settings',
      {
        difficulty: { left: 'A', right: 'B' },
        showGrowth: false,
        shareWithName: true,
        versusBestOf: 5,
        runSound: 'loud',
      },
      ctx,
    );

    expect(customValid?.difficulty).toEqual({ left: 'A', right: 'B' });
    expect(customValid?.showGrowth).toBe(false);
    expect(customValid?.shareWithName).toBe(true);
    expect(customValid?.versusBestOf).toBe(5);
    expect(customValid?.runSound).toBe('loud');

    const badValues = sanitize(
      'settings',
      {
        difficulty: { left: 'X', right: 'invalid' },
        showGrowth: 'yes',
        shareWithName: 1,
        versusBestOf: 7,
        runSound: 'ear-splitting',
      },
      ctx,
    );

    expect(badValues?.difficulty).toEqual({ left: 'B', right: 'B' });
    expect(badValues?.showGrowth).toBe(true);
    expect(badValues?.shareWithName).toBe(false);
    expect(badValues?.versusBestOf).toBe(3);
    expect(badValues?.runSound).toBe('normal');

    const nonObjectDifficulty = sanitize(
      'settings',
      {
        difficulty: 'hard',
        runSound: 'quiet',
      },
      ctx,
    );
    expect(nonObjectDifficulty?.difficulty).toEqual({ left: 'B', right: 'B' });
    expect(nonObjectDifficulty?.runSound).toBe('quiet');
  });

  it('sanitises streak: drops invalid day keys and kinds, and floors best at zero', () => {
    const ctx = makeContext();
    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          streak: {
            days: {
              '2026-10-25': 'played',
              '2026-10-26': 'snow',
              '2026-02-30': 'played',
              '2026-13-01': 'played',
              'bad-key': 'played',
              '2026-10-27': 'sunny',
              '2026-10-28': 123,
            },
            best: -4.8,
          },
        },
      },
      ctx,
    );

    expect(progress?.den.streak.days).toEqual({
      '2026-10-25': 'played',
      '2026-10-26': 'snow',
    });
    expect(progress?.den.streak.best).toBe(0);

    const fractionalBest = sanitize(
      'progress',
      {
        games: {},
        den: {
          streak: {
            days: {},
            best: 5.9,
          },
        },
      },
      ctx,
    );
    expect(fractionalBest?.den.streak.best).toBe(5);
  });

  it('sanitises daily runs: drops invalid days, non-finite scores, bad channels or times, clamps scoreLabel', () => {
    const ctx = makeContext();
    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          daily: {
            '2026-10-25': {
              'tank-duel': {
                score: 100,
                scoreLabel: '100 pts',
                emoji: 'star',
                channel: 'ch-1',
                at: '2026-10-25T12:00:00.000Z',
              },
              'sky-ace': {
                score: 50,
                scoreLabel: 'A'.repeat(50),
                emoji: 12345,
                channel: 'main',
                at: ' 2026-10-25T13:00:00.000Z ',
              },
              'invalid-score': {
                score: Number.NaN,
                scoreLabel: 'NaN',
                emoji: null,
                channel: 'ch-1',
                at: '2026-10-25T12:00:00.000Z',
              },
              'bad-channel': {
                score: 10,
                scoreLabel: '10',
                emoji: null,
                channel: 'Not Kebab!',
                at: '2026-10-25T12:00:00.000Z',
              },
              'bad-time': {
                score: 10,
                scoreLabel: '10',
                emoji: null,
                channel: 'ch-1',
                at: '   ',
              },
              'not-an-object': 'bad',
            },
            '2026-99-99': {
              'tank-duel': {
                score: 10,
                scoreLabel: '10',
                emoji: null,
                channel: 'ch-1',
                at: '2026-10-25T12:00:00.000Z',
              },
            },
          },
        },
      },
      ctx,
    );

    expect(progress?.den.daily['2026-99-99']).toBeUndefined();
    const oct25 = progress?.den.daily['2026-10-25'];
    expect(oct25?.['tank-duel']).toEqual({
      score: 100,
      scoreLabel: '100 pts',
      emoji: 'star',
      channel: 'ch-1',
      at: '2026-10-25T12:00:00.000Z',
    });
    expect(oct25?.['sky-ace']).toEqual({
      score: 50,
      scoreLabel: 'A'.repeat(40),
      emoji: null,
      channel: 'main',
      at: '2026-10-25T13:00:00.000Z',
    });
    expect(oct25?.['invalid-score']).toBeUndefined();
    expect(oct25?.['bad-channel']).toBeUndefined();
    expect(oct25?.['bad-time']).toBeUndefined();
  });

  it('sanitises kids: filters KID_IDS, floors counts at 0, clamps winsOnA to wins, trims times', () => {
    const ctx = makeContext();
    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          kids: {
            dee: {
              wins: 4,
              losses: -2,
              draws: 1.8,
              winsOnA: 6,
              firstBeatenAt: ' 2026-10-25T12:00:00.000Z ',
              firstBeatenOnAAt: null,
            },
            stranger: {
              wins: 10,
              losses: 0,
              draws: 0,
              winsOnA: 0,
              firstBeatenAt: null,
              firstBeatenOnAAt: null,
            },
            moss: 'not-an-object',
          },
        },
      },
      ctx,
    );

    expect(Object.keys(progress?.den.kids ?? {})).toEqual(['dee']);
    expect(progress?.den.kids.dee).toEqual({
      wins: 4,
      losses: 0,
      draws: 1,
      winsOnA: 4,
      firstBeatenAt: '2026-10-25T12:00:00.000Z',
      firstBeatenOnAAt: null,
    });
    for (const id of KID_IDS) {
      if (id !== 'dee') {
        expect(progress?.den.kids[id]).toBeUndefined();
      }
    }
  });

  it('sanitises jacket placements: validates side, clamps x/y, normalises rotation to multiple of 15 in [0, 360), drops duplicate game+patch', () => {
    const ctx = makeContext();
    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          jacket: {
            lookedAt: ' 2026-10-25T12:00:00.000Z ',
            placements: [
              {
                game: 'sky-ace',
                patch: 'ace',
                side: 'front',
                x: -50,
                y: 850,
                rotation: 37,
                z: 2.8,
              },
              {
                game: 'sky-ace',
                patch: 'ace',
                side: 'back',
                x: 100,
                y: 200,
                rotation: 0,
                z: 5,
              },
              {
                game: 'tank-duel',
                patch: 'treads',
                side: 'back',
                x: 700,
                y: -10,
                rotation: -20,
                z: -1.2,
              },
              {
                game: 'brick-volley',
                patch: 'paddle',
                side: 'front',
                x: 200,
                y: 300,
                rotation: 355,
                z: 0,
              },
              {
                game: 'laser-grid',
                patch: 'beam',
                side: 'front',
                x: 100,
                y: 100,
                rotation: 360,
                z: 1,
              },
              {
                game: 'Bad Game',
                patch: 'patch',
                side: 'front',
                x: 10,
                y: 10,
                rotation: 0,
                z: 0,
              },
              {
                game: 'sky-ace',
                patch: 'Bad Patch',
                side: 'front',
                x: 10,
                y: 10,
                rotation: 0,
                z: 0,
              },
              {
                game: 'sky-ace',
                patch: 'wing',
                side: 'inside',
                x: 10,
                y: 10,
                rotation: 0,
                z: 0,
              },
            ],
          },
        },
      },
      ctx,
    );

    expect(progress?.den.jacket.lookedAt).toBe('2026-10-25T12:00:00.000Z');
    expect(progress?.den.jacket.placements).toEqual([
      {
        game: 'sky-ace',
        patch: 'ace',
        side: 'front',
        x: 0,
        y: 700,
        rotation: 30,
        z: 2,
      },
      {
        game: 'tank-duel',
        patch: 'treads',
        side: 'back',
        x: 600,
        y: 0,
        rotation: 345,
        z: -1,
      },
      {
        game: 'brick-volley',
        patch: 'paddle',
        side: 'front',
        x: 200,
        y: 300,
        rotation: 0,
        z: 0,
      },
      {
        game: 'laser-grid',
        patch: 'beam',
        side: 'front',
        x: 100,
        y: 100,
        rotation: 0,
        z: 1,
      },
    ]);
  });

  it('sanitises versus: caps recent at VERSUS_RECENT_LIMIT keeping newest, validates records, sorts rivalry names', () => {
    const ctx = makeContext();
    const count = VERSUS_RECENT_LIMIT + 5;
    const recentEntries = Array.from({ length: count }, (_, index) => ({
      at: `2026-10-25T12:${String(index).padStart(2, '0')}:00.000Z`,
      names: [`P1-${index}`, `P2-${index}`],
      kids: [index % 2 === 0 ? 'dee' : null, null],
      bestOf: 3,
      games: [{ game: 'tank-duel', winner: 1 }],
      winner: 1,
    }));

    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          versus: {
            seriesPlayed: -3,
            recent: [
              {
                at: '2026-10-25T12:00:00.000Z',
                names: ['Alice', 'Bob'],
                kids: ['invalid-kid', null],
                bestOf: 3,
                games: [{ game: 'tank-duel', winner: 1 }],
                winner: 1,
              },
              {
                at: '2026-10-25T12:00:00.000Z',
                names: ['Alice', 'Bob'],
                kids: [null, null],
                bestOf: 7,
                games: [{ game: 'tank-duel', winner: 1 }],
                winner: 1,
              },
              {
                at: '2026-10-25T12:00:00.000Z',
                names: ['Alice', 'Bob'],
                kids: [null, null],
                bestOf: 3,
                games: [{ game: 'Bad Game', winner: 1 }],
                winner: 1,
              },
              {
                at: '2026-10-25T12:00:00.000Z',
                names: ['Alice', 'Bob'],
                kids: [null, null],
                bestOf: 3,
                games: [{ game: 'tank-duel', winner: 3 }],
                winner: 1,
              },
              {
                at: '2026-10-25T12:00:00.000Z',
                names: ['Alice', 'Bob'],
                kids: [null, null],
                bestOf: 3,
                games: [{ game: 'tank-duel', winner: 1 }],
                winner: 3,
              },
              ...recentEntries,
            ],
            rivalries: {
              'zed-amy': {
                names: ['Zed', 'Amy'],
                series: [2, 5],
                games: [7, 11],
                lastAt: '2026-10-25T12:00:00.000Z',
              },
              'bad-counts': {
                names: ['Alice', 'Bob'],
                series: [-1, 2],
                games: [3, 4],
                lastAt: '2026-10-25T12:00:00.000Z',
              },
              'bad-last-at': {
                names: ['Alice', 'Bob'],
                series: [1, 2],
                games: [3, 4],
                lastAt: '   ',
              },
            },
          },
        },
      },
      ctx,
    );

    expect(progress?.den.versus.seriesPlayed).toBe(0);
    expect(progress?.den.versus.recent).toHaveLength(VERSUS_RECENT_LIMIT);
    expect(progress?.den.versus.recent[0]?.names).toEqual(['P1-5', 'P2-5']);
    expect(progress?.den.versus.recent[VERSUS_RECENT_LIMIT - 1]?.names).toEqual([
      `P1-${count - 1}`,
      `P2-${count - 1}`,
    ]);

    expect(progress?.den.versus.rivalries['zed-amy']).toEqual({
      names: ['Amy', 'Zed'],
      series: [5, 2],
      games: [11, 7],
      lastAt: '2026-10-25T12:00:00.000Z',
    });
    expect(progress?.den.versus.rivalries['bad-counts']).toBeUndefined();
    expect(progress?.den.versus.rivalries['bad-last-at']).toBeUndefined();
  });

  it('sanitises runs: sorts free runs by score descending capped at RECORDS_PER_BOARD, clamps seconds, validates dates in daily', () => {
    const ctx = makeContext();
    const count = RECORDS_PER_BOARD + 5;
    const freeRuns = Array.from({ length: count }, (_, index) => ({
      at: '2026-10-25T12:00:00.000Z',
      seed: index + 1,
      score: (index + 1) * 10,
      rounds: [
        {
          game: 'tank-duel',
          challenge: 'speed-run',
          passed: true,
          seconds: index === 0 ? -12 : 30 + index,
        },
      ],
    }));

    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          runs: {
            free: [
              {
                at: '2026-10-25T12:00:00.000Z',
                seed: 1,
                score: Number.NaN,
                rounds: [],
              },
              ...freeRuns,
            ],
            daily: {
              '2026-10-25': {
                at: '2026-10-25T12:00:00.000Z',
                seed: 999,
                score: 120,
                rounds: [
                  {
                    game: 'sky-ace',
                    challenge: 'dogfight',
                    passed: true,
                    seconds: 45,
                  },
                ],
              },
              'invalid-date': {
                at: '2026-10-25T12:00:00.000Z',
                seed: 1,
                score: 50,
                rounds: [],
              },
            },
          },
        },
      },
      ctx,
    );

    const free = progress?.den.runs.free;
    expect(free).toHaveLength(RECORDS_PER_BOARD);
    expect(free?.[0]?.score).toBe(count * 10);
    expect(free?.[RECORDS_PER_BOARD - 1]?.score).toBe((count - RECORDS_PER_BOARD + 1) * 10);

    const lowestKept = free?.find((r) => r.seed === 1);
    if (lowestKept) {
      expect(lowestKept.rounds[0]?.seconds).toBe(0);
    }

    expect(progress?.den.runs.daily['invalid-date']).toBeUndefined();
    expect(progress?.den.runs.daily['2026-10-25']).toEqual({
      at: '2026-10-25T12:00:00.000Z',
      seed: 999,
      score: 120,
      rounds: [
        {
          game: 'sky-ace',
          challenge: 'dogfight',
          passed: true,
          seconds: 45,
        },
      ],
    });
  });

  it('sanitises growthSeen and counterCompletedAt, dropping non-times', () => {
    const ctx = makeContext();
    const progress = sanitize(
      'progress',
      {
        games: {},
        den: {
          growthSeen: {
            trophy: ' 2026-10-25T12:00:00.000Z ',
            bad1: '',
            bad2: 12345,
          },
          counterCompletedAt: ' 2026-10-25T18:00:00.000Z ',
        },
      },
      ctx,
    );

    expect(progress?.den.growthSeen).toEqual({
      trophy: '2026-10-25T12:00:00.000Z',
    });
    expect(progress?.den.counterCompletedAt).toBe('2026-10-25T18:00:00.000Z');

    const emptyTimes = sanitize(
      'progress',
      {
        games: {},
        den: {
          growthSeen: {},
          counterCompletedAt: '   ',
        },
      },
      ctx,
    );
    expect(emptyTimes?.den.counterCompletedAt).toBeNull();
  });

  it('keeps valid RunRecords and caps each record board at RECORDS_PER_BOARD in order', () => {
    const ctx = makeContext();
    const entries = Array.from({ length: RECORDS_PER_BOARD + 5 }, (_, index) => ({
      score: 100 - index,
      at: '2026-10-25T12:00:00.000Z',
      seed: index + 1,
      durationMs: index === 0 ? -50 : 1000 + index,
      channel: 'ch-1',
      mode: 'normal' as const,
      extra: 'ignored',
    }));

    const sanitized = sanitize(
      'records',
      {
        boards: {
          'game-a/ch-1/normal': [
            {
              score: Number.POSITIVE_INFINITY,
              at: '2026-10-25T12:00:00Z',
              seed: 1,
              durationMs: 10,
              channel: 'c',
              mode: 'normal',
            },
            ...entries,
          ],
        },
      },
      ctx,
    );

    const board = sanitized?.boards['game-a/ch-1/normal'];
    expect(board).toHaveLength(RECORDS_PER_BOARD);
    expect(board?.[0]).toEqual({
      score: 100,
      at: '2026-10-25T12:00:00.000Z',
      seed: 1,
      durationMs: 0,
      channel: 'ch-1',
      mode: 'normal',
    });
    expect(board?.[RECORDS_PER_BOARD - 1]?.score).toBe(100 - (RECORDS_PER_BOARD - 1));
  });

  it('keeps valid sessions and caps the event log to the newest EVENT_LOG_LIMIT entries', () => {
    const ctx = makeContext();
    const count = EVENT_LOG_LIMIT + 10;
    const sessions: SessionSummary[] = Array.from({ length: count }, (_, index) => ({
      game: `game-${index}`,
      mode: 'normal',
      channel: 'main',
      startedAt: '2026-10-25T12:00:00.000Z',
      endedAt: '2026-10-25T12:05:00.000Z',
      durationMs: index === 10 ? -25 : 300_000,
      counts: { hit: index, bad: -4 },
      maxima: { 'score.total': index * 10 },
    }));

    const sanitized = sanitize(
      'event-log',
      {
        sessions: [{ game: '', mode: 'invalid' }, ...sessions],
      },
      ctx,
    );

    expect(sanitized?.sessions).toHaveLength(EVENT_LOG_LIMIT);
    expect(sanitized?.sessions[0]?.game).toBe('game-10');
    expect(sanitized?.sessions[0]?.durationMs).toBe(0);
    expect(sanitized?.sessions[0]?.counts).toEqual({ hit: 10, bad: 0 });
    expect(sanitized?.sessions[EVENT_LOG_LIMIT - 1]?.game).toBe(`game-${EVENT_LOG_LIMIT + 9}`);
  });

  it('floors counts and durations at 0 in progress and stats', () => {
    const ctx = makeContext();

    const stats = sanitize(
      'stats',
      {
        games: {
          'disk-duel': {
            plays: -3,
            best: 45,
            timePlayedMs: -100,
            lastPlayedAt: ' 2026-10-25T12:00:00.000Z ',
            versusWins: { 1: -2, 2: 5 },
          },
        },
      },
      ctx,
    );

    expect(stats).toEqual({
      games: {
        'disk-duel': {
          plays: 0,
          best: 45,
          timePlayedMs: 0,
          lastPlayedAt: '2026-10-25T12:00:00.000Z',
          versusWins: { 1: 0, 2: 5 },
        },
      },
    });

    const progress = sanitize(
      'progress',
      {
        games: {
          'disk-duel': {
            patches: {
              first: { value: -5, earnedAt: '2026-10-25T12:00:00.000Z', gold: true },
            },
            channels: { main: { unlockedAt: '2026-10-25T12:00:00.000Z' } },
            firstPlayedAt: null,
            versionsFinished: { rabbit: '2026-10-25T12:00:00.000Z' },
          },
        },
      },
      ctx,
    );

    expect(progress?.games['disk-duel']?.patches.first?.value).toBe(0);
    expect(progress?.den).toEqual(emptyDenLife());
  });
});

describe('upgrade', () => {
  it('refuses future, below-1 and non-integer versions and upgrades version 1 envelopes', () => {
    const ctx = makeContext();

    expect(upgrade('profile', { v: 2, data: {} }, ctx)).toBeNull();
    expect(upgrade('profile', { v: 0, data: {} }, ctx)).toBeNull();
    expect(upgrade('profile', { v: -1, data: {} }, ctx)).toBeNull();
    expect(upgrade('profile', { v: 1.2, data: {} }, ctx)).toBeNull();
    expect(upgrade('profile', { v: Number.NaN, data: {} }, ctx)).toBeNull();
    expect(upgrade('profile', { v: 1, data: 'not-an-object' }, ctx)).toBeNull();

    const upgraded = upgrade('profile', { v: 1, data: { displayName: 'Robin' } }, ctx);
    expect(upgraded).toEqual({
      id: 'id-1',
      displayName: 'Robin',
      avatar: { hue: 28, shape: 'round', pattern: 'plain' },
      createdAt: '2026-10-25T12:00:00.000Z',
    });
  });

  it('upgrades settings v1 to v2 adding defaults and keeping existing settings intact', () => {
    const ctx = makeContext();
    const v1Settings = {
      appearance: 'dark',
      volume: { master: 0.6, sfx: 0.5, music: 0.4, ambience: 0.2 },
      muted: true,
      reducedMotion: 'on',
      screenShake: false,
      crtEffects: false,
      colorBlindHints: true,
      roomAmbience: true,
      controls: { layout: 'solo', bindings: null, padSeats: [2, 1] },
      introSeen: true,
      hintsSeen: { pause: true },
      games: { tank: { turbo: true } },
    };

    expect(upgrade('settings', { v: 3, data: v1Settings }, ctx)).toBeNull();

    const upgraded = upgrade('settings', { v: 1, data: v1Settings }, ctx);
    expect(upgraded).toEqual({
      ...v1Settings,
      // The keyboard layout is no longer a setting: a game sets it from how many people play.
      controls: { bindings: null, padSeats: [2, 1] },
      difficulty: { left: 'B', right: 'B' },
      showGrowth: true,
      shareWithName: false,
      versusBestOf: 3,
      runSound: 'normal',
    });
  });

  it('upgrades progress v2 to v3 adding empty den and keeping games intact', () => {
    const ctx = makeContext();
    const v2Data = {
      games: {
        'tank-duel': {
          patches: {
            ace: { value: 3, earnedAt: '2026-10-25T12:00:00.000Z', gold: true },
          },
          channels: {
            main: { unlockedAt: '2026-10-25T12:00:00.000Z' },
          },
          firstPlayedAt: '2026-10-25T12:00:00.000Z',
          versionsFinished: {
            release: '2026-10-25T12:00:00.000Z',
          },
        },
      },
    };

    expect(upgrade('progress', { v: 4, data: v2Data }, ctx)).toBeNull();

    const upgraded = upgrade('progress', { v: 2, data: v2Data }, ctx);
    expect(upgraded).toEqual({
      games: v2Data.games,
      den: emptyDenLife(),
    });
  });

  it('upgrades progress v1 through v2 to v3 dropping secretsFound and adding empty den', () => {
    const ctx = makeContext();
    const v1Data = {
      games: {
        'tank-duel': {
          secretsFound: { secret1: '2026-10-25T12:00:00.000Z' },
          patches: {},
          channels: {},
          firstPlayedAt: '2026-10-25T12:00:00.000Z',
        },
      },
    };

    const upgraded = upgrade('progress', { v: 1, data: v1Data }, ctx);
    expect(upgraded).toEqual({
      games: {
        'tank-duel': {
          patches: {},
          channels: {},
          firstPlayedAt: '2026-10-25T12:00:00.000Z',
          versionsFinished: {},
        },
      },
      den: emptyDenLife(),
    });
    const tankGame = upgraded?.games['tank-duel'];
    expect(tankGame && 'secretsFound' in tankGame).toBe(false);

    // Sanitising v3 data drops non-string or empty versionsFinished times
    const sanitized = sanitize(
      'progress',
      {
        games: {
          'lane-hopper': {
            patches: {},
            channels: {},
            firstPlayedAt: null,
            versionsFinished: {
              valid: ' 2026-10-25T12:00:00.000Z ',
              empty: '   ',
              num: 12345,
              bool: true,
              obj: {},
            },
          },
        },
      },
      ctx,
    );

    expect(sanitized?.games['lane-hopper']?.versionsFinished).toEqual({
      valid: '2026-10-25T12:00:00.000Z',
    });
    expect(sanitized?.den).toEqual(emptyDenLife());
  });
});
