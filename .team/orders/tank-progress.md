---
id: tank-progress
kind: data
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/progress/events.ts
  - games/tank-duel/src/progress/patches.ts
  - games/tank-duel/src/progress/micro.ts
  - games/tank-duel/tests/progress.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/progress.test.ts
  - pnpm exec eslint games/tank-duel/src/progress games/tank-duel/tests/progress.test.ts
  - pnpm exec prettier --check games/tank-duel/src/progress games/tank-duel/tests/progress.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - packages/kit/src/patches.ts
  - packages/kit/src/events.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/kids.ts
  - packages/kit/tests/patches.test.ts
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/channels.ts
  - docs/guides/den-life-for-games.md
---

## Goal

Tank Duel's progress data: the events it reports to the kit, its seven patches, its five
micro-challenges, and one pure function that turns what happened in a match (engine events plus who
was playing) into the kit events that earn them. No DOM, no rendering. The game module calls
`progressEvents` after each match step and once at the match's end, and emits what it returns.

## Context

- Kit events are `{ type, data? }` with fields of type number, string or boolean, declared up front
  as `GameEventSchema`s. Patches and micro-challenges measure one metric over those events:
  - `count` of an event;
  - `max` of a numeric field;
  - `sum` of a numeric field.

  Optionally they are filtered to a channel or mode (`packages/kit/src/patches.ts`). The kit
  stamps every event with the game, channel, mode and the difficulty switches. A patch reached
  with the player's switch (seat 1) on A is gold.

- **Seats.** Seat 1 (side 0 in the engine) is always the player whose progress counts. Seat 2 is a
  second human or a Neighbourhood Kid (`KidId`).
- **Channels.**
  - Invisible-tank channels have `invisible: true`; billiard channels `billiard: true`.
  - Jet channels have `vehicles` containing `'jet'`. The "maze" boards are `sandbag-line` and
    `old-quarter`.
  - `game-26` is "One jet vs three": side 0 is the lone jet.

## Interface to implement

```ts
// games/tank-duel/src/progress/events.ts
import type { GameEvent, GameEventSchema, KidId } from '@woodgrain-88/kit';
import type { ChannelRules, MatchEvent, MatchState } from '../engine/types.ts';

/** Every event Tank Duel reports, for the manifest's `events`. */
export const TANK_EVENTS: readonly GameEventSchema[];

export interface MatchCircumstances {
  readonly channel: ChannelRules;
  /** The Kid in seat 2, or null when seat 2 is a person. */
  readonly kid: KidId | null;
  /** Seat 1's difficulty switch is on A. */
  readonly playerOnA: boolean;
}

/** The kit events one engine step produced (hits by seat 1, shots that bounced...). */
export function progressEvents(
  events: readonly MatchEvent[],
  circumstances: MatchCircumstances,
): GameEvent[];

/** The kit events for a finished match (who won, and against whom). */
export function matchEndEvents(state: MatchState, circumstances: MatchCircumstances): GameEvent[];

/** For the "Survive invisible" micro-challenge: emitted when its time runs out without seat 1 being hit. */
export const SURVIVED_EVENT: GameEvent;
```

```ts
// games/tank-duel/src/progress/patches.ts
import type { PatchDef } from '@woodgrain-88/kit';
export const TANK_PATCHES: readonly PatchDef[];
```

```ts
// games/tank-duel/src/progress/micro.ts
import type { MicroChallengeDef } from '@woodgrain-88/kit';
export const TANK_MICRO_CHALLENGES: readonly MicroChallengeDef[];
```

## Behaviour and edge cases

1. **Events (`TANK_EVENTS`).**
   - `hit`: seat 1 scored. Fields:
     - `bounces` (number): bounces before the hit;
     - `banked` (number): 1 when bounces is at least 1, else 0;
     - `billiard` (number): 1 on a billiard channel, else 0;
     - `points` (number).
   - `hit-taken`: seat 1 was hit. No fields.
   - `match-won`: seat 1 won the match. Fields:
     - `vsKid` (number): 1 when seat 2 was a Kid;
     - `invisible` (number): 1 on an invisible channel, against a Kid;
     - `jet` (number): 1 on a jet channel, against a Kid;
     - `louInvisibleMazeOnA` (number): 1 when the Kid was `lou`, the channel is invisible, its board
       is a maze, and `playerOnA`;
     - `loneJet` (number): 1 on `game-26`;
     - `kid` (string): the Kid's id, or `''`.
   - `match-lost`: seat 1 lost. Field `kid` (string).
   - `survived`: see `SURVIVED_EVENT`. No fields.

   Give each a one-line description.

2. **progressEvents.** For each engine event in order:
   - `hit` with `shooter: 0` gives `hit`, with the fields above;
   - `hit` with `victim: 0` gives `hit-taken`;
   - nothing else.
3. **matchEndEvents.** Only when `state.over`:
   - `winner === 0` gives `match-won` (fields above; every flag 0 when seat 2 is a person, except
     `loneJet`);
   - `winner === 1` gives `match-lost`;
   - a draw gives nothing.
4. **Patches** (titles of at most 28 characters, our own words, a plain description of what earns
   each):

   | id                 | tier   | title             | goal                                                                       |
   | ------------------ | ------ | ----------------- | -------------------------------------------------------------------------- |
   | `rookie-commander` | club   | Rookie Commander  | `sum` of `match-won.vsKid` ≥ 1                                             |
   | `ricochet`         | club   | Ricochet          | `sum` of `hit.banked` ≥ 10                                                 |
   | `bank-manager`     | pro    | Bank Manager      | `sum` of `hit.billiard` ≥ 10                                               |
   | `ghost`            | pro    | Ghost             | `sum` of `match-won.invisible` ≥ 1                                         |
   | `top-gun`          | pro    | Top Gun           | `sum` of `match-won.jet` ≥ 3                                               |
   | `grandpas-respect` | legend | Grandpa's Respect | `max` of `match-won.louInvisibleMazeOnA` ≥ 1                               |
   | `lone-wolf`        | secret | Lone Wolf         | `max` of `match-won.loneJet` ≥ 1, with a `hint` that does not give it away |

   The Remix channels are opened by `bank-manager` (Ricochet Royale), `ghost` (Blackout), `top-gun`
   (Ace Duel) and `grandpas-respect` (Last Tank). Add a second line to those descriptions saying
   which channel it opens ("Opens Ricochet Royale.").

5. **Micro-challenges**, 45 seconds each (`seconds: 45`), titles of at most 32 characters, `goal` as
   the line shown to the player:

   | id                  | channel   | title             | goal line                       | pass                   |
   | ------------------- | --------- | ----------------- | ------------------------------- | ---------------------- |
   | `hit-three`         | `game-4`  | Hit 3 times       | Hit the other tank 3 times      | `count` `hit` ≥ 3      |
   | `land-a-bank`       | `game-7`  | Land a bank shot  | Score with a shell that bounced | `sum` `hit.banked` ≥ 1 |
   | `survive-invisible` | `game-11` | Survive invisible | Get through without being hit   | `count` `survived` ≥ 1 |
   | `down-a-biplane`    | `game-15` | Down a biplane    | Shoot the other biplane down    | `count` `hit` ≥ 1      |
   | `jet-duel`          | `game-23` | Jet duel: 2 hits  | Hit the other jet twice         | `count` `hit` ≥ 2      |

6. Everything is plain data plus two small pure functions. Never mutate inputs.

## Tests required (`games/tank-duel/tests/progress.test.ts`)

- Every patch and micro-challenge is valid: ids kebab-case and unique, titles within their limits,
  the secret patch has a hint, at least one club, pro and legend. Every metric's event is declared in
  `TANK_EVENTS` and its field exists with type number. Every micro channel exists in `CHANNELS`.
- `progressEvents`:
  - a seat-1 banked hit on a billiard channel gives `hit` with `banked: 1, billiard: 1`;
  - a seat-2 hit gives `hit-taken`;
  - other engine events give nothing.
- `matchEndEvents`:
  - a win against `lou` on `game-11` with `playerOnA` sets `louInvisibleMazeOnA: 1`;
  - the same on B sets it 0;
  - a win on `game-26` sets `loneJet: 1`;
  - a win against a person sets `vsKid: 0`;
  - a loss gives `match-lost`; a draw nothing; nothing before `over`.
- **Earning.** Feed the events through a patch tracker built like `packages/kit/tests/patches.test.ts`
  does, and check that each patch earns exactly when it should (for example, ten banked hits earn
  Ricochet and nine do not).

## Out of scope

Emitting events (the game module does), the manifest, the UI. Do not edit other files.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, comments only where they explain why, in plain words. No `any`, no non-null assertions, no
commented-out code. Prettier: single quotes, width 100, trailing commas. Import with `.ts`
extensions; kit imports from `@woodgrain-88/kit`.
