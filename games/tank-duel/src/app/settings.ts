/**
 * Tank Duel's own settings, kept in the game's namespace of the kit settings:
 * the scoring rule, the cartridge wiring, reverse gear, own ricochets, the
 * practice aim line, explosion size, team colours and the sound mix.
 */
import { createEmitter, type GameSettingsStore, type Unsubscribe } from '@woodgrain-88/kit';
import type { ScoringRule } from '../engine/types.ts';

export interface TankSettings {
  /** Timed round (the original) or first to 10. Default 'timed'. */
  readonly scoring: ScoringRule;
  /** The 32-in-1 cartridge's biplane wiring (up and down turn). Default false. */
  readonly wiring: boolean;
  /** Not in 1977: pulling back drives a tank slowly backwards, for everyone. Default false. */
  readonly reverseGear: boolean;
  /** Not in 1977: a shell that has bounced can hit the side that fired it. Default false. */
  readonly ownRicochets: boolean;
  /** Practice only: a faint line showing where a shell would bank. Default false. */
  readonly aimLine: boolean;
  /** Explosion size and smoke. Default 'full'. */
  readonly explosions: 'full' | 'reduced';
  /** Team colours: the standard orange and blue, or a colour-blind-safe pair. Default 'standard'. */
  readonly teamColours: 'standard' | 'colour-blind';
  /** Engine and propeller hum, 0–1. Default 0.5. */
  readonly engineVolume: number;
  /** Shots, pings and explosions, 0–1. Default 0.8. */
  readonly effectsVolume: number;
}

export const DEFAULT_TANK_SETTINGS: TankSettings = {
  scoring: 'timed',
  wiring: false,
  reverseGear: false,
  ownRicochets: false,
  aimLine: false,
  explosions: 'full',
  teamColours: 'standard',
  engineVolume: 0.5,
  effectsVolume: 0.8,
};

export interface TankSettingsStore {
  get(): TankSettings;
  /** Applies the change, stores the changed keys, tells listeners; returns the new settings. */
  update(change: Partial<TankSettings>): TankSettings;
  onChange(listener: (settings: TankSettings) => void): Unsubscribe;
}

type Parsers = { readonly [K in keyof TankSettings]: (value: unknown) => TankSettings[K] };

function oneOf<T extends string>(choices: readonly T[], fallback: T): (value: unknown) => T {
  return (value) => choices.find((choice) => choice === value) ?? fallback;
}

function flag(fallback: boolean): (value: unknown) => boolean {
  return (value) => (typeof value === 'boolean' ? value : fallback);
}

function volume(fallback: number): (value: unknown) => number {
  return (value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : fallback;
}

// Stored values may be junk from an older build, so each field falls back to its own default.
const PARSERS: Parsers = {
  scoring: oneOf<ScoringRule>(['timed', 'first-to-10'], DEFAULT_TANK_SETTINGS.scoring),
  wiring: flag(DEFAULT_TANK_SETTINGS.wiring),
  reverseGear: flag(DEFAULT_TANK_SETTINGS.reverseGear),
  ownRicochets: flag(DEFAULT_TANK_SETTINGS.ownRicochets),
  aimLine: flag(DEFAULT_TANK_SETTINGS.aimLine),
  explosions: oneOf(['full', 'reduced'], DEFAULT_TANK_SETTINGS.explosions),
  teamColours: oneOf(['standard', 'colour-blind'], DEFAULT_TANK_SETTINGS.teamColours),
  engineVolume: volume(DEFAULT_TANK_SETTINGS.engineVolume),
  effectsVolume: volume(DEFAULT_TANK_SETTINGS.effectsVolume),
};

const FIELDS = Object.keys(DEFAULT_TANK_SETTINGS) as (keyof TankSettings)[];

function storageKey(field: keyof TankSettings): string {
  return `tank.${field}`;
}

function readSettings(store: GameSettingsStore): TankSettings {
  const read = <K extends keyof TankSettings>(field: K): TankSettings[K] =>
    PARSERS[field](store.get<unknown>(storageKey(field), DEFAULT_TANK_SETTINGS[field]));
  return {
    scoring: read('scoring'),
    wiring: read('wiring'),
    reverseGear: read('reverseGear'),
    ownRicochets: read('ownRicochets'),
    aimLine: read('aimLine'),
    explosions: read('explosions'),
    teamColours: read('teamColours'),
    engineVolume: read('engineVolume'),
    effectsVolume: read('effectsVolume'),
  };
}

export function createTankSettings(store: GameSettingsStore): TankSettingsStore {
  const emitter = createEmitter<TankSettings>();

  return {
    get: () => readSettings(store),
    update(change) {
      const current = readSettings(store);
      const changed = FIELDS.filter((field) => {
        const wanted = change[field];
        return wanted !== undefined && PARSERS[field](wanted) !== current[field];
      });
      if (changed.length === 0) return current;
      for (const field of changed) store.set(storageKey(field), PARSERS[field](change[field]));
      const next = readSettings(store);
      emitter.emit(next);
      return next;
    },
    onChange: (listener) => emitter.on(listener),
  };
}
