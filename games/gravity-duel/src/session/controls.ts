/**
 * Gravity Duel's controls on the collection's keyboards and pads.
 *
 * A lone player keeps the arrows, as the kit's rule says: seat 1 (blue,
 * bottom right) is flown by kit player 1 (the arrows side) and seat 0
 * (orange, top left) by kit player 2 (WASD); two people split the keyboard
 * the usual way, one lone player keeps the arrows whichever seat they fly.
 *
 * Classic plays the cartridge's own stick: left/right turn, up thrusts,
 * down (or a pad's B) cloaks, the fire button fires. Modern points where you
 * want to face instead: the stick or keys give a heading, and the hands
 * turn toward it the cartridge's own way (an instant first step, then one
 * every 8 ticks, since that cadence lives in the engine's own turning,
 * unchanged here) until they reach it or the stick lets go.
 *
 * A tap that came and went between two ticks still counts, by `heldOrTapped`.
 */
import {
  heldOrTapped,
  type Bindings,
  type InputController,
  type InputFrame,
  type Seat as PlayerSeat,
  type SeatFrame,
} from '@woodgrain-88/kit';
import { HEADINGS, type Controls, type Match, type Seat } from '../engine/types.ts';
import type { SeatDriver } from './match-session.ts';

export type ControlScheme = 'classic' | 'modern';

/** Which kit player's keys fly which engine seat, with two people at the keyboard. */
export const PLAYER_FOR_SEAT: Readonly<Record<Seat, PlayerSeat>> = { 0: 2, 1: 1 };
/** A lone player's keys, whichever seat they fly: the arrows. */
export const LONE_PLAYER: PlayerSeat = 1;

/**
 * Modern's own keys and pad buttons, beside the standard six: Left/Right Shift to thrust and
 * Q / Right Ctrl to cloak (seat 0 / seat 1) on the keyboard, A thrusts and Y cloaks on a pad, and
 * B fires in place of the pad's default A. The kit's binding table takes any action name, so
 * `thrust` and `cloak` ride beside `up`/`down`/`left`/`right`/`fire` without a kit change; `up`
 * and `down` still carry the direction Modern turns toward.
 */
export function modernBindings(base: Bindings): Bindings {
  return {
    1: {
      keys: { ...base[1].keys, thrust: ['ShiftRight'], cloak: ['ControlRight'] },
      pad: {
        ...base[1].pad,
        fire: [{ button: 1 }],
        thrust: [{ button: 0 }],
        cloak: [{ button: 3 }],
      },
    },
    2: {
      keys: { ...base[2].keys, thrust: ['ShiftLeft'], cloak: ['KeyQ'] },
      pad: {
        ...base[2].pad,
        fire: [{ button: 1 }],
        thrust: [{ button: 0 }],
        cloak: [{ button: 3 }],
      },
    },
  };
}

/** Classic's one addition: Right Ctrl beside Enter as kit player 1's fire key. */
export function classicBindings(base: Bindings): Bindings {
  return {
    ...base,
    1: {
      keys: { ...base[1].keys, fire: [...(base[1].keys.fire ?? []), 'ControlRight'] },
      pad: base[1].pad,
    },
  };
}

export interface PlayerControls {
  /** A person at the controls of one engine seat, on `scheme`, through kit player `player`. */
  driver(seat: Seat, player: PlayerSeat, scheme: ControlScheme): SeatDriver;
}

/**
 * The players' keys and pads, read once per tick however many seats use them: the kit's input
 * must be polled once per simulation step, or a tap would be seen twice or lost.
 */
export function createPlayerControls(input: InputController): PlayerControls {
  let frame: InputFrame | null = null;
  let polledAt = -1;
  const frameAt = (tick: number): InputFrame => {
    if (!frame || polledAt !== tick) {
      frame = input.poll();
      polledAt = tick;
    }
    return frame;
  };
  return {
    driver(seat, player, scheme) {
      return {
        controls(match: Readonly<Match>): Controls {
          const seatFrame = frameAt(match.tick).seats[player];
          return scheme === 'modern'
            ? modernControls(seatFrame, match.ships[seat].heading)
            : classicControls(seatFrame);
        },
      };
    },
  };
}

/** The cartridge's own stick: left/right turn, up thrusts, down or B cloaks, fire fires. */
function classicControls(frame: SeatFrame): Controls {
  return {
    left: heldOrTapped(frame, 'left'),
    right: heldOrTapped(frame, 'right'),
    thrust: heldOrTapped(frame, 'up'),
    cloak: heldOrTapped(frame, 'down') || heldOrTapped(frame, 'alt'),
    fire: heldOrTapped(frame, 'fire'),
  };
}

/** Points where you want to face: turn the short way toward the nearest heading, or coast there. */
function modernControls(frame: SeatFrame, heading: number): Controls {
  const wanted = nearestHeading(frame.axis.x, frame.axis.y);
  const { left, right } = turnToward(heading, wanted);
  return {
    left,
    right,
    thrust: heldOrTapped(frame, 'thrust'),
    cloak: heldOrTapped(frame, 'cloak'),
    fire: heldOrTapped(frame, 'fire'),
  };
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** The nearest of the 16 headings to a stick's direction; null when it is centred. */
function nearestHeading(axisX: number, axisY: number): number | null {
  if (axisX === 0 && axisY === 0) return null;
  const step = (2 * Math.PI) / HEADINGS;
  // The kit's axis points down the screen, so a heading's y flips to match (types.ts).
  return mod(Math.round(Math.atan2(-axisY, axisX) / step), HEADINGS);
}

/** Which way to turn, the short way round, from `current` toward `wanted`; neither once there. */
function turnToward(
  current: number,
  wanted: number | null,
): { readonly left: boolean; readonly right: boolean } {
  if (wanted === null || wanted === current) return { left: false, right: false };
  const shortWay = mod(wanted - current + HEADINGS / 2, HEADINGS) - HEADINGS / 2;
  return shortWay > 0 ? { left: true, right: false } : { left: false, right: true };
}
