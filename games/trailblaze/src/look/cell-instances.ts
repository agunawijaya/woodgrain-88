/**
 * Trail pieces drawn as instances of one mesh, filed by the cell they belong
 * to, so a whole board of 800 trail cells costs a single draw call and a gap
 * or an eraser can take one cell's pieces out again. Removing swaps the last
 * instance into the freed slot, which keeps the live instances packed at the
 * front where `mesh.count` can cut them off.
 *
 * Per-instance numbers (the tick a piece was laid, a random seed for its
 * shape) ride along as named instanced attributes for the look's shaders.
 */
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Cell } from '../engine/types.ts';

export interface CellInstances {
  readonly mesh: InstancedMesh;
  add(cell: Cell, matrix: Matrix4, values?: readonly number[], colour?: Color): void;
  removeCell(cell: Cell): void;
  clear(): void;
  dispose(): void;
}

export interface CellInstancesOptions {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly capacity: number;
  /** Names of one-number-per-instance attributes, in the order `add` takes their values. */
  readonly attributes?: readonly string[];
  readonly colours?: boolean;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

export function createCellInstances(options: CellInstancesOptions): CellInstances {
  const geometry = options.geometry.clone();
  const names = options.attributes ?? [];
  const attributes = names.map((name) => {
    const attribute = new InstancedBufferAttribute(new Float32Array(options.capacity), 1);
    geometry.setAttribute(name, attribute);
    return attribute;
  });
  const mesh = new InstancedMesh(geometry, options.material, options.capacity);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  if (options.colours) mesh.setColorAt(0, new Color());

  const ownerOf = new Int32Array(options.capacity);
  const slotsOf = new Map<Cell, number[]>();
  const scratch = new Matrix4();
  const scratchColour = new Color();

  function markChanged(): void {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    for (const attribute of attributes) attribute.needsUpdate = true;
  }

  function moveSlot(from: number, to: number): void {
    mesh.getMatrixAt(from, scratch);
    mesh.setMatrixAt(to, scratch);
    if (mesh.instanceColor) {
      mesh.getColorAt(from, scratchColour);
      mesh.setColorAt(to, scratchColour);
    }
    for (const attribute of attributes) attribute.setX(to, attribute.getX(from));
    const owner = ownerOf[from] ?? 0;
    ownerOf[to] = owner;
    const slots = slotsOf.get(owner);
    if (slots) slots[slots.indexOf(from)] = to;
  }

  return {
    mesh,
    add(cell, matrix, values = [], colour) {
      // A full board is the most a trail can hold; past it the piece is simply not drawn.
      if (mesh.count >= options.capacity) return;
      const slot = mesh.count;
      mesh.count++;
      mesh.setMatrixAt(slot, matrix);
      if (colour && mesh.instanceColor) mesh.setColorAt(slot, colour);
      attributes.forEach((attribute, index) => attribute.setX(slot, values[index] ?? 0));
      ownerOf[slot] = cell;
      const slots = slotsOf.get(cell);
      if (slots) slots.push(slot);
      else slotsOf.set(cell, [slot]);
      markChanged();
    },
    removeCell(cell) {
      const slots = slotsOf.get(cell);
      if (!slots) return;
      slotsOf.delete(cell);
      // Highest first, so a slot still to be freed is never the one moved into a hole.
      for (const slot of [...slots].sort((a, b) => b - a)) {
        const last = mesh.count - 1;
        if (slot !== last) moveSlot(last, slot);
        mesh.count--;
      }
      markChanged();
    },
    clear() {
      mesh.count = 0;
      slotsOf.clear();
      markChanged();
    },
    dispose() {
      geometry.dispose();
      mesh.dispose();
    },
  };
}
