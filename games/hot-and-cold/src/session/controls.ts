/**
 * Hot & Cold's keys on top of the collection's: the 1978 joystick had eight
 * directions, so each seat gains four diagonal keys beside its four (Q E Z C
 * around WASD; the keypad's corners for the arrows, whose 8 4 6 2 also walk).
 * Holding two directions at once steps diagonally as well. A key is added
 * only where nothing already uses it, so a player's own rebinding wins.
 */
import type { Bindings, Seat as PlayerSeat, SeatFrame } from '@woodgrain-88/kit';
import type { SeatInput } from '../engine/match.ts';

type Direction = -1 | 0 | 1;

const DIAGONALS: Readonly<Record<string, readonly [Direction, Direction]>> = {
  'up-left': [-1, -1],
  'up-right': [1, -1],
  'down-left': [-1, 1],
  'down-right': [1, 1],
};

const EXTRA_KEYS: Readonly<Record<PlayerSeat, Readonly<Record<string, readonly string[]>>>> = {
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

/** A stick pushed past this reads as a full push, as on the original's switches. */
const STICK_THRESHOLD = 0.4;

/** The player's bindings with the diagonals added wherever their keys are still free. */
export function withDiagonals(bindings: Bindings): Bindings {
  const taken = new Set<string>();
  for (const seat of [1, 2] as const) {
    for (const codes of Object.values(bindings[seat].keys))
      for (const code of codes) taken.add(code);
  }
  const extend = (seat: PlayerSeat): Bindings[PlayerSeat] => {
    const keys: Record<string, readonly string[]> = { ...bindings[seat].keys };
    for (const [action, codes] of Object.entries(EXTRA_KEYS[seat])) {
      const free = codes.filter((code) => !taken.has(code));
      if (free.length > 0) keys[action] = [...(keys[action] ?? []), ...free];
    }
    return { keys, pad: bindings[seat].pad };
  };
  return { 1: extend(1), 2: extend(2) };
}

function axisStep(value: number): Direction {
  if (value > STICK_THRESHOLD) return 1;
  if (value < -STICK_THRESHOLD) return -1;
  return 0;
}

/** What a seat holds this tick: the kit's axis points down the screen, as the field's rows do. */
export function seatInput(frame: SeatFrame): SeatInput {
  let east = axisStep(frame.axis.x);
  let south = axisStep(frame.axis.y);
  for (const [action, [x, y]] of Object.entries(DIAGONALS)) {
    if (!frame.held.has(action)) continue;
    east = x;
    south = y;
  }
  // A tap shorter than a tick still presses the button for one.
  const reveal = frame.held.has('fire') || frame.pressed.has('fire');
  return { east, south, reveal };
}

/** Whether the seat is steering with keys or a pad this tick, which takes over from the mouse. */
export function isSteering(input: SeatInput): boolean {
  return input.east !== 0 || input.south !== 0;
}
