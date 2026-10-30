/**
 * Tests for Gravity Duel's four Remix rules: the binary stars, the comet, the
 * asteroid belt and Last Fuel. Each builds its match from the channel, then
 * parks bodies where they are needed rather than flying them there, so nothing
 * here depends on the wall clock.
 */
import { describe, expect, it } from 'vitest';
import { channelById } from '../src/channels.ts';
import { START_SPOTS, createMatch, stepMatch } from '../src/engine/match.ts';
import { beltRocks, binaryStars, cometAt, pullAt, type RemixBody } from '../src/engine/remix.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  CENTRE_X,
  CENTRE_Y,
  FINE_PER_UNIT,
  SUBPIXELS,
  type Match,
  type MatchSetup,
  type Remix,
} from '../src/engine/types.ts';
import { controls, place, setupFor } from './helpers.ts';

/** A match on a Remix channel, with the cartridge's clock and a fixed seed unless overridden. */
function remixSetup(id: Remix['id'], overrides: Partial<MatchSetup> = {}): Match {
  const channel = channelById(id);
  if (!channel) throw new Error(`no channel ${id}`);
  const setup: MatchSetup = {
    rules: channel.rules,
    switches: ['B', 'B'],
    target: 10,
    clockTicks: CARTRIDGE_MATCH_TICKS,
    seed: 1,
    ...overrides,
  };
  return createMatch(setup);
}

/** The comet at the match's current tick, failing the test rather than a null when it should be present. */
function cometPosition(match: Match): RemixBody {
  const comet = cometAt(match);
  if (comet === null) throw new Error('expected the comet to be crossing');
  return comet;
}

/** Rock 0 at a tick, failing the test when the belt is somehow empty. */
function firstRock(tick: number): RemixBody {
  const rock = beltRocks(tick)[0];
  if (rock === undefined) throw new Error('expected a rock in the belt');
  return rock;
}

describe('binary stars', () => {
  it('sits 14 steps from the middle, opposite each other, turning once per 1,000 ticks', () => {
    const [a, b] = binaryStars(0);
    expect(a.x).toBe(CENTRE_X + 14 * SUBPIXELS);
    expect(a.y).toBe(CENTRE_Y);
    expect(b.x).toBe(CENTRE_X - 14 * SUBPIXELS);
    expect(b.y).toBe(CENTRE_Y);

    // A quarter turn later the first star is straight up: counter-clockwise.
    const [up] = binaryStars(250);
    expect(up.x).toBe(CENTRE_X);
    expect(up.y).toBe(CENTRE_Y - 14 * SUBPIXELS);

    expect(binaryStars(1000)).toEqual(binaryStars(0));
  });

  it('pulls from both stars, not from the middle', () => {
    const match = remixSetup('binary-stars');
    // Ten steps right of the middle, the near star sits a further four steps
    // right and wins, pulling the body away from the middle rather than toward it.
    const right = pullAt(match, CENTRE_X + 10 * SUBPIXELS, CENTRE_Y);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBe(0);

    const left = pullAt(match, CENTRE_X - 10 * SUBPIXELS, CENTRE_Y);
    expect(left.x).toBeLessThan(0);
  });

  it('crashes a ship that touches either star, scoring for the rival', () => {
    const match = remixSetup('binary-stars');
    const ship = match.ships[0];

    place(ship, 80 + 14, 45); // star 0 at tick 0
    stepMatch(match, [controls(), controls()]);

    expect(ship.x).toBe(START_SPOTS[0].x);
    expect(ship.y).toBe(START_SPOTS[0].y);
    expect(ship.spin).toBeGreaterThan(0);
    expect(match.ships[1].score).toBe(1);
    expect(match.events.some((e) => e.kind === 'star-crash' && e.seat === 0)).toBe(true);
  });

  it('swallows a missile that touches either star', () => {
    const match = remixSetup('binary-stars');
    const shot = match.shots[0];

    place(shot, 80 + 14, 45); // star 0 at tick 0
    shot.live = true;
    shot.life = 100;
    shot.age = 100;
    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(false);
    expect(match.ships[0].score).toBe(0);
    expect(match.ships[1].score).toBe(0);
    expect(match.events.some((e) => e.kind === 'swallowed' && e.seat === 0)).toBe(true);
  });
});

describe('comet', () => {
  it('passes every 1,000 ticks from 600 and lasts 300', () => {
    const match = remixSetup('comet');

    match.tick = 599;
    expect(cometAt(match)).toBeNull();

    match.tick = 600;
    expect(cometAt(match)).not.toBeNull();

    match.tick = 899;
    expect(cometAt(match)).not.toBeNull();

    match.tick = 900;
    expect(cometAt(match)).toBeNull();

    match.tick = 1599;
    expect(cometAt(match)).toBeNull();

    match.tick = 1600;
    expect(cometAt(match)).not.toBeNull();
  });

  it('crosses from edge to edge, left to right then right to left', () => {
    const match = remixSetup('comet');

    match.tick = 600; // pass 0: left to right
    expect(cometPosition(match).x).toBe(-10 * SUBPIXELS);

    match.tick = 750; // halfway across
    expect(cometPosition(match).x).toBe(CENTRE_X);

    match.tick = 1600; // pass 1: right to left
    expect(cometPosition(match).x).toBe(170 * SUBPIXELS);
  });

  it('pulls a body near its path and not one far away', () => {
    const match = remixSetup('comet');
    match.tick = 600;
    const comet = cometPosition(match);

    const near = pullAt(match, comet.x + SUBPIXELS, comet.y);
    expect(near.x).toBeLessThan(0); // toward the comet on its left

    const far = pullAt(match, 160 * SUBPIXELS, 45 * SUBPIXELS);
    expect(far).toEqual({ x: 0, y: 0 });
  });

  it('replays the same pass for the same seed', () => {
    const a = remixSetup('comet', { seed: 42 });
    const b = remixSetup('comet', { seed: 42 });
    for (let tick = 600; tick <= 899; tick += 50) {
      a.tick = tick;
      b.tick = tick;
      expect(cometAt(a)).toEqual(cometAt(b));
    }
  });
});

describe('asteroid belt', () => {
  it('lays ten rocks on a ring of 24 steps, turning once per 3,000 ticks', () => {
    const rocks = beltRocks(0);
    expect(rocks).toHaveLength(10);
    for (const rock of rocks) {
      const dx = rock.x - CENTRE_X;
      const dy = rock.y - CENTRE_Y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(Math.abs(distance - 24 * SUBPIXELS)).toBeLessThanOrEqual(1);
    }

    // Rock 0 starts due right and turns counter-clockwise: up after one tick.
    expect(firstRock(0)).toEqual({ x: CENTRE_X + 24 * SUBPIXELS, y: CENTRE_Y, radius: 2.5 });
    expect(firstRock(1).y).toBeLessThan(CENTRE_Y);
    expect(firstRock(1500)).toEqual({ x: CENTRE_X - 24 * SUBPIXELS, y: CENTRE_Y, radius: 2.5 });
    expect(firstRock(3000)).toEqual(firstRock(0));
  });

  it('stops a missile that touches a rock', () => {
    const match = remixSetup('asteroid-belt');
    const shot = match.shots[0];

    place(shot, 80 + 24, 45); // rock 0 at tick 0
    shot.live = true;
    shot.life = 100;
    shot.age = 100;
    stepMatch(match, [controls(), controls()]);

    expect(shot.live).toBe(false);
    expect(match.ships[0].score).toBe(0);
    expect(match.ships[1].score).toBe(0);
    expect(
      match.events.some((e) => e.kind === 'rock' && e.seat === 0 && e.what === 'missile'),
    ).toBe(true);
  });

  it('bounces a ship off a rock: normal reversed, tangent and speed kept', () => {
    const match = remixSetup('asteroid-belt');
    const ship = match.ships[0];
    // Touches are judged on tick 1, after the belt has turned one tick.
    const rock = firstRock(1);

    // One step right of the rock, so the bounce normal points straight right.
    place(ship, rock.x / SUBPIXELS + 1, rock.y / SUBPIXELS, 20, 5);
    stepMatch(match, [controls(), controls()]);

    expect(ship.vx).toBe(-20 * FINE_PER_UNIT); // the radial component reversed
    expect(ship.vy).toBe(5 * FINE_PER_UNIT); // the tangential component kept
    expect(match.events.some((e) => e.kind === 'rock' && e.seat === 0 && e.what === 'ship')).toBe(
      true,
    );
  });

  it('lets a cloaked ship pass through a rock', () => {
    const match = remixSetup('asteroid-belt');
    const ship = match.ships[0];
    const rock = firstRock(0);

    ship.cloaked = true;
    place(ship, rock.x / SUBPIXELS, rock.y / SUBPIXELS, 5, 0);
    stepMatch(match, [controls(), controls()]);

    expect(ship.vx).toBe(5 * FINE_PER_UNIT); // untouched: no bounce
    expect(match.events.some((e) => e.kind === 'rock')).toBe(false);
  });
});

describe('last fuel', () => {
  it('never reloads when both ships are out', () => {
    const match = remixSetup('last-fuel');
    match.ships[0].ammo = 0;
    match.ships[1].ammo = 0;

    const shot = match.shots[0];
    shot.live = true;
    shot.life = 1; // expires this tick, the cartridge's reload moment
    stepMatch(match, [controls(), controls()]);

    expect(match.ships[0].ammo).toBe(0);
    expect(match.ships[1].ammo).toBe(0);
    expect(match.events.some((e) => e.kind === 'reload')).toBe(false);
  });

  it("ends 'spent' when both are out and no missile flies, the higher score winning", () => {
    const match = remixSetup('last-fuel');
    match.ships[0].ammo = 0;
    match.ships[1].ammo = 0;
    match.ships[0].score = 3;
    match.ships[1].score = 1;

    stepMatch(match, [controls(), controls()]);

    expect(match.phase).toBe('over');
    expect(match.winner).toBe(0);
    expect(
      match.events.some((e) => e.kind === 'over' && e.reason === 'spent' && e.winner === 0),
    ).toBe(true);
  });

  it("draws a tied 'spent' match", () => {
    const match = remixSetup('last-fuel');
    match.ships[0].ammo = 0;
    match.ships[1].ammo = 0;
    match.ships[0].score = 2;
    match.ships[1].score = 2;

    stepMatch(match, [controls(), controls()]);

    expect(match.phase).toBe('over');
    expect(match.winner).toBeNull();
    expect(
      match.events.some((e) => e.kind === 'over' && e.reason === 'spent' && e.winner === null),
    ).toBe(true);
  });

  it('keeps playing while a missile is still flying', () => {
    const match = remixSetup('last-fuel');
    match.ships[0].ammo = 0;
    match.ships[1].ammo = 0;
    // In flight well away from both ships, so it cannot touch its own on the way.
    place(match.shots[0], 80, 10, 0, 0);
    match.shots[0].live = true;
    match.shots[0].life = 100;
    match.shots[0].age = 100;

    stepMatch(match, [controls(), controls()]);

    expect(match.phase).toBe('playing');
  });
});

describe('cartridge channels', () => {
  it('keep their own middle star', () => {
    const match = setupFor(5); // star, wrap and cloak, no Remix

    const pull = pullAt(match, CENTRE_X - 10 * SUBPIXELS, CENTRE_Y);
    expect(pull.x).toBeGreaterThan(0); // the middle still pulls toward it

    place(match.ships[0], 80, 45);
    stepMatch(match, [controls(), controls()]);
    expect(match.ships[1].score).toBe(1); // touching the middle still crashes
  });
});
