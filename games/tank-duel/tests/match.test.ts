/**
 * Tests for the duel match engine: stepping matches, driving, firing,
 * shell trajectories, wall bounces, scoring hits, spin freeze, match timing,
 * and Remix rules (Ricochet Royale, Blackout, Ace Duel, Last Tank).
 */
import { describe, expect, it } from 'vitest';
import { channelById } from '../src/engine/channels.ts';
import {
  createMatch,
  createWorld,
  shellRulesFor,
  stepMatch,
  type MatchWorld,
} from '../src/engine/match.ts';
import {
  BOUNCING_LIFE_FACTOR,
  BILLIARD_LIFE_FACTOR,
  FIRST_TO,
  HANDICAP_SHELL_LIFE,
  KNOCKBACK_DISTANCE,
  MACHINE_GUN_INTERVAL,
  MACHINE_GUN_LIFE,
  MACHINE_GUN_SPEED,
  ROUND_SECONDS,
  SHELL_LIFE,
  SHELL_SPEED,
  SPIN_SECONDS,
  SPIN_STEPS_PER_SECOND,
  WARNING_SECONDS,
} from '../src/engine/rules.ts';
import type {
  MatchEvent,
  MatchOptions,
  MatchState,
  MatchStep,
  StickInput,
  VehicleState,
} from '../src/engine/types.ts';
import { NO_INPUT } from '../src/engine/types.ts';
import { vec } from '../src/engine/vec.ts';

const DEFAULT_OPTIONS: MatchOptions = {
  scoring: 'timed',
  handicap: [false, false],
  wiring: false,
};

function requireVehicle(vehicles: readonly VehicleState[], index: number): VehicleState {
  const v = vehicles[index];
  if (!v) {
    throw new Error(`Expected vehicle at index ${index}`);
  }
  return v;
}

function isHit(e: MatchEvent): e is Extract<MatchEvent, { kind: 'hit' }> {
  return e.kind === 'hit';
}

function run(
  initialState: MatchState,
  inputs: readonly [StickInput, StickInput],
  durationSeconds: number,
  world: MatchWorld,
  stepDt = 1 / 60,
): { state: MatchState; events: MatchEvent[] } {
  let state = initialState;
  const allEvents: MatchEvent[] = [];
  const steps = Math.round(durationSeconds / stepDt);

  for (let i = 0; i < steps; i++) {
    const step = stepMatch(state, inputs, stepDt, world);
    state = step.state;
    allEvents.push(...step.events);
  }

  return { state, events: allEvents };
}

function runUntil(
  initialState: MatchState,
  done: (step: MatchStep) => boolean,
  limitSeconds: number,
  world: MatchWorld,
): { state: MatchState; events: MatchEvent[] } {
  let state = initialState;
  const allEvents: MatchEvent[] = [];
  for (let elapsed = 0; elapsed < limitSeconds; elapsed += 1 / 60) {
    const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
    state = step.state;
    allEvents.push(...step.events);
    if (done(step)) break;
  }
  return { state, events: allEvents };
}

describe('match', () => {
  describe('setup', () => {
    it('sets up game-1 with 2 tanks, and clock matching timed or first-to-10 scoring', () => {
      const channel = channelById('game-1');
      const world = createWorld(channel);

      const timedMatch = createMatch(channel, DEFAULT_OPTIONS, world);
      expect(timedMatch.vehicles).toHaveLength(2);
      expect(timedMatch.vehicles[0]?.vehicle).toBe('tank');
      expect(timedMatch.vehicles[1]?.vehicle).toBe('tank');
      expect(timedMatch.clock).toBeCloseTo(ROUND_SECONDS);
      expect(timedMatch.time).toBe(0);
      expect(timedMatch.scores).toEqual([0, 0]);
      expect(timedMatch.over).toBe(false);
      expect(timedMatch.winner).toBeNull();

      const raceMatch = createMatch(channel, { ...DEFAULT_OPTIONS, scoring: 'first-to-10' }, world);
      expect(raceMatch.clock).toBe(Infinity);
      expect(raceMatch.vehicles).toHaveLength(2);
    });

    it('sets up game-19 with 4 biplanes', () => {
      const channel = channelById('game-19');
      const world = createWorld(channel);
      const match = createMatch(channel, DEFAULT_OPTIONS, world);

      expect(match.vehicles).toHaveLength(4);
      for (const craft of match.vehicles) {
        expect(craft.vehicle).toBe('biplane');
      }
    });

    it('sets up game-20 with 1 bomber and 3 biplanes', () => {
      const channel = channelById('game-20');
      const world = createWorld(channel);
      const match = createMatch(channel, DEFAULT_OPTIONS, world);

      expect(match.vehicles).toHaveLength(4);
      expect(match.vehicles[0]?.vehicle).toBe('bomber');
      expect(match.vehicles[0]?.side).toBe(0);

      const side1Planes = match.vehicles.slice(1);
      expect(side1Planes).toHaveLength(3);
      for (const craft of side1Planes) {
        expect(craft.vehicle).toBe('biplane');
        expect(craft.side).toBe(1);
      }
    });
  });

  describe('shell rules', () => {
    it('creates normal, handicap, bouncing and billiard shell rules accurately', () => {
      const game1 = channelById('game-1');
      const normalRules = shellRulesFor(game1, false);
      expect(normalRules.speed).toBe(SHELL_SPEED);
      expect(normalRules.lifetime).toBeCloseTo(SHELL_LIFE);
      expect(normalRules.walls).toBe('stop');
      expect(normalRules.billiard).toBe(false);
      expect(normalRules.wrap).toBeUndefined();

      const handicapRules = shellRulesFor(game1, true);
      expect(handicapRules.lifetime).toBeCloseTo(HANDICAP_SHELL_LIFE);

      const game6 = channelById('game-6');
      const bounceRules = shellRulesFor(game6, false);
      expect(bounceRules.walls).toBe('bounce');
      expect(bounceRules.lifetime).toBeCloseTo(SHELL_LIFE * BOUNCING_LIFE_FACTOR);

      const bounceHandicapRules = shellRulesFor(game6, true);
      expect(bounceHandicapRules.lifetime).toBeCloseTo(HANDICAP_SHELL_LIFE * BOUNCING_LIFE_FACTOR);

      const game8 = channelById('game-8');
      const billiardRules = shellRulesFor(game8, false);
      expect(billiardRules.billiard).toBe(true);
      expect(billiardRules.walls).toBe('bounce');
      expect(billiardRules.lifetime).toBeCloseTo(SHELL_LIFE * BILLIARD_LIFE_FACTOR);
    });

    it('machine gun ignores handicap and sky channels wrap', () => {
      const game17 = channelById('game-17');
      const mgNormal = shellRulesFor(game17, false);
      const mgHandicap = shellRulesFor(game17, true);

      expect(mgNormal.speed).toBe(MACHINE_GUN_SPEED);
      expect(mgNormal.lifetime).toBeCloseTo(MACHINE_GUN_LIFE);
      expect(mgHandicap.lifetime).toBeCloseTo(MACHINE_GUN_LIFE);
      expect(mgNormal.wrap).toEqual({ width: 64, height: 40 });
    });
  });

  describe('one shell at a time', () => {
    it('ignores subsequent fire presses while a shell is in flight, then allows refiring after expiry', () => {
      const channel = channelById('game-5');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      // Place tank 0 at (6, 20) heading 0, Tank 1 at (58, 6) heading 8 (out of the way)
      const tank0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(6, 20),
        heading: 0,
      };
      const tank1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(58, 6),
        heading: 8,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      // Press fire on side 0
      const firePress: StickInput = { x: 0, y: 0, fire: true };
      const step1 = stepMatch(state, [firePress, NO_INPUT], 1 / 60, world);
      state = step1.state;
      expect(state.shells[0]).not.toBeNull();
      expect(step1.events.some((e) => e.kind === 'fired')).toBe(true);

      // Release button
      state = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world).state;
      expect(state.shells[0]).not.toBeNull();

      // Press fire again while the first shell is still in the air: no new fired event
      const step3 = stepMatch(state, [firePress, NO_INPUT], 1 / 60, world);
      state = step3.state;
      const firedEvents = step3.events.filter((e) => e.kind === 'fired');
      expect(firedEvents).toHaveLength(0);

      // Advance 1.25 s until the shell expires in open floor
      const runResult = run(state, [NO_INPUT, NO_INPUT], 1.25, world);
      state = runResult.state;
      expect(state.shells[0]).toBeNull();
      expect(runResult.events.some((e) => e.kind === 'shell-gone' && e.reason === 'expired')).toBe(
        true,
      );

      // Now a new press successfully fires
      const stepNew = stepMatch(state, [firePress, NO_INPUT], 1 / 60, world);
      expect(stepNew.state.shells[0]).not.toBeNull();
      expect(stepNew.events.some((e) => e.kind === 'fired')).toBe(true);
    });
  });

  describe('fire is a press', () => {
    it('holding fire fires only once for normal shells', () => {
      const channel = channelById('game-5');
      const world = createWorld(channel);
      const state = createMatch(channel, DEFAULT_OPTIONS, world);

      const holdFire: StickInput = { x: 0, y: 0, fire: true };
      const result = run(state, [holdFire, NO_INPUT], 0.2, world);

      const firedEvents = result.events.filter((e) => e.kind === 'fired');
      expect(firedEvents).toHaveLength(1);
    });

    it('holding fire repeats machine gun every MACHINE_GUN_INTERVAL seconds', () => {
      const channel = channelById('game-17');
      const world = createWorld(channel);
      const state = createMatch(channel, DEFAULT_OPTIONS, world);

      expect(MACHINE_GUN_INTERVAL).toBeCloseTo(0.18);

      const holdFire: StickInput = { x: 0, y: 0, fire: true };
      // 0.6 seconds allows multiple bursts
      const result = run(state, [holdFire, NO_INPUT], 0.6, world);

      const firedCount = result.events.filter((e) => e.kind === 'fired').length;
      expect(firedCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('guided', () => {
    it('bends shell direction when shooter turns on guided channels, but straight shells keep their line', () => {
      const guidedChannel = channelById('game-1');
      const guidedWorld = createWorld(guidedChannel);
      let guidedState = createMatch(guidedChannel, DEFAULT_OPTIONS, guidedWorld);

      // Fire straight (+x, heading 0)
      guidedState = stepMatch(
        guidedState,
        [{ x: 0, y: 0, fire: true }, NO_INPUT],
        1 / 60,
        guidedWorld,
      ).state;

      // Turn clockwise (stick x = 1)
      guidedState = stepMatch(
        guidedState,
        [{ x: 1, y: 0, fire: false }, NO_INPUT],
        1 / 60,
        guidedWorld,
      ).state;

      const guidedShell = guidedState.shells[0];
      expect(guidedShell).not.toBeNull();
      if (guidedShell) {
        expect(guidedShell.direction.y).toBeGreaterThan(0);
      }

      // Straight channel
      const straightChannel = channelById('game-3');
      const straightWorld = createWorld(straightChannel);
      let straightState = createMatch(straightChannel, DEFAULT_OPTIONS, straightWorld);

      straightState = stepMatch(
        straightState,
        [{ x: 0, y: 0, fire: true }, NO_INPUT],
        1 / 60,
        straightWorld,
      ).state;

      straightState = stepMatch(
        straightState,
        [{ x: 1, y: 0, fire: false }, NO_INPUT],
        1 / 60,
        straightWorld,
      ).state;

      const straightShell = straightState.shells[0];
      expect(straightShell).not.toBeNull();
      if (straightShell) {
        expect(straightShell.direction.y).toBeCloseTo(0);
        expect(straightShell.direction.x).toBeCloseTo(1);
      }
    });
  });

  describe('scoring hit', () => {
    it('scores a point, clears shells, recoils shooter by -1, and freezes for SPIN_SECONDS with knockback', () => {
      const channel = channelById('game-5');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      // Place two tanks facing each other in open floor:
      // Tank 0 at (20, 20) heading 0, Tank 1 at (44, 20) heading 8
      const tank0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(20, 20),
        heading: 0,
      };
      const tank1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(44, 20),
        heading: 8,
      };
      state = {
        ...state,
        vehicles: [tank0, tank1],
      };

      // Also give side 1 a live shell in the air to verify it gets cleared with reason 'cleared'
      state = {
        ...state,
        shells: [
          null,
          {
            owner: 1,
            position: vec(30, 8),
            direction: vec(1, 0),
            life: 1.0,
            age: 0,
            bounces: 0,
            path: [vec(30, 8)],
          },
        ],
      };

      // Step 1: Tank 0 fires
      const fireStep = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world);
      state = fireStep.state;

      // Step until the hit (about 0.51 s: 20.45 units from the muzzle to tank 1's edge), and no
      // further, so the knockback that follows can be measured from its start.
      const hitResult = runUntil(state, (step) => step.events.some(isHit), 1, world);
      state = hitResult.state;

      // Check hit results
      expect(state.scores).toEqual([1, 0]);
      expect(state.shells).toEqual([null, null]);

      const hitEvent = hitResult.events.find(isHit);
      expect(hitEvent).toBeDefined();
      if (hitEvent) {
        expect(hitEvent.shooter).toBe(0);
        expect(hitEvent.victim).toBe(1);
        expect(hitEvent.points).toBe(1);
        expect(hitEvent.path.length).toBeGreaterThanOrEqual(2);
      }

      // Tank 1's shell was cleared
      expect(hitResult.events.some((e) => e.kind === 'shell-gone' && e.reason === 'cleared')).toBe(
        true,
      );

      // Shooter recoiled by -1 heading step: heading 0 turned by -1 is 15
      const currentTank0 = state.vehicles.find((v) => v.id === 0);
      expect(currentTank0?.heading).toBe(15);
      expect(
        hitResult.events.some((e) => e.kind === 'turned' && e.vehicle === 0 && e.heading === 15),
      ).toBe(true);

      // Freeze is active
      expect(state.freeze).not.toBeNull();
      expect(state.freeze?.victim).toBe(1);
      expect(state.freeze?.seconds).toBeLessThanOrEqual(SPIN_SECONDS);
      expect(SPIN_STEPS_PER_SECOND).toBe(50);

      // During the knockback phase (first 0.08 s):
      const freezeStartPos1 = state.vehicles.find((v) => v.id === 1)?.position.x ?? 44;
      const knockbackRun = run(state, [NO_INPUT, NO_INPUT], 0.08, world);
      state = knockbackRun.state;
      const afterKnockbackTank1 = state.vehicles.find((v) => v.id === 1);
      expect(afterKnockbackTank1?.position.x).toBeGreaterThan(freezeStartPos1);
      expect(afterKnockbackTank1?.position.x).toBeCloseTo(freezeStartPos1 + KNOCKBACK_DISTANCE, 1);

      // Run another 0.2 s: knockback has finished, position does NOT change further
      const posAfterKnockback = afterKnockbackTank1?.position.x ?? 0;
      const postKnockbackRun = run(state, [NO_INPUT, NO_INPUT], 0.2, world);
      state = postKnockbackRun.state;
      const laterTank1 = state.vehicles.find((v) => v.id === 1);
      expect(laterTank1?.position.x).toBeCloseTo(posAfterKnockback);

      // Running until the remainder of freeze finishes: spin-over emitted
      const remainingFreezeTime = state.freeze?.seconds ?? 0;
      const finishFreezeRun = run(state, [NO_INPUT, NO_INPUT], remainingFreezeTime + 0.1, world);
      state = finishFreezeRun.state;

      expect(state.freeze).toBeNull();
      expect(finishFreezeRun.events.some((e) => e.kind === 'spin-over' && e.victim === 1)).toBe(
        true,
      );
    });
  });

  describe('no friendly fire', () => {
    it('does not hit the shooter when a bouncing shell reflects through its own tank', () => {
      const channel = channelById('game-6');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      // Tank 0 at (5, 20) facing left (heading 8). Left wall at x in [0, 2].
      // Muzzle is at (5 - 2.15, 20) = (2.85, 20), clear of wall.
      const tank0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(5, 20),
        heading: 8,
      };
      // Put tank 1 far away
      const tank1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(50, 20),
        heading: 8,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      // Fire into the wall
      const fireStep = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world);
      state = fireStep.state;

      // Advance through the bounce and passing back through tank 0
      const runResult = run(state, [NO_INPUT, NO_INPUT], 0.25, world);
      state = runResult.state;

      // Verified bounce happened
      expect(runResult.events.some((e) => e.kind === 'bounced')).toBe(true);

      // Shell must NOT score on tank 0 (no hit event, score remains 0)
      const hitEvent = runResult.events.find(isHit);
      expect(hitEvent).toBeUndefined();
      expect(state.scores).toEqual([0, 0]);
    });

    it('with Own ricochets on, the bounced shell hits its own tank and the rival takes the point', () => {
      const channel = channelById('game-6');
      const world = createWorld(channel);
      let state = createMatch(channel, { ...DEFAULT_OPTIONS, ownRicochets: true }, world);
      const tank0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(5, 20),
        heading: 8,
      };
      const tank1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(50, 20),
        heading: 8,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;
      const runResult = run(state, [NO_INPUT, NO_INPUT], 0.25, world);

      const ownHit = runResult.events.find((e) => e.kind === 'own-hit');
      expect(ownHit).toMatchObject({ kind: 'own-hit', side: 0, bounces: 1 });
      expect(runResult.events.some(isHit)).toBe(false);
      expect(runResult.state.scores).toEqual([0, 1]);
      expect(runResult.state.freeze?.victim).toBe(0);
    });
  });

  describe('billiard', () => {
    it('ignores direct hits and scores only after a bank off the wall', () => {
      const channel = channelById('game-8');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      // Row 2 (y in [4, 6]) of Sandbag Line is open floor across all 32 columns.
      // Tank 0 at (10, 5) heading 0, Tank 1 at (30, 5) heading 8.
      const tank0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(10, 5),
        heading: 0,
      };
      const tank1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(30, 5),
        heading: 8,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      // Fire directly at tank 1
      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;

      // Direct shot across open floor reaches tank 1: cannot score, shell passes through
      const directPassResult = run(state, [NO_INPUT, NO_INPUT], 0.6, world);
      state = directPassResult.state;

      expect(directPassResult.events.some((e) => e.kind === 'hit')).toBe(false);
      expect(state.scores).toEqual([0, 0]);
      expect(state.shells[0]).not.toBeNull();

      // Banked shell setup: shell with bounces: 1 moving towards tank 1
      const bankedShell = {
        owner: 0,
        position: vec(20, 5),
        direction: vec(1, 0),
        life: 2.0,
        age: 0,
        bounces: 1,
        path: [vec(10, 5), vec(15, 5)],
      };
      const bankedState: MatchState = {
        ...state,
        shells: [bankedShell, null],
      };

      const bankedHitResult = run(bankedState, [NO_INPUT, NO_INPUT], 0.3, world);
      expect(bankedHitResult.state.scores).toEqual([1, 0]);
      expect(bankedHitResult.events.some((e) => e.kind === 'hit')).toBe(true);
    });
  });

  describe('clock', () => {
    it('emits warning at 20.48 s left, ends at 0 with points winner, and ignores steps after over', () => {
      const channel = channelById('game-1');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      state = { ...state, scores: [1, 0] };
      state = { ...state, clock: WARNING_SECONDS + 0.05 };

      // Step crossing WARNING_SECONDS
      const warnStep = stepMatch(state, [NO_INPUT, NO_INPUT], 0.1, world);
      state = warnStep.state;

      expect(state.clock).toBeLessThanOrEqual(WARNING_SECONDS);
      expect(warnStep.events.some((e) => e.kind === 'warning')).toBe(true);

      // Step again: warning is NOT repeated
      const stepAfterWarn = stepMatch(state, [NO_INPUT, NO_INPUT], 0.1, world);
      state = stepAfterWarn.state;
      expect(stepAfterWarn.events.some((e) => e.kind === 'warning')).toBe(false);

      // Advance clock to 0
      const endRun = run(state, [NO_INPUT, NO_INPUT], state.clock + 0.1, world);
      state = endRun.state;

      expect(state.over).toBe(true);
      expect(state.winner).toBe(0);
      expect(endRun.events.some((e) => e.kind === 'match-over' && e.winner === 0)).toBe(true);

      // After over, steps do not change state
      const postOverStep = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
      expect(postOverStep.state).toBe(state);
      expect(postOverStep.events).toHaveLength(0);
    });

    it('ends level score matches as a draw with null winner', () => {
      const channel = channelById('game-1');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      state = { ...state, clock: 0.05, scores: [2, 2] };
      const endStep = stepMatch(state, [NO_INPUT, NO_INPUT], 0.1, world);

      expect(endStep.state.over).toBe(true);
      expect(endStep.state.winner).toBeNull();
      expect(endStep.events).toContainEqual({ kind: 'match-over', winner: null });
    });
  });

  describe('first to 10', () => {
    it('ends match immediately when a side reaches 10 points', () => {
      const channel = channelById('game-5');
      const world = createWorld(channel);
      let state = createMatch(channel, { ...DEFAULT_OPTIONS, scoring: 'first-to-10' }, world);

      expect(FIRST_TO).toBe(10);

      // Place vehicles facing each other with side 0 at 9 points
      const tank0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(20, 20),
        heading: 0,
      };
      const tank1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(30, 20),
        heading: 8,
      };
      state = {
        ...state,
        scores: [9, 0],
        vehicles: [tank0, tank1],
      };

      // Tank 0 fires the 10th scoring hit
      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;

      const finishRun = run(state, [NO_INPUT, NO_INPUT], 0.35, world);
      state = finishRun.state;

      expect(state.scores).toEqual([10, 0]);
      expect(state.over).toBe(true);
      expect(state.winner).toBe(0);
      expect(state.freeze).not.toBeNull();
      expect(finishRun.events.some((e) => e.kind === 'match-over' && e.winner === 0)).toBe(true);
    });
  });

  describe('handicap', () => {
    it('dies after 0.72 s on switch A and 1.14 s on switch B', () => {
      const channel = channelById('game-5');
      const world = createWorld(channel);
      let state = createMatch(
        channel,
        { scoring: 'timed', handicap: [true, false], wiring: false },
        world,
      );

      // Position tanks on long open lines:
      const tank0 = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(6, 16),
        heading: 0,
      };
      const tank1 = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(6, 24),
        heading: 0,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      state = stepMatch(
        state,
        [
          { x: 0, y: 0, fire: true },
          { x: 0, y: 0, fire: true },
        ],
        1 / 60,
        world,
      ).state;

      // Run 0.8 s: side 0 shell (0.72s life) expires, side 1 shell (1.14s life) remains live
      const run1 = run(state, [NO_INPUT, NO_INPUT], 0.8, world);
      state = run1.state;

      expect(state.shells[0]).toBeNull();
      expect(state.shells[1]).not.toBeNull();
      expect(
        run1.events.some((e) => e.kind === 'shell-gone' && e.side === 0 && e.reason === 'expired'),
      ).toBe(true);

      // Run another 0.45 s: side 1 shell also expires
      const run2 = run(state, [NO_INPUT, NO_INPUT], 0.45, world);
      state = run2.state;

      expect(state.shells[1]).toBeNull();
      expect(
        run2.events.some((e) => e.kind === 'shell-gone' && e.side === 1 && e.reason === 'expired'),
      ).toBe(true);
    });
  });

  describe('cartridge wiring', () => {
    it('uses stick y to turn biplane with wiring, and stick x without wiring', () => {
      const channel = channelById('game-15');
      const world = createWorld(channel);

      // With wiring: y=1 turns clockwise
      let stateWithWiring = createMatch(
        channel,
        { scoring: 'timed', handicap: [false, false], wiring: true },
        world,
      );
      stateWithWiring = stepMatch(
        stateWithWiring,
        [{ x: 0, y: 1, fire: false }, NO_INPUT],
        1 / 60,
        world,
      ).state;
      expect(stateWithWiring.vehicles[0]?.heading).toBe(1);

      // Without wiring: x=1 turns clockwise
      let stateWithoutWiring = createMatch(
        channel,
        { scoring: 'timed', handicap: [false, false], wiring: false },
        world,
      );
      stateWithoutWiring = stepMatch(
        stateWithoutWiring,
        [{ x: 1, y: 0, fire: false }, NO_INPUT],
        1 / 60,
        world,
      ).state;
      expect(stateWithoutWiring.vehicles[0]?.heading).toBe(1);
    });
  });

  describe('formation', () => {
    it('scores when hitting formation wingman and spins all planes in formation during freeze', () => {
      const channel = channelById('game-19');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      const v0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(20, 22),
        heading: 0,
      };
      const v1 = requireVehicle(state.vehicles, 1);
      const v2 = requireVehicle(state.vehicles, 2);
      const v3: VehicleState = {
        ...requireVehicle(state.vehicles, 3),
        position: vec(30, 22),
        heading: 8,
      };

      state = {
        ...state,
        vehicles: [v0, v1, v2, v3],
      };

      // Fire side 0
      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;

      const hitRun = run(state, [NO_INPUT, NO_INPUT], 0.25, world);
      state = hitRun.state;

      expect(state.scores).toEqual([1, 0]);
      const hitEvent = hitRun.events.find(isHit);
      expect(hitEvent).toBeDefined();
      if (hitEvent) {
        expect(hitEvent.vehicle).toBe(3);
      }

      // Both side 1 planes spin in freeze
      const headingLeaderBefore = state.vehicles[2]?.heading ?? 0;
      const headingWingmanBefore = state.vehicles[3]?.heading ?? 0;

      const freezeRun = run(state, [NO_INPUT, NO_INPUT], 0.1, world);
      state = freezeRun.state;

      expect(state.vehicles[2]?.heading).not.toBe(headingLeaderBefore);
      expect(state.vehicles[3]?.heading).not.toBe(headingWingmanBefore);
    });
  });

  describe('wrap', () => {
    it('hits a plane on the other side of the sky wrap', () => {
      const channel = channelById('game-24');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      // Jet 0 at (60, 20) facing heading 0 (+x)
      // Jet 1 at (6, 20) flying along the line of fire (heading 8), so it is still there when the shell arrives
      const j0: VehicleState = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(60, 20),
        heading: 0,
      };
      const j1: VehicleState = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(6, 20),
        heading: 8,
      };
      state = { ...state, vehicles: [j0, j1] };

      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;

      const hitRun = run(state, [NO_INPUT, NO_INPUT], 0.25, world);
      state = hitRun.state;

      expect(state.scores).toEqual([1, 0]);
      expect(hitRun.events.some((e) => e.kind === 'hit')).toBe(true);
    });
  });

  describe('muzzle in a wall', () => {
    it('stops shell immediately with shell-gone on stop channels, and reflects on bouncing channels', () => {
      // Outer border wall is at x in [0, 2].
      // Tank at (3, 20) facing heading 8 (left).
      // Muzzle reach is 2.15 -> muzzle reaches x=0.85 (inside wall).
      const stopChannel = channelById('game-1');
      const stopWorld = createWorld(stopChannel);
      let stopState = createMatch(stopChannel, DEFAULT_OPTIONS, stopWorld);

      const nosedTank: VehicleState = {
        ...requireVehicle(stopState.vehicles, 0),
        position: vec(3, 20),
        heading: 8,
      };
      stopState = {
        ...stopState,
        vehicles: [nosedTank, requireVehicle(stopState.vehicles, 1)],
      };

      const stopStep = stepMatch(
        stopState,
        [{ x: 0, y: 0, fire: true }, NO_INPUT],
        1 / 60,
        stopWorld,
      );

      expect(stopStep.events.some((e) => e.kind === 'fired')).toBe(true);
      expect(stopStep.events.some((e) => e.kind === 'shell-gone' && e.reason === 'wall')).toBe(
        true,
      );
      expect(stopStep.state.shells[0]).toBeNull();

      // Bouncing channel
      const bounceChannel = channelById('game-6');
      const bounceWorld = createWorld(bounceChannel);
      let bounceState = createMatch(bounceChannel, DEFAULT_OPTIONS, bounceWorld);

      bounceState = {
        ...bounceState,
        vehicles: [nosedTank, requireVehicle(bounceState.vehicles, 1)],
      };

      const bounceStep = stepMatch(
        bounceState,
        [{ x: 0, y: 0, fire: true }, NO_INPUT],
        1 / 60,
        bounceWorld,
      );

      expect(bounceStep.events.some((e) => e.kind === 'fired')).toBe(true);
      expect(bounceStep.state.shells[0]).not.toBeNull();
      if (bounceStep.state.shells[0]) {
        // Starts reflected (direction points away from wall, positive x) with bounce count 1
        expect(bounceStep.state.shells[0].direction.x).toBeGreaterThan(0);
        expect(bounceStep.state.shells[0].bounces).toBe(1);
      }
    });
  });

  describe('determinism', () => {
    it('produces identical states and events for two runs with identical inputs', () => {
      const channel = channelById('game-1');
      const world = createWorld(channel);

      const stateA = createMatch(channel, DEFAULT_OPTIONS, world);
      const stateB = createMatch(channel, DEFAULT_OPTIONS, world);

      const inputs: [StickInput, StickInput] = [
        { x: 1, y: 1, fire: true },
        { x: -1, y: 0, fire: false },
      ];

      const runA = run(stateA, inputs, 1.0, world);
      const runB = run(stateB, inputs, 1.0, world);

      expect(runA.state).toEqual(runB.state);
      expect(runA.events).toEqual(runB.events);
    });
  });

  describe('remix rules', () => {
    it('awards points equal to bounces on ricochet-royale and scores 0 for direct hits', () => {
      const channel = channelById('ricochet-royale');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      const tank0 = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(10, 5),
        heading: 0,
      };
      const tank1 = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(30, 5),
        heading: 8,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      // Direct shot: 0 bounces -> cannot score
      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;
      const directRun = run(state, [NO_INPUT, NO_INPUT], 0.6, world);
      expect(directRun.state.scores).toEqual([0, 0]);

      // Shell with 3 bounces hits tank 1 -> scores 3 points!
      const tripleBouncedShell = {
        owner: 0,
        position: vec(20, 5),
        direction: vec(1, 0),
        life: 2.0,
        age: 0,
        bounces: 3,
        path: [vec(10, 5), vec(12, 5), vec(16, 5)],
      };
      const bankedState: MatchState = {
        ...directRun.state,
        shells: [tripleBouncedShell, null],
      };
      const bankedRun = run(bankedState, [NO_INPUT, NO_INPUT], 0.3, world);
      expect(bankedRun.state.scores).toEqual([3, 0]);
      const hit = bankedRun.events.find(isHit);
      expect(hit).toBeDefined();
      if (hit) {
        expect(hit.points).toBe(3);
        expect(hit.bounces).toBe(3);
      }
    });

    it('sweeps radar every 5 s for 0.6 s on blackout, reveals on fire, but not on bumps', () => {
      const channel = channelById('blackout');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      expect(state.radar.next).toBe(5);
      expect(state.radar.showing).toBe(0);

      // Run 5 seconds: radar sweep triggers
      const sweepRun = run(state, [NO_INPUT, NO_INPUT], 5 + 2 / 60, world);
      state = sweepRun.state;

      expect(sweepRun.events.some((e) => e.kind === 'radar')).toBe(true);
      expect(state.radar.showing).toBeGreaterThan(0.55);
      expect(state.radar.showing).toBeLessThanOrEqual(0.6);

      // Run 0.6 s: radar sweep finishes
      const postSweepRun = run(state, [NO_INPUT, NO_INPUT], 0.6, world);
      expect(postSweepRun.state.radar.showing).toBe(0);
    });

    it('drains fuel while accelerating and prevents fast speed when empty, then refills while cruising', () => {
      const channel = channelById('ace-duel');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      // Jet starts at cruise speed 12.5. Hold throttle 1 (fast): burns fuel
      const fastInput: StickInput = { x: 0, y: 1, fire: false };
      const burnRun = run(state, [fastInput, NO_INPUT], 1.0, world);
      state = burnRun.state;

      expect(state.fuel[0]).toBeCloseTo(3.0 - 1.0, 1);
      expect(state.vehicles[0]?.speed).toBeGreaterThan(12.5);

      // Burn until fuel is completely exhausted (2.5 s more)
      const emptyRun = run(state, [fastInput, NO_INPUT], 2.5, world);
      state = emptyRun.state;
      expect(state.fuel[0]).toBe(0);

      // When fuel is 0, fast speed is not allowed: speed drops back to cruise (12.5)
      const cruiseRun = run(state, [fastInput, NO_INPUT], 1.0, world);
      state = cruiseRun.state;
      expect(state.vehicles[0]?.speed).toBeCloseTo(12.5, 1);

      // Release throttle to cruise (y = 0): fuel refills
      const refillRun = run(state, [NO_INPUT, NO_INPUT], 1.0, world);
      expect(refillRun.state.fuel[0]).toBeGreaterThan(0);
    });

    it('manages short rounds where a hit wins the round, positions reset after spin, and 5 wins end match', () => {
      const channel = channelById('last-tank');
      const world = createWorld(channel);
      let state = createMatch(channel, DEFAULT_OPTIONS, world);

      expect(state.clock).toBe(30);
      expect(state.round).toBe(1);

      // Place tanks in open floor
      const tank0 = {
        ...requireVehicle(state.vehicles, 0),
        position: vec(20, 20),
        heading: 0,
      };
      const tank1 = {
        ...requireVehicle(state.vehicles, 1),
        position: vec(30, 20),
        heading: 8,
      };
      state = { ...state, vehicles: [tank0, tank1] };

      // Tank 0 fires and hits Tank 1
      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;

      const hitRun = run(state, [NO_INPUT, NO_INPUT], 0.3, world);
      state = hitRun.state;

      expect(state.scores).toEqual([1, 0]);
      expect(hitRun.events.some((e) => e.kind === 'round-over' && e.winner === 0)).toBe(true);
      expect(state.freeze).not.toBeNull();

      // Finish the freeze pause (2.52 s)
      const freezeTime = state.freeze?.seconds ?? 2.52;
      const round2Run = run(state, [NO_INPUT, NO_INPUT], freezeTime + 0.1, world);
      state = round2Run.state;

      // New round begins: round 2, clock 30, freeze null, vehicles reset to spawn positions
      expect(state.round).toBe(2);
      expect(state.clock).toBeGreaterThan(29.8);
      expect(state.clock).toBeLessThanOrEqual(30);
      expect(state.freeze).toBeNull();
      expect(state.vehicles[0]?.position).toEqual(vec(8, 20));

      // Test a 30s round with no hits ending in a draw
      const drawRun = run(state, [NO_INPUT, NO_INPUT], 30.1, world);
      state = drawRun.state;
      expect(drawRun.events.some((e) => e.kind === 'round-over' && e.winner === null)).toBe(true);
      expect(state.round).toBe(3);
      expect(state.clock).toBeGreaterThan(29.6);
      expect(state.clock).toBeLessThanOrEqual(30);

      // Set score to 4-0 (1 win away from 5 rounds)
      state = {
        ...state,
        scores: [4, 0],
        vehicles: [tank0, tank1],
      };
      state = stepMatch(state, [{ x: 0, y: 0, fire: true }, NO_INPUT], 1 / 60, world).state;

      const winRun = run(state, [NO_INPUT, NO_INPUT], 0.3, world);
      state = winRun.state;
      expect(state.scores).toEqual([5, 0]);
      expect(state.over).toBe(true);
      expect(state.winner).toBe(0);
      expect(winRun.events.some((e) => e.kind === 'match-over' && e.winner === 0)).toBe(true);
    });
  });
});
