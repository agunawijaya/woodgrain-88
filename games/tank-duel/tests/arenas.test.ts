/**
 * Tests for Tank Duel arena and sky data definitions, compilers,
 * geometry exporters, and fairness validators.
 */
import { describe, expect, it } from 'vitest';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  compileArena,
  wallPolygons,
  type ArenaDef,
  type SkyDef,
} from '../src/arenas/format.ts';
import { ARENAS, BUMPER_YARD, OPEN_FIELD, SANDBAG_LINE } from '../src/arenas/layouts.ts';
import { CLEAR_SKY, CLOUD_BANKS, SKIES } from '../src/arenas/skies.ts';
import { validateArena, validateSky } from '../src/arenas/validate.ts';

function editMap(
  map: readonly string[],
  edits: readonly { readonly row: number; readonly col: number; readonly char: string }[],
): string[] {
  const next = [...map];
  for (const edit of edits) {
    const rowStr = next[edit.row];
    if (rowStr !== undefined) {
      next[edit.row] = rowStr.slice(0, edit.col) + edit.char + rowStr.slice(edit.col + 1);
    }
  }
  return next;
}

describe('arena layouts and skies validation and compilation', () => {
  it('validates and compiles every layout in ARENAS without problems', () => {
    expect(ARENAS).toHaveLength(4);
    for (const def of ARENAS) {
      const problems = validateArena(def);
      expect(problems).toEqual([]);
      const arena = compileArena(def);
      expect(arena.id).toBe(def.id);
      expect(arena.name).toBe(def.name);
      expect(arena.purpose).toBe(def.purpose);
      expect(arena.width).toBe(ARENA_WIDTH);
      expect(arena.height).toBe(ARENA_HEIGHT);
    }
  });

  it('validates every sky in SKIES without problems', () => {
    expect(SKIES).toHaveLength(2);
    for (const sky of SKIES) {
      const problems = validateSky(sky);
      expect(problems).toEqual([]);
    }
  });

  it('compiles SANDBAG_LINE into 4 border concrete blocks, correct spawns, and matching wall area', () => {
    const arena = compileArena(SANDBAG_LINE);

    const borderBlocks = arena.blocks.filter(
      (b) =>
        b.material === 'concrete' &&
        (b.x === 0 ||
          b.y === 0 ||
          b.x + b.width === ARENA_WIDTH ||
          b.y + b.height === ARENA_HEIGHT),
    );
    expect(borderBlocks).toHaveLength(4);

    expect(arena.spawns[0]).toEqual({
      position: { x: 8, y: 20 },
      heading: 0,
    });
    expect(arena.spawns[1]).toEqual({
      position: { x: 56, y: 20 },
      heading: 8,
    });

    let solidCellCount = 0;
    for (const row of SANDBAG_LINE.map) {
      for (const char of row) {
        if (char === '#' || char === 'S' || char === 'R') {
          solidCellCount++;
        }
      }
    }
    const totalWallArea = arena.blocks.reduce((sum, b) => sum + b.width * b.height, 0);
    expect(totalWallArea).toBe(solidCellCount * 4);
    expect(arena.blocks.length).toBeGreaterThan(0);
  });

  it('compiles BUMPER_YARD with 9 bumpers and middle bumper at (32, 20) with radius 2', () => {
    const arena = compileArena(BUMPER_YARD);
    expect(arena.bumpers).toHaveLength(9);

    const centerBumper = arena.bumpers.find((b) => b.center.x === 32 && b.center.y === 20);
    expect(centerBumper).toBeDefined();
    expect(centerBumper?.radius).toBe(2);
  });

  it('sets OPEN_FIELD spawn headings to 14 and 10', () => {
    const arena = compileArena(OPEN_FIELD);
    expect(arena.spawns[0].heading).toBe(14);
    expect(arena.spawns[1].heading).toBe(10);
  });

  it('exports wall polygons as 4-point convex polygons with blocks before bumpers', () => {
    const arena = compileArena(BUMPER_YARD);
    const polys = wallPolygons(arena);

    expect(polys).toHaveLength(arena.blocks.length + arena.bumpers.length);
    for (const poly of polys) {
      expect(poly).toHaveLength(4);
    }

    const firstBlock = arena.blocks[0];
    if (firstBlock !== undefined) {
      expect(polys[0]).toEqual([
        { x: firstBlock.x, y: firstBlock.y },
        { x: firstBlock.x + firstBlock.width, y: firstBlock.y },
        { x: firstBlock.x + firstBlock.width, y: firstBlock.y + firstBlock.height },
        { x: firstBlock.x, y: firstBlock.y + firstBlock.height },
      ]);
    }

    const firstBumper = arena.bumpers[0];
    const bumperPolyIndex = arena.blocks.length;
    if (firstBumper !== undefined) {
      expect(polys[bumperPolyIndex]).toEqual([
        { x: firstBumper.center.x, y: firstBumper.center.y - firstBumper.radius },
        { x: firstBumper.center.x + firstBumper.radius, y: firstBumper.center.y },
        { x: firstBumper.center.x, y: firstBumper.center.y + firstBumper.radius },
        { x: firstBumper.center.x - firstBumper.radius, y: firstBumper.center.y },
      ]);
    }
  });

  it('correctly evaluates isSolid for wall cells, floor cells, and out of bounds', () => {
    const arena = compileArena(SANDBAG_LINE);
    expect(arena.isSolid(0, 0)).toBe(true);
    expect(arena.isSolid(1, 1)).toBe(false);
    expect(arena.isSolid(-1, 0)).toBe(true);
    expect(arena.isSolid(0, -1)).toBe(true);
    expect(arena.isSolid(32, 10)).toBe(true);
    expect(arena.isSolid(10, 20)).toBe(true);
  });
});

describe('validateArena problem detection', () => {
  it('detects wrong size when row count or column count is invalid', () => {
    const wrongRowCount: ArenaDef = {
      ...OPEN_FIELD,
      map: OPEN_FIELD.map.slice(0, 19),
    };
    const rowProblems = validateArena(wrongRowCount);
    expect(rowProblems.some((p) => p.code === 'size')).toBe(true);

    const firstRow = OPEN_FIELD.map[0];
    if (firstRow !== undefined) {
      const wrongColCount: ArenaDef = {
        ...OPEN_FIELD,
        map: [firstRow.slice(0, 31), ...OPEN_FIELD.map.slice(1)],
      };
      const colProblems = validateArena(wrongColCount);
      expect(colProblems.some((p) => p.code === 'size')).toBe(true);
    }
  });

  it('detects invalid symbols outside #SRB.12', () => {
    const invalidSymbolDef: ArenaDef = {
      ...OPEN_FIELD,
      map: editMap(OPEN_FIELD.map, [
        { row: 5, col: 5, char: 'X' },
        { row: 5, col: 26, char: 'X' },
      ]),
    };
    const problems = validateArena(invalidSymbolDef);
    expect(problems.some((p) => p.code === 'symbol')).toBe(true);
  });

  it('detects a hole in the arena border', () => {
    const holeInBorderDef: ArenaDef = {
      ...OPEN_FIELD,
      map: editMap(OPEN_FIELD.map, [
        { row: 0, col: 5, char: '.' },
        { row: 0, col: 26, char: '.' },
      ]),
    };
    const problems = validateArena(holeInBorderDef);
    expect(problems.some((p) => p.code === 'border')).toBe(true);
  });

  it('detects broken mirror symmetry', () => {
    const asymmetricDef: ArenaDef = {
      ...OPEN_FIELD,
      map: editMap(OPEN_FIELD.map, [{ row: 5, col: 5, char: '#' }]),
    };
    const problems = validateArena(asymmetricDef);
    expect(problems.some((p) => p.code === 'symmetry')).toBe(true);
  });

  it('detects a 3-cell spawn', () => {
    const brokenSpawnDef: ArenaDef = {
      ...OPEN_FIELD,
      map: editMap(OPEN_FIELD.map, [{ row: 9, col: 3, char: '.' }]),
    };
    const problems = validateArena(brokenSpawnDef);
    expect(problems.some((p) => p.code === 'spawn')).toBe(true);
  });

  it('detects a lone bumper cell not part of a 2x2 group', () => {
    const loneBumperDef: ArenaDef = {
      ...OPEN_FIELD,
      map: editMap(OPEN_FIELD.map, [
        { row: 5, col: 5, char: 'B' },
        { row: 5, col: 26, char: 'B' },
      ]),
    };
    const problems = validateArena(loneBumperDef);
    expect(problems.some((p) => p.code === 'bumper')).toBe(true);
  });

  it('detects a walled-off unreachable pocket', () => {
    const pocketDef: ArenaDef = {
      ...OPEN_FIELD,
      map: editMap(OPEN_FIELD.map, [
        { row: 1, col: 3, char: '#' },
        { row: 2, col: 3, char: '#' },
        { row: 3, col: 1, char: '#' },
        { row: 3, col: 2, char: '#' },
        { row: 3, col: 3, char: '#' },
        { row: 1, col: 28, char: '#' },
        { row: 2, col: 28, char: '#' },
        { row: 3, col: 28, char: '#' },
        { row: 3, col: 29, char: '#' },
        { row: 3, col: 30, char: '#' },
      ]),
    };
    const problems = validateArena(pocketDef);
    expect(problems.some((p) => p.code === 'pocket')).toBe(true);
  });

  it('detects an open line of sight between spawns on a non-open arena', () => {
    const openSightDef: ArenaDef = {
      ...SANDBAG_LINE,
      map: editMap(SANDBAG_LINE.map, [
        { row: 9, col: 15, char: '.' },
        { row: 9, col: 16, char: '.' },
        { row: 10, col: 15, char: '.' },
        { row: 10, col: 16, char: '.' },
      ]),
    };
    const problems = validateArena(openSightDef);
    expect(problems.some((p) => p.code === 'line-of-sight')).toBe(true);
  });

  it('detects a spawn heading aimed directly at the other spawn on an open field', () => {
    const directAimDef: ArenaDef = {
      ...OPEN_FIELD,
      spawnHeading: 0,
    };
    const problems = validateArena(directAimDef);
    expect(problems.some((p) => p.code === 'aim')).toBe(true);
  });

  it('throws in compileArena on an invalid definition with problem messages', () => {
    const invalidDef: ArenaDef = {
      ...OPEN_FIELD,
      id: 'bad-field',
      map: editMap(OPEN_FIELD.map, [
        { row: 5, col: 5, char: 'Z' },
        { row: 5, col: 26, char: 'Z' },
      ]),
    };
    expect(() => compileArena(invalidDef)).toThrow(/Arena bad-field is invalid: /);
  });
});

describe('validateSky problem detection', () => {
  it('detects out-of-bounds clouds or non-positive radii', () => {
    const outOfBoundsSky: SkyDef = {
      ...CLOUD_BANKS,
      clouds: [{ x: 70, y: 20, radiusX: 5, radiusY: 3 }],
    };
    expect(validateSky(outOfBoundsSky).some((p) => p.code === 'bounds')).toBe(true);

    const negativeRadiusSky: SkyDef = {
      ...CLOUD_BANKS,
      clouds: [{ x: 32, y: 20, radiusX: -1, radiusY: 3 }],
    };
    expect(validateSky(negativeRadiusSky).some((p) => p.code === 'bounds')).toBe(true);
  });

  it('detects an unpartnered cloud breaking point symmetry', () => {
    const asymmetricSky: SkyDef = {
      ...CLOUD_BANKS,
      clouds: [{ x: 10, y: 10, radiusX: 5, radiusY: 3 }],
    };
    expect(validateSky(asymmetricSky).some((p) => p.code === 'symmetry')).toBe(true);
  });

  it('detects excessive cloud cover over 25 percent of the sky', () => {
    const denseCoverSky: SkyDef = {
      ...CLEAR_SKY,
      clouds: [
        { x: 20, y: 20, radiusX: 16, radiusY: 10 },
        { x: 44, y: 20, radiusX: 16, radiusY: 10 },
      ],
    };
    expect(validateSky(denseCoverSky).some((p) => p.code === 'cover')).toBe(true);
  });

  it('detects unmirrored aircraft spawn positions or headings', () => {
    const badSpawnPosSky: SkyDef = {
      ...CLEAR_SKY,
      spawns: [
        { position: { x: 8, y: 20 }, heading: 0 },
        { position: { x: 50, y: 20 }, heading: 8 },
      ],
    };
    expect(validateSky(badSpawnPosSky).some((p) => p.code === 'spawn')).toBe(true);

    const badSpawnHeadingSky: SkyDef = {
      ...CLEAR_SKY,
      spawns: [
        { position: { x: 8, y: 20 }, heading: 0 },
        { position: { x: 56, y: 20 }, heading: 6 },
      ],
    };
    expect(validateSky(badSpawnHeadingSky).some((p) => p.code === 'spawn')).toBe(true);
  });
});
