/**
 * Gravity Duel's match rules: the 20 ms tick that runs a duel or a docking
 * race from kick-off to the final whistle. It owns the cartridge's sequencing
 * — cloak, fire, turn, thrust, touches, countdowns, spins, motion, gravity and
 * the clock — while physics.ts owns the arithmetic of a single body. A match
 * is a pure function of its seed and the controls it is fed, so the Kids, the
 * looks and the tests all replay the same game.
 */
import { createRng, type Rng } from '@woodgrain-88/kit';
import {
  axisDelta,
  burnFuel,
  dropSegment,
  gravityTurn,
  moveBody,
  muzzleVelocity,
  speedDifference,
  speedUnits,
  touching,
  turnShip,
  thrustShip,
} from './physics.ts';
import {
  AMMO_SEGMENTS,
  BURNS_PER_SEGMENT,
  CENTRE_RADIUS,
  CENTRE_X,
  CENTRE_Y,
  CLOCK_WARNING_TICKS,
  DOCK_COOLDOWN,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FINE_PER_UNIT,
  FUEL_SEGMENTS,
  HEADINGS,
  MISSILE_LIFE,
  MISSILE_RADIUS,
  POD_RADIUS,
  SEATS,
  SELF_HIT_GRACE,
  SHIP_RADIUS,
  SHIP_WALL_MARGIN,
  SPIN_TICKS,
  SUBPIXELS,
  THRUST_EVERY,
  type Body,
  type Controls,
  type Edges,
  type Match,
  type MatchSetup,
  type Seat,
  type Ship,
  type Shot,
} from './types.ts';
import {
  COMET_FIRST_TICK,
  COMET_PASS_TICKS,
  COMET_PERIOD,
  beltRocks,
  binaryStars,
  cometAt,
  pullAt,
  type RemixBody,
} from './remix.ts';

/** Where each seat starts, and where the star and the starbase send it back to. */
export const START_SPOTS: readonly [
  { readonly x: number; readonly y: number; readonly heading: number },
  { readonly x: number; readonly y: number; readonly heading: number },
] = [
  { x: 30 * SUBPIXELS, y: 20 * SUBPIXELS, heading: 0 },
  { x: 130 * SUBPIXELS, y: 70 * SUBPIXELS, heading: 8 },
];

/** The other seat. */
export function rival(seat: Seat): Seat {
  return seat === 0 ? 1 : 0;
}

/** The middle of the field as a touchable body (the star or the starbase). */
const MIDDLE: Body = {
  x: CENTRE_X,
  y: CENTRE_Y,
  vx: 0,
  vy: 0,
  prevX: CENTRE_X,
  prevY: CENTRE_Y,
  wrapped: false,
};

export function createMatch(setup: MatchSetup): Match {
  const { rules } = setup;
  const duel = rules.mode === 'duel';
  const ship0 = createShip(setup, 0);
  const ship1 = createShip(setup, 1);
  const random = createRng(setup.seed).fork('pods');

  const shot0 = createShot(ship0);
  const shot1 = createShot(ship1);

  if (!duel) {
    const velocity = randomPodVelocity(random);
    shot0.live = true;
    shot0.x = ship0.x;
    shot0.y = CENTRE_Y;
    shot0.prevX = ship0.x;
    shot0.prevY = CENTRE_Y;
    shot0.vx = velocity.x;
    shot0.vy = velocity.y;
    if (rules.pods === 'own') {
      shot1.live = true;
      shot1.x = ship1.x;
      shot1.y = CENTRE_Y;
      shot1.prevX = ship1.x;
      shot1.prevY = CENTRE_Y;
      shot1.vx = -velocity.x;
      shot1.vy = velocity.y;
    }
  }

  return {
    setup,
    ships: [ship0, ship1],
    shots: [shot0, shot1],
    random,
    tick: 0,
    clockLeft: setup.clockTicks,
    phase: 'playing',
    winner: null,
    events: [],
  };
}

/** Advances the match one tick with each seat's controls (seat 1's are ignored in solo). */
export function stepMatch(match: Match, controls: readonly [Controls, Controls]): void {
  match.events = [];

  if (match.phase === 'over') {
    moveAll(match);
    applyGravity(match);
    return;
  }

  match.tick += 1;
  emitCometEvents(match);

  for (const seat of SEATS) {
    const ship = match.ships[seat];
    if (!ship.present) continue;
    playSeat(match, ship, seat, controls[seat]);
  }

  if (reachedTarget(match)) {
    finish(match, 'target');
    moveAll(match);
    applyGravity(match);
    return;
  }

  countDown(match);
  if (reachedSpent(match)) {
    finish(match, 'spent');
    moveAll(match);
    applyGravity(match);
    return;
  }
  spinShips(match);
  moveAll(match);
  applyGravity(match);
  tickClock(match);
}

function createShip(setup: MatchSetup, seat: Seat): Ship {
  const spot = START_SPOTS[seat];
  const duel = setup.rules.mode === 'duel';
  return {
    x: spot.x,
    y: spot.y,
    vx: 0,
    vy: 0,
    prevX: spot.x,
    prevY: spot.y,
    wrapped: false,
    present: seat === 0 || setup.rules.mode !== 'solo',
    heading: spot.heading,
    turnWait: 0,
    fuel: duel ? FUEL_SEGMENTS : 0,
    burnsLeft: BURNS_PER_SEGMENT - 1,
    ammo: duel ? AMMO_SEGMENTS : 0,
    cloaked: false,
    cloakHeld: false,
    spin: 0,
    thrusting: false,
    dockCooldown: 0,
    score: 0,
  };
}

/** A shot that sits inert on its ship until a duel fires it or docking turns it into a pod. */
function createShot(ship: Ship): Shot {
  return {
    x: ship.x,
    y: ship.y,
    vx: 0,
    vy: 0,
    prevX: ship.x,
    prevY: ship.y,
    wrapped: false,
    live: false,
    life: 0,
    age: 0,
    turned: 0,
  };
}

/** A pod's random velocity: whole units 2–14 per axis, sign flipped on a coin toss. */
function randomPodVelocity(random: Rng): { x: number; y: number } {
  return { x: signedAxis(random), y: signedAxis(random) };
}

function signedAxis(random: Rng): number {
  const magnitude = random.int(2, 14);
  return (random.chance(0.5) ? -magnitude : magnitude) * FINE_PER_UNIT;
}

/** One seat's whole turn: the cloak, then (uncloaked) fire, steer, thrust and touches. */
function playSeat(match: Match, ship: Ship, seat: Seat, controls: Controls): void {
  const { rules } = match.setup;

  // The cloak burns from the same counter as thrust, so it drains on the same
  // four-tick beat.
  if (ship.cloaked && match.tick % THRUST_EVERY === 0 && burnFuel(ship)) {
    burnout(match, ship, seat);
  }

  if (rules.cloak) toggleCloak(match, ship, seat, controls);

  // While cloaked the cartridge skips everything else for this ship: it drifts
  // and cannot steer, thrust, fire, or touch anything.
  if (ship.cloaked) return;

  if (rules.mode === 'duel') fire(match, ship, seat, controls);

  turnShip(ship, controls);
  if (thrustShip(ship, controls, match.tick, rules.mode !== 'duel') === 'fuel-out') {
    match.events.push({ kind: 'fuel-out', seat });
  }

  if (rules.mode === 'duel') touchesInDuel(match, ship, seat);
  else dock(match, ship, seat);
}

function toggleCloak(match: Match, ship: Ship, seat: Seat, controls: Controls): void {
  const pulledAlone = controls.cloak && !controls.left && !controls.right && !controls.thrust;
  if (!pulledAlone) {
    ship.cloakHeld = false;
    return;
  }
  if (ship.cloakHeld) return;

  ship.cloaked = !ship.cloaked;
  ship.cloakHeld = true;
  match.events.push({ kind: 'cloak', seat, on: ship.cloaked });
  if (ship.cloaked && dropSegment(ship)) burnout(match, ship, seat);
}

/** The cloak emptied the tank: the ship blows up, uncloaks and must let go before cloaking again. */
function burnout(match: Match, ship: Ship, seat: Seat): void {
  explode(match, ship, seat);
  ship.cloaked = false;
  ship.cloakHeld = true;
  match.events.push({ kind: 'cloak-burnout', seat });
}

function fire(match: Match, ship: Ship, seat: Seat, controls: Controls): void {
  const shot = match.shots[seat];
  if (!controls.fire || shot.life !== 0 || ship.ammo <= 0) return;

  ship.ammo -= 1;
  shot.live = true;
  shot.life = MISSILE_LIFE;
  shot.age = 0;
  shot.turned = 0;
  shot.x = ship.x;
  shot.y = ship.y;
  shot.prevX = ship.x;
  shot.prevY = ship.y;
  shot.wrapped = false;

  // The missile keeps the ship's whole speed units (its fraction dropped) and
  // adds the muzzle; the fold happens when it next moves, not here.
  const muzzle = muzzleVelocity(ship.heading);
  shot.vx = (speedUnits(ship.vx) + muzzle.x) * FINE_PER_UNIT;
  shot.vy = (speedUnits(ship.vy) + muzzle.y) * FINE_PER_UNIT;

  match.events.push({ kind: 'fired', seat });
}

/** The first touch that applies this tick, in the cartridge's order. */
function touchesInDuel(match: Match, ship: Ship, seat: Seat): void {
  const { rules } = match.setup;
  const shot = match.shots[seat];
  const victim = match.ships[rival(seat)];

  if (
    shot.live &&
    victim.present &&
    !victim.cloaked &&
    touching(shot, victim, MISSILE_RADIUS, SHIP_RADIUS, rules.edges)
  ) {
    shot.live = false;
    if (victim.spin === 0) {
      victim.spin = SPIN_TICKS;
      score(match, seat);
      match.events.push({ kind: 'hit', shooter: seat, victim: rival(seat), turned: shot.turned });
    }
    return;
  }

  if (
    shot.live &&
    shot.age >= SELF_HIT_GRACE &&
    touching(shot, ship, MISSILE_RADIUS, SHIP_RADIUS, rules.edges)
  ) {
    shot.live = false;
    const exploded = match.setup.switches[seat] === 'A';
    if (exploded) explode(match, ship, seat);
    match.events.push({ kind: 'self-hit', seat, exploded });
    return;
  }

  if (rules.remix?.id === 'binary-stars') {
    if (touchBinaryStars(match, ship, seat, shot)) return;
  } else if (rules.centre === 'star' || rules.centre === 'starbase') {
    if (touching(ship, MIDDLE, SHIP_RADIUS, CENTRE_RADIUS, rules.edges)) {
      if (rules.centre === 'star') {
        restart(ship, seat);
        explode(match, ship, seat);
        match.events.push({ kind: 'star-crash', seat });
      } else {
        // The cartridge measured the ship's speed after zeroing it, so its crash
        // check could never fire; we report the real speed and never explode.
        const speed = Math.abs(speedUnits(ship.vx)) + Math.abs(speedUnits(ship.vy));
        restart(ship, seat);
        ship.fuel = FUEL_SEGMENTS;
        ship.ammo = AMMO_SEGMENTS;
        match.events.push({ kind: 'refuelled', seat, speed });
      }
      return;
    }

    if (shot.live && touching(shot, MIDDLE, MISSILE_RADIUS, CENTRE_RADIUS, rules.edges)) {
      shot.live = false;
      match.events.push({ kind: 'swallowed', seat });
    }
  }

  if (rules.remix?.id === 'asteroid-belt') {
    touchRocks(match, ship, seat, shot);
  }
}

/** Binary Stars: the pair behaves exactly like the cartridge's star, in two places at once. */
function touchBinaryStars(match: Match, ship: Ship, seat: Seat, shot: Shot): boolean {
  const stars = binaryStars(match.tick);
  const { edges } = match.setup.rules;

  if (stars.some((star) => touchingRemixBody(ship, star, SHIP_RADIUS, edges))) {
    restart(ship, seat);
    explode(match, ship, seat);
    match.events.push({ kind: 'star-crash', seat });
    return true;
  }

  if (shot.live && stars.some((star) => touchingRemixBody(shot, star, MISSILE_RADIUS, edges))) {
    shot.live = false;
    match.events.push({ kind: 'swallowed', seat });
    return true;
  }

  return false;
}

/** Asteroid Belt: rocks bounce a ship and stop a missile, after the cartridge's own touches. */
function touchRocks(match: Match, ship: Ship, seat: Seat, shot: Shot): void {
  const rocks = beltRocks(match.tick);
  const { edges } = match.setup.rules;

  const nearest = nearestRock(ship, rocks, edges);
  if (nearest) {
    bounceOffRock(ship, nearest);
    match.events.push({ kind: 'rock', seat, what: 'ship' });
  }

  if (shot.live && rocks.some((rock) => touchingRemixBody(shot, rock, MISSILE_RADIUS, edges))) {
    shot.live = false;
    match.events.push({ kind: 'rock', seat, what: 'missile' });
  }
}

/** The rock a ship overlaps, nearest to its centre; a ship inside two bounces off that one only. */
function nearestRock(ship: Ship, rocks: readonly RemixBody[], edges: Edges): RemixBody | null {
  let nearest: RemixBody | null = null;
  let nearestDistance = Infinity;
  for (const rock of rocks) {
    if (!touchingRemixBody(ship, rock, SHIP_RADIUS, edges)) continue;
    const dx = ship.x - rock.x;
    const dy = ship.y - rock.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = rock;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Reflects the ship's velocity off the rock and pushes it just clear of the touch distance. */
function bounceOffRock(ship: Ship, rock: RemixBody): void {
  const dx = ship.x - rock.x;
  const dy = ship.y - rock.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // A ship dead on the rock's centre has no radial direction; treat it as nudged right.
  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;

  const radial = ship.vx * nx + ship.vy * ny;
  ship.vx = Math.round(ship.vx - 2 * radial * nx);
  ship.vy = Math.round(ship.vy - 2 * radial * ny);

  const reach = (SHIP_RADIUS + rock.radius) * SUBPIXELS;
  ship.x = Math.round(rock.x + nx * (reach + 1));
  ship.y = Math.round(rock.y + ny * (reach + 1));
}

/** Whether a body's circle overlaps a Remix body's, the same circle test the cartridge's touch uses. */
function touchingRemixBody(body: Body, remix: RemixBody, radius: number, edges: Edges): boolean {
  const dx = axisDelta(body.x, remix.x, FIELD_WIDTH * SUBPIXELS, edges);
  const dy = axisDelta(body.y, remix.y, FIELD_HEIGHT * SUBPIXELS, edges);
  const reach = (radius + remix.radius) * SUBPIXELS;
  return dx * dx + dy * dy < reach * reach;
}

/** Docking: a ship docks with its pod when they touch with near-matched speeds. */
function dock(match: Match, ship: Ship, seat: Seat): void {
  const { rules } = match.setup;
  const podIndex: Seat = rules.pods === 'own' ? seat : 0;
  const pod = match.shots[podIndex];
  const maxDifference = match.setup.switches[seat] === 'A' ? 1 : 15;

  if (!pod.live || ship.dockCooldown !== 0) return;
  if (!touching(ship, pod, SHIP_RADIUS, POD_RADIUS, rules.edges)) return;
  if (speedDifference(ship, pod) > maxDifference) return;

  score(match, seat);
  const velocity = randomPodVelocity(match.random);
  pod.vx = velocity.x;
  pod.vy = velocity.y;
  ship.dockCooldown = DOCK_COOLDOWN;
  match.events.push({ kind: 'docked', seat, pod: podIndex });
}

function countDown(match: Match): void {
  if (match.setup.rules.mode === 'duel') {
    countDownMissiles(match);
    return;
  }
  for (const seat of SEATS) {
    const ship = match.ships[seat];
    if (ship.present && ship.dockCooldown > 0) ship.dockCooldown -= 1;
  }
}

function countDownMissiles(match: Match): void {
  for (const seat of SEATS) {
    const shot = match.shots[seat];
    if (shot.life === 0) continue;
    shot.life -= 1;
    shot.age += 1;
    if (shot.life !== 0) continue;
    shot.live = false;
    // A hit does not shorten this countdown; only its natural end can reload.
    // Last Fuel has no mutual reload: the missiles never come back.
    if (
      match.setup.rules.remix?.id !== 'last-fuel' &&
      match.ships[0].ammo === 0 &&
      match.ships[1].ammo === 0
    ) {
      match.ships[0].ammo = AMMO_SEGMENTS;
      match.ships[1].ammo = AMMO_SEGMENTS;
      match.events.push({ kind: 'reload' });
    }
  }
}

function spinShips(match: Match): void {
  for (const seat of SEATS) {
    const ship = match.ships[seat];
    if (!ship.present || ship.spin === 0) continue;
    ship.spin -= 1;
    ship.heading = (ship.heading + 1) % HEADINGS;
  }
}

function moveAll(match: Match): void {
  const { rules } = match.setup;
  for (const seat of SEATS) {
    const ship = match.ships[seat];
    if (!ship.present) continue;
    moveBody(ship, rules.edges, SHIP_WALL_MARGIN);
  }
  const shotRadius = rules.mode === 'duel' ? MISSILE_RADIUS : POD_RADIUS;
  for (const seat of SEATS) {
    const shot = match.shots[seat];
    if (!shot.live) continue;
    moveBody(shot, rules.edges, shotRadius);
  }
}

function applyGravity(match: Match): void {
  const { rules } = match.setup;
  if (!hasGravity(match)) return;

  const index = gravityTurn(match.tick);
  if (index === null) return;

  if (index === 0 || index === 1) {
    const ship = match.ships[index];
    if (!ship.present) return;
    pullAtBody(match, ship);
    return;
  }

  const shot = match.shots[index === 2 ? 0 : 1];
  if (!shot.live) return;
  if (rules.mode === 'duel') {
    const before = directionOf(shot.vx, shot.vy);
    pullAtBody(match, shot);
    shot.turned += wrapAngle(directionOf(shot.vx, shot.vy) - before);
  } else {
    pullAtBody(match, shot);
  }
}

/** Whether anything pulls this tick: the cartridge's middle, or the comet crossing. */
function hasGravity(match: Match): boolean {
  const { rules } = match.setup;
  return rules.gravity || rules.remix?.id === 'comet';
}

function pullAtBody(match: Match, body: Body): void {
  const pull = pullAt(match, body.x, body.y);
  body.vx += pull.x;
  body.vy += pull.y;
}

/** A body's direction of travel in (−π, π], counter-clockwise positive (y runs down). */
function directionOf(vx: number, vy: number): number {
  return Math.atan2(-vy, vx);
}

function wrapAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped <= -Math.PI) wrapped += 2 * Math.PI;
  while (wrapped > Math.PI) wrapped -= 2 * Math.PI;
  return wrapped;
}

function tickClock(match: Match): void {
  match.clockLeft -= 1;
  if (match.clockLeft === CLOCK_WARNING_TICKS) {
    match.events.push({ kind: 'clock-warning' });
  }
  if (match.clockLeft === 0) finish(match, 'clock');
}

function score(match: Match, seat: Seat): void {
  const ship = match.ships[seat];
  ship.score += 1;
  match.events.push({ kind: 'scored', seat, score: ship.score });
}

/** A hit, self-hit on A, star crash or cloak burnout: spin (once) and give the rival a point. */
function explode(match: Match, ship: Ship, seat: Seat): void {
  if (ship.spin !== 0) return;
  ship.spin = SPIN_TICKS;
  score(match, rival(seat));
}

/** Back to the seat's start spot at rest; the heading is kept. */
function restart(ship: Ship, seat: Seat): void {
  const spot = START_SPOTS[seat];
  ship.x = spot.x;
  ship.y = spot.y;
  ship.prevX = spot.x;
  ship.prevY = spot.y;
  ship.vx = 0;
  ship.vy = 0;
  ship.wrapped = false;
}

function reachedTarget(match: Match): boolean {
  const target = match.setup.target;
  return match.ships.some((ship) => ship.present && ship.score >= target);
}

/** Comet: a pass enters on its first tick and leaves on the tick after its last. */
function emitCometEvents(match: Match): void {
  if (match.setup.rules.remix?.id !== 'comet') return;
  const offset = match.tick - COMET_FIRST_TICK;
  if (offset < 0) return;
  const within = offset % COMET_PERIOD;
  if (within === 0) {
    // The engine draws the pass now, on its first tick, so the looks asking where the comet is
    // can never be the first to touch the match's random stream and change a replay.
    cometAt(match);
    match.events.push({ kind: 'comet', entering: true });
  } else if (within === COMET_PASS_TICKS) {
    match.events.push({ kind: 'comet', entering: false });
  }
}

/** Last Fuel: both ships dry with nothing in the air ends the match on the score. */
function reachedSpent(match: Match): boolean {
  if (match.setup.rules.remix?.id !== 'last-fuel') return false;
  const noAmmo = match.ships[0].ammo === 0 && match.ships[1].ammo === 0;
  const nothingFlying = !match.shots[0].live && !match.shots[1].live;
  return noAmmo && nothingFlying;
}

function finish(match: Match, reason: 'target' | 'clock' | 'spent'): void {
  match.phase = 'over';
  match.winner = winnerOf(match);
  match.events.push({ kind: 'over', winner: match.winner, reason });
}

function winnerOf(match: Match): Seat | null {
  if (match.setup.rules.mode === 'solo') return null;
  const [first, second] = match.ships;
  if (first.score === second.score) return null;
  return first.score > second.score ? 0 : 1;
}
