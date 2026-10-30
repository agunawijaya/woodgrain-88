/**
 * The shapes the engine, the Kids, the looks and the tests share, and the
 * cartridge's numbers.
 *
 * Everything runs in ticks of 20 ms, the 1978 cartridge's PAL frames, and in
 * whole numbers, as the cartridge did:
 * - Positions are in subpixels, 256 to a step of the 160 × 90 field.
 * - Velocities are in fine units: 256 make one speed unit, and one speed unit
 *   is a sixteenth of a step per tick. A body moves `velocity >> 4` subpixels
 *   a tick, so top speed (63 units) is just under 4 steps a tick.
 * - Headings are 16 steps of 22.5°: 0 faces right, 4 up, 8 left, 12 down;
 *   turning left counts up.
 *
 * The field's y runs down the screen, as the cartridge's did. The looks map a
 * step to a fifth of a table unit (look/field.ts).
 */
import type { Rng, SwitchPosition } from '@woodgrain-88/kit';

export const TICKS_PER_SECOND = 50;

export const FIELD_WIDTH = 160;
export const FIELD_HEIGHT = 90;
export const SUBPIXELS = 256;
/** Fine units in one speed unit (a sixteenth of a step per tick). */
export const FINE_PER_UNIT = 256;

/** The middle of the field, where the star, the starbase or the beacon sits, in subpixels. */
export const CENTRE_X = (FIELD_WIDTH / 2) * SUBPIXELS;
export const CENTRE_Y = (FIELD_HEIGHT / 2) * SUBPIXELS;

export const HEADINGS = 16;
/** A held turn repeats every this many ticks; the first step is immediate. */
export const TURN_REPEAT_TICKS = 8;
/** Thrust is applied on every tick divisible by this. */
export const THRUST_EVERY = 4;
/** Fine units a thrust adds along the heading at full strength (the axis-aligned headings). */
export const THRUST_FINE = 72;
/** The fastest a body moves along each axis, in speed units; beyond it the speed folds back. */
export const TOP_SPEED_UNITS = 63;

export const FUEL_SEGMENTS = 8;
export const AMMO_SEGMENTS = 8;
/** Burns (one per thrust, or one every THRUST_EVERY ticks cloaked) that empty one fuel segment. */
export const BURNS_PER_SEGMENT = 256;

/** Ticks from firing until a ship may fire again, whether or not the missile is still flying. */
export const MISSILE_LIFE = 128;
/** A missile cannot touch its own ship for this many ticks after leaving it. */
export const SELF_HIT_GRACE = 8;
/** Ticks a hit ship spins (one heading step a tick) and cannot be scored on again. */
export const SPIN_TICKS = 64;

/** Each of the four bodies is pulled toward the middle once every this many ticks. */
export const GRAVITY_EVERY = 8;

/** Ticks after a dock before the same ship can dock again. */
export const DOCK_COOLDOWN = 128;

/** The cartridge's match clock: 140 blocks of 256 ticks, just under 12 minutes. */
export const CARTRIDGE_MATCH_TICKS = 35_840;
/** Our Short match: 4 minutes. */
export const SHORT_MATCH_TICKS = 12_000;
/** The score blinks for the clock's last this many ticks. */
export const CLOCK_WARNING_TICKS = 1_024;
export const CARTRIDGE_TARGET = 10;
export const SHORT_TARGET = 5;

/**
 * Touching distances, in steps. The cartridge tested its sprites' pixels against each other; we
 * test circles, sized to the ships and the star as the looks draw them (CHANGES-FROM-ORIGINAL.md).
 */
export const SHIP_RADIUS = 4;
export const MISSILE_RADIUS = 1;
export const POD_RADIUS = 2;
export const CENTRE_RADIUS = 5;
/**
 * How far from a wall a ship's centre bounces, in steps: about half the drawn ship, so its nose
 * meets the quay rather than poking through it.
 */
export const SHIP_WALL_MARGIN = 6;

export type Seat = 0 | 1;
export const SEATS: readonly Seat[] = [0, 1];

export type Edges = 'bounce' | 'wrap';
export type Centre = 'none' | 'star' | 'starbase' | 'beacon';
export type Mode = 'duel' | 'race' | 'solo';

/** One of the cartridge's 17 variations, as rule switches. */
export interface VariationRules {
  /** The cartridge's own number, 1–17. */
  readonly number: number;
  readonly mode: Mode;
  readonly edges: Edges;
  readonly centre: Centre;
  /** Whether the middle pulls on everything (the star and the beacon). */
  readonly gravity: boolean;
  readonly cloak: boolean;
  /**
   * Docking pods: none in a duel, one both ships race for, or one each (seat 0 docks with pod 0,
   * seat 1 with pod 1). Solo docking has one.
   */
  readonly pods: 'none' | 'shared' | 'own';
  /** Our Remix rules on top; absent on the cartridge's own channels. */
  readonly remix?: Remix;
}

/** What a Remix channel adds to a cartridge variation. */
export interface Remix {
  readonly id: 'binary-stars' | 'comet' | 'asteroid-belt' | 'last-fuel';
}

export interface MatchSetup {
  readonly rules: VariationRules;
  /**
   * Each seat's difficulty switch. Duels: on A your own missile can blow you up. Docking: on A a
   * dock needs a near-exact speed match.
   */
  readonly switches: readonly [SwitchPosition, SwitchPosition];
  /** Points that win: 10 on the cartridge, 5 for a Short match. */
  readonly target: number;
  /** Ticks on the match clock. */
  readonly clockTicks: number;
  /** Seeds the pods' velocities (the cartridge read its frame counter). */
  readonly seed: number;
}

/** What one seat's hands hold this tick. */
export interface Controls {
  readonly left: boolean;
  readonly right: boolean;
  readonly thrust: boolean;
  /** The cartridge's stick pulled down; it toggles the cloak only when pulled on its own. */
  readonly cloak: boolean;
  readonly fire: boolean;
}

export const IDLE: Controls = {
  left: false,
  right: false,
  thrust: false,
  cloak: false,
  fire: false,
};

/** Anything that drifts: a ship, a missile, a pod. */
export interface Body {
  /** Subpixels, 0 ≤ x < FIELD_WIDTH × SUBPIXELS. */
  x: number;
  y: number;
  /** Fine units. */
  vx: number;
  vy: number;
  /** Where it was before this tick's move, for the looks to glide between. */
  prevX: number;
  prevY: number;
  /** Whether this tick's move wrapped round an edge (the looks must not glide across the field). */
  wrapped: boolean;
}

export interface Ship extends Body {
  /** False for seat 1 in solo docking. */
  readonly present: boolean;
  heading: number;
  /** Ticks until a held turn steps again; 0 when no turn is held. */
  turnWait: number;
  /** Whole segments left, 0–8; unused in docking (thrust never runs out). */
  fuel: number;
  /** Burns left before the next segment goes. */
  burnsLeft: number;
  /** Segments left, 0–8; unused in docking. */
  ammo: number;
  cloaked: boolean;
  /** The cloak stick is still held from the last toggle; it must be let go first. */
  cloakHeld: boolean;
  /** Ticks of spin left after a hit; 0 when not spinning. */
  spin: number;
  /** Whether thrust was held and worked this tick (the engine sound, the flame). */
  thrusting: boolean;
  /** Docking: ticks before this ship can dock again. */
  dockCooldown: number;
  score: number;
}

/** A missile in a duel, a pod in docking: the cartridge used the same two objects for both. */
export interface Shot extends Body {
  /** Whether it is on the field and can touch things. */
  live: boolean;
  /** Duel: ticks until its ship may fire again (counts down from MISSILE_LIFE); 0 when ready. */
  life: number;
  /** Ticks since it was fired, for the self-hit grace. */
  age: number;
  /**
   * Radians its path has turned since it was fired, signed, counter-clockwise positive: how far
   * the star bent it (the Slingshot patch, the bank-shot replay).
   */
  turned: number;
}

export type Phase = 'playing' | 'over';

export interface Match {
  readonly setup: MatchSetup;
  readonly ships: readonly [Ship, Ship];
  /** Shot 0 belongs to seat 0 (its missile, or pod 0); shot 1 to seat 1. */
  readonly shots: readonly [Shot, Shot];
  /** The pods' velocities come from here, seeded by `setup.seed`. */
  readonly random: Rng;
  /** Ticks since the match began. */
  tick: number;
  /** Ticks left on the clock. */
  clockLeft: number;
  phase: Phase;
  /** The winner once over; null for a draw (or solo). */
  winner: Seat | null;
  /** This tick's moments, replaced every tick. */
  events: MatchEvent[];
}

export type MatchEvent =
  | { readonly kind: 'fired'; readonly seat: Seat }
  | { readonly kind: 'hit'; readonly shooter: Seat; readonly victim: Seat; readonly turned: number }
  /** Your own missile touched you after its grace; on switch A it blew you up (`exploded`). */
  | { readonly kind: 'self-hit'; readonly seat: Seat; readonly exploded: boolean }
  | { readonly kind: 'swallowed'; readonly seat: Seat }
  /** A ship touched the star: back to its corner, exploding, a point to the other seat. */
  | { readonly kind: 'star-crash'; readonly seat: Seat }
  /** A ship touched the starbase: back to its corner, refuelled and rearmed. `speed` was its speed. */
  | { readonly kind: 'refuelled'; readonly seat: Seat; readonly speed: number }
  | { readonly kind: 'cloak'; readonly seat: Seat; readonly on: boolean }
  /** The cloak burned the last fuel segment and the ship blew up. */
  | { readonly kind: 'cloak-burnout'; readonly seat: Seat }
  /** Thrust burned the last fuel segment; the ship is safe, its engine dead. */
  | { readonly kind: 'fuel-out'; readonly seat: Seat }
  /** Both ships were out of missiles and the last one ended: both refilled. */
  | { readonly kind: 'reload' }
  | { readonly kind: 'docked'; readonly seat: Seat; readonly pod: Seat }
  | { readonly kind: 'scored'; readonly seat: Seat; readonly score: number }
  | { readonly kind: 'clock-warning' }
  /** Asteroid Belt: a ship bounced off a rock, or a missile was stopped by one. */
  | { readonly kind: 'rock'; readonly seat: Seat; readonly what: 'ship' | 'missile' }
  /** Comet: a pass begins (entering) or ends. */
  | { readonly kind: 'comet'; readonly entering: boolean }
  /** `spent`: Last Fuel, both ships out of missiles with none flying. */
  | {
      readonly kind: 'over';
      readonly winner: Seat | null;
      readonly reason: 'target' | 'clock' | 'spent';
    };
