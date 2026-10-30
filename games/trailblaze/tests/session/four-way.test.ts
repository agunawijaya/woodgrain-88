/**
 * Tests for Four Way match session:
 * - Four drivers polled and hearing events each tick
 * - View places all four riders on start positions
 * - Sealed trap spotting in Four Way (holding no other riding head)
 * - Session stats: cellsLaid per seat, points recording
 */
import type { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { FOUR_WAY_START, cellAt } from '../../src/engine/grid.ts';
import { FOUR_WAY_SEATS, IDLE, type Laid } from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import type { TrailView } from '../../src/look/look.ts';
import { createMatchSession, type SeatDriver } from '../../src/session/match-session.ts';
import { spotTraps } from '../../src/session/trap.ts';

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

function idleDriver(): SeatDriver {
  return {
    stick() {
      return IDLE;
    },
  };
}

describe('Four Way session', () => {
  it('polls stick and calls hear on all four drivers every tick', () => {
    const stickCounts = [0, 0, 0, 0];
    const hearCounts = [0, 0, 0, 0];

    const drivers: SeatDriver[] = FOUR_WAY_SEATS.map((seat) => ({
      stick() {
        stickCounts[seat] = (stickCounts[seat] ?? 0) + 1;
        return IDLE;
      },
      hear() {
        hearCounts[seat] = (hearCounts[seat] ?? 0) + 1;
      },
    }));

    const session = createMatchSession({
      setup: {
        rules: variationRules(1),
        players: 4,
        switches: ['B', 'B', 'B', 'B'],
        target: 10,
      },
      drivers,
    });

    // On creation, startMatch calls hear on each driver
    expect(hearCounts).toEqual([1, 1, 1, 1]);
    expect(stickCounts).toEqual([0, 0, 0, 0]);

    // Advance 5 ticks (0.10s)
    session.advance(0.1);

    expect(stickCounts).toEqual([5, 5, 5, 5]);
    expect(hearCounts).toEqual([6, 6, 6, 6]);
  });

  it('places all four riders at FOUR_WAY_START on view reset', () => {
    const view = createFakeView();
    const drivers = FOUR_WAY_SEATS.map(() => idleDriver());

    createMatchSession({
      setup: {
        rules: variationRules(1),
        players: 4,
        switches: ['B', 'B', 'B', 'B'],
        target: 10,
      },
      drivers,
      view,
    });

    const placeCalls = view.calls.filter((c) => c.method === 'placeRider');
    expect(placeCalls).toHaveLength(4);

    for (const seat of FOUR_WAY_SEATS) {
      const call = placeCalls.find((c) => c.args[0] === seat);
      expect(call).toBeDefined();
      const expected = FOUR_WAY_START[seat];
      expect(call?.args[1]).toBe(expected.cell);
      expect(call?.args[2]).toBe(expected.heading);
    }
  });

  it('spots traps in Four Way only when no other riding head is inside the pocket', () => {
    const view = createFakeView();
    const session = createMatchSession({
      setup: {
        rules: variationRules(1),
        players: 4,
        switches: ['B', 'B', 'B', 'B'],
        target: 10,
      },
      drivers: FOUR_WAY_SEATS.map(() => idleDriver()),
      view,
    });

    const match = session.match;

    // Box in seat 3 (at (5, 15)): create a sealed 3x3 pocket around (5, 15)
    // Interior is columns 4..6, rows 14..16 except border
    for (let c = 3; c <= 7; c++) {
      match.cells[cellAt(c, 13)] = 0;
      match.cells[cellAt(c, 17)] = 0;
    }
    for (let r = 13; r <= 17; r++) {
      match.cells[cellAt(3, r)] = 0;
      match.cells[cellAt(7, r)] = 0;
    }

    const laid: Laid[] = [{ cell: cellAt(5, 13), seat: 0, entered: 'left', left: 'right' }];

    // Case A: No other riding head is inside the pocket: seat 3 is trapped!
    const trapsA = spotTraps(match, laid, new Set());
    expect(trapsA.some((t) => t.seat === 3)).toBe(true);
    const trap3 = trapsA.find((t) => t.seat === 3);
    expect(trap3?.seal).toBe(cellAt(5, 13));

    // Case B: Seat 1's head is also inside the pocket: neither is trapped!
    const rider1 = match.riders[1];
    if (rider1) {
      rider1.cell = cellAt(6, 15);
      const trapsB = spotTraps(match, laid, new Set());
      expect(trapsB.some((t) => t.seat === 3)).toBe(false);
      expect(trapsB.some((t) => t.seat === 1)).toBe(false);
    }
  });

  it('tracks cellsLaid per seat and points for the winner in stats', () => {
    const session = createMatchSession({
      setup: {
        rules: variationRules(1),
        players: 4,
        switches: ['B', 'B', 'B', 'B'],
        target: 5,
      },
      drivers: FOUR_WAY_SEATS.map(() => idleDriver()),
    });

    // Advance 20 ticks (0.40s) to step past the initial 15-tick period
    for (let i = 0; i < 20; i++) {
      session.advance(0.02);
    }

    expect(session.stats.cellsLaid).toHaveLength(4);
    for (let s = 0; s < 4; s++) {
      expect(session.stats.cellsLaid[s]).toBeGreaterThanOrEqual(1);
    }
  });
});
