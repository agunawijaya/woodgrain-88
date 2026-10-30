/**
 * An independent check of the engine against NOTES.md's verified behaviour:
 * one test per hook and surprising rule, each driven end to end through
 * `createMatch` and `stepMatch` (with the helpers' builders) rather than
 * through the engine's internals. Bodies are parked where they are needed
 * instead of flown there.
 */
import { describe, expect, it } from 'vitest';
import { START_SPOTS, stepMatch } from '../src/engine/match.ts';
import {
  AMMO_SEGMENTS,
  CARTRIDGE_MATCH_TICKS,
  CLOCK_WARNING_TICKS,
  FINE_PER_UNIT,
  FUEL_SEGMENTS,
  HEADINGS,
  SELF_HIT_GRACE,
  SPIN_TICKS,
  TOP_SPEED_UNITS,
  type Body,
} from '../src/engine/types.ts';
import { controls, place, runTicks, setupFor } from './helpers.ts';

describe('the starbase speed check that can never fire', () => {
  it('refuels, rearms and sends a ship home at rest at top speed, without exploding, and reports its speed', () => {
    const match = setupFor(6);
    const ship = match.ships[0];

    ship.fuel = 0;
    ship.ammo = 0;
    place(ship, 80, 45, TOP_SPEED_UNITS, TOP_SPEED_UNITS);

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

    const refuelled = match.events.find((event) => event.kind === 'refuelled');
    expect(refuelled).toMatchObject({ seat: 0, speed: TOP_SPEED_UNITS * 2 });
  });
});

describe('cloak fuel-out suicide', () => {
  it('cloaking on the last segment blows the ship up and scores for the rival', () => {
    const match = setupFor(2);
    const ship = match.ships[0];

    ship.fuel = 1;
    stepMatch(match, [controls({ cloak: true }), controls()]);

    expect(ship.fuel).toBe(0);
    expect(ship.cloaked).toBe(false);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'cloak-burnout' && e.seat === 0)).toBe(true);
  });

  it('the last segment burning away while cloaked blows the ship up', () => {
    const match = setupFor(2);
    const ship = match.ships[0];

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    ship.fuel = 1;
    ship.burnsLeft = 1;
    runTicks(match, 3, controls(), controls()); // the next burn is on tick 4

    expect(ship.fuel).toBe(0);
    expect(ship.cloaked).toBe(false);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'cloak-burnout' && e.seat === 0)).toBe(true);
  });

  it('thrusting the last segment away is safe', () => {
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
});

describe('mutual reload', () => {
  it('keeps one empty ship empty while the rival has missiles, then refills both once both are empty', () => {
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

describe('ship-to-ship contact', () => {
  it('two ships on the same spot do nothing to each other', () => {
    const match = setupFor(1);

    place(match.ships[0], 80, 45);
    place(match.ships[1], 80, 45);
    stepMatch(match, [controls(), controls()]);

    expect(match.ships[0].score).toBe(0);
    expect(match.ships[1].score).toBe(0);
    expect(match.ships[0].spin).toBe(0);
    expect(match.ships[1].spin).toBe(0);
    expect(match.phase).toBe('playing');
  });
});

describe('the speed fold', () => {
  it('a ship at 60 units firing straight ahead launches a missile that moves slower than the ship', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const shot = match.shots[0];

    ship.heading = 0;
    ship.vx = 60 * FINE_PER_UNIT;
    ship.vy = 0;

    stepMatch(match, [controls({ fire: true }), controls()]);

    // The missile added the muzzle (36 units) to 60, then the fold took 96 back to 31.
    expect(shot.live).toBe(true);
    expect(shot.vx).toBe(31 * FINE_PER_UNIT);
    expect(ship.vx).toBe(60 * FINE_PER_UNIT);
    expect(shot.vx).toBeLessThan(ship.vx);
  });
});

describe('the cloaked ship', () => {
  it('cannot steer, thrust or fire while cloaked', () => {
    const match = setupFor(2);
    const ship = match.ships[0];
    const shot = match.shots[0];

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    const heading = ship.heading;
    const vx = ship.vx;
    const vy = ship.vy;
    const ammo = ship.ammo;

    runTicks(match, 8, controls({ left: true, thrust: true, fire: true }), controls());

    expect(ship.heading).toBe(heading);
    expect(ship.vx).toBe(vx);
    expect(ship.vy).toBe(vy);
    expect(ship.ammo).toBe(ammo);
    expect(shot.live).toBe(false);
  });

  it('its missile in flight cannot hit until it uncloaks', () => {
    const match = setupFor(2);
    const ship = match.ships[0];
    const rival = match.ships[1];
    const shot = match.shots[0];

    stepMatch(match, [controls({ fire: true }), controls()]); // a missile is flying

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    place(rival, 100, 50);
    place(shot, 100, 50);
    shot.live = true;
    shot.age = 100;
    stepMatch(match, [controls(), controls()]);
    expect(ship.score).toBe(0);
    expect(rival.spin).toBe(0);
    expect(shot.live).toBe(true);

    place(rival, 100, 50);
    place(shot, 100, 50);
    shot.live = true;
    shot.age = 100;
    stepMatch(match, [controls({ cloak: true }), controls()]); // uncloak, the hit lands
    expect(ship.cloaked).toBe(false);
    expect(ship.score).toBe(1);
    expect(rival.spin).toBeGreaterThan(0);
    expect(shot.live).toBe(false);
  });

  it('its missile in flight cannot be swallowed by the star until it uncloaks', () => {
    const match = setupFor(4);
    const ship = match.ships[0];
    const shot = match.shots[0];

    stepMatch(match, [controls({ fire: true }), controls()]);

    stepMatch(match, [controls({ cloak: true }), controls()]);
    expect(ship.cloaked).toBe(true);

    place(shot, 80, 45); // on the star
    shot.live = true;
    shot.age = 100;
    stepMatch(match, [controls(), controls()]);
    expect(shot.live).toBe(true);
    expect(match.events.some((e) => e.kind === 'swallowed')).toBe(false);

    place(shot, 80, 45);
    shot.live = true;
    stepMatch(match, [controls({ cloak: true }), controls()]); // uncloak, swallowed
    expect(ship.cloaked).toBe(false);
    expect(shot.live).toBe(false);
    expect(match.events.some((e) => e.kind === 'swallowed')).toBe(true);
  });
});

describe('a hit does not reload early', () => {
  it('after a hit the next shot still waits the full 128 ticks from the last firing', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    const rival = match.ships[1];
    const shot = match.shots[0];
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
    expect(ship.ammo).toBe(AMMO_SEGMENTS - 1); // no early reload

    const firedTicks: number[] = [];
    for (let i = 0; i < 128; i++) {
      stepMatch(match, [held, controls()]);
      if (match.events.some((e) => e.kind === 'fired')) firedTicks.push(match.tick);
    }
    expect(firedTicks).toEqual([129]);
  });
});

describe('the spinning victim', () => {
  it('spins 64 ticks one heading step a tick and returns to its original heading', () => {
    const match = setupFor(1);
    const [ship0, ship1] = match.ships;
    const shot0 = match.shots[0];

    place(ship1, 80, 45);
    place(shot0, 80, 45);
    shot0.live = true;
    shot0.life = 100;
    shot0.age = 100;
    const headingBefore = ship1.heading;

    stepMatch(match, [controls(), controls()]);

    expect(ship1.spin).toBe(SPIN_TICKS - 1); // the hit tick already stepped once
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
    expect(ship0.score).toBe(1);
  });

  it('cannot be scored on again while spinning, though the missile is still removed', () => {
    const match = setupFor(1);
    const [ship0, ship1] = match.ships;
    const shot0 = match.shots[0];

    ship1.spin = 10;
    place(ship1, 80, 45);
    place(shot0, 80, 45);
    shot0.live = true;
    shot0.life = 100;
    shot0.age = 100;

    stepMatch(match, [controls(), controls()]);

    expect(ship0.score).toBe(0);
    expect(shot0.live).toBe(false);
    expect(ship1.spin).toBe(9); // the spin carries on, not reset
  });

  it('can still thrust and fire while spinning', () => {
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
});

describe('self-hit', () => {
  it('is harmless for the first 8 ticks', () => {
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

  it('on switch A, after the grace it explodes and the rival scores', () => {
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

  it('on switch B, after the grace the missile is just taken back', () => {
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

describe('gravity rhythm', () => {
  it('pulls each body once every 8 ticks, on odd ticks, in the order ship 0, ship 1, shot 0, shot 1', () => {
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
    // Gravity visits body 0 on tick 1, body 1 on tick 3, body 2 on tick 5, body 3 on tick 7.
    const pulledOnTick: readonly (0 | 1 | 2 | 3 | null)[] = [0, null, 1, null, 2, null, 3, null];

    for (let tickIndex = 0; tickIndex < 8; tickIndex++) {
      const before = bodies.map((body) => body.vx);
      stepMatch(match, [controls(), controls()]);
      const pulled = pulledOnTick[tickIndex];

      bodies.forEach((body, index) => {
        if (pulled === index) {
          expect(body.vx).toBeGreaterThan(before[index] ?? 0);
        } else {
          expect(body.vx).toBe(before[index]);
        }
      });
    }
  });
});

describe('docking tolerance', () => {
  it('on switch B a dock needs a whole-unit difference under 16', () => {
    const docks = setupFor(8);
    place(docks.ships[0], 80, 45, 5, 5);
    place(docks.shots[0], 80, 45, 20, 5); // |5-20| + |5-5| = 15: docks
    stepMatch(docks, [controls(), controls()]);
    expect(docks.ships[0].score).toBe(1);

    const refuses = setupFor(8);
    place(refuses.ships[0], 80, 45, 5, 5);
    place(refuses.shots[0], 80, 45, 21, 5); // |5-21| = 16: refuses
    stepMatch(refuses, [controls(), controls()]);
    expect(refuses.ships[0].score).toBe(0);
  });

  it('on switch A a dock needs at most 1 whole unit', () => {
    const docks = setupFor(8, { switches: ['A', 'B'] });
    place(docks.ships[0], 80, 45, 5, 5);
    place(docks.shots[0], 80, 45, 6, 5); // |5-6| = 1: docks
    stepMatch(docks, [controls(), controls()]);
    expect(docks.ships[0].score).toBe(1);

    const refuses = setupFor(8, { switches: ['A', 'B'] });
    place(refuses.ships[0], 80, 45, 5, 5);
    place(refuses.shots[0], 80, 45, 7, 5); // |5-7| = 2: refuses
    stepMatch(refuses, [controls(), controls()]);
    expect(refuses.ships[0].score).toBe(0);
  });
});

describe('match end', () => {
  it('ten points end the match at once', () => {
    const match = setupFor(1); // target 10
    const ship0 = match.ships[0];
    const rival = match.ships[1];
    const shot0 = match.shots[0];

    ship0.score = 9;
    place(rival, 80, 45);
    place(shot0, 80, 45);
    shot0.live = true;
    shot0.life = 100;
    shot0.age = 100;

    stepMatch(match, [controls(), controls()]);

    expect(ship0.score).toBe(10);
    expect(match.phase).toBe('over');
    expect(match.winner).toBe(0);
    expect(
      match.events.some((e) => e.kind === 'over' && e.reason === 'target' && e.winner === 0),
    ).toBe(true);
  });

  it('the clock ends the match after 35,840 ticks with a warning 1,024 ticks before', () => {
    const match = setupFor(1); // clockTicks = CARTRIDGE_MATCH_TICKS = 35,840
    let warningTick = 0;
    let overTick = 0;

    for (let i = 0; i < CARTRIDGE_MATCH_TICKS; i++) {
      stepMatch(match, [controls(), controls()]);
      if (warningTick === 0 && match.events.some((e) => e.kind === 'clock-warning')) {
        warningTick = match.tick;
      }
      if (overTick === 0 && match.events.some((e) => e.kind === 'over')) {
        overTick = match.tick;
      }
    }

    expect(warningTick).toBe(CARTRIDGE_MATCH_TICKS - CLOCK_WARNING_TICKS);
    expect(overTick).toBe(CARTRIDGE_MATCH_TICKS);
    expect(match.phase).toBe('over');
    expect(match.winner).toBeNull();
    expect(match.events.some((e) => e.kind === 'over' && e.reason === 'clock')).toBe(true);
  });
});
