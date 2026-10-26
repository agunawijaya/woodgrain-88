/**
 * Tests for Neighbourhood Kids helpers: AI personality mapping, result recording,
 * and Block Ladder progression.
 */
import { describe, expect, it } from 'vitest';
import {
  BLOCK_LADDER,
  DEFAULT_AI_RANGES,
  KID_IDS,
  KIDS,
  aiSettings,
  blockLadder,
  errorRateForRound,
  kidById,
  recordKidResult,
  type AiRanges,
  type AiSettings,
  type Kid,
  type KidId,
} from '../src/kids.ts';
import type { DenLifeData } from '../src/store/types.ts';

describe('neighbourhood kids roster integrity', () => {
  it('has six kids matching KID_IDS with bounded personalities, short bios, and a ladder permutation', () => {
    expect(KIDS).toHaveLength(6);
    expect(KID_IDS).toHaveLength(6);

    const rosterIds = KIDS.map((kid) => kid.id);
    expect(rosterIds).toEqual(expect.arrayContaining([...KID_IDS]));

    for (const kid of KIDS) {
      expect(kid.bio.length).toBeLessThanOrEqual(160);

      const p = kid.personality;
      const values = [
        p.aggression,
        p.caution,
        p.reaction,
        p.error,
        p.randomness,
        p.patience,
        p.deception,
        p.adaptivity,
        p.streakiness,
      ];
      for (const val of values) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }

    expect(BLOCK_LADDER).toHaveLength(KID_IDS.length);
    const sortedLadder = [...BLOCK_LADDER].sort();
    const sortedIds = [...KID_IDS].sort();
    expect(sortedLadder).toEqual(sortedIds);
  });
});

describe('kidById', () => {
  it('returns the kid for a valid id and throws for an unknown id cast through as', () => {
    for (const id of KID_IDS) {
      const kid = kidById(id);
      expect(kid.id).toBe(id);
    }

    expect(() => kidById('ghost' as KidId)).toThrow();
  });
});

describe('aiSettings', () => {
  it('maps personality traits to AI knobs using linear interpolation and clamps', () => {
    const dee = kidById('dee');
    const settings = aiSettings(dee);

    // reactionMs: round(lerp(900, 150, 0.85)) = round(900 - 637.5) = 263
    expect(settings.reactionMs).toBe(263);
    // errorRate: lerp(0.02, 0.35, 0.45) = 0.02 + 0.1485 = 0.1685
    expect(settings.errorRate).toBeCloseTo(0.1685, 4);
    // risk: clamp01(0.6 * 0.9 + 0.4 * (1 - 0.15)) = clamp01(0.54 + 0.34) = 0.88
    expect(settings.risk).toBeCloseTo(0.88, 4);
    // randomness & deception: copied directly from personality
    expect(settings.randomness).toBe(0.3);
    expect(settings.deception).toBe(0.3);
    // memory: round(lerp(0, 12, 0.3)) = round(3.6) = 4
    expect(settings.memory).toBe(4);
    // mirror: mirrorsPlayer
    expect(settings.mirror).toBe(false);
    // swing: streakiness
    expect(settings.swing).toBe(0.4);

    // Boundary synthetic kids to verify lerp endpoints and clamp01
    const minKid: Kid = {
      id: 'pip',
      name: 'Min',
      style: 'Slow, cautious, steady',
      bio: 'Boundary test case.',
      personality: {
        aggression: 0,
        caution: 1,
        reaction: 0,
        error: 0,
        randomness: 0,
        patience: 1,
        deception: 0,
        adaptivity: 0,
        streakiness: 0,
      },
      mirrorsPlayer: false,
      portrait: dee.portrait,
    };
    const minSettings = aiSettings(minKid);
    expect(minSettings.reactionMs).toBe(900);
    expect(minSettings.errorRate).toBe(0.02);
    expect(minSettings.risk).toBe(0);
    expect(minSettings.memory).toBe(0);

    const maxKid: Kid = {
      id: 'benny',
      name: 'Max',
      style: 'Fast, bold, sloppy',
      bio: 'Boundary test case.',
      personality: {
        aggression: 1,
        caution: 0,
        reaction: 1,
        error: 1,
        randomness: 1,
        patience: 0,
        deception: 1,
        adaptivity: 1,
        streakiness: 1,
      },
      mirrorsPlayer: true,
      portrait: dee.portrait,
    };
    const maxSettings = aiSettings(maxKid);
    expect(maxSettings.reactionMs).toBe(150);
    expect(maxSettings.errorRate).toBe(0.35);
    expect(maxSettings.risk).toBe(1);
    expect(maxSettings.memory).toBe(12);
    expect(maxSettings.mirror).toBe(true);
  });

  it('merges partial ranges over the defaults and accepts KidId or Kid identically', () => {
    const fromId = aiSettings('benny');
    const fromKid = aiSettings(kidById('benny'));
    expect(fromId).toEqual(fromKid);

    const customRanges: Partial<AiRanges> = {
      reactionMs: [1200, 300],
      memory: [0, 20],
    };
    const customized = aiSettings('benny', customRanges);

    // Benny reaction is 0.6: round(lerp(1200, 300, 0.6)) = round(1200 - 540) = 660
    expect(customized.reactionMs).toBe(660);
    // Benny adaptivity is 0.95: round(lerp(0, 20, 0.95)) = round(19) = 19
    expect(customized.memory).toBe(19);
    // errorRate remains on the default range [0.02, 0.35]
    expect(customized.errorRate).toBeCloseTo(0.02 + 0.33 * 0.35, 4);
    expect(DEFAULT_AI_RANGES.reactionMs).toEqual([900, 150]);
  });

  it('satisfies expected ordering sanity tests across the roster', () => {
    const dee = aiSettings('dee');
    const lou = aiSettings('lou');
    const pip = aiSettings('pip');
    const rosa = aiSettings('rosa');
    const benny = aiSettings('benny');
    const moss = aiSettings('moss');

    // Dee reacts faster (lower reactionMs) than Grandpa Lou
    expect(dee.reactionMs).toBeLessThan(lou.reactionMs);

    // Lou has the lowest error rate of all six
    for (const kid of KIDS) {
      if (kid.id !== 'lou') {
        expect(lou.errorRate).toBeLessThan(aiSettings(kid.id).errorRate);
      }
    }

    // Pip has the highest randomness and swing
    for (const kid of KIDS) {
      if (kid.id !== 'pip') {
        expect(pip.randomness).toBeGreaterThan(aiSettings(kid.id).randomness);
        expect(pip.swing).toBeGreaterThan(aiSettings(kid.id).swing);
      }
    }

    // Rosa has the highest deception
    for (const kid of KIDS) {
      if (kid.id !== 'rosa') {
        expect(rosa.deception).toBeGreaterThan(aiSettings(kid.id).deception);
      }
    }

    // Benny has the most memory and is the only one with mirror true
    for (const kid of KIDS) {
      if (kid.id !== 'benny') {
        expect(benny.memory).toBeGreaterThan(aiSettings(kid.id).memory);
        expect(aiSettings(kid.id).mirror).toBe(false);
      }
    }
    expect(benny.mirror).toBe(true);

    // Dee has the highest risk and Moss the lowest
    for (const kid of KIDS) {
      if (kid.id !== 'dee') {
        expect(dee.risk).toBeGreaterThan(aiSettings(kid.id).risk);
      }
      if (kid.id !== 'moss') {
        expect(moss.risk).toBeLessThan(aiSettings(kid.id).risk);
      }
    }
  });
});

describe('errorRateForRound', () => {
  it('scales error rate with swing and draw while clamping within [0, 1]', () => {
    const steadySettings: AiSettings = {
      reactionMs: 400,
      errorRate: 0.15,
      risk: 0.5,
      randomness: 0.2,
      deception: 0.2,
      memory: 4,
      mirror: false,
      swing: 0,
    };

    // With swing 0 it returns errorRate for every draw
    expect(errorRateForRound(steadySettings, 0)).toBe(0.15);
    expect(errorRateForRound(steadySettings, 0.5)).toBe(0.15);
    expect(errorRateForRound(steadySettings, 1)).toBe(0.15);

    const swingingSettings: AiSettings = {
      ...steadySettings,
      swing: 0.5,
    };

    // draw 0.5 returns base errorRate
    expect(errorRateForRound(swingingSettings, 0.5)).toBe(0.15);

    // draw 0 is hottest spell (lowest errorRate: 0.15 * (1 - 0.5) = 0.075)
    const hotRate = errorRateForRound(swingingSettings, 0);
    // draw 1 is coldest spell (highest errorRate: 0.15 * (1 + 0.5) = 0.225)
    const coldRate = errorRateForRound(swingingSettings, 1);
    expect(hotRate).toBeCloseTo(0.075, 4);
    expect(coldRate).toBeCloseTo(0.225, 4);
    expect(hotRate).toBeLessThan(coldRate);

    // Extreme settings clamp within [0, 1]
    const extremeSettings: AiSettings = {
      ...steadySettings,
      errorRate: 0.8,
      swing: 0.9,
    };
    // 0.8 * (1 + 0.9) = 1.52 -> clamped to 1
    expect(errorRateForRound(extremeSettings, 1)).toBe(1);

    const zeroSettings: AiSettings = {
      ...steadySettings,
      errorRate: 0.2,
      swing: 1,
    };
    // 0.2 * (1 - 1) = 0 -> clamped to 0
    expect(errorRateForRound(zeroSettings, 0)).toBe(0);
  });
});

describe('recordKidResult', () => {
  it('updates records cleanly, tracks first wins on A, and preserves input immutability', () => {
    const initialKids: DenLifeData['kids'] = Object.freeze({});
    const t1 = '2026-10-26T10:00:00.000Z';
    const t2 = '2026-10-26T10:30:00.000Z';
    const t3 = '2026-10-26T11:00:00.000Z';

    // Fresh record created for first encounter on loss
    const afterLoss = recordKidResult(initialKids, 'pip', 'loss', false, t1);
    expect(afterLoss.pip).toEqual({
      wins: 0,
      losses: 1,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: null,
      firstBeatenOnAAt: null,
    });
    // Initial object was not mutated
    expect(initialKids.pip).toBeUndefined();

    // Draw increments draws only
    const afterDraw = recordKidResult(afterLoss, 'pip', 'draw', true, t1);
    expect(afterDraw.pip).toEqual({
      wins: 0,
      losses: 1,
      draws: 1,
      winsOnA: 0,
      firstBeatenAt: null,
      firstBeatenOnAAt: null,
    });

    // Win on B sets wins and firstBeatenAt, but not winsOnA or firstBeatenOnAAt
    const afterWinB = recordKidResult(afterDraw, 'pip', 'win', false, t2);
    expect(afterWinB.pip).toEqual({
      wins: 1,
      losses: 1,
      draws: 1,
      winsOnA: 0,
      firstBeatenAt: t2,
      firstBeatenOnAAt: null,
    });

    // Win on A increments wins and winsOnA, sets firstBeatenOnAAt, and preserves firstBeatenAt
    const afterWinA = recordKidResult(afterWinB, 'pip', 'win', true, t3);
    expect(afterWinA.pip).toEqual({
      wins: 2,
      losses: 1,
      draws: 1,
      winsOnA: 1,
      firstBeatenAt: t2,
      firstBeatenOnAAt: t3,
    });

    // Further win on A does not overwrite timestamps
    const t4 = '2026-10-26T12:00:00.000Z';
    const afterAnotherWinA = recordKidResult(afterWinA, 'pip', 'win', true, t4);
    expect(afterAnotherWinA.pip?.firstBeatenAt).toBe(t2);
    expect(afterAnotherWinA.pip?.firstBeatenOnAAt).toBe(t3);
    expect(afterAnotherWinA.pip?.wins).toBe(3);
    expect(afterAnotherWinA.pip?.winsOnA).toBe(2);

    // First win on A sets both firstBeatenAt and firstBeatenOnAAt together
    const freshWinA = recordKidResult({}, 'dee', 'win', true, t1);
    expect(freshWinA.dee).toEqual({
      wins: 1,
      losses: 0,
      draws: 0,
      winsOnA: 1,
      firstBeatenAt: t1,
      firstBeatenOnAAt: t1,
    });
  });
});

describe('blockLadder', () => {
  it('determines rung, next kid, champion status, and beatenOnA in ladder order', () => {
    // Empty records: rung 0, next is bottom of ladder (Pip), not champion
    const emptyView = blockLadder({});
    expect(emptyView.rung).toBe(0);
    expect(emptyView.next).toBe('pip');
    expect(emptyView.champion).toBe(false);
    expect(emptyView.beatenOnA).toEqual([]);

    // Beating kids out of order (e.g. Lou and Dee) does not climb rungs until Pip is beaten
    let records: DenLifeData['kids'] = {};
    records = recordKidResult(records, 'lou', 'win', true, '2026-10-26T10:00:00.000Z');
    records = recordKidResult(records, 'dee', 'win', false, '2026-10-26T10:05:00.000Z');

    const outOfOrderView = blockLadder(records);
    expect(outOfOrderView.rung).toBe(0);
    expect(outOfOrderView.next).toBe('pip');
    expect(outOfOrderView.champion).toBe(false);
    expect(outOfOrderView.beatenOnA).toEqual(['lou']);

    // Now beat Pip on A: rung becomes 1, next is Benny
    records = recordKidResult(records, 'pip', 'win', true, '2026-10-26T10:10:00.000Z');
    const pipView = blockLadder(records);
    expect(pipView.rung).toBe(1);
    expect(pipView.next).toBe('benny');
    expect(pipView.beatenOnA).toEqual(['pip', 'lou']);

    // Beat Benny: rung becomes 3 because Dee was already beaten!
    records = recordKidResult(records, 'benny', 'win', false, '2026-10-26T10:15:00.000Z');
    const bennyView = blockLadder(records);
    expect(bennyView.rung).toBe(3);
    expect(bennyView.next).toBe('rosa');

    // Beat Rosa and Moss
    records = recordKidResult(records, 'rosa', 'win', true, '2026-10-26T10:20:00.000Z');
    records = recordKidResult(records, 'moss', 'win', false, '2026-10-26T10:25:00.000Z');

    // All six are now beaten (since Lou was beaten first)
    const championView = blockLadder(records);
    expect(championView.rung).toBe(6);
    expect(championView.next).toBeNull();
    expect(championView.champion).toBe(true);
    // beatenOnA follows BLOCK_LADDER order: pip, rosa, lou
    expect(championView.beatenOnA).toEqual(['pip', 'rosa', 'lou']);
  });
});
