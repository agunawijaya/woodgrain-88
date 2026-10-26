// Unit tests for repository schema defaults, sanitisation rules and envelope upgrades.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../src/input.ts';
import { defaults, sanitize, upgrade, type SchemaContext } from '../src/store/schema.ts';
import { EVENT_LOG_LIMIT, RECORDS_PER_BOARD, type SessionSummary } from '../src/store/types.ts';

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
      controls: { layout: 'split', bindings: null, padSeats: [1, 2] },
      introSeen: false,
      hintsSeen: {},
      games: {},
    });

    expect(defaults('progress', ctx)).toEqual({ games: {} });
    expect(defaults('records', ctx)).toEqual({ boards: {} });
    expect(defaults('stats', ctx)).toEqual({ games: {} });
    expect(defaults('saves', ctx)).toEqual({ games: {} });
    expect(defaults('event-log', ctx)).toEqual({ sessions: [] });
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
        layout: 'solo',
        bindings: DEFAULT_BINDINGS,
        padSeats: [2, 1],
      },
      introSeen: false,
      hintsSeen: { pause: true },
      games: { tank: { speed: 2 } },
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
      layout: 'split',
      bindings: null,
      padSeats: [1, 2],
    });
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
            secretsFound: { retro: '2026-10-25T12:00:00.000Z' },
          },
        },
      },
      ctx,
    );

    expect(progress?.games['disk-duel']?.patches.first?.value).toBe(0);
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
});
