---
id: kit-kid-reflex
kind: engine
fence:
  - packages/kit/src/kids/reflex.ts
  - packages/kit/tests/kids-reflex.test.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/kids-reflex.test.ts
  - pnpm exec eslint packages/kit/src/kids/reflex.ts packages/kit/tests/kids-reflex.test.ts
  - pnpm exec prettier --check packages/kit/src/kids/reflex.ts packages/kit/tests/kids-reflex.test.ts
  - pnpm exec tsc -p packages/kit/tsconfig.json
reads:
  - packages/kit/src/kids/memory.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/rng.ts
  - packages/kit/tests/kids-memory.test.ts
---

## Goal

Add human-like reflexes for the Neighbourhood Kids to the kit, as `packages/kit/src/kids/reflex.ts`
with its unit tests. It is the real-time counterpart of `kids/memory.ts`. A Kid in a real-time game
(Trailblaze first, then Tank Duel, Bumper Chase, Disc Duel and the sports games) decides like a
person: it takes time to react, reads only so far ahead, misses things, panics under pressure and
slips now and then. It must never play perfectly.

## Context

- Read `kids/memory.ts` first. Match its shape and voice: a module comment that explains the model,
  a profile per Kid in a table, a `sharp` mode, a seeded and deterministic core, and a log a results
  screen can show.
- Games decide what to do. This module only turns the decisions into delayed, sometimes wrong
  actions, and answers what the Kid perceives right now. The action type is the game's own (`A`):
  a heading in Trailblaze, a stick vector elsewhere.
- Time is in milliseconds on the game's own clock (`now`), never the wall clock.
- The lead owns the public API below. Implement it exactly. If something looks wrong, say so in your
  report instead of changing it. The lead adds the export line to `packages/kit/src/index.ts`; do not
  touch that file.

## Interface to implement

```ts
import type { KidId } from '../kids.ts';
import type { MemoryMode } from './memory.ts';
import type { Rng } from '../rng.ts';

/** What a Kid weighs when it plans; each game reads the weights it has a use for. */
export interface PlanningStyle {
  /** Claiming open space for itself. */
  readonly space: number;
  /** Cutting across the rival's path. */
  readonly cutOff: number;
  /** Keeping clear of walls and tight spots. */
  readonly safety: number;
  /** Copying the rival's last move a beat later. */
  readonly mirror: number;
}

export interface ReflexProfile {
  /** Milliseconds from noticing to acting: the mean, and the spread (one standard deviation). */
  readonly reactionMs: { readonly mean: number; readonly spread: number };
  /** How far ahead along its own course the Kid reads, in the game's steps (cells in Trailblaze). */
  readonly lookahead: number;
  /** How far around itself the Kid takes things into account, in the same steps. */
  readonly awareness: number;
  /** Chance, 0–1, of noticing a change the rival makes (a turn, a feint). */
  readonly attention: number;
  /** 0–1: how much pressure (speed, a cramped spot) slows and rattles the Kid. */
  readonly panic: number;
  /** Chance, 0–1, per decision of a slip: a turn made late, or the wrong one. */
  readonly slipRate: number;
  readonly style: PlanningStyle;
}

/** How hard the moment is, each 0–1: how fast the game runs and how little room is left. */
export interface Pressure {
  readonly speed: number;
  readonly cramp: number;
}

export type ReflexEventKind =
  'decided' | 'acted' | 'slipped-late' | 'slipped-wrong' | 'noticed' | 'missed';

export interface ReflexEvent<A> {
  readonly kind: ReflexEventKind;
  /** Milliseconds on the game's clock. */
  readonly at: number;
  /** The action concerned: decided, performed, or (for a wrong slip) performed instead. */
  readonly action?: A;
  /** For 'slipped-wrong': what the Kid meant to do. */
  readonly intended?: A;
  /** For 'decided': how long until the hands act, in milliseconds. */
  readonly delayMs?: number;
}

export interface KidReflex<A> {
  readonly profile: ReflexProfile;
  /**
   * The Kid has made up its mind to do `action` at `now`. The action reaches its hands after a
   * reaction delay drawn from the profile and lengthened by panic. With the slip chance (raised by
   * panic) the decision goes wrong: either it comes late (the delay doubles) or the hands do one of
   * `alternatives` instead, picked at random (when there are none, a slip can only be late). A new
   * decision replaces one still on its way to the hands.
   */
  decide(action: A, now: number, pressure: Pressure, alternatives: readonly A[]): void;
  /** What the hands are doing at `now`: the latest action whose delay has passed, or null. */
  act(now: number): A | null;
  /** Whether the Kid notices a change the rival just made (attention, lowered by panic); logged. */
  notices(now: number, pressure: Pressure): boolean;
  /** How far ahead the Kid reads under this pressure: the lookahead, shortened by panic, at least 1. */
  reach(pressure: Pressure): number;
  /** How far around itself the Kid looks under this pressure: the awareness, narrowed by panic, at least 1. */
  awareness(pressure: Pressure): number;
  /** Forgets anything on its way to the hands (a new round); the log is kept. */
  reset(): void;
  readonly log: readonly ReflexEvent<A>[];
}

/** Each Kid's reflexes, set to their character (values below). */
export const KID_REFLEXES: Readonly<Record<KidId, ReflexProfile>>;
/** Sharp mode: no slips, reactions twice as quick; everything else as the Kid's own. */
export function reflexProfile(kid: KidId, mode: MemoryMode): ReflexProfile;
export function createKidReflex<A>(profile: ReflexProfile, rng: Rng): KidReflex<A>;
```

`KID_REFLEXES` starting values. The lead tunes them later by simulation, so keep them in one table:

| Kid   | reaction mean ± spread | lookahead | awareness | attention | panic | slipRate | style (space, cutOff, safety, mirror) |
| ----- | ---------------------- | --------- | --------- | --------- | ----- | -------- | ------------------------------------- |
| lou   | 330 ± 40               | 9         | 12        | 0.9       | 0.15  | 0.03     | 0.9, 0.3, 0.8, 0                      |
| moss  | 260 ± 40               | 6         | 12        | 0.8       | 0.2   | 0.04     | 1, 0.2, 0.9, 0                        |
| rosa  | 220 ± 50               | 5         | 7         | 0.85      | 0.45  | 0.07     | 0.4, 1, 0.4, 0                        |
| benny | 240 ± 50               | 5         | 7         | 0.8       | 0.45  | 0.07     | 0.5, 0.3, 0.5, 1                      |
| dee   | 180 ± 60               | 3         | 4         | 0.6       | 0.75  | 0.1      | 0.3, 0.4, 0.2, 0                      |
| pip   | 280 ± 120              | 3         | 4         | 0.5       | 0.7   | 0.14     | 0.4, 0.6, 0.3, 0                      |

## Behaviour and edge cases

1. Reaction delays are drawn from a normal distribution with the profile's mean and spread (a seeded
   Box–Muller on the given `rng`). They never go below 40% of the mean, and they are rounded to whole
   milliseconds.
2. Panic: let `level = panic × max(speed, cramp)`. The delay is multiplied by `1 + level`. The slip
   chance becomes `min(1, slipRate × (1 + 2 × level))`. Attention becomes `attention × (1 − 0.5 × level)`.
   Reach and awareness are multiplied by `1 − 0.5 × level`, rounded, and are at least 1.
3. A slip is late or wrong with equal odds. A late slip doubles the delay and logs 'slipped-late'. A
   wrong slip picks one of `alternatives` (uniformly with the rng) and logs 'slipped-wrong' with
   `intended`. With no alternatives, every slip is late.
4. `decide` logs 'decided' with `delayMs`. When the delay has passed, the first `act` call at or after
   that time logs 'acted' once, with the action the hands actually perform.
5. `act` keeps returning the last performed action until a newer decision's delay passes.
6. Same profile, same seed, same calls give the same results and the same log.
7. `reflexProfile(kid, 'human')` is the table entry. `'sharp'` returns a copy with `slipRate: 0` and
   the reaction mean and spread halved.
8. No wall clock, no `Math.random`, no DOM. Put a short module comment at the top in the style of
   `kids/memory.ts`.

## Tests required

In `packages/kit/tests/kids-reflex.test.ts`, deterministic, named by behaviour:

- reaction delays over 2,000 draws: mean within 5% of the profile's mean, standard deviation within
  15% of the spread, never below 40% of the mean;
- a decision is not acted on before its delay and is acted on at the first `act` at or after it;
- a newer decision replaces one still on its way;
- panic at full pressure lengthens delays, raises slips, lowers noticing, and shortens reach and
  awareness, each by the documented amount (check the formulas at zero, half and full pressure);
- slips over 5,000 decisions: the rate is within tolerance of the formula, split about evenly between
  late and wrong, and wrong slips come only from `alternatives`;
- with empty `alternatives`, a slip is always late;
- the log records 'decided', 'acted', 'slipped-*', 'noticed' and 'missed' with the right fields;
- determinism: the same seed and the same calls give identical logs, and a different seed gives a
  different log;
- `reflexProfile`: human equals the table entry; sharp has no slips and halved reaction mean and spread;
- every Kid in `KID_IDS` has a profile, and the table orders hold: Dee is the quickest by mean,
  Lou reads furthest ahead, Pip has the widest spread.

## Out of scope

Any game code, `packages/kit/src/index.ts`, other kit files, docs, and anything outside the fence.
