/**
 * The Den TV's picture when the cartridge is in: two Kids duelling, silent,
 * on a few channels in turn (a maze of ricochets, biplanes in the clouds,
 * guided shells round sandbags, jets). It is small and cheap: a low-quality
 * stage at the TV's size, kept readable for the CRT to copy, no camera shake
 * and the lighter explosions, drawn at a TV's pace rather than every frame.
 * With reduced motion it holds one moment of a duel, as the Den's own slates
 * do, and so it does where the browser draws in software: there every moving
 * picture would cost the whole page its speed.
 */
import { createStage, type Stage } from '@woodgrain-88/arena';
import {
  createLoop,
  createRng,
  type DemoContext,
  type DemoHandle,
  type GameLoop,
  type KidId,
  type LoopOptions,
} from '@woodgrain-88/kit';
import { channelById } from '../engine/channels.ts';
import { framingFor } from '../render/framing.ts';
import { createMatchSession, type MatchSession } from '../session/match-session.ts';

/** What the TV cycles through, with who plays: busy channels that read at 320 × 240. */
const PROGRAMME: readonly { readonly channel: string; readonly kids: readonly [KidId, KidId] }[] = [
  { channel: 'game-6', kids: ['dee', 'moss'] },
  { channel: 'game-15', kids: ['rosa', 'benny'] },
  { channel: 'game-1', kids: ['lou', 'pip'] },
  { channel: 'game-21', kids: ['dee', 'rosa'] },
  { channel: 'game-9', kids: ['moss', 'lou'] },
];

/** Seconds a channel stays on before the TV moves to the next. */
const SHOW_SECONDS = 40;
/** With reduced motion, how far into the duel the held picture is taken: both sides in play. */
const STILL_SECONDS = 9;
/** Simulation steps a second, as the kit loop runs them. */
const STEPS_PER_SECOND = 60;
/** Pictures a second the TV draws: one the CRT copies at 320 × 240 needs no more. */
const PICTURES_PER_SECOND = 30;

/** Whether the browser draws this stage on the processor rather than a graphics card. */
function drawnInSoftware(stage: Stage): boolean {
  const gl = stage.renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const name = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|software/i.test(name);
}

export function createTankDemo(host: HTMLElement, seed: number, context: DemoContext): DemoHandle {
  const rng = createRng(`demo/${seed}`);
  let appearance = context.appearance;
  let index = seed % PROGRAMME.length;
  const loops = new Set<GameLoop>();
  let paused = false;

  const stage: Stage = createStage({
    host,
    appearance,
    quality: 'low',
    framing: framingFor(channelById(PROGRAMME[index]?.channel ?? 'game-1'), 0),
    maxPixelRatio: 1,
    preserveDrawingBuffer: true,
    size: { width: context.width, height: context.height },
  });

  // A still picture instead of a moving one: asked for, or forced by drawing in software.
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
  let switchTimer: ReturnType<typeof setTimeout> | null = null;

  function show(): void {
    const item = PROGRAMME[index] ?? PROGRAMME[0];
    if (!item) return;
    const channel = channelById(item.channel);
    session?.dispose();
    for (const loop of loops) loop.stop();
    loops.clear();
    stage.setFraming(framingFor(channel, 0));
    session = createMatchSession({
      stage,
      hudHost: null,
      channel,
      match: { scoring: 'timed', handicap: [false, false], wiring: false },
      drivers: [
        { kind: 'kid', kid: item.kids[0] },
        { kind: 'kid', kid: item.kids[1] },
      ],
      seats: [
        { name: '', note: '' },
        { name: '', note: '' },
      ],
      appearance,
      reducedMotion: context.reducedMotion,
      explosions: 'reduced',
      shake: false,
      rng: rng.fork(`show-${index}`),
      createLoop: demoLoop,
      input: null,
      favour: 'either',
      onOver: next,
    });
    session.start();
    if (holdStill) {
      for (const loop of loops) {
        loop.pause();
        loop.step(STILL_SECONDS * STEPS_PER_SECOND);
      }
      return;
    }
    if (paused) for (const loop of loops) loop.pause();
    else scheduleNext();
  }

  function scheduleNext(): void {
    if (switchTimer !== null) clearTimeout(switchTimer);
    switchTimer = setTimeout(next, SHOW_SECONDS * 1000);
  }

  function next(): void {
    index = (index + 1) % PROGRAMME.length;
    show();
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
    setAppearance(nextAppearance) {
      appearance = nextAppearance;
      stage.setAppearance(nextAppearance);
      session?.setAppearance(nextAppearance);
      redrawHeld();
    },
    resize(width, height) {
      stage.setSize(width, height);
      redrawHeld();
    },
    pause() {
      paused = true;
      if (switchTimer !== null) clearTimeout(switchTimer);
      for (const loop of loops) loop.pause();
    },
    resume() {
      paused = false;
      if (holdStill) return;
      for (const loop of loops) loop.resume();
      scheduleNext();
    },
    dispose() {
      if (switchTimer !== null) clearTimeout(switchTimer);
      session?.dispose();
      for (const loop of loops) loop.stop();
      stage.dispose();
    },
  };
}
