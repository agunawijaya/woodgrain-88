/**
 * Tests for the game loop: fixed timestep accumulator, stall protection,
 * pause and resume timing, headless step execution, turn mode, and auto-pause.
 */
import { describe, expect, it } from 'vitest';
import type { LoopEnvironment } from '../src/loop.ts';
import { createLoop } from '../src/loop.ts';

interface FakeEnvironmentController {
  env: LoopEnvironment;
  setHidden(hidden: boolean): void;
  dispatchBlur(): void;
  advanceTime(ms: number): void;
  flushFrame(): void;
}

class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

class FakeWindow extends EventTarget {}

function createFakeEnvironment(): FakeEnvironmentController {
  let currentTime = 0;
  let nextHandle = 1;
  const frameCallbacks = new Map<number, (time: number) => void>();
  const page = new FakePage();
  const win = new FakeWindow();

  const env: LoopEnvironment = {
    now: () => currentTime,
    requestFrame: (callback) => {
      const handle = nextHandle++;
      frameCallbacks.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      frameCallbacks.delete(handle);
    },
    page,
    window: win,
  };

  return {
    env,
    setHidden(hidden: boolean) {
      page.visibilityState = hidden ? 'hidden' : 'visible';
      page.dispatchEvent(new Event('visibilitychange'));
    },
    dispatchBlur() {
      win.dispatchEvent(new Event('blur'));
    },
    advanceTime(ms: number) {
      currentTime += ms;
    },
    flushFrame() {
      const callbacks = [...frameCallbacks.values()];
      frameCallbacks.clear();
      for (const callback of callbacks) {
        callback(currentTime);
      }
    },
  };
}

describe('loop', () => {
  it('runs exactly one update and one render per frame when frames are 1/60 s apart at 60 Hz', () => {
    const fake = createFakeEnvironment();
    let updates = 0;
    let renders = 0;
    const loop = createLoop(
      {
        hz: 60,
        update: () => {
          updates++;
        },
        render: () => {
          renders++;
        },
      },
      fake.env,
    );

    loop.start();
    const frameStepMs = 1000 / 60;
    for (let frame = 1; frame <= 5; frame++) {
      fake.advanceTime(frameStepMs);
      fake.flushFrame();
      expect(updates).toBe(frame);
      expect(renders).toBe(frame);
    }

    loop.stop();
  });

  it('runs three updates and renders with alpha in [0, 1) for a 50 ms frame at 60 Hz', () => {
    const fake = createFakeEnvironment();
    let updates = 0;
    let renderedAlpha = -1;
    const loop = createLoop(
      {
        hz: 60,
        update: () => {
          updates++;
        },
        render: (alpha) => {
          renderedAlpha = alpha;
        },
      },
      fake.env,
    );

    loop.start();
    fake.advanceTime(50);
    fake.flushFrame();

    expect(updates).toBe(3);
    expect(renderedAlpha).toBeGreaterThanOrEqual(0);
    expect(renderedAlpha).toBeLessThan(1);

    loop.stop();
  });

  it('caps updates at at most 15 for a 2-second frame at 60 Hz and increments stalls', () => {
    const fake = createFakeEnvironment();
    let updates = 0;
    const loop = createLoop(
      {
        hz: 60,
        update: () => {
          updates++;
        },
      },
      fake.env,
    );

    loop.start();
    expect(loop.stalls).toBe(0);

    fake.advanceTime(2000);
    fake.flushFrame();

    expect(updates).toBe(15);
    expect(loop.stalls).toBe(1);

    loop.stop();
  });

  it('stops updates on pause and discards paused time on resume without a catch-up burst', () => {
    const fake = createFakeEnvironment();
    let updates = 0;
    const loop = createLoop(
      {
        hz: 60,
        update: () => {
          updates++;
        },
      },
      fake.env,
    );

    loop.start();
    fake.advanceTime(1000 / 60);
    fake.flushFrame();
    expect(updates).toBe(1);

    loop.pause();
    expect(loop.paused).toBe(true);

    fake.advanceTime(3000);
    fake.flushFrame();
    expect(updates).toBe(1);

    loop.resume();
    expect(loop.paused).toBe(false);

    fake.advanceTime(1000 / 60);
    fake.flushFrame();
    expect(updates).toBe(2);

    loop.stop();
  });

  it('runs five updates synchronously and one render with alpha 0 on step(5) without frames', () => {
    const fake = createFakeEnvironment();
    let updates = 0;
    const renders: number[] = [];
    const loop = createLoop(
      {
        hz: 60,
        update: () => {
          updates++;
        },
        render: (alpha) => {
          renders.push(alpha);
        },
      },
      fake.env,
    );

    loop.step(5);
    expect(updates).toBe(5);
    expect(loop.ticks).toBe(5);
    expect(renders).toEqual([0]);
  });

  it('runs no updates on frames in turn mode, schedules one render on invalidate, and ignores invalidate when paused', () => {
    const fake = createFakeEnvironment();
    let updates = 0;
    let renders = 0;
    const loop = createLoop(
      {
        mode: 'turns',
        update: () => {
          updates++;
        },
        render: () => {
          renders++;
        },
      },
      fake.env,
    );

    loop.start();
    // Turn mode start() schedules initial render frame
    fake.advanceTime(16);
    fake.flushFrame();
    expect(updates).toBe(0);
    expect(renders).toBe(1);

    // Subsequent frame tick without invalidate does not trigger render
    fake.advanceTime(100);
    fake.flushFrame();
    expect(renders).toBe(1);

    // Multiple calls to invalidate collapse into exactly one scheduled render
    loop.invalidate();
    loop.invalidate();
    fake.advanceTime(16);
    fake.flushFrame();
    expect(renders).toBe(2);
    expect(updates).toBe(0);

    // invalidate while paused does not schedule renders
    loop.pause();
    loop.invalidate();
    fake.advanceTime(16);
    fake.flushFrame();
    expect(renders).toBe(2);

    loop.stop();
  });

  it('auto-pauses on hidden visibility and window blur, respects autoPause false, and stops listeners on stop', () => {
    const fake = createFakeEnvironment();
    let autoPauseEvents = 0;
    const loop = createLoop(
      {
        autoPause: true,
        onAutoPause: () => {
          autoPauseEvents++;
        },
      },
      fake.env,
    );

    loop.start();
    fake.setHidden(true);
    expect(loop.paused).toBe(true);
    expect(autoPauseEvents).toBe(1);

    loop.resume();
    fake.dispatchBlur();
    expect(loop.paused).toBe(true);
    expect(autoPauseEvents).toBe(2);

    loop.stop();
    fake.dispatchBlur();
    expect(autoPauseEvents).toBe(2);

    let noAutoPauseEvents = 0;
    const loopDisabled = createLoop(
      {
        autoPause: false,
        onAutoPause: () => {
          noAutoPauseEvents++;
        },
      },
      fake.env,
    );
    loopDisabled.start();
    fake.setHidden(true);
    fake.dispatchBlur();
    expect(loopDisabled.paused).toBe(false);
    expect(noAutoPauseEvents).toBe(0);
    loopDisabled.stop();
  });

  it('configures dt to 1/30 and tick counting from 0 when hz is 30', () => {
    const fake = createFakeEnvironment();
    const ticks: { dt: number; tick: number }[] = [];
    const loop = createLoop(
      {
        hz: 30,
        update: (dt, tick) => {
          ticks.push({ dt, tick });
        },
      },
      fake.env,
    );

    loop.step(3);
    expect(ticks).toEqual([
      { dt: 1 / 30, tick: 0 },
      { dt: 1 / 30, tick: 1 },
      { dt: 1 / 30, tick: 2 },
    ]);
  });

  it('tells its owner when it is stopped, so a list of loops can let it go', () => {
    const fake = createFakeEnvironment();
    let stops = 0;
    const loop = createLoop({ update: () => undefined, onStop: () => stops++ }, fake.env);
    loop.start();
    loop.pause();
    expect(stops).toBe(0);
    loop.stop();
    expect(stops).toBe(1);
    expect(loop.running).toBe(false);
  });
});
