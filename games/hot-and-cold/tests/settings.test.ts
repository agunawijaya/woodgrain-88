/**
 * Tests for Hot & Cold settings: defaults, per-field fallback validation,
 * volume clamping, granular updates storing only changed keys, and change listeners.
 */
import { describe, expect, it } from 'vitest';
import type { GameSettingsStore } from '@woodgrain-88/kit';
import {
  createHotColdSettings,
  DEFAULT_HOT_COLD_SETTINGS,
  type HotColdSettings,
} from '../src/app/settings.ts';

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

describe('Hot & Cold settings', () => {
  describe('defaults', () => {
    it('returns default settings when store is empty', () => {
      const store = createMemorySettingsStore();
      const settings = createHotColdSettings(store);

      expect(settings.get()).toEqual(DEFAULT_HOT_COLD_SETTINGS);
      expect(settings.get()).toEqual({
        look: 'polar',
        clues: 'notebook',
        fog: false,
        matchLength: 'cartridge',
        clueColours: 'standard',
        seatColours: 'standard',
        effects: 'full',
        effectsVolume: 0.8,
      });
    });
  });

  describe('per-field fallback for junk values', () => {
    it('falls back to field defaults when stored values have wrong type or invalid enum', () => {
      const store = createMemorySettingsStore({
        'hc.look': 'cosmic',
        'hc.clues': 'cheatsheet',
        'hc.fog': 'yes',
        'hc.matchLength': 'infinite',
        'hc.clueColours': 'neon',
        'hc.seatColours': 'rainbow',
        'hc.effects': 'ultra',
        'hc.effectsVolume': 'loud',
      });
      const settings = createHotColdSettings(store);

      expect(settings.get()).toEqual(DEFAULT_HOT_COLD_SETTINGS);
    });

    it('falls back per-field so valid entries are retained alongside invalid ones', () => {
      const store = createMemorySettingsStore({
        'hc.look': 'radar',
        'hc.clues': 'invalid-mode',
        'hc.fog': true,
        'hc.matchLength': 99,
        'hc.clueColours': 'colour-blind',
        'hc.seatColours': 'invalid-colours',
        'hc.effects': 'reduced',
        'hc.effectsVolume': Number.NaN,
      });
      const settings = createHotColdSettings(store);

      expect(settings.get()).toEqual({
        look: 'radar',
        clues: 'notebook',
        fog: true,
        matchLength: 'cartridge',
        clueColours: 'colour-blind',
        seatColours: 'standard',
        effects: 'reduced',
        effectsVolume: 0.8,
      });
    });

    it('handles tabletop look, classic clues, short match, colour-blind seat colours, and non-finite volumes', () => {
      const store = createMemorySettingsStore({
        'hc.look': 'tabletop',
        'hc.clues': 'classic',
        'hc.matchLength': 'short',
        'hc.seatColours': 'colour-blind',
        'hc.effectsVolume': Number.POSITIVE_INFINITY,
      });
      const settings = createHotColdSettings(store);

      expect(settings.get().look).toBe('tabletop');
      expect(settings.get().clues).toBe('classic');
      expect(settings.get().matchLength).toBe('short');
      expect(settings.get().seatColours).toBe('colour-blind');
      expect(settings.get().effectsVolume).toBe(0.8);
    });
  });

  describe('volume clamping', () => {
    it('clamps volume numbers outside 0 to 1 range when loaded from store', () => {
      const storeHigh = createMemorySettingsStore({ 'hc.effectsVolume': 1.5 });
      const settingsHigh = createHotColdSettings(storeHigh);
      expect(settingsHigh.get().effectsVolume).toBe(1);

      const storeLow = createMemorySettingsStore({ 'hc.effectsVolume': -0.3 });
      const settingsLow = createHotColdSettings(storeLow);
      expect(settingsLow.get().effectsVolume).toBe(0);
    });

    it('clamps volume values provided in update calls', () => {
      const store = createMemorySettingsStore();
      const settings = createHotColdSettings(store);

      settings.update({ effectsVolume: 2.5 });

      expect(settings.get().effectsVolume).toBe(1);
      expect(store.setCalls).toEqual([{ key: 'hc.effectsVolume', value: 1 }]);

      settings.update({ effectsVolume: -0.5 });
      expect(settings.get().effectsVolume).toBe(0);
      expect(store.setCalls).toEqual([
        { key: 'hc.effectsVolume', value: 1 },
        { key: 'hc.effectsVolume', value: 0 },
      ]);
    });
  });

  describe('update behaviour', () => {
    it('stores changed keys only under hc.<field> and notifies listeners once', () => {
      const store = createMemorySettingsStore();
      const settings = createHotColdSettings(store);
      const notifications: HotColdSettings[] = [];

      settings.onChange((next) => {
        notifications.push(next);
      });

      const updated = settings.update({ fog: true });

      expect(store.setCalls).toEqual([{ key: 'hc.fog', value: true }]);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.fog).toBe(true);
      expect(updated.fog).toBe(true);
    });

    it('stores multiple changed keys and notifies once per batch update', () => {
      const store = createMemorySettingsStore();
      const settings = createHotColdSettings(store);
      let callCount = 0;

      settings.onChange(() => {
        callCount++;
      });

      settings.update({
        look: 'tabletop',
        clues: 'classic',
        matchLength: 'short',
        effects: 'reduced',
      });

      expect(store.setCalls).toEqual([
        { key: 'hc.look', value: 'tabletop' },
        { key: 'hc.clues', value: 'classic' },
        { key: 'hc.matchLength', value: 'short' },
        { key: 'hc.effects', value: 'reduced' },
      ]);
      expect(callCount).toBe(1);
    });

    it('does not store or notify for no-op updates', () => {
      const store = createMemorySettingsStore();
      const settings = createHotColdSettings(store);
      let callCount = 0;

      settings.onChange(() => {
        callCount++;
      });

      const result1 = settings.update({});
      expect(store.setCalls).toHaveLength(0);
      expect(callCount).toBe(0);
      expect(result1).toEqual(DEFAULT_HOT_COLD_SETTINGS);

      const result2 = settings.update({ fog: false });
      expect(store.setCalls).toHaveLength(0);
      expect(callCount).toBe(0);
      expect(result2).toEqual(DEFAULT_HOT_COLD_SETTINGS);

      // Volume is already default 0.8
      settings.update({ effectsVolume: 0.8 });
      expect(store.setCalls).toHaveLength(0);
      expect(callCount).toBe(0);
    });
  });

  describe('onChange subscription', () => {
    it('stops notifying when unsubscribe is called', () => {
      const store = createMemorySettingsStore();
      const settings = createHotColdSettings(store);
      let callCount = 0;

      const unsubscribe = settings.onChange(() => {
        callCount++;
      });

      settings.update({ fog: true });
      expect(callCount).toBe(1);

      unsubscribe();

      settings.update({ fog: false });
      expect(callCount).toBe(1);
      expect(settings.get().fog).toBe(false);
    });
  });
});
