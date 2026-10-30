/**
 * A look is one complete way of showing the duel: the Neon Grid, Toy Trains,
 * Mummy's Wrap or the Ice Trail. Looks change only what you see and hear. The
 * 40 × 20 grid, the start cells and the step timing are the same in all four,
 * so cell (column, row) sits at the same spot on the table in every look and
 * the engine, the inputs and the tests never need to know which one is
 * showing.
 *
 * The match drives a look through a trail view: it hands over each step's
 * laid cells and moves, the crashes and the trap closing. The view owns its
 * models and effects and nothing else; it never decides anything.
 */
import type { FinishOptions, LightMood, Quality, Stage, TableFraming } from '@woodgrain-88/arena';
import type { Appearance, Rng } from '@woodgrain-88/kit';
import type { Group, Vector3 } from 'three';
import type { Cell, Crash, Heading, Laid, Move, Remix, Seat } from '../engine/types.ts';

export type LookId = 'neon' | 'trains' | 'mummy' | 'ice';

export interface SeatColours {
  /** The seat's own colour on its rider and trail. */
  readonly main: string;
  /** A deeper shade of it, for shading and text on light grounds. */
  readonly deep: string;
}

export interface ViewOptions {
  readonly stage: Stage;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly rng: Rng;
  /** Each seat's colours: two for a duel, four for Four Way. */
  readonly seats: readonly SeatColours[];
  /** Seats on the board: 1 when seat 0 rides alone, 4 in Four Way. */
  readonly players: 1 | 2 | 4;
  /** Reduced effects (a setting, and always with reduced motion): the moments without the spectacle. */
  readonly reducedEffects: boolean;
}

export interface TrailView {
  readonly root: Group;
  /** A fresh round: every trail goes, and the border stands only round a bordered arena. */
  reset(edges: 'bordered' | 'wraparound'): void;
  /** Puts a rider in the middle of its cell at once, where the rules have it. */
  placeRider(seat: Seat, cell: Cell, heading: Heading): void;
  /** One step: the cells laid and erased, and each rider gliding to its next cell over `seconds`. */
  step(
    laid: readonly Laid[],
    erased: readonly Cell[],
    moves: readonly Move[],
    seconds: number,
  ): void;
  /**
   * The heading the rules will step this rider on next, as queued now: the picture starts the
   * turn at once instead of after the step. Without it the rider glides straight on.
   */
  steer(seat: Seat, heading: Heading): void;
  /** Speed-up stage 0 (the start) to 4 (top speed). */
  setSpeedStage(stage: number): void;
  crash(crash: Crash): void;
  /** The signature moment: the last gap seals at `seal` and `seat` is shut into `pocket`. */
  trap(seat: Seat, pocket: readonly Cell[], seal: Cell): void;
  /** The match is decided: everything stops where it is, as the cartridge froze on the last point. */
  freeze(): void;
  /**
   * The channel's Remix rules, before the first round: Ghost Trails hides trail from sight after a
   * while, Boost Lanes draws its lanes. Undefined for the cartridge's own channels.
   */
  setRemix(remix: Remix | undefined): void;
  /** Shrinking Arena: a ring of cells has become wall. */
  shrink(cells: readonly Cell[]): void;
  /** Where the rider is drawn now, the board's centre at the origin; for the Chase camera. */
  riderPosition(seat: Seat, target: Vector3): Vector3;
  update(dt: number): void;
  dispose(): void;
}

export interface LookDefinition {
  readonly id: LookId;
  readonly name: string;
  /** The two riders' names, seat 1's first; Four Way's corners ride the same two builds. */
  readonly riders: readonly [string, string];
  /** How a card says who rides what: "Rides Lancer", "Skates as Juniper". */
  readonly ridesAs: string;
  readonly framing: TableFraming;
  readonly mood?: LightMood;
  readonly finish?: FinishOptions;
  readonly reflections?: Partial<Record<Appearance, number>>;
  readonly exposure?: Partial<Record<Appearance, number>>;
  /** What shows behind everything, before the look's own backdrop. */
  background(appearance: Appearance): string;
  createView(options: ViewOptions): TrailView;
}

/** A seat's colours; every view is given colours for every seat that rides. */
export function coloursOf(seats: readonly SeatColours[], seat: Seat): SeatColours {
  const colours = seats[seat];
  if (!colours) throw new Error(`no colours for seat ${String(seat)}`);
  return colours;
}

/** Whoever shut `seat` in: the other rider in a duel. In Four Way it could be anyone, so silver. */
export function rivalColours(seats: readonly SeatColours[], seat: Seat): SeatColours {
  if (seats.length === 2) return coloursOf(seats, seat === 0 ? 1 : 0);
  return FOUR_WAY_SEALER;
}

const FOUR_WAY_SEALER: SeatColours = { main: '#e8ecf2', deep: '#8a93a3' };
