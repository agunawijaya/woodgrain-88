/**
 * What the power switch steps through. The Counter has 32 places like the
 * 1988 cartridge: 1–30 are our games, 31 and 32 belong to the two hidden
 * reskins and stay locked (the TV shows a scrambled channel) until found.
 * Flipping past 32 wraps to 1, and backwards past 1 wraps to 32.
 */
export const COUNTER_SLOTS = 32;
export const GAME_SLOTS = 30;
export const SECRET_SLOTS = [31, 32] as const;
export type SecretSlot = (typeof SECRET_SLOTS)[number];

export type Direction = 1 | -1;

export function isSecretSlot(slot: number): slot is SecretSlot {
  return slot === 31 || slot === 32;
}

/** The slot one power cycle away from `current`, wrapping around all 32 places. */
export function nextSlot(current: number, direction: Direction): number {
  return ((current - 1 + direction + COUNTER_SLOTS) % COUNTER_SLOTS) + 1;
}

/** Slots visited by `count` flips from `start`, not including `start`. */
export function cycleSlots(start: number, direction: Direction, count: number): number[] {
  const visited: number[] = [];
  let slot = start;
  for (let i = 0; i < count; i++) {
    slot = nextSlot(slot, direction);
    visited.push(slot);
  }
  return visited;
}

/** "07": the Counter always shows two digits. */
export function counterDigits(slot: number): string {
  return String(slot).padStart(2, '0');
}
