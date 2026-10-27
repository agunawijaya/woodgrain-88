/**
 * The duel's numbers, in seconds and world units. They come from the 1977
 * game's feel (research notes, converted from its 50 Hz frames and 160-pixel
 * field to our 64-unit board: one pixel is 0.4 units), then tuned where play
 * on a modern screen asks for it; every tuned number says so and why. The
 * simulations in `sim/` lock the results in.
 */
import { TANK_RADIUS } from '../arenas/format.ts';
import type { VehicleClass } from './types.ts';

export { TANK_RADIUS };

/** One original pixel, in world units. */
export const PIXEL = 0.4;

/** A round on the clock: 128 ticks of 1.28 s. */
export const ROUND_SECONDS = 163.84;
/** The plates blink for the last 16 ticks. */
export const WARNING_SECONDS = 20.48;
export const FIRST_TO = 10;
/** First-to-10 matches end anyway after this long, so a match can never run forever. */
export const FIRST_TO_LIMIT_SECONDS = 600;

/** Holding the stick to one side steps the heading once every 15 frames. */
export const TURN_STEP_SECONDS = 0.3;

/**
 * Tank driving speed. 1977 crawled at 6.25 px/s (2.5 u/s), crossing the field in 25 s; tuned up a
 * fifth so a maze round has room for more than a handful of meetings.
 */
export const TANK_SPEED = 3;
/** Backing away with the Reverse gear setting (not in 1977): slower than driving on. */
export const TANK_REVERSE_SPEED = TANK_SPEED / 2;
/** How far from the tank's centre a shell appears: the end of the barrel. */
export const TANK_MUZZLE = 2.15;

export const SHELL_SPEED = 40;
export const SHELL_LIFE = 1.14;
/** Difficulty A: shells fly about five eighths as far. */
export const HANDICAP_SHELL_LIFE = 0.72;
export const BOUNCING_LIFE_FACTOR = 2;
export const BILLIARD_LIFE_FACTOR = 4;
/** Each bounce gives a shell back most of its full flight. */
export const BOUNCE_LIFE_REFRESH = 0.8;
/**
 * Caps a shell's whole flight at this many lifetimes. Without it a shell fired square at a wall
 * bounces between that wall and the one opposite for ever, and its owner can never fire again.
 */
export const MAX_FLIGHT_FACTOR = 1.5;

export const MACHINE_GUN_SPEED = 80;
export const MACHINE_GUN_LIFE = 0.18;
/** Holding fire repeats a round about five and a half times a second. */
export const MACHINE_GUN_INTERVAL = 0.18;

/** The pause after a scoring hit: the victim spins and nobody steers. */
export const SPIN_SECONDS = 2.52;
/** The victim turns one heading step per original frame. */
export const SPIN_STEPS_PER_SECOND = 50;
/** For the first moment of the spin the victim is shoved along the shot. */
export const KNOCKBACK_SECONDS = 0.08;
/** 1977 shoved about 2 px; doubled so the hit reads as a hit on a large screen. */
export const KNOCKBACK_DISTANCE = 1.6;

/** A tank that touches a wall or the other tank is pushed straight back this far. */
export const BUMP_PUSH = 0.18;
/** A driving tank pressed against something this long turns one step to slide free (4 frames). */
export const WEDGED_SECONDS = 0.08;
/** How long a bump reveals an invisible tank. */
export const BUMP_REVEAL_SECONDS = 0.4;

/** Aircraft speeds in units per second: [slow, cruise, fast], on switch B. */
const ORIGINAL_TANK_SPEED = 2.5;
export const AIRCRAFT_SPEEDS: Record<
  Exclude<VehicleClass, 'tank'>,
  readonly [number, number, number]
> = {
  biplane: [2, 3, 4].map((times) => times * ORIGINAL_TANK_SPEED) as [number, number, number],
  bomber: [2, 3, 4].map((times) => times * ORIGINAL_TANK_SPEED) as [number, number, number],
  jet: [4, 5, 6].map((times) => times * ORIGINAL_TANK_SPEED) as [number, number, number],
};
/** Switch A takes biplanes down one speed tier and jets two (in 1977's half-tank steps). */
export const AIRCRAFT_HANDICAP: Record<Exclude<VehicleClass, 'tank'>, number> = {
  biplane: 0.5 * ORIGINAL_TANK_SPEED,
  bomber: 0.5 * ORIGINAL_TANK_SPEED,
  jet: 1 * ORIGINAL_TANK_SPEED,
};
/** Speed changes are eased over this long, so a throttle change reads as acceleration. */
export const THROTTLE_SECONDS = 0.35;

export const VEHICLE_RADIUS: Record<VehicleClass, number> = {
  tank: TANK_RADIUS,
  biplane: 1.5,
  jet: 1.35,
  bomber: 2.6,
};
/** Where an aircraft's guns or missile rack is, ahead of its centre. */
export const AIRCRAFT_MUZZLE: Record<Exclude<VehicleClass, 'tank'>, number> = {
  biplane: 1.6,
  bomber: 2.8,
  jet: 1.7,
};
/** Formation members fly side by side, this far apart. */
export const FORMATION_SPACING = 4;

/** Ace Duel: seconds of afterburner in a full tank, and how fast it refills while not burning. */
export const ACE_FUEL_SECONDS = 3;
export const ACE_REFILL_PER_SECOND = 0.6;
/** Blackout: a radar sweep every few seconds shows both tanks briefly. */
export const BLACKOUT_SWEEP_EVERY = 5;
export const BLACKOUT_SWEEP_SHOWS = 0.6;
/** Last Tank: short rounds, one hit wins a round. */
export const LAST_TANK_ROUND_SECONDS = 30;
export const LAST_TANK_ROUNDS = 5;
