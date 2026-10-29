/**
 * Tests for Trailblaze's Remix rules in the match engine:
 *
 * 1. Fading Trails: trail cells vanish after fadeAfter ticks, appear in erased,
 *    and become traversable; border cells never fade.
 * 2. Shrinking Arena: concentric border rings close at multiples of shrinkEvery,
 *    emit shrink events with cells in index order, crush riders into the border,
 *    reset on new rounds, cap at LAST_RING (7), and are ignored in wraparound.
 * 3. Boost Lanes: riders on boost lanes step twice as often via half steps,
 *    emit correct Move.ticks for interpolation, emit no step event when no rider
 *    is on a lane, and score crashes at half steps like normal crashes.
 * 4. Unchanged guard: a match with remix: {} produces identical event logs to
 *    one without remix.
 */
import { describe, expect, it } from 'vitest';
import { START, cellAt, columnOf, isBorderCell, rowOf } from '../../../src/engine/grid.ts';
import {
  CARTRIDGE_TARGET,
  CRASH_PAUSE_TICKS,
  FIRST_STEP_PERIOD,
  createMatch,
  startMatch,
  stepMatch,
} from '../../../src/engine/match.ts';
import { LAST_RING, ringCells, ringOfCell } from '../../../src/engine/remix.ts';
import {
  BORDER,
  CELL_COUNT,
  COLUMNS,
  EMPTY,
  IDLE,
  ROWS,
  type Cell,
  type Match,
  type MatchEvent,
  type Rider,
  type Stick,
} from '../../../src/engine/types.ts';
import { variationRules } from '../../../src/engine/variations.ts';
import { createSeededStickStream, runTicks } from '../helpers/drivers.ts';

function stick(east: -1 | 0 | 1, south: -1 | 0 | 1, fire = false): Stick {
  return { east, south, fire };
}

function rider(match: Readonly<Match>, seat: number): Rider {
  const item = match.riders[seat];
  if (!item) throw new Error(`Missing rider for seat ${seat}`);
  return item;
}

describe('remix rules', () => {
  describe('Fading Trails (remix.fadeAfter)', () => {
    it('erases trail cells on the first step at or after fadeAfter ticks and lets riders pass through', () => {
      const fadeAfter = 100;
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { fadeAfter },
        },
        // Alone, so no crash of the other rider ends the round halfway through.
        players: 1,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Seat 0 starts at (10, 10) heading right.
      stepMatch(match, [IDLE, IDLE]);
      runTicks(match, FIRST_STEP_PERIOD - 1, [IDLE, IDLE]);

      // Step 1 at tick 15: seat 0 lays cell (10, 10) at tick 15 and moves to (11, 10).
      const startCellSeat0 = START[0].cell;
      expect(match.cells[startCellSeat0]).toBe(0);
      expect(match.laidAt[startCellSeat0]).toBe(FIRST_STEP_PERIOD);

      // Advance through step 7 at tick 105 (105 - 15 = 90 < 100: startCellSeat0 must not fade yet).
      const eventsBeforeFade = runTicks(match, 105 - FIRST_STEP_PERIOD, [IDLE, IDLE]);
      for (const ev of eventsBeforeFade) {
        if (ev.type === 'step') {
          expect(ev.erased).not.toContain(startCellSeat0);
        }
      }
      expect(match.cells[startCellSeat0]).toBe(0);

      // Step 8 at tick 120 (120 - 15 = 105 >= 100: startCellSeat0 must fade before anything is laid).
      const step8Events = runTicks(match, FIRST_STEP_PERIOD, [IDLE, IDLE]);
      const step8 = step8Events.find(
        (ev): ev is Extract<MatchEvent, { type: 'step' }> => ev.type === 'step',
      );
      expect(step8).toBeDefined();
      expect(step8?.erased).toContain(startCellSeat0);
      expect(match.cells[startCellSeat0]).toBe(EMPTY);
      expect(match.laidAt[startCellSeat0]).toBe(-1);

      // Verify border cells never fade even after many ticks.
      for (let c = 0; c < CELL_COUNT; c++) {
        if (isBorderCell(c)) {
          expect(match.cells[c]).toBe(BORDER);
          expect(match.laidAt[c]).toBe(-1);
          expect(step8?.erased).not.toContain(c);
        }
      }

      // Steer seat 0 down, left, and up so it can ride back through the faded cell (10, 10).
      // Seat 0 is currently at (18, 10). Step down to row 11, then left to col 10, then up to (10, 10).
      // Step down:
      runTicks(match, FIRST_STEP_PERIOD, [stick(0, 1), IDLE]);
      // Step left across columns 17 down to 10:
      for (let col = 17; col >= 10; col--) {
        runTicks(match, FIRST_STEP_PERIOD, [stick(-1, 0), IDLE]);
      }
      // Seat 0 is now at (10, 11), heading left. Steer up into (10, 10).
      const rideThroughEvents = runTicks(match, FIRST_STEP_PERIOD, [stick(0, -1), IDLE]);
      expect(rider(match, 0).cell).toBe(startCellSeat0);
      expect(rider(match, 0).crashed).toBe(false);
      expect(match.phase).toBe('running');
      expect(rideThroughEvents.filter((e) => e.type === 'crash')).toEqual([]);
    });
  });

  describe('Shrinking Arena (remix.shrinkEvery)', () => {
    it('closes ring 1 at tick 300, ring 2 at 600, crushes riders on ring cells, and caps at LAST_RING', () => {
      const shrinkEvery = 300;
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { shrinkEvery },
        },
        // Alone, so no crash of the other rider ends the round before the rings close.
        players: 1,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Formula for ring r: min(column, row, COLUMNS - 1 - column, ROWS - 1 - row) === r.
      function computeRingCells(ring: number): Cell[] {
        const result: Cell[] = [];
        for (let cell = 0; cell < CELL_COUNT; cell++) {
          const col = columnOf(cell);
          const row = rowOf(cell);
          if (Math.min(col, row, COLUMNS - 1 - col, ROWS - 1 - row) === ring) {
            result.push(cell);
          }
        }
        return result;
      }

      const expectedRing1 = computeRingCells(1);
      const expectedRing2 = computeRingCells(2);
      expect(expectedRing1.length).toBe(108);
      expect(expectedRing2.length).toBe(100);
      expect(ringCells(1)).toEqual(expectedRing1);
      expect(ringCells(2)).toEqual(expectedRing2);

      // Steer seat 0 up into row 1 (which is part of ring 1) to leave a trail cell on ring 1 before tick 300.
      // (10, 10) -> (10, 9) -> ... -> (10, 1).
      // Step 1: turn up.
      stepMatch(match, [stick(0, -1), stick(0, 1)]);
      runTicks(match, FIRST_STEP_PERIOD - 1, [IDLE, IDLE]);
      // Step 2..9 (up across rows 8 down to 1):
      for (let r = 8; r >= 1; r--) {
        runTicks(match, FIRST_STEP_PERIOD, [stick(0, -1), stick(0, 1)]);
      }
      expect(rowOf(rider(match, 0).cell)).toBe(1);

      // Turn right along row 1 (ring 1) for 2 steps so that cellAt(10, 1) holds seat 0 trail.
      runTicks(match, FIRST_STEP_PERIOD, [stick(1, 0), IDLE]);
      runTicks(match, FIRST_STEP_PERIOD, [stick(1, 0), IDLE]);
      const ring1TrailCell = cellAt(10, 1);
      expect(match.cells[ring1TrailCell]).toBe(0);

      // Now steer seat 0 back down into row 2 (inside the arena, off ring 1) before tick 300.
      runTicks(match, FIRST_STEP_PERIOD, [stick(0, 1), IDLE]);
      expect(rowOf(rider(match, 0).cell)).toBe(2);

      // Steer seat 1 safely inside the open interior.
      // Advance to tick 300.
      const ticksTo300 = 300 - match.roundTick;
      const eventsAt300 = runTicks(match, ticksTo300, [IDLE, IDLE]);

      const shrink1 = eventsAt300.find(
        (ev): ev is Extract<MatchEvent, { type: 'shrink' }> => ev.type === 'shrink',
      );
      expect(shrink1).toBeDefined();
      expect(shrink1?.ring).toBe(1);
      expect(shrink1?.cells).toEqual(expectedRing1);
      expect(match.shrunk).toBe(1);

      // The trail cell in ring 1 must have become BORDER with laidAt -1.
      expect(match.cells[ring1TrailCell]).toBe(BORDER);
      expect(match.laidAt[ring1TrailCell]).toBe(-1);

      // Advance to tick 600 with the rider held in the open middle, its trail swept away each tick,
      // so it never reaches a wall.
      const eventsAt600: MatchEvent[] = [];
      for (let tick = 0; tick < 300; tick++) {
        for (let c = 0; c < CELL_COUNT; c++) if (match.cells[c] === 0) match.cells[c] = EMPTY;
        rider(match, 0).cell = cellAt(20, 10);
        eventsAt600.push(...stepMatch(match, [IDLE, IDLE]));
      }
      const shrink2 = eventsAt600.find(
        (ev): ev is Extract<MatchEvent, { type: 'shrink' }> => ev.type === 'shrink',
      );
      expect(shrink2).toBeDefined();
      expect(shrink2?.ring).toBe(2);
      expect(shrink2?.cells).toEqual(expectedRing2);
      expect(match.shrunk).toBe(2);
    });

    it('crashes a rider whose head is on a closing ring and awards the rival a point', () => {
      const shrinkEvery = 30;
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { shrinkEvery },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Both riders ride straight at each other along row 10, so close ring 1 early, before they
      // meet: step 1 comes at tick 15, ring 1 closes at tick 30.
      runTicks(match, 29, [IDLE, IDLE]);
      rider(match, 0).cell = cellAt(10, 1);
      const events = runTicks(match, 1, [IDLE, IDLE]);

      // Shrink event must precede crash event.
      const shrinkIndex = events.findIndex((e) => e.type === 'shrink');
      const crashIndex = events.findIndex((e) => e.type === 'crash');
      expect(shrinkIndex).toBeGreaterThanOrEqual(0);
      expect(crashIndex).toBeGreaterThan(shrinkIndex);

      expect(rider(match, 0).crashed).toBe(true);
      expect(rider(match, 1).crashed).toBe(false);
      expect(rider(match, 1).score).toBe(1);
      expect(match.phase).toBe('crash');
      expect(match.pauseTicks).toBe(CRASH_PAUSE_TICKS);
      expect(events).toContainEqual({ type: 'point', seat: 1, score: 1 });

      // After crash pause expires, new round begins with shrunk = 0 and ring 1 restored to EMPTY.
      runTicks(match, CRASH_PAUSE_TICKS, [IDLE, IDLE]);
      expect(match.round).toBe(2);
      expect(match.shrunk).toBe(0);
      expect(match.phase).toBe('running');
      expect(match.cells[cellAt(10, 1)]).toBe(EMPTY);
    });

    it('caps shrinking at LAST_RING (7) and leaves 4 rows open', () => {
      expect(LAST_RING).toBe(7);
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { shrinkEvery: 10 },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Run 100 ticks (10 shrinks would occur if uncapped).
      for (let tick = 1; tick <= 100; tick++) {
        match.cells.fill(EMPTY);
        // Riders kept well apart in the open middle, so neither ever crashes:
        rider(match, 0).cell = cellAt(15, 9);
        rider(match, 1).cell = cellAt(25, 10);
        stepMatch(match, [IDLE, IDLE]);
      }

      expect(match.shrunk).toBe(LAST_RING);

      // Inside LAST_RING (7), rows 8, 9, 10, 11 (4 rows) remain unbordered.
      for (let r = 8; r <= 11; r++) {
        for (let col = 8; col <= 31; col++) {
          expect(ringOfCell(cellAt(col, r))).toBeGreaterThan(LAST_RING);
        }
      }
    });

    it('ignores shrinkEvery when arena edges are wraparound', () => {
      const match = createMatch({
        rules: {
          ...variationRules(8), // wraparound
          remix: { shrinkEvery: 50 },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      const events = runTicks(match, 150, [IDLE, IDLE]);
      expect(events.filter((e) => e.type === 'shrink')).toEqual([]);
      expect(match.shrunk).toBe(0);
    });
  });

  describe('Boost Lanes (remix.boostLanes)', () => {
    it('moves a rider on a lane twice as often, covering twice the distance of an off-lane rider', () => {
      // Row 10 columns 10 to 35 as boost lanes.
      const boostLanes: Cell[] = [];
      for (let col = 10; col <= 35; col++) {
        boostLanes.push(cellAt(col, 10));
      }

      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { boostLanes },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Seat 0 starts at (10, 10) heading right on the boost lane.
      // Steer seat 1 immediately up into row 9 (off boost lanes) heading right.
      stepMatch(match, [IDLE, stick(0, -1)]); // tap up on tick 1
      runTicks(match, FIRST_STEP_PERIOD - 1, [IDLE, IDLE]);
      // At full step 1 (tick 15), seat 1 turned up into row 9. Steer it right.
      stepMatch(match, [IDLE, stick(1, 0)]);

      // Now run for 4 full step periods (4 * 15 = 60 ticks):
      // In 60 ticks:
      // An off-lane rider takes 4 full steps.
      // An on-lane rider takes 4 full steps + 4 half steps = 8 steps!
      const initialCol0 = columnOf(rider(match, 0).cell);
      const initialRow1 = rowOf(rider(match, 1).cell);
      const initialCol1 = columnOf(rider(match, 1).cell);

      // Advance 60 ticks:
      runTicks(match, 60, [IDLE, IDLE]);

      const dist0 = columnOf(rider(match, 0).cell) - initialCol0;
      const dist1 = columnOf(rider(match, 1).cell) - initialCol1;
      expect(rowOf(rider(match, 1).cell)).toBe(initialRow1);

      // Seat 0 covered twice the cells of seat 1:
      expect(dist1).toBe(4);
      expect(dist0).toBe(8);
    });

    it('assigns correct ticks to Move events at full and half steps', () => {
      const laneCell = cellAt(11, 10);
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { boostLanes: [laneCell] },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Seat 0 starts at (10, 10) heading right towards laneCell (11, 10).
      // Seat 1 starts at (30, 10) heading left towards (29, 10) (not a boost lane).
      // At tick 15 (full step 1):
      // Seat 0's new head will be (11, 10) (on lane) -> ticks: ceil(15 / 2) = 8.
      // Seat 1's new head will be (29, 10) (off lane) -> ticks: 15.
      const step1Events = runTicks(match, FIRST_STEP_PERIOD, [IDLE, IDLE]);
      const step1 = step1Events.find(
        (ev): ev is Extract<MatchEvent, { type: 'step' }> => ev.type === 'step',
      );
      expect(step1).toBeDefined();

      const move0 = step1?.moves.find((m) => m.seat === 0);
      const move1 = step1?.moves.find((m) => m.seat === 1);
      expect(move0?.to).toBe(laneCell);
      expect(move0?.ticks).toBe(Math.ceil(FIRST_STEP_PERIOD / 2)); // 8
      expect(move1?.ticks).toBe(FIRST_STEP_PERIOD); // 15

      // At tick 15 + 8 = 23 (half step):
      // Seat 0 is on laneCell, so it moves at half step!
      // Its Move.ticks must be stepPeriod - ceil(stepPeriod / 2) = 15 - 8 = 7.
      const halfStepEvents = runTicks(match, Math.ceil(FIRST_STEP_PERIOD / 2), [IDLE, IDLE]);
      const halfStep = halfStepEvents.find(
        (ev): ev is Extract<MatchEvent, { type: 'step' }> => ev.type === 'step',
      );
      expect(halfStep).toBeDefined();
      expect(halfStep?.moves.length).toBe(1);
      expect(halfStep?.moves[0]?.seat).toBe(0);
      expect(halfStep?.moves[0]?.ticks).toBe(FIRST_STEP_PERIOD - Math.ceil(FIRST_STEP_PERIOD / 2));
    });

    it('emits no step event on a half step tick when no rider is on a lane', () => {
      // Boost lanes placed somewhere far away from riders.
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { boostLanes: [cellAt(1, 1)] },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Run through full step 1 (tick 15):
      runTicks(match, FIRST_STEP_PERIOD, [IDLE, IDLE]);

      // Run through half step tick (ceil(15/2) = 8 ticks later):
      const halfStepTicks = Math.ceil(FIRST_STEP_PERIOD / 2);
      const events = runTicks(match, halfStepTicks, [IDLE, IDLE]);

      // Because neither rider is on cell (1, 1), no step event is emitted during these 8 ticks.
      expect(events.filter((e) => e.type === 'step')).toEqual([]);
    });

    it('scores a crash at a half step like any normal crash', () => {
      const laneCell = cellAt(11, 10);
      const match = createMatch({
        rules: {
          ...variationRules(1),
          remix: { boostLanes: [laneCell] },
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Place a border wall directly in front of seat 0 at (12, 10).
      match.cells[cellAt(12, 10)] = BORDER;

      // Full step 1 (tick 15): seat 0 moves into (11, 10) (boost lane).
      runTicks(match, FIRST_STEP_PERIOD, [IDLE, IDLE]);
      expect(rider(match, 0).cell).toBe(laneCell);
      expect(match.phase).toBe('running');

      // Half step at tick 23: seat 0 moves from (11, 10) to (12, 10) and crashes into BORDER!
      const halfStepEvents = runTicks(match, Math.ceil(FIRST_STEP_PERIOD / 2), [IDLE, IDLE]);
      const crashEvent = halfStepEvents.find((e) => e.type === 'crash');
      expect(crashEvent).toBeDefined();
      expect(rider(match, 0).crashed).toBe(true);
      expect(rider(match, 1).score).toBe(1);
      expect(match.phase).toBe('crash');
      expect(halfStepEvents).toContainEqual({ type: 'point', seat: 1, score: 1 });
    });
  });

  describe('Unchanged match guard', () => {
    it('produces the exact same event log with remix: {} as with no remix', () => {
      const matchPlain = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      const eventsPlain: MatchEvent[] = [];
      eventsPlain.push(...startMatch(matchPlain));

      const matchEmptyRemix = createMatch({
        rules: {
          ...variationRules(1),
          remix: {},
        },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      const eventsEmptyRemix: MatchEvent[] = [];
      eventsEmptyRemix.push(...startMatch(matchEmptyRemix));

      const getSticksPlain = createSeededStickStream(42);
      const getSticksRemix = createSeededStickStream(42);

      for (let t = 0; t < 500; t++) {
        eventsPlain.push(...stepMatch(matchPlain, getSticksPlain()));
        eventsEmptyRemix.push(...stepMatch(matchEmptyRemix, getSticksRemix()));
      }

      expect(eventsEmptyRemix).toEqual(eventsPlain);
    });
  });
});
