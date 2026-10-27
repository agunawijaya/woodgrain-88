/**
 * Tests for the Kid tank commanders and pilots: aiming, banking, dodging,
 * guided shell control, flying aircraft, determinism, and execution budget.
 */
import { describe, expect, it } from 'vitest';
import { createRng, KID_IDS } from '@woodgrain-88/kit';
import { createCommander } from '../src/ai/commander.ts';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld, shellRulesFor, stepMatch } from '../src/engine/match.ts';
import { fireShell } from '../src/engine/shell.ts';
import type { MatchOptions, MatchState, VehicleState } from '../src/engine/types.ts';
import { NO_INPUT } from '../src/engine/types.ts';
import { vec } from '../src/engine/vec.ts';

const DEFAULT_OPTIONS: MatchOptions = {
  scoring: 'timed',
  handicap: [false, false],
  wiring: false,
};

describe('commander Commander', () => {
  it('eventually fires on Open Field with enemy straight ahead for every kid, and Lou hits', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);

    for (const kid of KID_IDS) {
      let state = createMatch(channel, DEFAULT_OPTIONS, world);
      const rng = createRng(`test-open-${kid}`);
      const commander = createCommander(kid, 0, channel, world, rng);

      let fired = false;
      let louHit = false;

      // Up to 40 seconds: a patient kid holds long straight shots until impatience brings it closer.
      for (let step = 0; step < 800; step++) {
        const stick0 = commander.think(state, world, 0.05);
        if (stick0.fire) {
          fired = true;
        }

        const stepResult = stepMatch(state, [stick0, NO_INPUT], 0.05, world);
        state = stepResult.state;

        if (kid === 'lou' && state.scores[0] > 0) {
          louHit = true;
          break;
        }

        if (fired && kid !== 'lou') {
          break;
        }
      }

      expect(fired, `Kid ${kid} should eventually fire`).toBe(true);
      if (kid === 'lou') {
        expect(louHit, 'Lou should score a hit with his accurate aim').toBe(true);
      }
    }
  });

  it('finds a bank shot under billiard rules where one exists (Lou)', () => {
    // Proven bank shot in Old Quarter on game-9: tank at (6, 20) with heading 1
    // banks off the pillar at (36, 32.4) into a tank at (30, 35)
    const channel = channelById('game-9');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);

    const v0 = state.vehicles[0];
    const v1 = state.vehicles[1];
    if (!v0 || !v1) {
      throw new Error('Expected initial vehicles');
    }

    const tank0: VehicleState = {
      ...v0,
      position: vec(6, 20),
      heading: 0,
    };
    const tank1: VehicleState = {
      ...v1,
      position: vec(30, 35),
      heading: 8,
    };
    state = { ...state, vehicles: [tank0, tank1] };

    const rng = createRng('lou-billiard-bank');
    const commander = createCommander('lou', 0, channel, world, rng);

    let firedHeading = -1;
    let bounced = false;

    for (let step = 0; step < 50; step++) {
      const stick = commander.think(state, world, 0.05);
      if (stick.fire) {
        firedHeading = state.vehicles[0]?.heading ?? -1;
      }
      const stepResult = stepMatch(state, [stick, NO_INPUT], 0.05, world);
      state = stepResult.state;

      if (stepResult.events.some((e) => e.kind === 'bounced' && e.side === 0)) {
        bounced = true;
        break;
      }
    }

    expect(firedHeading).toBe(1);
    expect(bounced).toBe(true);
  });

  it('never fires while its shell is in the air', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const rng = createRng('no-double-fire');
    const commander = createCommander('dee', 0, channel, world, rng);

    for (let step = 0; step < 300; step++) {
      const stick0 = commander.think(state, world, 0.05);

      if (state.shells[0] !== null) {
        expect(stick0.fire).toBe(false);
      }

      state = stepMatch(state, [stick0, NO_INPUT], 0.05, world).state;
    }
  });

  it('gets out of the way of a shell from the side more often when it is Moss than when it is Dee', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);
    const rules = shellRulesFor(channel, false);

    // Facing across the shell's path, so driving straight on is the way out. The shell starts half
    // a second away: a careful kid moves at once, a reckless one usually too late.
    function timesHit(kid: 'moss' | 'dee'): number {
      let hits = 0;
      for (let trial = 0; trial < 20; trial++) {
        const start = createMatch(channel, DEFAULT_OPTIONS, world);
        const [own, enemy] = start.vehicles;
        if (!own || !enemy) throw new Error('Expected two tanks');
        let state: MatchState = {
          ...start,
          vehicles: [{ ...own, position: vec(20, 34), heading: 0 }, enemy],
          shells: [null, fireShell(1, vec(20, 14), vec(0, 1), rules)],
        };
        const commander = createCommander(kid, 0, channel, world, createRng(`${kid}-${trial}`));
        for (let step = 0; step < 60 && state.shells[1] !== null; step++) {
          const result = stepMatch(
            state,
            [commander.think(state, world, 1 / 50), NO_INPUT],
            1 / 50,
            world,
          );
          if (result.events.some((event) => event.kind === 'hit')) hits++;
          state = result.state;
        }
      }
      return hits;
    }

    expect(timesHit('moss')).toBeLessThan(timesHit('dee'));
  });

  it('never stops in a sky channel and vehicle speed stays positive', () => {
    // game-15: Biplanes in clouds
    const channel = channelById('game-15');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const rng = createRng('sky-flying');
    const commander = createCommander('dee', 0, channel, world, rng);

    for (let step = 0; step < 100; step++) {
      const stick0 = commander.think(state, world, 0.05);
      state = stepMatch(state, [stick0, NO_INPUT], 0.05, world).state;

      const craft = state.vehicles.find((v) => v.side === 0);
      expect(craft).toBeDefined();
      if (craft) {
        expect(craft.speed).toBeGreaterThan(0);
      }
    }
  });

  it('produces no input during a freeze pause', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const rng = createRng('freeze-test');
    const commander = createCommander('lou', 0, channel, world, rng);

    state = {
      ...state,
      freeze: {
        seconds: 2.0,
        victim: 0,
        shove: vec(1, 0),
        spinCarry: 0,
      },
    };

    const stick = commander.think(state, world, 0.05);
    expect(stick).toEqual(NO_INPUT);
  });

  it('produces identical stick inputs deterministically given the same seed over 600 steps', () => {
    const channel = channelById('game-5');
    const world = createWorld(channel);

    const runSeed = 'deterministic-run-42';
    const commanderA = createCommander('benny', 0, channel, world, createRng(runSeed));
    const commanderB = createCommander('benny', 0, channel, world, createRng(runSeed));

    let stateA = createMatch(channel, DEFAULT_OPTIONS, world);
    let stateB = createMatch(channel, DEFAULT_OPTIONS, world);

    for (let step = 0; step < 600; step++) {
      const stickA = commanderA.think(stateA, world, 0.016);
      const stickB = commanderB.think(stateB, world, 0.016);

      expect(stickA).toEqual(stickB);

      stateA = stepMatch(stateA, [stickA, NO_INPUT], 0.016, world).state;
      stateB = stepMatch(stateB, [stickB, NO_INPUT], 0.016, world).state;
    }
  });

  it('keeps thinking time under the performance budget across 600 steps', () => {
    const channel = channelById('game-2'); // Old Quarter dense maze
    const world = createWorld(channel);
    let state = createMatch(channel, DEFAULT_OPTIONS, world);
    const rng = createRng('benchmark-seed');
    const commander = createCommander('moss', 0, channel, world, rng);

    const startTime = performance.now();
    for (let step = 0; step < 600; step++) {
      const stick0 = commander.think(state, world, 0.016);
      state = stepMatch(state, [stick0, NO_INPUT], 0.016, world).state;
    }
    const elapsedMs = performance.now() - startTime;

    // Budget allows up to 1000 ms total (0.3 ms/step avg target = 180 ms)
    expect(elapsedMs).toBeLessThan(1000);
  });
});
