/**
 * The game loop (docs/adr/0003-loop-input-seats.md).
 *
 * Real-time games simulate in fixed steps (60 Hz unless a game asks
 * otherwise) so physics, bots and replays behave the same on a 60 Hz laptop
 * and a 144 Hz monitor; rendering runs once per display frame with an
 * interpolation factor between the last two simulated states.
 *
 * Turn-based games use `mode: 'turns'`: nothing ticks, and a frame is drawn
 * only when the game calls `invalidate()`, so a board game idles at zero CPU.
 *
 * Tests and bots drive the same loop headless with `step(n)`.
 */

export interface LoopOptions {
  /** Simulation steps per second for real-time games. Default 60. */
  hz?: number;
  /** 'realtime' ticks continuously; 'turns' only renders on invalidate(). */
  mode?: 'realtime' | 'turns';
  /** One fixed simulation step. `dt` is in seconds (1 / hz); `tick` counts from 0. */
  update?(dt: number, tick: number): void;
  /** Draw. `alpha` in [0, 1) is how far real time has moved past the last step. */
  render?(alpha: number): void;
  /**
   * Called when the page is hidden or loses focus while the loop runs. The
   * loop has already paused itself; the game decides how to show it.
   */
  onAutoPause?(): void;
  /** Pause automatically when the tab is hidden or the window blurs. Default true. */
  autoPause?: boolean;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  pause(): void;
  /** Resumes without a catch-up burst: time spent paused is discarded. */
  resume(): void;
  /** Turn mode: draw one frame soon. Real-time mode: no-op (it draws every frame). */
  invalidate(): void;
  /** Headless: run `count` simulation steps now, then one render. For tests and bots. */
  step(count?: number): void;
  readonly running: boolean;
  readonly paused: boolean;
  /** Simulation steps taken since start. */
  readonly ticks: number;
  /** Frames in which the stall guard dropped time (a long GC pause, a background tab). */
  readonly stalls: number;
}

/** The browser services the loop uses, injectable so tests need no real clock. */
export interface LoopEnvironment {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
  /** Where visibility and blur events come from; null disables auto-pause. */
  page: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
}

function browserEnvironment(): LoopEnvironment {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    page: typeof document === 'undefined' ? null : document,
    window: typeof window === 'undefined' ? null : window,
  };
}

// Never simulate more than this much real time in one display frame. After a
// long stall the game skips ahead instead of fast-forwarding through seconds
// of play in a single frame (the "spiral of death").
const MAX_FRAME_SECONDS = 0.25;

// Frame times arrive as floating-point milliseconds, so a frame that is
// exactly one step long can land a hair short of it; without this tolerance
// such a frame runs no update and the next one runs two.
const STEP_TOLERANCE_SECONDS = 1e-6;

export function createLoop(
  options: LoopOptions,
  env: LoopEnvironment = browserEnvironment(),
): GameLoop {
  const hz = options.hz ?? 60;
  const stepSeconds = 1 / hz;
  const mode = options.mode ?? 'realtime';
  const autoPause = options.autoPause ?? true;

  let running = false;
  let paused = false;
  let ticks = 0;
  let stalls = 0;
  let accumulator = 0;
  let lastTime = 0;
  let frameHandle: number | null = null;

  const simulate = () => {
    options.update?.(stepSeconds, ticks);
    ticks++;
  };

  const scheduleFrame = () => {
    frameHandle ??= env.requestFrame(onFrame);
  };

  function onFrame(time: number) {
    frameHandle = null;
    if (!running || paused) return;
    if (mode === 'turns') {
      options.render?.(0);
      return;
    }
    let elapsed = (time - lastTime) / 1000;
    lastTime = time;
    if (elapsed > MAX_FRAME_SECONDS) {
      elapsed = MAX_FRAME_SECONDS;
      stalls++;
    }
    accumulator += Math.max(0, elapsed);
    while (accumulator >= stepSeconds - STEP_TOLERANCE_SECONDS) {
      simulate();
      accumulator -= stepSeconds;
    }
    accumulator = Math.max(0, accumulator);
    options.render?.(accumulator / stepSeconds);
    scheduleFrame();
  }

  const handleHidden = () => {
    if (!running || paused) return;
    if (env.page && env.page.visibilityState !== 'hidden') return;
    loop.pause();
    options.onAutoPause?.();
  };
  const handleBlur = () => {
    if (!running || paused) return;
    loop.pause();
    options.onAutoPause?.();
  };

  const listen = () => {
    if (!autoPause) return;
    env.page?.addEventListener('visibilitychange', handleHidden);
    env.window?.addEventListener('blur', handleBlur);
  };
  const unlisten = () => {
    env.page?.removeEventListener('visibilitychange', handleHidden);
    env.window?.removeEventListener('blur', handleBlur);
  };

  const cancel = () => {
    if (frameHandle !== null) env.cancelFrame(frameHandle);
    frameHandle = null;
  };

  const loop: GameLoop = {
    start() {
      if (running) return;
      running = true;
      paused = false;
      ticks = 0;
      accumulator = 0;
      lastTime = env.now();
      listen();
      scheduleFrame();
    },
    stop() {
      running = false;
      cancel();
      unlisten();
    },
    pause() {
      if (!running || paused) return;
      paused = true;
      cancel();
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      accumulator = 0;
      lastTime = env.now();
      scheduleFrame();
    },
    invalidate() {
      if (mode === 'turns' && running && !paused) scheduleFrame();
    },
    step(count = 1) {
      for (let i = 0; i < count; i++) simulate();
      options.render?.(0);
    },
    get running() {
      return running;
    },
    get paused() {
      return paused;
    },
    get ticks() {
      return ticks;
    },
    get stalls() {
      return stalls;
    },
  };
  return loop;
}
