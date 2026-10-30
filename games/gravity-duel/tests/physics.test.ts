/**
 * Tests for Gravity Duel's physics core: the fold, the thrust and muzzle
 * vectors, turning and fuel, gravity and the edge rules. Each body starts at
 * rest in the middle of the field, and every test drives the functions
 * directly, so none depends on the clock or a random stream.
 */
import { describe, expect, it } from 'vitest';
import {
  burnFuel,
  dropSegment,
  foldSpeed,
  gravityPull,
  gravityTurn,
  moveBody,
  muzzleVelocity,
  speedDifference,
  speedUnits,
  thrustShip,
  thrustVector,
  touching,
  turnShip,
} from '../src/engine/physics.ts';
import {
  AMMO_SEGMENTS,
  BURNS_PER_SEGMENT,
  CENTRE_X,
  CENTRE_Y,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FINE_PER_UNIT,
  FUEL_SEGMENTS,
  IDLE,
  MISSILE_RADIUS,
  SHIP_RADIUS,
  SUBPIXELS,
  THRUST_EVERY,
  type Body,
  type Controls,
  type Ship,
} from '../src/engine/types.ts';

function makeBody(overrides: Partial<Body> = {}): Body {
  return {
    x: CENTRE_X,
    y: CENTRE_Y,
    vx: 0,
    vy: 0,
    prevX: CENTRE_X,
    prevY: CENTRE_Y,
    wrapped: false,
    ...overrides,
  };
}

function makeShip(overrides: Partial<Ship> = {}): Ship {
  return {
    ...makeBody(),
    present: true,
    heading: 0,
    turnWait: 0,
    fuel: FUEL_SEGMENTS,
    burnsLeft: BURNS_PER_SEGMENT - 1,
    ammo: AMMO_SEGMENTS,
    cloaked: false,
    cloakHeld: false,
    spin: 0,
    thrusting: false,
    dockCooldown: 0,
    score: 0,
    ...overrides,
  };
}

function controls(overrides: Partial<Controls> = {}): Controls {
  return { ...IDLE, ...overrides };
}

describe('the speed fold', () => {
  it('leaves speeds from −64 to 63 units alone, fraction included', () => {
    for (let units = -64; units <= 63; units++) {
      const fine = units * FINE_PER_UNIT + 123;
      expect(foldSpeed(fine)).toBe(fine);
    }
  });

  it('turns 64 into 63, 96 into 31, −65 into −64, −100 into −29 and 130 into −3, keeping the fraction', () => {
    const fraction = 200;
    expect(foldSpeed(64 * FINE_PER_UNIT + fraction)).toBe(63 * FINE_PER_UNIT + fraction);
    expect(foldSpeed(96 * FINE_PER_UNIT + fraction)).toBe(31 * FINE_PER_UNIT + fraction);
    expect(foldSpeed(-65 * FINE_PER_UNIT + fraction)).toBe(-64 * FINE_PER_UNIT + fraction);
    expect(foldSpeed(-100 * FINE_PER_UNIT + fraction)).toBe(-29 * FINE_PER_UNIT + fraction);
    expect(foldSpeed(130 * FINE_PER_UNIT + fraction)).toBe(-3 * FINE_PER_UNIT + fraction);
  });
});

describe('the thrust and muzzle vectors', () => {
  it('gives the listed thrust vectors, wraps headings 16 and −1, and never returns −0', () => {
    expect(thrustVector(0)).toEqual({ x: 72, y: 0 });
    expect(thrustVector(4)).toEqual({ x: 0, y: -72 });
    expect(thrustVector(8)).toEqual({ x: -72, y: 0 });
    expect(thrustVector(12)).toEqual({ x: 0, y: 72 });
    expect(thrustVector(1)).toEqual({ x: 67, y: -28 });
    expect(thrustVector(2)).toEqual({ x: 51, y: -51 });
    expect(thrustVector(3)).toEqual({ x: 28, y: -67 });
    expect(thrustVector(9)).toEqual({ x: -67, y: 28 });
    expect(thrustVector(16)).toEqual(thrustVector(0));
    expect(thrustVector(-1)).toEqual(thrustVector(15));
    for (let heading = 0; heading < 16; heading++) {
      const vector = thrustVector(heading);
      expect(Object.is(vector.x, -0)).toBe(false);
      expect(Object.is(vector.y, -0)).toBe(false);
    }
  });

  it('gives the muzzle velocity as half the thrust, rounded toward minus infinity', () => {
    expect(muzzleVelocity(0)).toEqual({ x: 36, y: 0 });
    expect(muzzleVelocity(8)).toEqual({ x: -36, y: 0 });
    expect(muzzleVelocity(1)).toEqual({ x: 33, y: -14 });
    expect(muzzleVelocity(9)).toEqual({ x: -34, y: 14 });
    expect(muzzleVelocity(2)).toEqual({ x: 25, y: -26 });
  });
});

describe('thrust and fuel', () => {
  it('folds a missile fired straight ahead from a ship at 60 units to 31, slower than its ship', () => {
    const shipSpeed = 60 * FINE_PER_UNIT;
    const missileSpeed = foldSpeed(shipSpeed + muzzleVelocity(0).x * FINE_PER_UNIT);
    expect(speedUnits(missileSpeed)).toBe(31);
    expect(speedUnits(missileSpeed)).toBeLessThan(speedUnits(shipSpeed));
  });

  it('straight thrust from rest first reaches 63 units on tick 896 and never exceeds 63 over 2,000 ticks', () => {
    const ship = makeShip({ heading: 0 });
    const held = controls({ thrust: true });
    let firstTop = -1;
    for (let tick = 1; tick <= 2000; tick++) {
      thrustShip(ship, held, tick, true);
      moveBody(ship, 'wrap', SHIP_RADIUS);
      const units = speedUnits(ship.vx);
      expect(units).toBeLessThanOrEqual(63);
      if (units === 63 && firstTop === -1) firstTop = tick;
    }
    expect(firstTop).toBe(896);
  });

  it('applies thrust only on ticks divisible by 4 and reports thrusting on every held tick', () => {
    const ship = makeShip({ heading: 0 });
    const held = controls({ thrust: true });
    for (let tick = 0; tick < 16; tick++) {
      const before = ship.vx;
      thrustShip(ship, held, tick, true);
      expect(ship.thrusting).toBe(true);
      expect(ship.vx).toBe(tick % THRUST_EVERY === 0 ? before + 72 : before);
    }
  });

  it('does nothing without fuel when not unlimited, and reports not thrusting', () => {
    const ship = makeShip({ fuel: 0 });
    thrustShip(ship, controls({ thrust: true }), 4, false);
    expect(ship.vx).toBe(0);
    expect(ship.vy).toBe(0);
    expect(ship.thrusting).toBe(false);
  });

  it('burns the first fuel segment in 255 burns and later ones in 256', () => {
    const ship = makeShip();
    const startingFuel = ship.fuel;
    let first = 0;
    while (ship.fuel === startingFuel) {
      burnFuel(ship);
      first += 1;
    }
    expect(first).toBe(BURNS_PER_SEGMENT - 1);

    let later = 0;
    while (ship.fuel === startingFuel - 1) {
      burnFuel(ship);
      later += 1;
    }
    expect(later).toBe(BURNS_PER_SEGMENT);
  });

  it("returns 'fuel-out' only on the thrust that burns the last segment, and never again", () => {
    const ship = makeShip({ fuel: 1 });
    const held = controls({ thrust: true });
    let fuelOut = 0;
    for (let tick = 0; tick < 2000; tick++) {
      if (thrustShip(ship, held, tick, false) === 'fuel-out') fuelOut += 1;
    }
    expect(fuelOut).toBe(1);
    expect(ship.fuel).toBe(0);
  });

  it('drops a whole segment at once without touching the burn counter, and reports an empty tank from 1 or 0', () => {
    const one = makeShip({ fuel: 1, burnsLeft: 7 });
    expect(dropSegment(one)).toBe(true);
    expect(one.fuel).toBe(0);
    expect(one.burnsLeft).toBe(7);

    const zero = makeShip({ fuel: 0, burnsLeft: 7 });
    expect(dropSegment(zero)).toBe(true);
    expect(zero.fuel).toBe(0);

    const plenty = makeShip({ fuel: 5, burnsLeft: 7 });
    expect(dropSegment(plenty)).toBe(false);
    expect(plenty.fuel).toBe(4);
    expect(plenty.burnsLeft).toBe(7);
  });
});

describe('turning', () => {
  it('turns one step at once on a tap and every 8 ticks while held', () => {
    const tapped = makeShip();
    turnShip(tapped, controls({ left: true }));
    expect(tapped.heading).toBe(1);

    const held = makeShip();
    const left = controls({ left: true });
    const headings: number[] = [];
    for (let tick = 0; tick < 33; tick++) {
      turnShip(held, left);
      headings.push(held.heading);
    }
    expect(headings[0]).toBe(1);
    expect(headings[1]).toBe(1);
    expect(headings[7]).toBe(1);
    expect(headings[8]).toBe(2);
    expect(headings[9]).toBe(2);
    expect(headings[16]).toBe(3);
    expect(headings[24]).toBe(4);
    expect(headings[32]).toBe(5);
  });

  it('turns a full circle in 121 held ticks and 15 steps in 120', () => {
    const full = makeShip();
    const left = controls({ left: true });
    for (let tick = 0; tick < 121; tick++) turnShip(full, left);
    expect(full.heading).toBe(0);

    const short = makeShip();
    for (let tick = 0; tick < 120; tick++) turnShip(short, left);
    expect(short.heading).toBe(15);
  });

  it('counts left up and right down, wrapping between 15 and 0', () => {
    const ship = makeShip();
    const idle = controls();
    turnShip(ship, controls({ left: true }));
    expect(ship.heading).toBe(1);
    turnShip(ship, idle);
    turnShip(ship, controls({ right: true }));
    expect(ship.heading).toBe(0);
    turnShip(ship, idle);
    turnShip(ship, controls({ right: true }));
    expect(ship.heading).toBe(15);
    turnShip(ship, idle);
    turnShip(ship, controls({ left: true }));
    expect(ship.heading).toBe(0);
  });

  it('turns nothing while both directions are held, and a release lets the next press turn at once', () => {
    const ship = makeShip();
    const both = controls({ left: true, right: true });
    for (let tick = 0; tick < 20; tick++) turnShip(ship, both);
    expect(ship.heading).toBe(0);
    expect(ship.turnWait).toBe(0);

    turnShip(ship, controls({ left: true }));
    expect(ship.heading).toBe(1);
  });
});

describe('gravity', () => {
  it('is null on even ticks and visits bodies 0, 1, 2 and 3 on ticks 1, 3, 5 and 7', () => {
    expect(gravityTurn(0)).toBeNull();
    expect(gravityTurn(2)).toBeNull();
    expect(gravityTurn(4)).toBeNull();
    expect(gravityTurn(1)).toBe(0);
    expect(gravityTurn(3)).toBe(1);
    expect(gravityTurn(5)).toBe(2);
    expect(gravityTurn(7)).toBe(3);
    expect(gravityTurn(9)).toBe(0);
  });

  it('is zero at the middle, points toward it in every quadrant, and is symmetric', () => {
    expect(gravityPull(0, 0)).toEqual({ x: 0, y: 0 });

    const pull = (a: number, b: number) => gravityPull(a, b);
    expect(pull(12 * SUBPIXELS, 4 * SUBPIXELS).x).toBeGreaterThan(0);
    expect(pull(12 * SUBPIXELS, 4 * SUBPIXELS).y).toBeGreaterThan(0);
    expect(pull(12 * SUBPIXELS, -4 * SUBPIXELS).x).toBeGreaterThan(0);
    expect(pull(12 * SUBPIXELS, -4 * SUBPIXELS).y).toBeLessThan(0);
    expect(pull(-12 * SUBPIXELS, 4 * SUBPIXELS).x).toBeLessThan(0);
    expect(pull(-12 * SUBPIXELS, 4 * SUBPIXELS).y).toBeGreaterThan(0);
    expect(pull(-12 * SUBPIXELS, -4 * SUBPIXELS).x).toBeLessThan(0);
    expect(pull(-12 * SUBPIXELS, -4 * SUBPIXELS).y).toBeLessThan(0);

    expect(pull(12 * SUBPIXELS, 4 * SUBPIXELS).x).toBe(pull(4 * SUBPIXELS, 12 * SUBPIXELS).y);
  });

  it('has the listed pull values and is capped at 255 per component', () => {
    expect(gravityPull(12 * SUBPIXELS, 4 * SUBPIXELS)).toEqual({ x: 154, y: 51 });
    expect(gravityPull(20 * SUBPIXELS, 0)).toEqual({ x: 65, y: 0 });
    expect(gravityPull(40 * SUBPIXELS, 0)).toEqual({ x: 16, y: 0 });
    expect(gravityPull(5 * SUBPIXELS, 0)).toEqual({ x: 255, y: 0 });
    expect(gravityPull(-12 * SUBPIXELS, -4 * SUBPIXELS)).toEqual({ x: -154, y: -51 });
  });

  it('cuts the pull to a quarter when the distance doubles from 20 to 40 steps, give or take 1', () => {
    const near = gravityPull(20 * SUBPIXELS, 0).x;
    const far = gravityPull(40 * SUBPIXELS, 0).x;
    expect(Math.abs(far * 4 - near)).toBeLessThanOrEqual(1);
  });
});

describe('motion and edges', () => {
  it('moves a body by velocity >> 4 subpixels, rounding toward minus infinity, and records where it was', () => {
    const body = makeBody({ vx: 16 * FINE_PER_UNIT, vy: -1 });
    const fromX = body.x;
    const fromY = body.y;
    moveBody(body, 'wrap', 0);
    expect(body.prevX).toBe(fromX);
    expect(body.prevY).toBe(fromY);
    expect(body.x).toBe(fromX + 256);
    expect(body.y).toBe(fromY - 1);

    const fractional = makeBody({ vx: -17 });
    moveBody(fractional, 'wrap', 0);
    expect(fractional.x).toBe(fractional.prevX - 2);
  });

  it('folds before moving, so a body at 64 units moves as one at 63', () => {
    const at64 = makeBody({ vx: 64 * FINE_PER_UNIT });
    const at63 = makeBody({ vx: 63 * FINE_PER_UNIT });
    moveBody(at64, 'wrap', 0);
    moveBody(at63, 'wrap', 0);
    expect(at64.vx).toBe(at63.vx);
    expect(at64.x).toBe(at63.x);
  });

  it('wraps a body across each side and marks it wrapped, and an ordinary move clears the mark', () => {
    const width = FIELD_WIDTH * SUBPIXELS;
    const height = FIELD_HEIGHT * SUBPIXELS;

    const right = makeBody({ x: width - 16, vx: 2 * FINE_PER_UNIT });
    moveBody(right, 'wrap', 0);
    expect(right.x).toBe(16);
    expect(right.wrapped).toBe(true);

    const left = makeBody({ x: 8, vx: -FINE_PER_UNIT });
    moveBody(left, 'wrap', 0);
    expect(left.x).toBe(width - 8);
    expect(left.wrapped).toBe(true);

    const bottom = makeBody({ y: height - 16, vy: 2 * FINE_PER_UNIT });
    moveBody(bottom, 'wrap', 0);
    expect(bottom.y).toBe(16);
    expect(bottom.wrapped).toBe(true);

    const top = makeBody({ y: 8, vy: -FINE_PER_UNIT });
    moveBody(top, 'wrap', 0);
    expect(top.y).toBe(height - 8);
    expect(top.wrapped).toBe(true);

    const ordinary = makeBody({ vx: FINE_PER_UNIT, wrapped: true });
    moveBody(ordinary, 'wrap', 0);
    expect(ordinary.wrapped).toBe(false);
  });

  it('reflects the position about the margin, reverses only that axis and returns true', () => {
    const margin = SHIP_RADIUS * SUBPIXELS;
    const width = FIELD_WIDTH * SUBPIXELS;

    const left = makeBody({ x: margin - 16, vx: -FINE_PER_UNIT });
    expect(moveBody(left, 'bounce', SHIP_RADIUS)).toBe(true);
    expect(left.x).toBe(margin + 32);
    expect(left.vx).toBe(FINE_PER_UNIT);
    expect(left.vy).toBe(0);

    const right = makeBody({ x: width - margin + 16, vx: FINE_PER_UNIT });
    expect(moveBody(right, 'bounce', SHIP_RADIUS)).toBe(true);
    expect(right.x).toBe(width - margin - 32);
    expect(right.vx).toBe(-FINE_PER_UNIT);

    const top = makeBody({ y: margin - 16, vy: -FINE_PER_UNIT });
    expect(moveBody(top, 'bounce', SHIP_RADIUS)).toBe(true);
    expect(top.y).toBe(margin + 32);
    expect(top.vy).toBe(FINE_PER_UNIT);
    expect(top.vx).toBe(0);
  });
});

describe('touching and docking', () => {
  it('is strict at the radius sum, works across a wrapped edge and not across a bouncing one', () => {
    const centre = makeBody();

    const atSum = makeBody({ x: CENTRE_X + 5 * SUBPIXELS });
    expect(touching(centre, atSum, SHIP_RADIUS, MISSILE_RADIUS, 'wrap')).toBe(false);

    const inside = makeBody({ x: CENTRE_X + 5 * SUBPIXELS - 1 });
    expect(touching(centre, inside, SHIP_RADIUS, MISSILE_RADIUS, 'wrap')).toBe(true);

    const width = FIELD_WIDTH * SUBPIXELS;
    const nearLeft = makeBody({ x: 2 * SUBPIXELS });
    const nearRight = makeBody({ x: width - 2 * SUBPIXELS });
    expect(touching(nearLeft, nearRight, SHIP_RADIUS, SHIP_RADIUS, 'wrap')).toBe(true);
    expect(touching(nearLeft, nearRight, SHIP_RADIUS, SHIP_RADIUS, 'bounce')).toBe(false);
  });

  it('sums whole-unit speed differences and ignores fractions', () => {
    const a = makeBody({ vx: FINE_PER_UNIT + 230 });
    const b = makeBody({ vx: FINE_PER_UNIT, vy: 2 * FINE_PER_UNIT });
    expect(speedDifference(a, b)).toBe(2);

    const c = makeBody({ vx: FINE_PER_UNIT + 230 });
    const d = makeBody({ vx: FINE_PER_UNIT });
    expect(speedDifference(c, d)).toBe(0);
  });
});
