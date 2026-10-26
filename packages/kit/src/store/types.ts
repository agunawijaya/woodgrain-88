/**
 * The shape of everything Woodgrain '88 remembers, one interface per
 * repository. These are the documents inside the store's envelopes and inside
 * an export file, so changing one means bumping its schema version and adding
 * a migration (schema.ts).
 */
import type { Bindings, Layout, Seat } from '../input.ts';
import type { AppearancePreference, IsoTime, RunMode } from '../types.ts';

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
  layout: Layout;
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

export interface ProgressData {
  games: Record<string, GameProgressData>;
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
