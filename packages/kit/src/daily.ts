/**
 * The daily clock. Every player on Earth shares one UTC day, one daily
 * number and one Power Cycle game, so a daily score means the same thing
 * everywhere and needs no server. Streak rules belong to prompt 01.
 */
import type { ChannelDef } from './channels.ts';
import { createRng, hashSeed } from './rng.ts';
import { emojiSummary } from './share.ts';
import type { DailyRunData } from './store/types.ts';
import type { IsoTime } from './types.ts';

/** Daily #1. Changing it renumbers every daily, so it is set once. */
export const DAILY_EPOCH = '2026-10-25';

const MS_PER_DAY = 86_400_000;
const EPOCH_DAY_INDEX = utcDayIndex(new Date(`${DAILY_EPOCH}T00:00:00.000Z`));

/** Whole days since 1970-01-01 in UTC. */
export function utcDayIndex(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

/** "2026-10-25" for the UTC day containing `date`. */
export function utcDateKey(date: Date): string {
  return new Date(utcDayIndex(date) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 1 on DAILY_EPOCH, 2 the day after; days before the epoch give 0 or less. */
export function dailyNumber(date: Date): number {
  return utcDayIndex(date) - EPOCH_DAY_INDEX + 1;
}

/** The seed a game uses for its daily run: the same for everyone, different per game and day. */
export function dailySeed(gameId: string, date: Date): number {
  return hashSeed(`daily/${gameId}/${dailyNumber(date)}`);
}

/**
 * The day's Power Cycle game: a deterministic pick among playable games only
 * (coming-soon ones are skipped), spread so the same game rarely repeats on
 * consecutive days. Null when nothing is playable yet.
 */
export function powerCycleOfTheDay<T extends { id: string; status: 'playable' | 'coming-soon' }>(
  games: readonly T[],
  date: Date,
): T | null {
  const playable = games
    .filter((game) => game.status === 'playable')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const count = playable.length;
  if (count === 0) return null;

  const day = dailyNumber(date);
  let index = hashSeed(`power-cycle/${day}`) % count;
  if (count > 1) {
    const previousIndex = hashSeed(`power-cycle/${day - 1}`) % count;
    if (index === previousIndex) {
      index = (index + 1) % count;
    }
  }
  return playable[index] ?? null;
}

/**
 * The day's channel for a game: a seeded pick among its original channels, which are open to
 * everyone, so the daily is the same for every player. Only a game with no originals falls back
 * to all its channels.
 */
export function dailyChannel(
  game: { id: string; channels: readonly ChannelDef[] },
  date: Date,
): ChannelDef {
  const rng = createRng(dailySeed(game.id, date));
  const originals = game.channels.filter((channel) => channel.kind === 'original');
  return rng.pick(originals.length > 0 ? originals : game.channels);
}

/**
 * Keeps only a game's first run of a day for the daily score. Returns the new map and whether this
 * run counted; later runs that day are practice.
 */
export function recordDailyRun(
  daily: Readonly<Record<string, Readonly<Record<string, DailyRunData>>>>,
  date: Date,
  gameId: string,
  run: DailyRunData,
): { daily: Record<string, Record<string, DailyRunData>>; counted: boolean } {
  const dayKey = utcDateKey(date);
  const dayRuns = daily[dayKey];
  if (dayRuns?.[gameId] !== undefined) {
    const copy: Record<string, Record<string, DailyRunData>> = {};
    for (const [key, value] of Object.entries(daily)) {
      copy[key] = { ...value };
    }
    return { daily: copy, counted: false };
  }

  const copy: Record<string, Record<string, DailyRunData>> = {};
  for (const [key, value] of Object.entries(daily)) {
    copy[key] = { ...value };
  }
  copy[dayKey] = { ...(copy[dayKey] ?? {}), [gameId]: run };

  return { daily: copy, counted: true };
}

/** Whether a timestamp falls on the same UTC day as `now`. */
export function isSameUtcDay(at: IsoTime | null, now: Date): boolean {
  if (at === null) return false;
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return false;
  return utcDateKey(parsed) === utcDateKey(now);
}

export interface DailyShareLineInput {
  title: string;
  date: Date;
  channelNumber?: number;
  score?: string;
  emoji?: string;
  name?: string;
}

/**
 * The one-line share text, combining title, optional channel, score, verified emoji summary,
 * and player name separated by middots. Missing parts are omitted.
 */
export function dailyShareLine(input: DailyShareLineInput): string {
  const parts: string[] = [];
  parts.push(`Woodgrain '88 #${dailyNumber(input.date)}`);

  const titlePart =
    input.channelNumber !== undefined ? `${input.title} ch.${input.channelNumber}` : input.title;
  parts.push(titlePart);

  if (input.score !== undefined && input.score.length > 0) {
    parts.push(input.score);
  }

  if (input.emoji !== undefined && emojiSummary(input.emoji) !== null) {
    parts.push(input.emoji);
  }

  if (input.name !== undefined && input.name.length > 0) {
    parts.push(input.name);
  }

  return parts.join(' · ');
}
