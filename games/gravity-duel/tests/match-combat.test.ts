/**
 * Tests for a duel's combat rules: firing and ammo, hits and spins, the cloak
 * and its fuel, the star and the starbase, mutual reload, gravity, edges, the
 * score, the clock and determinism. Bodies are parked where they are needed
 * rather than flown there.
 */
import { describe, expect, it } from 'vitest';
import { START_SPOTS, stepMatch } from '../src/engine/match.ts';
import {
  AMMO_SEGMENTS,
  BURNS_PER_SEGMENT,
  CLOCK_WARNING_TICKS,
  FINE_PER_UNIT,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FUEL_SEGMENTS,
  HEADINGS,
  SELF_HIT_GRACE,
  SHIP_RADIUS,
  SPIN_TICKS,
  SUBPIXELS,
  TOP_SPEED_UNITS,
  type Body,
  type Match,
} from '../src/engine/types.ts';
import { controls, place, runTicks, setupFor } from './helpers.ts';

describe('firing and ammo', () => {
  it('fires only with a ready missile and ammo, spending one segment', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const shot = match.shots[0];

    stepMatch(match, [controls({ fire: true }), controls()]);
    expect(shot.live).toBe(true);
    expect(ship.ammo).toBe(AMMO_SEGMENTS - 1);

    // A live missile is not ready, so holding fire launches nothing new.
    const lifeBefore = shot.life;
    stepMatch(match, [controls({ fire: true }), controls()]);
    expect(ship.ammo).toBe(AMMO_SEGMENTS - 1);
    expect(shot.life).toBe(lifeBefore - 1);

    // Out of ammo, nothing launches even once the missile is ready again.
    ship.ammo = 0;
    shot.life = 0;
    shot.live = false;
    stepMatch(match, [controls({ fire: true }), controls()]);
    expect(shot.live).toBe(false);
  });

  it('refires exactly every 128 ticks while fire is held', () => {
    const match = setupFor(1);
    const held = controls({ fire: true });
    const firedTicks: number[] = [];

    for (let i = 0; i < 400; i++) {
      stepMatch(match, [held, controls()]);
      if (match.events.some((event) => event.kind === 'fired')) firedTicks.push(match.tick);
    }

    expect(firedTicks).toEqual([1, 129, 257, 385]); // every 128 ticks
  });

  it('launches a missile with the ship whole units plus the muzzle velocity', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const shot = match.shots[0];

    ship.vx = 5 * FINE_PER_UNIT + 100; // fraction is dropped
    ship.vy = 7 * FINE_PER_UNIT + 200;
    ship.heading = 0; // muzzle (36, 0)

    stepMatch(match, [controls({ fire: true }), controls()]);

    expect(shot.vx).toBe((5 + 36) * FINE_PER_UNIT);
    expect(shot.vy).toBe(7 * FINE_PER_UNIT);
  });
});

describe('hits and spins', () => {
  it('a hit scores, spins the victim 64 ticks one step a tick, and play goes on', () => {
    const match = setupFor(1);
    const [ship0, ship1] = match.ships;
    const shot0 = match.shots[0];

    place(ship1, 80, 45);
    place(shot0, 80, 45);
    shot0.live = true;
    shot0.life = 100;
    shot0.age = 9;
    const headingBefore = ship1.heading;

    stepMatch(match, [controls(), controls()]);

    expect(ship0.score).toBe(1);
    expect(shot0.live).toBe(false);
    expect(match.phase).toBe('playing');
    // The hit tick already spun it once.
    expect(ship1.spin).toBe(SPIN_TICKS - 1);
    expect(ship1.heading).toBe((headingBefore + 1) % HEADINGS);

    let steps = 0;
    while (ship1.spin > 0) {
      const before = ship1.heading;
      stepMatch(match, [controls(), controls()]);
      steps += 1;
      expect(ship1.heading).toBe((before + 1) % HEADINGS);
    }
    expect(steps).toBe(SPIN_TICKS - 1);
    expect(ship1.heading).toBe(headingBefore); // 64 steps is four full turns
  });

  it('cannot score on a spinning victim, though the missile is still removed', () => {
    const match = setupFor(1);
    const [ship0, ship1] = match.ships;
    const shot0 = match.shots[0];

    ship1.spin = 10;
    place(ship1, 80, 45);
    place(shot0, 80, 45);
    shot0.live = true;
    shot0.life = 100;
    shot0.age = 9;

    stepMatch(match, [controls(), controls()]);

    expect(ship0.score).toBe(0);
    expect(shot0.live).toBe(false);
    expect(ship1.spin).toBe(9); // the spin carries on, not reset
  });

  it('a spinning ship can still thrust and fire', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const shot = match.shots[0];

    ship.spin = SPIN_TICKS;
    ship.heading = 0;

    stepMatch(match, [controls({ fire: true, thrust: true }), controls()]);
    expect(shot.live).toBe(true);
    expect(ship.ammo).toBe(AMMO_SEGMENTS - 1);
    expect(ship.thrusting).toBe(true);

    const vx = ship.vx;
    const vy = ship.vy;
    runTicks(match, 3, controls({ thrust: true }), controls()); // thrust lands on tick 4
    expect(ship.vx !== vx || ship.vy !== vy).toBe(true);
  });

  it('does not reload early after a hit: the next shot still waits the full 128 ticks', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const shot = match.shots[0];
    const rival = match.ships[1];
    const held = controls({ fire: true });

    stepMatch(match, [held, controls()]); // fire on tick 1
    expect(shot.live).toBe(true);
    expect(ship.ammo).toBe(AMMO_SEGMENTS - 1);

    // Hit the rival on tick 2: park it on the missile.
    place(rival, 80, 45);
    place(shot, 80, 45);
    shot.live = true;
    shot.age = 100;
    stepMatch(match, [held, controls()]);
    expect(shot.live).toBe(false);
    expect(ship.ammo).toBe(AMMO_SEGMENTS - 1); // no early refire

    const firedTicks: number[] = [];
    for (let i = 0; i < 128; i++) {
      stepMatch(match, [held, controls()]);
      if (match.events.some((event) => event.kind === 'fired')) firedTicks.push(match.tick);
    }
    expect(firedTicks).toEqual([129]);
  });

  it('ships pass through each other', () => {
    const match = setupFor(1);
    const [ship0, ship1] = match.ships;

    place(ship0, 80, 45);
    place(ship1, 80, 45);

    stepMatch(match, [controls(), controls()]);

    expect(ship0.score).toBe(0);
    expect(ship1.score).toBe(0);
    expect(ship0.spin).toBe(0);
    expect(ship1.spin).toBe(0);
    expect(match.phase).toBe('playing');
  });
});

describe('self-touch', () => {
  it('ignores self-touch for the first 8 ticks', () => {
    const match = setupFor(1, { switches: ['A', 'B'] });
    const ship = match.ships[0];
    const shot = match.shots[0];

    place(ship, 80, 45);
    place(shot, 80, 45);
    shot.live = true;
    shot.life = 100;
    shot.age = SELF_HIT_GRACE - 1;

    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(true);
    expect(ship.spin).toBe(0);
    expect(match.ships[1].score).toBe(0);
  });

  it('self-touch on A explodes the ship and scores for the rival', () => {
    const match = setupFor(1, { switches: ['A', 'B'] });
    const ship = match.ships[0];
    const shot = match.shots[0];

    place(ship, 80, 45);
    place(shot, 80, 45);
    shot.live = true;
    shot.life = 100;
    shot.age = SELF_HIT_GRACE;

    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(false);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'self-hit' && e.seat === 0 && e.exploded)).toBe(
      true,
    );
  });

  it('self-touch on B only removes the missile', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const shot = match.shots[0];

    place(ship, 80, 45);
    place(shot, 80, 45);
    shot.live = true;
    shot.life = 100;
    shot.age = SELF_HIT_GRACE;

    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(false);
    expect(ship.spin).toBe(0);
    expect(match.ships[1].score).toBe(0);
    expect(match.events.some((e) => e.kind === 'self-hit' && e.seat === 0 && !e.exploded)).toBe(
      true,
    );
  });
});

describe('the star and the starbase', () => {
  it('the star swallows missiles', () => {
    const match = setupFor(4);
    const shot = match.shots[0];

    place(shot, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    shot.live = true;
    shot.life = 100;
    shot.age = 100;

    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(false);
    expect(match.ships[0].score).toBe(0);
    expect(match.ships[1].score).toBe(0);
    expect(match.events.some((e) => e.kind === 'swallowed' && e.seat === 0)).toBe(true);
  });

  it('a ship touching the star restarts at rest, explodes, and the rival scores', () => {
    const match = setupFor(4);
    const ship = match.ships[0];

    place(ship, 80, 45);
    ship.vx = 5 * FINE_PER_UNIT;
    ship.vy = 3 * FINE_PER_UNIT;

    stepMatch(match, [controls(), controls()]);

    const spot = START_SPOTS[0];
    expect(ship.x).toBe(spot.x);
    expect(ship.y).toBe(spot.y);
    // The restart zeroes the speed; gravity then gives it only a sub-unit pull.
    expect(Math.abs(ship.vx)).toBeLessThan(FINE_PER_UNIT);
    expect(Math.abs(ship.vy)).toBeLessThan(FINE_PER_UNIT);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'star-crash' && e.seat === 0)).toBe(true);
  });

  it('a cloaked ship passes through the star', () => {
    const match = setupFor(4);
    const ship = match.ships[0];

    ship.cloaked = true;
    place(ship, 80, 45);

    stepMatch(match, [controls(), controls()]);

    expect(ship.x).toBe(80 * SUBPIXELS);
    expect(ship.y).toBe(45 * SUBPIXELS);
    expect(ship.spin).toBe(0);
    expect(match.ships[1].score).toBe(0);
  });

  it('the starbase refuels and rearms at rest and never explodes, even at top speed', () => {
    const match = setupFor(6);
    const ship = match.ships[0];

    ship.fuel = 0;
    ship.ammo = 0;
    place(ship, 80, 45);
    ship.vx = TOP_SPEED_UNITS * FINE_PER_UNIT;
    ship.vy = TOP_SPEED_UNITS * FINE_PER_UNIT;

    stepMatch(match, [controls(), controls()]);

    const spot = START_SPOTS[0];
    expect(ship.x).toBe(spot.x);
    expect(ship.y).toBe(spot.y);
    expect(ship.vx).toBe(0);
    expect(ship.vy).toBe(0);
    expect(ship.fuel).toBe(FUEL_SEGMENTS);
    expect(ship.ammo).toBe(AMMO_SEGMENTS);
    expect(ship.spin).toBe(0);
    expect(match.ships[1].score).toBe(0);

    const refuelled = match.events.find((e) => e.kind === 'refuelled');
    expect(refuelled).toMatchObject({ seat: 0, speed: TOP_SPEED_UNITS * 2 });
  });

  it('the starbase swallows missiles', () => {
    const match = setupFor(6);
    const shot = match.shots[0];

    place(shot, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    shot.live = true;
    shot.life = 100;
    shot.age = 100;

    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(false);
    expect(match.ships[0].score).toBe(0);
    expect(match.ships[1].score).toBe(0);
  });

  it('mutual reload: both ships refill only when both are empty', () => {
    const match = setupFor(1);
    const ship0 = match.ships[0];
    const ship1 = match.ships[1];
    const shot0 = match.shots[0];

    ship0.ammo = 0;
    ship1.ammo = AMMO_SEGMENTS;

    shot0.live = true;
    shot0.life = 1;
    stepMatch(match, [controls(), controls()]);
    expect(shot0.live).toBe(false);
    expect(ship0.ammo).toBe(0);
    expect(ship1.ammo).toBe(AMMO_SEGMENTS);

    ship1.ammo = 0;
    shot0.live = true;
    shot0.life = 1;
    stepMatch(match, [controls(), controls()]);
    expect(ship0.ammo).toBe(AMMO_SEGMENTS);
    expect(ship1.ammo).toBe(AMMO_SEGMENTS);
    expect(match.events.some((e) => e.kind === 'reload')).toBe(true);
  });
});

describe('the cloak', () => {
  it('toggles only when pulled on its own and must be let go between toggles', () => {
    const match = setupFor(2);
    const ship = match.ships[0];

    stepMatch(match, [controls({ cloak: true, thrust: true }), controls()]);
    expect(ship.cloaked).toBe(false);

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    stepMatch(match, [controls(), controls()]);
    expect(ship.cloaked).toBe(true);

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(false);
  });

  it('cloaking costs a segment at once, then burns every fourth tick', () => {
    const match = setupFor(2);
    const ship = match.ships[0];

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);
    expect(ship.fuel).toBe(FUEL_SEGMENTS - 1);
    expect(ship.burnsLeft).toBe(BURNS_PER_SEGMENT - 1); // the cloak did not burn the counter

    const burnsBefore = ship.burnsLeft;
    runTicks(match, 16, controls(), controls()); // ticks 2–17, one burn per four ticks
    expect(ship.burnsLeft).toBe(burnsBefore - 4);
  });

  it('cloaking with the last segment blows the ship up and scores for the rival', () => {
    const match = setupFor(2);
    const ship = match.ships[0];

    ship.fuel = 1;

    stepMatch(match, [controls({ cloak: true }), controls()]);

    expect(ship.cloaked).toBe(false);
    expect(ship.cloakHeld).toBe(true);
    expect(ship.fuel).toBe(0);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'cloak-burnout' && e.seat === 0)).toBe(true);
  });

  it('burning the last segment while cloaked blows the ship up', () => {
    const match = setupFor(2);
    const ship = match.ships[0];

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    ship.fuel = 1;
    ship.burnsLeft = 1;
    runTicks(match, 3, controls(), controls()); // the next burn is on tick 4

    expect(ship.cloaked).toBe(false);
    expect(ship.fuel).toBe(0);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'cloak-burnout' && e.seat === 0)).toBe(true);
  });

  it('thrust burning the last segment is safe', () => {
    const match = setupFor(1);
    const ship = match.ships[0];

    ship.fuel = 1;
    ship.burnsLeft = 1;
    ship.heading = 0;

    runTicks(match, 4, controls({ thrust: true }), controls()); // thrust lands on tick 4

    expect(ship.fuel).toBe(0);
    expect(ship.spin).toBe(0);
    expect(match.ships[1].score).toBe(0);
    expect(match.events.some((e) => e.kind === 'fuel-out' && e.seat === 0)).toBe(true);
  });

  it('a cloaked ship cannot turn, thrust or fire', () => {
    const match = setupFor(2);
    const ship = match.ships[0];
    const shot = match.shots[0];

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    const headingBefore = ship.heading;
    const vxBefore = ship.vx;
    const vyBefore = ship.vy;
    const ammoBefore = ship.ammo;

    runTicks(match, 8, controls({ left: true, thrust: true, fire: true }), controls());

    expect(ship.heading).toBe(headingBefore);
    expect(ship.vx).toBe(vxBefore);
    expect(ship.vy).toBe(vyBefore);
    expect(ship.ammo).toBe(ammoBefore);
    expect(shot.live).toBe(false);
  });

  it("a cloaked ship's missile cannot hit, and can again after uncloaking", () => {
    const match = setupFor(2);
    const ship = match.ships[0];
    const rival = match.ships[1];
    const shot = match.shots[0];

    stepMatch(match, [controls({ fire: true }), controls()]);
    place(rival, 110, 60);
    place(shot, 110, 60);
    shot.live = true;
    shot.life = 100;
    shot.age = 100;

    stepMatch(match, [controls({ cloak: true }), controls()]); // cloak on
    stepMatch(match, [controls(), controls()]);
    expect(ship.score).toBe(0);
    expect(rival.spin).toBe(0);
    expect(shot.live).toBe(true);

    place(rival, 110, 60);
    place(shot, 110, 60);
    shot.live = true;
    stepMatch(match, [controls({ cloak: true }), controls()]); // uncloak, hit lands
    expect(ship.cloaked).toBe(false);
    expect(ship.score).toBe(1);
    expect(rival.spin).toBeGreaterThan(0);
    expect(shot.live).toBe(false);
  });

  it("a cloaked ship's missile cannot be swallowed by the star", () => {
    const match = setupFor(4);
    const ship = match.ships[0];
    const shot = match.shots[0];

    stepMatch(match, [controls({ fire: true }), controls()]);
    place(shot, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    shot.live = true;
    shot.life = 100;
    shot.age = 100;

    stepMatch(match, [controls({ cloak: true }), controls()]); // cloak on
    stepMatch(match, [controls(), controls()]);
    expect(shot.live).toBe(true);
    expect(match.events.some((e) => e.kind === 'swallowed')).toBe(false);

    place(shot, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    shot.live = true;
    stepMatch(match, [controls({ cloak: true }), controls()]); // uncloak, swallowed
    expect(ship.cloaked).toBe(false);
    expect(shot.live).toBe(false);
    expect(match.events.some((e) => e.kind === 'swallowed')).toBe(true);
  });

  it('the cloak does nothing outside variations 2 to 7', () => {
    for (const n of [1, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
      const match = setupFor(n);
      stepMatch(match, [controls({ cloak: true }), controls()]);
      expect(match.ships[0].cloaked).toBe(false);
    }
  });
});

describe('gravity and edges', () => {
  it('pulls only in gravity variations, each body once every 8 ticks', () => {
    const flat = setupFor(1);
    place(flat.ships[0], 40, 45);
    runTicks(flat, 8, controls(), controls());
    expect(flat.ships[0].vx).toBe(0);

    const match = setupFor(4);
    const [s0, s1] = match.ships;
    const [sh0, sh1] = match.shots;
    place(s0, 60, 30);
    place(s1, 60, 60);
    place(sh0, 60, 45);
    place(sh1, 60, 75);
    sh0.live = true;
    sh0.life = 100;
    sh1.live = true;
    sh1.life = 100;

    const bodies: readonly [Body, Body, Body, Body] = [s0, s1, sh0, sh1];
    const pulls: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
      stepMatch(match, [controls(), controls()]);
      const tick = match.tick;
      if (tick % 2 === 0) continue;
      const index = ((tick >> 1) & 3) as 0 | 1 | 2 | 3;
      expect(bodies[index].vx).toBeGreaterThan(0); // pulled right, toward the middle
      pulls[index] += 1;
    }
    expect(pulls).toEqual([1, 1, 1, 1]);
  });

  it('a missile curving round the star accumulates a signed turn', () => {
    const above = setupFor(4);
    const a = above.shots[0];
    place(a, 60, 30, 20, 0); // moving right above the star: bent down, clockwise, negative
    a.live = true;
    a.life = 100;
    a.age = 100;
    runTicks(above, 8, controls(), controls()); // body 2 is pulled on tick 5
    expect(a.turned).toBeLessThan(0);

    const below = setupFor(4);
    const b = below.shots[0];
    place(b, 60, 60, 20, 0); // moving right below the star: bent up, counter-clockwise, positive
    b.live = true;
    b.life = 100;
    b.age = 100;
    runTicks(below, 8, controls(), controls());
    expect(b.turned).toBeGreaterThan(0);
  });

  it('edges follow the variation for ships and missiles', () => {
    const bounce = setupFor(1);
    const bs = bounce.ships[0];
    place(bs, 159, 45, 2, 0);
    stepMatch(bounce, [controls(), controls()]);
    expect(bs.vx).toBeLessThan(0);
    expect(bs.x).toBeLessThan(FIELD_WIDTH * SUBPIXELS);

    const wrap = setupFor(3);
    const ws = wrap.ships[0];
    place(ws, 159, 45, 20, 0);
    stepMatch(wrap, [controls(), controls()]);
    expect(ws.wrapped).toBe(true);
    expect(ws.x).toBeLessThan(2 * SHIP_RADIUS * SUBPIXELS);

    const missileBounce = setupFor(1);
    const shot = missileBounce.shots[0];
    place(shot, 159, 45, 2, 0);
    shot.live = true;
    shot.life = 100;
    shot.age = 100;
    stepMatch(missileBounce, [controls(), controls()]);
    expect(shot.vx).toBeLessThan(0);
  });
});

describe('the score and the clock', () => {
  it('reaching the target ends the match at once with a winner', () => {
    const match = setupFor(1, { target: 3 });
    const ship0 = match.ships[0];
    const rival = match.ships[1];
    const shot0 = match.shots[0];

    ship0.score = 2;
    place(rival, 110, 60);
    place(shot0, 110, 60);
    shot0.live = true;
    shot0.life = 100;
    shot0.age = 100;

    stepMatch(match, [controls(), controls()]);

    expect(ship0.score).toBe(3);
    expect(match.phase).toBe('over');
    expect(match.winner).toBe(0);
    expect(
      match.events.some((e) => e.kind === 'over' && e.reason === 'target' && e.winner === 0),
    ).toBe(true);
  });

  it('warns at 1,024 ticks left', () => {
    const match = setupFor(1, { clockTicks: CLOCK_WARNING_TICKS + 1 });
    stepMatch(match, [controls(), controls()]);
    expect(match.clockLeft).toBe(CLOCK_WARNING_TICKS);
    expect(match.events.some((e) => e.kind === 'clock-warning')).toBe(true);
  });

  it('ends the match at zero with the higher score winning', () => {
    const match = setupFor(1, { clockTicks: 2 });
    match.ships[0].score = 3;
    match.ships[1].score = 1;

    stepMatch(match, [controls(), controls()]);
    stepMatch(match, [controls(), controls()]);

    expect(match.clockLeft).toBe(0);
    expect(match.phase).toBe('over');
    expect(match.winner).toBe(0);
    expect(match.events.some((e) => e.kind === 'over' && e.reason === 'clock')).toBe(true);
  });

  it('declares a draw when the clock ends a tied match', () => {
    const match = setupFor(1, { clockTicks: 2 });
    match.ships[0].score = 2;
    match.ships[1].score = 2;

    stepMatch(match, [controls(), controls()]);
    stepMatch(match, [controls(), controls()]);

    expect(match.phase).toBe('over');
    expect(match.winner).toBeNull();
  });

  it('after the end only drifting happens', () => {
    const match = setupFor(1, { clockTicks: 2 });
    const ship = match.ships[0];
    ship.vx = 10 * FINE_PER_UNIT;

    stepMatch(match, [controls(), controls()]);
    stepMatch(match, [controls(), controls()]);
    expect(match.phase).toBe('over');
    const tickAtEnd = match.tick;
    const clockAtEnd = match.clockLeft;
    const xBefore = ship.x;

    stepMatch(match, [controls(), controls()]);
    expect(match.tick).toBe(tickAtEnd);
    expect(match.clockLeft).toBe(clockAtEnd);
    expect(ship.x).toBeGreaterThan(xBefore);
  });
});

describe('determinism', () => {
  it('replays identically after 5,000 ticks of scripted play', () => {
    const play = (): Match => {
      const match = setupFor(5); // wrap, star, cloak and gravity together
      for (let i = 0; i < 5000; i++) {
        stepMatch(match, [
          controls({
            thrust: i % 7 === 0,
            left: i % 11 === 0,
            fire: i % 17 === 0,
            cloak: i % 53 === 0,
          }),
          controls({
            thrust: i % 5 === 0,
            right: i % 13 === 0,
            fire: i % 19 === 0,
            cloak: i % 59 === 0,
          }),
        ]);
      }
      return match;
    };

    const snapshot = (match: Match) => ({
      ships: match.ships.map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, heading: s.heading })),
      shots: match.shots.map((s) => ({
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        live: s.live,
        life: s.life,
        turned: s.turned,
      })),
      scores: match.ships.map((s) => s.score),
      tick: match.tick,
    });

    expect(snapshot(play())).toEqual(snapshot(play()));
  });
});
