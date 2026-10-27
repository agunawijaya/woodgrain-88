/**
 * The Den TV's picture when the cartridge is in: two Kids racing for the flag
 * on the Polar snowfield, silent, one field after another. It is small and
 * cheap: a low-quality stage at the TV's size, kept readable for the CRT to
 * copy, the lighter effects, drawn at a TV's pace rather than every frame.
 * With reduced motion it holds one moment of a hunt, as the Den's own slates
 * do, and so it does where the browser draws in software.
 */
import type { Stage } from '@woodgrain-88/arena';
import {
  createLoop,
  type DemoContext,
  type DemoHandle,
  type GameLoop,
  type KidId,
  type LoopOptions,
} from '@woodgrain-88/kit';
import { cartridgeRules, TICK_SECONDS } from '../engine/rules.ts';
import { createLookStage, LOOKS, paintBackground } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';
import { createMatchSession, type MatchSession } from '../session/match-session.ts';

/** Who races on the TV, in turn: pairs whose styles read differently at 320 × 240. */
const PAIRS: readonly (readonly [KidId, KidId])[] = [
  ['lou', 'dee'],
  ['moss', 'pip'],
  ['rosa', 'benny'],
];

/** With reduced motion, how far into the race the held picture is taken: clues on the snow. */
const STILL_SECONDS = 16;
const PICTURES_PER_SECOND = 30;

/** Whether the browser draws this stage on the processor rather than a graphics card. */
function drawnInSoftware(stage: Stage): boolean {
  const gl = stage.renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const name = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|software/i.test(name);
}

export function createHotColdDemo(
  host: HTMLElement,
  seed: number,
  context: DemoContext,
): DemoHandle {
  const look = LOOKS.polar;
  let appearance = context.appearance;
  let round = seed;
  const loops = new Set<GameLoop>();
  let paused = false;

  const stage = createLookStage({
    host,
    look,
    appearance,
    quality: 'low',
    preserveDrawingBuffer: true,
    size: { width: context.width, height: context.height },
  });
  const holdStill = context.reducedMotion || drawnInSoftware(stage);
  const pictureGapMs = 1000 / PICTURES_PER_SECOND;
  let lastPictureAt = -Infinity;

  function demoLoop(options: LoopOptions): GameLoop {
    const loop = createLoop({
      ...options,
      autoPause: false,
      render: (alpha) => {
        const now = performance.now();
        if (now - lastPictureAt < pictureGapMs) return;
        lastPictureAt = now;
        options.render?.(alpha);
      },
    });
    loops.add(loop);
    return loop;
  }

  let session: MatchSession | null = null;

  function show(): void {
    const kids = PAIRS[round % PAIRS.length] ?? PAIRS[0];
    if (!kids) return;
    session?.dispose();
    for (const loop of loops) loop.stop();
    loops.clear();
    const colours = seatColours();
    session = createMatchSession({
      stage,
      look,
      hudHost: null,
      pointerArea: null,
      rules: cartridgeRules(1),
      seed: `demo/${String(round)}`,
      switches: ['B', 'B'],
      drivers: [
        { kind: 'kid', kid: kids[0] },
        { kind: 'kid', kid: kids[1] },
      ],
      seats: [
        { name: '', note: '', colours: colours[0] },
        { name: '', note: '', colours: colours[1] },
      ],
      clues: 'notebook',
      memory: 'human',
      fog: false,
      appearance,
      quality: 'low',
      reducedMotion: context.reducedMotion,
      reducedEffects: true,
      cluePalette: 'thermal',
      createLoop: demoLoop,
      input: null,
      onOver: () => {
        round++;
        show();
      },
    });
    session.start();
    if (holdStill) {
      for (const loop of loops) {
        loop.pause();
        loop.step(Math.round(STILL_SECONDS / TICK_SECONDS));
      }
      return;
    }
    if (paused) for (const loop of loops) loop.pause();
  }

  /** A held picture is drawn again by hand: its loop is paused. */
  function redrawHeld(): void {
    if (!holdStill) return;
    lastPictureAt = -Infinity;
    for (const loop of loops) loop.step(0);
  }

  show();

  return {
    surface: stage.canvas,
    setAppearance(next) {
      appearance = next;
      stage.setAppearance(next);
      paintBackground(stage, look, next);
      session?.setAppearance(next);
      redrawHeld();
    },
    resize(width, height) {
      stage.setSize(width, height);
      redrawHeld();
    },
    pause() {
      paused = true;
      for (const loop of loops) loop.pause();
    },
    resume() {
      paused = false;
      if (holdStill) return;
      for (const loop of loops) loop.resume();
    },
    dispose() {
      session?.dispose();
      for (const loop of loops) loop.stop();
      stage.dispose();
    },
  };
}
