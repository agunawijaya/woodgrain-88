---
id: den-jacket-arrange
kind: engine
model: gemini-3.8-flash-high
fence:
  - hall/src/jacket/arrange.ts
  - hall/src/jacket/history.ts
  - hall/tests/jacket-arrange.test.ts
acceptance:
  - pnpm exec vitest run --project hall hall/tests/jacket-arrange.test.ts
  - pnpm exec eslint hall/src/jacket/arrange.ts hall/src/jacket/history.ts hall/tests/jacket-arrange.test.ts
  - pnpm exec prettier --check hall/src/jacket/arrange.ts hall/src/jacket/history.ts hall/tests/jacket-arrange.test.ts
reads:
  - packages/kit/src/store/types.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/index.ts
---

## Goal

The pure model behind the Jacket screen: where patches may sit, snapping a dropped patch to a
free spot, swapping when dropped on another patch, rotating in 15° steps, keyboard moves,
auto-arrange, drawer filters, and undo/redo. No DOM. The lead draws the jacket and wires the
pointer and keyboard handlers to these functions.

## Context

- Placements are stored as `PatchPlacement` (`packages/kit/src/store/types.ts`) in the jacket's
  own 600×700 drawing units: `{ game, patch, side: 'front' | 'back', x, y, rotation, z }`.
  `x`, `y` are the patch centre. `rotation` is degrees, a multiple of 15, normalised to
  `-165..180`. Higher `z` is drawn on top.
- A patch is identified by `game` + `patch`; use the key `${game}/${patch}`.
- The geometry below is fixed by the lead (the jacket art matches it). Export it as written.

```ts
export const JACKET_SIZE = { width: 600, height: 700 } as const;
/** A patch's footprint on the jacket, as a diameter. */
export const PATCH_UNITS = 92;
/** Distance between neighbouring snap spots; less than PATCH_UNITS so patches overlap a little, as sewn ones do. */
export const SPOT_SPACING = 76;

export interface JacketZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const JACKET_ZONES: Record<'front' | 'back', readonly JacketZone[]> = {
  front: [
    { id: 'left-chest', x: 110, y: 160, width: 175, height: 430 },
    { id: 'right-chest', x: 315, y: 160, width: 175, height: 430 },
    { id: 'left-sleeve', x: 14, y: 210, width: 84, height: 380 },
    { id: 'right-sleeve', x: 502, y: 210, width: 84, height: 380 },
  ],
  back: [
    { id: 'yoke', x: 120, y: 104, width: 360, height: 96 },
    { id: 'panel', x: 104, y: 214, width: 392, height: 386 },
    { id: 'left-sleeve', x: 14, y: 210, width: 84, height: 380 },
    { id: 'right-sleeve', x: 502, y: 210, width: 84, height: 380 },
  ],
};
```

## Interface to implement

```ts
// hall/src/jacket/arrange.ts
import type { PatchPlacement, PatchTier } from '@woodgrain-88/kit';

export type JacketSide = 'front' | 'back';
export interface Spot {
  side: JacketSide;
  zone: string;
  x: number;
  y: number;
}

/** A patch the player can sew: earned, from the drawer. */
export interface DrawerPatch {
  game: string;
  patch: string;
  tier: PatchTier;
  family: string;
  gold: boolean;
  /** Slot of the game, for a stable order. */
  slot: number;
}

export function patchKey(p: { game: string; patch: string }): string;
export function jacketSpots(side: JacketSide): Spot[];
/** Spots with no placement centre within SPOT_SPACING / 2 (ignoring `ignoreKey`). */
export function freeSpots(
  side: JacketSide,
  placements: readonly PatchPlacement[],
  ignoreKey?: string,
): Spot[];
/** The placement whose centre is within PATCH_UNITS / 2 of (x, y) on that side, topmost z first; null if none. */
export function patchAt(
  side: JacketSide,
  x: number,
  y: number,
  placements: readonly PatchPlacement[],
  ignoreKey?: string,
): PatchPlacement | null;

/**
 * Drop a patch (from the drawer, or already on the jacket) at (x, y).
 * - Dropped on another patch: they swap. If the dragged patch came from the drawer, the patch it
 *   landed on goes back to the drawer (removed) and the dragged one takes its place, rotation 0.
 *   If both are on the jacket, they exchange x, y, side and rotation.
 * - Otherwise it snaps to the nearest free spot on that side; if the side has no free spot the
 *   placements are returned unchanged and `reason` says "No room left on this side".
 * - The moved patch gets z = max z + 1.
 */
export function dropPatch(
  placements: readonly PatchPlacement[],
  patch: { game: string; patch: string },
  side: JacketSide,
  x: number,
  y: number,
): { placements: PatchPlacement[]; reason: string | null };

/** Rotate by `step` × 15 degrees, normalised to -165..180. */
export function rotatePatch(
  placements: readonly PatchPlacement[],
  key: string,
  step: 1 | -1,
): PatchPlacement[];
/** Keyboard move: to the nearest free spot in that direction on the same side (by spot grid); unchanged if none. */
export function nudgePatch(
  placements: readonly PatchPlacement[],
  key: string,
  direction: 'up' | 'down' | 'left' | 'right',
): PatchPlacement[];
export function removePatch(placements: readonly PatchPlacement[], key: string): PatchPlacement[];

/**
 * "Auto-arrange": every drawer patch placed, looking deliberate.
 * - Legend patches first, centred on the back panel (largest first by slot), then the rest of the
 *   back panel, the front chests, the yoke, then the sleeves.
 * - Within those, order by tier (legend, pro, club, secret), then slot.
 * - Rotation: 0 for most; a deterministic quarter of them get -15 or 15, chosen with the kit's
 *   `createRng(patchKey)` so the same jacket always arranges the same way.
 * - If there are more patches than spots, the extra ones stay in the drawer (not placed).
 * - z increases in placement order.
 */
export function autoArrange(drawer: readonly DrawerPatch[]): PatchPlacement[];

export interface DrawerFilter {
  game?: string;
  family?: string;
  tier?: PatchTier;
  gold?: boolean;
}
/** Drawer patches matching every set field, in slot then tier order (club, pro, legend, secret). */
export function filterDrawer(drawer: readonly DrawerPatch[], filter: DrawerFilter): DrawerPatch[];
/** Drawer patches not yet on the jacket. */
export function unsewn(
  drawer: readonly DrawerPatch[],
  placements: readonly PatchPlacement[],
): DrawerPatch[];
```

```ts
// hall/src/jacket/history.ts
export interface History<T> {
  readonly current: T;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Record a new state; clears redo. Keeps at most `limit` past states (default 50). */
  push(next: T): void;
  undo(): T;
  redo(): T;
}
export function createHistory<T>(initial: T, limit?: number): History<T>;
```

## Behaviour and edge cases

1. `jacketSpots(side)`: for each zone of that side in the order listed, columns =
   `max(1, floor(zone.width / SPOT_SPACING))`, rows = `max(1, floor(zone.height / SPOT_SPACING))`;
   the grid is centred in the zone (equal margins), spacing SPOT_SPACING, rows top to bottom,
   columns left to right. Coordinates rounded to whole units.
2. `dropPatch` never mutates its input; returns new arrays and objects. A patch never appears twice.
3. Dropping a patch exactly onto its own position keeps it there (no swap with itself).
4. Swapping across sides works (front patch dropped on a back patch while the back is shown).
5. `rotatePatch` on an unknown key returns the placements unchanged (copy).
6. `nudgePatch`: candidate spots are the free spots on the same side strictly in that direction
   (dy < 0 for up, etc.); choose by smallest distance along the axis, then smallest
   perpendicular offset. Unchanged if none.
7. `autoArrange([])` returns `[]`; spots are never shared; output is deterministic.
8. `createHistory`: `undo` at the start returns current unchanged; `redo` after a `push` is not
   possible; limit drops the oldest.

## Tests (hall/tests/jacket-arrange.test.ts)

Cover: spot grid counts per zone (left-chest 2×5, sleeves 1×5, yoke 4×1, panel 5×5), snapping to
the nearest free spot, "No room left on this side" when full, swap from drawer (displaced patch
removed), swap between two placed patches (positions and sides exchanged), z ordering, rotation
normalisation (165 + 15 → 180, 180 + 15 → -165), nudge in all four directions and at an edge,
remove, auto-arrange determinism and legend-first on the back panel, more patches than spots,
drawer filters and `unsewn`, history push/undo/redo/limit.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why. No `any`, no non-null assertions,
no commented-out code. Prettier: single quotes, width 140 (see `.prettierrc`).
