/**
 * What the Remix rules add to any look: walls that rise ring by ring as the
 * Shrinking Arena closes in, and the glowing lanes of Boost Lanes. Each look
 * only picks the colours, so the pieces read as part of its world (neon
 * barriers, wooden blocks, tomb stone, packed snow) while the shapes stay
 * the same everywhere: a solid cell-sized block for a wall, a flat strip for
 * a lane, so nobody mistakes one for the other or for a trail.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
} from 'three';
import { CELL_COUNT, type Cell } from '../engine/types.ts';
import { cellCentre } from './board-space.ts';

export interface RemixStyle {
  /** The closing walls: their colour and how tall they stand, in cells. */
  readonly wall: string;
  readonly wallHeight: number;
  /** The boost lanes' colour; at night they glow. */
  readonly lane: string;
  readonly night: boolean;
}

export interface RemixPieces {
  readonly root: Group;
  /** A ring of cells has become wall: blocks rise there over a moment. */
  raiseWalls(cells: readonly Cell[]): void;
  /** Draws the lanes; an empty list clears them. */
  showLanes(cells: readonly Cell[]): void;
  /** A new round: the walls go, the lanes stay. */
  reset(): void;
  update(dt: number, clock: number): void;
  dispose(): void;
}

/** How long a closing wall takes to rise, in seconds. */
const RISE_SECONDS = 0.4;
const LANE_LIFT = 0.012;

export function createRemixPieces(style: RemixStyle): RemixPieces {
  const root = new Group();
  root.name = 'remix';

  const wallGeometry = new BoxGeometry(0.96, 1, 0.96);
  wallGeometry.translate(0, 0.5, 0);
  const wallMaterial = new MeshStandardMaterial({
    color: new Color(style.wall),
    roughness: 0.55,
    metalness: 0.05,
  });
  const walls = new InstancedMesh(wallGeometry, wallMaterial, CELL_COUNT);
  walls.instanceMatrix.setUsage(DynamicDrawUsage);
  walls.count = 0;
  walls.castShadow = true;
  walls.receiveShadow = true;
  walls.frustumCulled = false;
  root.add(walls);
  const rising: { cell: Cell; age: number }[] = [];
  const scratch = new Object3D();

  const laneGeometry = new PlaneGeometry(1, 1);
  laneGeometry.rotateX(-Math.PI / 2);
  const laneMaterial = new MeshBasicMaterial({
    color: new Color(style.lane).multiplyScalar(style.night ? 1.6 : 1),
    transparent: true,
    opacity: style.night ? 0.55 : 0.4,
    depthWrite: false,
    blending: style.night ? AdditiveBlending : NormalBlending,
  });
  let lanes: InstancedMesh | null = null;

  function placeWall(index: number, cell: Cell, rise: number): void {
    cellCentre(cell, 0, scratch.position);
    scratch.scale.set(1, Math.max(0.001, rise * style.wallHeight), 1);
    scratch.updateMatrix();
    walls.setMatrixAt(index, scratch.matrix);
  }

  return {
    root,
    raiseWalls(cells) {
      for (const cell of cells) {
        if (rising.length >= CELL_COUNT) break;
        rising.push({ cell, age: 0 });
        placeWall(rising.length - 1, cell, 0);
      }
      walls.count = rising.length;
      walls.instanceMatrix.needsUpdate = true;
    },
    showLanes(cells) {
      if (lanes) {
        lanes.removeFromParent();
        lanes.dispose();
        lanes = null;
      }
      if (cells.length === 0) return;
      lanes = new InstancedMesh(laneGeometry, laneMaterial, cells.length);
      cells.forEach((cell, index) => {
        cellCentre(cell, LANE_LIFT, scratch.position);
        scratch.scale.set(0.92, 1, 0.92);
        scratch.updateMatrix();
        lanes?.setMatrixAt(index, scratch.matrix);
      });
      root.add(lanes);
    },
    reset() {
      rising.length = 0;
      walls.count = 0;
    },
    update(dt, clock) {
      let moved = false;
      for (const [index, wall] of rising.entries()) {
        if (wall.age >= RISE_SECONDS) continue;
        wall.age = Math.min(RISE_SECONDS, wall.age + dt);
        const t = wall.age / RISE_SECONDS;
        placeWall(index, wall.cell, 1 - (1 - t) * (1 - t));
        moved = true;
      }
      if (moved) walls.instanceMatrix.needsUpdate = true;
      // The lanes breathe, so they read as live ground rather than paint.
      laneMaterial.opacity = (style.night ? 0.5 : 0.36) + 0.12 * Math.sin(clock * 3);
    },
    dispose() {
      walls.dispose();
      wallGeometry.dispose();
      wallMaterial.dispose();
      lanes?.dispose();
      laneGeometry.dispose();
      laneMaterial.dispose();
    },
  };
}
