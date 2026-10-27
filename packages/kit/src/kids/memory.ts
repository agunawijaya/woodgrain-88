/**
 * Human-like memory for the Neighbourhood Kids. A person forgets, mixes
 * things up and misses what the other player did; so does every Kid, each to
 * a degree that fits its character. Games feed a Kid's memory the facts it
 * comes across (a clue it uncovered, a card it saw) and ask it, when the Kid
 * decides, what it can call to mind. The AI then reasons only over that.
 *
 * The model is small and seeded, so tests and replays are exact:
 * - Each fact has a strength: its salience when learned, halving every
 *   `halfLife` seconds unless it is used again (rehearsal).
 * - A memory holds at most `capacity` facts; a new one pushes out the weakest.
 * - Recalling a fact succeeds with a chance equal to its strength (capped at
 *   1); a fact grown too faint is forgotten for good.
 * - A recalled fact can come back slightly wrong, and the Kid then believes
 *   the wrong version. Fresh memories are vivid and fading ones blur: the
 *   chance is the profile's distortion times how far the fact has faded, so
 *   a fact learned a moment ago comes back exactly. The game defines
 *   "slightly wrong" for its own facts.
 * - What the other player reveals is only noticed with the Kid's attention.
 *
 * Every fact's story is kept in a log, so a results screen can show what a
 * Kid remembered, forgot, misremembered and missed.
 */
import type { KidId } from '../kids.ts';
import type { Rng } from '../rng.ts';

/** How much more a kind of fact sticks than a routine one (1). */
export interface SalienceWeights {
  /** Something the Kid found out for itself. */
  readonly own: number;
  /** Something the Kid saw the other player find. */
  readonly theirs: number;
  /** A further multiplier for a striking fact: a bomb, a surprise, a big swing. */
  readonly striking: number;
}

export interface MemoryProfile {
  /** How many separate facts the Kid can hold at once; `Infinity` for no limit. */
  readonly capacity: number;
  /** Seconds for an unused fact's strength to halve; `Infinity` for facts that never fade. */
  readonly halfLife: number;
  /**
   * Chance, 0–1, that a fact comes back slightly wrong once it has faded completely; a fact half
   * faded (one half-life old) comes back wrong half as often, a fresh one never.
   */
  readonly distortion: number;
  /** Chance, 0–1, of noticing something the other player revealed. */
  readonly attention: number;
  /** Whether calling a fact to mind refreshes it. */
  readonly rehearsal: boolean;
  readonly salience: SalienceWeights;
}

/** The Den's Kid memory setting: human (the default) or sharp (perfect recall, a harder option). */
export type MemoryMode = 'human' | 'sharp';

/** A fact whose strength falls below this is gone for good. */
export const FORGET_BELOW = 0.25;

const USUAL_SALIENCE: SalienceWeights = { own: 1.3, theirs: 1, striking: 1.5 };

/**
 * Each Kid's memory, set to their character: Lou forgets almost nothing, slowly; Pip holds three
 * things for twenty seconds and mixes up one in six; Rosa and Benny watch the player more than the
 * field, so what the player finds sticks with them.
 */
export const KID_MEMORY: Readonly<Record<KidId, MemoryProfile>> = {
  lou: {
    capacity: 9,
    halfLife: 120,
    distortion: 0.02,
    attention: 0.9,
    rehearsal: true,
    salience: USUAL_SALIENCE,
  },
  moss: {
    capacity: 7,
    halfLife: 90,
    distortion: 0.04,
    attention: 0.8,
    rehearsal: true,
    salience: USUAL_SALIENCE,
  },
  rosa: {
    capacity: 6,
    halfLife: 60,
    distortion: 0.06,
    attention: 0.85,
    rehearsal: false,
    salience: { ...USUAL_SALIENCE, theirs: 1.4 },
  },
  benny: {
    capacity: 6,
    halfLife: 60,
    distortion: 0.05,
    attention: 0.95,
    rehearsal: false,
    salience: { ...USUAL_SALIENCE, theirs: 1.5 },
  },
  dee: {
    capacity: 4,
    halfLife: 30,
    distortion: 0.1,
    attention: 0.5,
    rehearsal: false,
    salience: USUAL_SALIENCE,
  },
  pip: {
    capacity: 3,
    halfLife: 20,
    distortion: 0.18,
    attention: 0.4,
    rehearsal: false,
    salience: USUAL_SALIENCE,
  },
};

/** Perfect recall: everything noticed, nothing faded, nothing mixed up. */
export const SHARP_MEMORY: MemoryProfile = {
  capacity: Infinity,
  halfLife: Infinity,
  distortion: 0,
  attention: 1,
  rehearsal: true,
  salience: { own: 1, theirs: 1, striking: 1 },
};

export function memoryProfile(kid: KidId, mode: MemoryMode): MemoryProfile {
  return mode === 'sharp' ? SHARP_MEMORY : KID_MEMORY[kid];
}

/** The salience of a fact for this profile: its source's weight, times the striking weight if striking. */
export function salienceOf(
  profile: MemoryProfile,
  source: 'own' | 'theirs',
  striking: boolean,
): number {
  const base = source === 'own' ? profile.salience.own : profile.salience.theirs;
  return striking ? base * profile.salience.striking : base;
}

/** How a game describes its facts to a Kid's memory. */
export interface FactAdapter<F> {
  /** Facts with the same key are the same fact: learning it again refreshes it. */
  key(fact: F): string;
  /** A slightly wrong version of the fact: a distance off by one, an arrow turned a notch. */
  distort(fact: F, rng: Rng): F;
}

export type MemoryEventKind = 'learned' | 'missed' | 'forgotten' | 'pushed-out' | 'misremembered';

export interface MemoryEvent<F> {
  readonly kind: MemoryEventKind;
  /** The fact as the Kid held it before the event (for 'missed', as it was revealed). */
  readonly fact: F;
  /** Seconds, on the game's clock. */
  readonly at: number;
  /** For 'misremembered': what the Kid believes from now on. */
  readonly became?: F;
}

/** What a Kid made of everything it came across, for the results screen. */
export interface MemorySummary<F> {
  /** Facts still held, as the Kid now believes them. */
  readonly kept: readonly F[];
  /** Facts that faded away or were pushed out by newer ones, as they were last believed. */
  readonly forgotten: readonly F[];
  /** Facts that came back wrong: what was true, and what the Kid ended up believing. */
  readonly misremembered: readonly { readonly truth: F; readonly belief: F }[];
  /** Things the other player revealed that the Kid did not notice. */
  readonly missed: readonly F[];
}

export interface KidMemory<F> {
  readonly profile: MemoryProfile;
  /** Takes in something the Kid found out itself, at strength `salience`. */
  observe(fact: F, salience: number, now: number): void;
  /**
   * Something the other player revealed: noticed with the profile's attention (then learned like
   * `observe`), otherwise logged as missed. Returns whether it was noticed.
   */
  witness(fact: F, salience: number, now: number, rng: Rng): boolean;
  /** The facts the Kid can call to mind now, as it believes them. */
  recall(now: number, rng: Rng): F[];
  /** Drops every fact held (a new round on a new board); the log is kept. */
  forgetAll(): void;
  readonly log: readonly MemoryEvent<F>[];
  summary(): MemorySummary<F>;
}

interface HeldFact<F> {
  readonly key: string;
  belief: F;
  truth: F;
  salience: number;
  refreshedAt: number;
  readonly learnedOrder: number;
}

interface DistortedEntry<F> {
  readonly truth: F;
  belief: F;
}

// Strength halves every half-life since the fact was last refreshed; an infinite half-life never fades.
function factStrength(
  salience: number,
  refreshedAt: number,
  halfLife: number,
  now: number,
): number {
  if (halfLife === Infinity) return salience;
  return salience * Math.pow(0.5, (now - refreshedAt) / halfLife);
}

function isWeaker<F>(
  candidate: HeldFact<F>,
  candidateStrength: number,
  weakest: HeldFact<F>,
  weakestStrength: number,
): boolean {
  if (candidateStrength !== weakestStrength) {
    return candidateStrength < weakestStrength;
  }
  return candidate.learnedOrder < weakest.learnedOrder;
}

// How far a fact has faded since it was last refreshed: 0 fresh, approaching 1 as it fades out.
function faded<F>(item: HeldFact<F>, halfLife: number, now: number): number {
  if (halfLife === Infinity) return 0;
  return 1 - Math.pow(0.5, (now - item.refreshedAt) / halfLife);
}

// Finds the weakest held fact to push out when capacity is exceeded.
function findWeakest<F>(
  held: Iterable<HeldFact<F>>,
  halfLife: number,
  now: number,
): HeldFact<F> | null {
  let weakest: HeldFact<F> | null = null;
  let weakestStrength = Infinity;

  for (const candidate of held) {
    const strength = factStrength(candidate.salience, candidate.refreshedAt, halfLife, now);
    if (weakest === null || isWeaker(candidate, strength, weakest, weakestStrength)) {
      weakest = candidate;
      weakestStrength = strength;
    }
  }

  return weakest;
}

// Returns held facts sorted by the order they were first learned.
function heldInLearnedOrder<F>(held: Iterable<HeldFact<F>>): HeldFact<F>[] {
  return Array.from(held).sort((a, b) => a.learnedOrder - b.learnedOrder);
}

export function createKidMemory<F>(profile: MemoryProfile, adapter: FactAdapter<F>): KidMemory<F> {
  const held = new Map<string, HeldFact<F>>();
  const events: MemoryEvent<F>[] = [];
  const distortions = new Map<string, DistortedEntry<F>>();
  let orderSequence = 0;

  function observe(fact: F, salience: number, now: number): void {
    const key = adapter.key(fact);
    const existing = held.get(key);
    if (existing !== undefined) {
      existing.belief = fact;
      existing.truth = fact;
      existing.salience = salience;
      existing.refreshedAt = now;
      return;
    }

    events.push({ kind: 'learned', fact, at: now });

    // When capacity is full, the weakest fact is ejected to make room for the new one.
    if (held.size >= profile.capacity && held.size > 0) {
      const weakest = findWeakest(held.values(), profile.halfLife, now);
      if (weakest !== null) {
        held.delete(weakest.key);
        events.push({ kind: 'pushed-out', fact: weakest.belief, at: now });
      }
    }

    held.set(key, {
      key,
      belief: fact,
      truth: fact,
      salience,
      refreshedAt: now,
      learnedOrder: orderSequence++,
    });
  }

  function witness(fact: F, salience: number, now: number, rng: Rng): boolean {
    const noticed = profile.attention >= 1 || rng.chance(profile.attention);
    if (!noticed) {
      events.push({ kind: 'missed', fact, at: now });
      return false;
    }
    observe(fact, salience, now);
    return true;
  }

  function recall(now: number, rng: Rng): F[] {
    const ordered = heldInLearnedOrder(held.values());
    const retrieved: F[] = [];

    for (const item of ordered) {
      const strength = factStrength(item.salience, item.refreshedAt, profile.halfLife, now);

      // Faint memories drop below the retrieval threshold and are permanently lost.
      if (strength < FORGET_BELOW) {
        held.delete(item.key);
        events.push({ kind: 'forgotten', fact: item.belief, at: now });
        continue;
      }

      const succeeded = strength >= 1 || rng.chance(strength);
      if (!succeeded) {
        continue;
      }

      const blur = profile.distortion * faded(item, profile.halfLife, now);
      const shouldDistort = blur > 0 && rng.chance(blur);

      if (shouldDistort) {
        const previousBelief = item.belief;
        const became = adapter.distort(previousBelief, rng);
        events.push({ kind: 'misremembered', fact: previousBelief, at: now, became });
        item.belief = became;
        const distortionEntry = distortions.get(item.key);
        if (distortionEntry !== undefined) {
          distortionEntry.belief = became;
        } else {
          distortions.set(item.key, { truth: item.truth, belief: became });
        }
      }

      if (profile.rehearsal) {
        item.refreshedAt = now;
      }

      retrieved.push(item.belief);
    }

    return retrieved;
  }

  function forgetAll(): void {
    held.clear();
  }

  function summary(): MemorySummary<F> {
    const kept = heldInLearnedOrder(held.values()).map((item) => item.belief);
    const forgotten: F[] = [];
    const missed: F[] = [];

    for (const event of events) {
      if (event.kind === 'forgotten' || event.kind === 'pushed-out') {
        forgotten.push(event.fact);
      } else if (event.kind === 'missed') {
        missed.push(event.fact);
      }
    }

    const misremembered: { readonly truth: F; readonly belief: F }[] = [];
    for (const entry of distortions.values()) {
      misremembered.push({ truth: entry.truth, belief: entry.belief });
    }

    return {
      kept,
      forgotten,
      misremembered,
      missed,
    };
  }

  return {
    profile,
    observe,
    witness,
    recall,
    forgetAll,
    log: events,
    summary,
  };
}
