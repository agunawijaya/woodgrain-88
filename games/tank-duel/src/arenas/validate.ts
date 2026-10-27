/**
 * Proves that an arena layout is fair and playable, and that an aircraft
 * sky is fair.
 */
import type { Vec2 } from '../engine/vec.ts';
import { add, distance, headingVector, scale } from '../engine/vec.ts';
import {
  ARENA_COLS,
  ARENA_HEIGHT,
  ARENA_ROWS,
  ARENA_WIDTH,
  CELL_SIZE,
  type ArenaDef,
  type SkyDef,
} from './format.ts';

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

export type SkyProblemCode = 'bounds' | 'symmetry' | 'cover' | 'spawn';

export interface SkyProblem {
  readonly code: SkyProblemCode;
  readonly message: string;
}

interface CellCoord {
  readonly col: number;
  readonly row: number;
}

function isCellSolid(map: readonly string[], col: number, row: number): boolean {
  if (col < 0 || col >= ARENA_COLS || row < 0 || row >= ARENA_ROWS) {
    return true;
  }
  const rowText = map[row];
  if (rowText === undefined) return true;
  const char = rowText[col];
  return char === '#' || char === 'S' || char === 'R' || char === 'B';
}

function checkSize(def: ArenaDef): ArenaProblem[] {
  const problems: ArenaProblem[] = [];
  if (def.map.length !== ARENA_ROWS) {
    problems.push({
      code: 'size',
      message: `Arena map must have exactly ${ARENA_ROWS} rows, found ${def.map.length}`,
    });
  }
  for (let row = 0; row < def.map.length; row++) {
    const rowText = def.map[row];
    if (rowText !== undefined && rowText.length !== ARENA_COLS) {
      problems.push({
        code: 'size',
        message: `Arena map row ${row} must have exactly ${ARENA_COLS} characters, found ${rowText.length}`,
      });
    }
  }
  return problems;
}

function checkSymbols(def: ArenaDef): ArenaProblem[] {
  const problems: ArenaProblem[] = [];
  const validSymbols = new Set(['#', 'S', 'R', 'B', '.', '1', '2']);
  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = def.map[row];
    if (rowText === undefined) continue;
    for (let col = 0; col < ARENA_COLS; col++) {
      const char = rowText[col];
      if (char !== undefined && !validSymbols.has(char)) {
        problems.push({
          code: 'symbol',
          message: `Invalid symbol '${char}' at row ${row}, col ${col}`,
        });
      }
    }
  }
  return problems;
}

function checkBorder(def: ArenaDef): ArenaProblem[] {
  const problems: ArenaProblem[] = [];
  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = def.map[row];
    if (rowText === undefined) continue;
    for (let col = 0; col < ARENA_COLS; col++) {
      if (row === 0 || row === ARENA_ROWS - 1 || col === 0 || col === ARENA_COLS - 1) {
        const char = rowText[col];
        if (char !== '#') {
          problems.push({
            code: 'border',
            message: `Border cell at row ${row}, col ${col} must be '#', found '${char ?? ''}'`,
          });
        }
      }
    }
  }
  return problems;
}

function checkSymmetry(def: ArenaDef): ArenaProblem[] {
  const problems: ArenaProblem[] = [];
  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = def.map[row];
    if (rowText === undefined) continue;
    for (let col = 0; col < ARENA_COLS / 2; col++) {
      const leftChar = rowText[col];
      const rightCol = ARENA_COLS - 1 - col;
      const rightChar = rowText[rightCol];
      const isMirrored =
        (leftChar === rightChar && leftChar !== '1' && leftChar !== '2') ||
        (leftChar === '1' && rightChar === '2') ||
        (leftChar === '2' && rightChar === '1');
      if (!isMirrored) {
        problems.push({
          code: 'symmetry',
          message:
            `Cell at row ${row}, col ${col} ('${leftChar ?? ''}') ` +
            `does not mirror row ${row}, col ${rightCol} ('${rightChar ?? ''}')`,
        });
      }
    }
  }
  return problems;
}

function findSpawnCells(map: readonly string[], symbol: string): CellCoord[] {
  const cells: CellCoord[] = [];
  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = map[row];
    if (rowText === undefined) continue;
    for (let col = 0; col < ARENA_COLS; col++) {
      if (rowText[col] === symbol) {
        cells.push({ col, row });
      }
    }
  }
  return cells;
}

function validateSpawnGroup(
  cells: readonly CellCoord[],
  symbol: string,
  expectedLeft: boolean,
): { readonly valid: boolean; readonly topLeft?: CellCoord; readonly problem?: string } {
  if (cells.length !== 4) {
    return {
      valid: false,
      problem: `Spawn ${symbol} must have exactly 4 cells forming a 2x2 square, found ${cells.length}`,
    };
  }
  const first = cells[0];
  if (first === undefined) {
    return { valid: false, problem: `Spawn ${symbol} has no cells` };
  }
  const { col, row } = first;
  if (expectedLeft && col >= ARENA_COLS / 2) {
    return { valid: false, problem: 'Spawn 1 must be on the left half of the arena' };
  }
  if (!expectedLeft && col < ARENA_COLS / 2) {
    return { valid: false, problem: 'Spawn 2 must be on the right half of the arena' };
  }

  const expectedSet = new Set([
    `${col},${row}`,
    `${col + 1},${row}`,
    `${col},${row + 1}`,
    `${col + 1},${row + 1}`,
  ]);
  for (const cell of cells) {
    if (!expectedSet.has(`${cell.col},${cell.row}`)) {
      return {
        valid: false,
        problem:
          `Spawn ${symbol} cells do not form a contiguous 2x2 square ` +
          `starting at row ${row}, col ${col}`,
      };
    }
  }

  return { valid: true, topLeft: { col, row } };
}

function checkSpawns(def: ArenaDef): ArenaProblem[] {
  const problems: ArenaProblem[] = [];
  const firstSpawnResult = validateSpawnGroup(findSpawnCells(def.map, '1'), '1', true);
  if (!firstSpawnResult.valid) {
    problems.push({
      code: 'spawn',
      message: firstSpawnResult.problem ?? 'Invalid spawn 1',
    });
  }

  const secondSpawnResult = validateSpawnGroup(findSpawnCells(def.map, '2'), '2', false);
  if (!secondSpawnResult.valid) {
    problems.push({
      code: 'spawn',
      message: secondSpawnResult.problem ?? 'Invalid spawn 2',
    });
  }

  return problems;
}

function checkBumpers(def: ArenaDef): ArenaProblem[] {
  const problems: ArenaProblem[] = [];
  const claimed = new Set<string>();

  for (let row = 0; row < ARENA_ROWS; row++) {
    const rowText = def.map[row];
    if (rowText === undefined) continue;

    for (let col = 0; col < ARENA_COLS; col++) {
      if (rowText[col] !== 'B' || claimed.has(`${col},${row}`)) {
        continue;
      }

      const nextRowText = def.map[row + 1];
      const formsGroup =
        col + 1 < ARENA_COLS &&
        row + 1 < ARENA_ROWS &&
        rowText[col + 1] === 'B' &&
        !claimed.has(`${col + 1},${row}`) &&
        nextRowText?.[col] === 'B' &&
        !claimed.has(`${col},${row + 1}`) &&
        nextRowText[col + 1] === 'B' &&
        !claimed.has(`${col + 1},${row + 1}`);

      if (formsGroup) {
        claimed.add(`${col},${row}`);
        claimed.add(`${col + 1},${row}`);
        claimed.add(`${col},${row + 1}`);
        claimed.add(`${col + 1},${row + 1}`);
      } else {
        problems.push({
          code: 'bumper',
          message: `Bumper cell at row ${row}, col ${col} is not part of a 2x2 bumper group`,
        });
      }
    }
  }

  return problems;
}

function checkPockets(def: ArenaDef, firstSpawnTopLeft?: CellCoord): ArenaProblem[] {
  if (firstSpawnTopLeft === undefined) {
    return [];
  }

  const isFootprint = (col: number, row: number): boolean => {
    return (
      !isCellSolid(def.map, col, row) &&
      !isCellSolid(def.map, col + 1, row) &&
      !isCellSolid(def.map, col, row + 1) &&
      !isCellSolid(def.map, col + 1, row + 1)
    );
  };

  const allFootprints: CellCoord[] = [];
  for (let row = 0; row <= ARENA_ROWS - 2; row++) {
    for (let col = 0; col <= ARENA_COLS - 2; col++) {
      if (isFootprint(col, row)) {
        allFootprints.push({ col, row });
      }
    }
  }

  const visited = new Set<string>();
  const queue: CellCoord[] = [firstSpawnTopLeft];
  visited.add(`${firstSpawnTopLeft.col},${firstSpawnTopLeft.row}`);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const neighbors: CellCoord[] = [
      { col: current.col + 1, row: current.row },
      { col: current.col - 1, row: current.row },
      { col: current.col, row: current.row + 1 },
      { col: current.col, row: current.row - 1 },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.col >= 0 &&
        neighbor.col <= ARENA_COLS - 2 &&
        neighbor.row >= 0 &&
        neighbor.row <= ARENA_ROWS - 2 &&
        isFootprint(neighbor.col, neighbor.row)
      ) {
        const key = `${neighbor.col},${neighbor.row}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }
  }

  const unreached = allFootprints.filter(
    (footprint) => !visited.has(`${footprint.col},${footprint.row}`),
  );
  if (unreached.length > 0) {
    const sample = unreached
      .slice(0, 5)
      .map((footprint) => `(col ${footprint.col}, row ${footprint.row})`)
      .join(', ');
    return [
      {
        code: 'pocket',
        message: `Unreachable tank footprint(s) from spawn 1: ${sample}`,
      },
    ];
  }

  return [];
}

function checkLineOfSight(
  def: ArenaDef,
  firstSpawnTopLeft?: CellCoord,
  secondSpawnTopLeft?: CellCoord,
): ArenaProblem[] {
  if (
    def.purpose === 'open' ||
    firstSpawnTopLeft === undefined ||
    secondSpawnTopLeft === undefined
  ) {
    return [];
  }

  const firstCenter: Vec2 = {
    x: (firstSpawnTopLeft.col + 1) * CELL_SIZE,
    y: (firstSpawnTopLeft.row + 1) * CELL_SIZE,
  };
  const secondCenter: Vec2 = {
    x: (secondSpawnTopLeft.col + 1) * CELL_SIZE,
    y: (secondSpawnTopLeft.row + 1) * CELL_SIZE,
  };
  const totalDistance = distance(firstCenter, secondCenter);
  let passesSolid = false;
  const stepSize = 0.25;
  const steps = Math.ceil(totalDistance / stepSize);

  for (let step = 0; step <= steps; step++) {
    const ratio = Math.min(step * stepSize, totalDistance) / totalDistance;
    const samplePoint: Vec2 = {
      x: firstCenter.x + (secondCenter.x - firstCenter.x) * ratio,
      y: firstCenter.y + (secondCenter.y - firstCenter.y) * ratio,
    };
    const col = Math.floor(samplePoint.x / CELL_SIZE);
    const row = Math.floor(samplePoint.y / CELL_SIZE);
    if (isCellSolid(def.map, col, row)) {
      passesSolid = true;
      break;
    }
  }

  if (!passesSolid) {
    return [
      {
        code: 'line-of-sight',
        message:
          `Arena purpose '${def.purpose}' requires solid cover along the line ` +
          'of sight between spawns',
      },
    ];
  }

  return [];
}

function checkAim(
  def: ArenaDef,
  firstSpawnTopLeft?: CellCoord,
  secondSpawnTopLeft?: CellCoord,
): ArenaProblem[] {
  if (firstSpawnTopLeft === undefined || secondSpawnTopLeft === undefined) {
    return [];
  }

  const problems: ArenaProblem[] = [];
  const firstCenter: Vec2 = {
    x: (firstSpawnTopLeft.col + 1) * CELL_SIZE,
    y: (firstSpawnTopLeft.row + 1) * CELL_SIZE,
  };
  const secondCenter: Vec2 = {
    x: (secondSpawnTopLeft.col + 1) * CELL_SIZE,
    y: (secondSpawnTopLeft.row + 1) * CELL_SIZE,
  };
  const firstHeading = def.spawnHeading;
  const secondHeading = (((8 - def.spawnHeading) % 16) + 16) % 16;

  const firstDir = headingVector(firstHeading);
  for (let sampleDist = 0; sampleDist <= 100; sampleDist += 0.25) {
    const point = add(firstCenter, scale(firstDir, sampleDist));
    const col = Math.floor(point.x / CELL_SIZE);
    const row = Math.floor(point.y / CELL_SIZE);
    if (isCellSolid(def.map, col, row)) {
      break;
    }
    if (distance(point, secondCenter) < 3) {
      problems.push({
        code: 'aim',
        message:
          'Spawn 1 heading aims within 3 units of spawn 2 center ' +
          `(distance: ${distance(point, secondCenter).toFixed(2)})`,
      });
      break;
    }
  }

  const secondDir = headingVector(secondHeading);
  for (let sampleDist = 0; sampleDist <= 100; sampleDist += 0.25) {
    const point = add(secondCenter, scale(secondDir, sampleDist));
    const col = Math.floor(point.x / CELL_SIZE);
    const row = Math.floor(point.y / CELL_SIZE);
    if (isCellSolid(def.map, col, row)) {
      break;
    }
    if (distance(point, firstCenter) < 3) {
      problems.push({
        code: 'aim',
        message:
          'Spawn 2 heading aims within 3 units of spawn 1 center ' +
          `(distance: ${distance(point, firstCenter).toFixed(2)})`,
      });
      break;
    }
  }

  return problems;
}

/** Every reason this arena is not fair or playable; empty when it is fine. */
export function validateArena(def: ArenaDef): ArenaProblem[] {
  const sizeProblems = checkSize(def);
  if (sizeProblems.length > 0) {
    return sizeProblems;
  }

  const firstSpawnCells = findSpawnCells(def.map, '1');
  const firstSpawnResult = validateSpawnGroup(firstSpawnCells, '1', true);
  const secondSpawnCells = findSpawnCells(def.map, '2');
  const secondSpawnResult = validateSpawnGroup(secondSpawnCells, '2', false);

  return [
    ...checkSymbols(def),
    ...checkBorder(def),
    ...checkSymmetry(def),
    ...checkSpawns(def),
    ...checkBumpers(def),
    ...checkPockets(def, firstSpawnResult.topLeft),
    ...checkLineOfSight(def, firstSpawnResult.topLeft, secondSpawnResult.topLeft),
    ...checkAim(def, firstSpawnResult.topLeft, secondSpawnResult.topLeft),
  ];
}

function checkCloudBounds(def: SkyDef): SkyProblem[] {
  const problems: SkyProblem[] = [];
  for (let index = 0; index < def.clouds.length; index++) {
    const cloud = def.clouds[index];
    if (cloud === undefined) continue;
    if (
      cloud.x < 0 ||
      cloud.x > ARENA_WIDTH ||
      cloud.y < 0 ||
      cloud.y > ARENA_HEIGHT ||
      cloud.radiusX <= 0 ||
      cloud.radiusY <= 0
    ) {
      problems.push({
        code: 'bounds',
        message:
          `Cloud ${index} at (${cloud.x}, ${cloud.y}) with radii ` +
          `(${cloud.radiusX}, ${cloud.radiusY}) is out of bounds or non-positive`,
      });
    }
  }
  return problems;
}

function checkCloudSymmetry(def: SkyDef): SkyProblem[] {
  const problems: SkyProblem[] = [];
  const matched = new Set<number>();

  for (let firstIndex = 0; firstIndex < def.clouds.length; firstIndex++) {
    if (matched.has(firstIndex)) continue;
    const firstCloud = def.clouds[firstIndex];
    if (firstCloud === undefined) continue;

    const isAtCenter =
      Math.abs(firstCloud.x - ARENA_WIDTH / 2) < 1e-9 &&
      Math.abs(firstCloud.y - ARENA_HEIGHT / 2) < 1e-9;
    if (isAtCenter) {
      matched.add(firstIndex);
      continue;
    }

    const targetX = ARENA_WIDTH - firstCloud.x;
    const targetY = ARENA_HEIGHT - firstCloud.y;
    let partnerIndex = -1;

    for (let secondIndex = 0; secondIndex < def.clouds.length; secondIndex++) {
      if (secondIndex === firstIndex || matched.has(secondIndex)) continue;
      const secondCloud = def.clouds[secondIndex];
      if (secondCloud === undefined) continue;
      if (
        Math.abs(secondCloud.x - targetX) < 1e-9 &&
        Math.abs(secondCloud.y - targetY) < 1e-9 &&
        Math.abs(secondCloud.radiusX - firstCloud.radiusX) < 1e-9 &&
        Math.abs(secondCloud.radiusY - firstCloud.radiusY) < 1e-9
      ) {
        partnerIndex = secondIndex;
        break;
      }
    }

    if (partnerIndex !== -1) {
      matched.add(firstIndex);
      matched.add(partnerIndex);
    } else {
      problems.push({
        code: 'symmetry',
        message:
          `Cloud at (${firstCloud.x}, ${firstCloud.y}) has no point-mirror partner ` +
          `at (${targetX}, ${targetY}) with matching radii`,
      });
    }
  }

  return problems;
}

function checkCover(def: SkyDef): SkyProblem[] {
  const skyArea = ARENA_WIDTH * ARENA_HEIGHT;
  const maxCoverArea = 0.25 * skyArea;
  let totalCloudArea = 0;
  for (const cloud of def.clouds) {
    totalCloudArea += Math.PI * cloud.radiusX * cloud.radiusY;
  }
  if (totalCloudArea > maxCoverArea) {
    return [
      {
        code: 'cover',
        message:
          `Total cloud cover area (${totalCloudArea.toFixed(1)}) ` +
          `exceeds 25% of sky area (${maxCoverArea})`,
      },
    ];
  }
  return [];
}

function checkSkySpawns(def: SkyDef): SkyProblem[] {
  const [firstSpawn, secondSpawn] = def.spawns;
  const expectedX = ARENA_WIDTH - firstSpawn.position.x;
  const expectedY = ARENA_HEIGHT - firstSpawn.position.y;
  const expectedHeading = (firstSpawn.heading + 8) % 16;

  const posMatch =
    Math.abs(secondSpawn.position.x - expectedX) < 1e-9 &&
    Math.abs(secondSpawn.position.y - expectedY) < 1e-9;
  const headingMatch = secondSpawn.heading === expectedHeading;

  if (!posMatch || !headingMatch) {
    return [
      {
        code: 'spawn',
        message:
          `Aircraft spawn 2 (${secondSpawn.position.x}, ${secondSpawn.position.y}, ` +
          `h=${secondSpawn.heading}) is not the point mirror of spawn 1 ` +
          `(expected (${expectedX}, ${expectedY}, h=${expectedHeading}))`,
      },
    ];
  }

  return [];
}

/** Validates aircraft sky bounds, symmetry, cover density, and spawn symmetry. */
export function validateSky(def: SkyDef): SkyProblem[] {
  return [
    ...checkCloudBounds(def),
    ...checkCloudSymmetry(def),
    ...checkCover(def),
    ...checkSkySpawns(def),
  ];
}
