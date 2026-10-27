/**
 * Hot & Cold's save slot: how the player stands against each Neighbourhood
 * Kid, matches played per channel, best runs per board, clean flag streaks,
 * and whether the tutorial is done. Stored values are verified field by
 * field so that damaged data costs only that field.
 */
import { KID_IDS, type KidId, type SaveSlot } from '@woodgrain-88/kit';

export interface KidRecord {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/** A best result on one board: a channel, played one way. */
export interface BestRun {
  /** The result's score (higher is better). */
  readonly score: number;
  /** How it reads, e.g. "12 flags" or "4 checks". */
  readonly label: string;
  /** ISO date-time. */
  readonly at: string;
}

export interface HotColdSave {
  readonly kids: Readonly<Record<KidId, KidRecord>>;
  /** Finished matches per channel id. */
  readonly played: Readonly<Record<string, number>>;
  /** Best per board; the key is `${channel}|${mode}|${clues}|${memory}` (see `boardKey`). */
  readonly bests: Readonly<Record<string, BestRun>>;
  /** Flags found in a row without setting off a bomb, carried from match to match. */
  readonly cleanStreak: number;
  readonly tutorialDone: boolean;
}

export const SAVE_VERSION = 1;

const NO_GAMES: KidRecord = { wins: 0, losses: 0, draws: 0 };

function emptyKids(): Record<KidId, KidRecord> {
  return Object.fromEntries(KID_IDS.map((kid) => [kid, NO_GAMES])) as Record<KidId, KidRecord>;
}

export function emptySave(): HotColdSave {
  return {
    kids: emptyKids(),
    played: {},
    bests: {},
    cleanStreak: 0,
    tutorialDone: false,
  };
}

export function boardKey(
  channel: string,
  mode: string,
  clues: 'notebook' | 'classic',
  memory: 'human' | 'sharp',
): string {
  return `${channel}|${mode}|${clues}|${memory}`;
}

/** A plain object's fields, or null for anything else (arrays, null, numbers...). */
function fieldsOf(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Unknown Kids are dropped and a damaged record starts again from zero. */
function readKids(value: unknown): Record<KidId, KidRecord> {
  const kids = emptyKids();
  const stored = fieldsOf(value);
  for (const kid of KID_IDS) {
    const record = fieldsOf(stored?.[kid]);
    if (record && isCount(record.wins) && isCount(record.losses) && isCount(record.draws)) {
      kids[kid] = { wins: record.wins, losses: record.losses, draws: record.draws };
    }
  }
  return kids;
}

function readPlayed(value: unknown): Record<string, number> {
  const stored = fieldsOf(value) ?? {};
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, number] => entry[0].length > 0 && isCount(entry[1]),
    ),
  );
}

function isBestRun(value: unknown): value is BestRun {
  const fields = fieldsOf(value);
  if (!fields) {
    return false;
  }
  const { score, label, at } = fields;
  return (
    typeof score === 'number' &&
    Number.isFinite(score) &&
    typeof label === 'string' &&
    label.length > 0 &&
    typeof at === 'string' &&
    at.length > 0
  );
}

function readBests(value: unknown): Record<string, BestRun> {
  const stored = fieldsOf(value) ?? {};
  const bests: Record<string, BestRun> = {};
  for (const [key, run] of Object.entries(stored)) {
    if (key.length > 0 && isBestRun(run)) {
      bests[key] = {
        score: run.score,
        label: run.label,
        at: run.at,
      };
    }
  }
  return bests;
}

/** The stored save, or an empty one when there is none or it does not validate. */
export function readSave(slot: SaveSlot): HotColdSave {
  const stored = fieldsOf(slot.load(SAVE_VERSION));
  if (!stored) {
    return emptySave();
  }
  return {
    kids: readKids(stored.kids),
    played: readPlayed(stored.played),
    bests: readBests(stored.bests),
    cleanStreak: isCount(stored.cleanStreak) ? stored.cleanStreak : 0,
    tutorialDone: stored.tutorialDone === true,
  };
}

export function writeSave(slot: SaveSlot, save: HotColdSave): void {
  slot.store(SAVE_VERSION, save);
}

export interface FinishedMatch {
  readonly channel: string;
  /** The Kid in seat 2, or null when seat 2 was a person or nobody. */
  readonly kid: KidId | null;
  /** Seat 1's outcome; null for solo play (no win or loss against anyone). */
  readonly outcome: 'win' | 'loss' | 'draw' | null;
  readonly board: string;
  readonly score: number;
  readonly label: string;
  readonly at: string;
}

/** Counts the match, adds the Kid's record, and keeps the best per board (a tie keeps the older). */
export function recordMatch(save: HotColdSave, match: FinishedMatch): HotColdSave {
  const playedCount = save.played[match.channel] ?? 0;
  const nextPlayed = {
    ...save.played,
    [match.channel]: playedCount + 1,
  };

  let nextKids = save.kids;
  if (match.kid !== null && match.outcome !== null) {
    const prev = save.kids[match.kid];
    nextKids = {
      ...save.kids,
      [match.kid]: {
        wins: prev.wins + (match.outcome === 'win' ? 1 : 0),
        losses: prev.losses + (match.outcome === 'loss' ? 1 : 0),
        draws: prev.draws + (match.outcome === 'draw' ? 1 : 0),
      },
    };
  }

  let nextBests = save.bests;
  const currentBest = save.bests[match.board];
  if (!currentBest || match.score > currentBest.score) {
    nextBests = {
      ...save.bests,
      [match.board]: {
        score: match.score,
        label: match.label,
        at: match.at,
      },
    };
  }

  return {
    kids: nextKids,
    played: nextPlayed,
    bests: nextBests,
    cleanStreak: save.cleanStreak,
    tutorialDone: save.tutorialDone,
  };
}

/** A flag found without a bomb on its field adds one to the streak; a bomb sets it back to 0. */
export function recordFlag(save: HotColdSave, clean: boolean): HotColdSave {
  return {
    ...save,
    cleanStreak: clean ? save.cleanStreak + 1 : 0,
  };
}

export function recordBomb(save: HotColdSave): HotColdSave {
  return {
    ...save,
    cleanStreak: 0,
  };
}

export function finishTutorial(save: HotColdSave): HotColdSave {
  return {
    ...save,
    tutorialDone: true,
  };
}
