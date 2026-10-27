/**
 * Tests for Hot & Cold save storage: empty save defaults, round-trip serialization,
 * resilient parsing of corrupted data, match recording, clean flag streaks, and tutorial completion.
 */
import { describe, expect, it } from 'vitest';
import { KID_IDS, type SaveSlot } from '@woodgrain-88/kit';
import {
  boardKey,
  emptySave,
  finishTutorial,
  readSave,
  recordBomb,
  recordFlag,
  recordMatch,
  SAVE_VERSION,
  writeSave,
  type FinishedMatch,
  type HotColdSave,
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

describe('Hot & Cold save', () => {
  describe('empty save and empty slot', () => {
    it('returns a well-formed empty save with zero records for all neighbourhood kids', () => {
      const empty = emptySave();

      expect(empty.played).toEqual({});
      expect(empty.bests).toEqual({});
      expect(empty.cleanStreak).toBe(0);
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

  describe('boardKey helper', () => {
    it('constructs board key with channel, mode, clues, and memory', () => {
      const key1 = boardKey('ice-field', 'solo', 'notebook', 'human');
      expect(key1).toBe('ice-field|solo|notebook|human');

      const key2 = boardKey('radar-net', 'versus', 'classic', 'sharp');
      expect(key2).toBe('radar-net|versus|classic|sharp');
    });
  });

  describe('writeSave and readSave round trip', () => {
    it('writes and reads a populated save state accurately', () => {
      const slot = createMemorySaveSlot();
      const base = emptySave();
      const populated: HotColdSave = {
        kids: {
          ...base.kids,
          dee: { wins: 5, losses: 2, draws: 1 },
          moss: { wins: 3, losses: 4, draws: 0 },
        },
        played: {
          'ice-field': 12,
          'radar-net': 7,
        },
        bests: {
          'ice-field|solo|notebook|human': {
            score: 18,
            label: '18 flags',
            at: '2026-10-27T10:00:00.000Z',
          },
        },
        cleanStreak: 4,
        tutorialDone: true,
      };

      writeSave(slot, populated);
      expect(slot.storedVersion).toBe(SAVE_VERSION);

      const restored = readSave(slot);
      expect(restored).toEqual(populated);
    });
  });

  describe('version mismatch', () => {
    it('returns emptySave when stored version does not match SAVE_VERSION', () => {
      const slot = createMemorySaveSlot();
      slot.store(999, {
        tutorialDone: true,
        cleanStreak: 10,
        played: { 'ice-field': 5 },
      });

      expect(readSave(slot)).toEqual(emptySave());
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
          stranger: { wins: 10, losses: 0, draws: 0 },
          dee: { wins: 4, losses: 1, draws: 2 },
        },
      });

      const loaded = readSave(slot);
      expect('stranger' in loaded.kids).toBe(false);
      expect(loaded.kids.dee).toEqual({ wins: 4, losses: 1, draws: 2 });
      expect(loaded.kids.moss).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.pip).toEqual({ wins: 0, losses: 0, draws: 0 });
    });

    it('zeros kid records that contain negative, non-integer, or non-numeric counts', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        kids: {
          dee: { wins: -1, losses: 0, draws: 0 },
          moss: { wins: 1.5, losses: 0, draws: 0 },
          pip: { wins: 'two', losses: 0, draws: 0 },
          lou: { wins: 1 },
          rosa: null,
          benny: { wins: 3, losses: 1, draws: 0 },
        },
      });

      const loaded = readSave(slot);
      expect(loaded.kids.dee).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.moss).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.pip).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.lou).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.rosa).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(loaded.kids.benny).toEqual({ wins: 3, losses: 1, draws: 0 });
    });

    it('filters out negative or non-integer played channel counts', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        played: {
          'channel-1': 8,
          'channel-2': -2,
          'channel-3': 4.5,
          'channel-4': 'ten',
          'channel-5': null,
          '': 3,
        },
      });

      const loaded = readSave(slot);
      expect(loaded.played).toEqual({ 'channel-1': 8 });
    });

    it('validates bests entries and keeps only those with finite scores and non-empty strings', () => {
      const slot = createMemorySaveSlot();
      slot.store(SAVE_VERSION, {
        bests: {
          validRun: { score: 10, label: '10 flags', at: '2026-10-27T10:00:00Z' },
          nanScore: { score: Number.NaN, label: '10 flags', at: '2026-10-27T10:00:00Z' },
          infScore: {
            score: Number.POSITIVE_INFINITY,
            label: '10 flags',
            at: '2026-10-27T10:00:00Z',
          },
          emptyLabel: { score: 10, label: '', at: '2026-10-27T10:00:00Z' },
          nonStringLabel: { score: 10, label: 123, at: '2026-10-27T10:00:00Z' },
          emptyAt: { score: 10, label: '10 flags', at: '' },
          nonStringAt: { score: 10, label: '10 flags', at: null },
          notAnObject: 'garbage',
          '': { score: 10, label: 'empty-key', at: '2026-10-27T10:00:00Z' },
        },
      });

      const loaded = readSave(slot);
      expect(loaded.bests).toEqual({
        validRun: { score: 10, label: '10 flags', at: '2026-10-27T10:00:00Z' },
      });
    });

    it('defaults cleanStreak to 0 when negative, non-integer, or non-numeric', () => {
      const slot = createMemorySaveSlot();

      slot.store(SAVE_VERSION, { cleanStreak: -5 });
      expect(readSave(slot).cleanStreak).toBe(0);

      slot.store(SAVE_VERSION, { cleanStreak: 2.5 });
      expect(readSave(slot).cleanStreak).toBe(0);

      slot.store(SAVE_VERSION, { cleanStreak: 'seven' });
      expect(readSave(slot).cleanStreak).toBe(0);

      slot.store(SAVE_VERSION, { cleanStreak: null });
      expect(readSave(slot).cleanStreak).toBe(0);

      slot.store(SAVE_VERSION, { cleanStreak: 6 });
      expect(readSave(slot).cleanStreak).toBe(6);
    });

    it('defaults tutorialDone to false when invalid or missing', () => {
      const slot = createMemorySaveSlot();

      slot.store(SAVE_VERSION, { tutorialDone: 'yes' });
      expect(readSave(slot).tutorialDone).toBe(false);

      slot.store(SAVE_VERSION, { tutorialDone: 1 });
      expect(readSave(slot).tutorialDone).toBe(false);

      slot.store(SAVE_VERSION, { tutorialDone: true });
      expect(readSave(slot).tutorialDone).toBe(true);
    });
  });

  describe('recordMatch', () => {
    it('records win, loss, and draw against a Kid', () => {
      const initial = emptySave();

      const winMatch: FinishedMatch = {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'win',
        board: 'b-1',
        score: 10,
        label: '10 flags',
        at: '2026-10-27T10:00:00Z',
      };
      const afterWin = recordMatch(initial, winMatch);
      expect(afterWin.kids.dee).toEqual({ wins: 1, losses: 0, draws: 0 });

      const lossMatch: FinishedMatch = {
        channel: 'ch-1',
        kid: 'moss',
        outcome: 'loss',
        board: 'b-1',
        score: 5,
        label: '5 flags',
        at: '2026-10-27T10:05:00Z',
      };
      const afterLoss = recordMatch(afterWin, lossMatch);
      expect(afterLoss.kids.moss).toEqual({ wins: 0, losses: 1, draws: 0 });

      const drawMatch: FinishedMatch = {
        channel: 'ch-1',
        kid: 'pip',
        outcome: 'draw',
        board: 'b-1',
        score: 7,
        label: '7 flags',
        at: '2026-10-27T10:10:00Z',
      };
      const afterDraw = recordMatch(afterLoss, drawMatch);
      expect(afterDraw.kids.pip).toEqual({ wins: 0, losses: 0, draws: 1 });
    });

    it('leaves kid records unchanged when playing against a human opponent or solo', () => {
      const initial = emptySave();

      const humanMatch: FinishedMatch = {
        channel: 'ch-2',
        kid: null,
        outcome: 'win',
        board: 'b-2',
        score: 12,
        label: '12 flags',
        at: '2026-10-27T10:00:00Z',
      };
      const afterHuman = recordMatch(initial, humanMatch);
      expect(afterHuman.kids).toEqual(initial.kids);
      expect(afterHuman.played).toEqual({ 'ch-2': 1 });

      const soloMatch: FinishedMatch = {
        channel: 'ch-3',
        kid: null,
        outcome: null,
        board: 'b-3',
        score: 15,
        label: '15 flags',
        at: '2026-10-27T10:05:00Z',
      };
      const afterSolo = recordMatch(afterHuman, soloMatch);
      expect(afterSolo.kids).toEqual(initial.kids);
      expect(afterSolo.played).toEqual({ 'ch-2': 1, 'ch-3': 1 });
    });

    it('increments channel played count accurately across matches', () => {
      let state = emptySave();

      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'win',
        board: 'b-1',
        score: 5,
        label: '5 flags',
        at: '2026-10-27T10:00:00Z',
      });
      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'loss',
        board: 'b-1',
        score: 3,
        label: '3 flags',
        at: '2026-10-27T10:05:00Z',
      });
      state = recordMatch(state, {
        channel: 'ch-2',
        kid: null,
        outcome: null,
        board: 'b-2',
        score: 8,
        label: '8 flags',
        at: '2026-10-27T10:10:00Z',
      });

      expect(state.played).toEqual({
        'ch-1': 2,
        'ch-2': 1,
      });
    });

    it('keeps the best per board, replacing on strictly higher score and keeping older on tie', () => {
      let state = emptySave();

      // First run establishes the board best
      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'win',
        board: 'ice-field|solo|notebook|human',
        score: 10,
        label: '10 flags',
        at: '2026-10-27T10:00:00Z',
      });
      expect(state.bests['ice-field|solo|notebook|human']).toEqual({
        score: 10,
        label: '10 flags',
        at: '2026-10-27T10:00:00Z',
      });

      // Lower score (8) does not replace
      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'loss',
        board: 'ice-field|solo|notebook|human',
        score: 8,
        label: '8 flags',
        at: '2026-10-27T10:05:00Z',
      });
      expect(state.bests['ice-field|solo|notebook|human']).toEqual({
        score: 10,
        label: '10 flags',
        at: '2026-10-27T10:00:00Z',
      });

      // Tie score (10) keeps the older run
      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'win',
        board: 'ice-field|solo|notebook|human',
        score: 10,
        label: '10 flags (rematch)',
        at: '2026-10-27T10:10:00Z',
      });
      expect(state.bests['ice-field|solo|notebook|human']).toEqual({
        score: 10,
        label: '10 flags',
        at: '2026-10-27T10:00:00Z',
      });

      // Strictly higher score (14) replaces the best
      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'win',
        board: 'ice-field|solo|notebook|human',
        score: 14,
        label: '14 flags',
        at: '2026-10-27T10:15:00Z',
      });
      expect(state.bests['ice-field|solo|notebook|human']).toEqual({
        score: 14,
        label: '14 flags',
        at: '2026-10-27T10:15:00Z',
      });
    });

    it('does not mutate input save state when recording matches', () => {
      const initial = emptySave();
      const match: FinishedMatch = {
        channel: 'ch-1',
        kid: 'dee',
        outcome: 'win',
        board: 'b-1',
        score: 5,
        label: '5 flags',
        at: '2026-10-27T10:00:00Z',
      };

      const result = recordMatch(initial, match);
      expect(initial.played).toEqual({});
      expect(initial.bests).toEqual({});
      expect(initial.kids.dee).toEqual({ wins: 0, losses: 0, draws: 0 });
      expect(result).not.toBe(initial);
    });
  });

  describe('clean flag streaks and bomb resets', () => {
    it('increments streak on clean flag and resets to zero on bomb or unclean flag', () => {
      let state = emptySave();
      expect(state.cleanStreak).toBe(0);

      // Finding clean flags increments streak
      state = recordFlag(state, true);
      expect(state.cleanStreak).toBe(1);

      state = recordFlag(state, true);
      expect(state.cleanStreak).toBe(2);

      state = recordFlag(state, true);
      expect(state.cleanStreak).toBe(3);

      // Unclean flag resets streak to 0
      state = recordFlag(state, false);
      expect(state.cleanStreak).toBe(0);

      // Building streak again
      state = recordFlag(state, true);
      state = recordFlag(state, true);
      expect(state.cleanStreak).toBe(2);

      // Bomb resets streak to 0
      state = recordBomb(state);
      expect(state.cleanStreak).toBe(0);
    });

    it('preserves cleanStreak across recordMatch calls', () => {
      let state = emptySave();
      state = recordFlag(state, true);
      state = recordFlag(state, true);
      expect(state.cleanStreak).toBe(2);

      state = recordMatch(state, {
        channel: 'ch-1',
        kid: 'moss',
        outcome: 'win',
        board: 'b-1',
        score: 10,
        label: '10 flags',
        at: '2026-10-27T10:00:00Z',
      });

      expect(state.cleanStreak).toBe(2);
    });

    it('does not mutate input save state in recordFlag or recordBomb', () => {
      const initial = emptySave();
      const flagged = recordFlag(initial, true);
      expect(initial.cleanStreak).toBe(0);
      expect(flagged.cleanStreak).toBe(1);

      const bombed = recordBomb(flagged);
      expect(flagged.cleanStreak).toBe(1);
      expect(bombed.cleanStreak).toBe(0);
    });
  });

  describe('finishTutorial', () => {
    it('sets tutorialDone to true without mutating input save', () => {
      const initial = emptySave();
      const updated = finishTutorial(initial);

      expect(initial.tutorialDone).toBe(false);
      expect(updated.tutorialDone).toBe(true);
      expect(updated.kids).toBe(initial.kids);
      expect(updated.played).toBe(initial.played);
      expect(updated.bests).toBe(initial.bests);
      expect(updated.cleanStreak).toBe(initial.cleanStreak);
    });
  });
});
