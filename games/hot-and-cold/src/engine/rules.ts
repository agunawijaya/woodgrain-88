/**
 * The rules of a match: how the seats take part, how the flag behaves and
 * what ends the game. The ten cartridge variations are kept exactly as the
 * 1978 program plays them (decoded from its variation table; see NOTES.md):
 *
 * - 1: a race, both seats at once, flag still, first to 15 captures.
 * - 2–4: turns, one check each in turn, flag still / bouncing / wrapping, first to 15, 15 and
 *   75 (variation 4 inherits the 75 meant for the check-counting games: a slip we keep).
 * - 5–7: hunt for hunt: the seats take whole hunts in turn and every check counts against them,
 *   like golf; when a seat's total reaches 75 the other gets one last, equal turn.
 * - 8–10: one seat against a 75-tick clock, catching as many flags as it can.
 *
 * Timings are counted in ticks of the original's per-player update, about 39 ms, so every pause
 * lasts exactly as long as it did.
 */
import { CARTRIDGE_COMPOSITION, type Composition } from './board.ts';

/** How the seats share the field. */
export type PlayStyle = 'race' | 'turns' | 'hunts' | 'clock';
/** How the flag behaves after each check that misses it. */
export type FlagMotion = 'still' | 'bounce' | 'wrap';
/** A seat's difficulty switch: A is the expert's handicap. */
export type DifficultySwitch = 'A' | 'B';

export interface Rules {
  readonly style: PlayStyle;
  readonly motion: FlagMotion;
  /**
   * Race and turns: captures that win. Hunts: the check total that ends the game. Clock: ticks on
   * the clock.
   */
  readonly goal: number;
  readonly composition: Composition;
  /** Flags hidden at once; clues point to the nearer one. */
  readonly flags: 1 | 2;
  /** Squares a moving flag travels after each miss. */
  readonly flagSteps: number;
  /** End the match at the first capture: a daily field or a micro-challenge. */
  readonly singleHunt: boolean;
}

export interface Variation {
  /** The game number on the cartridge, 1–10. */
  readonly number: number;
  readonly rules: Rules;
}

const BASE = {
  composition: CARTRIDGE_COMPOSITION,
  flags: 1,
  flagSteps: 1,
  singleHunt: false,
} as const;

export const CARTRIDGE_VARIATIONS: readonly Variation[] = [
  { number: 1, rules: { ...BASE, style: 'race', motion: 'still', goal: 15 } },
  { number: 2, rules: { ...BASE, style: 'turns', motion: 'still', goal: 15 } },
  { number: 3, rules: { ...BASE, style: 'turns', motion: 'bounce', goal: 15 } },
  { number: 4, rules: { ...BASE, style: 'turns', motion: 'wrap', goal: 75 } },
  { number: 5, rules: { ...BASE, style: 'hunts', motion: 'still', goal: 75 } },
  { number: 6, rules: { ...BASE, style: 'hunts', motion: 'bounce', goal: 75 } },
  { number: 7, rules: { ...BASE, style: 'hunts', motion: 'wrap', goal: 75 } },
  { number: 8, rules: { ...BASE, style: 'clock', motion: 'still', goal: 75 } },
  { number: 9, rules: { ...BASE, style: 'clock', motion: 'bounce', goal: 75 } },
  { number: 10, rules: { ...BASE, style: 'clock', motion: 'wrap', goal: 75 } },
];

export function cartridgeRules(number: number): Rules {
  const variation = CARTRIDGE_VARIATIONS.find((entry) => entry.number === number);
  if (!variation) throw new RangeError(`there is no variation ${number} on the cartridge`);
  return variation.rules;
}

/** The Short match length: first to 5 captures, 25 checks a seat, or a 30-tick clock. */
export function shortened(rules: Rules): Rules {
  const goal = { race: 5, turns: 5, hunts: 25, clock: 30 }[rules.style];
  return { ...rules, goal: Math.min(rules.goal, goal) };
}

/** Seconds per tick: two frames of the original's fifty-odd per second. */
export const TICK_SECONDS = 2 / 50.77;

/** Ticks between steps while a direction is held; switch A in the race slows the expert. */
export const STEP_TICKS = 16;
export const SLOW_STEP_TICKS = 20;
/** After a step, the reveal button wakes up again this many ticks later. */
export const SETTLE_TICKS = 7;
/** In turns, the next seat waits this long before it may check. */
export const TURN_DELAY_TICKS = 15;
/** The blast before a bombed explorer goes home. */
export const BOMB_TICKS = 8;
/** The celebration after a capture; the other seat is frozen meanwhile. */
export const CAPTURE_TICKS = 32;
/** One tick of the clock in the clock games. */
export const CLOCK_TICK_TICKS = 31;

/** Only the first variation slows an expert's steps; the rest ignore the switch for movement. */
export function slowsStepsOnA(rules: Rules): boolean {
  return rules.style === 'race' && rules.motion === 'still';
}

/** In hunt for hunt, switch A counts every check twice. */
export function doublesChecksOnA(rules: Rules): boolean {
  return rules.style === 'hunts';
}
