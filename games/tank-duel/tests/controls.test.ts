import { describe, expect, it } from 'vitest';
import { intentFor } from '../src/engine/controls.ts';
import type { StickInput } from '../src/engine/types.ts';

describe('controls', () => {
  describe('tanks', () => {
    it('drives forward when up is pressed and stops when down or neutral', () => {
      const up: StickInput = { x: 0, y: 1, fire: false };
      const down: StickInput = { x: 0, y: -1, fire: false };
      const neutral: StickInput = { x: 0, y: 0, fire: false };

      expect(intentFor(up, 'tank', false).throttle).toBe(1);
      expect(intentFor(down, 'tank', false).throttle).toBe(0);
      expect(intentFor(neutral, 'tank', false).throttle).toBe(0);
    });

    it('backs away on down only with the Reverse gear setting', () => {
      const down: StickInput = { x: 0, y: -1, fire: false };
      const up: StickInput = { x: 0, y: 1, fire: false };

      expect(intentFor(down, 'tank', false, true).throttle).toBe(-1);
      expect(intentFor(up, 'tank', false, true).throttle).toBe(1);
      expect(intentFor(down, 'tank', false, false).throttle).toBe(0);
    });

    it('turns left anticlockwise and right clockwise', () => {
      const left: StickInput = { x: -1, y: 0, fire: false };
      const right: StickInput = { x: 1, y: 0, fire: false };
      const center: StickInput = { x: 0, y: 0, fire: false };

      expect(intentFor(left, 'tank', false).turn).toBe(-1);
      expect(intentFor(right, 'tank', false).turn).toBe(1);
      expect(intentFor(center, 'tank', false).turn).toBe(0);
    });
  });

  describe('jets', () => {
    it('sets throttle: up fast, down slow, neutral cruise', () => {
      const up: StickInput = { x: 0, y: 1, fire: false };
      const down: StickInput = { x: 0, y: -1, fire: false };
      const neutral: StickInput = { x: 0, y: 0, fire: false };

      expect(intentFor(up, 'jet', false).throttle).toBe(1);
      expect(intentFor(down, 'jet', false).throttle).toBe(-1);
      expect(intentFor(neutral, 'jet', false).throttle).toBe(0);
    });

    it('turns on x axis: left anticlockwise, right clockwise', () => {
      const left: StickInput = { x: -1, y: 0, fire: false };
      const right: StickInput = { x: 1, y: 0, fire: false };

      expect(intentFor(left, 'jet', false).turn).toBe(-1);
      expect(intentFor(right, 'jet', false).turn).toBe(1);
    });
  });

  describe('biplanes standard', () => {
    it('behaves the same as jets when wiring is false', () => {
      const up: StickInput = { x: 0, y: 1, fire: false };
      const down: StickInput = { x: 0, y: -1, fire: false };
      const left: StickInput = { x: -1, y: 0, fire: false };
      const right: StickInput = { x: 1, y: 0, fire: false };

      expect(intentFor(up, 'biplane', false)).toEqual({ turn: 0, throttle: 1, fire: false });
      expect(intentFor(down, 'biplane', false)).toEqual({ turn: 0, throttle: -1, fire: false });
      expect(intentFor(left, 'biplane', false)).toEqual({ turn: -1, throttle: 0, fire: false });
      expect(intentFor(right, 'biplane', false)).toEqual({ turn: 1, throttle: 0, fire: false });
    });
  });

  describe('biplanes and bomber with wiring', () => {
    it('uses y to turn (up clockwise, down anticlockwise) and x for speed (right fast, left slow)', () => {
      for (const vehicle of ['biplane', 'bomber'] as const) {
        const up: StickInput = { x: 0, y: 1, fire: false };
        const down: StickInput = { x: 0, y: -1, fire: false };
        const right: StickInput = { x: 1, y: 0, fire: false };
        const left: StickInput = { x: -1, y: 0, fire: false };
        const neutral: StickInput = { x: 0, y: 0, fire: false };

        expect(intentFor(up, vehicle, true)).toEqual({ turn: 1, throttle: 0, fire: false });
        expect(intentFor(down, vehicle, true)).toEqual({ turn: -1, throttle: 0, fire: false });
        expect(intentFor(right, vehicle, true)).toEqual({ turn: 0, throttle: 1, fire: false });
        expect(intentFor(left, vehicle, true)).toEqual({ turn: 0, throttle: -1, fire: false });
        expect(intentFor(neutral, vehicle, true)).toEqual({ turn: 0, throttle: 0, fire: false });
      }
    });
  });

  describe('wiring immunity', () => {
    it('does not change tanks or jets when wiring is true', () => {
      const diagonal: StickInput = { x: 1, y: 1, fire: true };

      expect(intentFor(diagonal, 'tank', true)).toEqual(intentFor(diagonal, 'tank', false));
      expect(intentFor(diagonal, 'jet', true)).toEqual(intentFor(diagonal, 'jet', false));
    });
  });

  describe('fire button', () => {
    it('passes fire through unchanged', () => {
      const fireOn: StickInput = { x: 0, y: 0, fire: true };
      const fireOff: StickInput = { x: 0, y: 0, fire: false };

      expect(intentFor(fireOn, 'tank', false).fire).toBe(true);
      expect(intentFor(fireOff, 'tank', false).fire).toBe(false);
      expect(intentFor(fireOn, 'biplane', true).fire).toBe(true);
      expect(intentFor(fireOff, 'biplane', true).fire).toBe(false);
    });
  });
});
