---
id: den-kids
kind: ai
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/kids.ts
  - packages/kit/tests/kids.test.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/kids.test.ts
  - pnpm exec eslint packages/kit/src/kids.ts packages/kit/tests/kids.test.ts
  - pnpm exec prettier --check packages/kit/src/kids.ts packages/kit/tests/kids.test.ts
reads:
  - packages/kit/src/kids.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/types.ts
---

## Goal

Add the functions that games and the Hall need on top of the Neighbourhood Kids roster in
`packages/kit/src/kids.ts`:

- `kidById`;
- `aiSettings`, which turns a kid's personality into concrete AI knobs;
- `recordKidResult`, the player's record against each kid;
- `blockLadder`, the Block Ladder's state.

Add tests for all four.

## Context

`kids.ts` already holds the types, the six kids (`KIDS`), `KID_IDS` and `BLOCK_LADDER` (bottom
rung first: Pip, Benny, Dee, Rosa, Moss, Grandpa Lou). The lead wrote that data: **do not change
any of it.** Only add the new exports below the existing code. The stored record shape is
`KidRecordData` in `store/types.ts`; `DenLifeData['kids']` is
`Partial<Record<KidId, KidRecordData>>`.

## Interface to implement

```ts
// Added to packages/kit/src/kids.ts
import type { DenLifeData, KidRecordData } from './store/types.ts';
import type { IsoTime } from './types.ts';

/** Throws for an unknown id. */
export function kidById(id: KidId): Kid;

/** The knobs most game AIs have, worked out from a kid's personality. */
export interface AiSettings {
  /** Milliseconds before the bot answers something new. */
  reactionMs: number;
  /** Chance, 0–1, that a single decision is a mistake. */
  errorRate: number;
  /** 0–1: how much risk it takes for a bigger gain. */
  risk: number;
  /** Chance per decision of picking a near-best option on purpose. */
  randomness: number;
  /** Chance of a feint or bluff, where the game has one. */
  deception: number;
  /** How many rounds (or turns) of the player's play it remembers; 0 means it does not learn. */
  memory: number;
  /** Copies the player's habits instead of its own preferences (Benny). */
  mirror: boolean;
  /** 0–1: how far its error rate swings between hot and cold spells. */
  swing: number;
}

/** A game narrows or widens the ranges to fit its own pace; the defaults suit an action game. */
export interface AiRanges {
  /** [slowest, fastest] milliseconds. */
  reactionMs: readonly [number, number];
  /** [steadiest, sloppiest]. */
  errorRate: readonly [number, number];
  /** [none, most] rounds remembered. */
  memory: readonly [number, number];
}

export const DEFAULT_AI_RANGES: AiRanges;
// = { reactionMs: [900, 150], errorRate: [0.02, 0.35], memory: [0, 12] }

export function aiSettings(kid: KidId | Kid, ranges?: Partial<AiRanges>): AiSettings;

/**
 * The error rate for one round, given the kid's swing and a 0–1 number the game draws from its
 * seeded RNG: a hot spell lowers it, a cold one raises it, never outside [0, 1].
 */
export function errorRateForRound(settings: AiSettings, draw: number): number;

export type KidOutcome = 'win' | 'loss' | 'draw';

/** Folds one finished game against a kid into the record; `outcome` is the player's. Pure. */
export function recordKidResult(
  kids: DenLifeData['kids'],
  kid: KidId,
  outcome: KidOutcome,
  onA: boolean,
  at: IsoTime,
): DenLifeData['kids'];

export interface LadderView {
  /** Rungs climbed, 0–6: the longest run of BLOCK_LADDER, from the bottom, all beaten at least once. */
  rung: number;
  /** The next kid to beat, null at the top. */
  next: KidId | null;
  /** All six beaten: "Block champion". */
  champion: boolean;
  /** Kids beaten at least once with the player's switch on A, in ladder order. */
  beatenOnA: KidId[];
}

export function blockLadder(kids: DenLifeData['kids']): LadderView;
```

## Behaviour and edge cases

1. `aiSettings` mapping, with lerp meaning `a + (b - a) * t`:
   - `reactionMs` = round(lerp(slowest, fastest, reaction));
   - `errorRate` = lerp(steadiest, sloppiest, error);
   - `risk` = clamp01(0.6 × aggression + 0.4 × (1 − caution));
   - `randomness` and `deception` are copied from the personality;
   - `memory` = round(lerp(none, most, adaptivity));
   - `mirror` = `mirrorsPlayer`;
   - `swing` = streakiness.
2. Partial ranges merge over the defaults. It accepts a `KidId` or a `Kid`, with the same result.
3. Expected orderings, as sanity tests:
   - Dee reacts faster than Grandpa Lou;
   - Lou has the lowest error rate of all six;
   - Pip has the highest randomness and swing;
   - Rosa has the highest deception;
   - Benny has the most memory and is the only one with `mirror` true;
   - Dee has the highest risk and Moss the lowest.
4. `errorRateForRound`:
   - with `swing` 0 it returns `errorRate` for every draw;
   - with swing > 0, draw 0 is the hottest spell (lowest) and draw 1 the coldest (highest);
   - draw 0.5 returns `errorRate`;
   - the result stays within [0, 1].

   Use: errorRate × (1 + swing × (2 × draw − 1)), clamped.

5. `recordKidResult`:
   - increments `wins`, `losses` or `draws`;
   - a win on A also increments `winsOnA`;
   - sets `firstBeatenAt` on the first win, and `firstBeatenOnAAt` on the first win on A;
   - never overwrites a first-beaten time;
   - creates a zeroed record for a kid seen for the first time;
   - never mutates its input.
6. `blockLadder`:
   - beating kids out of order counts once the rungs below are beaten (beating Lou first gives
     rung 0 until Pip is beaten);
   - `next` is the first unbeaten kid in ladder order;
   - `champion` is true exactly at rung 6;
   - `beatenOnA` is in ladder order.
7. `kidById` throws for an unknown id cast through `as`.

## Tests required

One test per numbered behaviour, plus a test that the roster has six kids, ids matching `KID_IDS`,
every personality value within [0, 1], bios of at most 160 characters, and `BLOCK_LADDER` a
permutation of `KID_IDS`.

## Out of scope

The existing roster data, portraits, any rendering, any other file.
