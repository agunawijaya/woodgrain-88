---
id: den-streak
kind: engine
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/streak.ts
  - packages/kit/tests/streak.test.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/streak.test.ts
  - pnpm exec eslint packages/kit/src/streak.ts packages/kit/tests/streak.test.ts
  - pnpm exec prettier --check packages/kit/src/streak.ts packages/kit/tests/streak.test.ts
reads:
  - packages/kit/src/store/types.ts
  - packages/kit/src/daily.ts
  - packages/kit/src/types.ts
  - CLAUDE.md
---

## Goal

The forgiving streak behind the Den's wall calendar. Any finished run marks its UTC day. One
automatic **snow day** per ISO week covers a single missed day. A second miss leaves a gap, and a
gap is simply an empty square: no "streak lost" anywhere. This order covers the pure functions and
their tests only.

## Context

- Days are UTC calendar days keyed `YYYY-MM-DD`, the same keys as `utcDateKey` in `daily.ts`. The
  daily game is UTC too, so the calendar and the daily never disagree.
- The data is `StreakData` from `store/types.ts`: `{ days: Record<string, 'played' | 'snow'>; best:
number }`.
- CLAUDE.md rule 11: streaks forgive, and there is never pressure or guilt copy. This module has no
  copy at all; it only computes.

## Interface to implement

```ts
// packages/kit/src/streak.ts
import type { StreakData, StreakDayKind } from './store/types.ts';

/** The ISO 8601 week a day belongs to, e.g. "2026-W44". Weeks start on Monday. */
export function isoWeekKey(dayKey: string): string;

/**
 * Records a finished run at `now` and returns new data; the input is never mutated.
 * - Marks the day of `now` as 'played'.
 * - Every missed day between the latest recorded day and today becomes 'snow' when its ISO week
 *   has no snow day yet; the others stay unrecorded (gaps).
 * - Updates `best`.
 * - When `now` falls before the latest recorded day (the clock went backwards), returns the data
 *   unchanged.
 */
export function recordStreakDay(data: StreakData, now: Date): StreakData;

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
export function streakView(data: StreakData, now: Date): StreakView;

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
 */
export function calendarMonth(
  data: StreakData,
  year: number,
  month: number,
  now: Date,
): CalendarCell[];
```

## Behaviour and edge cases

1. First ever run: that day is 'played', `best` is 1, `current` is 1.
2. Playing twice on one day changes nothing the second time.
3. Days D and D+1 played: current is 2.
4. D played, D+1 missed, D+2 played, and D+1's ISO week had no snow day: D+1 becomes 'snow' and
   current is 3.
5. Two missed days in the same ISO week: the first becomes 'snow', the second stays a gap, and
   current after the next play is 1.
6. Two consecutive missed days in different ISO weeks (a Sunday and the Monday after): both
   become 'snow' and the streak continues.
7. A week that already used its snow day cannot cover another miss in that week.
8. Long absence (30 days): at most one snow day per week is written. The streak restarts at 1 on
   return, and `best` keeps the old high.
9. `streakView` with today unplayed:
   - yesterday played: current is the streak through yesterday;
   - last played two days ago, and the missed day is coverable: the streak is still alive;
   - the missed day is not coverable: current is 0.

   A snow day is never written by `streakView`; only `recordStreakDay` writes.

10. Clock backwards: `recordStreakDay` with a `now` before the latest key returns the data
    unchanged, so a future day is never awarded and the past is never rewritten.
11. UTC boundary: 23:59:59.999Z and 00:00:00.000Z next day are different days. Local time zones
    and daylight saving never matter: test with dates around a European DST change.
12. `isoWeekKey`: 2026-12-28 is "2026-W53"; 2027-01-01 is "2026-W53"; 2027-01-04 is "2027-W01".
    Check these against the ISO 8601 rule.
13. `calendarMonth` returns 28–31 cells with correct kinds and marks today. A February in a leap
    year has 29.
14. `best` never decreases.

## Tests required

One test per numbered behaviour, named for what it proves. Use fixed `Date` values only and never
read the real clock.

## Out of scope

Rendering, copy, storage wiring, or any other file.
