/**
 * Versions, defaults, migrations and sanitising for every repository.
 *
 * Reading stored data and importing a file both go through `sanitize`, which
 * turns anything shaped roughly right into exactly the right shape (missing
 * fields filled from defaults, wrong types replaced, unknown keys dropped)
 * and gives up only when the document is not an object at all. Old data is
 * upgraded one version at a time with the functions in MIGRATIONS.
 */
import type { Bindings, Layout, PadInput, Seat, SeatBindings } from '../input.ts';
import { RUN_MODES, type AppearancePreference, type RunMode } from '../types.ts';
import { isPlainObject, type Envelope, type RepoName } from './local-store.ts';
import {
  EVENT_LOG_LIMIT,
  RECORDS_PER_BOARD,
  type AvatarDescriptor,
  type ControlSettings,
  type EventLogData,
  type GameProgressData,
  type GameStatsData,
  type PatchProgressData,
  type ProfileData,
  type ProgressData,
  type RecordsData,
  type RunRecord,
  type SaveSlotData,
  type SavesData,
  type SessionSummary,
  type SettingsData,
  type StatsData,
  type VolumeSettings,
} from './types.ts';

export interface RepoDataMap {
  profile: ProfileData;
  settings: SettingsData;
  progress: ProgressData;
  records: RecordsData;
  stats: StatsData;
  saves: SavesData;
  'event-log': EventLogData;
}

export const SCHEMA_VERSIONS: Record<RepoName, number> = {
  profile: 1,
  settings: 1,
  progress: 1,
  records: 1,
  stats: 1,
  saves: 1,
  'event-log': 1,
};

/** MIGRATIONS[name][i] turns version i + 1 data into version i + 2 data. */
export const MIGRATIONS: Record<RepoName, ((data: unknown) => unknown)[]> = {
  profile: [],
  settings: [],
  progress: [],
  records: [],
  stats: [],
  saves: [],
  'event-log': [],
};

/** What defaults need from outside: a clock and an id source, injectable for tests. */
export interface SchemaContext {
  now(): Date;
  newId(): string;
}

const DISPLAY_NAME_LIMIT = 20;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampVolume(value: unknown, fallback: number): number {
  const num = finiteOr(value, fallback);
  return Math.min(1, Math.max(0, num));
}

function wrapHue(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return ((Math.trunc(value) % 360) + 360) % 360;
}

function floorZero(value: unknown, fallback: number): number {
  return Math.max(0, finiteOr(value, fallback));
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRunMode(value: unknown): value is RunMode {
  return typeof value === 'string' && (RUN_MODES as readonly string[]).includes(value);
}

function isSeat(value: unknown): value is Seat {
  return value === 1 || value === 2;
}

function isAppearance(value: unknown): value is AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isReducedMotion(value: unknown): value is SettingsData['reducedMotion'] {
  return value === 'system' || value === 'on' || value === 'off';
}

function isLayout(value: unknown): value is Layout {
  return value === 'solo' || value === 'split';
}

function isAvatarShape(value: unknown): value is AvatarDescriptor['shape'] {
  return value === 'round' || value === 'square' || value === 'tall';
}

function isAvatarPattern(value: unknown): value is AvatarDescriptor['pattern'] {
  return value === 'plain' || value === 'stripes' || value === 'dots' || value === 'checks';
}

function sanitizePadInput(value: unknown): PadInput | null {
  if (!isPlainObject(value)) return null;
  if ('button' in value && !('axis' in value)) {
    if (typeof value.button === 'number' && Number.isFinite(value.button)) {
      return { button: value.button };
    }
    return null;
  }
  if ('axis' in value && !('button' in value)) {
    if (
      typeof value.axis === 'number' &&
      Number.isFinite(value.axis) &&
      (value.direction === -1 || value.direction === 1)
    ) {
      return { axis: value.axis, direction: value.direction };
    }
    return null;
  }
  return null;
}

function sanitizeSeatBindings(value: unknown): SeatBindings | null {
  if (!isPlainObject(value) || !isPlainObject(value.keys) || !isPlainObject(value.pad)) {
    return null;
  }
  const keys: Record<string, readonly string[]> = {};
  for (const [action, rawCodes] of Object.entries(value.keys)) {
    if (!Array.isArray(rawCodes)) return null;
    const codes: string[] = [];
    for (const code of rawCodes) {
      if (typeof code !== 'string') return null;
      codes.push(code);
    }
    keys[action] = codes;
  }
  const pad: Record<string, readonly PadInput[]> = {};
  for (const [action, rawInputs] of Object.entries(value.pad)) {
    if (!Array.isArray(rawInputs)) return null;
    const inputs: PadInput[] = [];
    for (const rawInput of rawInputs) {
      const cleanInput = sanitizePadInput(rawInput);
      if (cleanInput === null) return null;
      inputs.push(cleanInput);
    }
    pad[action] = inputs;
  }
  return { keys, pad };
}

function sanitizeBindings(value: unknown): Bindings | null {
  if (!isPlainObject(value)) return null;
  const seat1 = sanitizeSeatBindings(value[1]);
  const seat2 = sanitizeSeatBindings(value[2]);
  if (seat1 === null || seat2 === null) return null;
  return { 1: seat1, 2: seat2 };
}

function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') return 'Player';
  const capped = value.trim().slice(0, DISPLAY_NAME_LIMIT).trim();
  return capped.length > 0 ? capped : 'Player';
}

function sanitizePadSeats(value: unknown): [Seat, Seat] {
  if (Array.isArray(value) && value.length === 2 && isSeat(value[0]) && isSeat(value[1])) {
    return [value[0], value[1]];
  }
  return [1, 2];
}

function sanitizeProfile(data: Record<string, unknown>, context: SchemaContext): ProfileData {
  const id = trimmedString(data.id) ?? context.newId();
  const displayName = sanitizeDisplayName(data.displayName);
  const rawAvatar = isPlainObject(data.avatar) ? data.avatar : {};
  const avatar: AvatarDescriptor = {
    hue: wrapHue(rawAvatar.hue, 28),
    shape: isAvatarShape(rawAvatar.shape) ? rawAvatar.shape : 'round',
    pattern: isAvatarPattern(rawAvatar.pattern) ? rawAvatar.pattern : 'plain',
  };
  const createdAt = trimmedString(data.createdAt) ?? context.now().toISOString();
  return { id, displayName, avatar, createdAt };
}

function sanitizeSettings(data: Record<string, unknown>): SettingsData {
  const rawVolume = isPlainObject(data.volume) ? data.volume : {};
  const volume: VolumeSettings = {
    master: clampVolume(rawVolume.master, 0.8),
    sfx: clampVolume(rawVolume.sfx, 0.8),
    music: clampVolume(rawVolume.music, 0.8),
    ambience: clampVolume(rawVolume.ambience, 0.4),
  };

  const rawControls = isPlainObject(data.controls) ? data.controls : {};
  const controls: ControlSettings = {
    layout: isLayout(rawControls.layout) ? rawControls.layout : 'split',
    bindings: sanitizeBindings(rawControls.bindings),
    padSeats: sanitizePadSeats(rawControls.padSeats),
  };

  const hintsSeen: Record<string, boolean> = {};
  if (isPlainObject(data.hintsSeen)) {
    for (const [hintId, seen] of Object.entries(data.hintsSeen)) {
      if (typeof seen === 'boolean') hintsSeen[hintId] = seen;
    }
  }

  const games: Record<string, Record<string, unknown>> = {};
  if (isPlainObject(data.games)) {
    for (const [gameId, gameSettings] of Object.entries(data.games)) {
      if (isPlainObject(gameSettings)) games[gameId] = { ...gameSettings };
    }
  }

  return {
    appearance: isAppearance(data.appearance) ? data.appearance : 'system',
    volume,
    muted: booleanOr(data.muted, false),
    reducedMotion: isReducedMotion(data.reducedMotion) ? data.reducedMotion : 'system',
    screenShake: booleanOr(data.screenShake, true),
    crtEffects: booleanOr(data.crtEffects, true),
    colorBlindHints: booleanOr(data.colorBlindHints, false),
    roomAmbience: booleanOr(data.roomAmbience, false),
    controls,
    introSeen: booleanOr(data.introSeen, false),
    hintsSeen,
    games,
  };
}

function sanitizeProgress(data: Record<string, unknown>): ProgressData {
  const games: Record<string, GameProgressData> = {};
  if (isPlainObject(data.games)) {
    for (const [gameId, rawGame] of Object.entries(data.games)) {
      if (!isPlainObject(rawGame)) continue;
      const patches: Record<string, PatchProgressData> = {};
      if (isPlainObject(rawGame.patches)) {
        for (const [patchId, rawPatch] of Object.entries(rawGame.patches)) {
          if (!isPlainObject(rawPatch)) continue;
          patches[patchId] = {
            value: floorZero(rawPatch.value, 0),
            earnedAt: trimmedString(rawPatch.earnedAt),
            gold: booleanOr(rawPatch.gold, false),
          };
        }
      }
      const channels: Record<string, { unlockedAt: string }> = {};
      if (isPlainObject(rawGame.channels)) {
        for (const [channelId, rawChannel] of Object.entries(rawGame.channels)) {
          if (!isPlainObject(rawChannel)) continue;
          const unlockedAt = trimmedString(rawChannel.unlockedAt);
          if (unlockedAt !== null) channels[channelId] = { unlockedAt };
        }
      }
      const secretsFound: Record<string, string> = {};
      if (isPlainObject(rawGame.secretsFound)) {
        for (const [secretId, rawTime] of Object.entries(rawGame.secretsFound)) {
          const foundAt = trimmedString(rawTime);
          if (foundAt !== null) secretsFound[secretId] = foundAt;
        }
      }
      games[gameId] = {
        patches,
        channels,
        firstPlayedAt: trimmedString(rawGame.firstPlayedAt),
        secretsFound,
      };
    }
  }
  return { games };
}

function sanitizeRunRecord(value: unknown): RunRecord | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.score !== 'number' || !Number.isFinite(value.score)) return null;
  if (typeof value.seed !== 'number' || !Number.isFinite(value.seed)) return null;
  if (typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs)) return null;
  const at = trimmedString(value.at);
  const channel = trimmedString(value.channel);
  if (at === null || channel === null || !isRunMode(value.mode)) return null;
  return {
    score: value.score,
    at,
    seed: value.seed,
    durationMs: Math.max(0, value.durationMs),
    channel,
    mode: value.mode,
  };
}

function sanitizeRecords(data: Record<string, unknown>): RecordsData {
  const boards: Record<string, RunRecord[]> = {};
  if (isPlainObject(data.boards)) {
    for (const [boardKey, rawList] of Object.entries(data.boards)) {
      if (!Array.isArray(rawList)) continue;
      const valid: RunRecord[] = [];
      for (const item of rawList) {
        const record = sanitizeRunRecord(item);
        if (record !== null) {
          valid.push(record);
          if (valid.length >= RECORDS_PER_BOARD) break;
        }
      }
      boards[boardKey] = valid;
    }
  }
  return { boards };
}

function sanitizeStats(data: Record<string, unknown>): StatsData {
  const games: Record<string, GameStatsData> = {};
  if (isPlainObject(data.games)) {
    for (const [gameId, rawStats] of Object.entries(data.games)) {
      if (!isPlainObject(rawStats)) continue;
      const rawWins = isPlainObject(rawStats.versusWins) ? rawStats.versusWins : {};
      games[gameId] = {
        plays: floorZero(rawStats.plays, 0),
        best: finiteOrNull(rawStats.best),
        timePlayedMs: floorZero(rawStats.timePlayedMs, 0),
        lastPlayedAt: trimmedString(rawStats.lastPlayedAt),
        versusWins: {
          1: floorZero(rawWins[1], 0),
          2: floorZero(rawWins[2], 0),
        },
      };
    }
  }
  return { games };
}

function sanitizeSaves(data: Record<string, unknown>, context: SchemaContext): SavesData {
  const games: Record<string, SaveSlotData> = {};
  if (isPlainObject(data.games)) {
    for (const [gameId, rawSlot] of Object.entries(data.games)) {
      if (!isPlainObject(rawSlot)) continue;
      const rawV = finiteOr(rawSlot.v, 1);
      games[gameId] = {
        v: Math.max(1, Math.trunc(rawV)),
        savedAt: trimmedString(rawSlot.savedAt) ?? context.now().toISOString(),
        state: rawSlot.state ?? null,
      };
    }
  }
  return { games };
}

function sanitizeSessionSummary(value: unknown): SessionSummary | null {
  if (!isPlainObject(value)) return null;
  const game = trimmedString(value.game);
  const channel = trimmedString(value.channel);
  const startedAt = trimmedString(value.startedAt);
  const endedAt = trimmedString(value.endedAt);
  if (
    game === null ||
    channel === null ||
    startedAt === null ||
    endedAt === null ||
    !isRunMode(value.mode)
  ) {
    return null;
  }
  if (typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs)) return null;
  if (!isPlainObject(value.counts) || !isPlainObject(value.maxima)) return null;

  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(value.counts)) {
    if (typeof count === 'number' && Number.isFinite(count)) {
      counts[key] = Math.max(0, count);
    }
  }

  const maxima: Record<string, number> = {};
  for (const [key, maxVal] of Object.entries(value.maxima)) {
    if (typeof maxVal === 'number' && Number.isFinite(maxVal)) {
      maxima[key] = maxVal;
    }
  }

  return {
    game,
    mode: value.mode,
    channel,
    startedAt,
    endedAt,
    durationMs: Math.max(0, value.durationMs),
    counts,
    maxima,
  };
}

function sanitizeEventLog(data: Record<string, unknown>): EventLogData {
  const valid: SessionSummary[] = [];
  if (Array.isArray(data.sessions)) {
    for (const item of data.sessions) {
      const session = sanitizeSessionSummary(item);
      if (session !== null) valid.push(session);
    }
  }
  return {
    sessions: valid.slice(-EVENT_LOG_LIMIT),
  };
}

/**
 * Fresh data for a repository. Settings defaults: appearance 'system', all
 * volumes 0.8 except ambience 0.4, not muted, reducedMotion 'system',
 * screenShake true, crtEffects true, colorBlindHints false, roomAmbience
 * false, controls { layout 'split', bindings null, padSeats [1, 2] },
 * introSeen false, hintsSeen {}, games {}. Profile defaults: a new id, the
 * display name "Player", avatar { hue 28, shape 'round', pattern 'plain' }.
 */
export function defaults<N extends RepoName>(name: N, context: SchemaContext): RepoDataMap[N] {
  const result = sanitize(name, {}, context);
  if (result === null) {
    throw new Error(`Unreachable: defaults failed for ${name}`);
  }
  return result;
}

/**
 * Coerces untrusted data into the repository's exact shape, or null when it
 * is not an object. Numbers must be finite (volumes clamped to 0–1, hue
 * wrapped to 0–359, counts floored at 0), strings are trimmed and capped
 * (display names to 20 characters), each record board keeps its first
 * RECORDS_PER_BOARD entries in stored order (only the game knows which way
 * is best), and the event log keeps its newest EVENT_LOG_LIMIT sessions.
 */
export function sanitize<N extends RepoName>(
  name: N,
  data: unknown,
  context: SchemaContext,
): RepoDataMap[N] | null {
  if (!isPlainObject(data)) return null;
  const builders: { [K in RepoName]: () => RepoDataMap[K] } = {
    profile: () => sanitizeProfile(data, context),
    settings: () => sanitizeSettings(data),
    progress: () => sanitizeProgress(data),
    records: () => sanitizeRecords(data),
    stats: () => sanitizeStats(data),
    saves: () => sanitizeSaves(data, context),
    'event-log': () => sanitizeEventLog(data),
  };
  return builders[name]();
}

/**
 * Brings a stored envelope up to the current version: applies the migrations
 * from its version onwards, then sanitises. Returns null for envelopes from a
 * newer version than this build knows (they are left untouched in storage),
 * for non-integer or missing versions, and for data sanitize rejects.
 */
export function upgrade<N extends RepoName>(
  name: N,
  envelope: Envelope<unknown>,
  context: SchemaContext,
): RepoDataMap[N] | null {
  const rawEnvelope: unknown = envelope;
  if (!isPlainObject(rawEnvelope)) return null;
  const version = rawEnvelope.v;
  const targetVersion = SCHEMA_VERSIONS[name];
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > targetVersion
  ) {
    return null;
  }

  const chain = MIGRATIONS[name];
  let current: unknown = rawEnvelope.data;
  for (let ver = version; ver < targetVersion; ver++) {
    const step = chain[ver - 1];
    if (!step) return null;
    try {
      current = step(current);
    } catch {
      return null;
    }
  }
  return sanitize(name, current, context);
}
