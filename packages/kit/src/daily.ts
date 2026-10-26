/**
 * The daily clock. Every player on Earth shares one UTC day, one daily
 * number and one Power Cycle game, so a daily score means the same thing
 * everywhere and needs no server. Streak rules belong to prompt 01.
 */
import { hashSeed } from './rng.ts';
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

/** Whether a timestamp falls on the same UTC day as `now`. */
export function isSameUtcDay(at: IsoTime | null, now: Date): boolean {
  if (at === null) return false;
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return false;
  return utcDateKey(parsed) === utcDateKey(now);
}

/**
 * The one-line share text, e.g.
 * "Woodgrain '88 · Daily #12 · Paint Tanks · 3–1" (a score line is optional,
 * and so is a row of emoji squares appended after a space).
 */
export function dailyShareLine(input: {
  title: string;
  date: Date;
  score?: string;
  squares?: readonly string[];
}): string {
  let line = `Woodgrain '88 · Daily #${dailyNumber(input.date)} · ${input.title}`;
  if (input.score !== undefined && input.score.length > 0) {
    line += ` · ${input.score}`;
  }
  if (input.squares !== undefined && input.squares.length > 0) {
    line += ` ${input.squares.join('')}`;
  }
  return line;
}
