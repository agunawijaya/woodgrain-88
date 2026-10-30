/**
 * Gravity Duel's own settings, kept in the game's namespace of the kit
 * settings: look, controls scheme, match length, the trajectory guide,
 * ship colours, reduced effects and camera. Saved per player, as
 * Trailblaze's are.
 */
import { createEmitter, type GameSettingsStore, type Unsubscribe } from '@woodgrain-88/kit';
import type { LookId } from '../look/look.ts';
import { LOOK_IDS } from '../look/looks.ts';
import type { ControlScheme } from '../session/controls.ts';

export type Camera = 'overhead' | 'follow';

export interface GravitySettings {
  readonly look: LookId;
  readonly scheme: ControlScheme;
  readonly matchLength: 10 | 5;
  /** Off by default; the brief's own reason text is shown when it is forced off. */
  readonly guide: boolean;
  readonly colourBlind: boolean;
  readonly reducedEffects: boolean;
  readonly camera: Camera;
  readonly lastChannel: string;
}

export const DEFAULT_GRAVITY_SETTINGS: GravitySettings = {
  look: 'deep',
  scheme: 'classic',
  matchLength: 10,
  guide: false,
  colourBlind: false,
  reducedEffects: false,
  camera: 'overhead',
  lastChannel: 'game-1',
};

export interface GravitySettingsStore {
  get(): GravitySettings;
  update(change: Partial<GravitySettings>): GravitySettings;
  onChange(listener: (settings: GravitySettings) => void): Unsubscribe;
}

type Parsers = {
  readonly [K in keyof GravitySettings]: (value: unknown) => GravitySettings[K];
};

function oneOf<T extends string>(choices: readonly T[], fallback: T): (value: unknown) => T {
  return (value) => choices.find((choice) => choice === value) ?? fallback;
}

function flag(fallback: boolean): (value: unknown) => boolean {
  return (value) => (typeof value === 'boolean' ? value : fallback);
}

function nonBlankString(fallback: string): (value: unknown) => string {
  return (value) => (typeof value === 'string' && value.length > 0 ? value : fallback);
}

// Fallbacks run per field so that malformed data from an older version does not discard the rest.
const PARSERS: Parsers = {
  look: oneOf<LookId>(LOOK_IDS, DEFAULT_GRAVITY_SETTINGS.look),
  scheme: oneOf<ControlScheme>(['classic', 'modern'], DEFAULT_GRAVITY_SETTINGS.scheme),
  matchLength: (value) =>
    value === 5 || value === 10 ? value : DEFAULT_GRAVITY_SETTINGS.matchLength,
  guide: flag(DEFAULT_GRAVITY_SETTINGS.guide),
  colourBlind: flag(DEFAULT_GRAVITY_SETTINGS.colourBlind),
  reducedEffects: flag(DEFAULT_GRAVITY_SETTINGS.reducedEffects),
  camera: oneOf<Camera>(['overhead', 'follow'], DEFAULT_GRAVITY_SETTINGS.camera),
  lastChannel: nonBlankString(DEFAULT_GRAVITY_SETTINGS.lastChannel),
};

const FIELDS = Object.keys(DEFAULT_GRAVITY_SETTINGS) as (keyof GravitySettings)[];

function storageKey(field: keyof GravitySettings): string {
  return `gd.${field}`;
}

function readSettings(store: GameSettingsStore): GravitySettings {
  const read = <K extends keyof GravitySettings>(field: K): GravitySettings[K] =>
    PARSERS[field](store.get<unknown>(storageKey(field), DEFAULT_GRAVITY_SETTINGS[field]));
  return {
    look: read('look'),
    scheme: read('scheme'),
    matchLength: read('matchLength'),
    guide: read('guide'),
    colourBlind: read('colourBlind'),
    reducedEffects: read('reducedEffects'),
    camera: read('camera'),
    lastChannel: read('lastChannel'),
  };
}

export function createGravitySettings(store: GameSettingsStore): GravitySettingsStore {
  const emitter = createEmitter<GravitySettings>();
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
