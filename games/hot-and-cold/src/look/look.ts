/**
 * A look is one complete way of showing the field: the Polar Expedition, the
 * Tabletop Board or the Radar Room. Looks change only what you see and hear;
 * the rules, the timing and the 9 × 7 geometry are the same in all three, so
 * every look places square (column, row) at the same spot on the table and
 * the inputs and tests never need to know which one is showing.
 *
 * The match drives a look through a field view: it places and walks the
 * explorers, reveals and hides clues, and plays the two big moments, a bomb
 * and a capture. The view owns its models and effects and nothing else; it
 * never decides anything.
 */
import type { FinishOptions, LightMood, Quality, Stage, TableFraming } from '@woodgrain-88/arena';
import type { Appearance, Rng } from '@woodgrain-88/kit';
import type { Group } from 'three';
import type { Clue } from '../engine/board.ts';
import type { Square } from '../engine/grid.ts';
import type { HeatPalette } from './heat.ts';

export type LookId = 'polar' | 'tabletop' | 'radar';
export type Seat = 0 | 1;

export interface SeatColours {
  /** The seat's own colour on its explorer, pawn or blip. */
  readonly main: string;
  /** A deeper shade of it, for shading and text on light grounds. */
  readonly deep: string;
}

export interface ViewOptions {
  readonly stage: Stage;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly rng: Rng;
  readonly seats: readonly [SeatColours, SeatColours];
  /** Seats that take part; a solo round hides seat 2. */
  readonly players: 1 | 2;
  /** Reduced effects (a setting, and always with reduced motion): the moments without the spectacle. */
  readonly reducedEffects: boolean;
  /** The numerals' warm-to-cool ramp, or the colour-blind-safe one. */
  readonly cluePalette: HeatPalette;
}

export interface RevealOptions {
  /** Notebook clues stay on the field; Classic Memory clues show only while reveal is held. */
  readonly keep: boolean;
}

export interface FieldView {
  readonly root: Group;
  /** A new field: every clue and mark goes, the snow, tiles or plot are fresh. */
  reset(): void;
  /** Which seats are on the field this round; the others are hidden. */
  setPlaying(seats: readonly Seat[]): void;
  /** Puts an explorer on a square at once: the start of a round, or a hero scene's setup. */
  placeExplorer(seat: Seat, square: Square): void;
  /** One step to a neighbouring square (wrapping round an edge included), taking `seconds`. */
  walk(seat: Seat, from: Square, to: Square, seconds: number): void;
  /** A step the other explorer was in the way of: a bump towards it, and no move. */
  nudge(seat: Seat, toward: Square): void;
  /** The explorer checks the square it stands on and the clue shows. */
  reveal(seat: Seat, square: Square, clue: Clue, options: RevealOptions): void;
  /** A Classic Memory clue vanishes when reveal is let go. */
  conceal(square: Square): void;
  /** A bomb goes off under the explorer. */
  blast(seat: Seat, square: Square): void;
  /** After the blast: back to its home square, or staying put (null) when home is taken. */
  sendHome(seat: Seat, to: Square | null): void;
  /** The flag is found: it rises from its square and the look celebrates. */
  capture(seat: Seat, square: Square): void;
  /** Time or checks ran out: the flag shows where it was, quietly, with no celebration. */
  showFlag(square: Square): void;
  /** The possibility fog: squares marked false dim; null clears it. */
  setFog(possible: readonly boolean[] | null): void;
  update(dt: number): void;
  /** Writes pending marks (footprints, scorches) into their textures; call before each render. */
  flush(): void;
  dispose(): void;
}

export interface LookDefinition {
  readonly id: LookId;
  readonly name: string;
  readonly framing: TableFraming;
  readonly mood?: LightMood;
  readonly finish?: FinishOptions;
  readonly reflections?: Partial<Record<Appearance, number>>;
  readonly exposure?: Partial<Record<Appearance, number>>;
  /** Height of the field's surface, for turning a pointer into a square. */
  readonly fieldHeight: number;
  /** What shows behind everything, before the look's own backdrop. */
  background(appearance: Appearance): string;
  createView(options: ViewOptions): FieldView;
}
