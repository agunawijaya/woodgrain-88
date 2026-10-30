/**
 * How each Neighbourhood Kid hunts a flag. Every Kid reasons with the same
 * solver over what it remembers; these numbers are its character on top:
 *
 * - Lou weighs every check for what it will tell him, and walks slowly.
 * - Moss gathers clues until two squares at most remain, and gives bombs a wide berth.
 * - Dee heads straight for the likeliest square and checks things on the way.
 * - Pip wanders half the time and guesses well now and then.
 * - Rosa races you for the squares you are heading to, and stands in your way.
 * - Benny follows your clues and tries to beat you to your conclusion.
 */
import type { KidId, MemoryMode } from '@woodgrain-88/kit';

export interface HuntStyle {
  /** Seconds to decide where to go after learning something. */
  readonly think: number;
  /** Seconds of hesitation after each step. */
  readonly stepPause: number;
  /** Seconds a check is held while the clue is read. */
  readonly read: number;
  /** How much a likely flag square draws the Kid. */
  readonly flagWeight: number;
  /** How much a check that would tell a lot draws it, per bit. */
  readonly infoWeight: number;
  /** How much each step to a square puts it off, in a race against time or a rival. */
  readonly travelCost: number;
  /** Goes straight for the likeliest square once this few remain possible; until then it weighs every check. */
  readonly commitAt: number;
  /** How much a square next to a remembered bomb puts it off. */
  readonly bombShy: number;
  /** Chance of heading for a random nearby square instead of a planned one. */
  readonly wander: number;
  /** Chance of checking a square on the way instead of walking past it. */
  readonly checkOnTheWay: number;
  /** How much it plays against the rival: racing it to squares, following its clues. */
  readonly contest: number;
  /** Chance that a step goes the wrong way. */
  readonly fumble: number;
}

export const HUNT_STYLES: Readonly<Record<KidId, HuntStyle>> = {
  lou: {
    think: 1.1,
    stepPause: 0.3,
    read: 0.7,
    flagWeight: 1.4,
    infoWeight: 1,
    travelCost: 0.06,
    commitAt: 2,
    bombShy: 0.1,
    wander: 0,
    checkOnTheWay: 0,
    contest: 0,
    fumble: 0.01,
  },
  moss: {
    think: 0.8,
    stepPause: 0.1,
    read: 0.6,
    flagWeight: 0.6,
    infoWeight: 1,
    travelCost: 0.08,
    commitAt: 2,
    bombShy: 0.6,
    wander: 0,
    checkOnTheWay: 0,
    contest: 0,
    fumble: 0.02,
  },
  rosa: {
    think: 0.5,
    stepPause: 0.05,
    read: 0.45,
    flagWeight: 2.5,
    infoWeight: 0.7,
    travelCost: 0.08,
    commitAt: 1,
    bombShy: 0.2,
    wander: 0.05,
    checkOnTheWay: 0,
    contest: 1.2,
    fumble: 0.04,
  },
  benny: {
    think: 0.55,
    stepPause: 0.05,
    read: 0.45,
    flagWeight: 2.5,
    infoWeight: 0.6,
    travelCost: 0.08,
    commitAt: 1,
    bombShy: 0.2,
    wander: 0.05,
    checkOnTheWay: 0,
    contest: 0.8,
    fumble: 0.05,
  },
  dee: {
    think: 0.25,
    stepPause: 0,
    read: 0.3,
    flagWeight: 3,
    infoWeight: 0.55,
    travelCost: 0.03,
    commitAt: 1,
    bombShy: 0,
    wander: 0.1,
    checkOnTheWay: 0.3,
    contest: 0.3,
    fumble: 0.05,
  },
  pip: {
    think: 0.45,
    stepPause: 0.05,
    read: 0.35,
    flagWeight: 2.5,
    infoWeight: 0.4,
    travelCost: 0.05,
    commitAt: 1,
    bombShy: 0,
    wander: 0.3,
    checkOnTheWay: 0.15,
    contest: 0,
    fumble: 0.07,
  },
};

/**
 * A Kid's style under the Den's Kid setting. Sharp follows the kit's reflex rule: no wrong steps,
 * and decisions and the stand between steps in half the time; the rest is the Kid's own character.
 */
export function huntStyle(kid: KidId, mode: MemoryMode): HuntStyle {
  const style = HUNT_STYLES[kid];
  if (mode === 'human') return style;
  return { ...style, think: style.think / 2, stepPause: style.stepPause / 2, fumble: 0 };
}

/**
 * Not a Kid: the simulations' perfect hunter, who forgets nothing, never fumbles and weighs every
 * check by what it tells. It measures how hard a field is, and how far each Kid falls short.
 */
export const PERFECT_STYLE: HuntStyle = {
  think: 0.1,
  stepPause: 0,
  read: 0.1,
  flagWeight: 2.5,
  infoWeight: 1,
  travelCost: 0,
  commitAt: 1,
  bombShy: 0,
  wander: 0,
  checkOnTheWay: 0,
  contest: 0,
  fumble: 0,
};
