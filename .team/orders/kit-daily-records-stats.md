---
id: kit-daily-records-stats
kind: engine
fence:
  - packages/kit/src/daily.ts
  - packages/kit/src/records.ts
  - packages/kit/src/stats.ts
  - packages/kit/tests/daily.test.ts
  - packages/kit/tests/records.test.ts
  - packages/kit/tests/stats.test.ts
  - packages/kit/tests/helpers/memory-repo.ts
acceptance:
  - pnpm exec vitest run packages/kit/tests/daily.test.ts packages/kit/tests/records.test.ts packages/kit/tests/stats.test.ts
  - pnpm exec tsc -p packages/kit/tsconfig.json
  - pnpm exec eslint packages/kit/src/daily.ts packages/kit/src/records.ts packages/kit/src/stats.ts packages/kit/tests/daily.test.ts packages/kit/tests/records.test.ts packages/kit/tests/stats.test.ts packages/kit/tests/helpers/memory-repo.ts
  - pnpm exec prettier --check packages/kit/src/daily.ts packages/kit/src/records.ts packages/kit/src/stats.ts packages/kit/tests
reads:
  - packages/kit/src/daily.ts
  - packages/kit/src/records.ts
  - packages/kit/src/stats.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/store/repos.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/types.ts
---

## Goal

Implement the daily clock, personal records and play statistics behind the signatures the lead
wrote in `daily.ts`, `records.ts` and `stats.ts`, with thorough tests.

## Context

- Replace each `export declare function` with an implementation; keep every exported name,
  signature, type and doc comment exactly. Private helpers are fine.
- Use `hashSeed` from `rng.ts` for `dailySeed` and for the Power Cycle pick. Never use
  `Math.random` or the wall clock inside these functions (dates come in as arguments).
- Repositories come from `store/repos.ts`, implemented in parallel by another order; do not import
  its implementation. Write `tests/helpers/memory-repo.ts` exporting
  `memoryRepo<T>(initial: T): Repository<T>` (in-memory get/set/update/reset/onChange, deep copy
  in update via `structuredClone`) for your tests.
- Strict TypeScript and strict type-checked ESLint (no `any`, no `!`). Vitest; import with `.ts`.

## Interface to implement

The declarations in `daily.ts`, `records.ts` and `stats.ts`.

## Behaviour and edge cases

Daily:

1. `utcDayIndex` = floor(UTC milliseconds / 86 400 000). `utcDateKey` = ISO date of that UTC day.
2. `dailyNumber(date)` = utcDayIndex(date) − utcDayIndex(DAILY_EPOCH at 00:00 UTC) + 1.
   23:59:59 UTC and 00:00:00 UTC the next day differ by one; local time zones never matter.
3. `dailySeed(gameId, date)` = `hashSeed(\`daily/${gameId}/${dailyNumber(date)}\`)`.
4. `powerCycleOfTheDay`: filter to `status === 'playable'`, sort by `id` so input order does not
   matter, return null when empty. Pick with `hashSeed(\`power-cycle/${dailyNumber(date)}\`)` modulo
   the count; if that equals the previous day's pick and there is more than one candidate, take the
   next candidate in sorted order. Deterministic for a given date and game list.
5. `isSameUtcDay(null, now)` is false; otherwise compares `utcDateKey`.
6. `dailyShareLine`: `Woodgrain '88 · Daily #<n> · <title>` then ` · <score>` when a score is given,
   then a space and the squares joined with nothing when squares are given.

Records: 7. `boardKey` = `${gameId}/${channel}/${mode}`. 8. `compareRuns` by score in the given order; ties are equal (0). 9. `submit` inserts after any equal-score runs already on the board (earlier run keeps the higher
place), trims to `RECORDS_PER_BOARD`, persists through `repo.update`, and returns the 1-based
rank or null if it fell off the end. `newBest` is true when it took rank 1 strictly ahead of the
previous best or the board was empty. 10. `top` returns a copy, best first. `best` is the first or null. `bestOverall` looks across every
board whose key starts with `${gameId}/`. `forget` removes those boards.

Stats: 11. `game` returns stored stats or zeros (`best: null`, `lastPlayedAt: null`, wins 0/0). 12. `recordPlay` increments plays, adds `durationMs` (negative or non-finite treated as 0), sets
`lastPlayedAt` to `now().toISOString()`, updates `best` with the score in the given order, and
adds a versus win to the winning seat. 13. `totals` sums plays and time over games, counts games with plays > 0, takes the latest
`lastPlayedAt`, and counts versus matches as the sum of all wins.

## Tests required

Written first, covering each numbered behaviour plus: daily numbers across a leap day and a year
boundary; the epoch day is #1 and the day before is #0; Power Cycle never returns a coming-soon
game, is stable when the input list is shuffled, avoids repeating yesterday's game when it can, and
returns null with no playable games; records for a lower-is-better game (golf strokes); ties keep
the earlier run first; an eleventh run worse than all others returns rank null and leaves the board
at ten; stats totals over three games. Use fixed `Date` values only.

## Out of scope

The store implementation, UI, streak rules, anything outside the fence.
