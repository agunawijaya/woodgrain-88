/**
 * Tests for the crash push: `pushWeight`'s timing curve, and the clamp that
 * keeps the framed area to at most half its half-size beyond the board however
 * far off in a corner the crash sits, while still moving toward the crash.
 */
import type { Stage, TableFraming } from '@woodgrain-88/arena';
import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createCrashPush, PUSH_ZOOM, pushWeight } from '../src/look/crash-push.ts';
import { SHORT_CRASH_PAUSE_TICKS } from '../src/engine/match.ts';
import { TICKS_PER_SECOND, type Seat } from '../src/engine/types.ts';
import { HALF_DEPTH, HALF_WIDTH } from '../src/look/board-space.ts';
import type { TrailView } from '../src/look/look.ts';

const SHORT_CRASH_PAUSE_SECONDS = SHORT_CRASH_PAUSE_TICKS / TICKS_PER_SECOND;

const FRAMING: TableFraming = { width: 41, depth: 21, tilt: 55, height: 5, margin: 0.03 };

const noop = (): void => undefined;

/** A stage double that only records the framing the push sets. */
function createFakeStage(): Stage {
  return { setFraming: noop } as unknown as Stage;
}

/** A view double whose riders sit wherever the test puts them. */
function createFakeView(positions: Partial<Record<Seat, Vector3>>): TrailView {
  return {
    root: new Group(),
    reset: noop,
    placeRider: noop,
    step: noop,
    steer: noop,
    setSpeedStage: noop,
    crash: noop,
    trap: noop,
    freeze: noop,
    setRemix: noop,
    shrink: noop,
    riderPosition(seat: Seat, target: Vector3) {
      return target.copy(positions[seat] ?? new Vector3());
    },
    update: noop,
    dispose: noop,
  };
}

describe('pushWeight', () => {
  it('is 0 at the crash itself', () => {
    expect(pushWeight(0)).toBe(0);
  });

  it('holds at 1 from 0.6 s to 3.4 s', () => {
    for (const seconds of [0.6, 1, 2, 3.4]) {
      expect(pushWeight(seconds)).toBe(1);
    }
  });

  it('is back to 0 from 4.2 s', () => {
    for (const seconds of [4.2, 4.5, 10]) {
      expect(pushWeight(seconds)).toBe(0);
    }
  });

  it('never leaves 0–1', () => {
    for (let seconds = -1; seconds <= 6; seconds += 0.05) {
      const weight = pushWeight(seconds);
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });

  it('rises through the ease-in and falls through the ease-out', () => {
    const easeIn = [0, 0.15, 0.3, 0.45, 0.6].map(pushWeight);
    for (let i = 1; i < easeIn.length; i++) {
      expect(easeIn[i]).toBeGreaterThan(easeIn[i - 1] ?? 0);
    }
    const easeOut = [3.4, 3.6, 3.8, 4, 4.2].map(pushWeight);
    for (let i = 1; i < easeOut.length; i++) {
      expect(easeOut[i]).toBeLessThan(easeOut[i - 1] ?? 1);
    }
  });

  it('is 0 well before the shorter crash pause (4.48 s) ends', () => {
    expect(SHORT_CRASH_PAUSE_SECONDS).toBeCloseTo(4.48, 5);
    expect(pushWeight(SHORT_CRASH_PAUSE_SECONDS)).toBe(0);
  });
});

describe('createCrashPush clamp', () => {
  const corners: readonly (readonly [number, number])[] = [
    [-HALF_WIDTH, -HALF_DEPTH],
    [HALF_WIDTH, -HALF_DEPTH],
    [-HALF_WIDTH, HALF_DEPTH],
    [HALF_WIDTH, HALF_DEPTH],
  ];

  it('shows at most half of the pushed half-size beyond the board, for a crash in each corner', () => {
    for (const [x, z] of corners) {
      const view = createFakeView({ 0: new Vector3(x, 0, z) });
      const stage = createFakeStage();
      const push = createCrashPush(stage, () => view, FRAMING);
      const crashedSeats: readonly Seat[] = [0];
      push.start(crashedSeats);
      // Run past the ease-in so the push sits at its held, full weight.
      for (let tick = 0; tick < TICKS_PER_SECOND; tick++) push.update(1 / TICKS_PER_SECOND);

      const halfVisibleWidth = FRAMING.width / PUSH_ZOOM / 2;
      const halfVisibleDepth = FRAMING.depth / PUSH_ZOOM / 2;
      const focusX = -view.root.position.x;
      const focusZ = -view.root.position.z;
      const beyondX = Math.max(0, Math.abs(focusX) + halfVisibleWidth - HALF_WIDTH);
      const beyondZ = Math.max(0, Math.abs(focusZ) + halfVisibleDepth - HALF_DEPTH);
      expect(beyondX).toBeLessThanOrEqual(halfVisibleWidth / 2 + 1e-6);
      expect(beyondZ).toBeLessThanOrEqual(halfVisibleDepth / 2 + 1e-6);
      // The push still leans toward the crash's corner.
      expect(Math.sign(focusX)).toBe(Math.sign(x));
      expect(Math.sign(focusZ)).toBe(Math.sign(z));
    }
  });
});
