/**
 * Tests for Den Life test fixtures: manifest validation, registry overrides,
 * virtual Power Cycle Run game generation, bot decision-making logic, and fixture indexing.
 */
import {
  aiSettings,
  validateChannels,
  validateManifest,
  validatePatches,
  validateRegistry,
  validateRemixUnlocks,
  type Seat,
} from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/data/registry.ts';
import {
  CATCH_GAME_ID,
  catchGame,
  catchManifest,
  FAKE_GAME_ID,
  fakeGame,
  fakeManifest,
  FIXTURE_ENTRIES,
  FIXTURE_IDS,
  TURN_GAME_ID,
  turnGame,
  turnManifest,
  virtualRunGames,
} from './fixtures/index.ts';
import { pickBotMove } from './fixtures/turn-game.ts';

describe('den fixtures', () => {
  it('validates all three fixture manifests, their channels, and remix unlocks', () => {
    // Each fixture must fulfill the platform contract without diagnostic warnings.
    expect(validateManifest(fakeManifest)).toEqual([]);
    expect(validateChannels(fakeManifest.channels)).toEqual([]);
    expect(
      validateRemixUnlocks(
        fakeManifest.channels,
        fakeGame.patches.map((patch) => patch.id),
      ),
    ).toEqual([]);

    expect(validateManifest(turnManifest)).toEqual([]);
    expect(validateChannels(turnManifest.channels)).toEqual([]);
    expect(
      validateRemixUnlocks(
        turnManifest.channels,
        turnGame.patches.map((patch) => patch.id),
      ),
    ).toEqual([]);
    expect(validatePatches(turnGame.patches, turnManifest.events)).toEqual([]);

    expect(validateManifest(catchManifest)).toEqual([]);
    expect(validateChannels(catchManifest.channels)).toEqual([]);
    expect(
      validateRemixUnlocks(
        catchManifest.channels,
        catchGame.patches.map((patch) => patch.id),
      ),
    ).toEqual([]);
    expect(validatePatches(catchGame.patches, catchManifest.events)).toEqual([]);
  });

  it('overrides slots 11, 20, and 26 in createRegistry while preserving the 30-game catalog', () => {
    const registry = createRegistry(FIXTURE_ENTRIES);

    expect(registry.entries).toHaveLength(30);
    expect(registry.manifests).toHaveLength(30);
    expect(validateRegistry(registry.manifests)).toEqual([]);

    const slot11 = registry.entryBySlot(11);
    expect(slot11?.manifest.id).toBe(FAKE_GAME_ID);
    expect(slot11?.manifest.family).toBe('arcade');

    const slot20 = registry.entryBySlot(20);
    expect(slot20?.manifest.id).toBe(TURN_GAME_ID);
    expect(slot20?.manifest.family).toBe('duels');

    const slot26 = registry.entryBySlot(26);
    expect(slot26?.manifest.id).toBe(CATCH_GAME_ID);
    expect(slot26?.manifest.family).toBe('arcade');
  });

  it('generates five virtual run games with distinct ids, slots 26-30, and micro-challenges', () => {
    const virtual = virtualRunGames();
    expect(virtual).toHaveLength(5);

    const ids = virtual.map((item) => item.entry.manifest.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([
      'test-catch-1',
      'test-catch-2',
      'test-catch-3',
      'test-catch-4',
      'test-catch-5',
    ]);

    const slots = virtual.map((item) => item.entry.manifest.slot);
    expect(new Set(slots).size).toBe(5);
    expect(slots).toEqual([26, 27, 28, 29, 30]);

    for (const item of virtual) {
      expect(item.module.microChallenges).toHaveLength(3);
      expect(validateManifest(item.entry.manifest)).toEqual([]);
    }
  });

  describe('turn game bot move picker', () => {
    const defaultSettings = aiSettings('lou');

    it('takes an immediate win', () => {
      // Seat 2 holds cells 0 and 1; cell 2 completes three in a row.
      const board: (Seat | null)[] = [2, 2, null, 1, 1, null, null, null, null];
      const move = pickBotMove(board, 2, defaultSettings, 1, 4);
      expect(move).toBe(2);
    });

    it('blocks an immediate loss when its error draw says it does not err', () => {
      // Seat 1 threatens a win across 0 and 1; seat 2 must block at cell 2.
      const board: (Seat | null)[] = [1, 1, null, null, 2, null, null, null, null];
      const move = pickBotMove(board, 2, defaultSettings, 1, 1);
      expect(move).toBe(2);
    });

    it('plays a random legal move when it errs', () => {
      // Seat 1 threatens cell 2, but draw 0 forces a mistake away from the optimal block.
      const board: (Seat | null)[] = [1, 1, null, null, 2, null, null, null, null];
      const move = pickBotMove(board, 2, defaultSettings, 0, 1);

      expect(board[move]).toBeNull();
      expect(move).not.toBe(2);
    });

    it('mirrors the human player move when Benny plays', () => {
      // Benny mirrors move 0 by symmetry onto opposite cell 8.
      const benny = aiSettings('benny');
      const board: (Seat | null)[] = [1, null, null, null, null, null, null, null, null];
      const move = pickBotMove(board, 2, benny, 1, 0);
      expect(move).toBe(8);

      // Benny mirrors move 2 onto opposite cell 6.
      const board2: (Seat | null)[] = [null, null, 1, null, null, null, null, null, null];
      const move2 = pickBotMove(board2, 2, benny, 1, 2);
      expect(move2).toBe(6);
    });
  });

  it('lists the three primary fixture ids and five virtual ids in FIXTURE_IDS', () => {
    expect(FIXTURE_IDS).toHaveLength(8);
    expect(FIXTURE_IDS).toEqual([
      FAKE_GAME_ID,
      TURN_GAME_ID,
      CATCH_GAME_ID,
      'test-catch-1',
      'test-catch-2',
      'test-catch-3',
      'test-catch-4',
      'test-catch-5',
    ]);
  });
});
