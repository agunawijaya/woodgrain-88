import { describe, expect, it } from 'vitest';
import { compileArena } from '../src/arenas/format.ts';
import { SANDBAG_LINE } from '../src/arenas/layouts.ts';
import { CLEAR_SKY } from '../src/arenas/skies.ts';
import { channelById } from '../src/engine/channels.ts';
import {
  AIRCRAFT_HANDICAP,
  AIRCRAFT_MUZZLE,
  AIRCRAFT_SPEEDS,
  BUMP_PUSH,
  BUMP_REVEAL_SECONDS,
  TANK_MUZZLE,
  TANK_RADIUS,
  TANK_REVERSE_SPEED,
  TANK_SPEED,
  TURN_STEP_SECONDS,
  VEHICLE_RADIUS,
} from '../src/engine/rules.ts';
import type { Intent, VehicleState } from '../src/engine/types.ts';
import { vec, type Vec2 } from '../src/engine/vec.ts';
import { buildWallEdges, type WallPolygon } from '../src/engine/walls.ts';
import {
  aircraftTargetSpeed,
  burnFuel,
  circleTouchesWalls,
  muzzlePoint,
  shove,
  spawnVehicles,
  stepAircraft,
  stepTank,
  turnBy,
  type TankWorld,
} from '../src/engine/vehicles.ts';

function createTank(overrides: Partial<VehicleState> = {}): VehicleState {
  return {
    id: 0,
    side: 0,
    vehicle: 'tank',
    slot: 0,
    position: vec(10, 20),
    heading: 0,
    turnTimer: 0,
    speed: 0,
    radius: TANK_RADIUS,
    wedged: 0,
    bumped: 0,
    ...overrides,
  };
}

function createCraft(overrides: Partial<VehicleState> = {}): VehicleState {
  const vehicle = overrides.vehicle ?? 'biplane';
  const speed = overrides.speed ?? (vehicle !== 'tank' ? AIRCRAFT_SPEEDS[vehicle][1] : 0);
  return {
    id: 0,
    side: 0,
    vehicle,
    slot: 0,
    position: vec(10, 20),
    heading: 0,
    turnTimer: 0,
    speed,
    radius: VEHICLE_RADIUS[vehicle],
    wedged: 0,
    bumped: 0,
    ...overrides,
  };
}

describe('vehicles', () => {
  describe('spawn', () => {
    it('spawns game-1 (tanks on Sandbag Line): two tanks at (8, 20) and (56, 20), headings 0 and 8', () => {
      const channel = channelById('game-1');
      const arena = compileArena(SANDBAG_LINE);
      const vehicles = spawnVehicles(channel, arena);

      expect(vehicles).toHaveLength(2);

      const tank0 = vehicles[0];
      const tank1 = vehicles[1];
      expect(tank0).toBeDefined();
      expect(tank1).toBeDefined();

      if (tank0 && tank1) {
        expect(tank0.id).toBe(0);
        expect(tank0.side).toBe(0);
        expect(tank0.vehicle).toBe('tank');
        expect(tank0.position).toEqual(vec(8, 20));
        expect(tank0.heading).toBe(0);
        expect(tank0.speed).toBe(0);

        expect(tank1.id).toBe(1);
        expect(tank1.side).toBe(1);
        expect(tank1.vehicle).toBe('tank');
        expect(tank1.position).toEqual(vec(56, 20));
        expect(tank1.heading).toBe(8);
        expect(tank1.speed).toBe(0);
      }
    });

    it('spawns game-19 (biplane pairs): four aircraft, ids 0–3, leaders at slot 0, spaced 4 apart on y', () => {
      const channel = channelById('game-19');
      const vehicles = spawnVehicles(channel, CLEAR_SKY);

      expect(vehicles).toHaveLength(4);
      expect(vehicles.map((v) => v.id)).toEqual([0, 1, 2, 3]);

      const leaderSide0 = vehicles[0];
      const wingmanSide0 = vehicles[1];
      const leaderSide1 = vehicles[2];
      const wingmanSide1 = vehicles[3];

      expect(leaderSide0).toBeDefined();
      expect(wingmanSide0).toBeDefined();
      expect(leaderSide1).toBeDefined();
      expect(wingmanSide1).toBeDefined();

      if (leaderSide0 && wingmanSide0 && leaderSide1 && wingmanSide1) {
        expect(leaderSide0.slot).toBe(0);
        expect(wingmanSide0.slot).toBe(1);
        expect(wingmanSide0.position.y - leaderSide0.position.y).toBeCloseTo(4);
        expect(leaderSide0.position.x).toBe(8);
        expect(wingmanSide0.position.x).toBe(8);

        expect(leaderSide1.slot).toBe(0);
        expect(wingmanSide1.slot).toBe(1);
        expect(wingmanSide1.position.y - leaderSide1.position.y).toBeCloseTo(4);
        expect(leaderSide1.position.x).toBe(56);
        expect(wingmanSide1.position.x).toBe(56);
      }
    });

    it('spawns game-20: one bomber against three biplanes', () => {
      const channel = channelById('game-20');
      const vehicles = spawnVehicles(channel, CLEAR_SKY);

      expect(vehicles).toHaveLength(4);

      const bomber = vehicles[0];
      expect(bomber).toBeDefined();
      if (bomber) {
        expect(bomber.side).toBe(0);
        expect(bomber.vehicle).toBe('bomber');
        expect(bomber.slot).toBe(0);
      }

      const side1Craft = vehicles.slice(1);
      expect(side1Craft).toHaveLength(3);
      for (const craft of side1Craft) {
        expect(craft.side).toBe(1);
        expect(craft.vehicle).toBe('biplane');
      }

      const v1 = side1Craft[0];
      const v2 = side1Craft[1];
      const v3 = side1Craft[2];
      expect(v1).toBeDefined();
      expect(v2).toBeDefined();
      expect(v3).toBeDefined();

      if (v1 && v2 && v3) {
        expect(v1.slot).toBe(0);
        expect(v2.slot).toBe(1);
        expect(v3.slot).toBe(2);
        expect(v2.position.y - v1.position.y).toBeCloseTo(4);
        expect(v3.position.y - v2.position.y).toBeCloseTo(4);
      }
    });

    it('throws when field kind does not match channel field kind', () => {
      const tankChannel = channelById('game-1');
      const skyChannel = channelById('game-19');
      const arena = compileArena(SANDBAG_LINE);

      expect(() => spawnVehicles(tankChannel, CLEAR_SKY)).toThrow();
      expect(() => spawnVehicles(skyChannel, arena)).toThrow();
    });
  });

  describe('reverse gear', () => {
    const emptyWorld: TankWorld = { edges: [], others: [] };

    it('backs a tank away along its heading at half speed', () => {
      const tank = createTank({ heading: 0, position: vec(20, 20) });
      const back: Intent = { turn: 0, throttle: -1, fire: false };

      const step = stepTank(tank, back, 0.1, emptyWorld);
      expect(TANK_REVERSE_SPEED).toBeCloseTo(TANK_SPEED / 2);
      expect(step.vehicle.position.x).toBeCloseTo(20 - TANK_REVERSE_SPEED * 0.1);
      expect(step.vehicle.position.y).toBeCloseTo(20);
    });

    it('is pushed forward off a wall it backs into', () => {
      const wall: WallPolygon = [vec(10, 10), vec(18, 10), vec(18, 30), vec(10, 30)];
      const world: TankWorld = { edges: buildWallEdges([wall]), others: [] };
      const tank = createTank({ heading: 0, position: vec(18 + TANK_RADIUS + 0.01, 20) });
      const back: Intent = { turn: 0, throttle: -1, fire: false };

      const step = stepTank(tank, back, 0.1, world);
      expect(step.vehicle.position.x).toBeGreaterThan(tank.position.x);
      expect(step.events.some((event) => event.kind === 'bumped')).toBe(true);
    });
  });

  describe('turning', () => {
    const emptyWorld: TankWorld = { edges: [], others: [] };

    it('steps heading at once upon press', () => {
      const tank = createTank({ heading: 0, turnTimer: 0 });
      const intent: Intent = { turn: 1, throttle: 0, fire: false };

      const step = stepTank(tank, intent, 0.05, emptyWorld);
      expect(step.vehicle.heading).toBe(1);
      expect(step.vehicle.turnTimer).toBeCloseTo(TURN_STEP_SECONDS);
      expect(step.events).toEqual([{ kind: 'turned', vehicle: tank.id, heading: 1 }]);
    });

    it('steps again after 0.3 s when held (not before)', () => {
      const tank = createTank({ heading: 0, turnTimer: 0 });
      const intent: Intent = { turn: 1, throttle: 0, fire: false };

      const step1 = stepTank(tank, intent, 0.05, emptyWorld);
      expect(step1.vehicle.heading).toBe(1);

      // 0.1 s later: timer down to ~0.2 s, no heading change
      const step2 = stepTank(step1.vehicle, intent, 0.1, emptyWorld);
      expect(step2.vehicle.heading).toBe(1);
      expect(step2.events).toHaveLength(0);

      // Another 0.1 s later: timer down to ~0.1 s, no heading change
      const step3 = stepTank(step2.vehicle, intent, 0.1, emptyWorld);
      expect(step3.vehicle.heading).toBe(1);
      expect(step3.events).toHaveLength(0);

      // Final 0.1 s (total 0.3 s after first step): steps again
      const step4 = stepTank(step3.vehicle, intent, 0.1, emptyWorld);
      expect(step4.vehicle.heading).toBe(2);
      expect(step4.events).toEqual([{ kind: 'turned', vehicle: tank.id, heading: 2 }]);
    });

    it('resets turn timer to 0 on release so next press steps at once', () => {
      const tank = createTank({ heading: 1, turnTimer: 0.25 });
      const releaseIntent: Intent = { turn: 0, throttle: 0, fire: false };

      const released = stepTank(tank, releaseIntent, 0.05, emptyWorld);
      expect(released.vehicle.turnTimer).toBe(0);

      const nextPressIntent: Intent = { turn: -1, throttle: 0, fire: false };
      const pressedAgain = stepTank(released.vehicle, nextPressIntent, 0.05, emptyWorld);
      expect(pressedAgain.vehicle.heading).toBe(0);
      expect(pressedAgain.events).toEqual([{ kind: 'turned', vehicle: tank.id, heading: 0 }]);
    });

    it('emits turned event on every step of heading change', () => {
      const craft = createCraft({ heading: 15, turnTimer: 0 });
      const intent: Intent = { turn: 1, throttle: 0, fire: false };
      const conditions = { handicap: false, fastAllowed: true };

      const step = stepAircraft(craft, intent, 0.05, conditions);
      expect(step.vehicle.heading).toBe(0);
      expect(step.events).toEqual([{ kind: 'turned', vehicle: craft.id, heading: 0 }]);
    });
  });

  describe('driving', () => {
    const emptyWorld: TankWorld = { edges: [], others: [] };

    it('moves a tank on an open field by TANK_SPEED * dt per step', () => {
      const tank = createTank({ position: vec(10, 20), heading: 0 });
      const driveIntent: Intent = { turn: 0, throttle: 1, fire: false };
      const dt = 0.1;

      const step = stepTank(tank, driveIntent, dt, emptyWorld);
      expect(step.vehicle.position.x).toBeCloseTo(10 + TANK_SPEED * dt);
      expect(step.vehicle.position.y).toBeCloseTo(20);
      expect(step.vehicle.speed).toBe(TANK_SPEED);
    });

    it('stays still when stick is down (throttle 0)', () => {
      const tank = createTank({ position: vec(10, 20), heading: 0 });
      const downIntent: Intent = { turn: 0, throttle: 0, fire: false };

      const step = stepTank(tank, downIntent, 0.1, emptyWorld);
      expect(step.vehicle.position).toEqual(vec(10, 20));
      expect(step.vehicle.speed).toBe(0);
    });
  });

  describe('walls', () => {
    it('stops and pushes tank back when driving into a wall', () => {
      // Wall polygon at x in [12, 14], y in [0, 40]
      const wallPoly: WallPolygon = [vec(12, 0), vec(14, 0), vec(14, 40), vec(12, 40)];
      const edges = buildWallEdges([wallPoly]);
      const world: TankWorld = { edges, others: [] };

      // Tank placed at x=10.5, radius=1.4. Distance to wall face at x=12 is 1.5.
      // Moving forward along heading 0 (+x) by 3 * 0.1 = 0.3 reaches x=10.8
      // (distance 1.2 < 1.4: overlaps wall).
      const tank = createTank({ position: vec(10.5, 20), heading: 0 });
      const intent: Intent = { turn: 0, throttle: 1, fire: false };

      const step = stepTank(tank, intent, 0.1, world);
      // Stays and is pushed back BUMP_PUSH (0.18) opposite heading
      expect(step.vehicle.position.x).toBeCloseTo(10.5 - BUMP_PUSH);
      expect(step.vehicle.position.y).toBeCloseTo(20);
    });

    it('sets bumped with a single bumped event over several steps while wedged', () => {
      // Walls just ahead and just behind: the tank touches the front one and cannot be pushed back.
      const frontWall: WallPolygon = [vec(12, 0), vec(14, 0), vec(14, 40), vec(12, 40)];
      const tightBackWall: WallPolygon = [vec(7, 0), vec(9.1, 0), vec(9.1, 40), vec(7, 40)];
      const tightEdges = buildWallEdges([frontWall, tightBackWall]);
      const tightWorld: TankWorld = { edges: tightEdges, others: [] };

      const tank = createTank({ position: vec(10.59, 20), heading: 0, bumped: 0 });
      const intent: Intent = { turn: 0, throttle: 1, fire: false };
      const dt = 0.02;

      // Step 1: bumped was 0, emits bumped event
      const step1 = stepTank(tank, intent, dt, tightWorld);
      expect(step1.vehicle.bumped).toBe(BUMP_REVEAL_SECONDS);
      expect(step1.events).toContainEqual({
        kind: 'bumped',
        vehicle: tank.id,
        at: step1.vehicle.position,
      });

      // Step 2: bumped was BUMP_REVEAL_SECONDS > 0, does NOT emit bumped event
      const step2 = stepTank(step1.vehicle, intent, dt, tightWorld);
      expect(step2.vehicle.bumped).toBe(BUMP_REVEAL_SECONDS);
      const bumpedEventsStep2 = step2.events.filter((e) => e.kind === 'bumped');
      expect(bumpedEventsStep2).toHaveLength(0);

      // Step 3: still no new bumped event
      const step3 = stepTank(step2.vehicle, intent, dt, tightWorld);
      expect(step3.vehicle.bumped).toBe(BUMP_REVEAL_SECONDS);
      const bumpedEventsStep3 = step3.events.filter((e) => e.kind === 'bumped');
      expect(bumpedEventsStep3).toHaveLength(0);
    });

    it('turns one step clockwise after WEDGED_SECONDS of pushing against a wall', () => {
      const frontWall: WallPolygon = [vec(12, 0), vec(14, 0), vec(14, 40), vec(12, 40)];
      const backWall: WallPolygon = [vec(7, 0), vec(9.1, 0), vec(9.1, 40), vec(7, 40)];
      const edges = buildWallEdges([frontWall, backWall]);
      const world: TankWorld = { edges, others: [] };

      // WEDGED_SECONDS is 0.08 s (4 frames of 0.02 s)
      let tank = createTank({ position: vec(10.59, 20), heading: 0 });
      const intent: Intent = { turn: 0, throttle: 1, fire: false };
      const dt = 0.02;

      // Step 1: wedged = 0.02
      tank = stepTank(tank, intent, dt, world).vehicle;
      expect(tank.heading).toBe(0);
      expect(tank.wedged).toBeCloseTo(0.02);

      // Step 2: wedged = 0.04
      tank = stepTank(tank, intent, dt, world).vehicle;
      expect(tank.heading).toBe(0);
      expect(tank.wedged).toBeCloseTo(0.04);

      // Step 3: wedged = 0.06
      tank = stepTank(tank, intent, dt, world).vehicle;
      expect(tank.heading).toBe(0);
      expect(tank.wedged).toBeCloseTo(0.06);

      // Step 4: wedged reaches 0.08 (WEDGED_SECONDS) -> turns 1 step clockwise (heading 1) and resets wedged
      const step4 = stepTank(tank, intent, dt, world);
      expect(step4.vehicle.heading).toBe(1);
      expect(step4.vehicle.wedged).toBe(0);
      expect(step4.events).toContainEqual({ kind: 'turned', vehicle: tank.id, heading: 1 });
    });
  });

  describe('tank on tank collision', () => {
    it('blocks driving when candidate position overlaps another tank', () => {
      // Tank 1 at (10, 20) facing right; Tank 2 at (12.5, 20).
      // Radii are 1.4 each, so sum of radii is 2.8. Current distance is 2.5 < 2.8 (already in contact).
      const tank1 = createTank({ id: 0, position: vec(10, 20), heading: 0 });
      const tank2 = createTank({ id: 1, position: vec(12.5, 20), heading: 8 });
      const world: TankWorld = { edges: [], others: [tank2] };

      const driveIntent: Intent = { turn: 0, throttle: 1, fire: false };
      const step = stepTank(tank1, driveIntent, 0.1, world);

      // Tank 1 is blocked by Tank 2 and pushed back opposite its heading
      expect(step.vehicle.position.x).toBeCloseTo(10 - BUMP_PUSH);
      expect(step.vehicle.speed).toBe(0);
    });
  });

  describe('aircraft', () => {
    it('maintains constant flight along heading', () => {
      const craft = createCraft({
        vehicle: 'biplane',
        position: vec(10, 20),
        heading: 0,
        speed: 7.5,
      });
      const intent: Intent = { turn: 0, throttle: 0, fire: false };
      const conditions = { handicap: false, fastAllowed: true };

      const step = stepAircraft(craft, intent, 0.1, conditions);
      expect(step.vehicle.position.x).toBeCloseTo(10 + 7.5 * 0.1);
      expect(step.vehicle.position.y).toBeCloseTo(20);
      expect(step.vehicle.speed).toBeCloseTo(7.5);
    });

    it('eases speed towards fast and slow targets and never overshoots', () => {
      // Biplane B speeds: slow 5, cruise 7.5, fast 10.
      const craft = createCraft({
        vehicle: 'biplane',
        speed: 7.5,
      });
      const conditions = { handicap: false, fastAllowed: true };

      // Throttle fast (+1)
      const fastIntent: Intent = { turn: 0, throttle: 1, fire: false };
      const step1 = stepAircraft(craft, fastIntent, 0.1, conditions);
      expect(step1.vehicle.speed).toBeGreaterThan(7.5);
      expect(step1.vehicle.speed).toBeLessThan(10);

      // Step with large dt to verify capping at target
      const step2 = stepAircraft(step1.vehicle, fastIntent, 1.0, conditions);
      expect(step2.vehicle.speed).toBe(10);

      // Now throttle slow (-1)
      const slowIntent: Intent = { turn: 0, throttle: -1, fire: false };
      const step3 = stepAircraft(step2.vehicle, slowIntent, 0.1, conditions);
      expect(step3.vehicle.speed).toBeLessThan(10);
      expect(step3.vehicle.speed).toBeGreaterThan(5);

      const step4 = stepAircraft(step3.vehicle, slowIntent, 1.0, conditions);
      expect(step4.vehicle.speed).toBe(5);
    });

    it('lowers every speed tier with handicap (biplane by 1.25, jet by 2.5)', () => {
      expect(AIRCRAFT_HANDICAP.biplane).toBe(1.25);
      expect(AIRCRAFT_HANDICAP.jet).toBe(2.5);

      // Biplane tiers without handicap: [5, 7.5, 10]
      expect(aircraftTargetSpeed('biplane', -1, false)).toBe(5);
      expect(aircraftTargetSpeed('biplane', 0, false)).toBe(7.5);
      expect(aircraftTargetSpeed('biplane', 1, false)).toBe(10);

      // Biplane tiers with handicap: [3.75, 6.25, 8.75]
      expect(aircraftTargetSpeed('biplane', -1, true)).toBe(3.75);
      expect(aircraftTargetSpeed('biplane', 0, true)).toBe(6.25);
      expect(aircraftTargetSpeed('biplane', 1, true)).toBe(8.75);

      // Jet tiers without handicap: [10, 12.5, 15]
      expect(aircraftTargetSpeed('jet', -1, false)).toBe(10);
      expect(aircraftTargetSpeed('jet', 0, false)).toBe(12.5);
      expect(aircraftTargetSpeed('jet', 1, false)).toBe(15);

      // Jet tiers with handicap: [7.5, 10, 12.5]
      expect(aircraftTargetSpeed('jet', -1, true)).toBe(7.5);
      expect(aircraftTargetSpeed('jet', 0, true)).toBe(10);
      expect(aircraftTargetSpeed('jet', 1, true)).toBe(12.5);
    });

    it('caps target speed at cruise when fastAllowed is false', () => {
      const craft = createCraft({ vehicle: 'jet', speed: 12.5 });
      const intent: Intent = { turn: 0, throttle: 1, fire: false };
      const conditions = { handicap: false, fastAllowed: false };

      const step = stepAircraft(craft, intent, 0.5, conditions);
      expect(step.vehicle.speed).toBe(12.5);
    });

    it('wraps off every edge of the 64 × 40 sky', () => {
      const conditions = { handicap: false, fastAllowed: true };
      const intent: Intent = { turn: 0, throttle: 0, fire: false };
      // At cruise the speed holds, so a 0.1 s step moves exactly cruise * 0.1.
      const cruise = AIRCRAFT_SPEEDS.biplane[1];
      const reach = cruise * 0.1;
      const flyFrom = (position: Vec2, heading: number) =>
        stepAircraft(createCraft({ position, heading, speed: cruise }), intent, 0.1, conditions)
          .vehicle.position;

      expect(flyFrom(vec(63.8, 20), 0).x).toBeCloseTo(63.8 + reach - 64);
      expect(flyFrom(vec(0.2, 20), 8).x).toBeCloseTo(0.2 - reach + 64);
      expect(flyFrom(vec(20, 39.5), 4).y).toBeCloseTo(39.5 + reach - 40);
      expect(flyFrom(vec(20, 0.5), 12).y).toBeCloseTo(0.5 - reach + 40);
    });
  });

  describe('burnFuel', () => {
    it('burns while throttle is 1 and fuel is left, refills otherwise, respecting caps', () => {
      const capacity = 3.0;
      const refillRate = 0.6;

      // Burns fuel down
      expect(burnFuel(3.0, 1, 0.5, capacity, refillRate)).toBeCloseTo(2.5);

      // Caps at 0 when burned empty
      expect(burnFuel(0.2, 1, 0.5, capacity, refillRate)).toBe(0);

      // Refills while cruising (throttle 0)
      expect(burnFuel(1.0, 0, 1.0, capacity, refillRate)).toBeCloseTo(1.6);

      // Refills while slow (throttle -1)
      expect(burnFuel(1.0, -1, 1.0, capacity, refillRate)).toBeCloseTo(1.6);

      // Refills cap at capacity
      expect(burnFuel(2.8, 0, 1.0, capacity, refillRate)).toBe(capacity);
    });
  });

  describe('muzzlePoint', () => {
    it('calculates muzzle position for a tank and a biplane', () => {
      const tank = createTank({ position: vec(10, 20), heading: 0 });
      const tankMuzzle = muzzlePoint(tank);
      expect(tankMuzzle.x).toBeCloseTo(10 + TANK_MUZZLE);
      expect(tankMuzzle.y).toBeCloseTo(20);

      const biplane = createCraft({
        vehicle: 'biplane',
        position: vec(10, 20),
        heading: 4,
      });
      const planeMuzzle = muzzlePoint(biplane);
      expect(planeMuzzle.x).toBeCloseTo(10);
      expect(planeMuzzle.y).toBeCloseTo(20 + AIRCRAFT_MUZZLE.biplane);

      // Aircraft muzzle wrapping
      const planeAtEdge = createCraft({
        vehicle: 'biplane',
        position: vec(63.5, 20),
        heading: 0,
      });
      const wrappedMuzzle = muzzlePoint(planeAtEdge);
      expect(wrappedMuzzle.x).toBeCloseTo(63.5 + AIRCRAFT_MUZZLE.biplane - 64);
    });
  });

  describe('turnBy', () => {
    it('wraps heading within 0–15 for positive and negative steps', () => {
      const tank = createTank({ heading: 0 });
      expect(turnBy(tank, 1).heading).toBe(1);
      expect(turnBy(tank, 16).heading).toBe(0);
      expect(turnBy(tank, -1).heading).toBe(15);
      expect(turnBy(tank, -4).heading).toBe(12);

      const tankAt15 = createTank({ heading: 15 });
      expect(turnBy(tankAt15, 2).heading).toBe(1);
    });
  });

  describe('shove', () => {
    it('stops a tank short of walls in 8 steps', () => {
      // Wall polygon from x=10 to x=12, y in [0, 40]
      const wallPoly: WallPolygon = [vec(10, 0), vec(12, 0), vec(12, 40), vec(10, 40)];
      const edges = buildWallEdges([wallPoly]);

      // Tank at (8, 20), radius 1.4. Wall face is at x=10.
      // Shove delta = (4, 0).
      // Testing fractions 8/8 down to 1/8:
      // x + fraction * 4:
      // 8/8: x=12 (inside wall)
      // 7/8: x=11.5
      // ...
      // 1/8: x=8.5 (distance to wall face at x=10 is 1.5 > 1.4 -> free!)
      const tank = createTank({ position: vec(8, 20) });
      const shoved = shove(tank, vec(4, 0), edges);

      expect(shoved.position.x).toBeCloseTo(8.5);
      expect(shoved.position.y).toBe(20);
      expect(circleTouchesWalls(shoved.position, shoved.radius, edges)).toBe(false);
    });

    it('wraps an aircraft when shoved', () => {
      const craft = createCraft({ position: vec(62, 20) });
      const shoved = shove(craft, vec(5, 0), []);
      expect(shoved.position.x).toBeCloseTo(3);
      expect(shoved.position.y).toBe(20);
    });
  });

  describe('circleTouchesWalls', () => {
    it('detects touching, clear, and a corner', () => {
      // Single square block [10, 20] x [10, 20]
      const block: WallPolygon = [vec(10, 10), vec(20, 10), vec(20, 20), vec(10, 20)];
      const edges = buildWallEdges([block]);
      const radius = 1.5;

      // Touching a face: center (8.8, 15) has distance 1.2 to left face (x=10) < 1.5
      expect(circleTouchesWalls(vec(8.8, 15), radius, edges)).toBe(true);

      // Clear from face: center (8.0, 15) has distance 2.0 to left face > 1.5
      expect(circleTouchesWalls(vec(8.0, 15), radius, edges)).toBe(false);

      // Near corner (10, 10):
      // Center (9.1, 9.1) distance to corner is hypot(0.9, 0.9) = ~1.27 < 1.5
      expect(circleTouchesWalls(vec(9.1, 9.1), radius, edges)).toBe(true);

      // Clear from corner: center (8.5, 8.5) distance to corner is hypot(1.5, 1.5) = ~2.12 > 1.5
      expect(circleTouchesWalls(vec(8.5, 8.5), radius, edges)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('does not mutate input objects', () => {
      const tank = Object.freeze(createTank({ position: Object.freeze(vec(10, 20)) }));
      const intent = Object.freeze({ turn: 1 as const, throttle: 1 as const, fire: false });
      const world = Object.freeze({ edges: Object.freeze([]), others: Object.freeze([]) });

      expect(() => stepTank(tank, intent, 0.1, world)).not.toThrow();
      expect(() => turnBy(tank, 2)).not.toThrow();
      expect(() => shove(tank, vec(1, 1), [])).not.toThrow();
      expect(() => muzzlePoint(tank)).not.toThrow();

      const craft = Object.freeze(createCraft({ position: Object.freeze(vec(10, 20)) }));
      const conditions = Object.freeze({ handicap: false, fastAllowed: true });
      expect(() => stepAircraft(craft, intent, 0.1, conditions)).not.toThrow();
    });
  });
});
