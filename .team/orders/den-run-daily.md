---
id: den-run-daily
kind: engine
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/run.ts
  - packages/kit/tests/run.test.ts
  - packages/kit/src/daily.ts
  - packages/kit/tests/daily.test.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/run.test.ts packages/kit/tests/daily.test.ts
  - pnpm exec eslint packages/kit/src/run.ts packages/kit/tests/run.test.ts packages/kit/src/daily.ts packages/kit/tests/daily.test.ts
  - pnpm exec prettier --check packages/kit/src/run.ts packages/kit/tests/run.test.ts packages/kit/src/daily.ts packages/kit/tests/daily.test.ts
reads:
  - packages/kit/src/micro.ts
  - packages/kit/src/daily.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/share.ts
  - packages/kit/src/store/types.ts
  - packages/kit/tests/daily.test.ts
---

## Goal

Two pieces of Den Life's daily loop.

1. **The Power Cycle Run scheduler** (`run.ts`). Five games, each started with one of its 45-second
   micro-challenges. The power switch flips by itself between rounds, a little faster each round.
   The score is passes times a time bonus. The run has a share line, and its results go into
   `RunsData`.
2. **Daily extensions** (`daily.ts`):
   - the day's channel;
   - the rule that only a game's first run of the day counts for the daily score;
   - a new share-line format with the channel number and the game's emoji.

## Context

- `MicroChallengeDef`, `MicroResult` and `MICRO_DEFAULT_SECONDS` are in `micro.ts`. The kit's
  `startMicro` runs one challenge and produces a `MicroResult`; this order only schedules, scores
  and records.
- `ChannelDef` (`channels.ts`) now has `kind: 'original' | 'remix'`. The day's channel may be any
  channel, remix included: a remix drawn for the day is open to everyone for that day's run, so the
  shared daily is the same for every player.
- `RunsData`, `RunResultData`, `RunRoundData` and `DailyRunData` are in `store/types.ts`.
  `RECORDS_PER_BOARD` is 10.
- Use `hashSeed` and `createRng` (`rng.ts`) so everything is reproducible from seeds.
- The current `dailyShareLine` in `daily.ts` changes format. Update its existing tests in
  `daily.test.ts` to the new format, and keep every other existing daily test passing.

## Interface to implement

```ts
// packages/kit/src/run.ts
import type { MicroChallengeDef, MicroResult } from './micro.ts';
import type { RunResultData, RunsData } from './store/types.ts';
import type { IsoTime } from './types.ts';

export const RUN_ROUNDS = 5;

export interface RunCandidate {
  game: string;
  challenges: readonly MicroChallengeDef[];
}
export interface RunRound {
  game: string;
  challenge: MicroChallengeDef;
}
export interface RunPlan {
  seed: number;
  rounds: readonly RunRound[];
}

/** At least RUN_ROUNDS candidates with one or more challenges each. */
export function canPlanRun(candidates: readonly RunCandidate[]): boolean;
/** Five distinct games in a seeded order, each with one seeded challenge. Throws if `canPlanRun` is false. */
export function planRun(candidates: readonly RunCandidate[], seed: number): RunPlan;
/** The day's run is the same for everyone: hashSeed(`run/${dailyNumber(date)}`). */
export function dailyRunSeed(date: Date): number;

export type RunPhase = 'intro' | 'transition' | 'round' | 'results';

export interface RunState {
  readonly plan: RunPlan;
  readonly phase: RunPhase;
  /** 0-based index of the current or upcoming round. */
  readonly roundIndex: number;
  readonly results: readonly MicroResult[];
}

/** Phase 'intro', round 0. */
export function startRun(plan: RunPlan): RunState;
/** 'intro' or 'transition'-pending → 'transition' for roundIndex. */
export function beginTransition(state: RunState): RunState;
/** 'transition' → 'round'. */
export function beginRound(state: RunState): RunState;
/** 'round' → 'transition' for the next round, or 'results' after the fifth. */
export function finishRound(state: RunState, result: MicroResult): RunState;

/** 0 when failed; otherwise 100 + 10 points per whole second left on the clock. */
export function roundScore(result: MicroResult, challengeSeconds: number): number;
export function runScore(state: RunState): number;
export function runPasses(state: RunState): number;

export interface TransitionTiming {
  dimMs: number;
  collapseMs: number;
  snowMs: number;
  slideMs: number;
  flipMs: number;
  cardMs: number;
}
/**
 * The automatic power flip before round `roundIndex` (0–4). Round 0 runs at full length
 * (dim 400, collapse 350, snow 700, slide 450, flip 300, card 600 ms), and every later round
 * multiplies all six by 0.85^roundIndex, rounded, so round 5 is frantic.
 */
export function transitionTiming(roundIndex: number): TransitionTiming;

/** e.g. "Woodgrain '88 Run #12 · ✅✅❌✅✅ · 4/5"; `runNumber` omitted for a free run: "Woodgrain '88 Run · …". */
export function runShareLine(state: RunState, runNumber?: number): string;

/** The stored result of a finished run (phase 'results'); throws otherwise. */
export function runResult(state: RunState, at: IsoTime): RunResultData;
/**
 * Free runs: inserted by score, best first, capped at 10.
 * Daily: only the first finished run of a day is kept (under `dayKey`).
 */
export function recordRun(
  data: RunsData,
  result: RunResultData,
  mode: 'free' | 'daily',
  dayKey?: string,
): RunsData;
```

```ts
// Added to packages/kit/src/daily.ts
import type { ChannelDef } from './channels.ts';
import type { DailyRunData } from './store/types.ts';

/** The day's channel for a game: a seeded pick among all its channels, remix included. */
export function dailyChannel(
  game: { id: string; channels: readonly ChannelDef[] },
  date: Date,
): ChannelDef;

/**
 * Keeps only a game's first run of a day for the daily score. Returns the new map and whether this
 * run counted; later runs that day are practice.
 */
export function recordDailyRun(
  daily: Readonly<Record<string, Readonly<Record<string, DailyRunData>>>>,
  date: Date,
  gameId: string,
  run: DailyRunData,
): { daily: Record<string, Record<string, DailyRunData>>; counted: boolean };

// dailyShareLine's input becomes:
// { title: string; date: Date; channelNumber?: number; score?: string; emoji?: string; name?: string }
// and its output, with every part present, is exactly:
// "Woodgrain '88 #12 · Tank Duel ch.7 · 3–1 · 🟩🟩🟥🟩 · Robin"
// Missing parts and their " · " separators are left out ("Woodgrain '88 #12 · Tank Duel").
// `emoji` is used only when `emojiSummary(emoji)` from share.ts accepts it.
```

## Behaviour and edge cases

1. `planRun`:
   - picks exactly five distinct games, ignoring candidates with no challenges;
   - the same seed gives the same plan, and different seeds usually differ (test with 20 seeds:
     at least 15 distinct plans);
   - throws below five usable candidates.
2. Phase transitions:
   - each one throws from the wrong phase;
   - `finishRound` after round 5 goes to 'results';
   - `roundIndex` counts 0–4;
   - `results` length equals the rounds finished.
3. `roundScore`:
   - a failed challenge scores 0;
   - passed with 30.4 s left of a 45 s challenge (result.seconds 14.6) scores 100 + 300 = 400;
   - passed at the last moment scores 100.
4. `transitionTiming(0)` matches the numbers above. Every field strictly decreases from round 0 to
   round 4. Out-of-range indexes clamp to 0–4.
5. `runShareLine` uses ✅ for a pass and ❌ for a fail, in round order, with passes out of five. It
   leaves out the number for a free run.
6. `recordRun`:
   - free runs keep at most 10, best first, and a lower score than all ten is not kept;
   - daily keeps the first run of a day and ignores a second one;
   - never mutates its input.
7. `dailyChannel`:
   - deterministic per game and day;
   - differs across days for a game with several channels (over 30 days at least 3 distinct
     channels for a 6-channel game);
   - always returns the only channel of a one-channel game.
8. `recordDailyRun`:
   - the first run counts;
   - a second run the same UTC day does not count and does not replace the first;
   - the next day counts again.
9. `dailyShareLine` gives the exact strings in the interface notes for all-present, minimal and
   invalid-emoji inputs (an invalid emoji is left out).

## Tests required

One test per numbered behaviour. Use fixed dates and seeds only and never read the real clock.

## Out of scope

UI, transitions' rendering, storage wiring, any other file.
