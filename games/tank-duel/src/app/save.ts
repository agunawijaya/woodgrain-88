/**
 * Tank Duel's save slot: how the player stands against each Neighbourhood
 * Kid, the best bank shot ever landed, matches played per channel, and
 * whether the tutorial is done. Whatever comes back from the slot is checked
 * field by field, so a damaged save costs only the damaged part.
 */
import { KID_IDS, type KidId, type SaveSlot } from '@woodgrain-88/kit';

export interface KidRecord {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export interface BestBank {
  readonly bounces: number;
  readonly channel: string;
  /** ISO date-time of the match. */
  readonly at: string;
}

export interface TankSave {
  readonly kids: Readonly<Record<KidId, KidRecord>>;
  readonly bestBank: BestBank | null;
  /** Finished matches per channel id. */
  readonly played: Readonly<Record<string, number>>;
  readonly tutorialDone: boolean;
}

export const SAVE_VERSION = 1;

const NO_GAMES: KidRecord = { wins: 0, losses: 0, draws: 0 };

function emptyKids(): Record<KidId, KidRecord> {
  return Object.fromEntries(KID_IDS.map((kid) => [kid, NO_GAMES])) as Record<KidId, KidRecord>;
}

export function emptySave(): TankSave {
  return { kids: emptyKids(), bestBank: null, played: {}, tutorialDone: false };
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

function readBestBank(value: unknown): BestBank | null {
  const bank = fieldsOf(value);
  if (!bank) return null;
  const { bounces, channel, at } = bank;
  const valid =
    isCount(bounces) &&
    bounces > 0 &&
    typeof channel === 'string' &&
    channel.length > 0 &&
    typeof at === 'string' &&
    at.length > 0;
  return valid ? { bounces, channel, at } : null;
}

function readPlayed(value: unknown): Record<string, number> {
  const stored = fieldsOf(value) ?? {};
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, number] => entry[0].length > 0 && isCount(entry[1]),
    ),
  );
}

/** The stored save, or an empty one when there is none or it does not validate. */
export function readSave(slot: SaveSlot): TankSave {
  const stored = fieldsOf(slot.load(SAVE_VERSION));
  if (!stored) return emptySave();
  return {
    kids: readKids(stored.kids),
    bestBank: readBestBank(stored.bestBank),
    played: readPlayed(stored.played),
    tutorialDone: stored.tutorialDone === true,
  };
}

export function writeSave(slot: SaveSlot, save: TankSave): void {
  slot.store(SAVE_VERSION, save);
}

export interface FinishedMatch {
  readonly channel: string;
  /** The Kid in seat 2, or null for a person. */
  readonly kid: KidId | null;
  /** From seat 1's side. */
  readonly outcome: 'win' | 'loss' | 'draw';
  /** Most bounces on one of seat 1's scoring hits (0 when none banked). */
  readonly bestBank: number;
  readonly at: string;
}

/** The save after one more finished match. Pure; returns a new object. */
export function recordMatch(save: TankSave, match: FinishedMatch): TankSave {
  const playedCount = save.played[match.channel] ?? 0;
  const nextPlayed = {
    ...save.played,
    [match.channel]: playedCount + 1,
  };

  let nextKids = save.kids;
  if (match.kid !== null) {
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

  let nextBank = save.bestBank;
  if (match.bestBank > 0 && (save.bestBank === null || match.bestBank > save.bestBank.bounces)) {
    nextBank = {
      bounces: match.bestBank,
      channel: match.channel,
      at: match.at,
    };
  }

  return {
    kids: nextKids,
    bestBank: nextBank,
    played: nextPlayed,
    tutorialDone: save.tutorialDone,
  };
}

export function finishTutorial(save: TankSave): TankSave {
  return {
    ...save,
    tutorialDone: true,
  };
}
