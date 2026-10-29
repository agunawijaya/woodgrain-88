/**
 * The Den TV's picture when the cartridge is in: Rosa hunting Moss across the
 * Neon Grid, silent, one short match after another. It is small and cheap: a
 * low-quality stage at the TV's size, the lighter effects, drawn at a TV's
 * pace rather than every frame. With reduced motion, or where the browser
 * draws in software, it holds one moment of a duel with long trails down.
 */
import type { Stage } from '@woodgrain-88/arena';
import {
  createLoop,
  createRng,
  type Appearance,
  type DemoContext,
  type DemoHandle,
} from '@woodgrain-88/kit';
import { createKidRider } from '../ai/kid.ts';
import { variationRules } from '../engine/variations.ts';
import { TICKS_PER_SECOND, type MatchSetup } from '../engine/types.ts';
import type { TrailView } from '../look/look.ts';
import { createLookStage, LOOKS, paintBackground } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';
import { createMatchSession, type MatchSession } from '../session/match-session.ts';

/** Short matches, so the TV moves on to a fresh board often. */
const DEMO_SETUP: MatchSetup = {
  rules: variationRules(1),
  players: 2,
  switches: ['B', 'B'],
  target: 5,
};

/** How long the frozen final board stays up before the next match. */
const HOLD_SECONDS = 3;
/** With reduced motion, how far into a match the held picture is taken: long trails, both riding. */
const STILL_SECONDS = 14;
const PICTURES_PER_SECOND = 30;

/** Whether the browser draws this stage on the processor rather than a graphics card. */
function drawnInSoftware(stage: Stage): boolean {
  const gl = stage.renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const name = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|software/i.test(name);
}

export function createTrailblazeDemo(
  host: HTMLElement,
  seed: number,
  context: DemoContext,
): DemoHandle {
  const look = LOOKS.neon;
  let appearance = context.appearance;
  let matchNumber = 0;
  let heldFor = 0;
  let lastPictureAt = -Infinity;

  const stage = createLookStage({
    host,
    look,
    appearance,
    quality: 'low',
    preserveDrawingBuffer: true,
    size: { width: context.width, height: context.height },
  });
  const holdStill = context.reducedMotion || drawnInSoftware(stage);

  let view = buildView(appearance);
  let session = startMatch();

  function buildView(forAppearance: Appearance): TrailView {
    const next = look.createView({
      stage,
      appearance: forAppearance,
      quality: 'low',
      rng: createRng(`demo/${String(seed)}/view`),
      seats: seatColours(),
      players: 2,
      reducedEffects: true,
    });
    stage.scene.add(next.root);
    return next;
  }

  function startMatch(): MatchSession {
    const kidSeed = `demo/${String(seed)}/${String(matchNumber)}`;
    return createMatchSession({
      setup: DEMO_SETUP,
      drivers: [
        createKidRider({ kid: 'rosa', seat: 0, mode: 'human', seed: `${kidSeed}/rosa` }),
        createKidRider({ kid: 'moss', seat: 1, mode: 'human', seed: `${kidSeed}/moss` }),
      ],
      view,
    });
  }

  function nextMatch(): void {
    stage.scene.remove(view.root);
    session.dispose();
    matchNumber++;
    heldFor = 0;
    view = buildView(appearance);
    session = startMatch();
  }

  function draw(): void {
    lastPictureAt = performance.now();
    stage.render();
  }

  const loop = createLoop({
    hz: TICKS_PER_SECOND,
    autoPause: false,
    update(dt) {
      if (!session.over) {
        session.advance(dt);
        return;
      }
      heldFor += dt;
      session.advance(dt);
      if (heldFor >= HOLD_SECONDS) nextMatch();
    },
    render() {
      if (performance.now() - lastPictureAt < 1000 / PICTURES_PER_SECOND) return;
      draw();
    },
  });

  if (holdStill) {
    const ticks = STILL_SECONDS * TICKS_PER_SECOND;
    for (let tick = 0; tick < ticks && !session.over; tick++) session.advance(1 / TICKS_PER_SECOND);
    draw();
  } else {
    loop.start();
  }

  return {
    surface: stage.canvas,
    setAppearance(next) {
      appearance = next;
      stage.setAppearance(next);
      paintBackground(stage, look, next);
      stage.scene.remove(view.root);
      view = buildView(next);
      session.setView(view);
      draw();
    },
    resize(width, height) {
      stage.setSize(width, height);
      draw();
    },
    pause() {
      loop.pause();
    },
    resume() {
      if (!holdStill) loop.resume();
    },
    dispose() {
      loop.stop();
      session.dispose();
      stage.dispose();
    },
  };
}
