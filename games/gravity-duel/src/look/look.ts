/**
 * A look is one complete way of showing the duel: Deep Space, the Brass
 * Orrery, Paper Sky or the Whirlpool. Looks change only what you see and hear;
 * the field, the physics and every timing are the same in all four, so a ship
 * at (x, z) sits at the same spot on the table in every look.
 *
 * The match drives a look through a space view: each frame it hands over where
 * the ships and missiles are, and it calls the moments (a hit, a dock, a
 * swallow). The view owns its models and effects and decides nothing.
 */
import type { FinishOptions, LightMood, Quality, Stage, TableFraming } from '@woodgrain-88/arena';
import type { Appearance, Rng } from '@woodgrain-88/kit';
import type { Group, Vector3 } from 'three';

export type LookId = 'deep' | 'brass' | 'paper' | 'whirl';

export type Seat = 0 | 1;

export interface SeatColours {
  /** The seat's own colour on its ship, its missiles and its bars. */
  readonly main: string;
  /** A deeper shade of it, for shading and for lines on light grounds. */
  readonly deep: string;
}

/** What sits in the middle of the field, if anything. */
export type CentreKind = 'star' | 'starbase' | 'beacon' | null;

export type Edges = 'wrap' | 'bounce';

export interface ShipPose {
  readonly x: number;
  readonly z: number;
  /** Radians, counter-clockwise from +x seen from above. */
  readonly heading: number;
  readonly thrusting: boolean;
  /** 0 fully seen, 1 fully cloaked; between while the cloak shimmers on or off. */
  readonly cloak: number;
}

export interface MissilePose {
  readonly x: number;
  readonly z: number;
  /** The way it travels, radians as for ships. */
  readonly heading: number;
}

/** A docking pod drifting on the field. */
export interface PodPose {
  readonly x: number;
  readonly z: number;
  /** Radians it has tumbled since the match began; the looks turn their pods by it. */
  readonly tumble: number;
}

/** A point on the table. */
export interface TablePoint {
  readonly x: number;
  readonly z: number;
}

/**
 * The trajectory guide, for a seat that has it on: where its ship will drift if it lets go, and
 * where a missile fired now would fly.
 */
export interface GuidePose {
  readonly ship: readonly TablePoint[];
  readonly missile: readonly TablePoint[];
}

/** The Remix channels' own bodies, where they are now; absent on the cartridge's channels. */
export interface RemixPose {
  /** Binary Stars: the two stars, each with its radius in table units. */
  readonly stars?: readonly (TablePoint & { readonly radius: number })[];
  /** Comet: where it is and which way it travels (radians as for ships), or null between passes. */
  readonly comet?: (TablePoint & { readonly heading: number }) | null;
  /** Asteroid Belt: the rocks, each with its radius in table units. */
  readonly rocks?: readonly (TablePoint & { readonly radius: number })[];
}

/**
 * One picture of the field: per seat a ship (null when it is not on the field), a missile, and in
 * docking a pod (pod 0 is seat 0's, or the shared one); per seat a guide when it is shown; and
 * the Remix bodies on a Remix channel.
 */
export interface SceneFrame {
  readonly ships: readonly (ShipPose | null)[];
  readonly missiles: readonly (MissilePose | null)[];
  readonly pods: readonly (PodPose | null)[];
  readonly guides?: readonly (GuidePose | null)[];
  readonly remix?: RemixPose;
}

/**
 * A moment the match calls out, at a spot on the table. `seat` is the ship it happened to (for a
 * hit, the victim; for `fired`, `swallowed` and `docked`, the seat whose missile or dock it was).
 */
export interface ViewMoment {
  readonly kind:
    'fired' | 'hit' | 'self-hit' | 'star-crash' | 'burnout' | 'swallowed' | 'refuelled' | 'docked';
  readonly seat: Seat;
  readonly at: Vector3;
}

/** The moments that blow a ship up: the burst, then the cartridge's 64-frame spin. */
export const EXPLOSIONS: ReadonlySet<ViewMoment['kind']> = new Set([
  'hit',
  'self-hit',
  'star-crash',
  'burnout',
]);

export interface ViewOptions {
  readonly stage: Stage;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly rng: Rng;
  readonly seats: readonly SeatColours[];
  readonly centre: CentreKind;
  readonly edges: Edges;
  /** Docking pods on the field: none in a duel, one shared, or one per seat. */
  readonly pods: 'none' | 'shared' | 'own';
  /** The Remix channel's rules, when it is one: the look draws its extra bodies. */
  readonly remix?: 'binary-stars' | 'comet' | 'asteroid-belt' | 'last-fuel';
  /** Reduced effects (a setting, and always with reduced motion): the moments without the spectacle. */
  readonly reducedEffects: boolean;
}

export interface SpaceView {
  readonly root: Group;
  /** Where everything is now. Called every frame; missing missiles end their trails. */
  show(frame: SceneFrame): void;
  /** A moment of the match: explosions burst and set the ship spinning for its 64 frames. */
  moment(moment: ViewMoment): void;
  update(dt: number, clock: number): void;
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
  /** What shows behind everything, before the look's own backdrop. */
  background(appearance: Appearance): string;
  createView(options: ViewOptions): SpaceView;
}
