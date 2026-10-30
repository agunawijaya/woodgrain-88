/**
 * Keeps the geometries and materials a look builds, so disposing a figure
 * frees everything it made in one call and nothing is forgotten.
 */
import type { BufferGeometry, Material } from 'three';

export interface Keeper {
  geometry<T extends BufferGeometry>(geometry: T): T;
  material<T extends Material>(material: T): T;
  readonly dispose: () => void;
}

export function createKeeper(): Keeper {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  return {
    geometry(geometry) {
      geometries.push(geometry);
      return geometry;
    },
    material(material) {
      materials.push(material);
      return material;
    },
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
