---
id: tb-computer-1977
kind: ai
fence:
  - games/trailblaze/src/ai/computer-1977.ts
  - games/trailblaze/tests/ai/**
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
  - games/trailblaze/tests/engine/helpers/drivers.ts
  - research/dossiers/08-trailblaze.md
  - src/08_Surround.asm
---

## Goal

Rebuild the 1977 cartridge's own computer opponent ("Computer 1977") as a step pilot for the
Trailblaze engine, quirks included, with tests that pin each quirk down. Players will pick it as
an opponent labelled as the original.

## Context

- The engine is done (`games/trailblaze/src/engine/`). A `StepPilot` is called at every step after
  the trails are written and before anyone moves. Its heading then goes through the same reversal
  filter as a stick would. Read `match.ts` to see exactly when.
- `research/dossiers/08-trailblaze.md` §6 and hook 1 describe the computer. **Verify the exact
  comparisons in the asm** (the four ray scans and their compare-and-store branches, dossier
  §6 and hook 1). Where the dossier and the asm disagree, follow the asm and say so in your
  report. Describe what you find in plain words only. Never put a disassembly label, an address or
  a copied table in the code or the comments.
- Style: look at `games/trailblaze/src/engine/match.ts`. Write a module comment that tells how the
  computer thinks. Use small named functions.

## Interface to implement

```ts
// games/trailblaze/src/ai/computer-1977.ts
import type { SwitchPosition } from '@woodgrain-88/kit';
import type { Heading, Match, Seat, StepPilot } from '../engine/types.ts';

/** How far the computer reads along a ray: 3 cells on switch B, 6 on switch A. */
export type Lookahead = 3 | 6;
export function lookaheadFor(position: SwitchPosition): Lookahead;

export type CardinalHeading = 'up' | 'down' | 'left' | 'right';

export interface ComputerDecision {
  /** Free cells counted along each ray from the rider's cell, in scan order. */
  readonly rays: Readonly<Record<CardinalHeading, number>>;
  /** The best distance as the computer held it after the scan (it can exceed the lookahead). */
  readonly best: number;
  readonly heading: CardinalHeading;
  /** True on the 64-tick half where a tie goes to the later ray in the scan order. */
  readonly tiesGoLate: boolean;
}

/** One decision, exposed for tests, the Kid comparisons and the results panel. */
export function computerDecision(
  match: Readonly<Match>,
  seat: Seat,
  lookahead: Lookahead,
): ComputerDecision;

/** The computer as a pilot for any seat. */
export function createComputer1977(lookahead: Lookahead): StepPilot;
```

## Behaviour and edge cases

1. Rays are counted from the rider's current cell outward, one per cardinal direction, in the
   scan order up, down, left, right. A ray counts consecutive `EMPTY` cells and stops at the first
   non-empty cell. The rider's own cell is not counted.
2. The order of comparisons, the initial best (up, capped at the lookahead), and the default
   heading up follow the cartridge exactly. That includes hook 1: when the best so far is below
   the lookahead, a later ray's raw distance is stored uncapped. For example, up 1 and down 15
   leave a best of 15, so left or right must reach 15 to beat down.
3. Tie-break: when rays are clear to the lookahead, ties go to the earlier ray on one half of
   every 128 ticks and to the later ray on the other half. Use bit 6 of `match.tick` as the
   cartridge uses its free-running frame counter. Verify which value of the bit favours which, and
   whether "clear" compares with `>=` or `>`, in the asm.
4. Our arenas are wider than the cartridge's use. The computer may be chosen in any scored
   variation:
   - wraparound: rays continue across an edge and stop after at most one full lap of the row or
     column;
   - 8-way steering: it still steers only along the four cardinal headings;
   - gaps: it never holds fire.
5. Deterministic: no randomness and no wall clock.

## Tests required

In `games/trailblaze/tests/ai/computer-1977.test.ts`. Build boards by writing `match.cells`
directly, white-box, after `startMatch`. The engine helpers in `tests/engine/helpers/` may be
imported.

- `lookaheadFor`: B gives 3 and A gives 6.
- Ray counting on a hand-built board, all four directions, including a ray stopped by the border
  and a wraparound ray.
- With every ray blocked at 0, the heading is up (the default).
- Hook 1: the uncapped store, with the dossier's up 1 / down 15 example plus one more case of
  your own, at both lookaheads.
- Tie-break: on an open board, the same position gives the earlier ray at ticks in one half of
  the 128-tick cycle and the later ray in the other half.
- Stair-step: as seat 0's pilot alone (`players: 1`) in variation 2, starting in open space, the
  path over 60 steps alternates runs of up and right (or the directions the asm implies). Assert
  that both directions appear in runs, not single steps.
- Dead end: a corridor deeper than the lookahead lures it in. It turns into a closed corridor
  of length lookahead + 2 and crashes there.
- As a pilot in variation 2 against an idle seat 1, it never steers into a cell it could see was
  blocked while another ray was longer (a seeded 200-step check).

Keep the suite under 3 s.

## Out of scope

Kid bots, simulations, balance numbers, the engine itself (do not change it), rendering, and
anything outside the fence.
