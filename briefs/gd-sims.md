# Brief: Gravity Duel simulation harness and balance sweeps

For: **engineer** (Sonnet subagent). From: the lead (prompt 05, stage 2).

## Goal

Headless Kid-versus-Kid simulations for Gravity Duel, so the lead can tune the Kid pilots
against the prompt's balance targets, and lock them as regression tests.

## Read first

- `games/gravity-duel/docs/NOTES.md` (verified behaviour and engine decisions).
- `games/gravity-duel/src/engine/types.ts`, `match.ts`, `physics.ts`, `variations.ts`.
- `games/gravity-duel/src/ai/pilot.ts` (the Kid pilot: `createKidPilot`, `hear`, `controls`),
  `forecast.ts`, `perception.ts`, `styles.ts`.
- `games/trailblaze/src/sim/duel.ts`, `sweep.ts`, `targets.ts` and
  `games/trailblaze/scripts/simulate.ts` for the shape to follow (do not import from Trailblaze).
- `AGENTS.md` for the code standards (humanized code, strict TypeScript, ESLint and Prettier
  clean).

## Write (and only these)

- `games/gravity-duel/src/sim/duel.ts`
- `games/gravity-duel/src/sim/perfect-docker.ts`
- `games/gravity-duel/src/sim/sweep.ts`
- `games/gravity-duel/src/sim/targets.ts`
- `games/gravity-duel/scripts/simulate.ts`
- `games/gravity-duel/tests/sim/*.test.ts`

Do not change the engine, the AI or anything outside these paths. If the pilot or the engine
looks wrong, say so in your report; the lead fixes them.

## What to build

### 1. `sim/duel.ts`: one headless match

```ts
export type Contender =
  | {
      readonly kind: 'kid';
      readonly kid: KidId;
      readonly mode?: MemoryMode;
      readonly reflex?: ReflexProfile;
      readonly aim?: AimProfile;
      readonly style?: PilotStyle;
    }
  | { readonly kind: 'perfect-docker' }
  | { readonly kind: 'idle' };

export interface SimOptions {
  readonly variation: number;
  readonly seats: readonly [Contender, Contender];
  readonly seed: Seed;
  readonly target?: number; // default CARTRIDGE_TARGET (10)
  readonly clockTicks?: number; // default CARTRIDGE_MATCH_TICKS
  readonly switches?: readonly [SwitchPosition, SwitchPosition]; // default B/B
}

export interface SimResult {
  readonly winner: Seat | null;
  readonly scores: readonly [number, number];
  readonly ticks: number;
  readonly reason: 'target' | 'clock';
  /** Per seat: how often each thing happened to that seat's ship. */
  readonly starCrashes: readonly [number, number];
  readonly hits: readonly [number, number]; // missiles that scored, by shooter
  readonly selfHits: readonly [number, number];
  readonly cloakBurnouts: readonly [number, number];
  readonly shotsFired: readonly [number, number];
  readonly docks: readonly [number, number];
}

export function simulate(options: SimOptions): SimResult;
```

- Build the setup from `variation(n)`, the seed (`hashSeed` of the given seed, as the kit does),
  target, clock and switches.
- Each tick:
  1. every Kid pilot `hear`s the previous tick's `match.events`;
  2. the controls are gathered (`pilot.controls(match)`, the perfect docker's, or `IDLE`);
  3. call `stepMatch`;
  4. count the events.
- Stop when the phase is 'over'.
- Kid seeds: `${seed}-${seat}` so the two seats differ.

### 2. `sim/perfect-docker.ts`: a scripted, flawless docker

It proves the docking rule, not a player. It reads the exact match state. Each tick:

- It wants a velocity equal to its pod's plus a closing speed toward the pod: the smaller of
  4 speed units and 0.25 × the distance in steps.
- It turns toward the difference between that and its own velocity (nearest of the 16
  headings), and thrusts only while lined up exactly and the difference exceeds 0.3 units.
- Interface: `createPerfectDocker(seat: Seat): { controls(match: Readonly<Match>): Controls }`.

Required: in solo variation 14 it docks every pod and reaches 10 docks before the cartridge
clock runs out, for seeds 1–20, on switch B. On switch A it should also dock repeatedly. Report
how many it manages; if it cannot, report why rather than loosening anything.

### 3. `sim/sweep.ts`: many matches

- `sweep(first: Contender, second: Contender, variation, matches, seedBase, extra?)` plays
  `matches` matches, swapping seats every other match so neither side favours a Kid.
- It returns the first contender's win rate, draws, and the per-Kid totals (star crashes, hits,
  shots, self-hits, burnouts, docks), each per match. All are attributed to the contender, not
  the seat.

### 4. `sim/targets.ts`: the prompt's balance targets as data

Each target has a name, the two contenders, a variation and a band; tolerance 0.05 as in
Trailblaze:

| Target                   | Variation | Measure                                       | Band         |
| ------------------------ | --------- | --------------------------------------------- | ------------ |
| Lou beats Pip            | 1         | Lou's win rate, first to 10                   | 0.75–0.90    |
| Moss beats Dee           | 1         | Moss's win rate                               | 0.55–0.70    |
| Dee swallowed more       | 4         | Dee's star crashes per match ÷ Moss's         | at least 2.0 |
| Lou docks more than Pip  | 8         | Lou's docks per match ÷ Pip's                 | at least 1.5 |
| Perfect docker docks all | 14        | reaches 10 docks before the clock, every seed | always       |

### 5. `scripts/simulate.ts`: the lead's tuning tool

- A `tsx` script that runs every target with N matches (default 160; `--matches`, `--seed`,
  `--only <name>` flags) and prints a Markdown table: target, measured value, band, pass/fail,
  plus the per-Kid totals.
- Make it as fast as reasonably possible. Report the time per 100 matches of variation 1 so the
  lead can size the locked tests.

### 6. Tests (`tests/sim/`)

- **Determinism:** the same options give an identical `SimResult`.
- **Seat swapping** in `sweep` works.
- **Docking:** the perfect docker reaches 10 docks in solo 14 for seeds 1–20.
- **Balance targets**, locked with tolerances. Keep the number of matches small enough that the
  whole file runs in under about 60 seconds. If that is too few to be meaningful, say so in your
  report with the timings; the lead decides. Mark the balance tests clearly so the lead can retune
  them after changing the pilots.

## Standards

- Seeded RNG only, no wall clock in tests.
- Small functions with clear names; comments explain why.
- Run `pnpm exec vitest run --root games/gravity-duel tests/sim`, `pnpm exec eslint` and
  `pnpm exec prettier --check` on your files, and
  `pnpm exec tsc -p games/gravity-duel/tsconfig.json`, until they pass.
- No git. Report: files written, test results, timings, the balance table from one 160-match
  run, and anything in the pilot or engine that looked wrong.
