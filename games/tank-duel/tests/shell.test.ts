import { describe, expect, it } from 'vitest';
import {
  BILLIARD_WRAP,
  canScore,
  fireShell,
  stepShell,
  type Shell,
  type ShellRules,
} from '../src/engine/shell.ts';
import { vec } from '../src/engine/vec.ts';
import { buildWallEdges, type WallPolygon } from '../src/engine/walls.ts';

describe('shell', () => {
  const standardRules: ShellRules = {
    speed: 40,
    lifetime: 1.0,
    walls: 'bounce',
    billiard: false,
    bounceLifeRefresh: 0.8,
    maxFlight: 100,
  };

  it('normalises direction and starts the path at the muzzle when firing', () => {
    const muzzle = vec(12, 18);
    const unnormalisedDir = vec(3, 4);

    const shell = fireShell(1, muzzle, unnormalisedDir, standardRules);

    expect(shell.owner).toBe(1);
    expect(shell.position).toEqual(muzzle);
    expect(shell.direction.x).toBeCloseTo(0.6);
    expect(shell.direction.y).toBeCloseTo(0.8);
    expect(shell.life).toBeCloseTo(standardRules.lifetime);
    expect(shell.bounces).toBe(0);
    expect(shell.path).toEqual([muzzle]);
  });

  it('decreases life by dt each step during straight flight and expires on time', () => {
    const dt = 0.1;
    let currentShell: Shell | null = fireShell(0, vec(0, 0), vec(1, 0), standardRules);
    let steps = 0;

    while (currentShell !== null && steps < 20) {
      const step = stepShell(currentShell, dt, [], standardRules);
      currentShell = step.shell;
      steps++;
      if (currentShell !== null) {
        // Position advances by speed * dt
        expect(currentShell.position.x).toBeCloseTo(steps * standardRules.speed * dt);
        expect(currentShell.life).toBeCloseTo(standardRules.lifetime - steps * dt);
      }
    }

    // With lifetime 1.0 and dt 0.1, it should expire on step 10
    expect(steps).toBe(10);
    expect(currentShell).toBeNull();
  });

  it('returns null and reports the hit when walls is stop and shell meets a wall', () => {
    const stopRules: ShellRules = {
      ...standardRules,
      walls: 'stop',
    };

    // Wall at x = 10
    const wall: WallPolygon = [vec(10, 0), vec(12, 0), vec(12, 20), vec(10, 20)];
    const edges = buildWallEdges([wall]);

    // Fired from x = 0 at speed 40 with dt = 0.5 (travel distance 20 units)
    const shell = fireShell(0, vec(0, 5), vec(1, 0), stopRules);
    const step = stepShell(shell, 0.5, edges, stopRules);

    expect(step.shell).toBeNull();
    expect(step.hits).toHaveLength(1);
    const hit = step.hits[0];
    expect(hit).toBeDefined();
    if (hit) {
      expect(hit.at.x).toBeCloseTo(10);
      expect(hit.at.y).toBeCloseTo(5);
    }
    expect(step.travelled).toEqual([vec(0, 5), vec(10, 5)]);
  });

  it('increments bounces, records bounce points in path, and refreshes life to 80%', () => {
    const bounceRules: ShellRules = {
      ...standardRules,
      lifetime: 2.0,
      bounceLifeRefresh: 0.8,
    };

    // Vertical wall at x = 10
    const wall: WallPolygon = [vec(10, 0), vec(12, 0), vec(12, 20), vec(10, 20)];
    const edges = buildWallEdges([wall]);

    // Shell with only 0.1s life left, fired at x = 8, speed 40, dt = 0.1 (travel distance 4)
    // Wall hit occurs at distance 2 (halfway through the step)
    const lowLifeShell: Shell = {
      owner: 0,
      position: vec(8, 10),
      direction: vec(1, 0),
      life: 0.1,
      age: 0,
      bounces: 0,
      path: [vec(8, 10)],
    };

    const step = stepShell(lowLifeShell, 0.1, edges, bounceRules);

    expect(step.shell).not.toBeNull();
    const updated = step.shell;
    if (updated) {
      expect(updated.bounces).toBe(1);
      expect(updated.path).toHaveLength(2);
      expect(updated.path[0]).toEqual(vec(8, 10));
      const bouncePoint = updated.path[1];
      expect(bouncePoint).toBeDefined();
      if (bouncePoint) {
        expect(bouncePoint.x).toBeCloseTo(10);
        expect(bouncePoint.y).toBeCloseTo(10);
      }

      // Life refreshed to 80% of 2.0 = 1.6, minus time after bounce (0.1 * (1 - 2/4) = 0.05) -> 1.55
      expect(updated.life).toBeCloseTo(1.55);
      expect(updated.direction.x).toBeCloseTo(-1);
      expect(updated.direction.y).toBeCloseTo(0);
      expect(updated.position.x).toBeCloseTo(8);
      expect(updated.position.y).toBeCloseTo(10);
    }
  });

  it('burns out at its flight cap even when bouncing square between two walls', () => {
    const rules: ShellRules = { ...standardRules, lifetime: 2, maxFlight: 3 };
    const corridor = buildWallEdges([
      [vec(0, 0), vec(2, 0), vec(2, 20), vec(0, 20)],
      [vec(10, 0), vec(12, 0), vec(12, 20), vec(10, 20)],
    ]);
    let shell: Shell | null = fireShell(0, vec(6, 10), vec(1, 0), rules);
    let flown = 0;
    const dt = 1 / 60;
    while (shell !== null && flown < 10) {
      shell = stepShell(shell, dt, corridor, rules).shell;
      flown += dt;
    }

    expect(flown).toBeCloseTo(3, 1);
  });

  it('turns shell when steer is given and keeps direction when steer is zero', () => {
    const shell = fireShell(0, vec(5, 5), vec(1, 0), standardRules);

    // Steer downwards: (0, 1)
    const step1 = stepShell(shell, 0.05, [], standardRules, vec(0, 1));
    expect(step1.shell).not.toBeNull();
    const steered = step1.shell;
    if (steered) {
      expect(steered.direction.x).toBeCloseTo(0);
      expect(steered.direction.y).toBeCloseTo(1);
    }

    // Zero steer: keeps current direction
    if (steered) {
      const step2 = stepShell(steered, 0.05, [], standardRules, vec(0, 0));
      expect(step2.shell).not.toBeNull();
      if (step2.shell) {
        expect(step2.shell.direction.x).toBeCloseTo(0);
        expect(step2.shell.direction.y).toBeCloseTo(1);
      }
    }
  });

  it('evaluates scoring according to billiard rules and BILLIARD_WRAP', () => {
    const billiardRules: ShellRules = {
      ...standardRules,
      billiard: true,
    };

    const createShellWithBounces = (bounces: number): Shell => ({
      owner: 0,
      position: vec(0, 0),
      direction: vec(1, 0),
      life: 1.0,
      age: 0,
      bounces,
      path: [vec(0, 0)],
    });

    // Before first bounce (bounces = 0): cannot score
    expect(canScore(createShellWithBounces(0), billiardRules)).toBe(false);

    // After 1 bounce: can score
    expect(canScore(createShellWithBounces(1), billiardRules)).toBe(true);

    // After 31 bounces: can score
    expect(canScore(createShellWithBounces(31), billiardRules)).toBe(true);

    // At 32 bounces (BILLIARD_WRAP): wraps, cannot score
    expect(canScore(createShellWithBounces(BILLIARD_WRAP), billiardRules)).toBe(false);

    // At 33 bounces: can score again
    expect(canScore(createShellWithBounces(33), billiardRules)).toBe(true);

    // At 64 bounces: cannot score
    expect(canScore(createShellWithBounces(64), billiardRules)).toBe(false);

    // When billiard is false, always scores even before first bounce
    expect(canScore(createShellWithBounces(0), standardRules)).toBe(true);
  });

  it('wraps end position across borders and preserves unwrapped travelled polyline', () => {
    const wrapRules: ShellRules = {
      ...standardRules,
      wrap: { width: 64, height: 40 },
    };

    // Shell near right edge at x = 62, moving right at speed 40, dt = 0.1 -> travels 4 units to 66
    const shell = fireShell(0, vec(62, 20), vec(1, 0), wrapRules);
    const step = stepShell(shell, 0.1, [], wrapRules);

    expect(step.shell).not.toBeNull();
    if (step.shell) {
      // 66 folded into [0, 64) is 2
      expect(step.shell.position.x).toBeCloseTo(2);
      expect(step.shell.position.y).toBeCloseTo(20);
    }

    // travelled polyline remains continuous / unwrapped for vehicle collision tests
    expect(step.travelled).toHaveLength(2);
    expect(step.travelled[0]).toEqual(vec(62, 20));
    const stepEnd = step.travelled[1];
    expect(stepEnd).toBeDefined();
    if (stepEnd) {
      expect(stepEnd.x).toBeCloseTo(66);
      expect(stepEnd.y).toBeCloseTo(20);
    }
  });

  it('does not mutate input objects', () => {
    const originalShell: Shell = Object.freeze({
      owner: 0,
      position: Object.freeze(vec(5, 5)),
      direction: Object.freeze(vec(1, 0)),
      life: 1.0,
      age: 0,
      bounces: 0,
      path: Object.freeze([Object.freeze(vec(5, 5))]),
    });
    const frozenRules: ShellRules = Object.freeze({
      speed: 40,
      lifetime: 1.0,
      walls: 'bounce' as const,
      billiard: false,
      bounceLifeRefresh: 0.8,
      maxFlight: 100,
    });

    const step = stepShell(originalShell, 0.1, [], frozenRules);

    expect(originalShell.position.x).toBe(5);
    expect(originalShell.life).toBe(1.0);
    expect(originalShell.bounces).toBe(0);
    expect(originalShell.path).toHaveLength(1);
    expect(step.shell).not.toBe(originalShell);
  });
});
