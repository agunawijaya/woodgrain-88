/**
 * The shapes the engine, the renderers, the bots and the tests share.
 *
 * Time is counted in ticks of 20 ms, the 1977 cartridge's PAL frames, so every
 * duration is exact: a step every 15 ticks at the start of a round, down to 3
 * at top speed, and a crash pause of 240 ticks. The renderer only interpolates
 * between steps; it never decides anything.
 */
import type { SwitchPosition } from '@woodgrain-88/kit';

export const TICKS_PER_SECOND = 50;
export const COLUMNS = 40;
export const ROWS = 20;
export const CELL_COUNT = COLUMNS * ROWS;

/** A cell index, `row * COLUMNS + column`; row 0 is the top edge, column 0 the left. */
export type Cell = number;

/**
 * Seat 0 rides from the left of the arena, seat 1 from the right. Four Way adds seats 2 and 3 in
 * the other corners.
 */
export type Seat = 0 | 1 | 2 | 3;
/** The duel's two seats. */
export const SEATS: readonly Seat[] = [0, 1];
export const FOUR_WAY_SEATS: readonly Seat[] = [0, 1, 2, 3];

/** What a cell holds: nothing, the arena's border wall, or the trail of the seat that laid it. */
export const EMPTY = -1;
export const BORDER = -2;
export type CellContent = typeof EMPTY | typeof BORDER | Seat;

export type Heading =
  'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

/** What a seat holds this tick: a stick (or keys) and the fire button. */
export interface Stick {
  readonly east: -1 | 0 | 1;
  readonly south: -1 | 0 | 1;
  readonly fire: boolean;
}

export const IDLE: Stick = { east: 0, south: 0, fire: false };

/** One of the cartridge's 14 variations, as rule switches. */
export interface VariationRules {
  /** The cartridge's own number, 1–14. */
  readonly number: number;
  /** Variations 2 and 4 put the cartridge's computer on the left by default. */
  readonly opponent: 'person' | 'computer';
  /** Continuous riders score; free-draw cursors (13, 14) move only while the stick is held. */
  readonly motion: 'continuous' | 'free-draw';
  /** The step period falls 15 → 12 → 9 → 6 → 3 ticks, once every 256 ticks of a round. */
  readonly speedUp: boolean;
  readonly edges: 'bordered' | 'wraparound';
  readonly steering: 4 | 8;
  /** What holding fire does to the cell a rider leaves. */
  readonly fire: 'none' | 'gaps' | 'erase';
  /** Our Remix rules on top of the variation; absent on the cartridge's own channels. */
  readonly remix?: Remix;
}

/** The rules a Remix channel adds to a cartridge variation. Durations are in ticks. */
export interface Remix {
  /** Trails vanish this long after they are laid (Fading Trails). */
  readonly fadeAfter?: number;
  /** Trails stop being drawn this long after they are laid but stay solid (Ghost Trails). */
  readonly ghostAfter?: number;
  /** The border closes in one cell all round each time this much of a round has passed. */
  readonly shrinkEvery?: number;
  /** Floor cells where a rider steps twice as often (Boost Lanes). */
  readonly boostLanes?: readonly Cell[];
}

export interface MatchSetup {
  readonly rules: VariationRules;
  /** 1: seat 0 rides alone (micro-challenges, bots); 2: a duel; 4: Four Way. */
  readonly players: 1 | 2 | 4;
  /**
   * Each seat's difficulty switch, one per seat that rides: on B a straight reversal is ignored,
   * on A it goes through.
   */
  readonly switches: readonly SwitchPosition[];
  /** Points that win: 10 on the cartridge, 5 for a short match. */
  readonly target: number;
  /**
   * Seats steered at the instant of each step instead of by a stick: the cartridge's own
   * computer, which reads the board after the trails are laid and before anyone moves.
   */
  readonly pilots?: readonly (StepPilot | null)[];
}

/** Chooses a seat's heading at a step; the match applies it as if the stick had been pushed. */
export type StepPilot = (match: Readonly<Match>, seat: Seat) => Heading;

export interface Rider {
  cell: Cell;
  heading: Heading;
  /** The last direction pushed since the previous step, held until the next one. */
  latched: Heading | null;
  /** Fire as held on the latest tick. */
  fire: boolean;
  crashed: boolean;
  score: number;
}

export type Phase = 'running' | 'crash' | 'over';

export interface Match {
  readonly setup: MatchSetup;
  /** CELL_COUNT entries of CellContent. */
  readonly cells: Int8Array;
  /** The tick each trail cell was laid on (-1 when empty), for fading rules and fresh-wall effects. */
  readonly laidAt: Int32Array;
  /** One per seat that rides, and never fewer than two: riding alone keeps an idle seat 1. */
  readonly riders: readonly Rider[];
  phase: Phase;
  round: number;
  /** Ticks since the match started; never reset, the computer's tie-break reads it. */
  tick: number;
  /** Ticks since the current round's riders set off; the speed-up schedule counts these. */
  roundTick: number;
  /** Steps taken this round. */
  steps: number;
  /** Ticks between steps now: 15 at the start of every round. */
  stepPeriod: number;
  /** Ticks left until the next step. */
  untilStep: number;
  /** Ticks left of the crash pause, 0 outside it. */
  pauseTicks: number;
  /** Shrinking Arena: how many rings the border has closed in this round. */
  shrunk: number;
  /** The winner once the match is over; null for a 10–10 tie, a solo run or a doodle. */
  winner: Seat | null;
}

/** A trail cell laid as a rider left it: the heading it arrived on and the one it left by. */
export interface Laid {
  readonly cell: Cell;
  readonly seat: Seat;
  readonly entered: Heading;
  readonly left: Heading;
}

export interface Move {
  readonly seat: Seat;
  readonly from: Cell;
  readonly to: Cell;
  readonly heading: Heading;
  /** The move crossed an edge of a wraparound arena. */
  readonly wrapped: boolean;
  /**
   * Ticks until this rider moves again, for interpolation: the step period, or less for a rider on
   * a boost lane.
   */
  readonly ticks: number;
}

export interface Crash {
  readonly seat: Seat;
  readonly cell: Cell;
  /** What it rode into: the border, its own trail or the rival's. */
  readonly into: typeof BORDER | Seat;
}

export type MatchEvent =
  /** A fresh board: trails cleared, border rebuilt, riders at their start cells. */
  | { readonly type: 'round'; readonly round: number }
  | {
      readonly type: 'step';
      readonly laid: readonly Laid[];
      /** Cells that held a trail and were cleared this step (gaps, erasing). */
      readonly erased: readonly Cell[];
      readonly moves: readonly Move[];
      /** The step period the riders are moving at, for interpolation and the step tone. */
      readonly period: number;
    }
  | { readonly type: 'turn'; readonly seat: Seat; readonly from: Heading; readonly to: Heading }
  /** Shrinking Arena: a ring of cells, `ring` cells in from the edge, has become border wall. */
  | { readonly type: 'shrink'; readonly ring: number; readonly cells: readonly Cell[] }
  | { readonly type: 'speed'; readonly stage: number; readonly period: number }
  | { readonly type: 'crash'; readonly crashes: readonly Crash[] }
  | { readonly type: 'point'; readonly seat: Seat; readonly score: number }
  | {
      readonly type: 'over';
      readonly winner: Seat | null;
      readonly scores: readonly number[];
    };
