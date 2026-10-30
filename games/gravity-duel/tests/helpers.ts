/**
 * Shared builders for the match engine's tests: a match at a chosen variation,
 * a controls object, a tick loop, and a way to park a body at an exact step
 * and velocity instead of flying it there.
 */
import { createMatch, stepMatch } from '../src/engine/match.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  FINE_PER_UNIT,
  IDLE,
  SUBPIXELS,
  type Body,
  type Controls,
  type Match,
  type MatchSetup,
} from '../src/engine/types.ts';
import { variation } from '../src/engine/variations.ts';

export function setupFor(variationNumber: number, overrides: Partial<MatchSetup> = {}): Match {
  const setup: MatchSetup = {
    rules: variation(variationNumber),
    switches: ['B', 'B'],
    target: 10,
    clockTicks: CARTRIDGE_MATCH_TICKS,
    seed: 1,
    ...overrides,
  };
  return createMatch(setup);
}

export function controls(overrides: Partial<Controls> = {}): Controls {
  return { ...IDLE, ...overrides };
}

export function runTicks(
  match: Match,
  n: number,
  seat0: Controls = IDLE,
  seat1: Controls = IDLE,
): void {
  for (let i = 0; i < n; i++) stepMatch(match, [seat0, seat1]);
}

/** Parks a body at a step position with a velocity in whole speed units. */
export function place(body: Body, x: number, y: number, vxUnits = 0, vyUnits = 0): void {
  body.x = x * SUBPIXELS;
  body.y = y * SUBPIXELS;
  body.prevX = body.x;
  body.prevY = body.y;
  body.vx = vxUnits * FINE_PER_UNIT;
  body.vy = vyUnits * FINE_PER_UNIT;
  body.wrapped = false;
}
