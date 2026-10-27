/**
 * Turns a text map into the walls, bumpers and spawns the game uses,
 * and exports wall geometry as convex polygons.
 */
import type { Vec2 } from '../engine/vec.ts';
import { validateArena } from './validate.ts';

export const ARENA_COLS = 32;
export const ARENA_ROWS = 20;
export const CELL_SIZE = 2;
export const ARENA_WIDTH = ARENA_COLS * CELL_SIZE;
export const ARENA_HEIGHT = ARENA_ROWS * CELL_SIZE;
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

function wallMaterial(char: string): WallMaterial | null {
  if (char === '#') return 'concrete';
  if (char === 'S') return 'sandbag';
  if (char === 'R') return 'ruin';
  return null;
}

function mergeWallBlocks(map: readonly string[]): ArenaBlock[] {
  const claimed: boolean[][] = Array.from({ length: ARENA_ROWS }, () =>
    Array.from({ length: ARENA_COLS }, () => false),
  );
  const blocks: ArenaBlock[] = [];

  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = map[row];
    if (rowText === undefined) continue;

    for (let col = 0; col < ARENA_COLS; col++) {
      const char = rowText[col];
      if (char === undefined) continue;

      const material = wallMaterial(char);
      const claimedRow = claimed[row];
      if (material === null || claimedRow?.[col] === true) {
        continue;
      }

      let widthCells = 0;
      while (col + widthCells < ARENA_COLS) {
        const nextChar = rowText[col + widthCells];
        if (claimedRow?.[col + widthCells] === true || nextChar === undefined) break;
        if (wallMaterial(nextChar) !== material) break;
        widthCells++;
      }

      let heightCells = 1;
      while (row + heightCells < ARENA_ROWS) {
        const nextRowText = map[row + heightCells];
        const nextClaimedRow = claimed[row + heightCells];
        if (nextRowText === undefined || nextClaimedRow === undefined) break;

        let canExtend = true;
        for (let colOffset = 0; colOffset < widthCells; colOffset++) {
          const checkCol = col + colOffset;
          const checkChar = nextRowText[checkCol];
          if (nextClaimedRow[checkCol] === true || checkChar === undefined) {
            canExtend = false;
            break;
          }
          if (wallMaterial(checkChar) !== material) {
            canExtend = false;
            break;
          }
        }
        if (!canExtend) break;
        heightCells++;
      }

      for (let rowOffset = 0; rowOffset < heightCells; rowOffset++) {
        const markRow = claimed[row + rowOffset];
        if (markRow === undefined) continue;
        for (let colOffset = 0; colOffset < widthCells; colOffset++) {
          markRow[col + colOffset] = true;
        }
      }

      blocks.push({
        material,
        x: col * CELL_SIZE,
        y: row * CELL_SIZE,
        width: widthCells * CELL_SIZE,
        height: heightCells * CELL_SIZE,
      });
    }
  }

  return blocks;
}

function collectBumpers(map: readonly string[]): ArenaBumper[] {
  const claimed = new Set<string>();
  const bumpers: ArenaBumper[] = [];

  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = map[row];
    if (rowText === undefined) continue;

    for (let col = 0; col < ARENA_COLS; col++) {
      if (rowText[col] !== 'B' || claimed.has(`${col},${row}`)) {
        continue;
      }

      claimed.add(`${col},${row}`);
      claimed.add(`${col + 1},${row}`);
      claimed.add(`${col},${row + 1}`);
      claimed.add(`${col + 1},${row + 1}`);

      bumpers.push({
        center: {
          x: (col + 1) * CELL_SIZE,
          y: (row + 1) * CELL_SIZE,
        },
        radius: 2,
      });
    }
  }

  return bumpers;
}

function findSpawns(
  map: readonly string[],
  spawnHeading: number,
): readonly [ArenaSpawn, ArenaSpawn] {
  let firstTopLeft: { readonly col: number; readonly row: number } | null = null;
  let secondTopLeft: { readonly col: number; readonly row: number } | null = null;

  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = map[row];
    if (rowText === undefined) continue;

    for (let col = 0; col < ARENA_COLS; col++) {
      if (rowText[col] === '1' && firstTopLeft === null) {
        firstTopLeft = { col, row };
      }
      if (rowText[col] === '2' && secondTopLeft === null) {
        secondTopLeft = { col, row };
      }
    }
  }

  const firstCol = firstTopLeft !== null ? firstTopLeft.col : 0;
  const firstRow = firstTopLeft !== null ? firstTopLeft.row : 0;
  const secondCol = secondTopLeft !== null ? secondTopLeft.col : 0;
  const secondRow = secondTopLeft !== null ? secondTopLeft.row : 0;

  const firstSpawn: ArenaSpawn = {
    position: {
      x: (firstCol + 1) * CELL_SIZE,
      y: (firstRow + 1) * CELL_SIZE,
    },
    heading: spawnHeading,
  };

  const secondSpawn: ArenaSpawn = {
    position: {
      x: (secondCol + 1) * CELL_SIZE,
      y: (secondRow + 1) * CELL_SIZE,
    },
    heading: (((8 - spawnHeading) % 16) + 16) % 16,
  };

  return [firstSpawn, secondSpawn];
}

function createSolidChecker(map: readonly string[]): (col: number, row: number) => boolean {
  return (col: number, row: number): boolean => {
    if (col < 0 || col >= ARENA_COLS || row < 0 || row >= ARENA_ROWS) {
      return true;
    }
    const rowText = map[row];
    if (rowText === undefined) return true;
    const char = rowText[col];
    return char === '#' || char === 'S' || char === 'R' || char === 'B';
  };
}

/** Compiles a valid definition; throws an Error listing the problems when `validateArena` finds any. */
export function compileArena(def: ArenaDef): Arena {
  const problems = validateArena(def);
  if (problems.length > 0) {
    const details = problems.map((problem) => problem.message).join('; ');
    throw new Error(`Arena ${def.id} is invalid: ${details}`);
  }

  return {
    id: def.id,
    name: def.name,
    purpose: def.purpose,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    blocks: mergeWallBlocks(def.map),
    bumpers: collectBumpers(def.map),
    spawns: findSpawns(def.map, def.spawnHeading),
    isSolid: createSolidChecker(def.map),
  };
}

/** Every wall as a convex polygon in world units (blocks as rectangles, bumpers as diamonds). */
export function wallPolygons(arena: Arena): Vec2[][] {
  const polygons: Vec2[][] = [];

  for (const block of arena.blocks) {
    polygons.push([
      { x: block.x, y: block.y },
      { x: block.x + block.width, y: block.y },
      { x: block.x + block.width, y: block.y + block.height },
      { x: block.x, y: block.y + block.height },
    ]);
  }

  for (const bumper of arena.bumpers) {
    polygons.push([
      { x: bumper.center.x, y: bumper.center.y - bumper.radius },
      { x: bumper.center.x + bumper.radius, y: bumper.center.y },
      { x: bumper.center.x, y: bumper.center.y + bumper.radius },
      { x: bumper.center.x - bumper.radius, y: bumper.center.y },
    ]);
  }

  return polygons;
}
