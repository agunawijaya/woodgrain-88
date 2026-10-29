/**
 * Tests for Trailblaze save data: empty save defaults, recordKey formatting,
 * match recording with maxima tracking, doodle gallery management, tolerant
 * reading of corrupt/version-mismatched data, and round-trip persistence.
 */
import { describe, expect, it } from 'vitest';
import type { SaveSlot } from '@woodgrain-88/kit';
import {
  addDoodle,
  DOODLE_GALLERY_SIZE,
  emptySave,
  finishTutorial,
  readSave,
  recordKey,
  recordMatch,
  SAVE_VERSION,
  writeSave,
  type DoodleEntry,
  type FinishedMatch,
  type TrailblazeSave,
} from '../../src/app/save.ts';

interface MemorySaveSlot extends SaveSlot {
  readonly storedVersion: number | null;
  readonly storedState: unknown;
}

function createMemorySaveSlot(): MemorySaveSlot {
  let storedVersion: number | null = null;
  let storedState: unknown = null;

  return {
    get storedVersion() {
      return storedVersion;
    },
    get storedState() {
      return storedState;
    },
    load(version: number): unknown {
      return storedVersion === version ? storedState : null;
    },
    store(version: number, state: unknown): void {
      storedVersion = version;
      storedState = state;
    },
    clear(): void {
      storedVersion = null;
      storedState = null;
    },
  };
}

describe('Trailblaze save', () => {
  describe('emptySave', () => {
    it('returns an empty save with default fields and SAVE_VERSION', () => {
      const save = emptySave();
      expect(save.version).toBe(SAVE_VERSION);
      expect(save.records).toEqual({});
      expect(save.doodles).toEqual([]);
      expect(save.tutorialDone).toBe(false);
    });
  });

  describe('recordKey forms', () => {
    it('formats record key for kid opponents using channel, kid id, and memory mode', () => {
      expect(recordKey('game-3', { kind: 'kid', kid: 'rosa' }, 'human')).toBe(
        'game-3|kid:rosa|human',
      );
      expect(recordKey('game-4', { kind: 'kid', kid: 'dee' }, 'sharp')).toBe(
        'game-4|kid:dee|sharp',
      );
    });

    it('formats record key for computer opponent with dash memory placeholder', () => {
      expect(recordKey('game-2', { kind: 'computer' }, 'human')).toBe('game-2|computer|-');
      expect(recordKey('game-2', { kind: 'computer' }, 'sharp')).toBe('game-2|computer|-');
    });

    it('formats record key for person opponent with dash memory placeholder', () => {
      expect(recordKey('game-1', { kind: 'person' }, 'human')).toBe('game-1|person|-');
      expect(recordKey('game-1', { kind: 'person' }, 'sharp')).toBe('game-1|person|-');
    });
  });

  describe('recordMatch', () => {
    it('records a win, tracks margin, and updates longest ride', () => {
      const initial = emptySave();
      const match: FinishedMatch = {
        channelId: 'game-1',
        opponent: { kind: 'kid', kid: 'rosa' },
        memory: 'human',
        playerScore: 10,
        rivalScore: 4,
        longestRideSeconds: 14.5,
      };

      const result = recordMatch(initial, match);
      const key = recordKey('game-1', { kind: 'kid', kid: 'rosa' }, 'human');

      expect(result.records[key]).toEqual({
        played: 1,
        won: 1,
        lost: 0,
        bestMargin: 6,
        longestRide: 14.5,
      });
      // Immutability: initial remains unchanged
      expect(initial.records[key]).toBeUndefined();
    });

    it('records a loss without updating best margin', () => {
      const initial = emptySave();
      const lossMatch: FinishedMatch = {
        channelId: 'game-1',
        opponent: { kind: 'computer' },
        memory: 'human',
        playerScore: 3,
        rivalScore: 10,
        longestRideSeconds: 8.2,
      };

      const result = recordMatch(initial, lossMatch);
      const key = recordKey('game-1', { kind: 'computer' }, 'human');

      expect(result.records[key]).toEqual({
        played: 1,
        won: 0,
        lost: 1,
        bestMargin: 0,
        longestRide: 8.2,
      });
    });

    it('records a tie as played but neither won nor lost', () => {
      const initial = emptySave();
      const tieMatch: FinishedMatch = {
        channelId: 'game-2',
        opponent: { kind: 'person' },
        memory: 'human',
        playerScore: 10,
        rivalScore: 10,
        longestRideSeconds: 22.0,
      };

      const result = recordMatch(initial, tieMatch);
      const key = recordKey('game-2', { kind: 'person' }, 'human');

      expect(result.records[key]).toEqual({
        played: 1,
        won: 0,
        lost: 0,
        bestMargin: 0,
        longestRide: 22.0,
      });
    });

    it('maintains bestMargin and longestRide as running maxima across matches', () => {
      let save = emptySave();
      const opponent = { kind: 'kid' as const, kid: 'pip' as const };

      // Match 1: Win 10–4 (margin 6, ride 12s)
      save = recordMatch(save, {
        channelId: 'game-1',
        opponent,
        memory: 'human',
        playerScore: 10,
        rivalScore: 4,
        longestRideSeconds: 12.0,
      });
      const key = recordKey('game-1', opponent, 'human');
      expect(save.records[key]?.bestMargin).toBe(6);
      expect(save.records[key]?.longestRide).toBe(12.0);

      // Match 2: Win 10–8 (margin 2, ride 18s): margin stays 6, ride increases to 18s
      save = recordMatch(save, {
        channelId: 'game-1',
        opponent,
        memory: 'human',
        playerScore: 10,
        rivalScore: 8,
        longestRideSeconds: 18.0,
      });
      expect(save.records[key]?.played).toBe(2);
      expect(save.records[key]?.won).toBe(2);
      expect(save.records[key]?.bestMargin).toBe(6);
      expect(save.records[key]?.longestRide).toBe(18.0);

      // Match 3: Win 10–1 (margin 9, ride 15s): margin increases to 9, ride stays 18s
      save = recordMatch(save, {
        channelId: 'game-1',
        opponent,
        memory: 'human',
        playerScore: 10,
        rivalScore: 1,
        longestRideSeconds: 15.0,
      });
      expect(save.records[key]?.played).toBe(3);
      expect(save.records[key]?.won).toBe(3);
      expect(save.records[key]?.bestMargin).toBe(9);
      expect(save.records[key]?.longestRide).toBe(18.0);
    });
  });

  describe('addDoodle', () => {
    it('adds doodles newest first and caps the gallery at 12', () => {
      let save = emptySave();

      for (let i = 1; i <= 15; i++) {
        const entry: DoodleEntry = {
          id: `${i * 1000}-game-${i}`,
          channelId: `game-${i}`,
          look: 'neon',
          savedAt: i * 1000,
          board: `board-${i}`,
          filledPercent: i * 5,
        };
        save = addDoodle(save, entry);
      }

      expect(save.doodles).toHaveLength(DOODLE_GALLERY_SIZE);
      expect(save.doodles).toHaveLength(12);
      // Newest first: entry 15 is at index 0, entry 4 is at index 11 (entries 1-3 pushed out)
      expect(save.doodles[0]?.id).toBe('15000-game-15');
      expect(save.doodles[11]?.id).toBe('4000-game-4');
    });

    it('deduplicates by id when re-adding an existing doodle', () => {
      let save = emptySave();
      const entry1: DoodleEntry = {
        id: '100-game-1',
        channelId: 'game-1',
        look: 'neon',
        savedAt: 100,
        board: 'b1',
        filledPercent: 10,
      };
      const entry2: DoodleEntry = {
        id: '200-game-2',
        channelId: 'game-2',
        look: 'ice',
        savedAt: 200,
        board: 'b2',
        filledPercent: 20,
      };

      save = addDoodle(save, entry1);
      save = addDoodle(save, entry2);
      expect(save.doodles).toHaveLength(2);
      expect(save.doodles[0]?.id).toBe('200-game-2');

      // Re-add entry1: moves to front without duplicating
      const reEntry1: DoodleEntry = { ...entry1, filledPercent: 15 };
      save = addDoodle(save, reEntry1);
      expect(save.doodles).toHaveLength(2);
      expect(save.doodles[0]?.id).toBe('100-game-1');
      expect(save.doodles[0]?.filledPercent).toBe(15);
      expect(save.doodles[1]?.id).toBe('200-game-2');
    });
  });

  describe('finishTutorial', () => {
    it('marks tutorialDone as true without modifying original save', () => {
      const initial = emptySave();
      const finished = finishTutorial(initial);

      expect(initial.tutorialDone).toBe(false);
      expect(finished.tutorialDone).toBe(true);
    });
  });

  describe('readSave and writeSave round trip and tolerant parsing', () => {
    it('returns emptySave when loading from empty slot or wrong version', () => {
      const slot = createMemorySaveSlot();
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(999, { tutorialDone: true });
      expect(readSave(slot)).toEqual(emptySave());
    });

    it('returns emptySave when slot contains garbage or non-object', () => {
      const slot = createMemorySaveSlot();

      slot.store(SAVE_VERSION, null);
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(SAVE_VERSION, 'not-a-save');
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(SAVE_VERSION, 42);
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(SAVE_VERSION, [1, 2, 3]);
      expect(readSave(slot)).toEqual(emptySave());
    });

    it('sanitizes corrupted fields and retains valid ones', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        records: {
          'valid-key': { played: 5, won: 3, lost: 2, bestMargin: 4, longestRide: 16.5 },
          'negative-lost': { played: 5, won: 3, lost: -1, bestMargin: 4, longestRide: 16.5 },
          'invalid-line': 'garbage',
          '': { played: 1, won: 1, lost: 0, bestMargin: 1, longestRide: 1 },
        },
        doodles: [
          {
            id: '123-game-1',
            channelId: 'game-1',
            look: 'neon',
            savedAt: 123,
            board: 'packed-board',
            filledPercent: 45,
          },
          { id: '', channelId: 'game-2', look: 'invalid-look' },
          'not-a-doodle',
        ],
        tutorialDone: true,
      });

      const loaded = readSave(slot);
      expect(Object.keys(loaded.records)).toEqual(['valid-key']);
      expect(loaded.records['valid-key']).toEqual({
        played: 5,
        won: 3,
        lost: 2,
        bestMargin: 4,
        longestRide: 16.5,
      });
      expect(loaded.doodles).toHaveLength(1);
      expect(loaded.doodles[0]?.id).toBe('123-game-1');
      expect(loaded.tutorialDone).toBe(true);
    });

    it('writes and reads a populated save state accurately', () => {
      const slot = createMemorySaveSlot();
      const original: TrailblazeSave = {
        version: SAVE_VERSION,
        records: {
          'game-1|kid:rosa|human': {
            played: 8,
            won: 6,
            lost: 2,
            bestMargin: 7,
            longestRide: 21.4,
          },
        },
        doodles: [
          {
            id: '1700000000000-game-1',
            channelId: 'game-1',
            look: 'ice',
            savedAt: 1700000000000,
            board: 'encoded-board-string',
            filledPercent: 35,
          },
        ],
        tutorialDone: true,
      };

      writeSave(slot, original);
      expect(slot.storedVersion).toBe(SAVE_VERSION);

      const restored = readSave(slot);
      expect(restored).toEqual(original);
    });
  });
});
