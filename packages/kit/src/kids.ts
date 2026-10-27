/**
 * The Neighbourhood Kids: six bot personalities shared by every game. A game
 * never invents its own opponents; it maps a kid's personality onto its own
 * AI, so Dee rushes you in Tank Duel and in Disc Duel alike.
 *
 * Every personality is nine numbers from 0 to 1. They describe intent, not
 * mechanics: `aiSettings` turns them into the handful of knobs most game AIs
 * have (how quickly it reacts, how often it slips, how much risk it takes,
 * how fast it learns you), and a game may read the raw numbers for anything
 * more particular to its rules. Examples per parameter are in the comments.
 */

export const KID_IDS = ['dee', 'moss', 'pip', 'lou', 'rosa', 'benny'] as const;
export type KidId = (typeof KID_IDS)[number];

export interface KidPersonality {
  /** Goes on the attack. Tank Duel: charges in; Disc Duel: grabs edges early. */
  aggression: number;
  /** Guards against loss. Glove Box: keeps the guard up; Baseline: stays back on the line. */
  caution: number;
  /** How quickly it responds; 1 is the fastest a game allows. */
  reaction: number;
  /** How often a decision goes wrong by accident: a late swing, a misread move. */
  error: number;
  /** How often it picks something other than its best idea, on purpose. */
  randomness: number;
  /** Willing to wait for a good opening instead of forcing one. */
  patience: number;
  /** Feints, bluffs and baits. Table 21 hardly applies; Quickdraw fakes the draw. */
  deception: number;
  /** How quickly it learns the player's habits during a match. */
  adaptivity: number;
  /** How far its form swings between hot and cold spells within a match. */
  streakiness: number;
}

/** A 1988 school-photo portrait, drawn from code by `kidPortraitSvg`; no real person is depicted. */
export interface KidPortrait {
  /** Skin tone from a small, varied palette. */
  skin: string;
  hair: { style: 'curls' | 'bob' | 'spikes' | 'bald-ring' | 'ponytail' | 'bowl'; colour: string };
  /** The sweater, shirt or jacket in the photo. */
  top: {
    style: 'sweater' | 'polo' | 'cardigan' | 'tee' | 'denim' | 'turtleneck';
    colour: string;
    accent: string;
  };
  extra: 'none' | 'glasses' | 'freckles' | 'braces' | 'headband' | 'bow-tie';
  /** How this kid smiles for the camera; each kid's is their own. */
  smile: 'gap-grin' | 'closed' | 'laugh' | 'moustache' | 'braces' | 'buck';
  /** The studio backdrop behind the kid. */
  backdrop: string;
}

export interface Kid {
  id: KidId;
  name: string;
  /** Three or four words for menus. */
  style: string;
  /** Two sentences in our own words, at most 160 characters. */
  bio: string;
  personality: KidPersonality;
  /** Benny plays your own habits back at you; games that can, mirror the player. */
  mirrorsPlayer: boolean;
  portrait: KidPortrait;
}

export const KIDS: readonly Kid[] = [
  {
    id: 'dee',
    name: 'Dee',
    style: 'Fast, fearless, reckless',
    bio: 'Plays like the bell has already rung. First to the action, first to take a chance, and never sorry about it.',
    personality: {
      aggression: 0.9,
      caution: 0.15,
      reaction: 0.85,
      error: 0.45,
      randomness: 0.3,
      patience: 0.2,
      deception: 0.3,
      adaptivity: 0.3,
      streakiness: 0.4,
    },
    mirrorsPlayer: false,
    portrait: {
      skin: '#8d5a3b',
      hair: { style: 'spikes', colour: '#1f1410' },
      top: { style: 'denim', colour: '#3d6fb4', accent: '#f2a22c' },
      extra: 'headband',
      smile: 'gap-grin',
      backdrop: '#5a8fd6',
    },
  },
  {
    id: 'moss',
    name: 'Moss',
    style: 'Careful, patient, punishing',
    bio: 'Keeps her guard up and waits. Leave one door open and she walks straight through it.',
    personality: {
      aggression: 0.2,
      caution: 0.9,
      reaction: 0.55,
      error: 0.15,
      randomness: 0.1,
      patience: 0.8,
      deception: 0.2,
      adaptivity: 0.45,
      streakiness: 0.1,
    },
    mirrorsPlayer: false,
    portrait: {
      skin: '#e8b996',
      hair: { style: 'bob', colour: '#6b3a1f' },
      top: { style: 'turtleneck', colour: '#2f6b4f', accent: '#cfe3c8' },
      extra: 'glasses',
      smile: 'closed',
      backdrop: '#7a9a8a',
    },
  },
  {
    id: 'pip',
    name: 'Pip',
    style: 'Wild, chaotic, sometimes brilliant',
    bio: 'Nobody knows what Pip will do next, including Pip. Some days that turns out to be genius.',
    personality: {
      aggression: 0.55,
      caution: 0.3,
      reaction: 0.6,
      error: 0.7,
      randomness: 0.85,
      patience: 0.3,
      deception: 0.35,
      adaptivity: 0.2,
      streakiness: 0.9,
    },
    mirrorsPlayer: false,
    portrait: {
      skin: '#f1c8a5',
      hair: { style: 'curls', colour: '#c4541f' },
      top: { style: 'tee', colour: '#e8463a', accent: '#ffd23f' },
      extra: 'freckles',
      smile: 'laugh',
      backdrop: '#c86fc4',
    },
  },
  {
    id: 'lou',
    name: 'Grandpa Lou',
    style: 'Slow, steady, nearly flawless',
    bio: 'Takes his time, wipes his glasses, then does exactly the right thing. Every single time.',
    personality: {
      aggression: 0.35,
      caution: 0.7,
      reaction: 0.2,
      error: 0.05,
      randomness: 0.05,
      patience: 0.95,
      deception: 0.15,
      adaptivity: 0.35,
      streakiness: 0.05,
    },
    mirrorsPlayer: false,
    portrait: {
      skin: '#c48a64',
      hair: { style: 'bald-ring', colour: '#d9d4cc' },
      top: { style: 'cardigan', colour: '#8a5a2b', accent: '#f0e2c4' },
      extra: 'bow-tie',
      smile: 'moustache',
      backdrop: '#9a8668',
    },
  },
  {
    id: 'rosa',
    name: 'Rosa',
    style: 'Tricky, baiting, sly',
    bio: 'Shows you one thing and does another. If a gap looks too easy, it was probably left there by Rosa.',
    personality: {
      aggression: 0.55,
      caution: 0.55,
      reaction: 0.65,
      error: 0.3,
      randomness: 0.35,
      patience: 0.6,
      deception: 0.9,
      adaptivity: 0.55,
      streakiness: 0.25,
    },
    mirrorsPlayer: false,
    portrait: {
      skin: '#b07a52',
      hair: { style: 'ponytail', colour: '#2a1712' },
      top: { style: 'sweater', colour: '#7b3fa0', accent: '#ffb3d1' },
      extra: 'braces',
      smile: 'braces',
      backdrop: '#d98a5f',
    },
  },
  {
    id: 'benny',
    name: 'Benny',
    style: 'The copycat who learns',
    bio: 'Watches how you play and plays it straight back at you, a little better every round.',
    personality: {
      aggression: 0.5,
      caution: 0.5,
      reaction: 0.6,
      error: 0.35,
      randomness: 0.2,
      patience: 0.5,
      deception: 0.3,
      adaptivity: 0.95,
      streakiness: 0.2,
    },
    mirrorsPlayer: true,
    portrait: {
      skin: '#f3d2b8',
      hair: { style: 'bowl', colour: '#b98a3e' },
      top: { style: 'polo', colour: '#1f8a8a', accent: '#ffffff' },
      extra: 'none',
      smile: 'buck',
      backdrop: '#6fb3c8',
    },
  },
];

/** The Block Ladder, bottom rung first: beat each kid once, in any game, to climb. */
export const BLOCK_LADDER: readonly KidId[] = ['pip', 'benny', 'dee', 'rosa', 'moss', 'lou'];

import type { DenLifeData, KidRecordData } from './store/types.ts';
import type { IsoTime } from './types.ts';

const KIDS_BY_ID = new Map<KidId, Kid>(KIDS.map((kid) => [kid.id, kid]));

/** Throws for an unknown id. */
export function kidById(id: KidId): Kid {
  const kid = KIDS_BY_ID.get(id);
  if (!kid) {
    throw new Error(`Unknown kid id: "${id}"`);
  }
  return kid;
}

// Linear interpolation between boundary values across a kid's trait span.
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Probabilities, risk levels, and error rates must stay strictly within the unit interval.
function clamp01(n: number): number {
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
}

/** The knobs most game AIs have, worked out from a kid's personality. */
export interface AiSettings {
  /** Milliseconds before the bot answers something new. */
  reactionMs: number;
  /** Chance, 0–1, that a single decision is a mistake. */
  errorRate: number;
  /** 0–1: how much risk it takes for a bigger gain. */
  risk: number;
  /** Chance per decision of picking a near-best option on purpose. */
  randomness: number;
  /** Chance of a feint or bluff, where the game has one. */
  deception: number;
  /** How many rounds (or turns) of the player's play it remembers; 0 means it does not learn. */
  memory: number;
  /** Copies the player's habits instead of its own preferences (Benny). */
  mirror: boolean;
  /** 0–1: how far its error rate swings between hot and cold spells. */
  swing: number;
}

/** A game narrows or widens the ranges to fit its own pace; the defaults suit an action game. */
export interface AiRanges {
  /** [slowest, fastest] milliseconds. */
  reactionMs: readonly [number, number];
  /** [steadiest, sloppiest]. */
  errorRate: readonly [number, number];
  /** [none, most] rounds remembered. */
  memory: readonly [number, number];
}

export const DEFAULT_AI_RANGES: AiRanges = {
  reactionMs: [900, 150],
  errorRate: [0.02, 0.35],
  memory: [0, 12],
};

export function aiSettings(kid: KidId | Kid, ranges?: Partial<AiRanges>): AiSettings {
  const resolvedKid = typeof kid === 'string' ? kidById(kid) : kid;
  const p = resolvedKid.personality;

  const reactionRange = ranges?.reactionMs ?? DEFAULT_AI_RANGES.reactionMs;
  const errorRange = ranges?.errorRate ?? DEFAULT_AI_RANGES.errorRate;
  const memoryRange = ranges?.memory ?? DEFAULT_AI_RANGES.memory;

  return {
    reactionMs: Math.round(lerp(reactionRange[0], reactionRange[1], p.reaction)),
    errorRate: lerp(errorRange[0], errorRange[1], p.error),
    risk: clamp01(0.6 * p.aggression + 0.4 * (1 - p.caution)),
    randomness: p.randomness,
    deception: p.deception,
    memory: Math.round(lerp(memoryRange[0], memoryRange[1], p.adaptivity)),
    mirror: resolvedKid.mirrorsPlayer,
    swing: p.streakiness,
  };
}

/**
 * The error rate for one round, given the kid's swing and a 0–1 number the game draws from its
 * seeded RNG: a hot spell lowers it, a cold one raises it, never outside [0, 1].
 */
export function errorRateForRound(settings: AiSettings, draw: number): number {
  return clamp01(settings.errorRate * (1 + settings.swing * (2 * draw - 1)));
}

export type KidOutcome = 'win' | 'loss' | 'draw';

/** Folds one finished game against a kid into the record; `outcome` is the player's. Pure. */
export function recordKidResult(
  kids: DenLifeData['kids'],
  kid: KidId,
  outcome: KidOutcome,
  onA: boolean,
  at: IsoTime,
): DenLifeData['kids'] {
  const prev: KidRecordData = kids[kid] ?? {
    wins: 0,
    losses: 0,
    draws: 0,
    winsOnA: 0,
    firstBeatenAt: null,
    firstBeatenOnAAt: null,
  };

  const isWin = outcome === 'win';
  const isWinOnA = isWin && onA;

  const updated: KidRecordData = {
    wins: prev.wins + (isWin ? 1 : 0),
    losses: prev.losses + (outcome === 'loss' ? 1 : 0),
    draws: prev.draws + (outcome === 'draw' ? 1 : 0),
    winsOnA: prev.winsOnA + (isWinOnA ? 1 : 0),
    firstBeatenAt: isWin ? (prev.firstBeatenAt ?? at) : prev.firstBeatenAt,
    firstBeatenOnAAt: isWinOnA ? (prev.firstBeatenOnAAt ?? at) : prev.firstBeatenOnAAt,
  };

  return {
    ...kids,
    [kid]: updated,
  };
}

export interface LadderView {
  /** Rungs climbed, 0–6: the longest run of BLOCK_LADDER, from the bottom, all beaten at least once. */
  rung: number;
  /** The next kid to beat, null at the top. */
  next: KidId | null;
  /** All six beaten: "Block champion". */
  champion: boolean;
  /** Kids beaten at least once with the player's switch on A, in ladder order. */
  beatenOnA: KidId[];
}

export function blockLadder(kids: DenLifeData['kids']): LadderView {
  let rung = 0;
  for (const id of BLOCK_LADDER) {
    const record = kids[id];
    if (record !== undefined && record.wins > 0) {
      rung++;
    } else {
      break;
    }
  }

  const champion = rung === BLOCK_LADDER.length;
  const next = champion ? null : (BLOCK_LADDER[rung] ?? null);

  const beatenOnA: KidId[] = [];
  for (const id of BLOCK_LADDER) {
    const record = kids[id];
    if (record !== undefined && record.winsOnA > 0) {
      beatenOnA.push(id);
    }
  }

  return {
    rung,
    next,
    champion,
    beatenOnA,
  };
}
