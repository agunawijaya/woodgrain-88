/**
 * Box-projected texture coordinates. Generated solids (rounded boxes,
 * extrusions, broken walls) come with UVs that stretch one texture tile over
 * each face whatever its size. Projecting from the dominant normal axis
 * instead keeps the texel density the same everywhere, so a long wall and a
 * short pillar share one brick size.
 */
import type { BufferGeometry } from 'three';

/** Rewrites `uv` from positions: each vertex is mapped by the two axes its normal is not facing. */
export function projectBoxUvs(geometry: BufferGeometry, unitsPerTile: number, offset = 0): void {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index) + offset;
    const y = positions.getY(index);
    const z = positions.getZ(index) + offset * 0.37;
    const nx = Math.abs(normals.getX(index));
    const ny = Math.abs(normals.getY(index));
    const nz = Math.abs(normals.getZ(index));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uvs.setXY(index, u / unitsPerTile, v / unitsPerTile);
  }
  uvs.needsUpdate = true;
}
