/**
 * Every one of the 17 variations, flown by Kids for 3,000 ticks, with the
 * impossible checked after every tick: bodies off the field or out of whole
 * numbers, speeds past the fold, bars out of range, the wrong kind of event for
 * the mode, a solo run's empty seat moving, the clock skipping.
 */
import { describe, expect, it } from 'vitest';
import { createKidPilot, type KidPilot } from '../src/ai/pilot.ts';
import { createMatch, stepMatch } from '../src/engine/match.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  IDLE,
  SUBPIXELS,
  type Body,
  type Controls,
  type Match,
  type MatchEvent,
} from '../src/engine/types.ts';
import { VARIATIONS, variation } from '../src/engine/variations.ts';

const SMOKE_TICKS = 3_000;
const WIDTH = FIELD_WIDTH * SUBPIXELS;
const HEIGHT = FIELD_HEIGHT * SUBPIXELS;

function smokeMatch(number: number): Match {
  return createMatch({
    rules: variation(number),
    switches: ['B', 'B'],
    target: 10,
    clockTicks: CARTRIDGE_MATCH_TICKS,
    seed: number,
  });
}

function pilotsFor(number: number): readonly [KidPilot, KidPilot | null] {
  const solo = variation(number).mode === 'solo';
  return [
    createKidPilot({ kid: 'rosa', seat: 0, mode: 'human', seed: `smoke-${number}-0` }),
    solo
      ? null
      : createKidPilot({ kid: 'moss', seat: 1, mode: 'human', seed: `smoke-${number}-1` }),
  ];
}

function expectWholeAndInside(body: Body, what: string): void {
  for (const value of [body.x, body.y, body.vx, body.vy]) {
    expect(Number.isInteger(value), `${what} has a non-integer value ${value}`).toBe(true);
  }
  expect(body.x >= 0 && body.x < WIDTH, `${what} x ${body.x} is off the field`).toBe(true);
  expect(body.y >= 0 && body.y < HEIGHT, `${what} y ${body.y} is off the field`).toBe(true);
  // After a move the fold has run, so the whole units are back inside a signed speed.
  for (const speed of [body.vx, body.vy]) {
    const whole = Math.floor(speed / 256);
    expect(whole >= -64 && whole <= 63, `${what} speed ${whole} units is past the fold`).toBe(true);
  }
}

function expectBarsInRange(match: Match): void {
  for (const ship of match.ships) {
    expect(ship.fuel).toBeGreaterThanOrEqual(0);
    expect(ship.fuel).toBeLessThanOrEqual(8);
    expect(ship.ammo).toBeGreaterThanOrEqual(0);
    expect(ship.ammo).toBeLessThanOrEqual(8);
    expect(ship.score).toBeGreaterThanOrEqual(0);
    expect(ship.score).toBeLessThanOrEqual(10);
    expect(ship.heading).toBeGreaterThanOrEqual(0);
    expect(ship.heading).toBeLessThanOrEqual(15);
  }
}

function expectEventsFitTheMode(events: readonly MatchEvent[], duel: boolean): void {
  for (const event of events) {
    if (duel) expect(event.kind).not.toBe('docked');
    else expect(['fired', 'hit', 'cloak']).not.toContain(event.kind);
  }
}

/** Flies one variation tick by tick, checking everything after each one; returns the events seen. */
function flyAndCheck(number: number): MatchEvent[] {
  const match = smokeMatch(number);
  const pilots = pilotsFor(number);
  const duel = match.setup.rules.mode === 'duel';
  const solo = match.setup.rules.mode === 'solo';
  const emptySeat = { x: match.ships[1].x, y: match.ships[1].y };
  const seen: MatchEvent[] = [];
  for (let tick = 0; tick < SMOKE_TICKS && match.phase === 'playing'; tick++) {
    for (const pilot of pilots) pilot?.hear(match.events, match);
    const controls: [Controls, Controls] = [
      pilots[0].controls(match),
      pilots[1]?.controls(match) ?? IDLE,
    ];
    const before = match.tick;
    stepMatch(match, controls);
    expect(match.tick).toBe(before + 1);
    match.ships.forEach((ship, seat) => {
      if (ship.present) expectWholeAndInside(ship, `ship ${seat}`);
    });
    match.shots.forEach((shot, seat) => {
      if (shot.live) expectWholeAndInside(shot, `shot ${seat}`);
    });
    expectBarsInRange(match);
    expectEventsFitTheMode(match.events, duel);
    if (solo) {
      expect(match.ships[1].score).toBe(0);
      expect({ x: match.ships[1].x, y: match.ships[1].y }).toEqual(emptySeat);
    }
    seen.push(...match.events);
  }
  return seen;
}

const NUMBERS = VARIATIONS.map((rules) => rules.number);
const seenByVariation = new Map<number, MatchEvent[]>();

describe('every variation, flown by Kids', () => {
  it.each(NUMBERS)('variation %i plays 3,000 ticks without breaking an invariant', (number) => {
    seenByVariation.set(number, flyAndCheck(number));
  });

  it('really plays: duels see hits and docking runs see docks', () => {
    const kinds = (mode: 'duel' | 'docking') =>
      NUMBERS.filter((number) => (variation(number).mode === 'duel') === (mode === 'duel')).flatMap(
        (number) => (seenByVariation.get(number) ?? flyAndCheck(number)).map((event) => event.kind),
      );
    expect(kinds('duel')).toContain('hit');
    expect(kinds('docking')).toContain('docked');
  });
});
