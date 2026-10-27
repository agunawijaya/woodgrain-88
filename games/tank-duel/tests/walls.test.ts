import { describe, expect, it } from 'vitest';
import { distance, vec, type Vec2 } from '../src/engine/vec.ts';
import {
  buildWallEdges,
  pathHitsCircle,
  segmentBlocked,
  segmentHitsCircle,
  traceShot,
  type WallPolygon,
} from '../src/engine/walls.ts';

function touchesPoint(edge: { a: Vec2; b: Vec2 }, x: number, y: number): boolean {
  return (
    (Math.abs(edge.a.x - x) < 1e-6 && Math.abs(edge.a.y - y) < 1e-6) ||
    (Math.abs(edge.b.x - x) < 1e-6 && Math.abs(edge.b.y - y) < 1e-6)
  );
}

describe('walls', () => {
  it('extracts 4 edges with outward normals and outside corners for either winding', () => {
    // Clockwise rectangle: (0,0) -> (10,0) -> (10,5) -> (0,5)
    const cwRect: WallPolygon = [vec(0, 0), vec(10, 0), vec(10, 5), vec(0, 5)];
    // Counter-clockwise rectangle: (0,0) -> (0,5) -> (10,5) -> (10,0)
    const ccwRect: WallPolygon = [vec(0, 0), vec(0, 5), vec(10, 5), vec(10, 0)];

    const edgesCw = buildWallEdges([cwRect]);
    const edgesCcw = buildWallEdges([ccwRect]);

    expect(edgesCw).toHaveLength(4);
    expect(edgesCcw).toHaveLength(4);

    for (const edges of [edgesCw, edgesCcw]) {
      // Every edge end is an outside corner on a solitary rectangle
      for (const edge of edges) {
        expect(edge.cornerAtA).toBe(true);
        expect(edge.cornerAtB).toBe(true);
        expect(Math.abs(edge.normal.x ** 2 + edge.normal.y ** 2 - 1)).toBeLessThan(1e-6);
      }

      // Check normals point away from box interior [0..10] x [0..5]
      const top = edges.find((e) => Math.abs(e.a.y) < 1e-6 && Math.abs(e.b.y) < 1e-6);
      const bottom = edges.find((e) => Math.abs(e.a.y - 5) < 1e-6 && Math.abs(e.b.y - 5) < 1e-6);
      const left = edges.find((e) => Math.abs(e.a.x) < 1e-6 && Math.abs(e.b.x) < 1e-6);
      const right = edges.find((e) => Math.abs(e.a.x - 10) < 1e-6 && Math.abs(e.b.x - 10) < 1e-6);

      expect(top).toBeDefined();
      expect(bottom).toBeDefined();
      expect(left).toBeDefined();
      expect(right).toBeDefined();

      if (top && bottom && left && right) {
        expect(top.normal.x).toBeCloseTo(0);
        expect(top.normal.y).toBeCloseTo(-1);

        expect(bottom.normal.x).toBeCloseTo(0);
        expect(bottom.normal.y).toBeCloseTo(1);

        expect(left.normal.x).toBeCloseTo(-1);
        expect(left.normal.y).toBeCloseTo(0);

        expect(right.normal.x).toBeCloseTo(1);
        expect(right.normal.y).toBeCloseTo(0);
      }
    }
  });

  it('removes shared seam and merges collinear faces for touching rectangles', () => {
    // Two rectangles side by side: [0,4] x [0,2] and [4,8] x [0,2]
    const rect1: WallPolygon = [vec(0, 0), vec(4, 0), vec(4, 2), vec(0, 2)];
    const rect2: WallPolygon = [vec(4, 0), vec(8, 0), vec(8, 2), vec(4, 2)];

    const edges = buildWallEdges([rect1, rect2]);

    // The shared seam at x=4 is gone, top and bottom faces are merged into 8-long edges
    expect(edges).toHaveLength(4);

    const seamEdge = edges.find((e) => Math.abs(e.a.x - 4) < 1e-6 && Math.abs(e.b.x - 4) < 1e-6);
    expect(seamEdge).toBeUndefined();

    const topEdge = edges.find((e) => Math.abs(e.normal.y - -1) < 1e-6);
    const bottomEdge = edges.find((e) => Math.abs(e.normal.y - 1) < 1e-6);

    expect(topEdge).toBeDefined();
    expect(bottomEdge).toBeDefined();

    if (topEdge && bottomEdge) {
      expect(distance(topEdge.a, topEdge.b)).toBeCloseTo(8);
      expect(distance(bottomEdge.a, bottomEdge.b)).toBeCloseTo(8);

      // The seam ends at x=4 are inside the edge, not edge endpoints
      expect([topEdge.a.x, topEdge.b.x].sort((a, b) => a - b)).toEqual([0, 8]);
      expect([bottomEdge.a.x, bottomEdge.b.x].sort((a, b) => a - b)).toEqual([0, 8]);

      // Edge endpoints at the exterior boundaries are outside corners
      expect(topEdge.cornerAtA).toBe(true);
      expect(topEdge.cornerAtB).toBe(true);
      expect(bottomEdge.cornerAtA).toBe(true);
      expect(bottomEdge.cornerAtB).toBe(true);
    }
  });

  it('identifies inside corners as non-corners on an L-shaped wall', () => {
    // L-shape: vertical arm [0,2] x [0,6] and horizontal arm [2,6] x [0,2]
    const rectVertical: WallPolygon = [vec(0, 0), vec(2, 0), vec(2, 6), vec(0, 6)];
    const rectHorizontal: WallPolygon = [vec(2, 0), vec(6, 0), vec(6, 2), vec(2, 2)];

    const edges = buildWallEdges([rectVertical, rectHorizontal]);

    // Find edges meeting at the inside corner (2, 2)
    const atInsideCorner = edges.filter((e) => touchesPoint(e, 2, 2));

    expect(atInsideCorner).toHaveLength(2);
    for (const edge of atInsideCorner) {
      if (Math.abs(edge.a.x - 2) < 1e-6 && Math.abs(edge.a.y - 2) < 1e-6) {
        expect(edge.cornerAtA).toBe(false);
      }
      if (Math.abs(edge.b.x - 2) < 1e-6 && Math.abs(edge.b.y - 2) < 1e-6) {
        expect(edge.cornerAtB).toBe(false);
      }
    }

    // Outside corners like (6, 0) and (6, 2) must still be corners
    const atOutsideCorner = edges.filter((e) => touchesPoint(e, 6, 2));
    expect(atOutsideCorner.length).toBeGreaterThan(0);
    for (const edge of atOutsideCorner) {
      if (Math.abs(edge.a.x - 6) < 1e-6 && Math.abs(edge.a.y - 2) < 1e-6) {
        expect(edge.cornerAtA).toBe(true);
      }
      if (Math.abs(edge.b.x - 6) < 1e-6 && Math.abs(edge.b.y - 2) < 1e-6) {
        expect(edge.cornerAtB).toBe(true);
      }
    }
  });

  it('splits a 6-long edge around a partially overlapping 2-long edge', () => {
    // Rect 1: [0, 6] x [0, 2] (bottom edge at y=2 spans [0, 6])
    // Rect 2: [2, 4] x [2, 4] (top edge at y=2 spans [2, 4])
    const rect1: WallPolygon = [vec(0, 0), vec(6, 0), vec(6, 2), vec(0, 2)];
    const rect2: WallPolygon = [vec(2, 2), vec(4, 2), vec(4, 4), vec(2, 4)];

    const edges = buildWallEdges([rect1, rect2]);

    // The shared stretch at y=2, x in [2, 4] is removed.
    // Rect 1's bottom edge should split into two segments: [0, 2] and [4, 6] with normal (0, 1).
    const bottomFaces = edges.filter(
      (e) =>
        Math.abs(e.normal.x) < 1e-6 &&
        Math.abs(e.normal.y - 1) < 1e-6 &&
        Math.abs(e.a.y - 2) < 1e-6 &&
        Math.abs(e.b.y - 2) < 1e-6,
    );

    expect(bottomFaces).toHaveLength(2);
    const lengths = bottomFaces.map((e) => distance(e.a, e.b)).sort((a, b) => a - b);
    expect(lengths[0]).toBeCloseTo(2);
    expect(lengths[1]).toBeCloseTo(2);
  });

  it('computes 4 diagonal normals with all ends as outside corners for a diamond bumper', () => {
    const diamond: WallPolygon = [vec(1, 0), vec(2, 1), vec(1, 2), vec(0, 1)];
    const edges = buildWallEdges([diamond]);

    expect(edges).toHaveLength(4);
    for (const edge of edges) {
      expect(edge.cornerAtA).toBe(true);
      expect(edge.cornerAtB).toBe(true);
      expect(Math.abs(edge.normal.x)).toBeCloseTo(Math.SQRT1_2);
      expect(Math.abs(edge.normal.y)).toBeCloseTo(Math.SQRT1_2);
    }
  });

  it('traces a straight line with no hits when there are no walls', () => {
    const res = traceShot(vec(0, 0), vec(1, 0), 10, [], { bounce: true });

    expect(res.hits).toHaveLength(0);
    expect(res.points).toEqual([vec(0, 0), vec(10, 0)]);
    expect(res.end).toEqual(vec(10, 0));
    expect(res.direction.x).toBeCloseTo(1);
    expect(res.direction.y).toBeCloseTo(0);
    expect(res.stopped).toBe(false);
  });

  it('traces into a vertical face at 45 degrees, reflects, and finishes remaining distance', () => {
    // Wall rectangle from x=10 to x=12, y in [0, 20]
    const wall: WallPolygon = [vec(10, 0), vec(12, 0), vec(12, 20), vec(10, 20)];
    const edges = buildWallEdges([wall]);

    // Shell starts at (0, 5) heading 45° down and right
    const dir = vec(1, 1);
    const hitDist = 10 * Math.SQRT2;
    const remaining = 5;
    const totalDist = hitDist + remaining;

    const res = traceShot(vec(0, 5), dir, totalDist, edges, { bounce: true });

    expect(res.hits).toHaveLength(1);
    const hit = res.hits[0];
    expect(hit).toBeDefined();
    if (hit) {
      expect(hit.kind).toBe('face');
      expect(hit.at.x).toBeCloseTo(10);
      expect(hit.at.y).toBeCloseTo(15);
      expect(hit.distance).toBeCloseTo(hitDist);
      expect(hit.normal.x).toBeCloseTo(-1);
      expect(hit.normal.y).toBeCloseTo(0);
    }

    // Direction reflects from (1/√2, 1/√2) off normal (-1, 0) to (-1/√2, 1/√2)
    expect(res.direction.x).toBeCloseTo(-Math.SQRT1_2);
    expect(res.direction.y).toBeCloseTo(Math.SQRT1_2);

    expect(res.end.x).toBeCloseTo(10 - remaining * Math.SQRT1_2);
    expect(res.end.y).toBeCloseTo(15 + remaining * Math.SQRT1_2);
    expect(res.stopped).toBe(false);
  });

  it('traces into a box from inside with several bounces conserving path length', () => {
    // 4 enclosing walls forming a 20x20 arena
    const top: WallPolygon = [vec(0, -2), vec(20, -2), vec(20, 0), vec(0, 0)];
    const bottom: WallPolygon = [vec(0, 20), vec(20, 20), vec(20, 22), vec(0, 22)];
    const left: WallPolygon = [vec(-2, 0), vec(0, 0), vec(0, 20), vec(-2, 20)];
    const right: WallPolygon = [vec(20, 0), vec(22, 0), vec(22, 20), vec(20, 20)];

    const edges = buildWallEdges([top, bottom, left, right]);

    const totalDist = 65;
    const res = traceShot(vec(10, 10), vec(3, 4), totalDist, edges, { bounce: true });

    expect(res.hits.length).toBeGreaterThanOrEqual(3);
    expect(res.stopped).toBe(false);

    // Path length of all consecutive segments equals totalDist
    let pathLen = 0;
    for (let i = 0; i < res.points.length - 1; i++) {
      const p1 = res.points[i];
      const p2 = res.points[i + 1];
      if (p1 && p2) {
        pathLen += distance(p1, p2);
      }
    }
    expect(pathLen).toBeCloseTo(totalDist, 4);

    // Every hit is located on one of the inner arena boundaries [0, 20]
    for (const hit of res.hits) {
      const onX = Math.abs(hit.at.x - 0) < 1e-4 || Math.abs(hit.at.x - 20) < 1e-4;
      const onY = Math.abs(hit.at.y - 0) < 1e-4 || Math.abs(hit.at.y - 20) < 1e-4;
      expect(onX || onY).toBe(true);
    }
  });

  it('reverses direction upon hitting an outside corner of a block', () => {
    const block: WallPolygon = [vec(10, 10), vec(20, 10), vec(20, 20), vec(10, 20)];
    const edges = buildWallEdges([block]);

    // Start at (0, 0) aiming directly at outside corner (10, 10)
    const distToCorner = 10 * Math.SQRT2;
    const totalDist = distToCorner + 5 * Math.SQRT2;

    const res = traceShot(vec(0, 0), vec(1, 1), totalDist, edges, { bounce: true });

    expect(res.hits).toHaveLength(1);
    const hit = res.hits[0];
    expect(hit).toBeDefined();
    if (hit) {
      expect(hit.kind).toBe('corner');
      expect(hit.at.x).toBeCloseTo(10);
      expect(hit.at.y).toBeCloseTo(10);
    }

    // Shell bounces straight back along its path
    expect(res.direction.x).toBeCloseTo(-Math.SQRT1_2);
    expect(res.direction.y).toBeCloseTo(-Math.SQRT1_2);
    expect(res.end.x).toBeCloseTo(5);
    expect(res.end.y).toBeCloseTo(5);
  });

  it('reverses direction upon hitting an inside corner of an arena at 45 degrees', () => {
    // Arena enclosing walls touching at top-left (0, 0)
    const top: WallPolygon = [vec(0, -2), vec(20, -2), vec(20, 0), vec(0, 0)];
    const left: WallPolygon = [vec(-2, 0), vec(0, 0), vec(0, 20), vec(-2, 20)];
    const edges = buildWallEdges([top, left]);

    // Fired from (5, 5) directly towards (0, 0)
    const distToCorner = 5 * Math.SQRT2;
    const totalDist = distToCorner + 3 * Math.SQRT2;

    const res = traceShot(vec(5, 5), vec(-1, -1), totalDist, edges, { bounce: true });

    // Whether treated as a simultaneous corner hit or quick double-reflection,
    // the final direction is reversed.
    expect(res.direction.x).toBeCloseTo(Math.SQRT1_2);
    expect(res.direction.y).toBeCloseTo(Math.SQRT1_2);
    expect(res.end.x).toBeCloseTo(3);
    expect(res.end.y).toBeCloseTo(3);
  });

  it('stops at the first wall when bounce is false, and stops at maxHits in a tiny box', () => {
    const wall: WallPolygon = [vec(10, 0), vec(12, 0), vec(12, 20), vec(10, 20)];
    const edges = buildWallEdges([wall]);

    // bounce: false stops at wall
    const stoppedRes = traceShot(vec(0, 10), vec(1, 0), 20, edges, { bounce: false });
    expect(stoppedRes.stopped).toBe(true);
    expect(stoppedRes.hits).toHaveLength(1);
    expect(stoppedRes.end.x).toBeCloseTo(10);
    expect(stoppedRes.end.y).toBeCloseTo(10);

    // Build a 2x2 room from four wall rectangles surrounding [0, 2] x [0, 2]
    const roomLeft: WallPolygon = [vec(-1, -1), vec(0, -1), vec(0, 3), vec(-1, 3)];
    const roomRight: WallPolygon = [vec(2, -1), vec(3, -1), vec(3, 3), vec(2, 3)];
    const roomTop: WallPolygon = [vec(0, -1), vec(2, -1), vec(2, 0), vec(0, 0)];
    const roomBottom: WallPolygon = [vec(0, 2), vec(2, 2), vec(2, 3), vec(0, 3)];

    const boxEdges = buildWallEdges([roomLeft, roomRight, roomTop, roomBottom]);
    const maxHitsRes = traceShot(vec(1, 1), vec(1, 0.37), 100, boxEdges, {
      bounce: true,
      maxHits: 5,
    });
    expect(maxHitsRes.stopped).toBe(true);
    expect(maxHitsRes.hits).toHaveLength(5);
  });

  it('tests circle collisions for segmentHitsCircle and pathHitsCircle', () => {
    const center = vec(10, 10);
    const radius = 2;

    // Miss
    expect(segmentHitsCircle(vec(0, 0), vec(5, 0), center, radius)).toBeNull();

    // Tangent: passes through (10, 8) at t=0.5
    const tangentT = segmentHitsCircle(vec(0, 8), vec(20, 8), center, radius);
    expect(tangentT).not.toBeNull();
    if (tangentT !== null) {
      expect(tangentT).toBeCloseTo(0.5);
    }

    // Through: intersects at (8, 10) at t=0.4
    const throughT = segmentHitsCircle(vec(0, 10), vec(20, 10), center, radius);
    expect(throughT).not.toBeNull();
    if (throughT !== null) {
      expect(throughT).toBeCloseTo(0.4);
    }

    // Starting inside returns 0
    expect(segmentHitsCircle(vec(10, 10), vec(20, 10), center, radius)).toBe(0);

    // Zero-length segment inside returns 0, outside returns null
    expect(segmentHitsCircle(vec(10, 11), vec(10, 11), center, radius)).toBe(0);
    expect(segmentHitsCircle(vec(0, 0), vec(0, 0), center, radius)).toBeNull();

    // pathHitsCircle on a bent path finds contact on second segment
    const bentPath = [vec(0, 0), vec(0, 10), vec(20, 10)];
    const contact = pathHitsCircle(bentPath, center, radius);
    expect(contact).not.toBeNull();
    if (contact) {
      // First segment (0,0)->(0,10) length is 10; second segment hits at (8, 10) (distance 8)
      expect(contact.distance).toBeCloseTo(18);
      expect(contact.at.x).toBeCloseTo(8);
      expect(contact.at.y).toBeCloseTo(10);
    }
  });

  it('checks line of sight with segmentBlocked', () => {
    const wall: WallPolygon = [vec(5, 0), vec(6, 0), vec(6, 10), vec(5, 10)];
    const edges = buildWallEdges([wall]);

    // Segment passing completely through the wall
    expect(segmentBlocked(vec(0, 5), vec(10, 5), edges)).toBe(true);

    // Segment entirely on one side without reaching the wall
    expect(segmentBlocked(vec(0, 5), vec(3, 5), edges)).toBe(false);

    // Segment ending exactly on the wall face
    expect(segmentBlocked(vec(0, 5), vec(5, 5), edges)).toBe(true);
  });
});
