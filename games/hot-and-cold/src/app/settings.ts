/**
 * Hot & Cold's own settings, kept in the game's namespace of the kit settings:
 * the visual look, clues visibility style, possibility fog, match length,
 * numeral colours, seat colours, visual effects, and effects volume.
 */
import { createEmitter, type GameSettingsStore, type Unsubscribe } from '@woodgrain-88/kit';

export type LookChoice = 'polar' | 'tabletop' | 'radar';

export interface HotColdSettings {
  /** The look: Polar Expedition (default), Tabletop Board or Radar Room. Changes only the picture. */
  readonly look: LookChoice;
  /** Notebook: clues stay on the field (default). Classic Memory: a clue shows only while reveal is held. */
  readonly clues: 'notebook' | 'classic';
  /** Possibility fog: squares that can no longer hold the flag dim. Default false. */
  readonly fog: boolean;
  /** Cartridge (15 or 75, as in 1978; the default) or Short (first to 5). */
  readonly matchLength: 'cartridge' | 'short';
  /** The numerals' warm-to-cool colours, or a colour-blind-safe ramp. Default 'standard'. */
  readonly clueColours: 'standard' | 'colour-blind';
  /** The two seats' colours: orange and sky blue, or amber and periwinkle. Default 'standard'. */
  readonly seatColours: 'standard' | 'colour-blind';
  /** Blasts, confetti and flares in full, or quietened. Default 'full'. */
  readonly effects: 'full' | 'reduced';
  /** Steps, pings and fanfares, 0–1. Default 0.8. */
  readonly effectsVolume: number;
}

export const DEFAULT_HOT_COLD_SETTINGS: HotColdSettings = {
  look: 'polar',
  clues: 'notebook',
  fog: false,
  matchLength: 'cartridge',
  clueColours: 'standard',
  seatColours: 'standard',
  effects: 'full',
  effectsVolume: 0.8,
};

export interface HotColdSettingsStore {
  get(): HotColdSettings;
  update(change: Partial<HotColdSettings>): HotColdSettings;
  onChange(listener: (settings: HotColdSettings) => void): Unsubscribe;
}

type Parsers = { readonly [K in keyof HotColdSettings]: (value: unknown) => HotColdSettings[K] };

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
  look: oneOf<LookChoice>(['polar', 'tabletop', 'radar'], DEFAULT_HOT_COLD_SETTINGS.look),
  clues: oneOf<HotColdSettings['clues']>(['notebook', 'classic'], DEFAULT_HOT_COLD_SETTINGS.clues),
  fog: flag(DEFAULT_HOT_COLD_SETTINGS.fog),
  matchLength: oneOf<HotColdSettings['matchLength']>(
    ['cartridge', 'short'],
    DEFAULT_HOT_COLD_SETTINGS.matchLength,
  ),
  clueColours: oneOf<HotColdSettings['clueColours']>(
    ['standard', 'colour-blind'],
    DEFAULT_HOT_COLD_SETTINGS.clueColours,
  ),
  seatColours: oneOf<HotColdSettings['seatColours']>(
    ['standard', 'colour-blind'],
    DEFAULT_HOT_COLD_SETTINGS.seatColours,
  ),
  effects: oneOf<HotColdSettings['effects']>(
    ['full', 'reduced'],
    DEFAULT_HOT_COLD_SETTINGS.effects,
  ),
  effectsVolume: volume(DEFAULT_HOT_COLD_SETTINGS.effectsVolume),
};

const FIELDS = Object.keys(DEFAULT_HOT_COLD_SETTINGS) as (keyof HotColdSettings)[];

function storageKey(field: keyof HotColdSettings): string {
  return `hc.${field}`;
}

function readSettings(store: GameSettingsStore): HotColdSettings {
  const read = <K extends keyof HotColdSettings>(field: K): HotColdSettings[K] =>
    PARSERS[field](store.get<unknown>(storageKey(field), DEFAULT_HOT_COLD_SETTINGS[field]));
  return {
    look: read('look'),
    clues: read('clues'),
    fog: read('fog'),
    matchLength: read('matchLength'),
    clueColours: read('clueColours'),
    seatColours: read('seatColours'),
    effects: read('effects'),
    effectsVolume: read('effectsVolume'),
  };
}

export function createHotColdSettings(store: GameSettingsStore): HotColdSettingsStore {
  const emitter = createEmitter<HotColdSettings>();

  return {
    get: () => readSettings(store),
    update(change) {
      const current = readSettings(store);
      const changed = FIELDS.filter((field) => {
        const wanted = change[field];
        return wanted !== undefined && PARSERS[field](wanted) !== current[field];
      });
      if (changed.length === 0) {
        return current;
      }
      for (const field of changed) {
        store.set(storageKey(field), PARSERS[field](change[field]));
      }
      const next = readSettings(store);
      emitter.emit(next);
      return next;
    },
    onChange: (listener) => emitter.on(listener),
  };
}
