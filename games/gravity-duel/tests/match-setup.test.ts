/**
 * Tests for what createMatch lays out before a single tick: the start spots,
 * the per-mode resources, the pods and their seeded velocities, and the clock.
 */
import { describe, expect, it } from 'vitest';
import { START_SPOTS } from '../src/engine/match.ts';
import {
  AMMO_SEGMENTS,
  BURNS_PER_SEGMENT,
  CARTRIDGE_MATCH_TICKS,
  CENTRE_Y,
  FINE_PER_UNIT,
  FUEL_SEGMENTS,
  SUBPIXELS,
} from '../src/engine/types.ts';
import { setupFor } from './helpers.ts';

describe('match setup', () => {
  it('puts each ship at its start spot, at rest, facing its heading', () => {
    expect(START_SPOTS[0]).toEqual({ x: 30 * SUBPIXELS, y: 20 * SUBPIXELS, heading: 0 });
    expect(START_SPOTS[1]).toEqual({ x: 130 * SUBPIXELS, y: 70 * SUBPIXELS, heading: 8 });

    const match = setupFor(1);
    const [s0, s1] = match.ships;
    expect(s0.x).toBe(START_SPOTS[0].x);
    expect(s0.y).toBe(START_SPOTS[0].y);
    expect(s0.heading).toBe(0);
    expect(s0.vx).toBe(0);
    expect(s0.vy).toBe(0);
    expect(s1.x).toBe(START_SPOTS[1].x);
    expect(s1.y).toBe(START_SPOTS[1].y);
    expect(s1.heading).toBe(8);
    expect(s1.vx).toBe(0);
    expect(s1.vy).toBe(0);
  });

  it('starts each ship with a clean slate', () => {
    const match = setupFor(1);
    for (const ship of match.ships) {
      expect(ship.prevX).toBe(ship.x);
      expect(ship.prevY).toBe(ship.y);
      expect(ship.wrapped).toBe(false);
      expect(ship.turnWait).toBe(0);
      expect(ship.burnsLeft).toBe(BURNS_PER_SEGMENT - 1);
      expect(ship.cloaked).toBe(false);
      expect(ship.cloakHeld).toBe(false);
      expect(ship.spin).toBe(0);
      expect(ship.thrusting).toBe(false);
      expect(ship.dockCooldown).toBe(0);
      expect(ship.score).toBe(0);
    }
  });

  it('starts duels with full fuel and ammo, and docking with none', () => {
    const duel = setupFor(1);
    expect(duel.ships[0].fuel).toBe(FUEL_SEGMENTS);
    expect(duel.ships[0].ammo).toBe(AMMO_SEGMENTS);
    expect(duel.ships[1].fuel).toBe(FUEL_SEGMENTS);
    expect(duel.ships[1].ammo).toBe(AMMO_SEGMENTS);

    const docking = setupFor(8);
    expect(docking.ships[0].fuel).toBe(0);
    expect(docking.ships[0].ammo).toBe(0);
    expect(docking.ships[1].fuel).toBe(0);
    expect(docking.ships[1].ammo).toBe(0);
  });

  it('marks seat 1 absent in solo docking and present everywhere else', () => {
    const solo = setupFor(14);
    expect(solo.ships[0].present).toBe(true);
    expect(solo.ships[1].present).toBe(false);

    const race = setupFor(8);
    expect(race.ships[0].present).toBe(true);
    expect(race.ships[1].present).toBe(true);

    const duel = setupFor(1);
    expect(duel.ships[0].present).toBe(true);
    expect(duel.ships[1].present).toBe(true);
  });

  it('launches pod 0 in every docking variation and pod 1 only with own pods', () => {
    const own = setupFor(8);
    expect(own.shots[0].live).toBe(true);
    expect(own.shots[1].live).toBe(true);

    const shared = setupFor(9);
    expect(shared.shots[0].live).toBe(true);
    expect(shared.shots[1].live).toBe(false);

    const solo = setupFor(14);
    expect(solo.shots[0].live).toBe(true);
    expect(solo.shots[1].live).toBe(false);

    const duel = setupFor(1);
    expect(duel.shots[0].live).toBe(false);
    expect(duel.shots[1].live).toBe(false);
  });

  it('leaves each pod at mid-height under its ship', () => {
    const match = setupFor(8);
    expect(match.shots[0].x).toBe(match.ships[0].x);
    expect(match.shots[0].y).toBe(CENTRE_Y);
    expect(match.shots[1].x).toBe(match.ships[1].x);
    expect(match.shots[1].y).toBe(CENTRE_Y);
  });

  it('gives each pod an axis speed of 2 to 14 whole units, never zero', () => {
    for (const n of [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
      for (let seed = 0; seed < 20; seed++) {
        const match = setupFor(n, { seed });
        for (const shot of match.shots) {
          if (!shot.live) continue;
          const vx = shot.vx / FINE_PER_UNIT;
          const vy = shot.vy / FINE_PER_UNIT;
          expect(Math.abs(vx)).toBeGreaterThanOrEqual(2);
          expect(Math.abs(vx)).toBeLessThanOrEqual(14);
          expect(Math.abs(vy)).toBeGreaterThanOrEqual(2);
          expect(Math.abs(vy)).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('mirrors pod 1 horizontally off pod 0 with own pods', () => {
    const match = setupFor(8);
    expect(match.shots[1].vx).toBe(-match.shots[0].vx);
    expect(match.shots[1].vy).toBe(match.shots[0].vy);
  });

  it('gives the same pods for the same seed', () => {
    const a = setupFor(8, { seed: 42 });
    const b = setupFor(8, { seed: 42 });
    expect(a.shots[0].vx).toBe(b.shots[0].vx);
    expect(a.shots[0].vy).toBe(b.shots[0].vy);
    expect(a.shots[1].vx).toBe(b.shots[1].vx);
    expect(a.shots[1].vy).toBe(b.shots[1].vy);
  });

  it('usually gives different pods for a different seed', () => {
    const base = setupFor(8, { seed: 1 });
    let different = false;
    for (let seed = 2; seed <= 8; seed++) {
      const other = setupFor(8, { seed });
      if (other.shots[0].vx !== base.shots[0].vx || other.shots[0].vy !== base.shots[0].vy) {
        different = true;
      }
    }
    expect(different).toBe(true);
  });

  it('starts the clock full and the match playing with no winner', () => {
    const match = setupFor(1);
    expect(match.clockLeft).toBe(CARTRIDGE_MATCH_TICKS);
    expect(match.tick).toBe(0);
    expect(match.phase).toBe('playing');
    expect(match.winner).toBeNull();
    expect(match.events).toEqual([]);
  });
});
