/**
 * Gravity Duel's persistent save: records keyed per channel, opponent,
 * controls scheme and Kid setting (best margin of victory, fastest win,
 * most docks in solo). A run played with the trajectory guide on never
 * reaches `recordMatch`, so it never counts (Settings, "the trajectory
 * guide").
 */
import type { KidId, MemoryMode, SaveSlot } from '@woodgrain-88/kit';
import type { ControlScheme } from '../session/controls.ts';

export type Opponent = { readonly kind: 'kid'; readonly kid: KidId } | { readonly kind: 'person' };

export interface RecordLine {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  /** Duels and docking races: the best winning margin, points. 0 until a win. */
  readonly bestMargin: number;
  /** Duels and docking races: the fastest win, in ms; null until a win. */
  readonly fastestWinMs: number | null;
  /** Solo docking: the most docks in one run. */
  readonly mostDocks: number;
}

export interface GravitySave {
  readonly version: number;
  /** Keyed by `recordKey(channelId, opponent, scheme, memory)`. */
  readonly records: Readonly<Record<string, RecordLine>>;
  readonly tutorialDone: boolean;
}

export const SAVE_VERSION = 1;

export function emptySave(): GravitySave {
  return { version: SAVE_VERSION, records: {}, tutorialDone: false };
}

function opponentKey(opponent: Opponent): string {
  return opponent.kind === 'kid' ? `kid:${opponent.kid}` : 'person';
}

/** `game-4|kid:rosa|classic|human`, `game-14|person|modern|sharp` (solo has no opponent). */
export function recordKey(
  channelId: string,
  opponent: Opponent,
  scheme: ControlScheme,
  memory: MemoryMode,
): string {
  return `${channelId}|${opponentKey(opponent)}|${scheme}|${memory}`;
}

export interface FinishedMatch {
  readonly channelId: string;
  readonly opponent: Opponent;
  readonly scheme: ControlScheme;
  readonly memory: MemoryMode;
  readonly mode: 'duel' | 'race' | 'solo';
  readonly playerScore: number;
  readonly rivalScore: number;
  readonly durationMs: number;
  /** The guide disqualifies the run from every record, win or not. */
  readonly guideOn: boolean;
}

export function recordMatch(save: GravitySave, match: FinishedMatch): GravitySave {
  if (match.guideOn) return save;

  const key = recordKey(match.channelId, match.opponent, match.scheme, match.memory);
  const prev: RecordLine = save.records[key] ?? {
    played: 0,
    won: 0,
    lost: 0,
    bestMargin: 0,
    fastestWinMs: null,
    mostDocks: 0,
  };

  const isWin = match.playerScore > match.rivalScore;
  const isLoss = match.playerScore < match.rivalScore;
  const margin = isWin ? match.playerScore - match.rivalScore : 0;

  const nextLine: RecordLine = {
    played: prev.played + 1,
    won: prev.won + (isWin ? 1 : 0),
    lost: prev.lost + (isLoss ? 1 : 0),
    bestMargin: Math.max(prev.bestMargin, margin),
    fastestWinMs: isWin
      ? prev.fastestWinMs === null
        ? match.durationMs
        : Math.min(prev.fastestWinMs, match.durationMs)
      : prev.fastestWinMs,
    mostDocks: match.mode === 'solo' ? Math.max(prev.mostDocks, match.playerScore) : prev.mostDocks,
  };

  return { ...save, records: { ...save.records, [key]: nextLine } };
}

export function finishTutorial(save: GravitySave): GravitySave {
  return { ...save, tutorialDone: true };
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

function readRecords(value: unknown): Record<string, RecordLine> {
  const stored = fieldsOf(value);
  if (!stored) return {};
  const records: Record<string, RecordLine> = {};
  for (const [key, rawLine] of Object.entries(stored)) {
    if (key.length === 0) continue;
    const line = fieldsOf(rawLine);
    const fastest = line?.fastestWinMs;
    const validFastest = fastest === null || isNonNegativeNumber(fastest);
    if (
      line &&
      isCount(line.played) &&
      isCount(line.won) &&
      isCount(line.lost) &&
      isNonNegativeNumber(line.bestMargin) &&
      validFastest &&
      isCount(line.mostDocks)
    ) {
      records[key] = {
        played: line.played,
        won: line.won,
        lost: line.lost,
        bestMargin: line.bestMargin,
        fastestWinMs: fastest ?? null,
        mostDocks: line.mostDocks,
      };
    }
  }
  return records;
}

export function readSave(slot: SaveSlot): GravitySave {
  const stored = fieldsOf(slot.load(SAVE_VERSION));
  if (!stored) return emptySave();
  return {
    version: SAVE_VERSION,
    records: readRecords(stored.records),
    tutorialDone: stored.tutorialDone === true,
  };
}

export function writeSave(slot: SaveSlot, save: GravitySave): void {
  slot.store(SAVE_VERSION, save);
}
