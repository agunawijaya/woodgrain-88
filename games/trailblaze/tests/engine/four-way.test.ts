/**
 * Tests for Four Way match engine:
 * - Starting positions and half-turn symmetry
 * - A crash leaves the other riders riding
 * - The last survivor scores and the round ends on that step
 * - Two last riders crashing together score nobody
 * - Target score ends the match immediately and freezes the board
 * - Winner with a tie at the top is null
 * - Shrinking walls crashing multiple riders at once
 */
import { describe, expect, it } from 'vitest';
import { FOUR_WAY_START, cellAt, columnOf, rowOf } from '../../src/engine/grid.ts';
import {
  CARTRIDGE_TARGET,
  CRASH_PAUSE_TICKS,
  FIRST_STEP_PERIOD,
  createMatch,
  startMatch,
  stepMatch,
} from '../../src/engine/match.ts';
import {
  BORDER,
  FOUR_WAY_SEATS,
  IDLE,
  type Match,
  type Rider,
  type Stick,
} from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import { runTicks } from './helpers/drivers.ts';

function stick(east: -1 | 0 | 1, south: -1 | 0 | 1, fire = false): Stick {
  return { east, south, fire };
}

function rider(match: Readonly<Match>, seat: number): Rider {
  const item = match.riders[seat];
  if (!item) throw new Error(`Missing rider for seat ${seat}`);
  return item;
}

function createFourWayMatch(target = CARTRIDGE_TARGET): Match {
  return createMatch({
    rules: variationRules(1),
    players: 4,
    switches: ['B', 'B', 'B', 'B'],
    target,
  });
}

describe('Four Way engine', () => {
  describe('starts and symmetry', () => {
    it('rule 1: sets up four riders at FOUR_WAY_START with half-turn symmetry', () => {
      expect(FOUR_WAY_START[0]).toEqual({ cell: cellAt(5, 4), heading: 'right' });
      expect(FOUR_WAY_START[1]).toEqual({ cell: cellAt(34, 15), heading: 'left' });
      expect(FOUR_WAY_START[2]).toEqual({ cell: cellAt(34, 4), heading: 'down' });
      expect(FOUR_WAY_START[3]).toEqual({ cell: cellAt(5, 15), heading: 'up' });

      // Half-turn symmetry check: (col, row) -> (39 - col, 19 - row)
      const h0 = FOUR_WAY_START[0];
      const h1 = FOUR_WAY_START[1];
      expect(39 - columnOf(h0.cell)).toBe(columnOf(h1.cell));
      expect(19 - rowOf(h0.cell)).toBe(rowOf(h1.cell));

      const h2 = FOUR_WAY_START[2];
      const h3 = FOUR_WAY_START[3];
      expect(39 - columnOf(h2.cell)).toBe(columnOf(h3.cell));
      expect(19 - rowOf(h2.cell)).toBe(rowOf(h3.cell));

      const match = createFourWayMatch();
      startMatch(match);

      expect(match.riders).toHaveLength(4);
      for (const seat of FOUR_WAY_SEATS) {
        expect(rider(match, seat).cell).toBe(FOUR_WAY_START[seat].cell);
        expect(rider(match, seat).heading).toBe(FOUR_WAY_START[seat].heading);
        expect(rider(match, seat).crashed).toBe(false);
        expect(rider(match, seat).score).toBe(0);
      }
    });
  });

  describe('crash and survival mechanics', () => {
    it('rule 3: a crash does not end the round while other riders are still riding', () => {
      const match = createFourWayMatch();
      startMatch(match);

      // Seat 0 heads into top border wall: turn up at step 1
      // Start of seat 0 is (5, 4). 3 steps up reaches row 1, 4th step reaches row 0 (border).
      runTicks(match, FIRST_STEP_PERIOD, [
        stick(0, -1), // seat 0 turns up
        IDLE,
        IDLE,
        IDLE,
      ]);
      expect(rider(match, 0).heading).toBe('up');

      // Run until seat 0 crashes into border row 0
      let crashHappened = false;
      for (let s = 0; s < 5; s++) {
        const stepEvents = runTicks(match, FIRST_STEP_PERIOD);
        for (const ev of stepEvents) {
          if (ev.type === 'crash' && ev.crashes.some((c) => c.seat === 0)) {
            crashHappened = true;
          }
        }
        if (crashHappened) break;
      }

      expect(crashHappened).toBe(true);
      expect(rider(match, 0).crashed).toBe(true);
      // Round is still running because seats 1, 2, 3 are alive
      expect(match.phase).toBe('running');

      // The other riders continue to step and move
      const prevCells = [1, 2, 3].map((s) => rider(match, s).cell);
      const crashedCell = rider(match, 0).cell;

      runTicks(match, FIRST_STEP_PERIOD);
      expect(rider(match, 0).cell).toBe(crashedCell); // Stopped where it was
      for (let i = 0; i < 3; i++) {
        const seat = (i + 1) as 1 | 2 | 3;
        expect(rider(match, seat).cell).not.toBe(prevCells[i]); // Advanced
      }
    });

    it('rule 3: the last lone survivor scores one point and the round ends on that step', () => {
      const match = createFourWayMatch();
      startMatch(match);

      // Seat 0 and Seat 1 already crashed earlier
      rider(match, 0).crashed = true;
      rider(match, 1).crashed = true;

      // Only seat 2 and seat 3 are riding. Seat 2 faces a wall directly ahead.
      const cell2 = rider(match, 2).cell;
      // Put a wall right below seat 2
      match.cells[cellAt(columnOf(cell2), rowOf(cell2) + 1)] = BORDER;

      // Seat 3 has open road ahead (heading up).
      const stepEvents = runTicks(match, FIRST_STEP_PERIOD);

      expect(rider(match, 2).crashed).toBe(true);
      expect(rider(match, 3).crashed).toBe(false);
      expect(rider(match, 3).score).toBe(1);

      // Crash event followed by point event for the survivor
      const crashIndex = stepEvents.findIndex((e) => e.type === 'crash');
      const pointIndex = stepEvents.findIndex((e) => e.type === 'point');
      expect(crashIndex).toBeGreaterThanOrEqual(0);
      expect(pointIndex).toBeGreaterThan(crashIndex);
      expect(stepEvents[pointIndex]).toEqual({ type: 'point', seat: 3, score: 1 });

      // Round ends with crash pause
      expect(match.phase).toBe('crash');
      expect(match.pauseTicks).toBe(CRASH_PAUSE_TICKS);
    });

    it('rule 3: two last riders crashing together score nobody and pause for a new round', () => {
      const match = createFourWayMatch();
      startMatch(match);

      rider(match, 2).crashed = true;
      rider(match, 3).crashed = true;

      // Seats 0 and 1 ride toward each other and hit head-on or swap cells
      rider(match, 0).cell = cellAt(20, 10);
      rider(match, 0).heading = 'right';
      rider(match, 1).cell = cellAt(21, 10);
      rider(match, 1).heading = 'left';

      const events = runTicks(match, FIRST_STEP_PERIOD);

      expect(rider(match, 0).crashed).toBe(true);
      expect(rider(match, 1).crashed).toBe(true);

      // Neither scores
      expect(rider(match, 0).score).toBe(0);
      expect(rider(match, 1).score).toBe(0);
      expect(events.some((e) => e.type === 'point')).toBe(false);

      expect(match.phase).toBe('crash');
      expect(match.pauseTicks).toBe(CRASH_PAUSE_TICKS);
    });
  });

  describe('target endings, winner resolution, and board freeze', () => {
    it('target score ends the match, determines winner, and freezes the board', () => {
      const match = createFourWayMatch(2); // Short match: first to 2
      startMatch(match);

      rider(match, 0).score = 0;
      rider(match, 1).score = 1;
      rider(match, 2).score = 1; // Seat 2 is at 1 point
      rider(match, 3).score = 0;

      // Crash seats 0 and 3
      rider(match, 0).crashed = true;
      rider(match, 3).crashed = true;

      // Put seat 1 into a wall so seat 2 is the lone survivor
      const cell1 = rider(match, 1).cell;
      match.cells[cellAt(columnOf(cell1) - 1, rowOf(cell1))] = BORDER;

      const events = runTicks(match, FIRST_STEP_PERIOD);

      expect(rider(match, 2).score).toBe(2);
      expect(match.phase).toBe('over');
      expect(match.pauseTicks).toBe(0);
      expect(match.winner).toBe(2);

      expect(events).toContainEqual({
        type: 'over',
        winner: 2,
        scores: [0, 1, 2, 0],
      });

      // Board is frozen: subsequent ticks return empty events and tick does not advance
      const tickAtOver = match.tick;
      const frozenEvents = stepMatch(match, [IDLE, IDLE, IDLE, IDLE]);
      expect(frozenEvents).toEqual([]);
      expect(match.tick).toBe(tickAtOver);
    });

    it('rule 5: winner is null on a tie at the top score when the match ends', () => {
      const match = createFourWayMatch(2);
      startMatch(match);

      // Seats 1 and 2 already at target score (e.g. from previous rounds), and match ends
      rider(match, 0).score = 0;
      rider(match, 1).score = 2;
      rider(match, 2).score = 2;
      rider(match, 3).score = 0;

      // Crash remaining riders
      rider(match, 0).crashed = true;
      rider(match, 3).crashed = true;

      // Mutual crash for seats 1 and 2
      rider(match, 1).cell = cellAt(20, 10);
      rider(match, 1).heading = 'right';
      rider(match, 2).cell = cellAt(21, 10);
      rider(match, 2).heading = 'left';

      const events = runTicks(match, FIRST_STEP_PERIOD);
      expect(match.phase).toBe('over');
      expect(match.winner).toBeNull();
      expect(events).toContainEqual({
        type: 'over',
        winner: null,
        scores: [0, 2, 2, 0],
      });
    });
  });

  describe('Remix interactions: shrinking arena crashing multiple riders', () => {
    it('rule 4: shrinking border crashes multiple riders simultaneously and respects rule 3', () => {
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { shrinkEvery: 10 },
        },
        players: 4,
        switches: ['B', 'B', 'B', 'B'],
        target: 10,
      });
      startMatch(match);

      // Place seats 0 and 2 on ring 1 (e.g. row 1)
      rider(match, 0).cell = cellAt(10, 1);
      rider(match, 2).cell = cellAt(25, 1);
      // Place seats 1 and 3 safely in interior (row 10)
      rider(match, 1).cell = cellAt(20, 10);
      rider(match, 3).cell = cellAt(15, 10);

      // Advance to tick 10 where ring 1 closes in
      const events = runTicks(match, 10);

      expect(rider(match, 0).crashed).toBe(true);
      expect(rider(match, 2).crashed).toBe(true);
      expect(rider(match, 1).crashed).toBe(false);
      expect(rider(match, 3).crashed).toBe(false);

      // 2 riders still riding, so round continues
      expect(match.phase).toBe('running');
      expect(events.some((e) => e.type === 'shrink')).toBe(true);
      expect(events.some((e) => e.type === 'crash')).toBe(true);
      expect(events.some((e) => e.type === 'point')).toBe(false);
    });
  });
});
