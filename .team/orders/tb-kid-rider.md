---
id: tb-kid-rider
kind: ai
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/ai/kid.ts
  - games/trailblaze/src/ai/perception.ts
  - games/trailblaze/tests/ai/kid.test.ts
  - games/trailblaze/tests/ai/perception.test.ts
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/ai
  - pnpm exec eslint games/trailblaze/src/ai games/trailblaze/tests/ai
  - pnpm exec prettier --check games/trailblaze/src/ai games/trailblaze/tests/ai
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/match.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/engine/headings.ts
  - games/trailblaze/src/engine/space.ts
  - games/trailblaze/src/ai/computer-1977.ts
  - packages/kit/src/kids/reflex.ts
  - packages/kit/src/kids.ts
  - games/hot-and-cold/src/ai/kid.ts
  - games/trailblaze/tests/engine/helpers/drivers.ts
---

## Goal

Build the Neighbourhood Kids as Trailblaze riders. A Kid sees the board the way a player does and
plans with its own style, and its hands reach the stick only through the kit's human reflexes
(`kids/reflex.ts`). A Kid takes time to react, reads only so far ahead, misses the rival's turns,
panics when things get fast or cramped, and slips now and then. It must never play perfectly.

## Context

- The engine is in `games/trailblaze/src/engine/`. A seat steers by holding a `Stick` every 20 ms
  tick. The engine latches the stick and turns at the next step. Read `match.ts`.
- The kit gives `reflexProfile(kid, mode)` and `createKidReflex<A>(profile, rng)`. Read
  `kids/reflex.ts` whole. The Kid's brain decides a `Heading`. `KidReflex<Heading>` delays it and
  sometimes spoils it. The stick then shows what the hands are doing.
- `games/hot-and-cold/src/ai/kid.ts` is the house style for a Kid player: `hear(events, match)`
  every tick, then an input. Follow it.
- Clock: `now = match.tick * 20` milliseconds.
- Write code a careful person would write: small named functions, comments that explain why.
  Keep the perception mask and the flood buffers allocated once per Kid, not per decision.

## Interface to implement

```ts
// games/trailblaze/src/ai/perception.ts
/**
 * What a Kid can see of the board: cells within `radius` of its head (Chebyshev distance, across
 * edges in a wraparound arena) as they are; cells beyond it as empty, because a person only
 * registers far-off walls as "open over there".
 */
export interface Perception {
  /** True when the Kid believes the cell is blocked (trail or border). */
  blocked(cell: Cell): boolean;
}
export function perceive(match: Readonly<Match>, head: Cell, radius: number): Perception;
/** Free cells counted along a heading from `from`, as the Kid perceives them, up to `limit`. */
export function rayLength(
  match: Readonly<Match>,
  view: Perception,
  from: Cell,
  heading: Heading,
  limit: number,
): number;
/** Empty cells the Kid believes it could reach from `from`, by the engine's connectivity, up to `limit`. */
export function believedSpace(
  match: Readonly<Match>,
  view: Perception,
  from: Cell,
  limit: number,
): number;

// games/trailblaze/src/ai/kid.ts
import type { KidId, KidReflex, MemoryMode, ReflexProfile, Seed } from '@woodgrain-88/kit';
export interface KidRiderOptions {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly mode: MemoryMode;
  readonly seed: Seed;
  /** A profile other than the Kid's own, for simulations and tuning. */
  readonly profile?: ReflexProfile;
}
export interface KidRider {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly reflex: KidReflex<Heading>;
  /** Everything the match said this tick: the Kid takes in what a player would see. */
  hear(events: readonly MatchEvent[], match: Readonly<Match>): void;
  /** What the Kid holds on its stick this tick. */
  stick(match: Readonly<Match>): Stick;
}
export function createKidRider(options: KidRiderOptions): KidRider;
```

## Behaviour and edge cases

1. **When it thinks.** The Kid makes a fresh decision once after every `step` event for the match
   (and once after a `round` event), and once more when it notices a rival turn. It never decides
   during a crash pause or after `over`. A `round` event also calls `reflex.reset()`.
2. **Pressure** for every reflex call: `speed = (15 − match.stepPeriod) / 12`. `cramp = 1 −
min(1, believedSpace(head) / 60)`, measured with the Kid's current perception.
3. **Perception radius** is `reflex.awareness(pressure)`. **Reach** along a heading is
   `reflex.reach(pressure)`.
4. **Candidates**: the current heading and every heading at most 90° away from it (4-way: straight,
   left, right; 8-way: those plus the two 45° headings). Never the reverse. Under 4-way steering,
   only cardinal headings.
5. **Scoring** each candidate `h`, with the next cell `n = stepFrom(head, h)`:
   - If `n` is believed blocked, the score is −1000 (certain crash).
   - `run = rayLength(n, h, reach)`, normalised by the reach.
   - `space = believedSpace(n, 6 × awareness²)`, normalised by that limit.
   - `safety`: `1 −` the share of `n`'s 8 neighbours that are believed blocked.
   - `cutOff`: how much `h` brings the Kid closer to the point 3 cells ahead of the rival along the
     rival's believed heading, normalised to −1..1. Use 0 when riding alone.
   - `mirror`: 1 if `h` turns the same way (left or right, relative to the current heading) as the
     rival's last turn the Kid noticed, and that turn is no more than 2 steps old. Otherwise 0.
   - score = `style.space × space + style.safety × (safety + run) / 2 + style.cutOff × cutOff +
style.mirror × mirror + noise`, where noise is uniform ±0.05 from the Kid's seeded rng.
     Prefer a straight course on near ties: add 0.02 to the current heading.
6. **Acting.** When the best candidate differs from the action the Kid last decided, call
   `reflex.decide(best, now, pressure, others)`. `others` holds every other candidate, including
   the blocked ones, so a slip can be a real blunder. When the best equals the last decision, do
   nothing: the hands keep doing what they do.
7. **The stick** is `reflex.act(now)` as a `Stick` (`east`/`south` from `vectorOf`, fire false), or
   `IDLE` when nothing has been acted on yet this round. Holding the current heading is harmless,
   because the engine ignores a latch equal to the heading.
8. **The rival.** The Kid always sees where the rival's head is. It learns the rival's heading only
   by noticing its turns. On every `turn` event for the rival seat, call `reflex.notices(now,
pressure)`. If it is true, update the believed rival heading and remember the turn's direction
   and step for `mirror`. If it is false, the belief stays stale.
9. **Deterministic**: the same options and the same match give the same sticks every tick. Use one
   `createRng(options.seed)` for the Kid, forking `'reflex'` for the reflex.
10. **Cheap**: a decision must average under 0.3 ms on a mid-board position. Flood with a reusable
    queue and a stamp array, as `engine/space.ts` does.

## Tests required

`tests/ai/perception.test.ts`:

- cells inside the radius are seen as they are, cells outside are seen as empty;
- the radius wraps in a wraparound arena and not in a bordered one;
- `rayLength` and `believedSpace` respect the perception (a wall beyond the radius is invisible).

`tests/ai/kid.test.ts` (build boards white-box as the engine tests do):

- alone in variation 1, Lou (human) lays at least 300 cells before crashing, on 5 seeds;
- a dead-end corridor whose closed end lies beyond a narrow awareness lures Dee in but not Lou (same
  board, same start);
- the stick changes only after the reflex delay: the first non-idle stick after a decision comes
  no earlier than its logged `delayMs`;
- a profile with attention 0 logs every rival turn as 'missed', and with attention 1 as 'noticed';
- sharp mode: over a 3,000-tick Kid-against-Kid match, the log has no 'slipped-*' events;
- determinism: two Kids with the same seed give identical stick sequences over 2,000 ticks;
- with every candidate but one blocked, the Kid decides the open one;
- the Kid never decides the reverse of its heading;
- a timing test: 2,000 decisions on a half-filled board average under 0.3 ms (use
  `performance.now()` only in this test, with a generous bound).

Keep the suite under 5 s.

## Out of scope

Simulations and balance tuning (a later order), the Ghost Trails memory, rendering, the results
panel, and anything outside the fence.
