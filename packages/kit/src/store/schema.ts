/**
 * Versions, defaults, migrations and sanitising for every repository.
 *
 * Reading stored data and importing a file both go through `sanitize`, which
 * turns anything shaped roughly right into exactly the right shape (missing
 * fields filled from defaults, wrong types replaced, unknown keys dropped)
 * and gives up only when the document is not an object at all. Old data is
 * upgraded one version at a time with the functions in MIGRATIONS.
 */
import type { Bindings, PadInput, Seat, SeatBindings } from '../input.ts';
import { KID_IDS, type KidId } from '../kids.ts';
import {
  RUN_MODES,
  type AppearancePreference,
  type DifficultySwitches,
  type IsoTime,
  type RunMode,
} from '../types.ts';
import { isPlainObject, type Envelope, type RepoName } from './local-store.ts';
import {
  EVENT_LOG_LIMIT,
  RECORDS_PER_BOARD,
  VERSUS_RECENT_LIMIT,
  type AvatarDescriptor,
  type ControlSettings,
  type DailyRunData,
  type DenLifeData,
  type EventLogData,
  type GameProgressData,
  type GameStatsData,
  type JacketData,
  type KidRecordData,
  type PatchPlacement,
  type PatchProgressData,
  type ProfileData,
  type ProgressData,
  type RecordsData,
  type RivalryData,
  type RunRecord,
  type RunResultData,
  type RunRoundData,
  type RunsData,
  type SaveSlotData,
  type SavesData,
  type SessionSummary,
  type SettingsData,
  type StatsData,
  type StreakData,
  type StreakDayKind,
  type VersusData,
  type VersusSeriesRecord,
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
  settings: 2,
  progress: 3,
  records: 1,
  stats: 1,
  saves: 1,
  'event-log': 1,
};

/** MIGRATIONS[name][i] turns version i + 1 data into version i + 2 data. */
export const MIGRATIONS: Record<RepoName, ((data: unknown) => unknown)[]> = {
  profile: [],
  // v1 → v2: console difficulty switches, growth toggle, share name, versus night bestOf and run sound.
  settings: [migrateSettingsV1ToV2],
  // v1 → v2: the hidden-reskin "secrets" became cartridge versions you choose.
  // v2 → v3: Den Life added collection-wide streak, daily, kids, jacket, versus, runs and growth.
  progress: [migrateProgressSecretsToVersions, migrateProgressV2ToV3],
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
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const KEBAB_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_KID_IDS = new Set<string>(KID_IDS);

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

function wholeNumberOrZero(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDayKey(key: string): boolean {
  if (!DATE_KEY_REGEX.test(key)) return false;
  const parsed = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === key;
}

function isKebabCase(value: unknown): value is string {
  return typeof value === 'string' && KEBAB_REGEX.test(value);
}

function isKidId(value: unknown): value is KidId {
  return typeof value === 'string' && VALID_KID_IDS.has(value);
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

function sanitizeDifficulty(value: unknown): DifficultySwitches {
  if (!isPlainObject(value)) {
    return { left: 'B', right: 'B' };
  }
  return {
    left: value.left === 'A' ? 'A' : 'B',
    right: value.right === 'A' ? 'A' : 'B',
  };
}

function sanitizeVersusBestOf(value: unknown): 3 | 5 {
  return value === 5 ? 5 : 3;
}

function sanitizeRunSound(value: unknown): SettingsData['runSound'] {
  return value === 'quiet' || value === 'loud' ? value : 'normal';
}

function migrateSettingsV1ToV2(data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  return {
    ...data,
    difficulty: { left: 'B', right: 'B' },
    showGrowth: true,
    shareWithName: false,
    versusBestOf: 3,
    runSound: 'normal',
  };
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
    difficulty: sanitizeDifficulty(data.difficulty),
    showGrowth: booleanOr(data.showGrowth, true),
    shareWithName: booleanOr(data.shareWithName, false),
    versusBestOf: sanitizeVersusBestOf(data.versusBestOf),
    runSound: sanitizeRunSound(data.runSound),
  };
}

/** A game's progress before anything has happened in it. */
export function emptyGameProgress(): GameProgressData {
  return { patches: {}, channels: {}, firstPlayedAt: null, versionsFinished: {} };
}

/** Den Life before anything has happened. */
export function emptyDenLife(): DenLifeData {
  return {
    streak: { days: {}, best: 0 },
    daily: {},
    kids: {},
    jacket: { placements: [], lookedAt: null },
    versus: { seriesPlayed: 0, recent: [], rivalries: {} },
    runs: { free: [], daily: {} },
    growthSeen: {},
    counterCompletedAt: null,
  };
}

function migrateProgressSecretsToVersions(data: unknown): unknown {
  if (!isPlainObject(data) || !isPlainObject(data.games)) return data;
  const games: Record<string, unknown> = {};
  for (const [gameId, rawGame] of Object.entries(data.games)) {
    if (!isPlainObject(rawGame)) continue;
    const { secretsFound: _dropped, ...rest } = rawGame;
    games[gameId] = { ...rest, versionsFinished: {} };
  }
  return { ...data, games };
}

function migrateProgressV2ToV3(data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  return {
    ...data,
    den: emptyDenLife(),
  };
}

function sanitizeStreak(value: unknown): StreakData {
  if (!isPlainObject(value)) {
    return { days: {}, best: 0 };
  }
  const days: Record<string, StreakDayKind> = {};
  if (isPlainObject(value.days)) {
    for (const [key, kind] of Object.entries(value.days)) {
      if (!isValidDayKey(key)) continue;
      if (kind === 'played' || kind === 'snow') {
        days[key] = kind;
      }
    }
  }
  return {
    days,
    best: wholeNumberOrZero(value.best),
  };
}

function sanitizeDailyRun(value: unknown): DailyRunData | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.score !== 'number' || !Number.isFinite(value.score)) return null;
  if (typeof value.scoreLabel !== 'string') return null;
  if (!isKebabCase(value.channel)) return null;
  const at = trimmedString(value.at);
  if (at === null) return null;

  const emoji = typeof value.emoji === 'string' ? value.emoji : null;
  const scoreLabel = value.scoreLabel.slice(0, 40);

  return {
    score: value.score,
    scoreLabel,
    emoji,
    channel: value.channel,
    at,
  };
}

function sanitizeDaily(value: unknown): Record<string, Record<string, DailyRunData>> {
  if (!isPlainObject(value)) return {};
  const result: Record<string, Record<string, DailyRunData>> = {};
  for (const [dayKey, rawGames] of Object.entries(value)) {
    if (!isValidDayKey(dayKey)) continue;
    if (!isPlainObject(rawGames)) continue;
    const cleanGames: Record<string, DailyRunData> = {};
    for (const [gameId, rawRun] of Object.entries(rawGames)) {
      if (!isKebabCase(gameId)) continue;
      const cleanRun = sanitizeDailyRun(rawRun);
      if (cleanRun !== null) {
        cleanGames[gameId] = cleanRun;
      }
    }
    result[dayKey] = cleanGames;
  }
  return result;
}

function sanitizeKidRecord(value: unknown): KidRecordData | null {
  if (!isPlainObject(value)) return null;
  const wins = wholeNumberOrZero(value.wins);
  const losses = wholeNumberOrZero(value.losses);
  const draws = wholeNumberOrZero(value.draws);
  const rawWinsOnA = wholeNumberOrZero(value.winsOnA);
  const winsOnA = Math.min(wins, rawWinsOnA);
  const firstBeatenAt = trimmedString(value.firstBeatenAt);
  const firstBeatenOnAAt = trimmedString(value.firstBeatenOnAAt);

  return {
    wins,
    losses,
    draws,
    winsOnA,
    firstBeatenAt,
    firstBeatenOnAAt,
  };
}

function sanitizeKids(value: unknown): Partial<Record<KidId, KidRecordData>> {
  if (!isPlainObject(value)) return {};
  const result: Partial<Record<KidId, KidRecordData>> = {};
  for (const [kidId, rawRecord] of Object.entries(value)) {
    if (!isKidId(kidId)) continue;
    const cleanRecord = sanitizeKidRecord(rawRecord);
    if (cleanRecord !== null) {
      result[kidId] = cleanRecord;
    }
  }
  return result;
}

function normalizeRotation(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const nearest15 = Math.round(value / 15) * 15;
  const wrapped = ((nearest15 % 360) + 360) % 360;
  return wrapped === 360 ? 0 : wrapped;
}

function sanitizePatchPlacement(value: unknown): PatchPlacement | null {
  if (!isPlainObject(value)) return null;
  if (!isKebabCase(value.game) || !isKebabCase(value.patch)) return null;
  if (value.side !== 'front' && value.side !== 'back') return null;
  if (typeof value.x !== 'number' || !Number.isFinite(value.x)) return null;
  if (typeof value.y !== 'number' || !Number.isFinite(value.y)) return null;
  if (typeof value.z !== 'number' || !Number.isFinite(value.z)) return null;

  const rotation = normalizeRotation(value.rotation);
  if (rotation === null) return null;

  return {
    game: value.game,
    patch: value.patch,
    side: value.side,
    x: Math.min(600, Math.max(0, value.x)),
    y: Math.min(700, Math.max(0, value.y)),
    rotation,
    z: Math.trunc(value.z),
  };
}

function sanitizeJacket(value: unknown): JacketData {
  if (!isPlainObject(value)) {
    return { placements: [], lookedAt: null };
  }
  const placements: PatchPlacement[] = [];
  const seen = new Set<string>();

  if (Array.isArray(value.placements)) {
    for (const rawPlacement of value.placements) {
      const cleanPlacement = sanitizePatchPlacement(rawPlacement);
      if (cleanPlacement === null) continue;
      const key = `${cleanPlacement.game}/${cleanPlacement.patch}`;
      if (seen.has(key)) continue;
      seen.add(key);
      placements.push(cleanPlacement);
    }
  }

  return {
    placements,
    lookedAt: trimmedString(value.lookedAt),
  };
}

function sanitizeVersusGame(value: unknown): { game: string; winner: Seat | null } | null {
  if (!isPlainObject(value)) return null;
  if (!isKebabCase(value.game)) return null;
  const winner = value.winner;
  if (winner !== 1 && winner !== 2 && winner !== null) return null;
  return { game: value.game, winner };
}

function sanitizeVersusSeriesRecord(value: unknown): VersusSeriesRecord | null {
  if (!isPlainObject(value)) return null;
  const at = trimmedString(value.at);
  if (at === null) return null;

  if (!Array.isArray(value.names) || value.names.length !== 2) return null;
  const name0 = trimmedString(value.names[0]);
  const name1 = trimmedString(value.names[1]);
  if (name0 === null || name1 === null) return null;
  const names: [string, string] = [name0.slice(0, 20), name1.slice(0, 20)];
  if (names[0].length === 0 || names[1].length === 0) return null;

  if (!Array.isArray(value.kids) || value.kids.length !== 2) return null;
  const kid0 = value.kids[0] === null ? null : isKidId(value.kids[0]) ? value.kids[0] : undefined;
  const kid1 = value.kids[1] === null ? null : isKidId(value.kids[1]) ? value.kids[1] : undefined;
  if (kid0 === undefined || kid1 === undefined) return null;

  const bestOf = value.bestOf;
  if (bestOf !== 3 && bestOf !== 5) return null;

  if (!isSeat(value.winner)) return null;

  if (!Array.isArray(value.games)) return null;
  const games: { game: string; winner: Seat | null }[] = [];
  for (const rawGame of value.games) {
    const cleanGame = sanitizeVersusGame(rawGame);
    if (cleanGame === null) return null;
    games.push(cleanGame);
  }

  return {
    at,
    names,
    kids: [kid0, kid1],
    bestOf,
    games,
    winner: value.winner,
  };
}

function sanitizeRivalry(value: unknown): RivalryData | null {
  if (!isPlainObject(value)) return null;
  const lastAt = trimmedString(value.lastAt);
  if (lastAt === null) return null;

  if (!Array.isArray(value.names) || value.names.length !== 2) return null;
  const name0 = trimmedString(value.names[0]);
  const name1 = trimmedString(value.names[1]);
  if (name0 === null || name1 === null) return null;

  if (!Array.isArray(value.series) || value.series.length !== 2) return null;
  if (
    typeof value.series[0] !== 'number' ||
    !Number.isFinite(value.series[0]) ||
    value.series[0] < 0 ||
    typeof value.series[1] !== 'number' ||
    !Number.isFinite(value.series[1]) ||
    value.series[1] < 0
  ) {
    return null;
  }

  if (!Array.isArray(value.games) || value.games.length !== 2) return null;
  if (
    typeof value.games[0] !== 'number' ||
    !Number.isFinite(value.games[0]) ||
    value.games[0] < 0 ||
    typeof value.games[1] !== 'number' ||
    !Number.isFinite(value.games[1]) ||
    value.games[1] < 0
  ) {
    return null;
  }

  const s0 = Math.floor(value.series[0]);
  const s1 = Math.floor(value.series[1]);
  const g0 = Math.floor(value.games[0]);
  const g1 = Math.floor(value.games[1]);

  if (name0 <= name1) {
    return {
      names: [name0, name1],
      series: [s0, s1],
      games: [g0, g1],
      lastAt,
    };
  }

  return {
    names: [name1, name0],
    series: [s1, s0],
    games: [g1, g0],
    lastAt,
  };
}

function sanitizeVersus(value: unknown): VersusData {
  if (!isPlainObject(value)) {
    return { seriesPlayed: 0, recent: [], rivalries: {} };
  }

  const recent: VersusSeriesRecord[] = [];
  if (Array.isArray(value.recent)) {
    for (const item of value.recent) {
      const record = sanitizeVersusSeriesRecord(item);
      if (record !== null) recent.push(record);
    }
  }

  const rivalries: Record<string, RivalryData> = {};
  if (isPlainObject(value.rivalries)) {
    for (const [key, rawRivalry] of Object.entries(value.rivalries)) {
      const cleanRivalry = sanitizeRivalry(rawRivalry);
      if (cleanRivalry !== null) {
        rivalries[key] = cleanRivalry;
      }
    }
  }

  return {
    seriesPlayed: wholeNumberOrZero(value.seriesPlayed),
    recent: recent.slice(-VERSUS_RECENT_LIMIT),
    rivalries,
  };
}

function sanitizeRunRound(value: unknown): RunRoundData | null {
  if (!isPlainObject(value)) return null;
  if (!isKebabCase(value.game) || !isKebabCase(value.challenge)) return null;
  if (typeof value.passed !== 'boolean') return null;
  if (typeof value.seconds !== 'number' || !Number.isFinite(value.seconds)) return null;
  return {
    game: value.game,
    challenge: value.challenge,
    passed: value.passed,
    seconds: Math.max(0, value.seconds),
  };
}

function sanitizeRunResult(value: unknown): RunResultData | null {
  if (!isPlainObject(value)) return null;
  const at = trimmedString(value.at);
  if (at === null) return null;
  if (typeof value.seed !== 'number' || !Number.isFinite(value.seed)) return null;
  if (typeof value.score !== 'number' || !Number.isFinite(value.score)) return null;
  if (!Array.isArray(value.rounds)) return null;

  const rounds: RunRoundData[] = [];
  for (const rawRound of value.rounds) {
    const cleanRound = sanitizeRunRound(rawRound);
    if (cleanRound !== null) {
      rounds.push(cleanRound);
    }
  }

  return {
    at,
    seed: value.seed,
    score: value.score,
    rounds,
  };
}

function sanitizeRuns(value: unknown): RunsData {
  if (!isPlainObject(value)) {
    return { free: [], daily: {} };
  }

  const free: RunResultData[] = [];
  if (Array.isArray(value.free)) {
    for (const item of value.free) {
      const record = sanitizeRunResult(item);
      if (record !== null) free.push(record);
    }
  }

  free.sort((a, b) => b.score - a.score);
  const cleanFree = free.slice(0, RECORDS_PER_BOARD);

  const daily: Record<string, RunResultData> = {};
  if (isPlainObject(value.daily)) {
    for (const [dayKey, rawResult] of Object.entries(value.daily)) {
      if (!isValidDayKey(dayKey)) continue;
      const cleanResult = sanitizeRunResult(rawResult);
      if (cleanResult !== null) {
        daily[dayKey] = cleanResult;
      }
    }
  }

  return {
    free: cleanFree,
    daily,
  };
}

function sanitizeGrowthSeen(value: unknown): Record<string, IsoTime> {
  if (!isPlainObject(value)) return {};
  const result: Record<string, IsoTime> = {};
  for (const [key, rawTime] of Object.entries(value)) {
    const cleanKey = trimmedString(key);
    const cleanTime = trimmedString(rawTime);
    if (cleanKey !== null && cleanTime !== null) {
      result[cleanKey] = cleanTime;
    }
  }
  return result;
}

export function sanitizeDenLife(data: unknown): DenLifeData {
  if (!isPlainObject(data)) {
    return emptyDenLife();
  }
  return {
    streak: sanitizeStreak(data.streak),
    daily: sanitizeDaily(data.daily),
    kids: sanitizeKids(data.kids),
    jacket: sanitizeJacket(data.jacket),
    versus: sanitizeVersus(data.versus),
    runs: sanitizeRuns(data.runs),
    growthSeen: sanitizeGrowthSeen(data.growthSeen),
    counterCompletedAt: trimmedString(data.counterCompletedAt),
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
      const versionsFinished: Record<string, string> = {};
      if (isPlainObject(rawGame.versionsFinished)) {
        for (const [versionId, rawTime] of Object.entries(rawGame.versionsFinished)) {
          const finishedAt = trimmedString(rawTime);
          if (finishedAt !== null) versionsFinished[versionId] = finishedAt;
        }
      }
      games[gameId] = {
        patches,
        channels,
        firstPlayedAt: trimmedString(rawGame.firstPlayedAt),
        versionsFinished,
      };
    }
  }
  const den = sanitizeDenLife(data.den);
  return { games, den };
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
 * false, controls { bindings null, padSeats [1, 2] } (the keyboard layout is the game's to set:
 * whole for one player, split for two),
 * introSeen false, hintsSeen {}, games {}, difficulty { left 'B', right 'B' },
 * showGrowth true, shareWithName false, versusBestOf 3, runSound 'normal'.
 * Profile defaults: a new id, the display name "Player", avatar { hue 28,
 * shape 'round', pattern 'plain' }. Progress defaults: games {}, den emptyDenLife().
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
