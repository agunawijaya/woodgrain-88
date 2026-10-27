/**
 * Camera shake from "trauma": each explosion adds some, it drains away over
 * time, and the shake grows with its square, so small knocks barely register
 * while a kill rattles the table. The motion is smooth noise rather than
 * random jumps, which reads as a physical knock instead of a glitch. Turned
 * off by the player's setting or by reduced motion.
 */
import type { ShakeOffset } from './stage.ts';

export interface CameraShake {
  /** Adds trauma in [0, 1]; the total is capped at 1. */
  addTrauma(amount: number): void;
  update(dt: number): ShakeOffset;
  setEnabled(enabled: boolean): void;
  readonly trauma: number;
}

export interface ShakeOptions {
  /** Largest offset in world units, at full trauma. */
  readonly maxOffset: number;
  /** Largest roll in radians, at full trauma. */
  readonly maxRoll: number;
  /** Trauma drained per second. */
  readonly recovery: number;
  readonly enabled: boolean;
}

const STILL: ShakeOffset = { x: 0, y: 0, roll: 0 };

export function createCameraShake(options: ShakeOptions): CameraShake {
  let trauma = 0;
  let time = 0;
  let enabled = options.enabled;

  return {
    get trauma() {
      return trauma;
    },
    addTrauma(amount) {
      if (!enabled) return;
      trauma = Math.min(1, trauma + Math.max(0, amount));
    },
    update(dt) {
      time += dt;
      trauma = Math.max(0, trauma - options.recovery * dt);
      if (!enabled || trauma === 0) return STILL;
      const strength = trauma * trauma;
      return {
        x: options.maxOffset * strength * wobble(time, 0),
        y: options.maxOffset * strength * wobble(time, 1),
        roll: options.maxRoll * strength * wobble(time, 2),
      };
    },
    setEnabled(next) {
      enabled = next;
      if (!next) trauma = 0;
    },
  };
}

/** Smooth noise in [-1, 1]: three sines at unrelated frequencies per channel. */
function wobble(time: number, channel: number): number {
  const phase = channel * 1.913;
  return (
    0.5 * Math.sin(time * 31.7 + phase) +
    0.3 * Math.sin(time * 53.3 + phase * 2.3) +
    0.2 * Math.sin(time * 79.1 + phase * 3.7)
  );
}
