/**
 * How each Neighbourhood Kid flies, on top of the kit's memory, reflexes and
 * aim: the habits a person brings to a momentum game. Lou is calm and frugal;
 * Moss keeps away, cloaks and uses the starbase; Rosa hunts and slings shots
 * round the star; Benny copies you a beat later; Dee burns everywhere; Pip
 * wanders and wastes missiles, and now and then bends a perfect one round
 * the sun.
 */
import type { KidId } from '@woodgrain-88/kit';

export interface PilotStyle {
  /** The distance, in steps, the Kid likes to keep from its rival. */
  readonly range: number;
  /** How fast, in speed units, the Kid likes to move when it repositions. */
  readonly cruise: number;
  /** How far off its wanted velocity, in speed units, the Kid lets itself drift before burning. */
  readonly deadband: number;
  /** Fuel segments the Kid tries to keep back for emergencies (as it believes them). */
  readonly fuelReserve: number;
  /** The widest forecast miss, in steps, the Kid thinks worth a missile. */
  readonly shotTolerance: number;
  /** Chance, 0–1, that a Kid in danger cloaks rather than dodges, when it believes it can afford it. */
  readonly cloakUse: number;
  /** Whether the Kid heads for the starbase when it believes it is low. */
  readonly starbase: boolean;
  /** How much, per radian, the Kid prefers shots the star bends (forecast steps it gives up for one). */
  readonly slingshot: number;
  /** Chance, 0–1, per second that the Kid sets off for somewhere else for no reason. */
  readonly wander: number;
  /** Chance, 0–1, that a shot is lined up perfectly, whatever the Kid's usual aim. */
  readonly perfectShot: number;
  /** Steps of clearance from the star the Kid wants on its forecast. */
  readonly starMargin: number;
  /** How many heading steps off the Kid will already start a burn. */
  readonly sloppiness: 0 | 1;
  /** How far off, in degrees (one standard deviation), the Kid judges where its target is. */
  readonly aimNoise: number;
  /** How much of the star's pull the Kid allows for when it lines up a shot, 0–1. */
  readonly pullSense: number;
  /** How much of its cruise the Kid spends circling its rival rather than closing or backing off. */
  readonly orbit: number;
  /** The furthest, in steps, the Kid will shoot from: past it, it closes in first. */
  readonly fireRange: number;
}

export const PILOT_STYLES: Readonly<Record<KidId, PilotStyle>> = {
  lou: {
    range: 50,
    cruise: 14,
    deadband: 10,
    fuelReserve: 3,
    shotTolerance: 2,
    cloakUse: 0.1,
    starbase: true,
    slingshot: 0.5,
    wander: 0,
    perfectShot: 0,
    starMargin: 14,
    sloppiness: 0,
    aimNoise: 12,
    pullSense: 0.9,
    orbit: 0.3,
    fireRange: 60,
  },
  moss: {
    range: 70,
    cruise: 16,
    deadband: 8,
    fuelReserve: 3,
    shotTolerance: 4,
    cloakUse: 0.7,
    starbase: true,
    slingshot: 0.5,
    wander: 0,
    perfectShot: 0,
    starMargin: 16,
    sloppiness: 0,
    aimNoise: 14,
    pullSense: 0.8,
    orbit: 0.6,
    fireRange: 110,
  },
  rosa: {
    range: 22,
    cruise: 26,
    deadband: 6,
    fuelReserve: 1,
    shotTolerance: 4,
    cloakUse: 0.15,
    starbase: false,
    slingshot: 2,
    wander: 0,
    perfectShot: 0,
    starMargin: 11,
    sloppiness: 1,
    aimNoise: 14,
    pullSense: 1,
    orbit: 0.8,
    fireRange: 45,
  },
  benny: {
    range: 40,
    cruise: 20,
    deadband: 8,
    fuelReserve: 2,
    shotTolerance: 4,
    cloakUse: 0.2,
    starbase: false,
    slingshot: 0.5,
    wander: 0,
    perfectShot: 0,
    starMargin: 12,
    sloppiness: 1,
    aimNoise: 16,
    pullSense: 0.7,
    orbit: 0.5,
    fireRange: 60,
  },
  dee: {
    range: 10,
    cruise: 40,
    deadband: 0,
    fuelReserve: 0,
    shotTolerance: 5,
    cloakUse: 0.05,
    starbase: false,
    slingshot: 0,
    wander: 0,
    perfectShot: 0,
    starMargin: 9,
    sloppiness: 1,
    aimNoise: 22,
    pullSense: 0.3,
    orbit: 0,
    fireRange: 160,
  },
  pip: {
    range: 45,
    cruise: 18,
    deadband: 6,
    fuelReserve: 1,
    shotTolerance: 14,
    cloakUse: 0.3,
    starbase: false,
    slingshot: 1,
    wander: 0.25,
    perfectShot: 0.08,
    starMargin: 11,
    sloppiness: 1,
    aimNoise: 28,
    pullSense: 0.4,
    orbit: 0.4,
    fireRange: 140,
  },
};
