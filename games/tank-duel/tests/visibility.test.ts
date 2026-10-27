/**
 * Tests for visibility rules: checking when invisible tanks become visible
 * and whether aircraft are hidden inside sky cloud banks.
 */
import { describe, expect, it } from 'vitest';
import { compileArena } from '../src/arenas/format.ts';
import { SANDBAG_LINE } from '../src/arenas/layouts.ts';
import { CLEAR_SKY, CLOUD_BANKS } from '../src/arenas/skies.ts';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld } from '../src/engine/match.ts';
import { BUMP_REVEAL_SECONDS, SPIN_SECONDS, TANK_RADIUS } from '../src/engine/rules.ts';
import { fireShell, type Shell } from '../src/engine/shell.ts';
import type { MatchState, VehicleState } from '../src/engine/types.ts';
import { vec } from '../src/engine/vec.ts';
import { insideCloud, isRevealed } from '../src/engine/visibility.ts';

function createDummyTank(overrides: Partial<VehicleState> = {}): VehicleState {
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

describe('visibility', () => {
  describe('isRevealed', () => {
    it('keeps tanks invisible on game-10 until firing, bumping, or spinning after a hit', () => {
      const channel = channelById('game-10');
      const world = createWorld(channel);
      const state = createMatch(
        channel,
        { scoring: 'timed', handicap: [false, false], wiring: false },
        world,
      );

      const tank0 = state.vehicles[0];
      const tank1 = state.vehicles[1];
      expect(tank0).toBeDefined();
      expect(tank1).toBeDefined();

      if (!tank0 || !tank1) return;

      // 1. Initial state: both tanks unseen
      expect(isRevealed(state, tank0)).toBe(false);
      expect(isRevealed(state, tank1)).toBe(false);

      // 2. Tank 0 is revealed while its side has a shell in the air
      const dummyShell: Shell = fireShell(0, vec(10, 20), vec(1, 0), {
        speed: 40,
        lifetime: 1.14,
        walls: 'stop',
        billiard: false,
        bounceLifeRefresh: 0.8,
        maxFlight: 100,
      });
      const stateWithShell: MatchState = {
        ...state,
        shells: [dummyShell, null],
      };
      expect(isRevealed(stateWithShell, tank0)).toBe(true);
      expect(isRevealed(stateWithShell, tank1)).toBe(false);

      // 3. Tank 0 is revealed while bumped > 0
      const bumpedTank: VehicleState = {
        ...tank0,
        bumped: BUMP_REVEAL_SECONDS,
      };
      expect(isRevealed(state, bumpedTank)).toBe(true);

      // Bump timer expiring hides the tank again
      const unbumpedTank: VehicleState = {
        ...tank0,
        bumped: 0,
      };
      expect(isRevealed(state, unbumpedTank)).toBe(false);

      // 4. Tank 1 is revealed while spinning as the freeze victim
      const stateWithFreeze: MatchState = {
        ...state,
        freeze: {
          seconds: SPIN_SECONDS,
          victim: 1,
          shove: vec(1, 0),
          spinCarry: 0,
        },
      };
      expect(isRevealed(stateWithFreeze, tank0)).toBe(false);
      expect(isRevealed(stateWithFreeze, tank1)).toBe(true);
    });

    it('reveals tanks in Blackout during radar sweeps, firing, and freeze, but NOT on bumps', () => {
      const channel = channelById('blackout');
      const world = createWorld(channel);
      const state = createMatch(
        channel,
        { scoring: 'timed', handicap: [false, false], wiring: false },
        world,
      );

      const tank0 = state.vehicles[0];
      expect(tank0).toBeDefined();
      if (!tank0) return;

      // Unseen initially
      expect(isRevealed(state, tank0)).toBe(false);

      // Bumping does NOT reveal in Blackout
      const bumpedTank: VehicleState = { ...tank0, bumped: BUMP_REVEAL_SECONDS };
      expect(isRevealed(state, bumpedTank)).toBe(false);

      // Radar sweep reveals
      const stateWithRadar: MatchState = {
        ...state,
        radar: { next: 5, showing: 0.6 },
      };
      expect(isRevealed(stateWithRadar, tank0)).toBe(true);

      // Firing reveals
      const dummyShell = fireShell(0, vec(10, 20), vec(1, 0), {
        speed: 40,
        lifetime: 1.14,
        walls: 'stop',
        billiard: false,
        bounceLifeRefresh: 0.8,
        maxFlight: 100,
      });
      const stateWithShell: MatchState = {
        ...state,
        shells: [dummyShell, null],
      };
      expect(isRevealed(stateWithShell, tank0)).toBe(true);

      // Freeze victim reveals
      const stateWithFreeze: MatchState = {
        ...state,
        freeze: { seconds: SPIN_SECONDS, victim: 0, shove: vec(1, 0), spinCarry: 0 },
      };
      expect(isRevealed(stateWithFreeze, tank0)).toBe(true);
    });

    it('always reveals vehicles in visible channels', () => {
      const channel = channelById('game-1');
      const world = createWorld(channel);
      const state = createMatch(
        channel,
        { scoring: 'timed', handicap: [false, false], wiring: false },
        world,
      );

      const tank0 = state.vehicles[0];
      expect(tank0).toBeDefined();
      if (tank0) {
        expect(isRevealed(state, tank0)).toBe(true);
      }
    });

    it('always reveals aircraft regardless of channel invisibility settings', () => {
      const channel = channelById('game-10');
      const arena = compileArena(SANDBAG_LINE);
      const state = createMatch(
        channel,
        { scoring: 'timed', handicap: [false, false], wiring: false },
        { field: arena, edges: [] },
      );

      const biplane = createDummyTank({ vehicle: 'biplane' });
      expect(isRevealed(state, biplane)).toBe(true);

      const jet = createDummyTank({ vehicle: 'jet' });
      expect(isRevealed(state, jet)).toBe(true);
    });
  });

  describe('insideCloud', () => {
    it('returns true when a point is inside a cloud bank and false when outside', () => {
      // First cloud in CLOUD_BANKS: center (13, 9), rx: 7, ry: 3.2
      expect(insideCloud(vec(13, 9), CLOUD_BANKS)).toBe(true);
      expect(insideCloud(vec(15, 10), CLOUD_BANKS)).toBe(true);

      // Center of board (32, 20) is clear of all clouds
      expect(insideCloud(vec(32, 20), CLOUD_BANKS)).toBe(false);
    });

    it('detects cloud coverage across the wrapping sky edges', () => {
      const wrapSkyDef = {
        id: 'test-wrap-sky',
        name: 'Wrap Sky',
        clouds: [{ x: 2, y: 2, radiusX: 5, radiusY: 4 }],
        spawns: CLOUD_BANKS.spawns,
      };

      // Point at x=63 wraps around to distance 3 from cloud center x=2 (3 <= 5)
      expect(insideCloud(vec(63, 2), wrapSkyDef)).toBe(true);

      // Point at y=39 wraps around to distance 3 from cloud center y=2 (3 <= 4)
      expect(insideCloud(vec(2, 39), wrapSkyDef)).toBe(true);

      // Point wrapping on both axes: dx=3, dy=3. (3/5)^2 + (3/4)^2 = 0.36 + 0.5625 = 0.9225 <= 1
      expect(insideCloud(vec(63, 39), wrapSkyDef)).toBe(true);

      // Far point outside the wrap reach
      expect(insideCloud(vec(50, 30), wrapSkyDef)).toBe(false);
    });

    it('always returns false for skies without cloud banks', () => {
      expect(insideCloud(vec(13, 9), CLEAR_SKY)).toBe(false);
      expect(insideCloud(vec(0, 0), CLEAR_SKY)).toBe(false);
    });
  });
});
