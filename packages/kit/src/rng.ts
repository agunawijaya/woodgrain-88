/**
 * Seeded randomness. Every daily, challenge link, bot and demo must replay
 * identically on every browser, so nothing in a game may call Math.random.
 *
 * The generator is sfc32 (Chris Doty-Humphrey's Small Fast Counting
 * generator): four 32-bit words of state, integer-only arithmetic, so results
 * are bit-identical across JavaScript engines. String seeds are hashed with
 * a 32-bit FNV-1a mixed through a murmur-style finaliser.
 */

export type Seed = number | string;

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A float in [min, max). */
  float(min: number, max: number): number;
  /** True with the given probability. */
  chance(probability: number): boolean;
  /** One element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy; the input is left untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * An independent generator derived from this one's seed and a label, so a
   * game can give its AI, its level generator and its particles separate
   * streams that do not shift when one of them draws more numbers.
   */
  fork(label: string): Rng;
  /** The seed this generator started from, as a 32-bit unsigned integer. */
  readonly seed: number;
}

/** Hashes any seed to a 32-bit unsigned integer. */
export function hashSeed(seed: Seed): number {
  const text = typeof seed === 'number' ? `n:${seed}` : `s:${seed}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

// Spreading one 32-bit seed over four state words and discarding the first
// outputs avoids the weak early values sfc32 gives for small, similar seeds.
const WARM_UP_DRAWS = 15;

export function createRng(seed: Seed): Rng {
  const base = hashSeed(seed);
  const next = sfc32(base, base ^ 0x9e3779b9, base ^ 0x243f6a88, base ^ 0xb7e15162);
  for (let i = 0; i < WARM_UP_DRAWS; i++) next();

  const rng: Rng = {
    seed: base,
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`int(${min}, ${max}) needs integers with min <= max`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(probability) {
      return next() < probability;
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('pick() needs at least one item');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j] as (typeof copy)[number], copy[i] as (typeof copy)[number]];
      }
      return copy;
    },
    fork(label) {
      return createRng(`${base}/${label}`);
    },
  };
  return rng;
}

/** A fresh seed for a normal run, the one place where real randomness is allowed. */
export function randomSeed(): number {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0] ?? 0;
}
