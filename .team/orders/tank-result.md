---
id: tank-result
kind: data
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/session/result.ts
  - games/tank-duel/tests/result.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/result.test.ts
  - pnpm exec eslint games/tank-duel/src/session/result.ts games/tank-duel/tests/result.test.ts
  - pnpm exec prettier --check games/tank-duel/src/session/result.ts games/tank-duel/tests/result.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - packages/kit/src/contract.ts
  - packages/kit/src/share.ts
  - packages/kit/src/kids.ts
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/channels.ts
  - games/tank-duel/src/engine/match.ts
  - docs/guides/den-life-for-games.md
---

## Goal

Turn a finished Tank Duel match into the kit's `GameResult`: the score and its label, who won, a
few detail lines, and the emoji summary for share lines. This is pure data with no DOM.

## Context

- `GameResult` is in `packages/kit/src/contract.ts`. Tank Duel shows its own results screen, so
  `presentation` is always `'game'`.
- Seat 1 is side 0 in the engine, and seat 2 is side 1. Seat 1's points are the run's `score`:
  records and challenge links read "beat 9 hits".
- The kit's `emojiSummary` (in `share.ts`) checks an emoji string; use it to make sure what you
  build is valid.
- Last Tank counts rounds won in `scores`.

## Interface to implement

```ts
// games/tank-duel/src/session/result.ts
import type { GameResult, KidId } from '@woodgrain-88/kit';
import type { MatchEvent, MatchState, Side } from '../engine/types.ts';

export interface SeatSummary {
  readonly name: string;
  /** The Kid in this seat, or null for a person. */
  readonly kid: KidId | null;
}

export interface ScoredPoint {
  readonly side: Side;
  readonly points: number;
}

export interface MatchSummary {
  /** The match's last state; `over` is true. */
  readonly final: MatchState;
  readonly seats: readonly [SeatSummary, SeatSummary];
  /** Every scoring hit in order. */
  readonly points: readonly ScoredPoint[];
  readonly durationMs: number;
  /** Most bounces on one of seat 1's scoring hits this match (0 when none banked). */
  readonly bestBank: number;
}

/** The scoring hits among some engine events, in order. */
export function scoredPoints(events: readonly MatchEvent[]): ScoredPoint[];

/** "7–4", seat 1 first, with an en dash. */
export function scoreLabel(scores: readonly [number, number]): string;

/** One square per point in order (🟩 seat 1, 🟥 seat 2); past 12 points, the last 12. */
export function emojiLine(points: readonly ScoredPoint[]): string;

export function buildResult(summary: MatchSummary): GameResult;
```

## Behaviour and edge cases

1. `score` is `final.scores[0]`. `scoreLabel` is `scoreLabel(final.scores)`.
2. `winnerSeat` is 1 when `final.winner === 0`, 2 when it is 1, and `null` for a draw; always set.
   `won` is `final.winner === 0`, so a draw is not a win.
3. **`emoji`.**
   - One square per scoring hit, not per point: a three-point Ricochet Royale hit is one square.
   - When there are no hits, leave `emoji` out entirely (`exactOptionalPropertyTypes`: do not set it
     to `undefined`).
   - The result must pass `emojiSummary`.
4. **`details`**, in this order, at most four:
   - `{ label: 'Opponent', value: <seat 2 name> }`;
   - `{ label: 'Rule', value: 'Timed round' | 'First to 10' | 'First to 5 rounds' }`. Last Tank
     (`channel.remix?.kind === 'last-tank'`) reads "First to N rounds" from its `roundsToWin`;
     otherwise the rule follows `final.options.scoring`;
   - `{ label: 'Best bank', value: '×3' }` only when `bestBank > 0`;
   - `{ label: 'Channel', value: 'CH 07 · <channel title>' }`, using the channel's `number`
     padded to two digits.
5. `durationMs` comes from the summary, rounded to a whole number.
6. Never mutate the summary.

## Tests required (`games/tank-duel/tests/result.test.ts`)

Make the final states by running real matches, or with small hand-made `MatchState` values built
from `createMatch` plus overrides.

- Win, loss and draw give the right `won`, `winnerSeat` and `scoreLabel`, and the score is seat 1's
  points.
- The emoji line: the order of points, the "last 12" rule with 15 hits, a multi-point hit as one
  square, no hits meaning no `emoji` key, and `emojiSummary` accepts every line built.
- Details: the order; Best bank appears only when banked; the Last Tank rule label; the CH number
  padding.
- `scoredPoints` keeps only `hit` events, in order.

## Out of scope

Reporting the result, the results screen, records, anything outside the fence.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions; kit imports from `@woodgrain-88/kit`.
