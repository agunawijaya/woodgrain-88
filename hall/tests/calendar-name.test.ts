/**
 * The calendar's accessible name holds everything printed on it, in printed order, so a speech
 * input user can say what they see; the words that explain the marks come after.
 */
import { describe, expect, it } from 'vitest';
import { calendarName } from '../src/den/calendar-name.ts';

const tokens = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Whether the printed words appear in the name as one unbroken run, as axe checks it. */
function namesWhatIsPrinted(name: string, printed: string): boolean {
  const nameWords = tokens(name).join(' ');
  return ` ${nameWords} `.includes(` ${tokens(printed).join(' ')} `);
}

describe('calendar name', () => {
  it('names the date and the daily line before any game is playable', () => {
    const name = calendarName({
      streak: null,
      month: 'October',
      day: '27',
      daily: 'Daily #3',
      played: false,
    });
    expect(name).toBe("Calendar, October 27, Daily #3: today's Power Cycle");
  });

  it("carries today's channel and the tick once a game is playable and played", () => {
    const name = calendarName({
      streak: null,
      month: 'October',
      day: '27',
      daily: 'Daily #3 · ch 10',
      played: true,
    });
    expect(namesWhatIsPrinted(name, 'OCTOBER 27 Daily #3 · ch 10 ✓')).toBe(true);
    expect(name).toContain('played');
  });

  it('puts the streak note first, as it is printed above the date', () => {
    const name = calendarName({
      streak: { current: 3, best: 5 },
      month: 'October',
      day: '27',
      daily: 'Daily #3 · ch 10',
      played: false,
    });
    expect(namesWhatIsPrinted(name, '3 best 5 OCTOBER 27 Daily #3 · ch 10')).toBe(true);
    expect(name).toContain('3 days in a row');
  });
});
