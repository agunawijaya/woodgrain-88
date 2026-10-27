/**
 * Tests for Tank Duel settings: defaults, per-field fallback validation,
 * clamping volumes, granular updates storing only changed keys, and change listeners.
 */
import { describe, expect, it } from 'vitest';
import type { GameSettingsStore } from '@woodgrain-88/kit';
import {
  createTankSettings,
  DEFAULT_TANK_SETTINGS,
  type TankSettings,
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

describe('settings', () => {
  describe('defaults', () => {
    it('returns default settings when store is empty', () => {
      const store = createMemorySettingsStore();
      const settings = createTankSettings(store);

      expect(settings.get()).toEqual(DEFAULT_TANK_SETTINGS);
      expect(settings.get()).toEqual({
        scoring: 'timed',
        wiring: false,
        reverseGear: false,
        ownRicochets: false,
        aimLine: false,
        explosions: 'full',
        teamColours: 'standard',
        engineVolume: 0.5,
        effectsVolume: 0.8,
      });
    });
  });

  describe('per-field fallback for junk values', () => {
    it('falls back to field defaults when stored values have wrong type or invalid enum', () => {
      const store = createMemorySettingsStore({
        'tank.scoring': 'speed-run',
        'tank.wiring': 'enabled',
        'tank.aimLine': 1,
        'tank.explosions': 'massive',
        'tank.teamColours': 'monochrome',
        'tank.engineVolume': 'quiet',
        'tank.effectsVolume': null,
      });
      const settings = createTankSettings(store);

      expect(settings.get()).toEqual(DEFAULT_TANK_SETTINGS);
    });

    it('falls back per-field so valid entries are retained alongside invalid ones', () => {
      const store = createMemorySettingsStore({
        'tank.scoring': 'first-to-10',
        'tank.wiring': true,
        'tank.aimLine': 'invalid',
        'tank.explosions': 'reduced',
        'tank.teamColours': 123,
        'tank.engineVolume': 0.2,
        'tank.effectsVolume': Number.NaN,
      });
      const settings = createTankSettings(store);

      expect(settings.get()).toEqual({
        scoring: 'first-to-10',
        wiring: true,
        reverseGear: false,
        ownRicochets: false,
        aimLine: false,
        explosions: 'reduced',
        teamColours: 'standard',
        engineVolume: 0.2,
        effectsVolume: 0.8,
      });
    });

    it('handles colour-blind team colours and non-finite volume numbers', () => {
      const store = createMemorySettingsStore({
        'tank.teamColours': 'colour-blind',
        'tank.engineVolume': Number.POSITIVE_INFINITY,
        'tank.effectsVolume': Number.NEGATIVE_INFINITY,
      });
      const settings = createTankSettings(store);

      expect(settings.get().teamColours).toBe('colour-blind');
      expect(settings.get().engineVolume).toBe(0.5);
      expect(settings.get().effectsVolume).toBe(0.8);
    });
  });

  describe('volume clamping', () => {
    it('clamps volume numbers outside 0 to 1 range', () => {
      const store = createMemorySettingsStore({
        'tank.engineVolume': 1.4,
        'tank.effectsVolume': -0.3,
      });
      const settings = createTankSettings(store);

      expect(settings.get().engineVolume).toBe(1);
      expect(settings.get().effectsVolume).toBe(0);
    });

    it('clamps volume values provided in update calls', () => {
      const store = createMemorySettingsStore();
      const settings = createTankSettings(store);

      settings.update({ engineVolume: 2.5, effectsVolume: -1 });

      expect(settings.get().engineVolume).toBe(1);
      expect(settings.get().effectsVolume).toBe(0);
      expect(store.setCalls).toEqual([
        { key: 'tank.engineVolume', value: 1 },
        { key: 'tank.effectsVolume', value: 0 },
      ]);
    });
  });

  describe('update behaviour', () => {
    it('stores changed keys only and notifies listeners once', () => {
      const store = createMemorySettingsStore();
      const settings = createTankSettings(store);
      const notifications: TankSettings[] = [];

      settings.onChange((next) => {
        notifications.push(next);
      });

      const updated = settings.update({ wiring: true });

      expect(store.setCalls).toEqual([{ key: 'tank.wiring', value: true }]);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.wiring).toBe(true);
      expect(updated.wiring).toBe(true);
    });

    it('stores multiple changed keys and notifies once per batch update', () => {
      const store = createMemorySettingsStore();
      const settings = createTankSettings(store);
      let callCount = 0;

      settings.onChange(() => {
        callCount++;
      });

      settings.update({
        scoring: 'first-to-10',
        aimLine: true,
        explosions: 'reduced',
      });

      expect(store.setCalls).toEqual([
        { key: 'tank.scoring', value: 'first-to-10' },
        { key: 'tank.aimLine', value: true },
        { key: 'tank.explosions', value: 'reduced' },
      ]);
      expect(callCount).toBe(1);
    });

    it('does not store or notify for no-op updates', () => {
      const store = createMemorySettingsStore();
      const settings = createTankSettings(store);
      let callCount = 0;

      settings.onChange(() => {
        callCount++;
      });

      const result1 = settings.update({});
      expect(store.setCalls).toHaveLength(0);
      expect(callCount).toBe(0);
      expect(result1).toEqual(DEFAULT_TANK_SETTINGS);

      const result2 = settings.update({ wiring: false });
      expect(store.setCalls).toHaveLength(0);
      expect(callCount).toBe(0);
      expect(result2).toEqual(DEFAULT_TANK_SETTINGS);

      // Volume already default 0.5
      settings.update({ engineVolume: 0.5 });
      expect(store.setCalls).toHaveLength(0);
      expect(callCount).toBe(0);
    });
  });

  describe('onChange subscription', () => {
    it('stops notifying when unsubscribe is called', () => {
      const store = createMemorySettingsStore();
      const settings = createTankSettings(store);
      let callCount = 0;

      const unsubscribe = settings.onChange(() => {
        callCount++;
      });

      settings.update({ aimLine: true });
      expect(callCount).toBe(1);

      unsubscribe();

      settings.update({ aimLine: false });
      expect(callCount).toBe(1);
      expect(settings.get().aimLine).toBe(false);
    });
  });
});
