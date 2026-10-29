/**
 * Tests for Trailblaze's 1977 computer opponent: difficulty-switch lookahead,
 * four-ray counting in bordered and wraparound arenas, the all-blocked right
 * fallthrough, the uncapped best-distance quirk, the 64-tick alternating
 * tie-breaker, the diagonal stair-step across open space, luring the pilot
 * into a deep dead-end corridor, and a 200-step obstacle-avoidance invariant
 * against an idle rival.
 */
import { describe, expect, it } from 'vitest';
import {
  computerDecision,
  createComputer1977,
  lookaheadFor,
  type CardinalHeading,
} from '../../src/ai/computer-1977.ts';
import { cellAt, stepFrom } from '../../src/engine/grid.ts';
import {
  CARTRIDGE_TARGET,
  FIRST_STEP_PERIOD,
  createMatch,
  startMatch,
  stepMatch,
} from '../../src/engine/match.ts';
import {
  COLUMNS,
  EMPTY,
  IDLE,
  ROWS,
  type Match,
  type Rider,
  type Seat,
} from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import { runTicks } from '../engine/helpers/drivers.ts';

function rider(match: Readonly<Match>, seat: number): Rider {
  const item = match.riders[seat];
  if (!item) throw new Error(`Missing rider for seat ${seat}`);
  return item;
}

function setupBoard(variationNumber: number, seat: Seat = 0): Match {
  const match = createMatch({
    rules: variationRules(variationNumber),
    players: 2,
    switches: ['B', 'B'],
    target: CARTRIDGE_TARGET,
  });
  startMatch(match);
  rider(match, seat).cell = cellAt(10, 10);
  return match;
}

describe('computer-1977', () => {
  describe('lookaheadFor', () => {
    it('returns 3 cells on switch B and 6 cells on switch A', () => {
      expect(lookaheadFor('B')).toBe(3);
      expect(lookaheadFor('A')).toBe(6);
    });
  });

  describe('ray counting', () => {
    it('counts empty cells along all four cardinal directions and stops at trails or the border wall', () => {
      const match = setupBoard(2);
      // At (10, 10) on a bordered 40x20 grid:
      // - row 0 and row 19 are border walls, so up has rows 9..1 (9 empty cells)
      //   and down has rows 11..18 (8 empty cells).
      // - col 0 and col 39 are border walls, so left has cols 9..1 (9 empty cells)
      //   and right has cols 11..38 (28 empty cells).
      const openDecision = computerDecision(match, 0, 6);
      expect(openDecision.rays).toEqual({
        up: 9,
        down: 8,
        left: 9,
        right: 28,
      });

      // Place trail blocks at specific distances around (10, 10):
      // up blocked at (10, 8) -> 1 empty cell at (10, 9)
      // down blocked at (10, 14) -> 3 empty cells at rows 11, 12, 13
      // left blocked at (5, 10) -> 4 empty cells at cols 9, 8, 7, 6
      // right left unblocked -> stopped by the right border at col 39 (28 empty cells)
      match.cells[cellAt(10, 8)] = 0;
      match.cells[cellAt(10, 14)] = 1;
      match.cells[cellAt(5, 10)] = 0;
      // Putting a trail on the rider's own cell does not affect outward rays.
      match.cells[cellAt(10, 10)] = 0;

      const blockedDecision = computerDecision(match, 0, 6);
      expect(blockedDecision.rays).toEqual({
        up: 1,
        down: 3,
        left: 4,
        right: 28,
      });
    });

    it('wraps rays across edges in wraparound variations and caps unblocked rays at one full lap', () => {
      const match = setupBoard(8);
      // In variation 8 (wraparound), the entire 40x20 board starts empty.
      // An unblocked ray wraps around and stops after at most one full lap
      // (ROWS = 20 vertically, COLUMNS = 40 horizontally).
      const unblocked = computerDecision(match, 0, 6);
      expect(unblocked.rays).toEqual({
        up: ROWS,
        down: ROWS,
        left: COLUMNS,
        right: COLUMNS,
      });

      // Place the rider near the top-left at (2, 1):
      // - Up wraps past row 0 to row 19; block at (2, 17) leaves (2, 0), (2, 19), (2, 18) = 3 empty cells.
      // - Left wraps past col 0 to col 39; block at (37, 1) leaves (1, 1), (0, 1), (39, 1), (38, 1) = 4 empty cells.
      rider(match, 0).cell = cellAt(2, 1);
      match.cells[cellAt(2, 17)] = 1;
      match.cells[cellAt(37, 1)] = 0;

      const wrapped = computerDecision(match, 0, 6);
      expect(wrapped.rays.up).toBe(3);
      expect(wrapped.rays.left).toBe(4);
    });
  });

  describe('all rays blocked at 0', () => {
    it('falls through every 0 >= 0 sub-lookahead comparison and ends on right regardless of tick', () => {
      const match = setupBoard(2);
      match.cells[cellAt(10, 9)] = 0;
      match.cells[cellAt(10, 11)] = 0;
      match.cells[cellAt(9, 10)] = 1;
      match.cells[cellAt(11, 10)] = 1;

      for (const tick of [0, 64]) {
        match.tick = tick;
        const decision = computerDecision(match, 0, 3);
        expect(decision.rays).toEqual({ up: 0, down: 0, left: 0, right: 0 });
        expect(decision.best).toBe(0);
        expect(decision.heading).toBe('right');
      }
    });
  });

  describe('hook 1: uncapped best-distance store', () => {
    it('stores down = 15 uncapped when up = 1, preventing left or right (< 15) from beating down at both lookaheads', () => {
      for (const lookahead of [3, 6] as const) {
        const match = setupBoard(2);
        // Set tick = 0 (tiesGoLate = true) so that if down were capped to 3 or 6,
        // a left ray of 8 or right ray of 14 would have beaten it.
        match.tick = 0;

        // Move rider to (10, 2); row 0 is border so up has 1 empty cell at (10, 1).
        rider(match, 0).cell = cellAt(10, 2);
        // Down = 15: block at (10, 18) so rows 3..17 are 15 empty cells.
        match.cells[cellAt(10, 18)] = 0;
        // Left = 8: block at (1, 2) so cols 9..2 are 8 empty cells (clear of both 3 and 6, but < 15).
        match.cells[cellAt(1, 2)] = 0;
        // Right = 14: block at (25, 2) so cols 11..24 are 14 empty cells (also clear of 3 and 6, but < 15).
        match.cells[cellAt(25, 2)] = 0;

        const decision = computerDecision(match, 0, lookahead);
        expect(decision.rays).toEqual({
          up: 1,
          down: 15,
          left: 8,
          right: 14,
        });
        expect(decision.best).toBe(15);
        expect(decision.heading).toBe('down');
      }
    });

    it('stores left = 12 uncapped when up and down are short, blocking right = 11 from winning at both lookaheads', () => {
      for (const lookahead of [3, 6] as const) {
        const match = setupBoard(2);
        match.tick = 0;

        rider(match, 0).cell = cellAt(15, 10);
        // Up = 2: block at (15, 7)
        match.cells[cellAt(15, 7)] = 0;
        // Down = 1: block at (15, 12)
        match.cells[cellAt(15, 12)] = 0;
        // Left = 12: block at (2, 10) -> cols 14..3 are 12 empty cells
        match.cells[cellAt(2, 10)] = 0;
        // Right = 11: block at (27, 10) -> cols 16..26 are 11 empty cells
        match.cells[cellAt(27, 10)] = 0;

        const decision = computerDecision(match, 0, lookahead);
        expect(decision.rays).toEqual({
          up: 2,
          down: 1,
          left: 12,
          right: 11,
        });
        expect(decision.best).toBe(12);
        expect(decision.heading).toBe('left');
      }
    });
  });

  describe('64-tick periodic tie-breaker', () => {
    it('favours the later ray when bit 6 of tick is 0 and the earlier ray when bit 6 of tick is 1', () => {
      const match = setupBoard(2);

      // First half of 128-tick cycle (ticks 0..63, bit 6 = 0): ties go late -> right wins on an open board.
      for (const tick of [0, 15, 63, 128, 191]) {
        match.tick = tick;
        const late = computerDecision(match, 0, 3);
        expect(late.tiesGoLate).toBe(true);
        expect(late.best).toBe(3);
        expect(late.heading).toBe('right');
      }

      // Second half of 128-tick cycle (ticks 64..127, bit 6 = 1): ties go early -> up wins on an open board.
      for (const tick of [64, 75, 127, 192, 255]) {
        match.tick = tick;
        const early = computerDecision(match, 0, 3);
        expect(early.tiesGoLate).toBe(false);
        expect(early.best).toBe(3);
        expect(early.heading).toBe('up');
      }
    });
  });

  describe('stair-step across open space', () => {
    it('alternates multi-step runs of right and up over 60 steps when riding solo in variation 2', () => {
      const match = createMatch({
        rules: variationRules(2),
        players: 1,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
        pilots: [createComputer1977(3), null],
      });
      startMatch(match);

      // Place seat 0 near the bottom-left at (2, 18) in variation 2 so it can
      // stair-step diagonally up-and-right across the open arena without
      // touching its own trail, and wrap its coordinates back to (2, 18) with
      // a fresh interior whenever it finishes a diagonal traverse.
      rider(match, 0).cell = cellAt(2, 18);
      const headings: CardinalHeading[] = [];
      for (let step = 0; step < 60; step++) {
        runTicks(match, FIRST_STEP_PERIOD);
        headings.push(rider(match, 0).heading as CardinalHeading);
        if (step % 20 === 19) {
          for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLUMNS - 1; c++) {
              match.cells[cellAt(c, r)] = EMPTY;
            }
          }
          rider(match, 0).cell = cellAt(2, 18);
        }
      }

      // Partition into contiguous runs of identical headings.
      const runs: { heading: CardinalHeading; length: number }[] = [];
      for (const h of headings) {
        const last = runs[runs.length - 1];
        if (last?.heading === h) {
          last.length += 1;
        } else {
          runs.push({ heading: h, length: 1 });
        }
      }

      const rightRuns = runs.filter((r) => r.heading === 'right');
      const upRuns = runs.filter((r) => r.heading === 'up');

      // Every completed 64-tick half-cycle at a 15-tick step period spans 4 or 5
      // consecutive steps (step 60 at tick 900 is the first step of the 15th run).
      expect(runs.length).toBeGreaterThanOrEqual(12);
      expect(rightRuns.length).toBeGreaterThanOrEqual(6);
      expect(upRuns.length).toBeGreaterThanOrEqual(6);
      expect(runs.slice(0, -1).every((r) => r.length >= 4)).toBe(true);
      expect(runs.every((r) => r.heading === 'right' || r.heading === 'up')).toBe(true);
    });
  });

  describe('dead-end corridor trap', () => {
    it('turns into a closed corridor of length lookahead + 2 and crashes at the end', () => {
      for (const [switchPos, lookahead] of [
        ['B', 3],
        ['A', 6],
      ] as const) {
        const match = createMatch({
          rules: variationRules(2),
          players: 1,
          switches: [switchPos, 'B'],
          target: CARTRIDGE_TARGET,
          pilots: [createComputer1977(lookahead), null],
        });
        startMatch(match);

        // Place seat 0 at (10, 15) riding right, facing a wall at (11, 15),
        // below at (10, 16), and behind at (9, 15), with a 1-cell-wide vertical
        // corridor going UP from (10, 15) of exact length `lookahead + 2`.
        const startRow = 15;
        const depth = lookahead + 2;
        rider(match, 0).cell = cellAt(10, startRow);
        rider(match, 0).heading = 'right';

        // Block left, right, and down from (10, 15) so the only open ray at the entrance is up.
        match.cells[cellAt(9, startRow)] = 0;
        match.cells[cellAt(11, startRow)] = 1;
        match.cells[cellAt(10, startRow + 1)] = 1;

        // Build the side walls of the upward corridor along columns 9 and 11,
        // and cap the corridor at row `startRow - depth - 1`.
        for (let d = 1; d <= depth; d++) {
          const r = startRow - d;
          match.cells[cellAt(9, r)] = 1;
          match.cells[cellAt(11, r)] = 1;
        }
        match.cells[cellAt(10, startRow - depth - 1)] = 1;

        // Because the corridor has `depth = lookahead + 2` empty cells, at (10, 15)
        // the up ray sees `lookahead + 2 >= lookahead` free cells and turns up into the trap.
        // Once inside, up remains the only open direction until the rider reaches the end cap,
        // where all four rays are 0 (all-blocked) and the next step crashes into a wall.
        let stepsTaken = 0;
        while (match.phase === 'running' && stepsTaken < depth + 5) {
          runTicks(match, FIRST_STEP_PERIOD);
          stepsTaken += 1;
        }

        expect(match.phase).toBe('over');
        expect(rider(match, 0).crashed).toBe(true);
        expect(stepsTaken).toBe(depth + 1);
      }
    });
  });

  describe('200-step obstacle avoidance against an idle seat 1', () => {
    it('never steers into an immediately blocked cell while another non-reverse ray is open across 200 steps in variation 2', () => {
      const lookahead = 3;
      const pilot = createComputer1977(lookahead);
      const match = createMatch({
        rules: variationRules(2),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
        pilots: [pilot, null],
      });
      startMatch(match);

      let stepsChecked = 0;
      let guardTicks = 0;

      while (stepsChecked < 200 && guardTicks < 20000) {
        guardTicks += 1;
        if (match.phase === 'over') {
          startMatch(match);
        }

        const isStepTick = match.phase === 'running' && match.untilStep === 1;
        if (isStepTick) {
          // Simulate the board state at the instant the pilot is queried (after both seats lay trail).
          const cell0 = rider(match, 0).cell;
          const cell1 = rider(match, 1).cell;
          const prev0 = match.cells[cell0] ?? EMPTY;
          const prev1 = match.cells[cell1] ?? EMPTY;
          match.cells[cell0] = 0;
          match.cells[cell1] = 1;
          match.tick += 1;

          const decision = computerDecision(match, 0, lookahead);

          match.tick -= 1;
          match.cells[cell0] = prev0;
          match.cells[cell1] = prev1;

          const chosenDistance = decision.rays[decision.heading];
          const maxRay = Math.max(
            decision.rays.up,
            decision.rays.down,
            decision.rays.left,
            decision.rays.right,
          );

          // Whenever at least one ray has > 0 empty cells, the computer must never pick a ray of length 0.
          if (maxRay > 0) {
            expect(chosenDistance).toBeGreaterThan(0);
            const nextCell = stepFrom(cell0, decision.heading).cell;
            expect(match.cells[nextCell]).toBe(EMPTY);
          }

          stepsChecked += 1;
        }

        stepMatch(match, [IDLE, IDLE]);
      }

      expect(stepsChecked).toBe(200);
    });
  });
});
