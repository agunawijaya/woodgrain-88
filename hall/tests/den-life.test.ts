/**
 * Tests for Den Life rules: patch and micro-challenge registry caching and candidate
 * listing, console difficulty switch state persistence, local and bot seat assignment,
 * finished run recording across streak, daily runs and kid records, growth announcement
 * deduplication, and game module data loading.
 */
import {
  emptyGameProgress,
  memoryBackend,
  type GameResult,
  type MicroChallengeDef,
  type PatchDef,
  type RunInfo,
  type SeatInfo,
} from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createServices } from '../src/app/services.ts';
import { FIXTURE_ENTRIES, catchManifest, fakeManifest } from './fixtures/index.ts';

function createTestServices() {
  return createServices(FIXTURE_ENTRIES, {
    backend: { backend: memoryBackend(), persistent: false },
  });
}

describe('den life', () => {
  it('registers patches and micro-challenges, updates run candidates, and notifies listeners on patch registration', () => {
    const services = createTestServices();
    const denLife = services.denLife;

    let changeCount = 0;
    const unsub = denLife.onChange(() => {
      changeCount++;
    });

    expect(denLife.patchesFor('custom-game')).toEqual([]);
    const patches: readonly PatchDef[] = [
      {
        id: 'club-one',
        tier: 'club',
        title: 'Club Patch',
        description: 'First patch goal',
        goal: { metric: { kind: 'count', event: 'point' }, target: 1 },
      },
    ];
    denLife.registerPatches('custom-game', patches);
    expect(denLife.patchesFor('custom-game')).toEqual(patches);
    expect(changeCount).toBe(1);

    expect(denLife.microFor(fakeManifest.id)).toEqual([]);
    expect(denLife.runCandidates().find((c) => c.game === fakeManifest.id)).toBeUndefined();

    const challenges: readonly MicroChallengeDef[] = [
      {
        id: 'micro-one',
        channel: 'classic',
        title: 'Micro Challenge',
        goal: 'Score 1 point',
        pass: { metric: { kind: 'count', event: 'point' }, target: 1 },
      },
    ];
    denLife.registerMicro(fakeManifest.id, challenges);
    expect(denLife.microFor(fakeManifest.id)).toEqual(challenges);

    const candidate = denLife.runCandidates().find((c) => c.game === fakeManifest.id);
    expect(candidate).toEqual({ game: fakeManifest.id, challenges });

    unsub();
  });

  it('updates switches via setSwitch and persists changes into settings', () => {
    const services = createTestServices();
    const denLife = services.denLife;

    expect(denLife.switches()).toEqual({ left: 'B', right: 'B' });
    expect(services.settings.get().difficulty).toEqual({ left: 'B', right: 'B' });

    denLife.setSwitch('left', 'A');
    expect(denLife.switches()).toEqual({ left: 'A', right: 'B' });
    expect(services.settings.get().difficulty).toEqual({ left: 'A', right: 'B' });

    denLife.setSwitch('right', 'A');
    expect(denLife.switches()).toEqual({ left: 'A', right: 'A' });
    expect(services.settings.get().difficulty).toEqual({ left: 'A', right: 'A' });
  });

  it('derives seats from manifest and opponent settings', () => {
    const services = createTestServices();
    const denLife = services.denLife;

    // For local+bot game, bot seat gets next kid on Block Ladder (initial: pip)
    const initialSeats = denLife.seatsFor(fakeManifest);
    expect(initialSeats).toHaveLength(2);
    expect(initialSeats[0]).toEqual({
      seat: 1,
      kind: 'human',
      name: services.repos.profile.get().displayName,
    });
    expect(initialSeats[1]).toEqual({
      seat: 2,
      kind: 'bot',
      kid: 'pip',
      name: 'Pip',
    });

    // After setting opponent in settings, bot seat matches configured opponent
    services.settings.game(fakeManifest.id).set('opponent', 'moss');
    const updatedSeats = denLife.seatsFor(fakeManifest);
    expect(updatedSeats[1]).toEqual({
      seat: 2,
      kind: 'bot',
      kid: 'moss',
      name: 'Moss',
    });
  });

  describe('recordFinishedRun', () => {
    it('records a streak day for finished runs', () => {
      const services = createTestServices();
      const denLife = services.denLife;
      const run: RunInfo = { mode: 'normal', seed: 42, channel: 'classic' };
      const result: GameResult = {
        score: 100,
        scoreLabel: '100',
        durationMs: 2000,
        presentation: 'hall',
      };

      expect(denLife.streak().playedToday).toBe(false);
      denLife.recordFinishedRun({
        manifest: fakeManifest,
        run,
        result,
        seats: denLife.seatsFor(fakeManifest),
        litBefore: [],
      });

      expect(denLife.streak().playedToday).toBe(true);
      expect(denLife.streak().current).toBe(1);
    });

    it('counts only the first daily run of the day for the daily score', () => {
      const services = createTestServices();
      const denLife = services.denLife;
      const dailyRun: RunInfo = { mode: 'daily', seed: 123, channel: 'classic' };
      const seats = denLife.seatsFor(fakeManifest);

      const firstRun = denLife.recordFinishedRun({
        manifest: fakeManifest,
        run: dailyRun,
        result: {
          score: 50,
          scoreLabel: '50',
          durationMs: 3000,
          emoji: '🟩🟩',
          presentation: 'hall',
        },
        seats,
        litBefore: [],
      });
      expect(firstRun.dailyCounted).toBe(true);

      const secondRun = denLife.recordFinishedRun({
        manifest: fakeManifest,
        run: dailyRun,
        result: {
          score: 90,
          scoreLabel: '90',
          durationMs: 2500,
          emoji: '🟩🟩🟩',
          presentation: 'hall',
        },
        seats,
        litBefore: [],
      });
      expect(secondRun.dailyCounted).toBe(false);
    });

    it('records the Kid the game says it played, or none for a second person', () => {
      const services = createTestServices();
      const denLife = services.denLife;
      const handedSeats: readonly SeatInfo[] = [
        { seat: 1, kind: 'human', name: 'Player' },
        { seat: 2, kind: 'bot', kid: 'dee', name: 'Dee' },
      ];
      const run: RunInfo = { mode: 'normal', seed: 1, channel: 'classic' };
      const win = { score: 9, scoreLabel: '9–4', durationMs: 1000, winnerSeat: 1 as const };

      denLife.recordFinishedRun({
        manifest: fakeManifest,
        run,
        result: { ...win, opponentKid: 'rosa', presentation: 'game' },
        seats: handedSeats,
        litBefore: [],
      });
      denLife.recordFinishedRun({
        manifest: fakeManifest,
        run,
        result: { ...win, opponentKid: null, presentation: 'game' },
        seats: handedSeats,
        litBefore: [],
      });

      const kids = services.repos.progress.get().den.kids;
      expect(kids.rosa?.wins).toBe(1);
      expect(kids.dee?.wins ?? 0).toBe(0);
    });

    it('records a win when winnerSeat is 1 and a loss when winnerSeat is 2 for a bot seat', () => {
      const services = createTestServices();
      const denLife = services.denLife;
      const matchSeats: readonly SeatInfo[] = [
        { seat: 1, kind: 'human', name: 'Player' },
        { seat: 2, kind: 'bot', kid: 'dee', name: 'Dee' },
      ];
      const run: RunInfo = { mode: 'normal', seed: 1, channel: 'classic' };

      denLife.recordFinishedRun({
        manifest: fakeManifest,
        run,
        result: {
          score: 10,
          scoreLabel: '10',
          durationMs: 1000,
          winnerSeat: 1,
          presentation: 'hall',
        },
        seats: matchSeats,
        litBefore: [],
      });
      expect(services.repos.progress.get().den.kids.dee?.wins).toBe(1);
      expect(services.repos.progress.get().den.kids.dee?.losses).toBe(0);

      denLife.recordFinishedRun({
        manifest: fakeManifest,
        run,
        result: {
          score: 5,
          scoreLabel: '5',
          durationMs: 1000,
          winnerSeat: 2,
          presentation: 'hall',
        },
        seats: matchSeats,
        litBefore: [],
      });
      expect(services.repos.progress.get().den.kids.dee?.wins).toBe(1);
      expect(services.repos.progress.get().den.kids.dee?.losses).toBe(1);
    });

    it('lists the lamp a patch earned during the session lit, against the lamps lit when it began', () => {
      const services = createTestServices();
      const denLife = services.denLife;
      const manifest = fakeManifest;
      const litBefore = denLife.litLamps();

      // Patches are earned from events during play, before the run is reported.
      services.repos.progress.update((draft) => {
        const game = (draft.games[manifest.id] ??= emptyGameProgress());
        game.patches['first-point'] = { value: 1, earnedAt: new Date().toISOString(), gold: false };
      });

      const run: RunInfo = { mode: 'normal', seed: 1, channel: 'classic' };
      const result: GameResult = {
        score: 10,
        scoreLabel: '10',
        durationMs: 1000,
        presentation: 'hall',
      };
      const aftermath = denLife.recordFinishedRun({
        manifest,
        run,
        result,
        seats: denLife.seatsFor(manifest),
        litBefore,
      });

      expect(litBefore).not.toContain(manifest.slot);
      expect(aftermath.newLamps).toContain(manifest.slot);
    });
  });

  it('announces each growth item exactly once per DenLife instance', () => {
    const services = createTestServices();
    const denLife = services.denLife;
    const itemA = { id: 'poster:arcade', kind: 'poster' as const, toast: 'Arcade poster' };
    const itemB = { id: 'paper-chain', kind: 'paper-chain' as const, toast: 'Paper chain' };
    const itemC = { id: 'ribbon', kind: 'ribbon' as const, toast: 'Ribbon' };

    expect(denLife.announceGrowth([itemA, itemB])).toEqual([itemA, itemB]);
    expect(denLife.announceGrowth([itemA, itemB, itemC])).toEqual([itemC]);
    expect(denLife.announceGrowth([itemA, itemB, itemC])).toEqual([]);
  });

  it('loads game modules, registers their patches and micro-challenges, and deduplicates loadGameData calls', async () => {
    const services = createTestServices();
    const denLife = services.denLife;

    const p1 = denLife.loadGameData();
    const p2 = denLife.loadGameData();
    expect(p1).toBe(p2);
    await p1;

    const catchPatches = denLife.patchesFor(catchManifest.id);
    expect(catchPatches).toHaveLength(3);
    expect(catchPatches.map((p) => p.id)).toEqual(['ten-catches', 'streak-ten', 'hundred']);

    const catchMicro = denLife.microFor(catchManifest.id);
    expect(catchMicro).toHaveLength(3);
    expect(catchMicro.map((m) => m.id)).toEqual(['catch-five', 'streak-four', 'no-miss']);

    const candidates = denLife.runCandidates();
    const catchCandidate = candidates.find((c) => c.game === catchManifest.id);
    expect(catchCandidate?.challenges).toEqual(catchMicro);
  });
});
