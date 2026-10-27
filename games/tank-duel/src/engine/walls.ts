/**
 * The faces of the arena's walls that a shell can hit, and tracing a shell's
 * flight across them with bounces.
 */
import type { Vec2 } from './vec.ts';
import {
  add,
  cross,
  distance,
  dot,
  length,
  lerp,
  normalize,
  reflect,
  scale,
  sub,
  vec,
} from './vec.ts';

/** A convex wall piece. Either winding is accepted. */
export type WallPolygon = readonly Vec2[];

/** One exposed face of the walls: the part of a polygon's edge that open floor can see. */
export interface WallEdge {
  readonly a: Vec2;
  readonly b: Vec2;
  /** Unit normal pointing out of the wall, into the open floor. */
  readonly normal: Vec2;
  /** Whether the end at a (or b) is an outside corner, where a shell glances straight back. */
  readonly cornerAtA: boolean;
  readonly cornerAtB: boolean;
}

export interface BounceHit {
  /** Where the shell touched the wall. */
  readonly at: Vec2;
  /** The outward normal of the face that was hit. */
  readonly normal: Vec2;
  /** 'face' mirrors off the surface; 'corner' sends the shell straight back. */
  readonly kind: 'face' | 'corner';
  /** Distance travelled from the start of the trace to this hit. */
  readonly distance: number;
}

export interface TraceOptions {
  /** Reflect off walls (true) or stop at the first one (false). */
  readonly bounce: boolean;
  /** Within this distance of a corner end, a hit counts as a corner. Default CORNER_RADIUS. */
  readonly cornerRadius?: number;
  /** Safety cap on hits in one trace. Default MAX_TRACE_HITS. */
  readonly maxHits?: number;
}

export interface TraceResult {
  /** The start, every hit point and the end, in order: the path to draw. */
  readonly points: readonly Vec2[];
  readonly hits: readonly BounceHit[];
  readonly end: Vec2;
  /** Unit direction of travel at the end. */
  readonly direction: Vec2;
  /** True when the shell met a wall with `bounce: false` (it stops at `end`), or hit maxHits. */
  readonly stopped: boolean;
}

export const CORNER_RADIUS = 0.15;
export const MAX_TRACE_HITS = 64;

interface RawEdge {
  readonly a: Vec2;
  readonly b: Vec2;
  readonly normal: Vec2;
}

interface LineSegment {
  readonly a: Vec2;
  readonly b: Vec2;
  readonly normal: Vec2;
}

// Shoelace formula determines winding order so outward normals face open space
function polygonSignedArea(poly: WallPolygon): number {
  let sum = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const v1 = poly[i];
    const v2 = poly[(i + 1) % n];
    if (v1 !== undefined && v2 !== undefined) {
      sum += v1.x * v2.y - v1.y * v2.x;
    }
  }
  return sum * 0.5;
}

// Extracts edges with normals directed outward regardless of input winding
function extractRawPolygonEdges(polygon: WallPolygon): RawEdge[] {
  if (polygon.length < 3) {
    return [];
  }
  const area = polygonSignedArea(polygon);
  if (Math.abs(area) < 1e-9) {
    return [];
  }

  const rawEdges: RawEdge[] = [];
  const n = polygon.length;
  const isClockwise = area > 0;

  for (let i = 0; i < n; i++) {
    const v1 = polygon[i];
    const v2 = polygon[(i + 1) % n];
    if (!v1 || !v2) {
      continue;
    }

    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
      continue;
    }

    // In screen coordinates (y-down), clockwise turns place exterior to the left
    const normal = isClockwise ? vec(dy / len, -dx / len) : vec(-dy / len, dx / len);

    rawEdges.push({ a: v1, b: v2, normal });
  }

  return rawEdges;
}

// Removes internal seams where two touching polygons share a boundary line
function removeSeams(rawEdges: readonly RawEdge[]): LineSegment[] {
  const exposed: LineSegment[] = [];

  for (let i = 0; i < rawEdges.length; i++) {
    const edge = rawEdges[i];
    if (!edge) {
      continue;
    }

    const normal = edge.normal;
    const along = vec(-normal.y, normal.x);
    const lineOffset = dot(edge.a, normal);

    const coordA = dot(edge.a, along);
    const coordB = dot(edge.b, along);
    const spanStart = Math.min(coordA, coordB);
    const spanEnd = Math.max(coordA, coordB);

    const seams: [number, number][] = [];

    for (let j = 0; j < rawEdges.length; j++) {
      if (i === j) {
        continue;
      }
      const other = rawEdges[j];
      if (!other) {
        continue;
      }

      // Collinear edges touching from opposite sides have opposite normals
      if (dot(edge.normal, other.normal) > -1 + 1e-6) {
        continue;
      }
      if (
        Math.abs(dot(other.a, normal) - lineOffset) > 1e-6 ||
        Math.abs(dot(other.b, normal) - lineOffset) > 1e-6
      ) {
        continue;
      }

      const otherCoordA = dot(other.a, along);
      const otherCoordB = dot(other.b, along);
      const otherSpanStart = Math.min(otherCoordA, otherCoordB);
      const otherSpanEnd = Math.max(otherCoordA, otherCoordB);

      const seamStart = Math.max(spanStart, otherSpanStart);
      const seamEnd = Math.min(spanEnd, otherSpanEnd);

      if (seamEnd - seamStart > 1e-6) {
        seams.push([seamStart, seamEnd]);
      }
    }

    seams.sort((s1, s2) => s1[0] - s2[0]);

    // Merge touching seam spans before subtracting
    const mergedSeams: [number, number][] = [];
    for (const seam of seams) {
      const last = mergedSeams[mergedSeams.length - 1];
      if (!last) {
        mergedSeams.push([seam[0], seam[1]]);
      } else if (seam[0] <= last[1] + 1e-6) {
        last[1] = Math.max(last[1], seam[1]);
      } else {
        mergedSeams.push([seam[0], seam[1]]);
      }
    }

    // Keep spans of the edge that have open floor in front of them
    let cursor = spanStart;
    for (const [seamStart, seamEnd] of mergedSeams) {
      if (seamStart > cursor + 1e-6) {
        const segA = add(scale(normal, lineOffset), scale(along, cursor));
        const segB = add(scale(normal, lineOffset), scale(along, seamStart));
        exposed.push({ a: segA, b: segB, normal });
      }
      cursor = Math.max(cursor, seamEnd);
    }

    if (cursor < spanEnd - 1e-6) {
      const segA = add(scale(normal, lineOffset), scale(along, cursor));
      const segB = add(scale(normal, lineOffset), scale(along, spanEnd));
      exposed.push({ a: segA, b: segB, normal });
    }
  }

  return exposed;
}

// Merges contiguous collinear segments facing the same direction into single long faces
function mergeCollinearFaces(segments: readonly LineSegment[]): LineSegment[] {
  const groups: LineSegment[][] = [];

  for (const seg of segments) {
    let matchedGroup: LineSegment[] | undefined;
    for (const group of groups) {
      const representative = group[0];
      if (!representative) {
        continue;
      }
      const sameNormal = dot(seg.normal, representative.normal) > 1 - 1e-6;
      const sameLine =
        Math.abs(dot(seg.a, representative.normal) - dot(representative.a, representative.normal)) <
        1e-6;
      if (sameNormal && sameLine) {
        matchedGroup = group;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.push(seg);
    } else {
      groups.push([seg]);
    }
  }

  const mergedFaces: LineSegment[] = [];

  for (const group of groups) {
    const representative = group[0];
    if (!representative) {
      continue;
    }
    const normal = representative.normal;
    const along = vec(-normal.y, normal.x);
    const lineOffset = dot(representative.a, normal);

    const intervals: [number, number][] = group.map((seg) => {
      const coordA = dot(seg.a, along);
      const coordB = dot(seg.b, along);
      return [Math.min(coordA, coordB), Math.max(coordA, coordB)];
    });

    intervals.sort((i1, i2) => i1[0] - i2[0]);

    const combined: [number, number][] = [];
    for (const [intervalStart, intervalEnd] of intervals) {
      const last = combined[combined.length - 1];
      if (!last) {
        combined.push([intervalStart, intervalEnd]);
      } else if (intervalStart <= last[1] + 1e-6) {
        last[1] = Math.max(last[1], intervalEnd);
      } else {
        combined.push([intervalStart, intervalEnd]);
      }
    }

    for (const [intervalStart, intervalEnd] of combined) {
      mergedFaces.push({
        a: add(scale(normal, lineOffset), scale(along, intervalStart)),
        b: add(scale(normal, lineOffset), scale(along, intervalEnd)),
        normal,
      });
    }
  }

  return mergedFaces;
}

// Determines if an edge terminus turns away from the floor (outside corner)
function isOutsideCorner(
  edge: LineSegment,
  endPoint: Vec2,
  allEdges: readonly LineSegment[],
): boolean {
  const otherEnd = distance(endPoint, edge.a) < 1e-6 ? edge.b : edge.a;
  const dirTowardsP = normalize(sub(endPoint, otherEnd));

  const meeting = allEdges.filter(
    (other) =>
      other !== edge && (distance(other.a, endPoint) < 1e-6 || distance(other.b, endPoint) < 1e-6),
  );

  // An isolated face end is exposed to open floor on all sides
  if (meeting.length === 0) {
    return true;
  }

  // When the meeting wall turns convexly, its outward normal aligns with travel direction
  return meeting.some((other) => dot(dirTowardsP, other.normal) > 1e-9);
}

/** The exposed faces of a set of convex polygons: shared seams removed, collinear runs merged. */
export function buildWallEdges(polygons: readonly WallPolygon[]): WallEdge[] {
  const rawEdges: RawEdge[] = [];
  for (const poly of polygons) {
    rawEdges.push(...extractRawPolygonEdges(poly));
  }

  const exposed = removeSeams(rawEdges);
  const merged = mergeCollinearFaces(exposed);

  return merged.map((face) => ({
    a: face.a,
    b: face.b,
    normal: face.normal,
    cornerAtA: isOutsideCorner(face, face.a, merged),
    cornerAtB: isOutsideCorner(face, face.b, merged),
  }));
}

interface FaceHitCandidate {
  readonly edge: WallEdge;
  readonly distance: number;
  readonly at: Vec2;
}

/** Moves a point from `start` along `direction` (any length, normalised inside) for `distance`. */
export function traceShot(
  start: Vec2,
  direction: Vec2,
  distanceToTrace: number,
  edges: readonly WallEdge[],
  options: TraceOptions,
): TraceResult {
  const dirLen = length(direction);
  if (distanceToTrace <= 0 || dirLen === 0) {
    return {
      points: [start, start],
      hits: [],
      end: start,
      direction: normalize(direction),
      stopped: false,
    };
  }

  const cornerRadius = options.cornerRadius ?? CORNER_RADIUS;
  const maxHits = options.maxHits ?? MAX_TRACE_HITS;
  const bounce = options.bounce;

  let currentPos = start;
  let currentDir = normalize(direction);
  let remainingDist = distanceToTrace;
  let totalDistanceTravelled = 0;

  const points: Vec2[] = [start];
  const hits: BounceHit[] = [];
  let stopped = false;

  while (remainingDist > 1e-7) {
    let nearestDist = Infinity;
    let candidates: FaceHitCandidate[] = [];

    for (const edge of edges) {
      const approach = dot(currentDir, edge.normal);
      // Ignore faces facing away or parallel to the shell's trajectory
      if (approach >= -1e-9) {
        continue;
      }

      const s = dot(sub(edge.a, currentPos), edge.normal) / approach;
      if (s < 1e-7 || s > remainingDist + 1e-9) {
        continue;
      }

      const hitOnLine = add(currentPos, scale(currentDir, s));
      const edgeVec = sub(edge.b, edge.a);
      const edgeLenSq = dot(edgeVec, edgeVec);
      if (edgeLenSq < 1e-12) {
        continue;
      }

      const t = dot(sub(hitOnLine, edge.a), edgeVec) / edgeLenSq;
      if (t < -1e-6 || t > 1 + 1e-6) {
        continue;
      }

      const clampedT = Math.max(0, Math.min(1, t));
      const at = add(edge.a, scale(edgeVec, clampedT));

      if (s < nearestDist - 1e-9) {
        nearestDist = s;
        candidates = [{ edge, distance: s, at }];
      } else if (Math.abs(s - nearestDist) <= 1e-9) {
        candidates.push({ edge, distance: s, at });
      }
    }

    if (candidates.length === 0 || nearestDist === Infinity) {
      const end = add(currentPos, scale(currentDir, remainingDist));
      points.push(end);
      currentPos = end;
      break;
    }

    const first = candidates[0];
    if (!first) {
      break;
    }

    totalDistanceTravelled += nearestDist;

    let kind: 'face' | 'corner';
    const hitNormal = first.edge.normal;

    if (candidates.length > 1) {
      // Reaching the vertex of two faces simultaneously reverses the shot
      kind = 'corner';
    } else {
      const distA = distance(first.at, first.edge.a);
      const distB = distance(first.at, first.edge.b);
      const hitsCorner =
        (distA <= cornerRadius && first.edge.cornerAtA) ||
        (distB <= cornerRadius && first.edge.cornerAtB);
      kind = hitsCorner ? 'corner' : 'face';
    }

    const hit: BounceHit = {
      at: first.at,
      normal: hitNormal,
      kind,
      distance: totalDistanceTravelled,
    };

    hits.push(hit);
    points.push(first.at);

    if (!bounce) {
      currentPos = first.at;
      stopped = true;
      break;
    }

    const nextDir =
      kind === 'corner' ? scale(currentDir, -1) : normalize(reflect(currentDir, hitNormal));

    currentPos = first.at;
    currentDir = nextDir;
    remainingDist = Math.max(0, remainingDist - nearestDist);

    if (hits.length >= maxHits) {
      stopped = true;
      break;
    }
  }

  return {
    points,
    hits,
    end: currentPos,
    direction: currentDir,
    stopped,
  };
}

/** The first point where a segment touches a circle, as a fraction of the segment, or null. 0 when it starts inside. */
export function segmentHitsCircle(
  from: Vec2,
  to: Vec2,
  center: Vec2,
  radius: number,
): number | null {
  const distFromCenter = distance(from, center);
  if (distFromCenter <= radius + 1e-9) {
    return 0;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const segmentLengthSq = dx * dx + dy * dy;

  if (segmentLengthSq < 1e-12) {
    return null;
  }

  const offsetFromCenterX = from.x - center.x;
  const offsetFromCenterY = from.y - center.y;

  const quadraticA = segmentLengthSq;
  const quadraticB = 2 * (offsetFromCenterX * dx + offsetFromCenterY * dy);
  const quadraticC =
    offsetFromCenterX * offsetFromCenterX + offsetFromCenterY * offsetFromCenterY - radius * radius;

  const discriminant = quadraticB * quadraticB - 4 * quadraticA * quadraticC;
  if (discriminant < -1e-9) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(Math.max(0, discriminant));
  const firstContactFraction = (-quadraticB - sqrtDiscriminant) / (2 * quadraticA);

  if (firstContactFraction >= -1e-9 && firstContactFraction <= 1 + 1e-9) {
    return Math.max(0, Math.min(1, firstContactFraction));
  }

  return null;
}

/** The first point where a polyline touches a circle: distance along the path and the point, or null. */
export function pathHitsCircle(
  points: readonly Vec2[],
  center: Vec2,
  radius: number,
): { distance: number; at: Vec2 } | null {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    const p = points[0];
    if (p && distance(p, center) <= radius + 1e-9) {
      return { distance: 0, at: p };
    }
    return null;
  }

  let accumulatedDist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) {
      continue;
    }

    const segDist = distance(from, to);
    const t = segmentHitsCircle(from, to, center, radius);
    if (t !== null) {
      const at = lerp(from, to, t);
      return { distance: accumulatedDist + t * segDist, at };
    }
    accumulatedDist += segDist;
  }

  return null;
}

function pointOnSegment(point: Vec2, segmentStart: Vec2, segmentEnd: Vec2): boolean {
  const crossProd = cross(sub(segmentEnd, segmentStart), sub(point, segmentStart));
  if (Math.abs(crossProd) > 1e-6) {
    return false;
  }
  const minX = Math.min(segmentStart.x, segmentEnd.x) - 1e-6;
  const maxX = Math.max(segmentStart.x, segmentEnd.x) + 1e-6;
  const minY = Math.min(segmentStart.y, segmentEnd.y) - 1e-6;
  const maxY = Math.max(segmentStart.y, segmentEnd.y) + 1e-6;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function segmentsIntersect(seg1A: Vec2, seg1B: Vec2, seg2A: Vec2, seg2B: Vec2): boolean {
  if (
    pointOnSegment(seg1A, seg2A, seg2B) ||
    pointOnSegment(seg1B, seg2A, seg2B) ||
    pointOnSegment(seg2A, seg1A, seg1B) ||
    pointOnSegment(seg2B, seg1A, seg1B)
  ) {
    return true;
  }

  const cp1 = cross(sub(seg1B, seg1A), sub(seg2A, seg1A));
  const cp2 = cross(sub(seg1B, seg1A), sub(seg2B, seg1A));
  const cp3 = cross(sub(seg2B, seg2A), sub(seg1A, seg2A));
  const cp4 = cross(sub(seg2B, seg2A), sub(seg1B, seg2A));

  return (
    ((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) && ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))
  );
}

/** Whether the straight segment between two points crosses any wall face (for line of sight). */
export function segmentBlocked(from: Vec2, to: Vec2, edges: readonly WallEdge[]): boolean {
  for (const edge of edges) {
    if (segmentsIntersect(from, to, edge.a, edge.b)) {
      return true;
    }
  }
  return false;
}
