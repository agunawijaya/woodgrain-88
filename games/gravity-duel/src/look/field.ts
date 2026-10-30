/**
 * Where the playfield sits on the table, the same in every look. The cartridge
 * draws a field 160 steps wide and 90 tall; on the table it is 32 by 18
 * units, centred on the origin, x to the right and z toward the viewer, so the
 * star sits at the origin and one unit is five of the cartridge's steps.
 */
export const FIELD_WIDTH = 32;
export const FIELD_DEPTH = 18;
export const HALF_WIDTH = FIELD_WIDTH / 2;
export const HALF_DEPTH = FIELD_DEPTH / 2;

/** The cartridge's own field, in its steps. */
export const CARTRIDGE_WIDTH = 160;
export const CARTRIDGE_HEIGHT = 90;

/** How long a ship is drawn, in units: about a sixteenth of the field, readable from overhead. */
export const SHIP_LENGTH = 2.2;

/**
 * The unit vector a heading points along on the table. Headings are radians, counter-clockwise
 * from +x seen from above, which is also the yaw that turns a model built facing +x to face them.
 */
export function headingVector(heading: number): { readonly x: number; readonly z: number } {
  return { x: Math.cos(heading), z: -Math.sin(heading) };
}
