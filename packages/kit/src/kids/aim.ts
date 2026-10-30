/**
 * Human aim and touch for the Neighbourhood Kids, alongside their memory
 * (kids/memory.ts) and reflexes (kids/reflex.ts). Two errors everybody makes
 * when things move:
 * - **Leading a moving target.** A person rarely leads by the right amount:
 *   most lead too little, and never by the same amount twice. A Kid applies a
 *   share of the lead the shot needs, drawn afresh for each shot.
 * - **Holding a push too long.** Braking onto a mark, matching a speed, easing
 *   into a turn: a person holds the push a little past the point and then
 *   corrects. A Kid holds it for longer than needed, by a margin drawn each
 *   time.
 *
 * The game works out the true lead or the true push; this module says how far
 * off a Kid's hands come out. Draws come only from the rng it is given.
 */
import type { KidId } from '../kids.ts';
import type { MemoryMode } from './memory.ts';
import type { Rng } from '../rng.ts';

export interface AimProfile {
  /** The share of the true lead a Kid applies on average: 1 leads exactly, 0.5 aims halfway. */
  readonly leadBias: number;
  /** How much that share varies from shot to shot (one standard deviation). */
  readonly leadSpread: number;
  /**
   * How far past the needed length a Kid holds a push, as a share of it: the typical size of an
   * overshoot (half-normal, so most are smaller and a few larger). 0 never overshoots.
   */
  readonly overshoot: number;
}

/** Each Kid's aim and touch, set to their character; games tune with their own simulations. */
export const KID_AIM: Readonly<Record<KidId, AimProfile>> = {
  lou: { leadBias: 0.95, leadSpread: 0.08, overshoot: 0.1 },
  moss: { leadBias: 0.85, leadSpread: 0.12, overshoot: 0.15 },
  rosa: { leadBias: 0.8, leadSpread: 0.15, overshoot: 0.3 },
  benny: { leadBias: 0.75, leadSpread: 0.15, overshoot: 0.25 },
  dee: { leadBias: 0.6, leadSpread: 0.2, overshoot: 0.6 },
  pip: { leadBias: 0.5, leadSpread: 0.35, overshoot: 0.35 },
};

/** Sharp mode leads exactly and never overshoots; only the shot-to-shot wobble remains, halved. */
export function aimProfile(kid: KidId, mode: MemoryMode): AimProfile {
  const base = KID_AIM[kid];
  if (mode === 'human') return base;
  return { leadBias: 1, leadSpread: base.leadSpread / 2, overshoot: 0 };
}

// One draw from a standard normal distribution (Box-Muller), from the given stream only.
function standardNormal(rng: Rng): number {
  let u = rng.next();
  while (u === 0) u = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/**
 * The share of the true lead this shot applies. Multiply the target's travel during the shot's
 * flight by it before aiming. Never negative: nobody aims behind a target on purpose.
 */
export function leadShare(profile: AimProfile, rng: Rng): number {
  return Math.max(0, profile.leadBias + profile.leadSpread * standardNormal(rng));
}

/** How long a Kid holds a push that needs `needed` (in the game's own units: ticks, metres). */
export function heldFor(needed: number, profile: AimProfile, rng: Rng): number {
  if (needed <= 0 || profile.overshoot <= 0) return Math.max(0, needed);
  return needed * (1 + profile.overshoot * Math.abs(standardNormal(rng)));
}
