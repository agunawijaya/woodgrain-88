---
id: tank-arenas
kind: data
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/arenas/format.ts
  - games/tank-duel/src/arenas/validate.ts
  - games/tank-duel/src/arenas/layouts.ts
  - games/tank-duel/src/arenas/skies.ts
  - games/tank-duel/tests/arenas.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/arenas.test.ts
  - pnpm exec eslint games/tank-duel/src/arenas games/tank-duel/tests/arenas.test.ts
  - pnpm exec prettier --check games/tank-duel/src/arenas games/tank-duel/tests/arenas.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/vec.ts
  - tsconfig.base.json
---

## Goal

Tank Duel's battlefields as data: a readable text format for tank arenas (one character per floor
cell), a compiler that turns a map into wall rectangles, bumpers and spawns in world units, a
validator that proves an arena is fair and playable, and the four arena layouts and two skies below,
copied exactly as given (they are the lead's designs). No DOM, no three.js.

## Context

- World units, x right and y down (`vec.ts`; use its `Vec2`, do not redefine it). An arena is 32 × 20
  cells of 2 units: 64 × 40 units. Cell (col, row) covers x in [2·col, 2·col + 2), y in
  [2·row, 2·row + 2).
- Map characters: `#` concrete wall, `S` sandbags, `R` ruined brick wall, `B` bumper (always a 2×2
  group), `.` open floor, `1` and `2` the two spawns (each a 2×2 group of floor). Every wall stops
  tanks and shells; in bouncing channels shells bounce off all of them. Bumpers are 45° diamonds.
- A tank is a circle of radius 1.4 units, so it needs a 2-cell (4-unit) wide gap to pass. Spawn 1 is
  on the left, spawn 2 on the right; arenas are mirror-symmetric left to right so both seats are equal.
- Headings are steps 0–15 (`vec.ts`: 0 faces +x, 4 faces +y). The mirror image of heading h across a
  vertical line is `(8 - h) mod 16`.
- Aircraft channels have no walls: the sky is 64 × 40 units and wraps at its edges; clouds are
  ellipses aircraft hide in. Skies are point-symmetric about the centre (32, 20).

## Interface to implement

```ts
// games/tank-duel/src/arenas/format.ts
import type { Vec2 } from '../engine/vec.ts';

export const ARENA_COLS = 32;
export const ARENA_ROWS = 20;
export const CELL_SIZE = 2;
export const ARENA_WIDTH = ARENA_COLS * CELL_SIZE; // 64
export const ARENA_HEIGHT = ARENA_ROWS * CELL_SIZE; // 40
export const TANK_RADIUS = 1.4;

export type WallMaterial = 'concrete' | 'sandbag' | 'ruin';
export type ArenaPurpose = 'open' | 'light-cover' | 'dense-cover' | 'bumpers';

export interface ArenaDef {
  readonly id: string;
  readonly name: string;
  readonly purpose: ArenaPurpose;
  /** 20 strings of 32 characters, row 0 at the top. */
  readonly map: readonly string[];
  /** Spawn 1's starting heading; spawn 2 starts on its mirror image. */
  readonly spawnHeading: number;
}

/** A wall rectangle in world units; adjacent cells of one material are merged. */
export interface ArenaBlock {
  readonly material: WallMaterial;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A 45° diamond: its corners are `radius` from the centre along each axis. */
export interface ArenaBumper {
  readonly center: Vec2;
  readonly radius: number;
}

export interface ArenaSpawn {
  readonly position: Vec2;
  readonly heading: number;
}

export interface Arena {
  readonly id: string;
  readonly name: string;
  readonly purpose: ArenaPurpose;
  readonly width: number;
  readonly height: number;
  readonly blocks: readonly ArenaBlock[];
  readonly bumpers: readonly ArenaBumper[];
  readonly spawns: readonly [ArenaSpawn, ArenaSpawn];
  /** Whether a cell stops tanks (walls and bumpers); cells outside the map count as solid. */
  readonly isSolid: (col: number, row: number) => boolean;
}

/** Compiles a valid definition; throws an Error listing the problems when `validateArena` finds any. */
export function compileArena(def: ArenaDef): Arena;
/** Every wall as a convex polygon in world units (blocks as rectangles, bumpers as diamonds). */
export function wallPolygons(arena: Arena): Vec2[][];

export interface CloudBank {
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

export interface SkyDef {
  readonly id: string;
  readonly name: string;
  readonly clouds: readonly CloudBank[];
  /** Where the first plane of each side starts; side 2 is the point mirror of side 1. */
  readonly spawns: readonly [ArenaSpawn, ArenaSpawn];
}
```

```ts
// games/tank-duel/src/arenas/validate.ts
import type { ArenaDef, SkyDef } from './format.ts';

export type ArenaProblemCode =
  | 'size'
  | 'symbol'
  | 'border'
  | 'symmetry'
  | 'spawn'
  | 'bumper'
  | 'pocket'
  | 'line-of-sight'
  | 'aim';

export interface ArenaProblem {
  readonly code: ArenaProblemCode;
  readonly message: string;
}

/** Every reason this arena is not fair or playable; empty when it is fine. */
export function validateArena(def: ArenaDef): ArenaProblem[];

export type SkyProblemCode = 'bounds' | 'symmetry' | 'cover' | 'spawn';
export interface SkyProblem {
  readonly code: SkyProblemCode;
  readonly message: string;
}
export function validateSky(def: SkyDef): SkyProblem[];
```

```ts
// games/tank-duel/src/arenas/layouts.ts
export const OPEN_FIELD: ArenaDef;
export const SANDBAG_LINE: ArenaDef;
export const OLD_QUARTER: ArenaDef;
export const BUMPER_YARD: ArenaDef;
/** Every arena by id, in the order above. */
export const ARENAS: readonly ArenaDef[];

// games/tank-duel/src/arenas/skies.ts
export const CLOUD_BANKS: SkyDef;
export const CLEAR_SKY: SkyDef;
export const SKIES: readonly SkyDef[];
```

## Behaviour and edge cases

1. **Compile.** Blocks: greedy rectangle merging per material: scan rows top to bottom, left to
   right; from the first unclaimed wall cell, extend right while the material matches and the cell is
   unclaimed, then extend down while the whole run below matches and is unclaimed; claim it and emit
   one block in world units. Bumpers: each 2×2 `B` group becomes one diamond with its centre at the
   group's centre and radius 2 (corners at the middles of the group's sides). Spawns: the centre of
   each 2×2 spawn group (spawn 1 from `1`, spawn 2 from `2`); spawn 1's heading is `spawnHeading`,
   spawn 2's is its mirror `(8 - h) mod 16`. `isSolid` is true for `#`, `S`, `R`, `B` cells and
   outside the map.
2. **wallPolygons** lists rectangles as four corners in order (top-left, top-right, bottom-right,
   bottom-left) and diamonds as four corners (top, right, bottom, left). Blocks first, then bumpers.
3. **validateArena** reports every problem it finds (do not stop at the first), each with a message
   naming the cell or spawn:
   - `size`: not exactly 20 rows, or a row not exactly 32 characters (stop further checks if so).
   - `symbol`: any character outside `#SRB.12`.
   - `border`: a cell of row 0, row 19, column 0 or column 31 that is not `#`.
   - `symmetry`: a cell whose mirror (column `31 - col`, same row) differs, with `1` and `2`
     counting as mirrors of each other.
   - `spawn`: `1` or `2` not forming exactly one 2×2 group (four cells in a square).
   - `bumper`: a `B` that is not part of a whole 2×2 group (groups are claimed from their top-left
     cell, scanning rows then columns; groups may not overlap).
   - `pocket`: a tank footprint is a 2×2 square of non-solid cells, named by its top-left cell. From
     spawn 1's footprint, flood fill to footprints one cell up, down, left or right. Every footprint
     must be reached, and spawn 2's footprint too. Report the unreached ones (up to five in the
     message).
   - `line-of-sight`: unless the purpose is `open`, the straight segment between the two spawn
     centres must pass through at least one solid cell (sample it every 0.25 units).
   - `aim`: from each spawn, the straight ray along its heading, until it enters a solid cell (sample
     every 0.25 units), must never come within 3 units of the other spawn's centre.
4. **validateSky:** `bounds` when a cloud's centre is outside [0, 64] × [0, 40] or a radius is not
   positive; `symmetry` when a cloud has no partner at (64 − x, 40 − y) with equal radii (within
   1e-9; a cloud at the exact centre is its own partner); `cover` when the clouds' total ellipse
   area (π·rx·ry each, overlaps not subtracted) is more than 25% of the sky; `spawn` when spawn 2 is
   not the point mirror of spawn 1 (position (64 − x, 40 − y), heading `(h + 8) mod 16`).
5. **compileArena** throws `Error('Arena <id> is invalid: <messages joined with "; ">')` when
   validation fails.

## The layouts (copy exactly)

```ts
export const OPEN_FIELD: ArenaDef = {
  id: 'open-field',
  name: 'Open Field',
  purpose: 'open',
  spawnHeading: 14,
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..11......................22..#',
    '#..11......................22..#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '################################',
  ],
};

export const SANDBAG_LINE: ArenaDef = {
  id: 'sandbag-line',
  name: 'Sandbag Line',
  purpose: 'light-cover',
  spawnHeading: 0,
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#.....SSSS............SSSS.....#',
    '#.....S..................S.....#',
    '#.....S........##........S.....#',
    '#..............##..............#',
    '#..........RR..##..RR..........#',
    '#..........RR......RR..........#',
    '#..11..........##..........22..#',
    '#..11..........##..........22..#',
    '#..........RR......RR..........#',
    '#..........RR..##..RR..........#',
    '#..............##..............#',
    '#.....S........##........S.....#',
    '#.....S..................S.....#',
    '#.....SSSS............SSSS.....#',
    '#..............................#',
    '#..............................#',
    '################################',
  ],
};

export const OLD_QUARTER: ArenaDef = {
  id: 'old-quarter',
  name: 'Old Quarter',
  purpose: 'dense-cover',
  spawnHeading: 0,
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..######...##....##...######..#',
    '#.......#...##....##...#.......#',
    '#.......#..............#.......#',
    '#..##...#....RRRRRR....#...##..#',
    '#..##........R....R........##..#',
    '#............R....R............#',
    '#..11.....#..........#.....22..#',
    '#..11.....#..........#.....22..#',
    '#............R....R............#',
    '#..##........R....R........##..#',
    '#..##...#....RRRRRR....#...##..#',
    '#.......#..............#.......#',
    '#.......#...##....##...#.......#',
    '#..######...##....##...######..#',
    '#..............................#',
    '#..............................#',
    '################################',
  ],
};

export const BUMPER_YARD: ArenaDef = {
  id: 'bumper-yard',
  name: 'Bumper Yard',
  purpose: 'bumpers',
  spawnHeading: 0,
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#......BB..............BB......#',
    '#......BB..............BB......#',
    '#..............................#',
    '#..............................#',
    '#...........BB....BB...........#',
    '#...........BB....BB...........#',
    '#..11..........BB..........22..#',
    '#..11..........BB..........22..#',
    '#...........BB....BB...........#',
    '#...........BB....BB...........#',
    '#..............................#',
    '#..............................#',
    '#......BB..............BB......#',
    '#......BB..............BB......#',
    '#..............................#',
    '#..............................#',
    '################################',
  ],
};
```

Skies (copy exactly; units are world units):

- `CLOUD_BANKS` (`id: 'cloud-banks'`, `name: 'Cloud Banks'`): clouds
  `{ x: 13, y: 9, radiusX: 7, radiusY: 3.2 }`, `{ x: 51, y: 31, radiusX: 7, radiusY: 3.2 }`,
  `{ x: 40, y: 11, radiusX: 5, radiusY: 2.4 }`, `{ x: 24, y: 29, radiusX: 5, radiusY: 2.4 }`,
  `{ x: 55, y: 4, radiusX: 4, radiusY: 2 }`, `{ x: 9, y: 36, radiusX: 4, radiusY: 2 }`;
  spawns `{ position: { x: 8, y: 20 }, heading: 0 }` and `{ position: { x: 56, y: 20 }, heading: 8 }`.
- `CLEAR_SKY` (`id: 'clear-sky'`, `name: 'Clear Sky'`): no clouds, the same spawns.

## Tests required (games/tank-duel/tests/arenas.test.ts)

- every layout and sky in `ARENAS` and `SKIES` validates with no problems and compiles;
- compile of `SANDBAG_LINE`: the border becomes exactly 4 concrete blocks; the spawn positions are
  (8, 20) and (56, 20) with headings 0 and 8; block count and total wall area match the map's cell
  counts (area = solid cells × 4);
- compile of `BUMPER_YARD`: 9 bumpers, the middle one centred at (32, 20) with radius 2;
- `OPEN_FIELD` spawn headings 14 and 10;
- `wallPolygons` gives 4-point polygons, blocks before bumpers;
- `isSolid` for a wall, a floor cell and outside the map;
- one failing fixture per problem code (build small edited copies of a valid map in the test):
  wrong size, a bad symbol, a hole in the border, a broken mirror, a 3-cell spawn, a lone `B`, a walled-off
  pocket, an open line between spawns on a `light-cover` arena, a spawn heading aimed at the other spawn
  on the open field;
- `compileArena` throws on an invalid map with the problem in the message;
- `validateSky`: out-of-bounds cloud, a missing mirror partner, too much cover, unmirrored spawns.

## Out of scope

Shell geometry (another order writes `games/tank-duel/src/engine/walls.ts` and `shell.ts`; do not
import them), rendering, decor, aircraft squadrons. Do not change the layouts; if one fails your
validator, re-read the rules and report it in your notes rather than editing the map.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why. No `any`, no non-null assertions, no
commented-out code. Prettier: single quotes, width 100, trailing commas. Import with `.ts` extensions
(`import type { Vec2 } from '../engine/vec.ts'`).
