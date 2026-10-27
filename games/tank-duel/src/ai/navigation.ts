/**
 * Pathfinding and cover discovery over an arena's floor grid.
 * Operates across 2 × 2 cell footprints representing the clearance needed
 * for a tank to turn and maneuver without clipping walls.
 */
import { ARENA_COLS, ARENA_ROWS, CELL_SIZE, wallPolygons, type Arena } from '../arenas/format.ts';
import { distance, vec, type Vec2 } from '../engine/vec.ts';
import { buildWallEdges, segmentBlocked } from '../engine/walls.ts';

/** Routes over the arena's tank footprints (2 × 2 cells of open floor, as the validator uses). */
export interface Navigator {
  /** Waypoints (cell-footprint centres) from `from` to the footprint nearest `to`; empty when unreachable. */
  route(from: Vec2, to: Vec2): Vec2[];
  /** Footprint centres with no straight line of sight to `threat` (walls between): cover spots. */
  coverFrom(threat: Vec2): Vec2[];
  /** Whether a footprint centre exists near this point (within one cell). */
  walkable(point: Vec2): boolean;
  /** Every footprint centre: the places a tank can stand. */
  spots(): readonly Vec2[];
}

interface Footprint {
  readonly col: number;
  readonly row: number;
  readonly center: Vec2;
}

const FOOTPRINT_COLS = ARENA_COLS - 1;
const FOOTPRINT_ROWS = ARENA_ROWS - 1;
const CARDINAL_STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Checks whether all four cells of a 2x2 square are clear floor
function hasClearFootprint(arena: Arena, col: number, row: number): boolean {
  return (
    !arena.isSolid(col, row) &&
    !arena.isSolid(col + 1, row) &&
    !arena.isSolid(col, row + 1) &&
    !arena.isSolid(col + 1, row + 1)
  );
}

// Finds the footprint whose center is closest to a given world coordinate
function findClosestFootprint(point: Vec2, footprints: readonly Footprint[]): Footprint | null {
  let closest: Footprint | null = null;
  let minDistance = Infinity;

  for (const fp of footprints) {
    const d = distance(point, fp.center);
    if (d < minDistance) {
      minDistance = d;
      closest = fp;
    }
  }

  return closest;
}

// Trims a continuous cell-by-cell path down to turning points and the destination
function simplifyCorners(path: readonly Footprint[]): Vec2[] {
  if (path.length <= 1) {
    const only = path[0];
    return only ? [only.center] : [];
  }

  const waypoints: Vec2[] = [];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    if (prev && curr && next) {
      const dx1 = curr.col - prev.col;
      const dy1 = curr.row - prev.row;
      const dx2 = next.col - curr.col;
      const dy2 = next.row - curr.row;

      // Keep waypoint whenever movement changes direction
      if (dx1 !== dx2 || dy1 !== dy2) {
        waypoints.push(curr.center);
      }
    }
  }

  const destination = path[path.length - 1];
  if (destination) {
    waypoints.push(destination.center);
  }

  return waypoints;
}

/** Precomputes footprint clearances and routing structures for an arena. */
export function createNavigator(arena: Arena): Navigator {
  const polygons = wallPolygons(arena);
  const edges = buildWallEdges(polygons);

  const grid: (Footprint | null)[][] = Array.from({ length: FOOTPRINT_ROWS }, () =>
    Array.from({ length: FOOTPRINT_COLS }, () => null),
  );
  const footprints: Footprint[] = [];

  for (let row = 0; row < FOOTPRINT_ROWS; row++) {
    const gridRow = grid[row];
    if (!gridRow) continue;

    for (let col = 0; col < FOOTPRINT_COLS; col++) {
      if (hasClearFootprint(arena, col, row)) {
        const center = vec((col + 1) * CELL_SIZE, (row + 1) * CELL_SIZE);
        const fp: Footprint = { col, row, center };
        gridRow[col] = fp;
        footprints.push(fp);
      }
    }
  }

  const spotCentres: readonly Vec2[] = footprints.map((footprint) => footprint.center);

  return {
    route(from: Vec2, to: Vec2): Vec2[] {
      const start = findClosestFootprint(from, footprints);
      const target = findClosestFootprint(to, footprints);

      if (!start || !target) {
        return [];
      }

      if (start.col === target.col && start.row === target.row) {
        return [target.center];
      }

      // Breadth-first search discovers shortest path on the 4-way footprint graph
      const visited: boolean[][] = Array.from({ length: FOOTPRINT_ROWS }, () =>
        Array.from({ length: FOOTPRINT_COLS }, () => false),
      );
      const parentGrid: (Footprint | null)[][] = Array.from({ length: FOOTPRINT_ROWS }, () =>
        Array.from({ length: FOOTPRINT_COLS }, () => null),
      );

      const queue: Footprint[] = [start];
      const startRow = visited[start.row];
      if (startRow) {
        startRow[start.col] = true;
      }

      let found = false;

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;

        if (current.col === target.col && current.row === target.row) {
          found = true;
          break;
        }

        for (const [dc, dr] of CARDINAL_STEPS) {
          const nextCol = current.col + dc;
          const nextRow = current.row + dr;

          if (
            nextCol >= 0 &&
            nextCol < FOOTPRINT_COLS &&
            nextRow >= 0 &&
            nextRow < FOOTPRINT_ROWS
          ) {
            const rowVisited = visited[nextRow];
            const candidate = grid[nextRow]?.[nextCol];

            if (rowVisited && !rowVisited[nextCol] && candidate) {
              rowVisited[nextCol] = true;
              const parentRow = parentGrid[nextRow];
              if (parentRow) {
                parentRow[nextCol] = current;
              }
              queue.push(candidate);
            }
          }
        }
      }

      if (!found) {
        return [];
      }

      // Reconstruct path backward from target to start
      const path: Footprint[] = [];
      let step: Footprint | null = target;

      while (step && (step.col !== start.col || step.row !== start.row)) {
        path.push(step);
        step = parentGrid[step.row]?.[step.col] ?? null;
      }
      path.push(start);
      path.reverse();

      return simplifyCorners(path);
    },

    coverFrom(threat: Vec2): Vec2[] {
      const coverSpots: Vec2[] = [];

      for (const fp of footprints) {
        // Obstructed straight line of sight to threat indicates safe cover
        if (segmentBlocked(fp.center, threat, edges)) {
          coverSpots.push(fp.center);
        }
      }

      return coverSpots;
    },

    spots(): readonly Vec2[] {
      return spotCentres;
    },

    walkable(point: Vec2): boolean {
      const colCenter = Math.round(point.x / CELL_SIZE) - 1;
      const rowCenter = Math.round(point.y / CELL_SIZE) - 1;

      for (let r = rowCenter - 1; r <= rowCenter + 1; r++) {
        for (let c = colCenter - 1; c <= colCenter + 1; c++) {
          const fp = grid[r]?.[c];
          if (fp && distance(point, fp.center) <= CELL_SIZE + 1e-6) {
            return true;
          }
        }
      }

      return false;
    },
  };
}
