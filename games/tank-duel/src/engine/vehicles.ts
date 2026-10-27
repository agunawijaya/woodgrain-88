/**
 * How the duel's vehicles move, one fixed step at a time. Tanks turn in
 * sixteen steps, drive forward only, are pushed back off walls and each other
 * and slide free when wedged; aircraft never stop, ease between their speed
 * tiers and wrap round the sky. Everything here is the 1977 handling, in
 * world units and seconds.
 */
import { ARENA_HEIGHT, ARENA_WIDTH, type Arena, type SkyDef } from '../arenas/format.ts';
import {
  AIRCRAFT_HANDICAP,
  AIRCRAFT_MUZZLE,
  AIRCRAFT_SPEEDS,
  BUMP_PUSH,
  BUMP_REVEAL_SECONDS,
  FORMATION_SPACING,
  TANK_MUZZLE,
  TANK_REVERSE_SPEED,
  TANK_SPEED,
  THROTTLE_SECONDS,
  TURN_STEP_SECONDS,
  VEHICLE_RADIUS,
  WEDGED_SECONDS,
} from './rules.ts';
import type { ChannelRules, Intent, MatchEvent, Side, VehicleState } from './types.ts';
import { add, distance, dot, headingVector, scale, sub, wrapStep, type Vec2 } from './vec.ts';
import type { WallEdge } from './walls.ts';

export interface TankWorld {
  readonly edges: readonly WallEdge[];
  /** Every other vehicle on the board (for tank-on-tank contact). */
  readonly others: readonly VehicleState[];
}

export interface VehicleStep {
  readonly vehicle: VehicleState;
  readonly events: readonly MatchEvent[];
}

export interface AircraftConditions {
  readonly handicap: boolean;
  /** False when the fast tier is not available (Ace Duel with an empty tank). */
  readonly fastAllowed: boolean;
}

/** Distance from a point to a finite line segment. */
function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const edgeVector = sub(b, a);
  const fromA = sub(point, a);
  const edgeLengthSq = dot(edgeVector, edgeVector);
  if (edgeLengthSq < 1e-12) {
    return distance(point, a);
  }
  const projectionFraction = Math.max(0, Math.min(1, dot(fromA, edgeVector) / edgeLengthSq));
  const closestPoint = add(a, scale(edgeVector, projectionFraction));
  return distance(point, closestPoint);
}

/** Whether a circle overlaps any wall face (its distance to a face is less than its radius). */
export function circleTouchesWalls(
  center: Vec2,
  radius: number,
  edges: readonly WallEdge[],
): boolean {
  for (const edge of edges) {
    if (distanceToSegment(center, edge.a, edge.b) < radius) {
      return true;
    }
  }
  return false;
}

/** Checks whether a tank's candidate circle overlaps another tank on the floor. */
function tankOverlapsOther(
  selfId: number,
  center: Vec2,
  radius: number,
  others: readonly VehicleState[],
): boolean {
  for (const other of others) {
    if (other.id !== selfId && other.vehicle === 'tank') {
      if (distance(center, other.position) < radius + other.radius) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether a tank may be pushed back to `spot`: clear of walls, and no closer to any other tank than it
 * already is (so two tanks already touching can still back away from each other).
 */
function pushbackIsClear(tank: VehicleState, spot: Vec2, world: TankWorld): boolean {
  if (circleTouchesWalls(spot, tank.radius, world.edges)) return false;
  return world.others.every(
    (other) =>
      other.id === tank.id ||
      other.vehicle !== 'tank' ||
      distance(spot, other.position) >=
        Math.min(tank.radius + other.radius, distance(tank.position, other.position)),
  );
}

/** Folds a point into the 64 × 40 sky. */
export function wrapSky(point: Vec2): Vec2 {
  return {
    x: ((point.x % ARENA_WIDTH) + ARENA_WIDTH) % ARENA_WIDTH,
    y: ((point.y % ARENA_HEIGHT) + ARENA_HEIGHT) % ARENA_HEIGHT,
  };
}

interface TurningResult {
  readonly heading: number;
  readonly turnTimer: number;
  readonly turnedEvents: readonly MatchEvent[];
}

/** Applies stick steering to a vehicle's heading and timing cadence. */
function updateTurning(
  vehicleId: number,
  currentHeading: number,
  currentTurnTimer: number,
  turnIntent: -1 | 0 | 1,
  dt: number,
): TurningResult {
  let heading = currentHeading;
  let turnTimer = currentTurnTimer;
  const turnedEvents: MatchEvent[] = [];

  if (turnIntent !== 0) {
    // Immediate response on initial turn, then fixed interval cadence
    if (turnTimer <= 0) {
      heading = wrapStep(heading + turnIntent);
      turnTimer = TURN_STEP_SECONDS;
      turnedEvents.push({ kind: 'turned', vehicle: vehicleId, heading });
    } else {
      turnTimer -= dt;
      while (turnTimer <= 0) {
        heading = wrapStep(heading + turnIntent);
        turnTimer += TURN_STEP_SECONDS;
        turnedEvents.push({ kind: 'turned', vehicle: vehicleId, heading });
      }
    }
  } else {
    turnTimer = 0;
  }

  return { heading, turnTimer, turnedEvents };
}

/** Every vehicle of a channel at its starting place: ids from 0, side 0's vehicles first. */
export function spawnVehicles(channel: ChannelRules, field: Arena | SkyDef): VehicleState[] {
  if (channel.field.kind === 'arena') {
    if (!('blocks' in field)) {
      throw new Error(`Channel ${channel.id} requires an arena, but received a sky`);
    }

    const arena = field;
    return [0, 1].map((sideIndex) => {
      const side = sideIndex as Side;
      const vehicle = channel.vehicles[side];
      const spawn = arena.spawns[side];
      return {
        id: side,
        side,
        vehicle,
        slot: 0,
        position: { x: spawn.position.x, y: spawn.position.y },
        heading: spawn.heading,
        turnTimer: 0,
        speed: 0,
        radius: VEHICLE_RADIUS[vehicle],
        wedged: 0,
        bumped: 0,
      };
    });
  }

  {
    if (!('clouds' in field)) {
      throw new Error(`Channel ${channel.id} requires a sky, but received an arena`);
    }

    const sky = field;
    const vehicles: VehicleState[] = [];
    let nextId = 0;

    for (const side of [0, 1] as const) {
      const count = channel.formation[side];
      const vehicle = channel.vehicles[side];
      if (vehicle === 'tank') {
        throw new Error('Aircraft sky channel cannot spawn tanks');
      }

      const spawn = sky.spawns[side];
      const cruiseSpeed = AIRCRAFT_SPEEDS[vehicle][1];

      for (let slot = 0; slot < count; slot++) {
        // Formation members line up side-by-side along y, centered on spawn
        const yOffset = (slot - (count - 1) / 2) * FORMATION_SPACING;
        vehicles.push({
          id: nextId++,
          side,
          vehicle,
          slot,
          position: { x: spawn.position.x, y: spawn.position.y + yOffset },
          heading: spawn.heading,
          turnTimer: 0,
          speed: cruiseSpeed,
          radius: VEHICLE_RADIUS[vehicle],
          wedged: 0,
          bumped: 0,
        });
      }
    }

    return vehicles;
  }
}

/** Steps a tank forward one tick: turns, drives forward, reacts to wall and tank bumps. */
export function stepTank(
  tank: VehicleState,
  intent: Intent,
  dt: number,
  world: TankWorld,
): VehicleStep {
  const {
    heading: steeredHeading,
    turnTimer,
    turnedEvents,
  } = updateTurning(tank.id, tank.heading, tank.turnTimer, intent.turn, dt);

  let heading = steeredHeading;
  let position = tank.position;
  let wedged = tank.wedged;
  let bumped: number;
  let speed = 0;
  const events: MatchEvent[] = [...turnedEvents];

  if (intent.throttle !== 0) {
    // Forward along the heading; backwards only with the Reverse gear setting, at a crawl.
    const backing = intent.throttle === -1;
    const travel = scale(headingVector(heading), backing ? -1 : 1);
    const travelSpeed = backing ? TANK_REVERSE_SPEED : TANK_SPEED;
    const candidatePosition = add(position, scale(travel, travelSpeed * dt));
    const touchesWall = circleTouchesWalls(candidatePosition, tank.radius, world.edges);
    const touchesOther = tankOverlapsOther(tank.id, candidatePosition, tank.radius, world.others);
    const blocked = touchesWall || touchesOther;

    if (blocked) {
      // Tank stops and is pushed back against its travel if that spot is clear
      const pushbackSpot = sub(tank.position, scale(travel, BUMP_PUSH));
      position = pushbackIsClear(tank, pushbackSpot, world) ? pushbackSpot : tank.position;

      // Reveal bump fires once per contact onset
      if (tank.bumped <= 0) {
        events.push({ kind: 'bumped', vehicle: tank.id, at: position });
      }
      bumped = BUMP_REVEAL_SECONDS;

      // Sliding free when pressing against an obstruction long enough
      wedged += dt;
      if (wedged >= WEDGED_SECONDS) {
        heading = wrapStep(heading + 1);
        events.push({ kind: 'turned', vehicle: tank.id, heading });
        wedged = 0;
      }
    } else {
      position = candidatePosition;
      speed = travelSpeed;
      wedged = 0;
      bumped = Math.max(0, tank.bumped - dt);
    }
  } else {
    position = tank.position;
    speed = 0;
    wedged = 0;
    bumped = Math.max(0, tank.bumped - dt);
  }

  const nextTank: VehicleState = {
    id: tank.id,
    side: tank.side,
    vehicle: tank.vehicle,
    slot: tank.slot,
    position,
    heading,
    turnTimer,
    speed,
    radius: tank.radius,
    wedged,
    bumped,
  };

  return {
    vehicle: nextTank,
    events,
  };
}

/** The speed an aircraft is heading for with this throttle (-1, 0, 1) and handicap. */
export function aircraftTargetSpeed(
  vehicle: VehicleState['vehicle'],
  throttle: -1 | 0 | 1,
  handicap: boolean,
): number {
  if (vehicle === 'tank') {
    throw new Error('Cannot compute aircraft speed for tanks');
  }

  const [slow, cruise, fast] = AIRCRAFT_SPEEDS[vehicle];
  const baseSpeed = throttle === 1 ? fast : throttle === -1 ? slow : cruise;
  return handicap ? baseSpeed - AIRCRAFT_HANDICAP[vehicle] : baseSpeed;
}

/**
 * Steps an aircraft forward one tick: turns, eases speed towards throttle target,
 * and wraps airspace.
 */
export function stepAircraft(
  craft: VehicleState,
  intent: Intent,
  dt: number,
  conditions: AircraftConditions,
): VehicleStep {
  const { heading, turnTimer, turnedEvents } = updateTurning(
    craft.id,
    craft.heading,
    craft.turnTimer,
    intent.turn,
    dt,
  );

  if (craft.vehicle === 'tank') {
    throw new Error('Aircraft steps cannot process tank vehicles');
  }

  const effectiveThrottle: -1 | 0 | 1 =
    intent.throttle === 1 && !conditions.fastAllowed ? 0 : intent.throttle;

  const targetSpeed = aircraftTargetSpeed(craft.vehicle, effectiveThrottle, conditions.handicap);
  const speeds = AIRCRAFT_SPEEDS[craft.vehicle];
  const slowSpeed = speeds[0];
  const fastSpeed = speeds[2];
  const maxSpeedDelta = ((fastSpeed - slowSpeed) / THROTTLE_SECONDS) * dt;

  let newSpeed = craft.speed;
  if (newSpeed < targetSpeed) {
    newSpeed = Math.min(targetSpeed, newSpeed + maxSpeedDelta);
  } else if (newSpeed > targetSpeed) {
    newSpeed = Math.max(targetSpeed, newSpeed - maxSpeedDelta);
  }

  const moveVector = scale(headingVector(heading), newSpeed * dt);
  const newPosition = wrapSky(add(craft.position, moveVector));

  const nextCraft: VehicleState = {
    id: craft.id,
    side: craft.side,
    vehicle: craft.vehicle,
    slot: craft.slot,
    position: newPosition,
    heading,
    turnTimer,
    speed: newSpeed,
    radius: craft.radius,
    wedged: 0,
    bumped: 0,
  };

  return {
    vehicle: nextCraft,
    events: turnedEvents,
  };
}

/**
 * Ace Duel: fuel after a step; burning while the throttle is 1 and fuel is left,
 * refilling otherwise.
 */
export function burnFuel(
  fuel: number,
  throttle: -1 | 0 | 1,
  dt: number,
  capacity: number,
  refillPerSecond: number,
): number {
  // Holding the afterburner never refills, even on an empty tank, or the jet would flicker
  // between burning and cruising on the dregs.
  if (throttle === 1) {
    return Math.max(0, fuel - dt);
  }
  return Math.min(capacity, fuel + refillPerSecond * dt);
}

/** Where a vehicle's shell appears: its muzzle, ahead of its centre along its heading. */
export function muzzlePoint(vehicle: VehicleState): Vec2 {
  const headingDirection = headingVector(vehicle.heading);

  if (vehicle.vehicle === 'tank') {
    return add(vehicle.position, scale(headingDirection, TANK_MUZZLE));
  }

  const reach = AIRCRAFT_MUZZLE[vehicle.vehicle];
  return wrapSky(add(vehicle.position, scale(headingDirection, reach)));
}

/** Turns a vehicle by whole heading steps (positive clockwise), wrapping into 0–15. */
export function turnBy(vehicle: VehicleState, steps: number): VehicleState {
  return {
    ...vehicle,
    heading: wrapStep(vehicle.heading + steps),
  };
}

/**
 * Moves a vehicle by `delta` (the knockback after a hit). Tanks stop short of walls: the move is cut
 * to the furthest point along `delta` that does not overlap a wall (search in 8 steps). Aircraft move
 * freely and wrap.
 */
export function shove(
  vehicle: VehicleState,
  delta: Vec2,
  edges: readonly WallEdge[],
): VehicleState {
  if (vehicle.vehicle !== 'tank') {
    return {
      ...vehicle,
      position: wrapSky(add(vehicle.position, delta)),
    };
  }

  // Tanks search backwards from full knockback to find the furthest free position
  for (let step = 8; step >= 1; step--) {
    const fraction = step / 8;
    const candidatePosition = add(vehicle.position, scale(delta, fraction));
    if (!circleTouchesWalls(candidatePosition, vehicle.radius, edges)) {
      return {
        ...vehicle,
        position: candidatePosition,
      };
    }
  }

  return {
    ...vehicle,
  };
}
