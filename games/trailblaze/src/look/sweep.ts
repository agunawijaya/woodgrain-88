/**
 * Geometry swept along a path on the table: a cross-section (sideways offset
 * and height) carried along a line of points, for light walls, track, linen
 * and ice that follow the curve a rider took round a corner.
 *
 * Paths are drawn in the table plane as (x, z) pairs. Trail pieces are built
 * in two frames: a straight crossing along +x from 0 to 1, and a right turn
 * in a corner's own frame (see crossing.ts).
 */
import { BufferGeometry, Float32BufferAttribute, Vector2 } from 'three';

/** A straight path along +x, from `from` to `to`, in `steps` pieces. */
export function straightPath(from: number, to: number, steps = 1): Vector2[] {
  return Array.from(
    { length: steps + 1 },
    (_, step) => new Vector2(from + ((to - from) * step) / steps, 0),
  );
}

/** Points along a path every `spacing` of its length, with the direction it runs there. */
export function alongPath(
  path: readonly Vector2[],
  spacing: number,
  offset = spacing / 2,
): { point: Vector2; angle: number }[] {
  const result: { point: Vector2; angle: number }[] = [];
  let next = offset;
  let travelled = 0;
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1];
    const b = path[index];
    if (!a || !b) continue;
    const length = a.distanceTo(b);
    while (next <= travelled + length) {
      const t = (next - travelled) / length;
      result.push({
        point: a.clone().lerp(b, t),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      });
      next += spacing;
    }
    travelled += length;
  }
  return result;
}

export interface SweepOptions {
  /** Join the last corner of the section back to the first (a solid); false for a sheet. */
  readonly closed?: boolean;
  /** The texture's v at each corner of the section; by default spread evenly from 0 to 1. */
  readonly sectionV?: readonly number[];
  /** Texture repeats per unit of length along the path (u). */
  readonly uPerUnit?: number;
}

/**
 * Carries a cross-section along a path. The cross-section's x is the offset to the right of the
 * path (towards +z on a path running along +x) and its y the height above the table. The ends are
 * left open; trail pieces butt against each other there.
 */
export function sweepSection(
  path: readonly Vector2[],
  section: readonly Vector2[],
  options: SweepOptions = {},
): BufferGeometry {
  const closed = options.closed ?? true;
  const uPerUnit = options.uPerUnit ?? 1;
  const vOf = (corner: number) =>
    options.sectionV?.[corner] ?? corner / Math.max(1, section.length - 1);
  let travelled = 0;
  const rings = path.map((point, index) => {
    const before = path[Math.max(0, index - 1)] ?? point;
    const after = path[Math.min(path.length - 1, index + 1)] ?? point;
    const previous = path[index - 1];
    if (previous) travelled += previous.distanceTo(point);
    const dx = after.x - before.x;
    const dz = after.y - before.y;
    const length = Math.hypot(dx, dz) || 1;
    // The right-hand side of the direction of travel, in table coordinates.
    const sideX = -dz / length;
    const sideZ = dx / length;
    return {
      u: travelled * uPerUnit,
      corners: section.map(
        (corner) => [point.x + sideX * corner.x, corner.y, point.y + sideZ * corner.x] as const,
      ),
    };
  });
  const positions: number[] = [];
  const uvs: number[] = [];
  const edges = closed ? section.length : section.length - 1;
  for (let ring = 1; ring < rings.length; ring++) {
    const previous = rings[ring - 1];
    const current = rings[ring];
    if (!previous || !current) continue;
    for (let corner = 0; corner < edges; corner++) {
      const nextCorner = (corner + 1) % section.length;
      const a = previous.corners[corner];
      const b = previous.corners[nextCorner];
      const c = current.corners[corner];
      const d = current.corners[nextCorner];
      if (!a || !b || !c || !d) continue;
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
      const [va, vb] = [vOf(corner), vOf(nextCorner)];
      uvs.push(
        previous.u,
        va,
        current.u,
        va,
        previous.u,
        vb,
        previous.u,
        vb,
        current.u,
        va,
        current.u,
        vb,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** A rectangle cross-section `width` wide centred on `offset`, from `bottom` to `top`. */
export function boxSection(offset: number, width: number, bottom: number, top: number): Vector2[] {
  const half = width / 2;
  return [
    new Vector2(offset - half, bottom),
    new Vector2(offset - half, top),
    new Vector2(offset + half, top),
    new Vector2(offset + half, bottom),
  ];
}
