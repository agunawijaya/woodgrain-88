---
id: tank-sim
kind: ai
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/sim/novice.ts
  - games/tank-duel/src/sim/duel.ts
  - games/tank-duel/src/sim/sweep.ts
  - games/tank-duel/scripts/simulate.ts
  - games/tank-duel/tests/sim.test.ts
  - games/tank-duel/tests/balance.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/sim.test.ts
  - pnpm exec eslint games/tank-duel/src/sim games/tank-duel/scripts games/tank-duel/tests/sim.test.ts games/tank-duel/tests/balance.test.ts
  - pnpm exec prettier --check games/tank-duel/src/sim games/tank-duel/scripts games/tank-duel/tests/sim.test.ts games/tank-duel/tests/balance.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/rules.ts
  - games/tank-duel/src/engine/channels.ts
  - games/tank-duel/src/engine/match.ts
  - games/tank-duel/src/engine/visibility.ts
  - games/tank-duel/src/engine/vec.ts
  - games/tank-duel/src/ai/commander.ts
  - games/tank-duel/src/ai/perception.ts
  - games/tank-duel/src/ai/navigation.ts
  - games/tank-duel/src/ai/aim.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/rng.ts
---

## Goal

Seeded bot-against-bot simulations that prove Tank Duel is balanced and every channel plays, plus a
scripted "novice human" to measure the Kids against. Three parts:

- A headless match runner.
- A sweep across all 31 channels and the six Kids, with a script that writes a Markdown report.
- Balance tests that lock in the targets with tolerances.

## Context

- A match runs headless: `createWorld(channel)`, `createMatch(channel, options, world)`, then
  `stepMatch(state, [stick0, stick1], 1/60, world)` until `state.over` (`engine/match.ts`).
- A Kid plays through `createCommander(kid, side, channel, world, rng)` and calls
  `commander.think(state, world, dt)` each step, before stepping (`ai/commander.ts`).
- Randomness only through the kit `createRng(seed)`. Fork one stream per player:
  `rng.fork('seat-0')` and `rng.fork('seat-1')`.
- Fairness: half of the seeds put contender A on side 0 and half on side 1. Spawns are mirrored
  but not identical in every situation.
- The targets to prove (from the game's design brief):
  1. On `game-1` (Guided · Sandbags), Grandpa Lou beats Pip in 70–85% of matches.
  2. Dee against Moss ends 40–60% either way.
  3. The novice human beats Pip in 35–55% of matches.
  4. Timed matches end with a combined score of 6–20 in 90% of seeds.
  5. No channel has more than 5% of bot-vs-bot matches end 0–0.

  Draws count as half a win in win rates.

## Interface to implement

```ts
// games/tank-duel/src/sim/novice.ts
import type { Rng } from '@woodgrain-88/kit';
import type { MatchWorld } from '../engine/match.ts';
import type { ChannelRules, MatchState, Side, StickInput } from '../engine/types.ts';

/** Anything that plays a seat: a Kid commander or the scripted novice. */
export interface Player {
  think(state: MatchState, world: MatchWorld, dt: number): StickInput;
}

/**
 * A first-time player, scripted: slow to react, turns towards the opponent when it can see it, drives
 * when roughly facing its way, fires when the opponent is within one heading step of straight ahead
 * and in line of sight, never banks a shot and never dodges. Mazes: it drives along a navigator route
 * towards the last place it saw the opponent.
 */
export function createNovice(
  side: Side,
  channel: ChannelRules,
  world: MatchWorld,
  rng: Rng,
): Player;
```

```ts
// games/tank-duel/src/sim/duel.ts
import type { KidId } from '@woodgrain-88/kit';
import type { ScoringRule, Side } from '../engine/types.ts';

export type Contender = { readonly kind: 'kid'; readonly kid: KidId } | { readonly kind: 'novice' };

export interface DuelOutcome {
  readonly channel: string;
  readonly seed: number;
  readonly scores: readonly [number, number];
  readonly winner: Side | null;
  readonly seconds: number;
  readonly hits: number;
  /** Scoring hits that had bounced at least once. */
  readonly bankHits: number;
}

export interface DuelOptions {
  readonly scoring?: ScoringRule;
  /** Stop early (a safety net for tests); the match counts as finished on points. */
  readonly maxSeconds?: number;
}

/** Plays one whole match headless at 60 steps a second. */
export function playDuel(
  channelId: string,
  contenders: readonly [Contender, Contender],
  seed: number,
  options?: DuelOptions,
): DuelOutcome;
```

```ts
// games/tank-duel/src/sim/sweep.ts
import type { Contender, DuelOptions, DuelOutcome } from './duel.ts';

export interface PairingResult {
  readonly channel: string;
  readonly a: Contender;
  readonly b: Contender;
  readonly matches: number;
  /** Contender a's share: wins plus half the draws, over matches. */
  readonly aRate: number;
  readonly draws: number;
  /** Matches that ended 0–0. */
  readonly scoreless: number;
  /** Combined score of each match, in order. */
  readonly totals: readonly number[];
  readonly bankHits: number;
}

/** Plays `seeds.length` matches; even-indexed seeds put a on side 0, odd ones on side 1. */
export function pairing(
  channelId: string,
  a: Contender,
  b: Contender,
  seeds: readonly number[],
  options?: DuelOptions,
): PairingResult;

/** Seeds 1..count, or any stable list; used everywhere so reports are reproducible. */
export function seeds(count: number, offset?: number): number[];

/** A Markdown report of a sweep, for the game's notes. */
export function sweepReport(
  results: readonly PairingResult[],
  outcomes?: readonly DuelOutcome[],
): string;
```

```ts
// games/tank-duel/scripts/simulate.ts
// `pnpm exec tsx games/tank-duel/scripts/simulate.ts [--quick]` runs:
//   - every channel with all 15 Kid pairings, 4 seeds each (2 with --quick), timed scoring;
//   - the four balance targets with 40 seeds each (12 with --quick);
// prints progress, and writes games/tank-duel/docs/SIMULATIONS.md with:
//   - a table per target with the measured value and pass/fail;
//   - a per-channel table: matches, scoreless %, median combined score, bank hits;
//   - the run time.
```

## Behaviour and edge cases

1. **playDuel.**
   - Build the world and match; options default to timed scoring, no handicaps, wiring off.
   - Create both players with forked rng streams.
   - Each step: ask both players (with the state before the step), then call `stepMatch`. Count the
     `hit` events, and as bank hits those with `bounces >= 1`.
   - Stop at `over`, or at `maxSeconds` (the winner is then decided on points).
   - Deterministic: the same arguments give the same outcome.
2. **pairing.**
   - Even-index seeds: a plays side 0. Odd-index seeds: b plays side 0.
   - Results are from a's point of view: a win when the winning side is a's, a draw counts half.
   - `scoreless` counts matches with both scores at 0.
3. **Novice.**
   - Reaction 0.45 s between decisions.
   - Perception through the AI's `createLookout`, so it is fair.
   - Turns towards the bearing (the nearest heading step).
   - Drives when within one step of its route's next waypoint, or the bearing in open ground.
   - Fires on a new press when the opponent is visible, within one heading step of dead ahead and in
     line of sight (`segmentBlocked` false).
   - Aircraft: turns towards the opponent and fires when lined up; throttle stays at cruise.
4. **Report.**
   - Plain Markdown tables. Percentages to one decimal, scores as integers.
   - Mark each target PASS or FAIL against its range.
5. **The script** must not run any test runner. It is a plain tsx script using the modules above. It
   only writes `games/tank-duel/docs/SIMULATIONS.md`.

## Tests required

`games/tank-duel/tests/sim.test.ts` (fast, under 60 s total):

- `playDuel` on `game-5` with two Kids and `maxSeconds: 30` finishes, and is deterministic for a
  seed;
- `pairing` swaps sides by seed index, and counts draws and scoreless matches correctly (check with
  2 seeds and a short `maxSeconds`);
- the novice fires at a target dead ahead on the Open Field within 2 s, and never fires with its
  shell in the air;
- `sweepReport` produces a table with every channel id it was given and PASS/FAIL marks.

`games/tank-duel/tests/balance.test.ts` (the locked targets):

- **Guard.** Wrap the suite in `describe.skipIf(!process.env.TANK_BALANCE)`, so the normal test run
  stays fast. The lead runs it with `TANK_BALANCE=1` before every release, and the acceptance
  command above does not run it.
- **Targets 1–3.** One `it` each, with 24 seeds (`seeds(24, 1000)`), asserting the measured rate
  within the target range widened by 7 points either side (sampling error on 24 matches). Each `it`
  gets a 10-minute timeout.
- **Target 4.** 24 timed matches across `game-1`, `game-3` and `game-15` with Kid pairings: at least
  80% have a combined score of 6–20 (widened from 90%).
- **Target 5.** For every channel, 6 matches between two mid Kids (Rosa and Benny): at most 1
  scoreless.

## Out of scope

Tuning the AI or the rules to meet the targets: the lead does that from your report. Do not edit
engine or AI files. If a target fails, report the numbers; do not change the targets.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions; kit imports from `@woodgrain-88/kit`. `console.log` is allowed in the script only.
