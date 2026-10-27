/**
 * How human the Neighbourhood Kids play Tank Duel. The kit gives each kid a
 * personality; these numbers turn it into tank handling: how long a kid needs
 * to find the target after a spin, how well it judges a distant tank, how
 * steadily it steers a guided shell, how close it likes to fight. They are
 * the knobs the balance simulations turn (see the game's notes), kept in one
 * place so a retune never hunts through the commander.
 */
export interface DuelTuning {
  /** Decision interval range in milliseconds: the slowest kid, the quickest. */
  readonly reactionSlowMs: number;
  readonly reactionFastMs: number;
  /** The sloppiest kid's chance of a slip per decision; the steadiest is always 0.02. */
  readonly errorRateMax: number;
  /**
   * After any spin: a fixed pause plus this many of the kid's decision intervals before it fires.
   * Held at a person's time to find the target again and never searched: a long settle balances
   * Kid against Kid, but hands every person who fires straight after a spin a free shot.
   */
  readonly settleSeconds: number;
  readonly settleThinks: number;
  /** Misjudged enemy position, in units per unit of range: a base, plus more for a sloppy eye. */
  readonly blurBase: number;
  readonly blurPerError: number;
  readonly blurPerUnit: number;
  /** Chance per bounce that a kid misjudges a bank by a heading step: a base, plus more for a sloppy eye. */
  readonly bankErrorBase: number;
  readonly bankErrorPerError: number;
  /** How far off a kid judges a moving target's speed when leading it, as a fraction either way. */
  readonly leadErrorBase: number;
  readonly leadErrorPerError: number;
  /** Chance per correction that a guided shell is steered a step or two off. */
  readonly steerErrorPerMisjudge: number;
  readonly steerErrorPerRandom: number;
  /** Chance per decision of taking the second-best shot, per unit of the kid's randomness. */
  readonly secondChoicePerRandom: number;
  /** Chance per decision of wandering off to a random spot, per unit of the kid's randomness. */
  readonly wanderPerRandom: number;
  /** Chance per decision of a wild shot, per unit of the kid's randomness. */
  readonly wildPerRandom: number;
  /** Scales how far every kid trusts itself to curl a guided shell in. */
  readonly curlScale: number;
  /** Scales how long every kid waits between corrections to a guided shell. */
  readonly steerScale: number;
  /** Within this range, with a clear line, a kid stops manoeuvring and keeps its gun on the enemy. */
  readonly closeQuarters: number;
  /** Favourite fighting range: a base, less for an aggressive kid. */
  readonly rangeBase: number;
  readonly rangePerAggression: number;
  /** After being hit: the chance to make for cover (base plus caution), and for how long. */
  readonly retreatBase: number;
  readonly retreatPerCare: number;
  readonly retreatSeconds: number;
  /** Chance per decision of sidestepping a shell that is only heading its way, per unit of caution. */
  readonly dodgePerCare: number;
  /** Seconds without scoring after which a kid will fight from half its favourite range. */
  readonly impatienceSeconds: number;
}

export const DUEL_TUNING: DuelTuning = {
  reactionSlowMs: 250,
  reactionFastMs: 129.967,
  errorRateMax: 0.32,
  settleSeconds: 0.5,
  settleThinks: 1,
  blurBase: 0.217,
  blurPerError: 1.941,
  blurPerUnit: 0.25,
  bankErrorBase: 0.099,
  bankErrorPerError: 0.655,
  leadErrorBase: 0.3,
  leadErrorPerError: 0.51,
  steerErrorPerMisjudge: 0.184,
  steerErrorPerRandom: 0.26,
  secondChoicePerRandom: 0.95,
  wanderPerRandom: 0.328,
  wildPerRandom: 0.28,
  curlScale: 0.535,
  steerScale: 0.575,
  closeQuarters: 5.429,
  rangeBase: 20.247,
  rangePerAggression: 4.304,
  retreatBase: 0.051,
  retreatPerCare: 0.054,
  retreatSeconds: 0.454,
  dodgePerCare: 0.563,
  impatienceSeconds: 21.943,
};
