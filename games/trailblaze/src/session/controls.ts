/**
 * Trailblaze's controls on the collection's eight-way sticks. The left rider
 * is steered from the left of the keyboard (WASD, Q E Z C for diagonals,
 * Space for gaps and erasing); the right rider from the right (the arrows,
 * the keypad's corners, Enter). That follows the kit's rule that a player
 * alone keeps the arrows: a lone player rides on the right, as the
 * cartridge's one-player games put the person on the right stick.
 *
 * A tap that came and went between two ticks still steers, and the engine
 * holds it until the next step, so no quick turn is ever lost.
 */
import {
  digitalStick,
  heldOrTapped,
  type InputController,
  type InputFrame,
  type Seat as PlayerSeat,
} from '@woodgrain-88/kit';
import type { Stick } from '../engine/types.ts';
import type { SeatDriver } from './match-session.ts';

/** Which player's keys drive which rider in a duel. */
export const PLAYER_FOR_RIDER: Readonly<Record<0 | 1, PlayerSeat>> = { 0: 2, 1: 1 };

/** The rider a lone player steers: the right one, on the arrow keys. */
export const LONE_PLAYER_RIDER: 0 | 1 = 1;

export interface PlayerControls {
  /** A person at the controls of one rider. */
  driver(player: PlayerSeat): SeatDriver;
}

/**
 * The players' keys and pads, read once per tick however many riders use them: the kit's input
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
    driver(player) {
      return {
        stick(match) {
          const seat = frameAt(match.tick).seats[player];
          const { east, south } = digitalStick(seat);
          return { east, south, fire: heldOrTapped(seat, 'fire') } satisfies Stick;
        },
      };
    },
  };
}
