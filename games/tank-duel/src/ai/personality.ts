/**
 * Maps the shared Neighbourhood Kids personalities to Tank Duel tactical styles.
 * Each character's aggression, patience, and reaction time translate into
 * shot planning depth, approach distance, bank preferences, and turn pacing.
 */
import { DUEL_TUNING, type DuelTuning } from './tuning.ts';
import { aiSettings, kidById, type KidId } from '@woodgrain-88/kit';

/** How a kid plays Tank Duel, worked out from the kit personality and settings. */
export interface DuelStyle {
  readonly kid: KidId;
  /** Seconds between fresh decisions (reaction). */
  readonly thinkEvery: number;
  /** Chance a decision's chosen heading is one step off. */
  readonly misjudge: number;
  /** How far off a plan may be and still be fired (aim slack, units). */
  readonly slack: number;
  /** Most bounces it plans (0 direct only, up to 2). */
  readonly bankDepth: number;
  /** 0–1: how keen it is to close in rather than hold position. */
  readonly push: number;
  /** 0–1: how readily it breaks off to dodge and take cover. */
  readonly care: number;
  /** 0–1: chance per decision to wander to a random spot (Pip). */
  readonly wander: number;
  /** 0–1: chance to fire a baiting guided shot away from the target and curl it in (Rosa). */
  readonly bait: number;
  /** Learns the opponent's habits (Benny). */
  readonly learns: boolean;
  /** Turns ease a step later than needed: slow, deliberate turning (Lou). */
  readonly turnLag: number;
  /**
   * How far off a straight line (units) the kid trusts its own steering to bring a guided shell in:
   * a master curls shells round corners, a wild hand only fires straight at what it sees.
   */
  readonly curlReach: number;
  /** Seconds between corrections to a guided shell's line: a steady hand corrects often. */
  readonly steerEvery: number;
  /** Chance per bounce of misjudging a bank by a heading step. */
  readonly bankMisjudge: number;
  /** How far off (a fraction either way) the kid judges a moving target's speed. */
  readonly leadError: number;
  /** The distance (units) the kid likes to fight from: a rusher closes in, a careful kid hangs back. */
  readonly preferredRange: number;
}

/** How a kid plays Tank Duel: its kit personality turned into tank handling by the tuning. */
export function duelStyle(kid: KidId, tuning: DuelTuning = DUEL_TUNING): DuelStyle {
  const p = kidById(kid).personality;
  const settings = aiSettings(kid, {
    reactionMs: [tuning.reactionSlowMs, tuning.reactionFastMs],
    errorRate: [0.02, tuning.errorRateMax],
  });

  return {
    kid,
    thinkEvery: settings.reactionMs / 1000,
    // A decision that goes wrong: the chosen heading ends a step off.
    misjudge: settings.errorRate * 0.6,
    // How near a miss a kid will still fire at: the eager fire on less, the patient wait.
    slack: Math.max(0, 0.2 + p.aggression * 1.4 - p.patience * 0.4),
    // Lou sees two-bounce banks; so does Pip, now and then, by luck as much as genius.
    bankDepth: p.error <= 0.1 || kid === 'pip' ? 2 : 1,
    push: p.aggression,
    care: p.caution,
    wander: settings.randomness * tuning.wanderPerRandom,
    bait: settings.deception * 0.5,
    learns: settings.mirror || p.adaptivity > 0.9,
    // Lou turns deliberately and sometimes runs a step past the heading he wanted.
    turnLag: p.reaction < 0.3 ? 0.08 : 0,
    // Every kid curls guided shells: a steady hand furthest, a wild one less but still boldly.
    curlReach: (1 + (1 - p.error) * 1.6 + p.patience * 0.8 + p.randomness * 0.8) * tuning.curlScale,
    // A steady hand corrects a guided shell often; a sloppy or wild one only now and then.
    steerEvery: (0.1 + p.error * 0.3 + p.randomness * 0.1) * tuning.steerScale,
    bankMisjudge: Math.min(0.9, tuning.bankErrorBase + p.error * tuning.bankErrorPerError),
    leadError: tuning.leadErrorBase + p.error * tuning.leadErrorPerError,
    // Rushers fight from about a dozen units, careful kids from twice that.
    preferredRange: tuning.rangeBase - p.aggression * tuning.rangePerAggression,
  };
}
