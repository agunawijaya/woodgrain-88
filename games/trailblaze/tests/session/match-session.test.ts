/**
 * Tests for the match session: fixed 20 ms ticks, driver stick polling,
 * event dispatch to view and listener, trap detection, statistics tracking,
 * solo play, and post-over freeze.
 */
import type { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { START, cellAt } from '../../src/engine/grid.ts';
import { vectorOf } from '../../src/engine/headings.ts';
import { IDLE, type Heading, type Laid, type Stick } from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import type { TrailView } from '../../src/look/look.ts';
import {
  createMatchSession,
  type SeatDriver,
  type SessionEvent,
} from '../../src/session/match-session.ts';

type Run = readonly [Heading, number];

function plannedHeadings(runs: readonly Run[]): Heading[] {
  return runs.flatMap(([heading, steps]) => Array.from({ length: steps }, () => heading));
}

function stickFor(heading: Heading | undefined): Stick {
  if (!heading) return IDLE;
  const { east, south } = vectorOf(heading);
  return { east, south, fire: false };
}

function plannedDriver(runs: readonly Run[]): SeatDriver {
  const headings = plannedHeadings(runs);
  return {
    stick(match) {
      return stickFor(headings[match.steps]);
    },
  };
}

function idleDriver(): SeatDriver {
  return {
    stick() {
      return IDLE;
    },
  };
}

interface RecordedCall {
  readonly method: string;
  readonly args: unknown[];
}

function createFakeView(): TrailView & { readonly calls: readonly RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    get calls() {
      return calls;
    },
    root: {} as unknown as Group,
    reset(edges) {
      calls.push({ method: 'reset', args: [edges] });
    },
    placeRider(seat, cell, heading) {
      calls.push({ method: 'placeRider', args: [seat, cell, heading] });
    },
    step(laid, erased, moves, seconds) {
      calls.push({ method: 'step', args: [laid, erased, moves, seconds] });
    },
    steer() {
      // Called every frame with the queued turn; these tests follow steps and crashes instead.
    },
    setSpeedStage(stage) {
      calls.push({ method: 'setSpeedStage', args: [stage] });
    },
    crash(c) {
      calls.push({ method: 'crash', args: [c] });
    },
    trap(seat, pocket, seal) {
      calls.push({ method: 'trap', args: [seat, pocket, seal] });
    },
    freeze() {
      calls.push({ method: 'freeze', args: [] });
    },
    update(dt) {
      calls.push({ method: 'update', args: [dt] });
    },
    setRemix(remix) {
      calls.push({ method: 'setRemix', args: [remix] });
    },
    shrink(cells) {
      calls.push({ method: 'shrink', args: [cells] });
    },
    riderPosition(_seat, target) {
      return target;
    },
    dispose() {
      calls.push({ method: 'dispose', args: [] });
    },
  };
}

describe('createMatchSession', () => {
  describe('fixed step and accumulator', () => {
    it('runs ticks based on 20 ms increments and carries over remainders', () => {
      const session = createMatchSession({
        setup: {
          rules: variationRules(1),
          players: 2,
          switches: ['B', 'B'],
          target: 10,
        },
        drivers: [idleDriver(), idleDriver()],
      });

      expect(session.match.tick).toBe(0);

      // 0.01s: not enough for 20 ms tick
      session.advance(0.01);
      expect(session.match.tick).toBe(0);

      // Another 0.01s brings accumulator to 0.02s (1 tick)
      session.advance(0.01);
      expect(session.match.tick).toBe(1);

      // advance(0.03) runs 1 tick and leaves 0.01s remainder
      session.advance(0.03);
      expect(session.match.tick).toBe(2);

      // advance(0.03) with 0.01s remainder gives 0.04s = 2 ticks
      session.advance(0.03);
      expect(session.match.tick).toBe(4);
    });

    it('caps ticks per advance to maxTicksPerAdvance and drops the rest', () => {
      const session = createMatchSession({
        setup: {
          rules: variationRules(1),
          players: 2,
          switches: ['B', 'B'],
          target: 10,
        },
        drivers: [idleDriver(), idleDriver()],
        maxTicksPerAdvance: 10,
      });

      expect(session.match.tick).toBe(0);

      // 1.0 second would be 50 ticks, capped at maxTicksPerAdvance (10)
      session.advance(1.0);
      expect(session.match.tick).toBe(10);

      // The rest of the 50 ticks must have been dropped, not buffered
      session.advance(0.02);
      expect(session.match.tick).toBe(11);
    });
  });

  describe('view mapping', () => {
    it('dispatches reset, placeRider, step, speed, crash, trap, freeze in order with right arguments', () => {
      const view = createFakeView();

      // Script a duel in variation 3 (speedUp: true) that triggers speed, trap, crash, and over
      // Orange seals blue in a pocket on step 65, blue crashes on step 68
      const storyRuns: [readonly Run[], readonly Run[]] = [
        [
          ['right', 3],
          ['up', 4],
          ['right', 4],
          ['down', 11],
          ['right', 4],
          ['up', 2],
          ['right', 4],
          ['down', 2],
          ['right', 4],
          ['up', 14],
          ['left', 7],
          ['up', 2],
          ['left', 8],
        ],
        [
          ['down', 8],
          ['right', 8],
          ['up', 8],
          ['left', 2],
          ['down', 6],
          ['left', 3],
          ['up', 6],
          ['right', 2],
          ['up', 1],
          ['left', 5],
          ['up', 8],
          ['left', 9],
        ],
      ];

      const session = createMatchSession({
        setup: {
          rules: variationRules(3),
          players: 2,
          switches: ['B', 'B'],
          target: 1, // End match on first crash
        },
        drivers: [plannedDriver(storyRuns[0]), plannedDriver(storyRuns[1])],
        view,
      });

      // View was reset and riders placed on creation
      const creationCalls = view.calls.map((c) => c.method);
      expect(creationCalls).toEqual(['setRemix', 'reset', 'placeRider', 'placeRider']);
      expect(view.calls[0]?.args).toEqual([undefined]);
      expect(view.calls[1]?.args).toEqual(['bordered']);
      expect(view.calls[2]?.args).toEqual([0, START[0].cell, START[0].heading]);
      expect(view.calls[3]?.args).toEqual([1, START[1].cell, START[1].heading]);

      // Advance through the match until over
      while (!session.over) {
        session.advance(0.02);
      }

      const methodNames = view.calls.map((c) => c.method);
      expect(methodNames).toContain('reset');
      expect(methodNames).toContain('placeRider');
      expect(methodNames).toContain('step');
      expect(methodNames).toContain('setSpeedStage');
      expect(methodNames).toContain('trap');
      expect(methodNames).toContain('crash');
      expect(methodNames).toContain('freeze');

      // Verify speed call argument
      const speedCall = view.calls.find((c) => c.method === 'setSpeedStage');
      expect(speedCall?.args).toEqual([1]);

      // Verify trap call arguments
      const trapCall = view.calls.find((c) => c.method === 'trap');
      expect(trapCall?.args[0]).toBe(1);
      const pocketArg = trapCall?.args[1];
      expect(Array.isArray(pocketArg) ? pocketArg.length : 0).toBe(9);
      expect(trapCall?.args[2]).toBe(cellAt(22, 1));

      // Verify freeze was called once over
      expect(methodNames.filter((m) => m === 'freeze')).toHaveLength(1);

      // Verify dispose forwards to view
      session.dispose();
      expect(view.calls[view.calls.length - 1]?.method).toBe('dispose');
    });

    it('calls view.update once per advance with real seconds, even after freeze', () => {
      const view = createFakeView();
      const session = createMatchSession({
        setup: {
          rules: variationRules(1),
          players: 1,
          switches: ['B', 'B'],
          target: 10,
        },
        drivers: [idleDriver(), idleDriver()],
        view,
      });

      session.advance(0.05);
      const updates1 = view.calls.filter((c) => c.method === 'update');
      expect(updates1).toHaveLength(1);
      expect(updates1[0]?.args).toEqual([0.05]);

      // Step until solo crash (wall at col 39)
      while (!session.over) {
        session.advance(0.02);
      }
      expect(session.over).toBe(true);

      const countBefore = view.calls.filter((c) => c.method === 'update').length;
      // Advance after over still updates view
      session.advance(0.016);
      const countAfter = view.calls.filter((c) => c.method === 'update').length;
      expect(countAfter).toBe(countBefore + 1);
      expect(view.calls[view.calls.length - 1]?.args).toEqual([0.016]);
    });
  });

  describe('trap spotting', () => {
    it('replays the trap story from hero.ts and spots exactly one trap for seat 1 at (22, 1)', () => {
      const storyRuns: [readonly Run[], readonly Run[]] = [
        [
          ['right', 3],
          ['up', 4],
          ['right', 4],
          ['down', 11],
          ['right', 4],
          ['up', 2],
          ['right', 4],
          ['down', 2],
          ['right', 4],
          ['up', 14],
          ['left', 7],
          ['up', 2],
          ['left', 8],
        ],
        [
          ['down', 8],
          ['right', 8],
          ['up', 8],
          ['left', 2],
          ['down', 6],
          ['left', 3],
          ['up', 6],
          ['right', 2],
          ['up', 1],
          ['left', 5],
          ['up', 8],
          ['left', 9],
        ],
      ];

      const trapEvents: SessionEvent[] = [];
      const session = createMatchSession({
        setup: {
          rules: variationRules(3),
          players: 2,
          switches: ['B', 'B'],
          target: 10,
        },
        drivers: [plannedDriver(storyRuns[0]), plannedDriver(storyRuns[1])],
        onEvent(event) {
          if (event.type === 'trap') {
            trapEvents.push(event);
          }
        },
      });

      // Advance through step 66
      while (session.match.steps <= 66 && session.match.phase === 'running') {
        session.advance(0.02);
      }

      expect(trapEvents).toHaveLength(1);
      const trap = trapEvents[0];
      if (trap?.type !== 'trap') {
        throw new Error('Expected trap event');
      }
      expect(trap.seat).toBe(1);
      expect(trap.pocket).toHaveLength(9);
      expect(trap.seal).toBe(cellAt(22, 1));
      expect(session.stats.traps).toHaveLength(1);
      expect(session.stats.traps[0]?.seat).toBe(1);
    });
  });

  describe('session stats', () => {
    it('tracks points (including a both), cellsLaid, and longestRoundSeconds over a scripted match to 3 points', () => {
      // 4-round match to 3 points:
      // Round 1: Seat 1 turns up immediately into top border wall (10 steps = 150 ticks). Point to Seat 0.
      // Round 2: Head-on mutual crash on step 11 (165 ticks). Point to both.
      // Round 3: Seat 0 turns up immediately into top border wall (10 steps = 150 ticks). Point to Seat 1.
      // Round 4: Seat 1 turns up immediately into top border wall (10 steps = 150 ticks). Point to Seat 0.
      // Final score: 3–2 for Seat 0.
      const round1Runs: [Run[], Run[]] = [[['right', 20]], [['up', 12]]];
      const round2Runs: [Run[], Run[]] = [[['right', 20]], [['left', 20]]];
      const round3Runs: [Run[], Run[]] = [[['up', 12]], [['left', 20]]];
      const round4Runs: [Run[], Run[]] = [[['right', 20]], [['up', 12]]];

      const allRounds = [round1Runs, round2Runs, round3Runs, round4Runs];
      let currentRound = 0;

      const driver0: SeatDriver = {
        stick(match) {
          const roundPlan = allRounds[match.round - 1] ?? allRounds[0];
          const runs = roundPlan?.[0] ?? [];
          const headings = plannedHeadings(runs);
          return stickFor(headings[match.steps]);
        },
      };

      const driver1: SeatDriver = {
        stick(match) {
          const roundPlan = allRounds[match.round - 1] ?? allRounds[0];
          const runs = roundPlan?.[1] ?? [];
          const headings = plannedHeadings(runs);
          return stickFor(headings[match.steps]);
        },
      };

      const session = createMatchSession({
        setup: {
          rules: variationRules(1),
          players: 2,
          switches: ['B', 'B'],
          target: 3,
        },
        drivers: [driver0, driver1],
        onEvent(event) {
          if (event.type === 'round') {
            currentRound = event.round;
          }
        },
      });

      while (!session.over) {
        session.advance(0.02);
      }

      expect(session.over).toBe(true);
      expect(currentRound).toBe(4);
      expect(session.match.riders[0]?.score).toBe(3);
      expect(session.match.riders[1]?.score).toBe(2);

      // Points array: seat 0 (rd 1), both (rd 2), seat 1 (rd 3), seat 0 (rd 4)
      expect(session.stats.points).toEqual([0, 'both', 1, 0]);

      // Round durations: round 2 had 11 steps = 165 ticks = 3.3s; rounds 1, 3, 4 had 10 steps = 150 ticks = 3.0s
      expect(session.stats.longestRoundSeconds).toBeCloseTo(3.3, 2);

      // Cells laid: each rider laid cells on each step
      expect(session.stats.cellsLaid[0]).toBeGreaterThan(0);
      expect(session.stats.cellsLaid[1]).toBeGreaterThan(0);
      expect(session.stats.cellsLaid[0]).toBe(41);
      expect(session.stats.cellsLaid[1]).toBe(41);
    });
  });

  describe('solo play (players: 1)', () => {
    it('never calls seat 1 driver', () => {
      let driver1Called = false;
      const driver1: SeatDriver = {
        stick() {
          driver1Called = true;
          return IDLE;
        },
        hear() {
          driver1Called = true;
        },
      };

      let driver0Calls = 0;
      const driver0: SeatDriver = {
        stick() {
          driver0Calls++;
          return IDLE;
        },
      };

      const session = createMatchSession({
        setup: {
          rules: variationRules(1),
          players: 1,
          switches: ['B', 'B'],
          target: 10,
        },
        drivers: [driver0, driver1],
      });

      session.advance(0.2); // 10 ticks
      expect(driver0Calls).toBe(10);
      expect(driver1Called).toBe(false);
    });
  });

  describe('post-over behavior', () => {
    it('runs no more ticks after match is over', () => {
      let driverCalls = 0;
      const driver: SeatDriver = {
        stick() {
          driverCalls++;
          return IDLE;
        },
      };

      const session = createMatchSession({
        setup: {
          rules: variationRules(1),
          players: 1,
          switches: ['B', 'B'],
          target: 10,
        },
        drivers: [driver, idleDriver()],
      });

      // Advance until rider 0 crashes into right wall
      while (!session.over) {
        session.advance(0.02);
      }

      expect(session.over).toBe(true);
      const finalTick = session.match.tick;
      const callsBefore = driverCalls;

      // Further advances do nothing to match or drivers
      session.advance(1.0);
      expect(session.match.tick).toBe(finalTick);
      expect(driverCalls).toBe(callsBefore);
    });
  });

  describe('determinism', () => {
    it('produces identical event logs for identical drivers and advances', () => {
      const storyRuns: [readonly Run[], readonly Run[]] = [
        [
          ['right', 3],
          ['up', 4],
          ['right', 4],
          ['down', 5],
        ],
        [
          ['down', 4],
          ['left', 5],
          ['up', 4],
          ['right', 2],
        ],
      ];

      function runSimulation(): SessionEvent[] {
        const events: SessionEvent[] = [];
        const session = createMatchSession({
          setup: {
            rules: variationRules(1),
            players: 2,
            switches: ['B', 'B'],
            target: 5,
          },
          drivers: [plannedDriver(storyRuns[0]), plannedDriver(storyRuns[1])],
          onEvent(event) {
            events.push(event);
          },
        });

        for (let i = 0; i < 50; i++) {
          session.advance(0.03);
        }
        return events;
      }

      const log1 = runSimulation();
      const log2 = runSimulation();

      expect(log1).toEqual(log2);
      expect(log1.length).toBeGreaterThan(0);
    });
  });

  describe('swapping the view', () => {
    it('draws a new view as the match stands and disposes the old one', () => {
      const first = createFakeView();
      const session = createMatchSession({
        setup: { rules: variationRules(1), players: 2, switches: ['B', 'B'], target: 10 },
        drivers: [idleDriver(), idleDriver()],
        view: first,
      });
      for (let frame = 0; frame < 20; frame++) session.advance(0.1);
      const laidSoFar = first.calls
        .filter((call) => call.method === 'step')
        .flatMap((call) => call.args[0] as readonly Laid[]);

      const second = createFakeView();
      session.setView(second);

      expect(first.calls.at(-1)?.method).toBe('dispose');
      expect(second.calls.map((call) => call.method)).toEqual([
        'setRemix',
        'reset',
        'shrink',
        'step',
        'placeRider',
        'placeRider',
        'setSpeedStage',
      ]);
      const redrawn = second.calls[3]?.args[0] as readonly Laid[];
      expect(new Set(redrawn.map((laid) => laid.cell))).toEqual(
        new Set(laidSoFar.map((laid) => laid.cell)),
      );
      expect(second.calls[4]?.args).toEqual([
        0,
        session.match.riders[0]?.cell,
        session.match.riders[0]?.heading,
      ]);
    });
  });
});
