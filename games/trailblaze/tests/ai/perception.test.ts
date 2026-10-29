/**
 * Tests for a Kid's perception of the Trailblaze arena: Chebyshev awareness
 * radius, wraparound across borders vs stopped in bordered arenas, and ray
 * lengths and believed space respecting what the Kid can see (walls beyond
 * the radius are invisible).
 */
import { describe, expect, it } from 'vitest';
import { believedSpace, chebyshevDistance, perceive, rayLength } from '../../src/ai/perception.ts';
import { cellAt } from '../../src/engine/grid.ts';
import { CARTRIDGE_TARGET, createMatch, startMatch } from '../../src/engine/match.ts';
import { variationRules } from '../../src/engine/variations.ts';

function createBorderedMatch() {
  const match = createMatch({
    rules: variationRules(1),
    players: 2,
    switches: ['B', 'B'],
    target: CARTRIDGE_TARGET,
  });
  startMatch(match);
  return match;
}

function createWraparoundMatch() {
  const match = createMatch({
    rules: variationRules(8),
    players: 2,
    switches: ['B', 'B'],
    target: CARTRIDGE_TARGET,
  });
  startMatch(match);
  return match;
}

describe('perception', () => {
  describe('chebyshevDistance', () => {
    it('computes max(dx, dy) without wrap in bordered arenas', () => {
      const a = cellAt(5, 5);
      const b = cellAt(8, 1);
      // dx = 3, dy = 4 -> max is 4
      expect(chebyshevDistance(a, b, false)).toBe(4);
    });

    it('wraps horizontal and vertical distances across arena edges when wraparound is true', () => {
      const leftEdge = cellAt(1, 10);
      const rightEdge = cellAt(39, 10);
      // Horizontal span is 38 cells direct, but wraps to 2 cells across the edge
      expect(chebyshevDistance(leftEdge, rightEdge, false)).toBe(38);
      expect(chebyshevDistance(leftEdge, rightEdge, true)).toBe(2);

      const topEdge = cellAt(10, 1);
      const bottomEdge = cellAt(10, 19);
      // Vertical span is 18 cells direct, wraps to 2 cells across the edge
      expect(chebyshevDistance(topEdge, bottomEdge, false)).toBe(18);
      expect(chebyshevDistance(topEdge, bottomEdge, true)).toBe(2);
    });
  });

  describe('perceive', () => {
    it('cells inside the radius are seen as they are, cells outside are seen as empty', () => {
      const match = createBorderedMatch();
      const head = cellAt(10, 10);

      // Place trail blocks at Chebyshev distance 2 and 5 from head
      const nearTrail = cellAt(12, 10); // dist = 2
      const farTrail = cellAt(15, 10); // dist = 5
      match.cells[nearTrail] = 0;
      match.cells[farTrail] = 1;

      // Outer border wall is at row 0, col 10 (dist = 10 from head)
      const borderCell = cellAt(10, 0);

      const view = perceive(match, head, 3);

      // Inside radius (3):
      expect(view.blocked(nearTrail)).toBe(true);
      expect(view.blocked(cellAt(11, 10))).toBe(false);

      // Outside radius (3):
      expect(view.blocked(farTrail)).toBe(false);
      expect(view.blocked(borderCell)).toBe(false);
    });

    it('the radius wraps in a wraparound arena and not in a bordered one', () => {
      const wrapMatch = createWraparoundMatch();
      const borderedMatch = createBorderedMatch();

      const head = cellAt(1, 10);
      const acrossEdge = cellAt(39, 10);

      wrapMatch.cells[acrossEdge] = 0;
      borderedMatch.cells[acrossEdge] = 0;

      // With radius 2, acrossEdge is at distance 2 under wraparound, but distance 38 in bordered
      const wrapView = perceive(wrapMatch, head, 2);
      expect(wrapView.blocked(acrossEdge)).toBe(true);

      const borderedView = perceive(borderedMatch, head, 2);
      expect(borderedView.blocked(acrossEdge)).toBe(false);
    });
  });

  describe('rayLength and believedSpace', () => {
    it('rayLength and believedSpace respect the perception (a wall beyond the radius is invisible)', () => {
      const match = createBorderedMatch();
      const head = cellAt(10, 10);

      // Place a trail wall 5 cells east of head
      const wallCell = cellAt(15, 10);
      match.cells[wallCell] = 0;

      // With radius 3, wallCell is outside awareness (dist 5 > 3) and perceived as open
      const shortView = perceive(match, head, 3);
      const shortRay = rayLength(match, shortView, head, 'right', 8);
      // Ray passes straight through the invisible wall
      expect(shortRay).toBe(8);

      // With radius 6, wallCell is inside awareness (dist 5 <= 6) and seen as blocked
      const longView = perceive(match, head, 6);
      const longRay = rayLength(match, longView, head, 'right', 8);
      // Ray stops before the wall: cells 11, 12, 13, 14 are free -> 4
      expect(longRay).toBe(4);

      // Test believedSpace with an enclosing room around (10, 10)
      // Build walls on rows 6 and 14 from col 6 to 14, and cols 6 and 14 from row 6 to 14.
      // Interior is 7x7 cells (rows 7..13, cols 7..13) = 49 cells total.
      // Standing on (10, 10), reachable interior cells without walls is 48.
      const roomMatch = createBorderedMatch();
      for (let c = 6; c <= 14; c++) {
        roomMatch.cells[cellAt(c, 6)] = 0;
        roomMatch.cells[cellAt(c, 14)] = 0;
      }
      for (let r = 6; r <= 14; r++) {
        roomMatch.cells[cellAt(6, r)] = 0;
        roomMatch.cells[cellAt(14, r)] = 0;
      }

      // Radius 2: the walls at distance 4 are invisible, so flood escapes the room
      const narrowPerception = perceive(roomMatch, head, 2);
      const escapedSpace = believedSpace(roomMatch, narrowPerception, head, 150);
      expect(escapedSpace).toBe(150);

      // Radius 5: the walls at distance 4 are seen, so flood is contained in the 7x7 room
      const widePerception = perceive(roomMatch, head, 5);
      const trappedSpace = believedSpace(roomMatch, widePerception, head, 150);
      expect(trappedSpace).toBe(48);
    });
  });
});
