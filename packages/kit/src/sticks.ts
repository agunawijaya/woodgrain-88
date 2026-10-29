/**
 * Eight-way sticks on a keyboard. The old joysticks had eight directions, so
 * a game that steers on a grid gives each seat four diagonal keys beside its
 * four: Q E Z C round WASD, and the keypad's corners for the arrows, whose
 * 8 4 6 2 also steer. Holding two directions at once works as well. A key is
 * added only where nothing already uses it, so a player's own rebinding wins.
 *
 * `digitalStick` reads a seat's frame as a stick with three positions per
 * axis, as the original's switches had: keys, the d-pad, or an analogue
 * stick pushed far enough.
 */
import type { Action, Bindings, Seat, SeatFrame } from './input.ts';

export type StickStep = -1 | 0 | 1;

export interface DigitalStick {
  readonly east: StickStep;
  readonly south: StickStep;
}

const DIAGONALS: Readonly<Record<string, readonly [StickStep, StickStep]>> = {
  'up-left': [-1, -1],
  'up-right': [1, -1],
  'down-left': [-1, 1],
  'down-right': [1, 1],
};

const DIAGONAL_KEYS: Readonly<Record<Seat, Readonly<Record<string, readonly string[]>>>> = {
  1: {
    up: ['Numpad8'],
    down: ['Numpad2'],
    left: ['Numpad4'],
    right: ['Numpad6'],
    'up-left': ['Numpad7'],
    'up-right': ['Numpad9'],
    'down-left': ['Numpad1'],
    'down-right': ['Numpad3'],
  },
  2: {
    'up-left': ['KeyQ'],
    'up-right': ['KeyE'],
    'down-left': ['KeyZ'],
    'down-right': ['KeyC'],
  },
};

/** An analogue stick pushed past this reads as a full push. */
const STICK_THRESHOLD = 0.4;

/** The player's bindings with the diagonal keys added wherever their keys are still free. */
export function withDiagonalKeys(bindings: Bindings): Bindings {
  const taken = new Set<string>();
  for (const seat of [1, 2] as const) {
    for (const codes of Object.values(bindings[seat].keys))
      for (const code of codes) taken.add(code);
  }
  const extend = (seat: Seat): Bindings[Seat] => {
    const keys: Record<string, readonly string[]> = { ...bindings[seat].keys };
    for (const [action, codes] of Object.entries(DIAGONAL_KEYS[seat])) {
      const free = codes.filter((code) => !taken.has(code));
      if (free.length > 0) keys[action] = [...(keys[action] ?? []), ...free];
    }
    return { keys, pad: bindings[seat].pad };
  };
  return { 1: extend(1), 2: extend(2) };
}

function axisStep(value: number): StickStep {
  if (value > STICK_THRESHOLD) return 1;
  if (value < -STICK_THRESHOLD) return -1;
  return 0;
}

/** A seat's direction this tick; the kit's axis points down the screen, as grid rows do. */
export function digitalStick(frame: SeatFrame): DigitalStick {
  let east = axisStep(frame.axis.x);
  let south = axisStep(frame.axis.y);
  for (const [action, [x, y]] of Object.entries(DIAGONALS)) {
    if (!frame.held.has(action)) continue;
    east = x;
    south = y;
  }
  return { east, south };
}

/** Whether a button counts as down this tick: held, or tapped and let go within the tick. */
export function heldOrTapped(frame: SeatFrame, action: Action): boolean {
  return frame.held.has(action) || frame.pressed.has(action);
}
