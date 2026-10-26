// Unit tests for JSON save bundle export, preview validation and import application.
import { describe, expect, it } from 'vitest';
import { createLocalStore, memoryBackend } from '../src/store/local-store.ts';
import { createRepositories } from '../src/store/repos.ts';
import { emptyDenLife, type SchemaContext } from '../src/store/schema.ts';
import type { DenLifeData } from '../src/store/types.ts';
import {
  applyImport,
  EXPORT_APP,
  EXPORT_FORMAT,
  exportAll,
  exportFileName,
  MAX_IMPORT_BYTES,
  previewImport,
} from '../src/store/transfer.ts';

const FIXED_DATE = new Date('2026-10-25T12:00:00Z');

function makeContext(): SchemaContext {
  let counter = 0;
  return {
    now: () => FIXED_DATE,
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
  };
}

describe('transfer', () => {
  it('round-trips data through exportAll, previewImport and applyImport with summary counts', () => {
    const sourceRepos = createRepositories(createLocalStore(memoryBackend()), makeContext());

    sourceRepos.profile.update((draft) => {
      draft.displayName = 'Sam';
    });
    sourceRepos.records.set({
      boards: {
        'sky-ace/ch-1/normal': [
          {
            score: 500,
            at: '2026-10-25T12:00:00.000Z',
            seed: 1,
            durationMs: 12000,
            channel: 'ch-1',
            mode: 'normal',
          },
          {
            score: 300,
            at: '2026-10-25T12:00:00.000Z',
            seed: 2,
            durationMs: 9000,
            channel: 'ch-1',
            mode: 'normal',
          },
        ],
        'sky-ace/ch-2/daily': [
          {
            score: 450,
            at: '2026-10-25T12:00:00.000Z',
            seed: 3,
            durationMs: 11000,
            channel: 'ch-2',
            mode: 'daily',
          },
        ],
        'lane-hopper/ch-1/normal': [],
        'brick-volley/ch-1/normal': [
          {
            score: 21,
            at: '2026-10-25T12:00:00.000Z',
            seed: 4,
            durationMs: 60000,
            channel: 'ch-1',
            mode: 'normal',
          },
        ],
      },
    });
    sourceRepos.progress.set({
      games: {
        'sky-ace': {
          patches: {
            ace: { value: 10, earnedAt: '2026-10-25T12:00:00.000Z', gold: true },
            wing: { value: 2, earnedAt: null, gold: false },
          },
          channels: {},
          firstPlayedAt: '2026-10-25T12:00:00.000Z',
          versionsFinished: {},
        },
      },
      den: emptyDenLife(),
    });
    sourceRepos['event-log'].set({
      sessions: [
        {
          game: 'sky-ace',
          mode: 'normal',
          channel: 'ch-1',
          startedAt: '2026-10-25T11:50:00.000Z',
          endedAt: '2026-10-25T12:00:00.000Z',
          durationMs: 600000,
          counts: { score: 3 },
          maxima: { 'score.points': 500 },
        },
      ],
    });

    expect(exportFileName(FIXED_DATE)).toBe('woodgrain-88-2026-10-25.json');

    const bundle = exportAll(sourceRepos, FIXED_DATE);
    expect(bundle.repos.settings?.v).toBe(2);
    expect(bundle.repos.progress?.v).toBe(3);

    const preview = previewImport(JSON.stringify(bundle), makeContext());

    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    expect(preview.summary).toEqual({
      exportedAt: '2026-10-25T12:00:00.000Z',
      displayName: 'Sam',
      gamesWithRecords: 2,
      runs: 4,
      patchesEarned: 1,
      sessions: 1,
    });

    const targetRepos = createRepositories(createLocalStore(memoryBackend()), makeContext());
    applyImport(targetRepos, preview.bundle);

    expect(targetRepos.profile.get().displayName).toBe('Sam');
    expect(targetRepos.records.get().boards['sky-ace/ch-1/normal']).toHaveLength(2);
    expect(targetRepos.progress.get().games['sky-ace']?.patches.ace?.gold).toBe(true);
    expect(targetRepos['event-log'].get().sessions).toHaveLength(1);
  });

  it('round-trips a fully populated den block unchanged through exportAll, previewImport and applyImport', () => {
    const sourceRepos = createRepositories(createLocalStore(memoryBackend()), makeContext());

    const populatedDen: DenLifeData = {
      streak: {
        days: {
          '2026-10-24': 'played',
          '2026-10-25': 'snow',
        },
        best: 14,
      },
      daily: {
        '2026-10-25': {
          'tank-duel': {
            score: 42,
            scoreLabel: '42 pts',
            emoji: 'star',
            channel: 'ch-1',
            at: '2026-10-25T12:00:00.000Z',
          },
        },
      },
      kids: {
        dee: {
          wins: 3,
          losses: 1,
          draws: 0,
          winsOnA: 2,
          firstBeatenAt: '2026-10-25T12:00:00.000Z',
          firstBeatenOnAAt: '2026-10-25T12:00:00.000Z',
        },
      },
      jacket: {
        lookedAt: '2026-10-25T12:00:00.000Z',
        placements: [
          {
            game: 'tank-duel',
            patch: 'ace',
            side: 'front',
            x: 120,
            y: 340,
            rotation: 45,
            z: 2,
          },
          {
            game: 'sky-ace',
            patch: 'wing',
            side: 'back',
            x: 300,
            y: 400,
            rotation: 0,
            z: 1,
          },
        ],
      },
      versus: {
        seriesPlayed: 5,
        recent: [
          {
            at: '2026-10-25T12:00:00.000Z',
            names: ['Player 1', 'Dee'],
            kids: [null, 'dee'],
            bestOf: 3,
            games: [{ game: 'tank-duel', winner: 1 }],
            winner: 1,
          },
        ],
        rivalries: {
          'player-dee': {
            names: ['Dee', 'Player 1'],
            series: [1, 4],
            games: [3, 8],
            lastAt: '2026-10-25T12:00:00.000Z',
          },
        },
      },
      runs: {
        free: [
          {
            at: '2026-10-25T12:00:00.000Z',
            seed: 123,
            score: 85,
            rounds: [
              {
                game: 'tank-duel',
                challenge: 'speed',
                passed: true,
                seconds: 20,
              },
            ],
          },
        ],
        daily: {
          '2026-10-25': {
            at: '2026-10-25T12:00:00.000Z',
            seed: 456,
            score: 90,
            rounds: [
              {
                game: 'sky-ace',
                challenge: 'dogfight',
                passed: true,
                seconds: 15,
              },
            ],
          },
        },
      },
      growthSeen: {
        'trophy-1': '2026-10-25T12:00:00.000Z',
      },
      counterCompletedAt: '2026-10-25T12:00:00.000Z',
    };

    sourceRepos.progress.set({
      games: {
        'tank-duel': {
          patches: {},
          channels: {},
          firstPlayedAt: '2026-10-25T12:00:00.000Z',
          versionsFinished: {},
        },
      },
      den: populatedDen,
    });

    const bundle = exportAll(sourceRepos, FIXED_DATE);
    const preview = previewImport(JSON.stringify(bundle), makeContext());

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const targetRepos = createRepositories(createLocalStore(memoryBackend()), makeContext());
    applyImport(targetRepos, preview.bundle);

    expect(targetRepos.progress.get().den).toEqual(populatedDen);
  });

  it('imports a v2 progress export file into the current v3 shape with empty den and games intact', () => {
    const raw = JSON.stringify({
      app: EXPORT_APP,
      format: EXPORT_FORMAT,
      exportedAt: '2026-10-25T12:00:00.000Z',
      repos: {
        progress: {
          v: 2,
          data: {
            games: {
              'tank-duel': {
                patches: {
                  ace: { value: 7, earnedAt: '2026-10-25T12:00:00.000Z', gold: true },
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
          },
        },
      },
    });

    const preview = previewImport(raw, makeContext());
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const targetRepos = createRepositories(createLocalStore(memoryBackend()), makeContext());
    applyImport(targetRepos, preview.bundle);

    const progress = targetRepos.progress.get();
    expect(progress.games['tank-duel']?.patches.ace).toEqual({
      value: 7,
      earnedAt: '2026-10-25T12:00:00.000Z',
      gold: true,
    });
    expect(progress.den).toEqual(emptyDenLife());
  });

  it('refuses oversized, non-JSON, wrong-app, future-format and empty save files', () => {
    const ctx = makeContext();

    const oversized = 'x'.repeat(MAX_IMPORT_BYTES + 1);
    expect(previewImport(oversized, ctx)).toEqual({
      ok: false,
      error: "That file is too big to be a Woodgrain '88 save.",
    });

    expect(previewImport('{broken-json', ctx)).toEqual({
      ok: false,
      error: "That file is not a Woodgrain '88 save.",
    });

    expect(previewImport(JSON.stringify('not-an-object'), ctx)).toEqual({
      ok: false,
      error: "That file is not a Woodgrain '88 save.",
    });

    expect(
      previewImport(
        JSON.stringify({
          app: 'other-app',
          format: EXPORT_FORMAT,
          exportedAt: '2026-10-25T12:00:00.000Z',
          repos: { profile: { v: 1, data: { displayName: 'Player' } } },
        }),
        ctx,
      ),
    ).toEqual({
      ok: false,
      error: "That file is not a Woodgrain '88 save.",
    });

    expect(
      previewImport(
        JSON.stringify({
          app: EXPORT_APP,
          format: EXPORT_FORMAT + 1,
          exportedAt: '2026-10-25T12:00:00.000Z',
          repos: { profile: { v: 1, data: { displayName: 'Player' } } },
        }),
        ctx,
      ),
    ).toEqual({
      ok: false,
      error: "That save comes from a newer version of Woodgrain '88.",
    });

    expect(
      previewImport(
        JSON.stringify({
          app: EXPORT_APP,
          format: EXPORT_FORMAT,
          exportedAt: '2026-10-25T12:00:00.000Z',
          repos: {
            profile: { v: 99, data: {} },
            unknownRepo: { v: 1, data: {} },
          },
        }),
        ctx,
      ),
    ).toEqual({
      ok: false,
      error: 'That save has nothing we can read.',
    });
  });

  it('imports only valid repositories, ignores unknown names and leaves absent ones alone', () => {
    const ctx = makeContext();
    const raw = JSON.stringify({
      app: EXPORT_APP,
      format: EXPORT_FORMAT,
      exportedAt: '2026-10-25T12:00:00.000Z',
      repos: {
        settings: { v: 1, data: { muted: true } },
        profile: { v: 1, data: 'corrupt-non-object' },
        mystery: { v: 1, data: { anything: true } },
      },
    });

    const preview = previewImport(raw, ctx);
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    expect(Object.keys(preview.bundle.repos)).toEqual(['settings']);
    expect(preview.summary.displayName).toBeNull();

    const targetRepos = createRepositories(createLocalStore(memoryBackend()), makeContext());
    targetRepos.profile.update((draft) => {
      draft.displayName = 'Existing';
    });

    applyImport(targetRepos, preview.bundle);

    expect(targetRepos.settings.get().muted).toBe(true);
    expect(targetRepos.profile.get().displayName).toBe('Existing');
  });
});
