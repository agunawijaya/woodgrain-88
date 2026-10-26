---
id: den-versus
kind: engine
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/versus.ts
  - packages/kit/tests/versus.test.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/versus.test.ts
  - pnpm exec eslint packages/kit/src/versus.ts packages/kit/tests/versus.test.ts
  - pnpm exec prettier --check packages/kit/src/versus.ts packages/kit/tests/versus.test.ts
reads:
  - packages/kit/src/store/types.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/profile.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/input.ts
---

## Goal

Versus Night is a series between two seats on one machine, best of 3 or 5. The games are drawn
like a raffle from a pool, and a missing second player is filled by a Neighbourhood Kid. This order
covers the series state machine as pure functions, plus the helpers that fold a finished series
into the stored `VersusData`.

## Context

- `Seat` is `1 | 2` (from `input.ts`). `KidId` and `KIDS` live in `kids.ts`.
- `validateDisplayName` in `profile.ts` checks typed names; use its rules for human seat names.
- Use the kit's seeded RNG (`createRng`, `hashSeed` in `rng.ts`). A series is fully reproducible
  from its seed: the same seed gives the same raffle order.
- Stored shapes: `VersusData`, `VersusSeriesRecord` and `RivalryData` in `store/types.ts`.
  `VERSUS_RECENT_LIMIT` is 20.

## Interface to implement

```ts
// packages/kit/src/versus.ts
import type { Seat } from './input.ts';
import type { KidId } from './kids.ts';
import type { VersusData } from './store/types.ts';
import type { IsoTime } from './types.ts';

export type VersusSeat = { kind: 'human'; name: string } | { kind: 'kid'; kid: KidId };

export interface VersusSetup {
  seats: [VersusSeat, VersusSeat];
  bestOf: 3 | 5;
  /** Game ids to draw from; at least one. */
  pool: readonly string[];
  seed: number;
}

export type VersusPhase = 'drawing' | 'playing' | 'between' | 'finished';

export interface VersusGameResult {
  game: string;
  /** Null for a drawn game, which counts for nobody and is played again from a new draw. */
  winner: Seat | null;
}

export interface VersusSeries {
  readonly setup: VersusSetup;
  readonly phase: VersusPhase;
  readonly games: readonly VersusGameResult[];
  /** The game drawn for the current or next match; null before the first draw. */
  readonly current: string | null;
  readonly wins: readonly [number, number];
  readonly winner: Seat | null;
  /** How many draws have been made, so the raffle stays reproducible. */
  readonly draws: number;
}

/** Problems with a setup; empty when it can start. */
export function validateVersusSetup(setup: VersusSetup): string[];
/** Games a seat needs to win the series: 2 of 3, 3 of 5. */
export function winsNeeded(bestOf: 3 | 5): number;
/** What the chalkboard writes for a seat: the typed name or the kid's name. */
export function seatName(seat: VersusSeat): string;
/** A new series in phase 'drawing'. Throws if the setup is invalid. */
export function startSeries(setup: VersusSetup): VersusSeries;
/** Draws the next game ('drawing' or 'between' → 'playing'). */
export function drawNextGame(series: VersusSeries): VersusSeries;
/** Records the current game ('playing' → 'between' or 'finished'). */
export function recordGame(series: VersusSeries, winner: Seat | null): VersusSeries;
/** The same seats, length and pool with a new seed; a fresh series in phase 'drawing'. */
export function rematch(series: VersusSeries, seed: number): VersusSeries;
/** The same pair of names, whichever seat each took: lowercase, trimmed, sorted, joined by "|". */
export function rivalryKey(names: readonly [string, string]): string;
/** Folds a finished series into the stored Versus data; throws if the series is not finished. */
export function recordSeries(data: VersusData, series: VersusSeries, at: IsoTime): VersusData;
```

## Behaviour and edge cases

1. `validateVersusSetup` reports each of these problems:
   - a human name that fails `validateDisplayName`;
   - two kids (at least one seat must be human);
   - the same kid in both seats;
   - `bestOf` other than 3 or 5;
   - an empty pool;
   - a pool with duplicate ids.
2. `winsNeeded(3)` is 2 and `winsNeeded(5)` is 3.
3. Calling a transition from the wrong phase throws an `Error` naming the phases: drawing while
   'playing', recording while 'drawing', or anything after 'finished'.
4. The raffle draws from the pool with the series RNG. It never draws the game just played twice
   in a row when the pool has more than one game. With a one-game pool it always draws that game.
5. The same seed always gives the same sequence of draws, even across `recordGame` calls.
6. `recordGame` adds the game to `games`. A seat's win increments `wins`. Reaching `winsNeeded`
   finishes the series with that `winner`. A draw adds the game with `winner: null`, changes no
   wins, and moves to 'between'.
7. The series never ends in a tie: draws are replayed until someone reaches `winsNeeded`.
8. `rematch` keeps the seats, `bestOf` and pool, resets games, wins and draws, and uses the new
   seed.
9. `rivalryKey(['Ana', 'bo'])` equals `rivalryKey([' BO ', 'ana'])`.
10. `recordSeries`:
    - increments `seriesPlayed`;
    - appends a `VersusSeriesRecord`: names from `seatName`, `kids` with the kid id or null,
      `bestOf`, the games, and the winner;
    - trims `recent` to the newest `VERSUS_RECENT_LIMIT`;
    - updates the rivalry under `rivalryKey`: `names` sorted, series and games won in the order
      of `names`, and `lastAt`.

    It never mutates its inputs.

## Tests required

One test per numbered behaviour, plus a full best-of-5 played to 3–2 with a draw in the middle,
checked game by game.

## Out of scope

UI, storage wiring, other files.
