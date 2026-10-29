/**
 * Tests for the Trailblaze match engine: board setup, fixed-step cadence,
 * trail laying and movement order, rider pass-through and mutual crashes,
 * input latching, reversal protection and the diagonal hole, step pilots,
 * progressive speed-up, asymmetric crash pauses, target-score endings, solo
 * play, free-draw sketching, scripted 90%+ board fill, and 300-run fuzzing.
 */
import { describe, expect, it } from 'vitest';
import { START, cellAt, isBorderCell } from '../../src/engine/grid.ts';
import {
  CARTRIDGE_TARGET,
  CRASH_PAUSE_TICKS,
  FASTEST_STEP_PERIOD,
  FIRST_STEP_PERIOD,
  SHORT_CRASH_PAUSE_TICKS,
  SPEED_UP_EVERY,
  createMatch,
  startMatch,
  stepMatch,
} from '../../src/engine/match.ts';
import {
  BORDER,
  CELL_COUNT,
  EMPTY,
  IDLE,
  type CellContent,
  type Match,
  type MatchEvent,
  type Phase,
  type Rider,
  type Stick,
} from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import { createSeededStickStream, runTicks, spaceFillingStick } from './helpers/drivers.ts';

function rider(match: Readonly<Match>, seat: number): Rider {
  const item = match.riders[seat];
  if (!item) throw new Error(`Missing rider for seat ${seat}`);
  return item;
}

function stick(east: -1 | 0 | 1, south: -1 | 0 | 1, fire = false): Stick {
  return { east, south, fire };
}

describe('match', () => {
  describe('board and round setup (rules 1–4)', () => {
    it('rule 1: sets up bordered and wraparound boards, places riders on START, and emits round 1', () => {
      const bordered = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      const events = startMatch(bordered);

      expect(events).toEqual([{ type: 'round', round: 1 }]);
      expect(bordered.round).toBe(1);
      expect(bordered.phase).toBe('running');
      expect(bordered.stepPeriod).toBe(FIRST_STEP_PERIOD);
      expect(bordered.untilStep).toBe(FIRST_STEP_PERIOD);
      expect(bordered.roundTick).toBe(0);
      expect(bordered.steps).toBe(0);
      expect(rider(bordered, 0).cell).toBe(START[0].cell);
      expect(rider(bordered, 0).heading).toBe(START[0].heading);
      expect(rider(bordered, 1).cell).toBe(START[1].cell);
      expect(rider(bordered, 1).heading).toBe(START[1].heading);

      let openCells = 0;
      let borderCells = 0;
      for (let c = 0; c < CELL_COUNT; c++) {
        expect(bordered.laidAt[c]).toBe(-1);
        if (isBorderCell(c)) {
          expect(bordered.cells[c]).toBe(BORDER);
          borderCells++;
        } else {
          expect(bordered.cells[c]).toBe(EMPTY);
          openCells++;
        }
      }
      expect(borderCells).toBe(116);
      expect(openCells).toBe(684);

      const wrap = createMatch({
        rules: variationRules(8),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(wrap);
      for (let c = 0; c < CELL_COUNT; c++) {
        expect(wrap.cells[c]).toBe(EMPTY);
        expect(wrap.laidAt[c]).toBe(-1);
      }
    });

    it('rule 2: counts down untilStep each running tick and steps first at FIRST_STEP_PERIOD', () => {
      const match = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      for (let t = 1; t < FIRST_STEP_PERIOD; t++) {
        const tickEvents = stepMatch(match, [IDLE, IDLE]);
        expect(tickEvents).toEqual([]);
        expect(match.untilStep).toBe(FIRST_STEP_PERIOD - t);
        expect(match.steps).toBe(0);
      }

      const stepEvents = stepMatch(match, [IDLE, IDLE]);
      expect(match.roundTick).toBe(FIRST_STEP_PERIOD);
      expect(match.steps).toBe(1);
      expect(match.untilStep).toBe(FIRST_STEP_PERIOD);
      expect(stepEvents).toHaveLength(1);
      expect(stepEvents[0]).toMatchObject({
        type: 'step',
        period: FIRST_STEP_PERIOD,
      });
    });

    it('rule 3: writes cells (seat 0 then seat 1), asks pilots, turns, moves, and reports entered/left headings', () => {
      let pilotSawTrailAtStart0 = false;
      const match = createMatch({
        rules: variationRules(7), // gaps on fire, 8-way
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
        pilots: [
          null,
          (m) => {
            pilotSawTrailAtStart0 = m.cells[START[0].cell] === 0;
            return 'up';
          },
        ],
      });
      startMatch(match);

      // Push down for seat 0 before step 1 so entered is 'right' and left is 'down'.
      stepMatch(match, [stick(0, 1), IDLE]);
      const events = runTicks(match, FIRST_STEP_PERIOD - 1);

      expect(pilotSawTrailAtStart0).toBe(true);
      expect(match.cells[START[0].cell]).toBe(0);
      expect(match.laidAt[START[0].cell]).toBe(FIRST_STEP_PERIOD);
      expect(match.cells[START[1].cell]).toBe(1);
      expect(match.laidAt[START[1].cell]).toBe(FIRST_STEP_PERIOD);

      expect(events).toEqual([
        { type: 'turn', seat: 0, from: 'right', to: 'down' },
        { type: 'turn', seat: 1, from: 'left', to: 'up' },
        {
          type: 'step',
          laid: [
            { cell: START[0].cell, seat: 0, entered: 'right', left: 'down' },
            { cell: START[1].cell, seat: 1, entered: 'left', left: 'up' },
          ],
          erased: [],
          moves: [
            {
              seat: 0,
              from: START[0].cell,
              to: cellAt(10, 11),
              heading: 'down',
              wrapped: false,
              ticks: FIRST_STEP_PERIOD,
            },
            {
              seat: 1,
              from: START[1].cell,
              to: cellAt(30, 9),
              heading: 'up',
              wrapped: false,
              ticks: FIRST_STEP_PERIOD,
            },
          ],
          period: FIRST_STEP_PERIOD,
        },
      ]);

      // Seat 0 written before seat 1: if both share one cell and only seat 0 holds fire, seat 1's
      // write wins. Seat 1's pilot still steers it up, so that is the heading it leaves by.
      const sharedCell = cellAt(20, 10);
      rider(match, 0).cell = sharedCell;
      rider(match, 1).cell = sharedCell;
      rider(match, 0).heading = 'right';
      rider(match, 1).heading = 'left';

      const sharedStepEvents = runTicks(match, match.untilStep, [
        stick(0, 0, true),
        stick(0, 0, false),
      ]);
      expect(match.cells[sharedCell]).toBe(1);
      expect(sharedStepEvents).toContainEqual(
        expect.objectContaining({
          type: 'step',
          laid: [{ cell: sharedCell, seat: 1, entered: 'left', left: 'up' }],
          erased: [],
        }),
      );
    });
  });

  describe('1977 hooks', () => {
    it('hook 2 (rule 7): diagonal hole allows a 180-degree diagonal reversal on switch B to crash', () => {
      const match = createMatch({
        rules: variationRules(5), // 8-way steering
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Step 1: turn seat 0 to down-right (diagonal).
      runTicks(match, FIRST_STEP_PERIOD, [stick(1, 1), IDLE]);
      expect(rider(match, 0).heading).toBe('down-right');
      expect(rider(match, 0).cell).toBe(cellAt(11, 11));
      expect(match.phase).toBe('running');

      // Step 2: while riding down-right on switch B, push up-left (exact opposite diagonal).
      // Because current heading is diagonal, protection is bypassed and seat 0 backs into (10, 10).
      const crashEvents = runTicks(match, FIRST_STEP_PERIOD, [stick(-1, -1), IDLE]);
      expect(rider(match, 0).heading).toBe('up-left');
      expect(rider(match, 0).cell).toBe(cellAt(10, 10));
      expect(rider(match, 0).crashed).toBe(true);
      expect(match.phase).toBe('crash');
      expect(crashEvents).toContainEqual({
        type: 'turn',
        seat: 0,
        from: 'down-right',
        to: 'up-left',
      });
      expect(crashEvents).toContainEqual({
        type: 'crash',
        crashes: [{ seat: 0, cell: cellAt(10, 10), into: 0 }],
      });
    });

    it('hook 3 (rule 12): asymmetric crash pause lasts 240 ticks for seat 0 and 224 ticks for seat 1 alone', () => {
      // Case A: Seat 0 crashes into border.
      const match0 = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['A', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match0);

      // On switch A, seat 0 reverses left on step 2 into its own trail.
      runTicks(match0, FIRST_STEP_PERIOD);
      const crash0Events = runTicks(match0, FIRST_STEP_PERIOD, [stick(-1, 0), IDLE]);
      expect(crash0Events.some((e) => e.type === 'crash')).toBe(true);
      const crash0Tick = match0.tick;
      expect(match0.phase).toBe('crash');
      expect(match0.pauseTicks).toBe(CRASH_PAUSE_TICKS);

      for (let i = 1; i < CRASH_PAUSE_TICKS; i++) {
        expect(stepMatch(match0, [IDLE, IDLE])).toEqual([]);
        expect(match0.phase).toBe('crash');
      }
      const nextRound0Events = stepMatch(match0, [IDLE, IDLE]);
      expect(match0.tick - crash0Tick).toBe(240);
      expect(nextRound0Events).toEqual([{ type: 'round', round: 2 }]);
      expect(match0.phase).toBe('running');

      // Case B: Seat 1 crashes alone.
      const match1 = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'A'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match1);

      runTicks(match1, FIRST_STEP_PERIOD);
      const crash1Events = runTicks(match1, FIRST_STEP_PERIOD, [IDLE, stick(1, 0)]);
      expect(crash1Events.some((e) => e.type === 'crash')).toBe(true);
      const crash1Tick = match1.tick;
      expect(match1.phase).toBe('crash');
      expect(match1.pauseTicks).toBe(SHORT_CRASH_PAUSE_TICKS);

      for (let i = 1; i < SHORT_CRASH_PAUSE_TICKS; i++) {
        expect(stepMatch(match1, [IDLE, IDLE])).toEqual([]);
        expect(match1.phase).toBe('crash');
      }
      const nextRound1Events = stepMatch(match1, [IDLE, IDLE]);
      expect(match1.tick - crash1Tick).toBe(224);
      expect(nextRound1Events).toEqual([{ type: 'round', round: 2 }]);
      expect(match1.phase).toBe('running');
    });

    it('hook 4 (rule 4): riders pass through each other on crossing paths, crash after meeting in one cell, and crash when swapping adjacent cells', () => {
      // Subcase 1: Crossing paths (one moving right, one moving down into the same empty cell).
      const cross = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(cross);
      rider(cross, 0).cell = cellAt(19, 10);
      rider(cross, 0).heading = 'right';
      rider(cross, 1).cell = cellAt(20, 9);
      rider(cross, 1).heading = 'down';

      // Both step into (20, 10) on the same step: neither crashes.
      runTicks(cross, FIRST_STEP_PERIOD);
      expect(rider(cross, 0).cell).toBe(cellAt(20, 10));
      expect(rider(cross, 1).cell).toBe(cellAt(20, 10));
      expect(cross.phase).toBe('running');

      // Next step: seat 0 moves to (21, 10) and seat 1 moves to (20, 11), both still unharmed!
      runTicks(cross, FIRST_STEP_PERIOD);
      expect(rider(cross, 0).cell).toBe(cellAt(21, 10));
      expect(rider(cross, 1).cell).toBe(cellAt(20, 11));
      expect(cross.phase).toBe('running');

      // Subcase 2: Meeting head-on in one empty cell, then crashing into each other's trails on the next step.
      const meet = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(meet);
      rider(meet, 0).cell = cellAt(19, 10);
      rider(meet, 0).heading = 'right';
      rider(meet, 1).cell = cellAt(21, 10);
      rider(meet, 1).heading = 'left';

      // Step 1: both enter (20, 10) cleanly.
      runTicks(meet, FIRST_STEP_PERIOD);
      expect(rider(meet, 0).cell).toBe(cellAt(20, 10));
      expect(rider(meet, 1).cell).toBe(cellAt(20, 10));
      expect(meet.phase).toBe('running');

      // Step 2: seat 0 steps to (21, 10) (seat 1's trail) and seat 1 steps to (19, 10) (seat 0's trail).
      const meetCrashEvents = runTicks(meet, FIRST_STEP_PERIOD);
      expect(meet.phase).toBe('crash');
      expect(rider(meet, 0).score).toBe(1);
      expect(rider(meet, 1).score).toBe(1);
      expect(meetCrashEvents).toContainEqual({
        type: 'crash',
        crashes: [
          { seat: 0, cell: cellAt(21, 10), into: 1 },
          { seat: 1, cell: cellAt(19, 10), into: 0 },
        ],
      });
      expect(meetCrashEvents).toContainEqual({ type: 'point', seat: 0, score: 1 });
      expect(meetCrashEvents).toContainEqual({ type: 'point', seat: 1, score: 1 });

      // Subcase 3: Adjacent and head-on (swap cells in one step).
      const swap = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(swap);
      rider(swap, 0).cell = cellAt(20, 10);
      rider(swap, 0).heading = 'right';
      rider(swap, 1).cell = cellAt(21, 10);
      rider(swap, 1).heading = 'left';

      const swapEvents = runTicks(swap, FIRST_STEP_PERIOD);
      expect(swap.phase).toBe('crash');
      expect(rider(swap, 0).score).toBe(1);
      expect(rider(swap, 1).score).toBe(1);
      expect(swapEvents).toContainEqual({
        type: 'crash',
        crashes: [
          { seat: 0, cell: cellAt(21, 10), into: 1 },
          { seat: 1, cell: cellAt(20, 10), into: 0 },
        ],
      });
    });

    it('hook 5 (rule 13): reaching the target score skips the crash pause and ends the match immediately, including a 10–10 tie', () => {
      // Single winner reaching 10
      const winMatch = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['A', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(winMatch);
      rider(winMatch, 0).score = 2;
      rider(winMatch, 1).score = 9;

      runTicks(winMatch, FIRST_STEP_PERIOD);
      const winEvents = runTicks(winMatch, FIRST_STEP_PERIOD, [stick(-1, 0), IDLE]);

      expect(winMatch.phase).toBe('over');
      expect(winMatch.pauseTicks).toBe(0);
      expect(winMatch.winner).toBe(1);
      expect(winEvents).toContainEqual({ type: 'point', seat: 1, score: 10 });
      expect(winEvents).toContainEqual({
        type: 'over',
        winner: 1,
        scores: [2, 10],
      });

      // Subsequent ticks after over return no events and change nothing.
      const tickAtOver = winMatch.tick;
      expect(stepMatch(winMatch, [stick(0, -1), stick(0, 1)])).toEqual([]);
      expect(winMatch.tick).toBe(tickAtOver);

      // Simultaneous 10–10 tie
      const tieMatch = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(tieMatch);
      rider(tieMatch, 0).score = 9;
      rider(tieMatch, 1).score = 9;
      rider(tieMatch, 0).cell = cellAt(20, 10);
      rider(tieMatch, 0).heading = 'right';
      rider(tieMatch, 1).cell = cellAt(21, 10);
      rider(tieMatch, 1).heading = 'left';

      const tieEvents = runTicks(tieMatch, FIRST_STEP_PERIOD);
      expect(tieMatch.phase).toBe('over');
      expect(tieMatch.pauseTicks).toBe(0);
      expect(tieMatch.winner).toBeNull();
      expect(tieEvents.filter((e) => e.type === 'point')).toEqual([
        { type: 'point', seat: 0, score: 10 },
        { type: 'point', seat: 1, score: 10 },
      ]);
      expect(tieEvents).toContainEqual({
        type: 'over',
        winner: null,
        scores: [10, 10],
      });
    });
  });

  describe('steering, latching, reversal filter, and pilots (rules 5–9)', () => {
    it('rule 5: latches a single-tick tap between steps and lets the latest push before a step win', () => {
      const match = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Tick 1: seat 0 taps 'up', seat 1 taps 'up'.
      stepMatch(match, [stick(0, -1), stick(0, -1)]);
      expect(rider(match, 0).latched).toBe('up');
      expect(rider(match, 1).latched).toBe('up');

      // Ticks 2..5: both sticks centred; latch survives.
      runTicks(match, 4, [IDLE, IDLE]);
      expect(rider(match, 0).latched).toBe('up');

      // Tick 6: seat 1 pushes 'down' for one tick; latest push overrides 'up'.
      stepMatch(match, [IDLE, stick(0, 1)]);
      expect(rider(match, 1).latched).toBe('down');

      // Remaining ticks until step 1 with sticks centred.
      const events = runTicks(match, FIRST_STEP_PERIOD - 6, [IDLE, IDLE]);
      expect(rider(match, 0).heading).toBe('up');
      expect(rider(match, 0).latched).toBeNull();
      expect(rider(match, 1).heading).toBe('down');
      expect(rider(match, 1).latched).toBeNull();
      expect(events).toContainEqual({ type: 'turn', seat: 0, from: 'right', to: 'up' });
      expect(events).toContainEqual({ type: 'turn', seat: 1, from: 'left', to: 'down' });
    });

    it('rule 6: ignores exact cardinal reversal on switch B, strips the opposite component from a diagonal push, and allows reversal on switch A', () => {
      // Switch B cardinal exact opposite is ignored; diagonal with opposite component strips only the opposite axis.
      const matchB = createMatch({
        rules: variationRules(5), // 8-way steering
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(matchB);

      // Seat 0 riding right pushes left (exact opposite): ignored, stays right.
      // Seat 1 riding left pushes up-right (opposite horizontal + up): right bit stripped, turns up.
      const step1Events = runTicks(matchB, FIRST_STEP_PERIOD, [stick(-1, 0), stick(1, -1)]);
      expect(rider(matchB, 0).heading).toBe('right');
      expect(rider(matchB, 1).heading).toBe('up');
      expect(step1Events.some((e) => e.type === 'turn' && e.seat === 0)).toBe(false);
      expect(step1Events).toContainEqual({ type: 'turn', seat: 1, from: 'left', to: 'up' });

      // Step 2: Seat 0 (still riding right) pushes up-left: left bit stripped, turns up.
      const step2Events = runTicks(matchB, FIRST_STEP_PERIOD, [stick(-1, -1), IDLE]);
      expect(rider(matchB, 0).heading).toBe('up');
      expect(step2Events).toContainEqual({ type: 'turn', seat: 0, from: 'right', to: 'up' });

      // Switch A: exact opposite goes through and crashes into the cell just laid.
      const matchA = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['A', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(matchA);
      runTicks(matchA, FIRST_STEP_PERIOD);
      const crashEvents = runTicks(matchA, FIRST_STEP_PERIOD, [stick(-1, 0), IDLE]);
      expect(rider(matchA, 0).heading).toBe('left');
      expect(rider(matchA, 0).crashed).toBe(true);
      expect(crashEvents).toContainEqual({
        type: 'crash',
        crashes: [{ seat: 0, cell: START[0].cell, into: 0 }],
      });
    });

    it('rule 9: applies reversal protection to a pilot choice on switch B, ignores stick steering for piloted seats, and still reads fire', () => {
      const match = createMatch({
        rules: variationRules(7), // gaps on fire
        players: 2,
        switches: ['B', 'A'],
        target: CARTRIDGE_TARGET,
        pilots: [
          // Pilot tries to reverse seat 0 (riding right) to left; switch B filters it out.
          () => 'left',
          // Pilot tries to reverse seat 1 (riding left) to right; switch A lets it through.
          () => 'right',
        ],
      });
      startMatch(match);

      // Step 1: seat 0 holds stick 'up' + fire. Stick 'up' is ignored because seat 0 has a pilot,
      // pilot's 'left' is filtered out by switch B so seat 0 continues 'right', and fire leaves a gap.
      // Seat 1's pilot reverses right on switch A (safe on step 1 because (31, 10) is empty).
      runTicks(match, FIRST_STEP_PERIOD, [stick(0, -1, true), IDLE]);
      expect(rider(match, 0).heading).toBe('right');
      expect(match.cells[START[0].cell]).toBe(EMPTY);
      expect(rider(match, 1).heading).toBe('right');
    });
  });

  describe('speed-up schedule (rule 10)', () => {
    it('accelerates through stages 1–4 at ticks 256, 512, 768 and 1024 in variation 3, and stays at 15 in variation 1', () => {
      const accel = createMatch({
        rules: variationRules(3), // speedUp: true
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(accel);

      const constant = createMatch({
        rules: variationRules(1), // speedUp: false
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(constant);

      const speedEvents: MatchEvent[] = [];
      const observedPeriods = new Set<number>();

      // Clear cells each tick so riders never crash while testing 1300 ticks.
      for (let tick = 1; tick <= 1300; tick++) {
        accel.cells.fill(EMPTY);
        constant.cells.fill(EMPTY);

        const evAccel = stepMatch(accel, [IDLE, IDLE]);
        stepMatch(constant, [IDLE, IDLE]);

        for (const ev of evAccel) {
          if (ev.type === 'speed') speedEvents.push({ ...ev });
          if (ev.type === 'step') observedPeriods.add(ev.period);
        }

        if (tick === SPEED_UP_EVERY) expect(accel.stepPeriod).toBe(12);
        if (tick === SPEED_UP_EVERY * 2) expect(accel.stepPeriod).toBe(9);
        if (tick === SPEED_UP_EVERY * 3) expect(accel.stepPeriod).toBe(6);
        if (tick === SPEED_UP_EVERY * 4) expect(accel.stepPeriod).toBe(FASTEST_STEP_PERIOD);
        expect(constant.stepPeriod).toBe(FIRST_STEP_PERIOD);
      }

      expect(speedEvents).toEqual([
        { type: 'speed', stage: 1, period: 12 },
        { type: 'speed', stage: 2, period: 9 },
        { type: 'speed', stage: 3, period: 6 },
        { type: 'speed', stage: 4, period: 3 },
      ]);
      expect([...observedPeriods]).toEqual([15, 12, 9, 6, 3]);
    });
  });

  describe('solo riding, trail gaps, and free-draw (rules 14–15)', () => {
    it('rule 14: riding alone ignores seat 1 completely and ends immediately on seat 0 crash with winner null and no points', () => {
      const solo = createMatch({
        rules: variationRules(1),
        players: 1,
        switches: ['A', 'A'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(solo);

      // Step 1: seat 1 stick is held, but seat 1 does not move or lay trail.
      const step1 = runTicks(solo, FIRST_STEP_PERIOD, [IDLE, stick(0, -1, true)]);
      expect(solo.cells[START[1].cell]).toBe(EMPTY);
      expect(rider(solo, 1).cell).toBe(START[1].cell);
      expect(step1).toEqual([
        {
          type: 'step',
          laid: [{ cell: START[0].cell, seat: 0, entered: 'right', left: 'right' }],
          erased: [],
          moves: [
            {
              seat: 0,
              from: START[0].cell,
              to: cellAt(11, 10),
              heading: 'right',
              wrapped: false,
              ticks: FIRST_STEP_PERIOD,
            },
          ],
          period: FIRST_STEP_PERIOD,
        },
      ]);

      // Step 2: seat 0 reverses on switch A and crashes into its own trail.
      const step2 = runTicks(solo, FIRST_STEP_PERIOD, [stick(-1, 0), IDLE]);
      expect(solo.phase).toBe('over');
      expect(solo.pauseTicks).toBe(0);
      expect(solo.winner).toBeNull();
      expect(rider(solo, 0).score).toBe(0);
      expect(rider(solo, 1).score).toBe(0);
      expect(step2.filter((e) => e.type === 'point')).toHaveLength(0);
      expect(step2).toContainEqual({
        type: 'crash',
        crashes: [{ seat: 0, cell: START[0].cell, into: 0 }],
      });
      expect(step2).toContainEqual({
        type: 'over',
        winner: null,
        scores: [0, 0],
      });
    });

    it('gaps in variation 7: holding fire leaves the vacated cell EMPTY so a rival rides through safely', () => {
      const match = createMatch({
        rules: variationRules(7), // gaps on fire
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      // Place seat 0 at (20, 10) heading up, and seat 1 at (19, 10) heading right.
      rider(match, 0).cell = cellAt(20, 10);
      rider(match, 0).heading = 'up';
      rider(match, 1).cell = cellAt(19, 10);
      rider(match, 1).heading = 'right';

      // Seat 0 holds fire as it leaves (20, 10), leaving a gap; seat 1 steps onto (20, 10) safely.
      const events = runTicks(match, FIRST_STEP_PERIOD, [stick(0, -1, true), IDLE]);
      expect(match.phase).toBe('running');
      expect(rider(match, 1).crashed).toBe(false);
      expect(rider(match, 1).cell).toBe(cellAt(20, 10));
      expect(match.cells[cellAt(20, 10)]).toBe(EMPTY);
      expect(events.some((e) => e.type === 'crash')).toBe(false);
    });

    it('rule 15: free-draw in variation 13 does not latch, stays put when centred, never crashes, and erases trails with fire', () => {
      const draw = createMatch({
        rules: variationRules(13), // free-draw, 4-way, erase
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(draw);

      // Push 'up' before the step, then release to IDLE on the step tick: because free-draw
      // does not latch, both cursors stay put at START and still write their cells.
      stepMatch(draw, [stick(0, -1), stick(0, 1)]);
      const step1 = runTicks(draw, FIRST_STEP_PERIOD - 1, [IDLE, IDLE]);
      expect(rider(draw, 0).cell).toBe(START[0].cell);
      expect(rider(draw, 1).cell).toBe(START[1].cell);
      expect(draw.cells[START[0].cell]).toBe(0);
      expect(draw.cells[START[1].cell]).toBe(1);
      expect(step1).toEqual([
        {
          type: 'step',
          laid: [
            { cell: START[0].cell, seat: 0, entered: 'right', left: 'right' },
            { cell: START[1].cell, seat: 1, entered: 'left', left: 'left' },
          ],
          erased: [],
          moves: [],
          period: FIRST_STEP_PERIOD,
        },
      ]);

      // Step 2: Seat 0 holds fire while centred on its just-drawn cell (START[0].cell),
      // erasing it and reporting it in `erased`. Seat 1 moves left onto a pre-drawn trail
      // without crashing.
      draw.cells[cellAt(29, 10)] = 0;
      const step2 = runTicks(draw, FIRST_STEP_PERIOD, [stick(0, 0, true), stick(-1, 0, false)]);
      expect(draw.phase).toBe('running');
      expect(draw.cells[START[0].cell]).toBe(EMPTY);
      expect(draw.laidAt[START[0].cell]).toBe(-1);
      expect(rider(draw, 1).cell).toBe(cellAt(29, 10));
      expect(rider(draw, 1).crashed).toBe(false);
      expect(step2).toEqual([
        {
          type: 'step',
          laid: [{ cell: START[1].cell, seat: 1, entered: 'left', left: 'left' }],
          erased: [START[0].cell],
          moves: [
            {
              seat: 1,
              from: START[1].cell,
              to: cellAt(29, 10),
              heading: 'left',
              wrapped: false,
              ticks: FIRST_STEP_PERIOD,
            },
          ],
          period: FIRST_STEP_PERIOD,
        },
      ]);
    });
  });

  describe('scripted space-filling solo run', () => {
    it('lays at least 616 trail cells (90% of the 684 open cells) in variation 1 before crashing', () => {
      const match = createMatch({
        rules: variationRules(1),
        players: 1,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      let maxGuardTicks = 20000;
      while (match.phase === 'running' && maxGuardTicks > 0) {
        const input = spaceFillingStick(match);
        stepMatch(match, [input, IDLE]);
        maxGuardTicks--;
      }

      expect(match.phase).toBe('over');
      let trailCells = 0;
      for (let c = 0; c < CELL_COUNT; c++) {
        if (match.cells[c] === 0) trailCells++;
      }
      expect(trailCells).toBeGreaterThanOrEqual(616);
    });
  });

  describe('fuzz invariants across 300 seeded runs', () => {
    it('maintains cell, score, laidAt, and phase-transition invariants across 300 x 6,000-tick runs over variations 1–12', () => {
      for (let runIndex = 0; runIndex < 300; runIndex++) {
        const variationNumber = (runIndex % 12) + 1;
        const players: 1 | 2 = runIndex % 5 === 0 ? 1 : 2;
        const switch0 = runIndex % 2 === 0 ? 'B' : 'A';
        const switch1 = runIndex % 3 === 0 ? 'A' : 'B';
        const nextSticks = createSeededStickStream(0x9e3779b9 ^ (runIndex * 7919));

        const match = createMatch({
          rules: variationRules(variationNumber),
          players,
          switches: [switch0, switch1],
          target: CARTRIDGE_TARGET,
        });
        startMatch(match);

        const awardedPoints: number[] = [0, 0, 0, 0];
        let prevPhase: Phase = match.phase;
        let failure: string | null = null;

        for (let tick = 0; tick < 6000; tick++) {
          const events = stepMatch(match, nextSticks());
          const nextPhase = match.phase;

          // Invariant 4: phase only moves running -> crash -> running or -> over.
          if (nextPhase !== prevPhase) {
            const validTransition =
              (prevPhase === 'running' && (nextPhase === 'crash' || nextPhase === 'over')) ||
              (prevPhase === 'crash' && nextPhase === 'running');
            if (!validTransition) {
              failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: invalid phase transition ${prevPhase} -> ${nextPhase}`;
              break;
            }
          }
          prevPhase = nextPhase;

          let crashedThisTick = false;
          let cellsChanged = false;
          for (const ev of events) {
            if (ev.type === 'crash') crashedThisTick = true;
            if (ev.type === 'point') awardedPoints[ev.seat] = (awardedPoints[ev.seat] ?? 0) + 1;
            if (ev.type === 'step' || ev.type === 'round') cellsChanged = true;
          }

          // Invariant 1: no running rider stands on a non-EMPTY cell unless it crashed on that tick.
          if (match.phase === 'running') {
            if (crashedThisTick) {
              failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: crash event while phase remained running`;
              break;
            }
            if (match.cells[rider(match, 0).cell] !== EMPTY) {
              failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: running seat 0 stands on non-EMPTY cell`;
              break;
            }
            if (players === 2 && match.cells[rider(match, 1).cell] !== EMPTY) {
              failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: running seat 1 stands on non-EMPTY cell`;
              break;
            }
          }

          // Invariant 2: scores equal the points awarded.
          if (
            rider(match, 0).score !== (awardedPoints[0] ?? 0) ||
            rider(match, 1).score !== (awardedPoints[1] ?? 0)
          ) {
            failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: scores do not match awarded points`;
            break;
          }

          // Invariant 3: every non-empty, non-border cell has a laidAt of at most tick (and >= 0).
          if (cellsChanged) {
            for (let c = 0; c < CELL_COUNT; c++) {
              const content = match.cells[c] as CellContent;
              const laidAt = match.laidAt[c] ?? -1;
              if (content === EMPTY || content === BORDER) {
                if (laidAt !== -1) {
                  failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: empty/border cell ${c} has laidAt ${laidAt}`;
                  break;
                }
              } else if (laidAt < 0 || laidAt > match.tick) {
                failure = `run ${runIndex}, variation ${variationNumber}, tick ${match.tick}: trail cell ${c} has laidAt ${laidAt}`;
                break;
              }
            }
            if (failure !== null) break;
          }

          if (match.phase === 'over') break;
        }

        expect(failure).toBeNull();
      }
    });
  });
});
