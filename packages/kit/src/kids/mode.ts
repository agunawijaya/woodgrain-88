/**
 * The Den's Kid setting, as it shows up in share lines and records: nothing
 * extra for the default Human Kids, a mark for Sharp ones.
 */
import type { MemoryMode } from './memory.ts';

/** What a share line or a record says about the Kids, or nothing for human ones. */
export const SHARP_KIDS_MARK = 'Sharp Kids';

/** A share line with " · Sharp Kids" on the end when the Kids were sharp; unchanged otherwise. */
export function withKidsMark(line: string, kids: MemoryMode | undefined): string {
  return kids === 'sharp' ? `${line} · ${SHARP_KIDS_MARK}` : line;
}

/** One line for the Den's settings: what Sharp changes. */
export const SHARP_KIDS_NOTE =
  'Sharp Kids remember everything, never fumble and react twice as fast.';
