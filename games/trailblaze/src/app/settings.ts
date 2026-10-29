/**
 * Trailblaze's own settings, kept in the game's namespace of the kit settings:
 * the arena look, match length, colour-blind palette toggle, reduced effects,
 * camera view, last visited channel, and opponent.
 */
import {
  createEmitter,
  KID_IDS,
  type GameSettingsStore,
  type KidId,
  type Unsubscribe,
} from '@woodgrain-88/kit';
import type { LookId } from '../look/look.ts';
import { LOOK_IDS } from '../look/looks.ts';

export type OpponentChoice =
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'computer' }
  | { readonly kind: 'person' };

export interface TrailblazeSettings {
  readonly look: LookId;
  readonly matchLength: 10 | 5;
  readonly colourBlind: boolean;
  readonly reducedEffects: boolean;
  readonly camera: 'overhead' | 'chase';
  readonly lastChannel: string;
  readonly opponent: OpponentChoice;
}

export const DEFAULT_TRAILBLAZE_SETTINGS: TrailblazeSettings = {
  look: 'neon',
  matchLength: 10,
  colourBlind: false,
  reducedEffects: false,
  camera: 'overhead',
  lastChannel: 'game-1',
  opponent: { kind: 'kid', kid: 'rosa' },
};

export interface TrailblazeSettingsStore {
  get(): TrailblazeSettings;
  update(change: Partial<TrailblazeSettings>): TrailblazeSettings;
  onChange(listener: (settings: TrailblazeSettings) => void): Unsubscribe;
}

type Parsers = {
  readonly [K in keyof TrailblazeSettings]: (value: unknown) => TrailblazeSettings[K];
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

function isKidId(value: unknown): value is KidId {
  return typeof value === 'string' && (KID_IDS as readonly string[]).includes(value);
}

function opponent(fallback: OpponentChoice): (value: unknown) => OpponentChoice {
  return (value) => {
    if (typeof value !== 'object' || value === null) {
      return fallback;
    }
    const record = value as Record<string, unknown>;
    if (record.kind === 'computer') {
      return { kind: 'computer' };
    }
    if (record.kind === 'person') {
      return { kind: 'person' };
    }
    if (record.kind === 'kid' && isKidId(record.kid)) {
      return { kind: 'kid', kid: record.kid };
    }
    return fallback;
  };
}

// Fallbacks run per field so that malformed data from older versions does not discard valid fields.
const PARSERS: Parsers = {
  look: oneOf<LookId>(LOOK_IDS, DEFAULT_TRAILBLAZE_SETTINGS.look),
  matchLength: (value) =>
    value === 5 || value === 10 ? value : DEFAULT_TRAILBLAZE_SETTINGS.matchLength,
  colourBlind: flag(DEFAULT_TRAILBLAZE_SETTINGS.colourBlind),
  reducedEffects: flag(DEFAULT_TRAILBLAZE_SETTINGS.reducedEffects),
  camera: oneOf<'overhead' | 'chase'>(['overhead', 'chase'], DEFAULT_TRAILBLAZE_SETTINGS.camera),
  lastChannel: nonBlankString(DEFAULT_TRAILBLAZE_SETTINGS.lastChannel),
  opponent: opponent(DEFAULT_TRAILBLAZE_SETTINGS.opponent),
};

const FIELDS = Object.keys(DEFAULT_TRAILBLAZE_SETTINGS) as (keyof TrailblazeSettings)[];

function storageKey(field: keyof TrailblazeSettings): string {
  return `tb.${field}`;
}

/** Settings are plain data, so two values are the same when they serialise alike. */
function isFieldEqual(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function readSettings(store: GameSettingsStore): TrailblazeSettings {
  const read = <K extends keyof TrailblazeSettings>(field: K): TrailblazeSettings[K] =>
    PARSERS[field](store.get<unknown>(storageKey(field), DEFAULT_TRAILBLAZE_SETTINGS[field]));
  return {
    look: read('look'),
    matchLength: read('matchLength'),
    colourBlind: read('colourBlind'),
    reducedEffects: read('reducedEffects'),
    camera: read('camera'),
    lastChannel: read('lastChannel'),
    opponent: read('opponent'),
  };
}

export function createTrailblazeSettings(store: GameSettingsStore): TrailblazeSettingsStore {
  const emitter = createEmitter<TrailblazeSettings>();

  return {
    get: () => readSettings(store),
    update(change) {
      const current = readSettings(store);
      const changed = FIELDS.filter((field) => {
        const wanted = change[field];
        if (wanted === undefined) return false;
        const parsed = PARSERS[field](wanted);
        return !isFieldEqual(parsed, current[field]);
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
