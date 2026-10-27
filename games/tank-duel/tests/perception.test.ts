/**
 * Tests for perception and the Lookout: tracking visible enemies,
 * estimating velocities, respecting visibility on invisible channels,
 * preserving fair play by hiding positions, and cloud concealment in skies.
 */
import { describe, expect, it } from 'vitest';
import { createLookout } from '../src/ai/perception.ts';
import type { SkyDef } from '../src/arenas/format.ts';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld, stepMatch } from '../src/engine/match.ts';
import type { MatchOptions } from '../src/engine/types.ts';
import { NO_INPUT } from '../src/engine/types.ts';
import { vec } from '../src/engine/vec.ts';

const DEFAULT_OPTIONS: MatchOptions = {
  scoring: 'timed',
  handicap: [false, false],
  wiring: false,
};

describe('perception Lookout', () => {
  it('sees a visible enemy and estimates its velocity between consecutive steps', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const lookout = createLookout(0);

    // Initial observation at time 0
    const picture0 = lookout.observe(state, world);
    expect(picture0.own).toHaveLength(1);
    expect(picture0.enemies).toHaveLength(1);

    const enemy0 = picture0.enemies[0];
    expect(enemy0).toBeDefined();
    if (enemy0) {
      expect(enemy0.visible).toBe(true);
      expect(enemy0.velocity).toEqual(vec(0, 0));
      expect(enemy0.seenAt).toBe(0);
    }

    // Step state with enemy driving (stick y = 1 for side 1)
    const dt = 0.1;
    const step1 = stepMatch(state, [NO_INPUT, { x: 0, y: 1, fire: false }], dt, world);
    state = step1.state;

    const picture1 = lookout.observe(state, world);
    const enemy1 = picture1.enemies[0];
    expect(enemy1).toBeDefined();
    if (enemy1) {
      expect(enemy1.visible).toBe(true);
      expect(enemy1.seenAt).toBeCloseTo(dt);
      // Tank was driving along its heading; velocity must be non-zero and match position delta
      const movedVehicle = state.vehicles.find((v) => v.side === 1);
      expect(movedVehicle).toBeDefined();
      if (movedVehicle && enemy0) {
        const expectedVx = (movedVehicle.position.x - enemy0.position.x) / dt;
        const expectedVy = (movedVehicle.position.y - enemy0.position.y) / dt;
        expect(enemy1.velocity.x).toBeCloseTo(expectedVx, 2);
        expect(enemy1.velocity.y).toBeCloseTo(expectedVy, 2);
      }
    }
  });

  it('keeps the last sighting with visible false on an invisible channel', () => {
    // game-10: Ghost guided · Sandbags (invisible: true)
    const channel = channelById('game-10');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const lookout = createLookout(0);

    // Step 0: unseen at start, starts as hidden with spawn position and time 0
    const picture0 = lookout.observe(state, world);
    const enemy0 = picture0.enemies[0];
    expect(enemy0).toBeDefined();
    if (enemy0) {
      expect(enemy0.visible).toBe(false);
      expect(enemy0.seenAt).toBe(0);
      expect(enemy0.velocity).toEqual(vec(0, 0));
    }

    // Reveal enemy by firing side 1 shell
    state = {
      ...state,
      time: 1.5,
      shells: [
        null,
        {
          owner: 1,
          position: vec(50, 20),
          direction: vec(-1, 0),
          life: 1.0,
          age: 0,
          bounces: 0,
          path: [vec(50, 20)],
        },
      ],
    };

    const picture1 = lookout.observe(state, world);
    const enemy1 = picture1.enemies[0];
    expect(enemy1).toBeDefined();
    if (enemy1) {
      expect(enemy1.visible).toBe(true);
      expect(enemy1.seenAt).toBe(1.5);
    }

    // Enemy shell expires: enemy goes hidden again
    state = {
      ...state,
      time: 2.5,
      shells: [null, null],
    };

    const picture2 = lookout.observe(state, world);
    const enemy2 = picture2.enemies[0];
    expect(enemy2).toBeDefined();
    if (enemy2 && enemy1) {
      expect(enemy2.visible).toBe(false);
      expect(enemy2.seenAt).toBe(enemy1.seenAt);
      expect(enemy2.position).toEqual(enemy1.position);
    }
  });

  it('does not change the picture when a hidden enemy moves (fair-play test)', () => {
    const channel = channelById('game-10');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const lookout = createLookout(0);

    // Initial observation while invisible
    const picture0 = lookout.observe(state, world);
    const enemy0 = picture0.enemies[0];
    expect(enemy0).toBeDefined();
    if (!enemy0) return;
    expect(enemy0.visible).toBe(false);
    const originalSeenPosition = { ...enemy0.position };

    // Move the enemy tank in match state without revealing it
    const secretPosition = vec(24, 18);
    const modifiedVehicles = state.vehicles.map((v) =>
      v.side === 1 ? { ...v, position: secretPosition } : v,
    );
    state = {
      ...state,
      time: 0.5,
      vehicles: modifiedVehicles,
    };

    // Observe again
    const picture1 = lookout.observe(state, world);
    const enemy1 = picture1.enemies[0];
    expect(enemy1).toBeDefined();
    if (!enemy1) return;

    // Lookout must NEVER leak the secret position while hidden
    expect(enemy1.visible).toBe(false);
    expect(enemy1.position).toEqual(originalSeenPosition);
    expect(enemy1.position.x).not.toBe(secretPosition.x);
    expect(enemy1.position.y).not.toBe(secretPosition.y);
  });

  it('does not see an aircraft when it is inside a cloud bank in the sky', () => {
    // game-15: Guided · Clouds (biplanes in clouds)
    const channel = channelById('game-15');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const sky = world.field as SkyDef;
    const lookout = createLookout(0);

    const firstCloud = sky.clouds[0];
    expect(firstCloud).toBeDefined();
    if (!firstCloud) return;

    // Place enemy biplane directly in the center of the first cloud
    const cloudPosition = vec(firstCloud.x, firstCloud.y);
    state = {
      ...state,
      vehicles: state.vehicles.map((v) => (v.side === 1 ? { ...v, position: cloudPosition } : v)),
    };

    const inCloudPicture = lookout.observe(state, world);
    const enemyInCloud = inCloudPicture.enemies[0];
    expect(enemyInCloud).toBeDefined();
    if (enemyInCloud) {
      expect(enemyInCloud.visible).toBe(false);
    }

    // Move enemy biplane outside any cloud bank
    const clearPosition = vec(2, 2);
    state = {
      ...state,
      vehicles: state.vehicles.map((v) => (v.side === 1 ? { ...v, position: clearPosition } : v)),
    };

    const clearPicture = lookout.observe(state, world);
    const enemyClear = clearPicture.enemies[0];
    expect(enemyClear).toBeDefined();
    if (enemyClear) {
      expect(enemyClear.visible).toBe(true);
      expect(enemyClear.position).toEqual(clearPosition);
    }
  });
});
