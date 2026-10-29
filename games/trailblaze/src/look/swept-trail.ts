/**
 * Trail pieces swept along the very curves riders ride (crossing.ts): a
 * light wall, a railway, a strip of linen, a ridge of ice. A look lists, per
 * seat, the layers its trail is made of, each built by sweeping it along a
 * path. Each layer is built twice, once along a straight crossing and once
 * round a right-angle turn, and every laid cell is an instance of one or the
 * other, turned and mirrored into place, so a full board stays a handful of
 * draw calls.
 *
 * The turns eight-way steering adds (by 45° or 135°) and the growing tail
 * behind a rider are drawn as a few short straight pieces along the curve.
 */
import {
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Vector2,
} from 'three';
import { CELL_COUNT, type Cell, type Seat } from '../engine/types.ts';
import { cellCentre, headingYaw } from './board-space.ts';
import { createCellInstances, type CellInstances } from './cell-instances.ts';
import { crossingPoint, rightTurnPath, turnKind, type Crossing } from './crossing.ts';
import { straightPath } from './sweep.ts';
import type { TrailPieces } from './trail-rig.ts';

/** Short straight pieces that stand in for a curve the look has no built piece for. */
const APPROXIMATION_PIECES = 4;

export interface SweptLayer {
  /** Builds the layer along a path in the table plane (see sweep.ts). */
  build(path: readonly Vector2[]): BufferGeometry;
  readonly material: Material;
  /** The tail still being drawn behind the rider, when it should look different (burning hotter). */
  readonly tailMaterial?: Material;
  /** False for detail that only appears once a cell is laid (sleepers clicking into place). */
  readonly onTail?: boolean;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

export interface SweptTrailOptions {
  /** Each seat's layers, in seat order. */
  readonly seats: readonly (readonly SweptLayer[])[];
}

export interface SweptTrail extends TrailPieces {
  readonly meshes: readonly Object3D[];
}

interface LayerPools {
  readonly straight: CellInstances;
  readonly turn: CellInstances;
  readonly tail: CellInstances | null;
}

export function createSweptTrail(options: SweptTrailOptions): SweptTrail {
  const geometries: BufferGeometry[] = [];
  const straightRun = straightPath(0, 1, 6);
  const rightTurn = rightTurnPath(16);

  const seats = options.seats.map((layers) =>
    layers.map((layer): LayerPools => {
      const straight = layer.build(straightRun);
      const turn = layer.build(rightTurn);
      geometries.push(straight, turn);
      const pool = (geometry: BufferGeometry, capacity: number, material = layer.material) =>
        createCellInstances({
          geometry,
          material,
          capacity,
          castShadow: layer.castShadow ?? false,
          receiveShadow: layer.receiveShadow ?? false,
        });
      return {
        straight: pool(straight, CELL_COUNT * APPROXIMATION_PIECES),
        turn: pool(turn, CELL_COUNT),
        tail:
          layer.onTail === false
            ? null
            : pool(straight, APPROXIMATION_PIECES, layer.tailMaterial ?? layer.material),
      };
    }),
  );
  const layersOf = (seat: Seat): readonly LayerPools[] => seats[seat] ?? [];
  const pools = seats.flatMap((layers) =>
    layers.flatMap((layer) => [layer.straight, layer.turn, ...(layer.tail ? [layer.tail] : [])]),
  );

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  const along = new Vector3();
  const from = new Vector3();
  const to = new Vector3();
  const centre = new Vector3();

  /** The straight piece stretched from one point to another. */
  function pieceBetween(start: Vector3, end: Vector3): Matrix4 | null {
    along.subVectors(end, start);
    const length = along.length();
    if (length <= 1e-4) return null;
    rotation.setFromAxisAngle(up, Math.atan2(-along.z, along.x));
    scale.set(length, 1, 1);
    return matrix.compose(start, rotation, scale);
  }

  /** Straight pieces along a crossing from `start` to `end` (fractions of the way across). */
  function addAlong(
    targets: readonly CellInstances[],
    key: Cell,
    crossing: Crossing,
    start: number,
    end: number,
    pieces: number,
  ): void {
    for (let piece = 0; piece < pieces; piece++) {
      crossingPoint(crossing, start + ((end - start) * piece) / pieces, from);
      crossingPoint(crossing, start + ((end - start) * (piece + 1)) / pieces, to);
      const placed = pieceBetween(from, to);
      if (placed) for (const target of targets) target.add(key, placed);
    }
  }

  return {
    meshes: pools.map((pool) => pool.mesh),
    addCell(seat, crossing) {
      const layers = layersOf(seat);
      const kind = turnKind(crossing.entered, crossing.left);
      if (kind === 'right' || kind === 'left') {
        rotation.setFromAxisAngle(up, headingYaw(crossing.entered));
        // Turns are built turning right; a mirror across their own path makes them turn left.
        scale.set(1, 1, kind === 'right' ? 1 : -1);
        matrix.compose(cellCentre(crossing.cell, 0, centre), rotation, scale);
        for (const layer of layers) layer.turn.add(crossing.cell, matrix);
        return;
      }
      const pieces = kind === 'straight' ? 1 : APPROXIMATION_PIECES;
      addAlong(
        layers.map((layer) => layer.straight),
        crossing.cell,
        crossing,
        0,
        1,
        pieces,
      );
    },
    removeCell(cell) {
      for (const pool of pools) pool.removeCell(cell);
    },
    setTail(seat, crossing, progress) {
      const tails = layersOf(seat).flatMap((layer) => (layer.tail ? [layer.tail] : []));
      for (const tail of tails) tail.clear();
      if (!crossing || progress <= 0) return;
      const straight = turnKind(crossing.entered, crossing.left) === 'straight';
      addAlong(tails, -1, crossing, 0, progress, straight ? 1 : APPROXIMATION_PIECES);
    },
    clear() {
      for (const pool of pools) pool.clear();
    },
    dispose() {
      for (const pool of pools) pool.dispose();
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
