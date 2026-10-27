/**
 * The shape of everything Woodgrain '88 remembers, one interface per
 * repository. These are the documents inside the store's envelopes and inside
 * an export file, so changing one means bumping its schema version and adding
 * a migration (schema.ts).
 */
import type { Bindings, Seat } from '../input.ts';
import type { KidId } from '../kids.ts';
import type { AppearancePreference, DifficultySwitches, IsoTime, RunMode } from '../types.ts';

export interface AvatarDescriptor {
  /** 0–359 on the colour wheel. */
  hue: number;
  shape: 'round' | 'square' | 'tall';
  pattern: 'plain' | 'stripes' | 'dots' | 'checks';
}

export interface ProfileData {
  /** Stable random id, created once; never shown. */
  id: string;
  /** 1–20 characters after trimming. */
  displayName: string;
  avatar: AvatarDescriptor;
  createdAt: IsoTime;
}

export interface VolumeSettings {
  /** Each 0–1. */
  master: number;
  sfx: number;
  music: number;
  ambience: number;
}

export interface ControlSettings {
  /** null means the kit's defaults. */
  bindings: Bindings | null;
  /** Which seat the first and second gamepads drive. */
  padSeats: [Seat, Seat];
}

export interface SettingsData {
  appearance: AppearancePreference;
  volume: VolumeSettings;
  muted: boolean;
  /** 'system' follows prefers-reduced-motion. */
  reducedMotion: 'system' | 'on' | 'off';
  screenShake: boolean;
  /** Scanlines, curvature and glow on the TV and in demos. Always off under reduced motion. */
  crtEffects: boolean;
  /** Shapes and patterns beside colour wherever colour carries meaning. */
  colorBlindHints: boolean;
  /** The quiet synthesised room sound in the Den. Off by default. */
  roomAmbience: boolean;
  controls: ControlSettings;
  introSeen: boolean;
  /** One-time hints already shown, by id (e.g. "esc-pause"). */
  hintsSeen: Record<string, boolean>;
  /** Per-game settings, by game id then key. Games define their own keys. */
  games: Record<string, Record<string, unknown>>;
  /** The console's two switches, as last set in the Den or a pause menu (settings v2). */
  difficulty: DifficultySwitches;
  /** Trophies, posters, lights and the rest of the room that play earns (v2). */
  showGrowth: boolean;
  /** Whether a copied share line ends with the display name; off by default (v2). */
  shareWithName: boolean;
  /** Versus Night's default series length (v2). */
  versusBestOf: 3 | 5;
  /** How loud the Power Cycle Run's transitions are (v2). */
  runSound: 'quiet' | 'normal' | 'loud';
}

export interface PatchProgressData {
  /** The tracked metric's current value. */
  value: number;
  earnedAt: IsoTime | null;
  /** Earned with the Pro switch on: sewn in gold thread. */
  gold: boolean;
}

export interface GameProgressData {
  patches: Record<string, PatchProgressData>;
  /** Channels opened by play, by channel id. Every channel is open in prompt 00. */
  channels: Record<string, { unlockedAt: IsoTime }>;
  firstPlayedAt: IsoTime | null;
  /** When a run was first finished with each cartridge version, by version id. */
  versionsFinished: Record<string, IsoTime>;
}

/** A UTC day (YYYY-MM-DD) in the streak: played, or covered by that ISO week's snow day. */
export type StreakDayKind = 'played' | 'snow';

export interface StreakData {
  days: Record<string, StreakDayKind>;
  /** The longest run of covered days so far. */
  best: number;
}

/** The first run of a game on a given day: the one that counts for the daily score. */
export interface DailyRunData {
  score: number;
  scoreLabel: string;
  /** The game's emoji summary, already validated. */
  emoji: string | null;
  channel: string;
  at: IsoTime;
}

/** The player's record against one Neighbourhood Kid, across every game. */
export interface KidRecordData {
  wins: number;
  losses: number;
  draws: number;
  /** Wins with the player's switch on A, shown apart on the Block Ladder. */
  winsOnA: number;
  firstBeatenAt: IsoTime | null;
  firstBeatenOnAAt: IsoTime | null;
}

/** One patch sewn on the jacket. Coordinates are in the jacket's 600×700 drawing units. */
export interface PatchPlacement {
  game: string;
  patch: string;
  side: 'front' | 'back';
  x: number;
  y: number;
  /** Degrees, a multiple of 15. */
  rotation: number;
  /** Stacking order; higher is on top. */
  z: number;
}

export interface JacketData {
  placements: PatchPlacement[];
  /** When the jacket was last opened; patches earned after it make the door jacket glint. */
  lookedAt: IsoTime | null;
}

export interface VersusSeriesRecord {
  at: IsoTime;
  /** Seat 1 then seat 2, as typed (or a kid's name). */
  names: [string, string];
  kids: [KidId | null, KidId | null];
  bestOf: 3 | 5;
  games: { game: string; winner: Seat | null }[];
  winner: Seat;
}

/** A pair of names that keeps meeting on Versus Night; keyed by `rivalryKey`. */
export interface RivalryData {
  /** Sorted, so the pair is the same whichever seat each took. */
  names: [string, string];
  /** Series and games won, in the order of `names`. */
  series: [number, number];
  games: [number, number];
  lastAt: IsoTime;
}

export interface VersusData {
  seriesPlayed: number;
  /** Newest last; at most VERSUS_RECENT_LIMIT. */
  recent: VersusSeriesRecord[];
  rivalries: Record<string, RivalryData>;
}

export interface RunRoundData {
  game: string;
  challenge: string;
  passed: boolean;
  seconds: number;
}

export interface RunResultData {
  at: IsoTime;
  seed: number;
  score: number;
  rounds: RunRoundData[];
}

export interface RunsData {
  /** Free runs, best score first; at most RECORDS_PER_BOARD. */
  free: RunResultData[];
  /** The day's seeded run, by YYYY-MM-DD; only the first finished run of a day counts. */
  daily: Record<string, RunResultData>;
}

/** Den Life: everything the collection-wide layer remembers (progress v3). */
export interface DenLifeData {
  streak: StreakData;
  /** By YYYY-MM-DD, then game id. */
  daily: Record<string, Record<string, DailyRunData>>;
  kids: Partial<Record<KidId, KidRecordData>>;
  jacket: JacketData;
  versus: VersusData;
  runs: RunsData;
  /** Growth items already revealed, by item id, so each sparkles in only once. */
  growthSeen: Record<string, IsoTime>;
  /** When all 32 Counter lamps first lit; the celebration plays once. */
  counterCompletedAt: IsoTime | null;
}

export interface ProgressData {
  games: Record<string, GameProgressData>;
  den: DenLifeData;
}

export interface RunRecord {
  score: number;
  at: IsoTime;
  seed: number;
  durationMs: number;
  channel: string;
  mode: RunMode;
}

export interface RecordsData {
  /** Keyed by `${gameId}/${channelId}/${mode}`; each list sorted best first, at most 10. */
  boards: Record<string, RunRecord[]>;
}

export interface GameStatsData {
  plays: number;
  best: number | null;
  timePlayedMs: number;
  lastPlayedAt: IsoTime | null;
  /** Local versus wins by seat. */
  versusWins: { 1: number; 2: number };
}

export interface StatsData {
  games: Record<string, GameStatsData>;
}

export interface SaveSlotData {
  /** The game's own save format version. */
  v: number;
  savedAt: IsoTime;
  state: unknown;
}

export interface SavesData {
  games: Record<string, SaveSlotData>;
}

/** What one play session added up to; written by the event bus when a session ends. */
export interface SessionSummary {
  game: string;
  mode: RunMode;
  channel: string;
  startedAt: IsoTime;
  endedAt: IsoTime;
  durationMs: number;
  /** How many times each event type was emitted. */
  counts: Record<string, number>;
  /** The largest value seen for each numeric field, keyed `${type}.${field}`. */
  maxima: Record<string, number>;
}

export interface EventLogData {
  /** Newest last; capped at EVENT_LOG_LIMIT. */
  sessions: SessionSummary[];
}

export const EVENT_LOG_LIMIT = 200;
export const RECORDS_PER_BOARD = 10;
export const VERSUS_RECENT_LIMIT = 20;
