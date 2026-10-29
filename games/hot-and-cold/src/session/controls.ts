/**
 * Hot & Cold's controls: the collection's eight-way sticks (the kit's
 * diagonal keys beside WASD and the arrows), read as a step direction and the
 * reveal button.
 */
import { digitalStick, heldOrTapped, type SeatFrame } from '@woodgrain-88/kit';
import type { SeatInput } from '../engine/match.ts';

/** What a seat holds this tick. A tap shorter than a tick still presses the button for one. */
export function seatInput(frame: SeatFrame): SeatInput {
  const { east, south } = digitalStick(frame);
  return { east, south, reveal: heldOrTapped(frame, 'fire') };
}

/** Whether the seat is steering with keys or a pad this tick, which takes over from the mouse. */
export function isSteering(input: SeatInput): boolean {
  return input.east !== 0 || input.south !== 0;
}
