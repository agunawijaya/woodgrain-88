/**
 * Tests for the docking race: the speed-matched dock, the pods, the cooldown,
 * solo play, unlimited thrust, the beacon and the absence of weapons.
 */
import { describe, expect, it } from 'vitest';
import { stepMatch } from '../src/engine/match.ts';
import { DOCK_COOLDOWN } from '../src/engine/types.ts';
import { controls, place, runTicks, setupFor } from './helpers.ts';

describe('docking', () => {
  it('docks only on a touch with matched speeds: under 16 on B, at most 1 on A', () => {
    // No touch: matched speeds but far apart, so no dock.
    const apart = setupFor(8);
    place(apart.ships[0], 80, 45, 5, 5);
    place(apart.shots[0], 60, 45, 5, 5);
    stepMatch(apart, [controls(), controls()]);
    expect(apart.ships[0].score).toBe(0);

    // On B, a combined difference of 15 docks.
    const close = setupFor(8);
    place(close.ships[0], 80, 45, 5, 5);
    place(close.shots[0], 80, 45, 20, 5); // |5-20| + |5-5| = 15
    stepMatch(close, [controls(), controls()]);
    expect(close.ships[0].score).toBe(1);

    // On B, a combined difference of 16 does not.
    const wide = setupFor(8);
    place(wide.ships[0], 80, 45, 5, 5);
    place(wide.shots[0], 80, 45, 21, 5); // |5-21| = 16
    stepMatch(wide, [controls(), controls()]);
    expect(wide.ships[0].score).toBe(0);

    // On A, a difference of 1 docks.
    const exact = setupFor(8, { switches: ['A', 'B'] });
    place(exact.ships[0], 80, 45, 5, 5);
    place(exact.shots[0], 80, 45, 6, 5); // |5-6| = 1
    stepMatch(exact, [controls(), controls()]);
    expect(exact.ships[0].score).toBe(1);

    // On A, a difference of 2 does not.
    const off = setupFor(8, { switches: ['A', 'B'] });
    place(off.ships[0], 80, 45, 5, 5);
    place(off.shots[0], 80, 45, 7, 5); // |5-7| = 2
    stepMatch(off, [controls(), controls()]);
    expect(off.ships[0].score).toBe(0);
  });

  it('a dock scores, re-aims the pod in place, and blocks the ship for 128 ticks', () => {
    const match = setupFor(8);
    const ship = match.ships[0];
    const pod = match.shots[0];

    place(ship, 80, 45);
    place(pod, 80, 45); // both at rest: a perfect match

    const podX = pod.x;
    const podY = pod.y;

    stepMatch(match, [controls(), controls()]);

    expect(ship.score).toBe(1);
    expect(ship.dockCooldown).toBe(DOCK_COOLDOWN - 1); // the countdown already ran this tick
    expect(pod.prevX).toBe(podX); // re-aimed where it was, not teleported
    expect(pod.prevY).toBe(podY);
    expect(pod.vx !== 0 || pod.vy !== 0).toBe(true); // a fresh random velocity
    expect(match.events.some((e) => e.kind === 'docked' && e.seat === 0 && e.pod === 0)).toBe(true);
  });

  it('with own pods each seat docks only its own pod', () => {
    // Seat 0 docks with pod 0.
    const s0 = setupFor(8);
    place(s0.ships[0], 80, 45);
    place(s0.shots[0], 80, 45);
    stepMatch(s0, [controls(), controls()]);
    expect(s0.ships[0].score).toBe(1);

    // Seat 1 docks with pod 1.
    const s1 = setupFor(8);
    place(s1.ships[1], 80, 45);
    place(s1.shots[1], 80, 45);
    stepMatch(s1, [controls(), controls()]);
    expect(s1.ships[1].score).toBe(1);

    // Seat 0 cannot dock with pod 1.
    const cross0 = setupFor(8);
    place(cross0.ships[0], 80, 45);
    place(cross0.shots[1], 80, 45);
    stepMatch(cross0, [controls(), controls()]);
    expect(cross0.ships[0].score).toBe(0);

    // Seat 1 cannot dock with pod 0.
    const cross1 = setupFor(8);
    place(cross1.ships[1], 80, 45);
    place(cross1.shots[0], 80, 45);
    stepMatch(cross1, [controls(), controls()]);
    expect(cross1.ships[1].score).toBe(0);
  });

  it('with a shared pod both seats dock with pod 0', () => {
    const s0 = setupFor(9);
    place(s0.ships[0], 80, 45);
    place(s0.shots[0], 80, 45);
    stepMatch(s0, [controls(), controls()]);
    expect(s0.ships[0].score).toBe(1);

    const s1 = setupFor(9);
    place(s1.ships[1], 80, 45);
    place(s1.shots[0], 80, 45);
    stepMatch(s1, [controls(), controls()]);
    expect(s1.ships[1].score).toBe(1);
  });

  it('in solo only seat 0 plays', () => {
    const match = setupFor(14);
    expect(match.ships[1].present).toBe(false);

    // Seat 1 never moves, even with thrust held.
    const s1 = match.ships[1];
    const x = s1.x;
    const y = s1.y;
    runTicks(match, 8, controls(), controls({ thrust: true }));
    expect(s1.x).toBe(x);
    expect(s1.y).toBe(y);
    expect(s1.score).toBe(0);

    // Seat 0 can dock with the pod.
    place(match.ships[0], 80, 45);
    place(match.shots[0], 80, 45);
    stepMatch(match, [controls(), controls()]);
    expect(match.ships[0].score).toBe(1);
  });

  it('thrust never runs out in docking', () => {
    const match = setupFor(8);
    const ship = match.ships[0];
    ship.heading = 0;

    runTicks(match, 400, controls({ thrust: true }), controls());

    expect(ship.fuel).toBe(0); // fuel is unused in docking
    expect(ship.thrusting).toBe(true);
    expect(ship.vx).toBeGreaterThan(0); // thrust kept accelerating
  });

  it('the beacon pulls ships and pods but harms nothing', () => {
    // A ship left of the beacon is pulled toward it on tick 1.
    const shipMatch = setupFor(10);
    place(shipMatch.ships[0], 60, 45);
    stepMatch(shipMatch, [controls(), controls()]);
    expect(shipMatch.ships[0].vx).toBeGreaterThan(0);

    // A pod is pulled too (body 2 is pulled on tick 5).
    const podMatch = setupFor(10);
    place(podMatch.shots[0], 60, 45);
    podMatch.shots[0].live = true;
    runTicks(podMatch, 5, controls(), controls());
    expect(podMatch.shots[0].vx).toBeGreaterThan(0);

    // Sitting on the beacon harms nothing: no spin, no score.
    const touch = setupFor(10);
    place(touch.ships[0], 80, 45);
    stepMatch(touch, [controls(), controls()]);
    expect(touch.ships[0].spin).toBe(0);
    expect(touch.ships[0].score).toBe(0);
    expect(touch.ships[1].score).toBe(0);
  });

  it('does not fire or cloak in docking', () => {
    const match = setupFor(8);
    const ship = match.ships[0];
    const shot = match.shots[0];

    stepMatch(match, [controls({ fire: true, cloak: true }), controls()]);

    expect(ship.cloaked).toBe(false);
    expect(shot.live).toBe(true); // still a pod, not turned into a missile
    expect(ship.ammo).toBe(0); // ammo is unused in docking
  });
});
