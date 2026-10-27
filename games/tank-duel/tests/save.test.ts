/**
 * Tests for Tank Duel save storage: empty save defaults, round-trip serialization,
 * resilient parsing of corrupted data, match recording, and tutorial completion.
 */
import { describe, expect, it } from 'vitest';
import { KID_IDS, type SaveSlot } from '@woodgrain-88/kit';
import {
  emptySave,
  finishTutorial,
  readSave,
  recordMatch,
  SAVE_VERSION,
  writeSave,
  type FinishedMatch,
  type TankSave,
} from '../src/app/save.ts';

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

describe('save', () => {
  describe('empty save and empty slot', () => {
    it('returns a well-formed empty save with zero records for all neighbourhood kids', () => {
      const empty = emptySave();

      expect(empty.bestBank).toBeNull();
      expect(empty.played).toEqual({});
      expect(empty.tutorialDone).toBe(false);

      for (const kid of KID_IDS) {
        expect(empty.kids[kid]).toEqual({ wins: 0, losses: 0, draws: 0 });
      }
    });

    it('returns emptySave when reading from an empty save slot', () => {
      const slot = createMemorySaveSlot();
      const loaded = readSave(slot);

      expect(loaded).toEqual(emptySave());
    });
  });

  describe('writeSave and readSave round trip', () => {
    it('writes and reads a populated save state accurately', () => {
      const slot = createMemorySaveSlot();
      const base = emptySave();
      const populated: TankSave = {
        kids: {
          ...base.kids,
          dee: { wins: 4, losses: 1, draws: 1 },
          lou: { wins: 2, losses: 5, draws: 0 },
        },
        bestBank: {
          bounces: 3,
          channel: 'game-6',
          at: '2026-10-26T12:00:00.000Z',
        },
        played: {
          'game-1': 8,
          'game-6': 5,
        },
        tutorialDone: true,
      };

      writeSave(slot, populated);
      expect(slot.storedVersion).toBe(SAVE_VERSION);

      const restored = readSave(slot);
      expect(restored).toEqual(populated);
    });
  });

  describe('junk data handling', () => {
    it('returns an empty save when slot contains non-object or null data', () => {
      const slot = createMemorySaveSlot();

      slot.store(SAVE_VERSION, null);
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(SAVE_VERSION, 'corrupt-string');
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(SAVE_VERSION, 42);
      expect(readSave(slot)).toEqual(emptySave());

      slot.store(SAVE_VERSION, [1, 2, 3]);
      expect(readSave(slot)).toEqual(emptySave());
    });

    it('drops unknown kid ids and supplies zero records for missing kid ids', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        kids: {
          unknownKid: { wins: 10, losses: 0, draws: 0 },
          dee: { wins: 3, losses: 2, draws: 1 },
        },
      });

      const loaded = readSave(slot);
      expect('unknownKid' in loaded.kids).toBe(false);
      expect(loaded.kids.dee).toEqual({ wins: 3, losses: 2, draws: 1 });
      expect(loaded.kids.moss).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.pip).toEqual({ wins: 0, losses: 0, draws: 0 });
    });

    it('zeros kid records that contain negative, non-integer, or non-numeric counts', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        kids: {
          dee: { wins: -1, losses: 0, draws: 0 },
          moss: { wins: 2.5, losses: 0, draws: 0 },
          pip: { wins: 'three', losses: 0, draws: 0 },
          lou: { wins: 1 },
          rosa: null,
          benny: { wins: 2, losses: 1, draws: 0 },
        },
      });

      const loaded = readSave(slot);
      expect(loaded.kids.dee).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.moss).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.pip).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.lou).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.rosa).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.benny).toEqual({ wins: 2, losses: 1, draws: 0 });
    });

    it('validates bestBank and reverts to null if bounces, channel, or at are invalid', () => {
      const slot = createMemorySaveSlot();

      // Zero bounces is not a positive integer
      slot.store(SAVE_VERSION, {
        bestBank: { bounces: 0, channel: 'game-6', at: '2026-10-26T12:00:00Z' },
      });
      expect(readSave(slot).bestBank).toBeNull();

      // Negative bounces
      slot.store(SAVE_VERSION, {
        bestBank: { bounces: -3, channel: 'game-6', at: '2026-10-26T12:00:00Z' },
      });
      expect(readSave(slot).bestBank).toBeNull();

      // Non-integer bounces
      slot.store(SAVE_VERSION, {
        bestBank: { bounces: 2.5, channel: 'game-6', at: '2026-10-26T12:00:00Z' },
      });
      expect(readSave(slot).bestBank).toBeNull();

      // Missing or non-string channel / at
      slot.store(SAVE_VERSION, {
        bestBank: { bounces: 2, channel: 123, at: '2026-10-26T12:00:00Z' },
      });
      expect(readSave(slot).bestBank).toBeNull();

      slot.store(SAVE_VERSION, {
        bestBank: { bounces: 2, channel: 'game-6', at: false },
      });
      expect(readSave(slot).bestBank).toBeNull();
    });

    it('filters out negative or non-integer played channel counts', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        played: {
          'game-1': 5,
          'game-2': -1,
          'game-3': 3.5,
          'game-4': 'nine',
          'game-5': null,
        },
      });

      const loaded = readSave(slot);
      expect(loaded.played).toEqual({ 'game-1': 5 });
    });

    it('defaults tutorialDone to false when invalid or missing', () => {
      const slot = createMemorySaveSlot();

      slot.store(SAVE_VERSION, { tutorialDone: 'finished' });
      expect(readSave(slot).tutorialDone).toBe(false);

      slot.store(SAVE_VERSION, { tutorialDone: 1 });
      expect(readSave(slot).tutorialDone).toBe(false);

      slot.store(SAVE_VERSION, { tutorialDone: true });
      expect(readSave(slot).tutorialDone).toBe(true);
    });
  });

  describe('version mismatch', () => {
    it('returns emptySave when stored version does not match SAVE_VERSION', () => {
      const slot = createMemorySaveSlot();
      slot.store(999, {
        tutorialDone: true,
        played: { 'game-1': 20 },
      });

      expect(readSave(slot)).toEqual(emptySave());
    });
  });

  describe('recordMatch', () => {
    it('records win, loss, and draw against a Kid', () => {
      const initial = emptySave();

      const winMatch: FinishedMatch = {
        channel: 'game-1',
        kid: 'dee',
        outcome: 'win',
        bestBank: 0,
        at: '2026-10-26T10:00:00Z',
      };
      const afterWin = recordMatch(initial, winMatch);
      expect(afterWin.kids.dee).toEqual({ wins: 1, losses: 0, draws: 0 });

      const lossMatch: FinishedMatch = {
        channel: 'game-1',
        kid: 'moss',
        outcome: 'loss',
        bestBank: 0,
        at: '2026-10-26T10:05:00Z',
      };
      const afterLoss = recordMatch(afterWin, lossMatch);
      expect(afterLoss.kids.moss).toEqual({ wins: 0, losses: 1, draws: 0 });

      const drawMatch: FinishedMatch = {
        channel: 'game-1',
        kid: 'pip',
        outcome: 'draw',
        bestBank: 0,
        at: '2026-10-26T10:10:00Z',
      };
      const afterDraw = recordMatch(afterLoss, drawMatch);
      expect(afterDraw.kids.pip).toEqual({ wins: 0, losses: 0, draws: 1 });
    });

    it('leaves kid records unchanged when playing against a human opponent', () => {
      const initial = emptySave();
      const matchAgainstHuman: FinishedMatch = {
        channel: 'game-5',
        kid: null,
        outcome: 'win',
        bestBank: 1,
        at: '2026-10-26T10:00:00Z',
      };

      const updated = recordMatch(initial, matchAgainstHuman);
      expect(updated.kids).toEqual(initial.kids);
      expect(updated.played).toEqual({ 'game-5': 1 });
    });

    it('increments channel played count accurately', () => {
      let state = emptySave();

      state = recordMatch(state, {
        channel: 'game-1',
        kid: 'dee',
        outcome: 'win',
        bestBank: 0,
        at: '2026-10-26T10:00:00Z',
      });
      state = recordMatch(state, {
        channel: 'game-1',
        kid: 'dee',
        outcome: 'loss',
        bestBank: 0,
        at: '2026-10-26T10:05:00Z',
      });
      state = recordMatch(state, {
        channel: 'game-6',
        kid: null,
        outcome: 'draw',
        bestBank: 0,
        at: '2026-10-26T10:10:00Z',
      });

      expect(state.played).toEqual({
        'game-1': 2,
        'game-6': 1,
      });
    });

    it('replaces bestBank only when new bestBank is strictly more bounces', () => {
      let state = emptySave();

      // Zero bounces on initial match does not set bestBank
      state = recordMatch(state, {
        channel: 'game-1',
        kid: 'dee',
        outcome: 'win',
        bestBank: 0,
        at: '2026-10-26T10:00:00Z',
      });
      expect(state.bestBank).toBeNull();

      // First banked shot (2 bounces) establishes bestBank
      state = recordMatch(state, {
        channel: 'game-6',
        kid: 'moss',
        outcome: 'win',
        bestBank: 2,
        at: '2026-10-26T10:05:00Z',
      });
      expect(state.bestBank).toEqual({
        bounces: 2,
        channel: 'game-6',
        at: '2026-10-26T10:05:00Z',
      });

      // Equal bounces (2) does not replace
      state = recordMatch(state, {
        channel: 'game-8',
        kid: 'pip',
        outcome: 'win',
        bestBank: 2,
        at: '2026-10-26T10:10:00Z',
      });
      expect(state.bestBank).toEqual({
        bounces: 2,
        channel: 'game-6',
        at: '2026-10-26T10:05:00Z',
      });

      // Fewer bounces (1) does not replace
      state = recordMatch(state, {
        channel: 'game-6',
        kid: 'lou',
        outcome: 'loss',
        bestBank: 1,
        at: '2026-10-26T10:15:00Z',
      });
      expect(state.bestBank?.bounces).toBe(2);

      // Strictly more bounces (4) replaces bestBank
      state = recordMatch(state, {
        channel: 'game-8',
        kid: 'rosa',
        outcome: 'win',
        bestBank: 4,
        at: '2026-10-26T10:20:00Z',
      });
      expect(state.bestBank).toEqual({
        bounces: 4,
        channel: 'game-8',
        at: '2026-10-26T10:20:00Z',
      });
    });

    it('does not mutate its input save state', () => {
      const initial = emptySave();
      const match: FinishedMatch = {
        channel: 'game-1',
        kid: 'dee',
        outcome: 'win',
        bestBank: 3,
        at: '2026-10-26T10:00:00Z',
      };

      const result = recordMatch(initial, match);
      expect(initial.played).toEqual({});
      expect(initial.bestBank).toBeNull();
      expect(initial.kids.dee).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(result).not.toBe(initial);
    });
  });

  describe('finishTutorial', () => {
    it('sets tutorialDone to true without mutating input save', () => {
      const initial = emptySave();
      const updated = finishTutorial(initial);

      expect(initial.tutorialDone).toBe(false);
      expect(updated.tutorialDone).toBe(true);
      expect(updated.kids).toBe(initial.kids);
      expect(updated.bestBank).toBe(initial.bestBank);
      expect(updated.played).toBe(initial.played);
    });
  });
});
