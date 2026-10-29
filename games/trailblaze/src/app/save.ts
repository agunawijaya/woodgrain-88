/**
 * Trailblaze's persistent save data: record lines per channel, opponent, and
 * memory mode, the Doodle artwork gallery, and tutorial completion.
 *
 * Saves are immutable and validation is tolerant field-by-field so that damaged
 * data does not discard unrelated records.
 */
import type { MemoryMode, SaveSlot } from '@woodgrain-88/kit';
import type { LookId } from '../look/look.ts';
import { LOOK_IDS } from '../look/looks.ts';
import type { OpponentChoice } from './settings.ts';

export interface RecordLine {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  /** Best winning margin, e.g. 10–4 is 6; 0 until a win. */
  readonly bestMargin: number;
  /** Longest the player rode in one point, in seconds. */
  readonly longestRide: number;
}

export interface DoodleEntry {
  readonly id: string; // `${savedAt}-${channelId}`
  readonly channelId: string;
  readonly look: LookId;
  readonly savedAt: number; // ms since epoch, from the caller
  /** The board as `encodeBoard` packs it. */
  readonly board: string;
  readonly filledPercent: number;
}

export interface TrailblazeSave {
  readonly version: number;
  /** Keyed by `recordKey(channelId, opponent, memory)`. */
  readonly records: Readonly<Record<string, RecordLine>>;
  /** Newest first, at most DOODLE_GALLERY_SIZE. */
  readonly doodles: readonly DoodleEntry[];
  readonly tutorialDone: boolean;
}

export const SAVE_VERSION = 1;
export const DOODLE_GALLERY_SIZE = 12;

export function emptySave(): TrailblazeSave {
  return {
    version: SAVE_VERSION,
    records: {},
    doodles: [],
    tutorialDone: false,
  };
}

/** `game-3|kid:rosa|human`, `game-2|computer|-`, `game-1|person|-`. */
export function recordKey(channelId: string, opponent: OpponentChoice, memory: MemoryMode): string {
  if (opponent.kind === 'kid') {
    return `${channelId}|kid:${opponent.kid}|${memory}`;
  }
  return `${channelId}|${opponent.kind}|-`;
}

export interface FinishedMatch {
  readonly channelId: string;
  readonly opponent: OpponentChoice;
  readonly memory: MemoryMode;
  readonly playerScore: number;
  readonly rivalScore: number;
  readonly longestRideSeconds: number;
}

export function recordMatch(save: TrailblazeSave, match: FinishedMatch): TrailblazeSave {
  const key = recordKey(match.channelId, match.opponent, match.memory);
  const prev: RecordLine = save.records[key] ?? {
    played: 0,
    won: 0,
    lost: 0,
    bestMargin: 0,
    longestRide: 0,
  };

  const isWin = match.playerScore > match.rivalScore;
  const isLoss = match.playerScore < match.rivalScore;
  const margin = isWin ? match.playerScore - match.rivalScore : 0;

  const nextLine: RecordLine = {
    played: prev.played + 1,
    won: prev.won + (isWin ? 1 : 0),
    lost: prev.lost + (isLoss ? 1 : 0),
    bestMargin: Math.max(prev.bestMargin, margin),
    longestRide: Math.max(prev.longestRide, match.longestRideSeconds),
  };

  return {
    ...save,
    records: {
      ...save.records,
      [key]: nextLine,
    },
  };
}

export function addDoodle(save: TrailblazeSave, entry: DoodleEntry): TrailblazeSave {
  const filtered = save.doodles.filter((d) => d.id !== entry.id);
  const nextDoodles = [entry, ...filtered].slice(0, DOODLE_GALLERY_SIZE);
  return {
    ...save,
    doodles: nextDoodles,
  };
}

export function finishTutorial(save: TrailblazeSave): TrailblazeSave {
  return {
    ...save,
    tutorialDone: true,
  };
}

function fieldsOf(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isLookId(value: unknown): value is LookId {
  return typeof value === 'string' && (LOOK_IDS as readonly string[]).includes(value);
}

function readRecords(value: unknown): Record<string, RecordLine> {
  const stored = fieldsOf(value);
  if (!stored) return {};

  const records: Record<string, RecordLine> = {};
  for (const [key, rawLine] of Object.entries(stored)) {
    if (key.length === 0) continue;
    const line = fieldsOf(rawLine);
    if (
      line &&
      isCount(line.played) &&
      isCount(line.won) &&
      isCount(line.lost) &&
      isNonNegativeNumber(line.bestMargin) &&
      isNonNegativeNumber(line.longestRide)
    ) {
      records[key] = {
        played: line.played,
        won: line.won,
        lost: line.lost,
        bestMargin: line.bestMargin,
        longestRide: line.longestRide,
      };
    }
  }
  return records;
}

function readDoodles(value: unknown): DoodleEntry[] {
  if (!Array.isArray(value)) return [];

  const doodles: DoodleEntry[] = [];
  for (const raw of value) {
    const entry = fieldsOf(raw);
    if (
      entry &&
      typeof entry.id === 'string' &&
      entry.id.length > 0 &&
      typeof entry.channelId === 'string' &&
      entry.channelId.length > 0 &&
      isLookId(entry.look) &&
      typeof entry.savedAt === 'number' &&
      Number.isFinite(entry.savedAt) &&
      typeof entry.board === 'string' &&
      typeof entry.filledPercent === 'number' &&
      Number.isFinite(entry.filledPercent) &&
      entry.filledPercent >= 0 &&
      entry.filledPercent <= 100
    ) {
      doodles.push({
        id: entry.id,
        channelId: entry.channelId,
        look: entry.look,
        savedAt: entry.savedAt,
        board: entry.board,
        filledPercent: entry.filledPercent,
      });
      if (doodles.length >= DOODLE_GALLERY_SIZE) {
        break;
      }
    }
  }
  return doodles;
}

export function readSave(slot: SaveSlot): TrailblazeSave {
  const stored = fieldsOf(slot.load(SAVE_VERSION));
  if (!stored) {
    return emptySave();
  }
  return {
    version: SAVE_VERSION,
    records: readRecords(stored.records),
    doodles: readDoodles(stored.doodles),
    tutorialDone: stored.tutorialDone === true,
  };
}

export function writeSave(slot: SaveSlot, save: TrailblazeSave): void {
  slot.store(SAVE_VERSION, save);
}
