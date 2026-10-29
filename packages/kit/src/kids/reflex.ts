/**
 * Human-like reflexes for the Neighbourhood Kids, the real-time counterpart
 * of their memory (kids/memory.ts). A person takes a moment to react, reads
 * only so far ahead, misses what the other player just did, gets rattled when
 * things are fast or cramped, and fumbles now and then; so does every Kid, to
 * a degree that fits its character. The game decides what the Kid wants to
 * do; this module decides when its hands get there, and whether they get it
 * right.
 *
 * The model is small and seeded, so tests and replays are exact:
 * - Reaction delays are drawn from a normal distribution, never quicker than
 *   40% of the Kid's mean: nobody reacts in no time.
 * - Pressure (speed and a cramped spot) raises panic: delays lengthen, slips
 *   come more often and the rival's moves are missed more.
 * - A move the Kid saw coming only has to be timed, so it takes a share of a
 *   reaction; a surprise takes the whole of one.
 * - A slip is late (the delay doubles) or wrong (the hands do something else).
 * - A newer decision replaces one still on its way to the hands.
 *
 * Every decision, action, slip and noticed or missed move is logged, so a
 * results screen can show how the Kid saw the moment.
 */
import type { KidId } from '../kids.ts';
import type { MemoryMode } from './memory.ts';
import type { Rng } from '../rng.ts';

/** What a Kid weighs when it plans; each game reads the weights it has a use for. */
export interface PlanningStyle {
  /** Claiming open space for itself. */
  readonly space: number;
  /** Cutting across the rival's path. */
  readonly cutOff: number;
  /** Keeping clear of walls and tight spots. */
  readonly safety: number;
  /** Copying the rival's last move a beat later. */
  readonly mirror: number;
}

export interface ReflexProfile {
  /** Milliseconds from noticing to acting: the mean, and the spread (one standard deviation). */
  readonly reactionMs: { readonly mean: number; readonly spread: number };
  /** How far ahead along its own course the Kid reads, in the game's steps (cells in Trailblaze). */
  readonly lookahead: number;
  /** How far around itself the Kid takes things into account, in the same steps. */
  readonly awareness: number;
  /** Chance, 0–1, of noticing a change the rival makes (a turn, a feint). */
  readonly attention: number;
  /** 0–1: how much pressure (speed, a cramped spot) slows and rattles the Kid. */
  readonly panic: number;
  /** Chance, 0–1, per decision of a slip: a turn made late, or the wrong one. */
  readonly slipRate: number;
  readonly style: PlanningStyle;
}

/** How hard the moment is, each 0–1: how fast the game runs and how little room is left. */
export interface Pressure {
  readonly speed: number;
  readonly cramp: number;
}

export type ReflexEventKind =
  'decided' | 'acted' | 'slipped-late' | 'slipped-wrong' | 'noticed' | 'missed';

export interface ReflexEvent<A> {
  readonly kind: ReflexEventKind;
  /** Milliseconds on the game's clock. */
  readonly at: number;
  /** The action concerned: decided, performed, or (for a wrong slip) performed instead. */
  readonly action?: A;
  /** For 'slipped-wrong': what the Kid meant to do. */
  readonly intended?: A;
  /** For 'decided': how long until the hands act, in milliseconds. */
  readonly delayMs?: number;
}

export interface KidReflex<A> {
  readonly profile: ReflexProfile;
  /**
   * The Kid has made up its mind to do `action` at `now`. The action reaches its hands after a
   * reaction delay drawn from the profile and lengthened by panic. With the slip chance (raised by
   * panic) the decision goes wrong: either it comes late (the delay doubles) or the hands do one
   * of `alternatives` instead, picked at random (when there are none, a slip can only be late).
   * A new decision replaces one still on its way to the hands.
   *
   * A `foreseen` move is one the Kid saw coming (a wall it has been riding towards, a corner it
   * planned): its hands only have to time it, so the delay is a fraction of a reaction. Surprises
   * (the rival cutting across) get the full reaction.
   */
  decide(
    action: A,
    now: number,
    pressure: Pressure,
    alternatives: readonly A[],
    foreseen?: boolean,
  ): void;
  /** What the hands are doing at `now`: the latest action whose delay has passed, or null. */
  act(now: number): A | null;
  /**
   * What the hands will be doing once anything on its way has landed: the pending action (a wrong
   * slip's, if it slipped), else the current one. A game compares its next decision with this,
   * not with what it meant last time, or a fumble would never be put right.
   */
  planned(): A | null;
  /**
   * The delay the Kid has learned to expect from its own hands under this pressure: its mean
   * reaction (a share of it for a foreseen move), lengthened by panic. A Kid plans for where it
   * will be when its hands get there.
   */
  expectedDelay(pressure: Pressure, foreseen?: boolean): number;
  /** Whether the Kid notices a change the rival just made (attention, lowered by panic); logged. */
  notices(now: number, pressure: Pressure): boolean;
  /** Forgets anything on its way to the hands (a new round); the log is kept. */
  reset(): void;
  readonly log: readonly ReflexEvent<A>[];
}

/** Each Kid's reflexes, set to their character. */
export const KID_REFLEXES: Readonly<Record<KidId, ReflexProfile>> = {
  lou: {
    reactionMs: { mean: 360, spread: 40 },
    lookahead: 7,
    awareness: 9,
    attention: 0.9,
    panic: 0.15,
    slipRate: 0.05,
    style: { space: 0.9, cutOff: 0.3, safety: 0.8, mirror: 0 },
  },
  moss: {
    reactionMs: { mean: 260, spread: 40 },
    lookahead: 6,
    awareness: 7,
    attention: 0.8,
    panic: 0.2,
    slipRate: 0.06,
    style: { space: 1, cutOff: 0.2, safety: 0.9, mirror: 0 },
  },
  rosa: {
    reactionMs: { mean: 220, spread: 50 },
    lookahead: 5,
    awareness: 6,
    attention: 0.85,
    panic: 0.45,
    slipRate: 0.07,
    style: { space: 0.4, cutOff: 1, safety: 0.4, mirror: 0 },
  },
  benny: {
    reactionMs: { mean: 240, spread: 50 },
    lookahead: 5,
    awareness: 6,
    attention: 0.8,
    panic: 0.45,
    slipRate: 0.07,
    style: { space: 0.5, cutOff: 0.3, safety: 0.5, mirror: 1 },
  },
  dee: {
    reactionMs: { mean: 160, spread: 30 },
    lookahead: 3,
    awareness: 4,
    attention: 0.7,
    panic: 0.6,
    slipRate: 0.05,
    style: { space: 0.25, cutOff: 0.25, safety: 0.4, mirror: 0 },
  },
  pip: {
    reactionMs: { mean: 280, spread: 60 },
    lookahead: 3,
    awareness: 4,
    attention: 0.5,
    panic: 0.5,
    slipRate: 0.08,
    style: { space: 0.4, cutOff: 0.4, safety: 0.3, mirror: 0 },
  },
};

/** Sharp mode: no slips, reactions twice as quick; everything else as the Kid's own. */
export function reflexProfile(kid: KidId, mode: MemoryMode): ReflexProfile {
  const base = KID_REFLEXES[kid];
  if (mode === 'human') {
    return base;
  }
  return {
    ...base,
    slipRate: 0,
    reactionMs: {
      mean: Math.round(base.reactionMs.mean / 2),
      spread: Math.round(base.reactionMs.spread / 2),
    },
  };
}

// Samples a normal distribution using Box-Muller transform, clamped to at least 40% of mean.
function sampleReactionDelay(mean: number, spread: number, rng: Rng): number {
  if (spread <= 0) return Math.round(mean);
  let u1 = rng.next();
  while (u1 === 0) {
    u1 = rng.next();
  }
  const u2 = rng.next();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const raw = mean + spread * z0;
  return Math.round(Math.max(0.4 * mean, raw));
}

// Panic scales with the kid's sensitivity multiplied by the dominant pressure axis.
function panicLevel(panic: number, pressure: Pressure): number {
  return panic * Math.max(pressure.speed, pressure.cramp);
}

/**
 * How far full panic stretches a reaction and multiplies the slip rate. Panic costs a quick Kid
 * some of its edge but not all of it: fast hands still count most when the game is fast.
 */
export const PANIC_LAG = 0.5;
export const PANIC_SLIPS = 1;

/** The share of a reaction a foreseen move takes: the hands only time it to the beat. */
export const FORESEEN_SHARE = 0.35;

interface PendingAction<A> {
  readonly action: A;
  readonly readyAt: number;
}

export function createKidReflex<A>(profile: ReflexProfile, rng: Rng): KidReflex<A> {
  const events: ReflexEvent<A>[] = [];
  let currentAction: A | null = null;
  let pending: PendingAction<A> | null = null;

  function decide(
    action: A,
    now: number,
    pressure: Pressure,
    alternatives: readonly A[],
    foreseen = false,
  ): void {
    if (pending !== null && now >= pending.readyAt) {
      currentAction = pending.action;
      events.push({ kind: 'acted', at: now, action: currentAction });
      pending = null;
    }

    const level = panicLevel(profile.panic, pressure);
    const baseDelay = sampleReactionDelay(profile.reactionMs.mean, profile.reactionMs.spread, rng);
    const timing = foreseen ? FORESEEN_SHARE : 1;
    let delay = Math.round(baseDelay * (1 + PANIC_LAG * level) * timing);

    const slipChance = Math.min(1, profile.slipRate * (1 + PANIC_SLIPS * level));
    const slipped = slipChance >= 1 || (slipChance > 0 && rng.chance(slipChance));

    let actionToPerform = action;
    let isLateSlip = false;
    let wrongAction: A | undefined;

    if (slipped) {
      if (alternatives.length === 0 || rng.chance(0.5)) {
        isLateSlip = true;
        delay = delay * 2;
      } else {
        wrongAction = rng.pick(alternatives);
        actionToPerform = wrongAction;
      }
    }

    events.push({ kind: 'decided', at: now, action, delayMs: delay });

    if (isLateSlip) {
      events.push({ kind: 'slipped-late', at: now, action });
    } else if (wrongAction !== undefined) {
      events.push({ kind: 'slipped-wrong', at: now, action: wrongAction, intended: action });
    }

    pending = { action: actionToPerform, readyAt: now + delay };
  }

  function act(now: number): A | null {
    if (pending !== null && now >= pending.readyAt) {
      currentAction = pending.action;
      events.push({ kind: 'acted', at: now, action: currentAction });
      pending = null;
    }
    return currentAction;
  }

  function notices(now: number, pressure: Pressure): boolean {
    const level = panicLevel(profile.panic, pressure);
    const attention = profile.attention * (1 - 0.5 * level);
    const noticed = attention >= 1 || (attention > 0 && rng.chance(attention));

    if (noticed) {
      events.push({ kind: 'noticed', at: now });
    } else {
      events.push({ kind: 'missed', at: now });
    }

    return noticed;
  }

  function planned(): A | null {
    return pending ? pending.action : currentAction;
  }

  function expectedDelay(pressure: Pressure, foreseen = false): number {
    const timing = foreseen ? FORESEEN_SHARE : 1;
    const lag = 1 + PANIC_LAG * panicLevel(profile.panic, pressure);
    return Math.round(profile.reactionMs.mean * lag * timing);
  }

  function reset(): void {
    pending = null;
    currentAction = null;
  }

  return {
    profile,
    decide,
    act,
    planned,
    expectedDelay,
    notices,
    reset,
    log: events,
  };
}
