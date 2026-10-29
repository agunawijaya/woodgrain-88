---
id: tb-ghost-kid
kind: ai
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/ai/kid.ts
  - games/trailblaze/src/ai/ghost-memory.ts
  - games/trailblaze/tests/ai/ghost-memory.test.ts
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/ai
  - pnpm exec eslint games/trailblaze/src/ai games/trailblaze/tests/ai
  - pnpm exec prettier --check games/trailblaze/src/ai games/trailblaze/tests/ai
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/ai/kid.ts
  - games/trailblaze/src/ai/perception.ts
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/channels.ts
  - games/trailblaze/tests/ai/kid.test.ts
  - games/trailblaze/tests/ai/fixtures/duel-decisions.json
  - packages/kit/src/kids/memory.ts
  - packages/kit/src/kids/reflex.ts
  - docs/adr/0011-kid-memory.md
---

## Goal

Ghost Trails (a Remix, `rules.remix.ghostAfter`, in ticks) hides trail from sight a few seconds
after it is laid. The trail stays solid in the rules. Today a Kid's perception reads
`match.cells` and so "sees" invisible trail. A person would have to remember where the walls are.
Make the Kids do the same with the kit's `kids/memory` (ADR-0011), and leave every other channel
exactly as it is: the duel fixture test in `tests/ai/kid.test.ts` must keep passing untouched.

## What to build

`src/ai/ghost-memory.ts`:

```ts
/** A straight run of trail as a person remembers it: where it starts, which way, how long. */
export interface WallRun {
  readonly from: Cell;
  readonly heading: Heading;
  readonly length: number;
}
export interface GhostMemory {
  /** Every step's laid cells, so runs are formed as the riders lay them. */
  hear(laid: readonly Laid[], match: Readonly<Match>, nowSeconds: number, rng: Rng): void;
  /** Marks remembered runs' cells in `mask` (1 = believed blocked), as recalled now. */
  recallInto(mask: Uint8Array, match: Readonly<Match>, nowSeconds: number, rng: Rng): void;
  reset(): void;
}
export function createGhostMemory(profile: MemoryProfile, seat: Seat): GhostMemory;
```

- A **run** grows while a rider keeps laying cells in one heading. When it turns (or the round
  ends), the finished run becomes a fact: `observe` for the Kid's own runs, `witness` (with the
  Kid's attention) for others'. Use `salienceOf`; a run longer than 8 cells is striking.
- `FactAdapter<WallRun>`: key `${from}:${heading}`. `distort` shifts the run one cell sideways (at
  random to either side) or makes it one cell shorter or longer.
- `recallInto` calls `recall` and marks every cell of each recalled run that lies on the board.

`src/ai/kid.ts`:

- Only when `match.setup.rules.remix?.ghostAfter` is set:
  - create a `GhostMemory` from `memoryProfile(kid, options.mode)`;
  - feed it from `hear`;
  - after `perceive`, clear the mask for trail cells older than `ghostAfter` ticks, since those
    are out of sight;
  - mark what the memory recalls.

  Visible trail (younger than `ghostAfter`) and the border are seen as before.

- Use a forked rng (`rng.fork('ghost')`) so the reflex's random stream is unchanged.
- Nothing changes on any other channel.

## Tests required (`tests/ai/ghost-memory.test.ts`)

- Runs form from laid cells and become facts when a rider turns; a straight run of 10 is one fact.
- `recallInto` marks a remembered run's cells; with a `sharp` profile everything comes back
  exactly; a `human` profile with a short half-life forgets an old run after enough time.
- In a Ghost Trails match, a Kid whose memory is empty treats an old invisible trail cell as open
  (its mask), and with that run remembered treats it as blocked.
- On channel 1 (no ghost rule), `createKidRider` behaves exactly as before (the existing fixture test
  covers it; do not edit it).

Keep the new tests under 3 s.

## Out of scope

Views, the engine, the session, the kit, and anything outside the fence.
