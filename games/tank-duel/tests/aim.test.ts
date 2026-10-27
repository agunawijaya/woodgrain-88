/**
 * Tests for the aiming planner and threat detector: direct shots, wall bounces,
 * target leading, sky wrap, and billiard scoring rules.
 */
import { describe, expect, it } from 'vitest';
import {
  bestShot,
  incomingThreat,
  planShots,
  turnSteps,
  type AimTarget,
  type ShotModel,
  type ShotPlan,
} from '../src/ai/aim.ts';
import { compileArena, wallPolygons, TANK_RADIUS } from '../src/arenas/format.ts';
import { OLD_QUARTER, OPEN_FIELD, SANDBAG_LINE } from '../src/arenas/layouts.ts';
import { fireShell, type ShellRules } from '../src/engine/shell.ts';
import { distance, vec, type Vec2 } from '../src/engine/vec.ts';
import { buildWallEdges } from '../src/engine/walls.ts';

describe('turnSteps', () => {
  it('computes shortest signed turn steps in -8..8 with 8 rather than -8', () => {
    expect(turnSteps(0, 15)).toBe(-1);
    expect(turnSteps(15, 0)).toBe(1);
    expect(turnSteps(0, 8)).toBe(8);
    expect(turnSteps(4, 12)).toBe(8);
    expect(turnSteps(3, 3)).toBe(0);
    expect(turnSteps(8, 0)).toBe(8);
    expect(turnSteps(12, 4)).toBe(8);
  });
});

describe('planShots and bestShot', () => {
  const arenaOpen = compileArena(OPEN_FIELD);
  const edgesOpen = buildWallEdges(wallPolygons(arenaOpen));

  const standardShot: ShotModel = {
    speed: 40,
    life: 2.0,
    walls: 'bounce',
    billiard: false,
    bounceLifeRefresh: 0.8,
    maxBounces: 2,
  };

  it('hits target straight ahead in open field with 0 bounces', () => {
    const origin = vec(10, 20);
    const muzzleReach = 2.0;
    const target: AimTarget = {
      position: vec(40, 20),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const plans = planShots(origin, muzzleReach, target, edgesOpen, standardShot);
    expect(plans).toHaveLength(16);

    const directPlan = plans[0];
    expect(directPlan).toBeDefined();
    if (directPlan !== undefined) {
      expect(directPlan.heading).toBe(0);
      expect(directPlan.bounces).toBe(0);
      expect(directPlan.miss).toBeLessThanOrEqual(0);
      expect(directPlan.scores).toBe(true);
      const expectedDistance = distance(vec(12, 20), target.position);
      expect(directPlan.time).toBeCloseTo(expectedDistance / standardShot.speed, 2);
    }

    const chosen = bestShot(plans, 0);
    expect(chosen).not.toBeNull();
    if (chosen !== null) {
      expect(chosen.heading).toBe(0);
    }
  });

  it('with the shooter given, marks a shot that would bounce back into it as no shot', () => {
    const origin = vec(6, 20);
    const target: AimTarget = { position: vec(40, 20), velocity: vec(0, 0), radius: TANK_RADIUS };
    const careful: ShotModel = {
      ...standardShot,
      maxBounces: 0,
      self: { position: origin, radius: TANK_RADIUS },
    };

    const plans = planShots(origin, 2.0, target, edgesOpen, careful);
    // Straight back off the wall behind: it would come home before it got anywhere.
    expect(plans[8]?.selfHit).toBe(true);
    expect(plans[8]?.miss).toBe(Infinity);
    // Straight at the target: it hits first.
    expect(plans[0]?.selfHit).toBe(false);
    expect(plans[0]?.miss).toBeLessThanOrEqual(0);

    // Without the shooter given, as when ricochets cannot hurt it, nothing is marked.
    const unaware = planShots(origin, 2.0, target, edgesOpen, { ...standardShot, maxBounces: 0 });
    expect(unaware[8]?.selfHit).toBe(false);
  });

  it('reports no hit when target is out of range', () => {
    const origin = vec(10, 20);
    const muzzleReach = 2.0;
    const target: AimTarget = {
      position: vec(40, 20),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const shortShot: ShotModel = {
      ...standardShot,
      life: 0.4,
      walls: 'stop',
    };

    const plans = planShots(origin, muzzleReach, target, edgesOpen, shortShot);
    for (const plan of plans) {
      expect(plan.miss).toBeGreaterThan(0);
    }

    const chosen = bestShot(plans, 0);
    expect(chosen).toBeNull();
  });

  it('leads moving target so closest approach matches target led position', () => {
    const origin = vec(10, 20);
    const muzzleReach = 0;
    const movingTarget: AimTarget = {
      position: vec(40, 20),
      velocity: vec(0, -3),
      radius: TANK_RADIUS,
    };
    const stillTarget: AimTarget = {
      position: vec(40, 20),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const movingPlans = planShots(origin, muzzleReach, movingTarget, edgesOpen, standardShot);
    const stillPlans = planShots(origin, muzzleReach, stillTarget, edgesOpen, standardShot);

    const hitMoving = movingPlans.find((plan) => plan.miss <= 0);
    expect(hitMoving).toBeDefined();
    if (hitMoving !== undefined) {
      const closestPoint = hitMoving.path[hitMoving.path.length - 1];
      expect(closestPoint).toBeDefined();
      if (closestPoint !== undefined) {
        const expectedLedTarget = vec(
          movingTarget.position.x + movingTarget.velocity.x * hitMoving.time,
          movingTarget.position.y + movingTarget.velocity.y * hitMoving.time,
        );
        expect(distance(closestPoint, expectedLedTarget)).toBeCloseTo(
          hitMoving.miss + movingTarget.radius,
          2,
        );
      }
    }

    const bestMoving = bestShot(movingPlans, 0);
    const bestStill = bestShot(stillPlans, 0);
    expect(bestMoving).not.toBeNull();
    expect(bestStill).not.toBeNull();
    if (bestMoving !== null && bestStill !== null) {
      const differentHeadingOrTime =
        bestMoving.heading !== bestStill.heading ||
        Math.abs(bestMoving.time - bestStill.time) > 0.01;
      expect(differentHeadingOrTime).toBe(true);
    }
  });

  // From the spawns themselves no heading banks into the other tank; this spot in the Old Quarter does:
  // heading 1 bounces off the pillar's left face at about (36, 32.4) into a tank hidden at (30, 35).
  it('finds a bank shot in the Old Quarter where the direct line is blocked', () => {
    const arenaQuarter = compileArena(OLD_QUARTER);
    const edgesQuarter = buildWallEdges(wallPolygons(arenaQuarter));

    const origin = vec(6, 20);
    const muzzleReach = 2.15;
    const target: AimTarget = {
      position: vec(30, 35),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const stopPlans = planShots(origin, muzzleReach, target, edgesQuarter, {
      ...standardShot,
      walls: 'stop',
    });
    const directPlan = stopPlans[0];
    if (directPlan !== undefined) {
      expect(directPlan.miss).toBeGreaterThan(0);
    }

    const plans = planShots(origin, muzzleReach, target, edgesQuarter, standardShot);
    const hittingBank = plans.find(
      (plan) => plan.miss <= 0 && plan.bounces >= 1 && plan.bounces <= 2,
    );
    expect(hittingBank).toBeDefined();
    if (hittingBank !== undefined) {
      expect(hittingBank.path.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < hittingBank.path.length - 1; i++) {
        const bouncePoint = hittingBank.path[i];
        expect(bouncePoint).toBeDefined();
        if (bouncePoint !== undefined) {
          const onWallFace = edgesQuarter.some((edge) => {
            const minX = Math.min(edge.a.x, edge.b.x) - 1e-4;
            const maxX = Math.max(edge.a.x, edge.b.x) + 1e-4;
            const minY = Math.min(edge.a.y, edge.b.y) - 1e-4;
            const maxY = Math.max(edge.a.y, edge.b.y) + 1e-4;
            return (
              bouncePoint.x >= minX &&
              bouncePoint.x <= maxX &&
              bouncePoint.y >= minY &&
              bouncePoint.y <= maxY
            );
          });
          expect(onWallFace).toBe(true);
        }
      }
    }
  });

  it('reports no hits on Sandbag Line when walls stop shells', () => {
    const arenaSandbag = compileArena(SANDBAG_LINE);
    const edgesSandbag = buildWallEdges(wallPolygons(arenaSandbag));

    const origin = vec(8, 20);
    const muzzleReach = 2.0;
    const target: AimTarget = {
      position: vec(56, 20),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const stopShot: ShotModel = {
      ...standardShot,
      walls: 'stop',
    };

    const plans = planShots(origin, muzzleReach, target, edgesSandbag, stopShot);
    const chosen = bestShot(plans, 0);
    expect(chosen).toBeNull();
  });

  it('marks direct hits as unscoring under billiard rules and prefers bank shots', () => {
    const origin = vec(10, 20);
    const muzzleReach = 2.0;
    const target: AimTarget = {
      position: vec(40, 20),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const billiardShot: ShotModel = {
      ...standardShot,
      billiard: true,
      life: 3.0,
    };

    const plans = planShots(origin, muzzleReach, target, edgesOpen, billiardShot);
    const directPlan = plans[0];
    expect(directPlan).toBeDefined();
    if (directPlan !== undefined) {
      expect(directPlan.bounces).toBe(0);
      expect(directPlan.scores).toBe(false);
    }

    const chosen = bestShot(plans, 0, { minBounces: 1 });
    if (chosen !== null) {
      expect(chosen.bounces).toBeGreaterThanOrEqual(1);
      expect(chosen.scores).toBe(true);
      expect(chosen.heading).not.toBe(0);
    }
  });

  it('wraps across sky boundaries the short way round', () => {
    const origin = vec(2, 20);
    const muzzleReach = 0;
    const target: AimTarget = {
      position: vec(60, 20),
      velocity: vec(0, 0),
      radius: TANK_RADIUS,
    };

    const skyShot: ShotModel = {
      speed: 40,
      life: 1.0,
      walls: 'stop',
      billiard: false,
      bounceLifeRefresh: 1,
      maxBounces: 0,
      wrap: { width: 64, height: 40 },
    };

    const plans = planShots(origin, muzzleReach, target, [], skyShot);
    const leftPlan = plans[8];
    expect(leftPlan).toBeDefined();
    if (leftPlan !== undefined) {
      expect(leftPlan.heading).toBe(8);
      expect(leftPlan.miss).toBeLessThanOrEqual(0);
      expect(leftPlan.bounces).toBe(0);
      expect(leftPlan.time).toBeCloseTo(6 / skyShot.speed, 2);
    }

    const chosen = bestShot(plans, 8);
    expect(chosen).not.toBeNull();
    if (chosen !== null) {
      expect(chosen.heading).toBe(8);
    }
  });
});

describe('bestShot preferences', () => {
  const dummyPath: readonly Vec2[] = [vec(0, 0), vec(1, 1)];

  const plan = (
    heading: number,
    miss: number,
    time: number,
    bounces: number,
    scores = true,
  ): ShotPlan => ({
    heading,
    miss,
    time,
    selfHit: false,
    returnsAt: Infinity,
    bounces,
    scores,
    path: dummyPath,
  });

  it('prefers fewest turn steps over lower time or bounces', () => {
    const planOneStepAway = plan(1, 0, 1.0, 1);
    const planTwoStepsAway = plan(2, 0, 0.2, 0);

    const chosen = bestShot([planOneStepAway, planTwoStepsAway], 0);
    expect(chosen).toBe(planOneStepAway);
  });

  it('prefers smaller time when turn steps match', () => {
    const slowerPlan = plan(1, 0, 0.8, 0);
    const fasterPlan = plan(1, 0, 0.3, 2);

    const chosen = bestShot([slowerPlan, fasterPlan], 0);
    expect(chosen).toBe(fasterPlan);
  });

  it('prefers fewer bounces when turns and time match', () => {
    const moreBounces = plan(1, 0, 0.5, 2);
    const fewerBounces = plan(1, 0, 0.5, 1);

    const chosen = bestShot([moreBounces, fewerBounces], 0);
    expect(chosen).toBe(fewerBounces);
  });

  it('respects slack preference for near-miss shots', () => {
    const nearMissPlan = plan(0, 0.25, 0.5, 0);

    expect(bestShot([nearMissPlan], 0)).toBeNull();
    expect(bestShot([nearMissPlan], 0, { slack: 0.1 })).toBeNull();
    expect(bestShot([nearMissPlan], 0, { slack: 0.3 })).toBe(nearMissPlan);
  });

  it('filters by minBounces and maxBounces', () => {
    const zeroBounce = plan(0, 0, 0.2, 0);
    const twoBounce = plan(0, 0, 0.3, 2);

    expect(bestShot([zeroBounce, twoBounce], 0, { minBounces: 1 })).toBe(twoBounce);
    expect(bestShot([zeroBounce, twoBounce], 0, { maxBounces: 1 })).toBe(zeroBounce);
    expect(bestShot([zeroBounce, twoBounce], 0, { minBounces: 1, maxBounces: 1 })).toBeNull();
  });
});

describe('incomingThreat', () => {
  const rules: ShellRules = {
    speed: 40,
    lifetime: 1.0,
    walls: 'bounce',
    billiard: false,
    bounceLifeRefresh: 0.8,
    maxFlight: 100,
  };

  it('detects a shell flying directly at a tank point', () => {
    const shell = fireShell(0, vec(10, 20), vec(1, 0), rules);
    const targetPoint = vec(30, 20);
    const radius = 1.4;

    const threat = incomingThreat(shell, rules, targetPoint, radius, []);
    expect(threat).not.toBeNull();
    if (threat !== null) {
      expect(threat.miss).toBeLessThanOrEqual(0);
      expect(threat.time).toBeCloseTo(20 / rules.speed, 2);
    }
  });

  it('returns positive miss or null for a shell flying away', () => {
    const shell = fireShell(0, vec(10, 20), vec(-1, 0), rules);
    const closeTank = vec(20, 20);
    const farTank = vec(50, 20);
    const radius = 1.4;

    const closeThreat = incomingThreat(shell, rules, closeTank, radius, []);
    expect(closeThreat).not.toBeNull();
    if (closeThreat !== null) {
      expect(closeThreat.miss).toBeGreaterThan(0);
    }

    const farThreat = incomingThreat(shell, rules, farTank, radius, []);
    expect(farThreat).toBeNull();
  });

  it('detects a shell banking off a wall into the tank', () => {
    const arenaOpen = compileArena(OPEN_FIELD);
    const edgesOpen = buildWallEdges(wallPolygons(arenaOpen));

    const shell = fireShell(0, vec(10, 10), vec(1, -1), rules);
    // Off the top wall at (18, 2), the shell comes back down through (26, 10).
    const tankPoint = vec(26, 10);
    const radius = 1.4;

    const threat = incomingThreat(shell, rules, tankPoint, radius, edgesOpen);
    expect(threat).not.toBeNull();
    if (threat !== null) {
      expect(threat.miss).toBeLessThanOrEqual(0);
      expect(threat.time).toBeGreaterThan(0);
    }
  });

  it('returns null when shell is already expired', () => {
    const shell = {
      ...fireShell(0, vec(10, 20), vec(1, 0), rules),
      life: 0,
    };
    const threat = incomingThreat(shell, rules, vec(30, 20), 1.4, []);
    expect(threat).toBeNull();
  });
});
