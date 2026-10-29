/**
 * Tests for Trailblaze settings: defaults, fake kit settings store round trip,
 * per-field fallbacks for unknown or malformed stored values, and change events.
 */
import { describe, expect, it } from 'vitest';
import type { GameSettingsStore } from '@woodgrain-88/kit';
import {
  createTrailblazeSettings,
  DEFAULT_TRAILBLAZE_SETTINGS,
  type TrailblazeSettings,
} from '../../src/app/settings.ts';

interface TrackedStore extends GameSettingsStore {
  readonly values: Map<string, unknown>;
  readonly setCalls: { key: string; value: unknown }[];
}

function createMemorySettingsStore(initial: Record<string, unknown> = {}): TrackedStore {
  const values = new Map<string, unknown>(Object.entries(initial));
  const setCalls: { key: string; value: unknown }[] = [];

  return {
    values,
    setCalls,
    get<T>(key: string, fallback: T): T {
      const stored = values.get(key);
      return stored === undefined ? fallback : (stored as T);
    },
    set(key: string, value: unknown): void {
      setCalls.push({ key, value });
      values.set(key, value);
    },
  };
}

describe('Trailblaze settings', () => {
  describe('defaults', () => {
    it('returns default settings when store is empty', () => {
      const store = createMemorySettingsStore();
      const settings = createTrailblazeSettings(store);

      expect(settings.get()).toEqual(DEFAULT_TRAILBLAZE_SETTINGS);
      expect(settings.get()).toEqual({
        look: 'neon',
        matchLength: 10,
        colourBlind: false,
        reducedEffects: false,
        camera: 'overhead',
        lastChannel: 'game-1',
        opponent: { kind: 'kid', kid: 'rosa' },
      });
    });
  });

  describe('store round trip', () => {
    it('stores updated fields with tb. prefix and reads them back', () => {
      const store = createMemorySettingsStore();
      const settings = createTrailblazeSettings(store);

      const updated = settings.update({
        look: 'ice',
        matchLength: 5,
        colourBlind: true,
        reducedEffects: true,
        camera: 'chase',
        lastChannel: 'game-7',
        opponent: { kind: 'computer' },
      });

      expect(updated).toEqual({
        look: 'ice',
        matchLength: 5,
        colourBlind: true,
        reducedEffects: true,
        camera: 'chase',
        lastChannel: 'game-7',
        opponent: { kind: 'computer' },
      });

      // A fresh instance over the same store reads the persisted values
      const restored = createTrailblazeSettings(store);
      expect(restored.get()).toEqual(updated);
    });
  });

  describe('per-field fallbacks for junk or malformed values', () => {
    it('falls back to default per field when stored values are malformed or invalid', () => {
      const store = createMemorySettingsStore({
        'tb.look': 'galaxy',
        'tb.matchLength': 99,
        'tb.colourBlind': 'yes',
        'tb.reducedEffects': 1,
        'tb.camera': 'isometric',
        'tb.lastChannel': '',
        'tb.opponent': { kind: 'kid', kid: 'non-existent-kid' },
      });
      const settings = createTrailblazeSettings(store);

      expect(settings.get()).toEqual(DEFAULT_TRAILBLAZE_SETTINGS);
    });

    it('falls back per-field so valid entries are retained alongside invalid ones', () => {
      const store = createMemorySettingsStore({
        'tb.look': 'trains',
        'tb.matchLength': 'fifteen',
        'tb.colourBlind': true,
        'tb.reducedEffects': 'off',
        'tb.camera': 'chase',
        'tb.lastChannel': null,
        'tb.opponent': { kind: 'person' },
      });
      const settings = createTrailblazeSettings(store);

      expect(settings.get()).toEqual({
        look: 'trains',
        matchLength: 10,
        colourBlind: true,
        reducedEffects: false,
        camera: 'chase',
        lastChannel: 'game-1',
        opponent: { kind: 'person' },
      });
    });

    it('validates opponent choices and falls back to Rosa for unknown kids or invalid kinds', () => {
      const storeWithAlien = createMemorySettingsStore({
        'tb.opponent': { kind: 'alien', kid: 'rosa' },
      });
      expect(createTrailblazeSettings(storeWithAlien).get().opponent).toEqual({
        kind: 'kid',
        kid: 'rosa',
      });

      const storeWithCorruptKid = createMemorySettingsStore({
        'tb.opponent': { kind: 'kid', kid: 123 },
      });
      expect(createTrailblazeSettings(storeWithCorruptKid).get().opponent).toEqual({
        kind: 'kid',
        kid: 'rosa',
      });

      const storeWithValidKid = createMemorySettingsStore({
        'tb.opponent': { kind: 'kid', kid: 'dee' },
      });
      expect(createTrailblazeSettings(storeWithValidKid).get().opponent).toEqual({
        kind: 'kid',
        kid: 'dee',
      });
    });
  });

  describe('update and subscriptions', () => {
    it('notifies listeners on update and skips notifications on no-op updates', () => {
      const store = createMemorySettingsStore();
      const settings = createTrailblazeSettings(store);
      const notifications: TrailblazeSettings[] = [];

      const unsubscribe = settings.onChange((s) => notifications.push(s));

      // Real update
      settings.update({ colourBlind: true });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.colourBlind).toBe(true);

      // No-op update: same value does not notify or store
      const setCallCount = store.setCalls.length;
      settings.update({ colourBlind: true });
      expect(notifications).toHaveLength(1);
      expect(store.setCalls.length).toBe(setCallCount);

      // Unsubscribe stops notifications
      unsubscribe();
      settings.update({ colourBlind: false });
      expect(notifications).toHaveLength(1);
      expect(settings.get().colourBlind).toBe(false);
    });
  });
});
