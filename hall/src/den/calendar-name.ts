/**
 * The wall calendar's accessible name. Speech input users say what they see, so the name carries
 * everything printed on the calendar, in the order it is printed, and only then adds in words what
 * the marks mean.
 */
export interface PrintedCalendar {
  /** The streak note pinned to the photo, when there is one. */
  readonly streak: { readonly current: number; readonly best: number } | null;
  readonly month: string;
  readonly day: string;
  /** The line along the bottom: the daily number, and today's channel once a game is playable. */
  readonly daily: string;
  /** Today's Power Cycle has been played (printed as a tick). */
  readonly played: boolean;
}

export function calendarName(printed: PrintedCalendar): string {
  const { streak, month, day, daily, played } = printed;
  const note = streak ? `${streak.current}, best ${streak.best}, ` : '';
  const playedWords = played ? ', played' : '';
  const streakWords = streak
    ? `, ${streak.current} ${streak.current === 1 ? 'day' : 'days'} in a row`
    : '';
  return `Calendar, ${note}${month} ${day}, ${daily}: today's Power Cycle${playedWords}${streakWords}`;
}
