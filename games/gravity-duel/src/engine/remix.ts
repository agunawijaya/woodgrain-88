/**
 * Gravity Duel's Remix rules: our own additions on top of the cartridge's
 * variations. Each one is a small, deterministic change — two stars instead of
 * one, a comet that crosses the field, a ring of rocks, or a duel with no
 * reloads — and everything here is a pure function of the match's tick and its
 * seeded random stream, so the looks and the tests replay the same match.
 */
import { gravityPull } from './physics.ts';
import { CENTRE_X, CENTRE_Y, SUBPIXELS, type Match } from './types.ts';

/** A pulling, possibly deadly, body that is not the cartridge's middle: a binary star, the comet, a rock. */
export interface RemixBody {
  readonly x: number; // subpixels
  readonly y: number;
  readonly radius: number; // steps
}

/** Binary Stars: the pair's orbit radius, turn time, star size and pull strength. */
const BINARY_ORBIT_RADIUS = 14;
const BINARY_ORBIT_TICKS = 1000;
const BINARY_STAR_RADIUS = 4;
const BINARY_STRENGTH = 0.6;

/** Comet: the pass schedule, its edge-to-edge span, height range and pull strength. */
export const COMET_FIRST_TICK = 600;
export const COMET_PERIOD = 1000;
export const COMET_PASS_TICKS = 300;
const COMET_LEFT = -10;
const COMET_RIGHT = 170;
const COMET_Y_MIN = 15;
const COMET_Y_MAX = 75;
const COMET_STRENGTH = 0.8;
/** The comet touches nothing, so its radius is never used for a collision; it only sizes the body. */
const COMET_RADIUS = 4;

/** Asteroid Belt: the rock count, ring radius, rock size and turn time. */
const BELT_ROCK_COUNT = 10;
const BELT_RADIUS = 24;
const BELT_ROCK_RADIUS = 2.5;
const BELT_ORBIT_TICKS = 3000;

/** One comet pass's drawn shape and direction, held for the whole 300 ticks of the pass. */
interface CometPass {
  readonly startTick: number;
  readonly y0: number;
  readonly y1: number;
  readonly leftToRight: boolean;
}

const cometPasses = new WeakMap<Match, CometPass>();

/** Where the two binary stars are at `tick`, one opposite the other on a shared orbit. */
export function binaryStars(tick: number): readonly [RemixBody, RemixBody] {
  const angle = (2 * Math.PI * tick) / BINARY_ORBIT_TICKS;
  return [starAt(angle), starAt(angle + Math.PI)];
}

/** Where the asteroid belt's rocks are at `tick`, evenly spaced on their ring. */
export function beltRocks(tick: number): readonly RemixBody[] {
  const rocks: RemixBody[] = [];
  for (let index = 0; index < BELT_ROCK_COUNT; index++) {
    const angle = (2 * Math.PI * tick) / BELT_ORBIT_TICKS + (2 * Math.PI * index) / BELT_ROCK_COUNT;
    rocks.push(rockAt(angle));
  }
  return rocks;
}

/** Where the comet is at `tick`, or null between passes. */
export function cometAt(match: Readonly<Match>): RemixBody | null {
  const pass = cometPass(match);
  if (!pass) return null;
  const fraction = (match.tick - pass.startTick) / COMET_PASS_TICKS;
  const span = COMET_RIGHT - COMET_LEFT;
  const xSteps = pass.leftToRight ? COMET_LEFT + span * fraction : COMET_RIGHT - span * fraction;
  const ySteps = pass.y0 + (pass.y1 - pass.y0) * fraction;
  return {
    x: Math.round(xSteps * SUBPIXELS),
    y: Math.round(ySteps * SUBPIXELS),
    radius: COMET_RADIUS,
  };
}

/**
 * The pull on a body at (x, y) this tick from every gravity source the match
 * has, in fine units: the cartridge's middle, or the two stars, plus the comet
 * while it crosses. Each source's pull is scaled by its strength and truncated
 * toward zero per component before the sum.
 */
export function pullAt(match: Readonly<Match>, x: number, y: number): { x: number; y: number } {
  const remix = match.setup.rules.remix?.id;
  let pullX = 0;
  let pullY = 0;

  if (remix === 'binary-stars') {
    for (const star of binaryStars(match.tick)) {
      const pull = scaledPull(star.x - x, star.y - y, BINARY_STRENGTH);
      pullX += pull.x;
      pullY += pull.y;
    }
  } else if (match.setup.rules.gravity) {
    const pull = scaledPull(CENTRE_X - x, CENTRE_Y - y, 1);
    pullX += pull.x;
    pullY += pull.y;
  }

  if (remix === 'comet') {
    const comet = cometAt(match);
    if (comet) {
      const pull = scaledPull(comet.x - x, comet.y - y, COMET_STRENGTH);
      pullX += pull.x;
      pullY += pull.y;
    }
  }

  return { x: pullX, y: pullY };
}

/** A star on the pair's orbit at an angle, turning counter-clockwise on screen (y runs down). */
function starAt(angle: number): RemixBody {
  const orbit = BINARY_ORBIT_RADIUS * SUBPIXELS;
  return {
    x: CENTRE_X + Math.round(orbit * Math.cos(angle)),
    y: CENTRE_Y - Math.round(orbit * Math.sin(angle)),
    radius: BINARY_STAR_RADIUS,
  };
}

/** A rock on the belt's ring at an angle, turning counter-clockwise on screen. */
function rockAt(angle: number): RemixBody {
  const orbit = BELT_RADIUS * SUBPIXELS;
  return {
    x: CENTRE_X + Math.round(orbit * Math.cos(angle)),
    y: CENTRE_Y - Math.round(orbit * Math.sin(angle)),
    radius: BELT_ROCK_RADIUS,
  };
}

/** One source's pull, scaled by its strength and truncated toward zero per component. */
function scaledPull(dx: number, dy: number, strength: number): { x: number; y: number } {
  const pull = gravityPull(dx, dy);
  return { x: Math.trunc(pull.x * strength), y: Math.trunc(pull.y * strength) };
}

/** The pass this tick sits in, counted from the first one at 600; null between passes. */
function passIndex(tick: number): number | null {
  const offset = tick - COMET_FIRST_TICK;
  if (offset < 0) return null;
  const within = offset % COMET_PERIOD;
  if (within >= COMET_PASS_TICKS) return null;
  return Math.floor(offset / COMET_PERIOD);
}

/** The pass's drawn shape, created once per pass so every tick of it agrees and the same seed replays. */
function cometPass(match: Readonly<Match>): CometPass | null {
  const index = passIndex(match.tick);
  if (index === null) return null;
  const startTick = COMET_FIRST_TICK + index * COMET_PERIOD;
  const cached = cometPasses.get(match);
  if (cached?.startTick === startTick) return cached;

  const pass: CometPass = {
    startTick,
    y0: match.random.int(COMET_Y_MIN, COMET_Y_MAX),
    y1: match.random.int(COMET_Y_MIN, COMET_Y_MAX),
    leftToRight: index % 2 === 0,
  };
  cometPasses.set(match, pass);
  return pass;
}
