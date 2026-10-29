---
id: tb-sims
kind: tests
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/sim/**
  - games/trailblaze/scripts/simulate.ts
  - games/trailblaze/tests/sim/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/sim
  - pnpm exec eslint games/trailblaze/src/sim games/trailblaze/scripts games/trailblaze/tests/sim
  - pnpm exec prettier --check games/trailblaze/src/sim games/trailblaze/scripts games/trailblaze/tests/sim
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/match.ts
  - games/trailblaze/src/engine/variations.ts
  - games/trailblaze/src/ai/computer-1977.ts
  - games/trailblaze/src/ai/kid.ts
  - games/trailblaze/tests/engine/helpers/drivers.ts
  - games/tank-duel/src/sim/duel.ts
  - games/tank-duel/src/sim/sweep.ts
  - games/tank-duel/tests/balance.test.ts
  - games/tank-duel/scripts/simulate.ts
---

## Goal

Headless simulations for Trailblaze: play whole matches between Kids, Computer 1977 and scripted
bots, measure win rates against the balance targets, and fuzz the engine. The lead uses them to tune
the Kids. The targets are locked as tests that run only on request.

## Context

- Engine: `createMatch`, `startMatch`, `stepMatch` (20 ms ticks, sticks per seat). A pilot seat
  (`setup.pilots`) is steered by the engine at each step and ignores its stick.
- Kids: `createKidRider({ kid, seat, mode, seed, profile? })` gives `hear(events, match)` and
  `stick(match)`. Call `hear` with every tick's events before asking for `stick` on the next tick.
- Computer 1977: `createComputer1977(lookahead)` is a `StepPilot`.
- Follow Tank Duel's sim layout and its opt-in balance test (read the files listed). The balance
  tests take minutes, so they run only when `TRAILBLAZE_BALANCE=1` is set, and the big fuzz only
  when `TRAILBLAZE_FUZZ=1` is set. A small smoke test always runs.
- Deterministic: every match is seeded, with no wall clock in results.

## Interface to implement

```ts
// games/trailblaze/src/sim/duel.ts
export type Contender =
  | {
      readonly kind: 'kid';
      readonly kid: KidId;
      readonly mode?: MemoryMode;
      readonly profile?: ReflexProfile;
    }
  | { readonly kind: 'computer'; readonly lookahead: Lookahead }
  | { readonly kind: 'idle' };
export interface DuelOptions {
  readonly variation: number;
  readonly seats: readonly [Contender, Contender];
  readonly target?: number; // default CARTRIDGE_TARGET
  readonly seed: Seed;
  /** Stop a match that runs this long (a safety net); counted as unfinished. */
  readonly maxTicks?: number; // default 50 * 60 * 30
}
export interface DuelResult {
  readonly winner: Seat | null; // null for a tie or an unfinished match
  readonly scores: readonly [number, number];
  readonly rounds: number;
  readonly ticks: number;
  readonly finished: boolean;
  /** Steps survived in each round, both riders together (the longest point played). */
  readonly longestRoundSteps: number;
}
export function playDuel(options: DuelOptions): DuelResult;

// games/trailblaze/src/sim/sweep.ts
export interface PairingResult {
  readonly matches: number;
  /** Share of matches the first contender won, with the seats swapped every other match. */
  readonly winRate: number;
  readonly ties: number;
  readonly unfinished: number;
}
export function pairing(
  first: Contender,
  second: Contender,
  variation: number,
  matches: number,
  seedBase: number,
): PairingResult;

// games/trailblaze/src/sim/targets.ts — the balance targets as data
export interface BalanceTarget {
  readonly name: string;
  readonly first: Contender;
  readonly second: Contender;
  readonly variation: number;
  /** The first contender's win rate must fall in [low, high]. */
  readonly low: number;
  readonly high: number;
}
export const BALANCE_TARGETS: readonly BalanceTarget[];
```

## Behaviour and edge cases

1. `playDuel` creates the match. For seats with a computer it sets `pilots`. It creates the Kids
   with seeds forked from the match seed (`seed + '/kid0'`, `'/kid1'`). It runs ticks until `over`
   or `maxTicks`. The stick for a computer or idle seat is `IDLE`.
2. `pairing` alternates seats: even matches put `first` on seat 0, odd matches on seat 1. The
   win rate counts `first`'s wins over all matches; ties count half.
3. `BALANCE_TARGETS`, from the game's brief, with Kids in human mode:
   - "Lou beats Pip": variation 1, Lou against Pip, 0.75–0.9;
   - "Moss beats Dee": variation 1, Moss against Dee, 0.55–0.7;
   - "Moss beats Computer 1977 (B)": variation 2, Moss against the computer with lookahead 3,
     0.6–0.8. In variation 2 the computer belongs on seat 0, so for this target only, keep the
     computer on seat 0 and Moss on seat 1 in every match.
     The two speed-up targets are relative, so they live in the balance test:
   - Dee's win rate against Moss in variation 3 is at least 0.08 above her rate in variation 1;
   - Lou's win rate against Pip in variation 3 is below his rate in variation 1.
4. `scripts/simulate.ts` (run with `pnpm exec tsx games/trailblaze/scripts/simulate.ts [matches]`)
   prints every target with its measured rate and whether it passes. It also prints a 6 × 6 Kid
   matrix of win rates in variation 1 (each cell `matches / 2`, default 40), and the average
   rounds and ticks per match. It prints plain text and writes no files.

## Tests required

- `tests/sim/smoke.test.ts` (always runs, under 10 s): two Kid matches to 2 points finish with a
  winner or a tie and correct score sums; a Kid-against-idle match ends with the Kid winning; a
  computer-against-idle match in variation 2 runs and finishes; the same seed gives the same result.
- `tests/sim/balance.test.ts` (only with `TRAILBLAZE_BALANCE=1`): every `BALANCE_TARGETS` entry at
  160 matches, and the two speed-up comparisons at 160 matches each side. Use seeds from 31,000
  upward, not the ones the lead tunes on. Give each test a long timeout.
- `tests/sim/fuzz.test.ts` (only with `TRAILBLAZE_FUZZ=1`): 100,000 random stick streams of 1,500
  ticks each over variations 1–12, checking that no running rider stands on a non-empty cell
  without crashing that tick, and that scores always equal the points awarded. Check cells only on
  ticks with a step event, and assert once per stream.

## Out of scope

Tuning the Kids' values (the lead does it with these tools), the engine, the AI modules, and
anything outside the fence.
