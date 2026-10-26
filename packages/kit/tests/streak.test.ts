/**
 * Tests for the forgiving wall calendar streak engine: ISO week keys,
 * recording streak days with automatic weekly snow days, calendar month
 * cell generation, and streak view projection.
 */
import { describe, expect, it } from 'vitest';
import type { StreakData } from '../src/store/types.ts';
import { calendarMonth, isoWeekKey, recordStreakDay, streakView } from '../src/streak.ts';

describe('streak', () => {
  it('1. first ever run marks day as played with best 1 and current 1', () => {
    const initial: StreakData = { days: {}, best: 0 };
    const now = new Date('2026-10-25T14:00:00.000Z');

    const updated = recordStreakDay(initial, now);
    expect(updated.days).toEqual({ '2026-10-25': 'played' });
    expect(updated.best).toBe(1);

    const view = streakView(updated, now);
    expect(view).toEqual({
      current: 1,
      best: 1,
      playedToday: true,
    });
  });

  it('2. playing twice on one day changes nothing the second time', () => {
    const initial: StreakData = { days: {}, best: 0 };
    const morning = new Date('2026-10-25T08:00:00.000Z');
    const evening = new Date('2026-10-25T21:45:00.000Z');

    const first = recordStreakDay(initial, morning);
    const second = recordStreakDay(first, evening);

    expect(second).toBe(first);
    expect(second.days).toEqual({ '2026-10-25': 'played' });
    expect(second.best).toBe(1);
  });

  it('3. consecutive days D and D+1 played yields current streak 2', () => {
    const day1 = new Date('2026-10-25T10:00:00.000Z');
    const day2 = new Date('2026-10-26T10:00:00.000Z');

    const d1 = recordStreakDay({ days: {}, best: 0 }, day1);
    const d2 = recordStreakDay(d1, day2);

    expect(d2.days).toEqual({
      '2026-10-25': 'played',
      '2026-10-26': 'played',
    });
    expect(d2.best).toBe(2);

    const view = streakView(d2, day2);
    expect(view.current).toBe(2);
    expect(view.best).toBe(2);
    expect(view.playedToday).toBe(true);
  });

  it('4. D played, D+1 missed, D+2 played covers D+1 as snow and current is 3', () => {
    // 2026-10-26 is Monday (Week 2026-W44).
    const monday = new Date('2026-10-26T09:00:00.000Z');
    const wednesday = new Date('2026-10-28T18:00:00.000Z');

    const d1 = recordStreakDay({ days: {}, best: 0 }, monday);
    const d3 = recordStreakDay(d1, wednesday);

    expect(d3.days).toEqual({
      '2026-10-26': 'played',
      '2026-10-27': 'snow',
      '2026-10-28': 'played',
    });
    expect(d3.best).toBe(3);

    const view = streakView(d3, wednesday);
    expect(view.current).toBe(3);
    expect(view.best).toBe(3);
  });

  it('5. two missed days in same ISO week covers first as snow, leaves second as gap, and current after next play is 1', () => {
    // 2026-10-26 Monday played, Tuesday and Wednesday missed, Thursday played.
    const monday = new Date('2026-10-26T12:00:00.000Z');
    const thursday = new Date('2026-10-29T12:00:00.000Z');

    const d1 = recordStreakDay({ days: {}, best: 0 }, monday);
    const d4 = recordStreakDay(d1, thursday);

    expect(d4.days).toEqual({
      '2026-10-26': 'played',
      '2026-10-27': 'snow',
      '2026-10-29': 'played',
    });
    expect(d4.days['2026-10-28']).toBeUndefined();

    const view = streakView(d4, thursday);
    expect(view.current).toBe(1);
  });

  it('6. two consecutive missed days across ISO week boundary both become snow and streak continues', () => {
    // Saturday 2026-11-07 (W45), Sunday 2026-11-08 (W45), Monday 2026-11-09 (W46), Tuesday 2026-11-10 (W46).
    const saturday = new Date('2026-11-07T12:00:00.000Z');
    const tuesday = new Date('2026-11-10T12:00:00.000Z');

    const d1 = recordStreakDay({ days: {}, best: 0 }, saturday);
    const d4 = recordStreakDay(d1, tuesday);

    expect(d4.days).toEqual({
      '2026-11-07': 'played',
      '2026-11-08': 'snow',
      '2026-11-09': 'snow',
      '2026-11-10': 'played',
    });
    expect(d4.best).toBe(4);

    const view = streakView(d4, tuesday);
    expect(view.current).toBe(4);
  });

  it('7. week that already used snow day cannot cover another miss in that week', () => {
    // 2026-10-26 Monday played.
    // 2026-10-27 Tuesday missed -> becomes snow on Wednesday play.
    // 2026-10-28 Wednesday played.
    // 2026-10-29 Thursday missed -> cannot become snow because week W44 already has 2026-10-27 as snow.
    // 2026-10-30 Friday played.
    const monday = new Date('2026-10-26T12:00:00.000Z');
    const wednesday = new Date('2026-10-28T12:00:00.000Z');
    const friday = new Date('2026-10-30T12:00:00.000Z');

    const d1 = recordStreakDay({ days: {}, best: 0 }, monday);
    const d3 = recordStreakDay(d1, wednesday);
    expect(d3.days['2026-10-27']).toBe('snow');

    const d5 = recordStreakDay(d3, friday);
    expect(d5.days['2026-10-29']).toBeUndefined();
    expect(d5.days['2026-10-30']).toBe('played');

    const view = streakView(d5, friday);
    expect(view.current).toBe(1);
    expect(view.best).toBe(3);
  });

  it('8. long absence of 30 days writes at most one snow day per week, restarting current at 1 while keeping best', () => {
    let data: StreakData = { days: {}, best: 0 };
    // Play 5 days in a row: 2026-08-01 to 2026-08-05.
    for (let day = 1; day <= 5; day++) {
      data = recordStreakDay(data, new Date(`2026-08-0${day}T12:00:00.000Z`));
    }
    expect(data.best).toBe(5);

    // Return after 30 days of absence: 2026-09-05.
    const returnDate = new Date('2026-09-05T12:00:00.000Z');
    const updated = recordStreakDay(data, returnDate);

    // Verify at most one snow day per ISO week was recorded.
    const snowWeeks = Object.entries(updated.days)
      .filter(([, kind]) => kind === 'snow')
      .map(([key]) => isoWeekKey(key));
    const uniqueSnowWeeks = new Set(snowWeeks);
    expect(snowWeeks.length).toBe(uniqueSnowWeeks.size);

    // Streak restarts at 1 on return, while best keeps the previous high.
    const view = streakView(updated, returnDate);
    expect(view.current).toBe(1);
    expect(view.best).toBe(5);
    expect(updated.best).toBe(5);
  });

  it('9. streakView with today unplayed computes alive streak for yesterday or coverable miss, 0 for uncoverable miss, and never writes snow', () => {
    // Subcase 1: yesterday played -> current is streak through yesterday.
    const dataYesterday: StreakData = {
      days: {
        '2026-10-24': 'played',
        '2026-10-25': 'played',
      },
      best: 2,
    };
    const today = new Date('2026-10-26T12:00:00.000Z');
    const view1 = streakView(dataYesterday, today);
    expect(view1.current).toBe(2);
    expect(view1.playedToday).toBe(false);
    expect(dataYesterday.days['2026-10-26']).toBeUndefined();

    // Subcase 2: last played two days ago, and missed day is coverable -> streak alive.
    // 2026-10-26 (Monday) played. 2026-10-27 (Tuesday) missed (coverable). Today is Wednesday 2026-10-28.
    const dataCoverable: StreakData = {
      days: {
        '2026-10-26': 'played',
      },
      best: 1,
    };
    const wednesday = new Date('2026-10-28T12:00:00.000Z');
    const view2 = streakView(dataCoverable, wednesday);
    expect(view2.current).toBe(1);
    expect(view2.playedToday).toBe(false);
    // streakView never writes a snow day into data.
    expect(dataCoverable.days['2026-10-27']).toBeUndefined();

    // Subcase 3: missed day is uncoverable because its week already used a snow day -> current is 0.
    const dataUncoverable: StreakData = {
      days: {
        '2026-10-26': 'snow',
        '2026-10-27': 'played',
      },
      best: 2,
    };
    // Missed day is Wednesday 2026-10-28. Today is Thursday 2026-10-29.
    // Week 2026-W44 already has snow on Monday, so Wednesday cannot be covered.
    const thursday = new Date('2026-10-29T12:00:00.000Z');
    const view3 = streakView(dataUncoverable, thursday);
    expect(view3.current).toBe(0);
    expect(view3.playedToday).toBe(false);
    expect(dataUncoverable.days['2026-10-28']).toBeUndefined();
  });

  it('10. recordStreakDay with clock backwards before latest key returns data unchanged without awarding future day or rewriting past', () => {
    const data: StreakData = {
      days: {
        '2026-10-28': 'played',
      },
      best: 1,
    };
    const backwardsNow = new Date('2026-10-25T12:00:00.000Z');
    const result = recordStreakDay(data, backwardsNow);

    expect(result).toBe(data);
    expect(result.days['2026-10-25']).toBeUndefined();
  });

  it('11. UTC boundary distinguishes 23:59:59.999Z from 00:00:00.000Z and is invariant to DST transitions', () => {
    // Step across midnight UTC.
    const beforeMidnight = new Date('2026-10-24T23:59:59.999Z');
    const afterMidnight = new Date('2026-10-25T00:00:00.000Z');

    const d1 = recordStreakDay({ days: {}, best: 0 }, beforeMidnight);
    expect(d1.days).toHaveProperty('2026-10-24');
    expect(d1.days['2026-10-25']).toBeUndefined();

    const d2 = recordStreakDay(d1, afterMidnight);
    expect(d2.days).toHaveProperty('2026-10-25');
    expect(streakView(d2, afterMidnight).current).toBe(2);

    // European DST change occurred on 2026-10-25: 03:00 CEST (+02:00) shifted back to 02:00 CET (+01:00).
    // Both times fall inside 2026-10-25 UTC (00:30 UTC and 01:30 UTC) and must share the same UTC date.
    const cestTime = new Date('2026-10-25T02:30:00.000+02:00');
    const cetTime = new Date('2026-10-25T02:30:00.000+01:00');

    const recordedCest = recordStreakDay(d1, cestTime);
    const recordedCet = recordStreakDay(recordedCest, cetTime);
    expect(recordedCet).toBe(recordedCest);
  });

  it('12. isoWeekKey follows ISO 8601 rules across year boundaries', () => {
    expect(isoWeekKey('2026-12-28')).toBe('2026-W53');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01');
  });

  it('13. calendarMonth returns 28 to 31 cells with correct kinds and marks today, including leap year February', () => {
    const data: StreakData = {
      days: {
        '2026-10-10': 'played',
        '2026-10-11': 'snow',
        '2026-10-13': 'played',
      },
      best: 2,
    };
    const now = new Date('2026-10-15T12:00:00.000Z');

    // Leap year February (2024): 29 days.
    const leapFeb = calendarMonth(data, 2024, 2, now);
    expect(leapFeb.length).toBe(29);
    expect(leapFeb[28]?.day).toBe(29);
    expect(leapFeb[28]?.key).toBe('2024-02-29');

    // Non-leap year February (2026): 28 days.
    const nonLeapFeb = calendarMonth(data, 2026, 2, now);
    expect(nonLeapFeb.length).toBe(28);
    expect(nonLeapFeb[27]?.day).toBe(28);

    // April: 30 days.
    const april = calendarMonth(data, 2026, 4, now);
    expect(april.length).toBe(30);

    // October 2026: 31 days with mixed kinds.
    const oct = calendarMonth(data, 2026, 10, now);
    expect(oct.length).toBe(31);

    // Days before first recorded day (1 to 9): blank, not today.
    for (let day = 1; day <= 9; day++) {
      expect(oct[day - 1]).toEqual({
        key: `2026-10-0${day}`,
        day,
        kind: 'blank',
        today: false,
      });
    }

    // Recorded days.
    expect(oct[9]).toEqual({
      key: '2026-10-10',
      day: 10,
      kind: 'played',
      today: false,
    });
    expect(oct[10]).toEqual({
      key: '2026-10-11',
      day: 11,
      kind: 'snow',
      today: false,
    });

    // Unrecorded gap day between first recorded and today.
    expect(oct[11]).toEqual({
      key: '2026-10-12',
      day: 12,
      kind: 'gap',
      today: false,
    });

    // Played day 13.
    expect(oct[12]).toEqual({
      key: '2026-10-13',
      day: 13,
      kind: 'played',
      today: false,
    });

    // Unrecorded gap day 14.
    expect(oct[13]).toEqual({
      key: '2026-10-14',
      day: 14,
      kind: 'gap',
      today: false,
    });

    // Today (15) while unplayed: blank and today === true.
    expect(oct[14]).toEqual({
      key: '2026-10-15',
      day: 15,
      kind: 'blank',
      today: true,
    });

    // Days after today (16 to 31): future and today === false.
    for (let day = 16; day <= 31; day++) {
      expect(oct[day - 1]).toEqual({
        key: `2026-10-${day}`,
        day,
        kind: 'future',
        today: false,
      });
    }

    // If today is played, its cell kind is 'played'.
    const playedTodayData: StreakData = {
      days: { ...data.days, '2026-10-15': 'played' },
      best: 2,
    };
    const octPlayedToday = calendarMonth(playedTodayData, 2026, 10, now);
    expect(octPlayedToday[14]).toEqual({
      key: '2026-10-15',
      day: 15,
      kind: 'played',
      today: true,
    });
  });

  it('14. best never decreases across missed streaks, resets or clock backwards', () => {
    const initial: StreakData = {
      days: {
        '2026-10-01': 'played',
        '2026-10-02': 'played',
        '2026-10-03': 'played',
        '2026-10-04': 'played',
        '2026-10-05': 'played',
      },
      best: 5,
    };

    // Playing after a large gap resets current to 1, but best stays 5.
    const afterGap = recordStreakDay(initial, new Date('2026-10-25T12:00:00.000Z'));
    expect(afterGap.best).toBe(5);
    expect(streakView(afterGap, new Date('2026-10-25T12:00:00.000Z')).best).toBe(5);

    // Clock backwards also keeps best at 5.
    const backwards = recordStreakDay(afterGap, new Date('2026-10-20T12:00:00.000Z'));
    expect(backwards.best).toBe(5);
  });
});
