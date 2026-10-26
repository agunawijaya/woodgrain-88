/**
 * The forgiving streak behind the Den's wall calendar.
 *
 * Finished runs mark their UTC day as played. Each ISO week can award one
 * automatic snow day to cover a single missed day. Missed days beyond that
 * remain unrecorded gaps. The streak is forgiving and computational only,
 * with no pressure or guilt copy.
 */
import type { StreakData, StreakDayKind } from './store/types.ts';
import { utcDateKey, utcDayIndex } from './daily.ts';

const MS_PER_DAY = 86_400_000;

/**
 * Counts consecutive covered ('played' or 'snow') days walking backwards
 * from `endKey`.
 */
function countCoveredDaysEndingAt(
  days: Readonly<Record<string, StreakDayKind>>,
  endKey: string,
): number {
  let count = 0;
  let currentIndex = utcDayIndex(new Date(`${endKey}T00:00:00.000Z`));
  for (;;) {
    const key = utcDateKey(new Date(currentIndex * MS_PER_DAY));
    const kind = days[key];
    if (kind === 'played' || kind === 'snow') {
      count++;
      currentIndex--;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Collects the ISO week keys that already have an assigned snow day.
 */
function getUsedSnowWeeks(days: Readonly<Record<string, StreakDayKind>>): Set<string> {
  const weeks = new Set<string>();
  for (const [key, kind] of Object.entries(days)) {
    if (kind === 'snow') {
      weeks.add(isoWeekKey(key));
    }
  }
  return weeks;
}

/** The ISO 8601 week a day belongs to, e.g. "2026-W44". Weeks start on Monday. */
export function isoWeekKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  const day = date.getUTCDay();
  // Monday is 1, Sunday is 7.
  const isoDay = day === 0 ? 7 : day;
  // Thursday in the same week determines the ISO week-numbering year.
  const thursday = new Date(date.getTime() + (4 - isoDay) * MS_PER_DAY);
  const isoYear = thursday.getUTCFullYear();
  // Find the first Thursday of that ISO year.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 1));
  while (firstThursday.getUTCDay() !== 4) {
    firstThursday.setUTCDate(firstThursday.getUTCDate() + 1);
  }
  const weekDiff = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  const weekNum = 1 + weekDiff;
  const weekStr = weekNum < 10 ? `0${weekNum}` : `${weekNum}`;
  return `${isoYear}-W${weekStr}`;
}

/**
 * Records a finished run at `now` and returns new data; the input is never mutated.
 * - Marks the day of `now` as 'played'.
 * - Every missed day between the latest recorded day and today becomes 'snow' when its ISO week
 *   has no snow day yet; the others stay unrecorded (gaps).
 * - Updates `best`.
 * - When `now` falls before the latest recorded day (the clock went backwards), returns the data
 *   unchanged.
 */
export function recordStreakDay(data: StreakData, now: Date): StreakData {
  const todayKey = utcDateKey(now);
  const recordedKeys = Object.keys(data.days).sort();

  if (recordedKeys.length > 0) {
    const latestKey = recordedKeys[recordedKeys.length - 1];
    if (latestKey !== undefined) {
      // Clock moved backwards before the latest recorded day; keep history intact.
      if (todayKey < latestKey) {
        return data;
      }
      // Playing again on the same day is idempotent.
      if (todayKey === latestKey && data.days[todayKey] === 'played') {
        return data;
      }
    }
  }

  const newDays: Record<string, StreakDayKind> = { ...data.days };

  if (recordedKeys.length > 0) {
    const latestKey = recordedKeys[recordedKeys.length - 1];
    if (latestKey !== undefined) {
      const startIndex = utcDayIndex(new Date(`${latestKey}T00:00:00.000Z`)) + 1;
      const endIndex = utcDayIndex(new Date(`${todayKey}T00:00:00.000Z`)) - 1;

      if (startIndex <= endIndex) {
        const usedSnowWeeks = getUsedSnowWeeks(data.days);
        for (let i = startIndex; i <= endIndex; i++) {
          const dayKey = utcDateKey(new Date(i * MS_PER_DAY));
          const week = isoWeekKey(dayKey);
          if (!usedSnowWeeks.has(week)) {
            usedSnowWeeks.add(week);
            newDays[dayKey] = 'snow';
          }
        }
      }
    }
  }

  newDays[todayKey] = 'played';

  const currentStreak = countCoveredDaysEndingAt(newDays, todayKey);
  const newBest = Math.max(data.best, currentStreak);

  return {
    days: newDays,
    best: newBest,
  };
}

export interface StreakView {
  /** Consecutive covered days up to the latest one, if that streak is still alive at `now`. */
  current: number;
  best: number;
  playedToday: boolean;
}

/**
 * The streak as the calendar shows it. A streak stays alive while every day between the latest
 * covered day and yesterday could still be covered by a snow day; today does not need to be
 * played yet.
 */
export function streakView(data: StreakData, now: Date): StreakView {
  const todayKey = utcDateKey(now);
  const isPlayedToday = data.days[todayKey] === 'played';

  if (isPlayedToday) {
    const current = countCoveredDaysEndingAt(data.days, todayKey);
    return {
      current,
      best: Math.max(data.best, current),
      playedToday: true,
    };
  }

  // Today is unplayed. Check whether the streak through the latest covered day is still alive.
  const coveredBeforeToday = Object.keys(data.days)
    .filter((k) => k < todayKey && (data.days[k] === 'played' || data.days[k] === 'snow'))
    .sort();

  if (coveredBeforeToday.length === 0) {
    return {
      current: 0,
      best: data.best,
      playedToday: false,
    };
  }

  const latestCoveredKey = coveredBeforeToday[coveredBeforeToday.length - 1];
  if (latestCoveredKey === undefined) {
    return {
      current: 0,
      best: data.best,
      playedToday: false,
    };
  }

  const startIndex = utcDayIndex(new Date(`${latestCoveredKey}T00:00:00.000Z`)) + 1;
  const endIndex = utcDayIndex(new Date(`${todayKey}T00:00:00.000Z`)) - 1;

  if (startIndex > endIndex) {
    // Yesterday was covered: streak is alive through yesterday.
    const current = countCoveredDaysEndingAt(data.days, latestCoveredKey);
    return {
      current,
      best: Math.max(data.best, current),
      playedToday: false,
    };
  }

  // Check if every missed day could still be covered by an available snow day.
  const usedSnowWeeks = getUsedSnowWeeks(data.days);
  let canCoverAll = true;

  for (let i = startIndex; i <= endIndex; i++) {
    const dayKey = utcDateKey(new Date(i * MS_PER_DAY));
    const week = isoWeekKey(dayKey);
    if (usedSnowWeeks.has(week)) {
      canCoverAll = false;
      break;
    }
    usedSnowWeeks.add(week);
  }

  if (!canCoverAll) {
    return {
      current: 0,
      best: data.best,
      playedToday: false,
    };
  }

  const current = countCoveredDaysEndingAt(data.days, latestCoveredKey);
  return {
    current,
    best: Math.max(data.best, current),
    playedToday: false,
  };
}

export type CalendarCellKind = StreakDayKind | 'gap' | 'future' | 'blank';

export interface CalendarCell {
  key: string;
  /** 1–31. */
  day: number;
  kind: CalendarCellKind;
  today: boolean;
}

/**
 * One month for the wall calendar, every day of the month in order:
 * - 'played' or 'snow' as recorded;
 * - 'future' for days after `now`;
 * - 'gap' for unrecorded days after the first recorded day and before today;
 * - 'blank' for days before the first recorded day ever, and for today while it is unplayed.
 *
 * @param month 1–12 (1 for January, 12 for December).
 */
export function calendarMonth(
  data: StreakData,
  year: number,
  month: number,
  now: Date,
): CalendarCell[] {
  const todayKey = utcDateKey(now);
  const recordedKeys = Object.keys(data.days).sort();
  const firstRecordedKey = recordedKeys[0];

  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = [];

  const yearStr = String(year).padStart(4, '0');
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    const cellKey = `${yearStr}-${monthStr}-${dayStr}`;
    const isToday = cellKey === todayKey;

    let kind: CalendarCellKind;
    const recordedKind = data.days[cellKey];

    if (recordedKind !== undefined) {
      kind = recordedKind;
    } else if (cellKey > todayKey) {
      kind = 'future';
    } else if (isToday) {
      kind = 'blank';
    } else if (firstRecordedKey === undefined || cellKey < firstRecordedKey) {
      kind = 'blank';
    } else {
      kind = 'gap';
    }

    cells.push({
      key: cellKey,
      day: d,
      kind,
      today: isToday,
    });
  }

  return cells;
}
