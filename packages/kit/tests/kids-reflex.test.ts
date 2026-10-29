import { describe, expect, it } from 'vitest';
import { KID_IDS } from '../src/kids.ts';
import {
  FORESEEN_SHARE,
  PANIC_LAG,
  createKidReflex,
  KID_REFLEXES,
  reflexProfile,
  type Pressure,
  type ReflexEvent,
  type ReflexProfile,
} from '../src/kids/reflex.ts';
import { createRng } from '../src/rng.ts';

const calm: Pressure = { speed: 0, cramp: 0 };
const halfPressure: Pressure = { speed: 0.5, cramp: 0.5 };
const fullPressure: Pressure = { speed: 1, cramp: 1 };

describe('Kid reflex profiles', () => {
  it('gives every Kid in KID_IDS a profile with the table values', () => {
    for (const kid of KID_IDS) {
      expect(KID_REFLEXES[kid]).toBeDefined();
    }

    expect(KID_REFLEXES.lou).toEqual({
      reactionMs: { mean: 360, spread: 40 },
      lookahead: 7,
      awareness: 9,
      attention: 0.9,
      panic: 0.15,
      slipRate: 0.05,
      style: { space: 0.9, cutOff: 0.3, safety: 0.8, mirror: 0 },
    });

    expect(KID_REFLEXES.moss).toEqual({
      reactionMs: { mean: 260, spread: 40 },
      lookahead: 6,
      awareness: 7,
      attention: 0.8,
      panic: 0.2,
      slipRate: 0.06,
      style: { space: 1, cutOff: 0.2, safety: 0.9, mirror: 0 },
    });

    expect(KID_REFLEXES.rosa).toEqual({
      reactionMs: { mean: 220, spread: 50 },
      lookahead: 5,
      awareness: 6,
      attention: 0.85,
      panic: 0.45,
      slipRate: 0.07,
      style: { space: 0.4, cutOff: 1, safety: 0.4, mirror: 0 },
    });

    expect(KID_REFLEXES.benny).toEqual({
      reactionMs: { mean: 240, spread: 50 },
      lookahead: 5,
      awareness: 6,
      attention: 0.8,
      panic: 0.45,
      slipRate: 0.07,
      style: { space: 0.5, cutOff: 0.3, safety: 0.5, mirror: 1 },
    });

    expect(KID_REFLEXES.dee).toEqual({
      reactionMs: { mean: 160, spread: 30 },
      lookahead: 3,
      awareness: 4,
      attention: 0.7,
      panic: 0.6,
      slipRate: 0.05,
      style: { space: 0.25, cutOff: 0.25, safety: 0.4, mirror: 0 },
    });

    expect(KID_REFLEXES.pip).toEqual({
      reactionMs: { mean: 280, spread: 60 },
      lookahead: 3,
      awareness: 4,
      attention: 0.5,
      panic: 0.5,
      slipRate: 0.08,
      style: { space: 0.4, cutOff: 0.4, safety: 0.3, mirror: 0 },
    });
  });

  it(
    'holds character traits: Dee is quickest by mean, Lou reads furthest ahead, ' +
      'Pip has widest spread',
    () => {
      const allProfiles = KID_IDS.map((id) => KID_REFLEXES[id]);

      const fastestMean = Math.min(...allProfiles.map((p) => p.reactionMs.mean));
      expect(KID_REFLEXES.dee.reactionMs.mean).toBe(fastestMean);

      const maxLookahead = Math.max(...allProfiles.map((p) => p.lookahead));
      expect(KID_REFLEXES.lou.lookahead).toBe(maxLookahead);

      const widestSpread = Math.max(...allProfiles.map((p) => p.reactionMs.spread));
      expect(KID_REFLEXES.pip.reactionMs.spread).toBe(widestSpread);
    },
  );

  it('returns table entry in human mode and halved reaction times with zero slips in sharp', () => {
    for (const kid of KID_IDS) {
      expect(reflexProfile(kid, 'human')).toBe(KID_REFLEXES[kid]);

      const sharp = reflexProfile(kid, 'sharp');
      const human = KID_REFLEXES[kid];

      expect(sharp.slipRate).toBe(0);
      expect(sharp.reactionMs.mean).toBe(human.reactionMs.mean / 2);
      expect(sharp.reactionMs.spread).toBe(human.reactionMs.spread / 2);
      expect(sharp.lookahead).toBe(human.lookahead);
      expect(sharp.awareness).toBe(human.awareness);
      expect(sharp.attention).toBe(human.attention);
      expect(sharp.panic).toBe(human.panic);
      expect(sharp.style).toEqual(human.style);
    }
  });
});

describe('Reaction delays and normal distribution draws', () => {
  it('draws reaction delays over 2,000 draws within 5% mean and 15% spread, floor at 40%', () => {
    const profile = reflexProfile('lou', 'sharp');
    const reflex = createKidReflex<string>(profile, createRng('lou-delay-check'));

    const sampleCount = 2000;
    const delays: number[] = [];

    for (let index = 0; index < sampleCount; index++) {
      reflex.decide('step', index * 1000, calm, []);
      const decidedEvent = reflex.log[reflex.log.length - 1];
      expect(decidedEvent?.kind).toBe('decided');
      if (decidedEvent?.delayMs !== undefined) {
        delays.push(decidedEvent.delayMs);
      }
    }

    expect(delays).toHaveLength(sampleCount);

    const minAllowed = profile.reactionMs.mean * 0.4;
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(minAllowed);
      expect(Number.isInteger(delay)).toBe(true);
    }

    const mean = delays.reduce((sum, d) => sum + d, 0) / sampleCount;
    const variance = delays.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / sampleCount;
    const stdDev = Math.sqrt(variance);

    const meanDiff = Math.abs(mean - profile.reactionMs.mean) / profile.reactionMs.mean;
    expect(meanDiff).toBeLessThan(0.05);

    const spreadDiff = Math.abs(stdDev - profile.reactionMs.spread) / profile.reactionMs.spread;
    expect(spreadDiff).toBeLessThan(0.15);
  });

  it('preserves the 40% floor and spread on Pip who has the widest variance', () => {
    const profile = reflexProfile('pip', 'sharp');
    const reflex = createKidReflex<string>(profile, createRng('pip-delay-check'));

    const sampleCount = 2000;
    const delays: number[] = [];

    for (let index = 0; index < sampleCount; index++) {
      reflex.decide('step', index * 1000, calm, []);
      const decidedEvent = reflex.log[reflex.log.length - 1];
      if (decidedEvent?.delayMs !== undefined) {
        delays.push(decidedEvent.delayMs);
      }
    }

    const minAllowed = profile.reactionMs.mean * 0.4;
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(minAllowed);
    }

    const mean = delays.reduce((sum, d) => sum + d, 0) / sampleCount;
    const variance = delays.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / sampleCount;
    const stdDev = Math.sqrt(variance);

    const meanDiff = Math.abs(mean - profile.reactionMs.mean) / profile.reactionMs.mean;
    expect(meanDiff).toBeLessThan(0.05);

    const spreadDiff = Math.abs(stdDev - profile.reactionMs.spread) / profile.reactionMs.spread;
    expect(spreadDiff).toBeLessThan(0.15);
  });
});

describe('Decision timing and execution', () => {
  it('times a foreseen move in a fraction of a reaction', () => {
    const steady = { ...KID_REFLEXES.moss, slipRate: 0, reactionMs: { mean: 300, spread: 0 } };
    const reflex = createKidReflex<string>(steady, createRng('foreseen'));
    reflex.decide('left', 0, calm, [], true);
    expect(reflex.log.at(-1)?.delayMs).toBe(Math.round(300 * FORESEEN_SHARE));
    reflex.decide('right', 1000, calm, []);
    expect(reflex.log.at(-1)?.delayMs).toBe(300);
  });

  it('does not act before its delay and acts at the first act call at or after it', () => {
    const profile = reflexProfile('moss', 'sharp');
    const reflex = createKidReflex<string>(profile, createRng('moss-timing'));

    reflex.decide('UP', 100, calm, []);
    const decided = reflex.log.find((e) => e.kind === 'decided');
    expect(decided).toBeDefined();
    const delay = decided?.delayMs ?? 0;
    const readyAt = 100 + delay;

    expect(reflex.act(100)).toBeNull();
    expect(reflex.act(readyAt - 1)).toBeNull();

    expect(reflex.act(readyAt)).toBe('UP');

    const actedEvents = reflex.log.filter((e) => e.kind === 'acted');
    expect(actedEvents).toHaveLength(1);
    expect(actedEvents[0]).toEqual({
      kind: 'acted',
      at: readyAt,
      action: 'UP',
    });

    expect(reflex.act(readyAt + 50)).toBe('UP');
    expect(reflex.log.filter((e) => e.kind === 'acted')).toHaveLength(1);
  });

  it('replaces a decision still on its way when a newer decision arrives', () => {
    const profile: ReflexProfile = {
      ...KID_REFLEXES.lou,
      reactionMs: { mean: 200, spread: 0 },
      slipRate: 0,
    };
    const reflex = createKidReflex<string>(profile, createRng('replace-test'));

    reflex.decide('FIRST', 0, calm, []);
    expect(reflex.act(50)).toBeNull();

    reflex.decide('SECOND', 100, calm, []);

    expect(reflex.act(200)).toBeNull();

    expect(reflex.act(300)).toBe('SECOND');

    const acted = reflex.log.filter((e) => e.kind === 'acted');
    expect(acted).toHaveLength(1);
    expect(acted[0]?.action).toBe('SECOND');
  });

  it('keeps returning the last performed action until a newer decision passes', () => {
    const profile: ReflexProfile = {
      ...KID_REFLEXES.lou,
      reactionMs: { mean: 100, spread: 0 },
      slipRate: 0,
    };
    const reflex = createKidReflex<string>(profile, createRng('steady-action'));

    reflex.decide('A', 0, calm, []);
    expect(reflex.act(100)).toBe('A');

    reflex.decide('B', 150, calm, []);
    expect(reflex.act(200)).toBe('A');
    expect(reflex.act(250)).toBe('B');
  });
});

describe('Panic under pressure', () => {
  it('expects its mean reaction, lengthened by panic', () => {
    const kid = KID_REFLEXES.dee;
    const reflex = createKidReflex<string>(kid, createRng('dee-expects'));
    expect(reflex.expectedDelay(calm)).toBe(kid.reactionMs.mean);
    expect(reflex.expectedDelay(fullPressure)).toBe(
      Math.round(kid.reactionMs.mean * (1 + PANIC_LAG * kid.panic)),
    );
    expect(reflex.expectedDelay(calm, true)).toBe(Math.round(kid.reactionMs.mean * FORESEEN_SHARE));
  });

  it('lengthens delays, raises slips and lowers noticing', () => {
    const kid = KID_REFLEXES.dee;

    const trials = 4000;
    let noticedCalm = 0;
    let noticedFull = 0;

    const calmTester = createKidReflex<string>(kid, createRng('noticing-calm'));
    const fullTester = createKidReflex<string>(kid, createRng('noticing-full'));

    for (let index = 0; index < trials; index++) {
      if (calmTester.notices(index, calm)) noticedCalm++;
      if (fullTester.notices(index, fullPressure)) noticedFull++;
    }

    const rateCalm = noticedCalm / trials;
    const rateFull = noticedFull / trials;

    const expectedCalm = kid.attention;
    const expectedFull = kid.attention * (1 - 0.5 * kid.panic);

    expect(Math.abs(rateCalm - expectedCalm)).toBeLessThan(0.04);
    expect(Math.abs(rateFull - expectedFull)).toBeLessThan(0.04);
    expect(rateFull).toBeLessThan(rateCalm);

    const steadyProfile: ReflexProfile = {
      ...kid,
      reactionMs: { mean: 200, spread: 0 },
      slipRate: 0,
    };
    const steadyCalm = createKidReflex<string>(steadyProfile, createRng('steady-calm'));
    steadyCalm.decide('GO', 0, calm, []);
    expect(steadyCalm.log[0]?.delayMs).toBe(200);

    const steadyFull = createKidReflex<string>(steadyProfile, createRng('steady-full'));
    steadyFull.decide('GO', 0, fullPressure, []);
    expect(steadyFull.log[0]?.delayMs).toBe(Math.round(200 * (1 + PANIC_LAG * kid.panic)));
  });
});

describe('Slips and error handling', () => {
  it('plans on what the hands will really do after a wrong slip, not on what was meant', () => {
    const fumbler = { ...KID_REFLEXES.pip, slipRate: 1 };
    const reflex = createKidReflex<string>(fumbler, createRng('fumble'));
    let sawWrong = false;
    for (let attempt = 0; attempt < 40 && !sawWrong; attempt++) {
      reflex.decide('left', attempt * 1000, calm, ['up']);
      const last = reflex.log.at(-1);
      if (last?.kind === 'slipped-wrong') {
        sawWrong = true;
        expect(reflex.planned()).toBe('up');
      } else {
        expect(reflex.planned()).toBe('left');
      }
    }
    expect(sawWrong).toBe(true);
  });

  it('slips over 5,000 decisions at expected rate, split evenly between late and wrong', () => {
    const kid = KID_REFLEXES.pip;
    const reflex = createKidReflex<string>(kid, createRng('pip-slips'));
    const alternatives = ['UP', 'DOWN', 'LEFT'] as const;

    const totalDecisions = 5000;
    for (let index = 0; index < totalDecisions; index++) {
      reflex.decide('RIGHT', index * 1000, calm, alternatives);
    }

    const lateSlips = reflex.log.filter((e) => e.kind === 'slipped-late');
    const wrongSlips = reflex.log.filter((e) => e.kind === 'slipped-wrong');
    const totalSlips = lateSlips.length + wrongSlips.length;
    const slipRateObserved = totalSlips / totalDecisions;

    expect(Math.abs(slipRateObserved - kid.slipRate)).toBeLessThan(0.02);

    expect(lateSlips.length).toBeGreaterThan(0);
    expect(wrongSlips.length).toBeGreaterThan(0);
    const lateFraction = lateSlips.length / totalSlips;
    expect(Math.abs(lateFraction - 0.5)).toBeLessThan(0.12);

    for (const wrong of wrongSlips) {
      expect(wrong.intended).toBe('RIGHT');
      expect(alternatives).toContain(wrong.action);
    }
  });

  it('produces only late slips when alternatives list is empty', () => {
    const kid = KID_REFLEXES.pip;
    const reflex = createKidReflex<string>(kid, createRng('pip-no-alts'));

    for (let index = 0; index < 1500; index++) {
      reflex.decide('RIGHT', index * 1000, calm, []);
    }

    const lateSlips = reflex.log.filter((e) => e.kind === 'slipped-late');
    const wrongSlips = reflex.log.filter((e) => e.kind === 'slipped-wrong');

    expect(lateSlips.length).toBeGreaterThan(0);
    expect(wrongSlips.length).toBe(0);
  });
});

describe('Reflex event logging format and contents', () => {
  it('records decided, acted, slipped-late, slipped-wrong, noticed, and missed accurately', () => {
    const profile: ReflexProfile = {
      ...KID_REFLEXES.dee,
      reactionMs: { mean: 100, spread: 0 },
      panic: 0,
      slipRate: 1,
    };
    const reflex = createKidReflex<string>(profile, createRng('event-log-sample'));

    reflex.notices(10, calm);

    reflex.decide('TURN', 20, calm, []);
    const lateSlip = reflex.log.find((e) => e.kind === 'slipped-late');
    expect(lateSlip).toMatchObject({
      kind: 'slipped-late',
      at: 20,
      action: 'TURN',
    });

    const lateDecided = reflex.log.find((e) => e.kind === 'decided');
    expect(lateDecided).toMatchObject({
      kind: 'decided',
      at: 20,
      action: 'TURN',
      delayMs: 200,
    });

    reflex.reset();
    expect(reflex.log.length).toBeGreaterThan(0);

    const kindsPresent = new Set<ReflexEvent<string>['kind']>();
    for (let step = 0; step < 200; step++) {
      const now = step * 100;
      reflex.notices(now, calm);
      reflex.decide('MOVE', now, calm, ['ALT1', 'ALT2']);
      reflex.act(now + 250);
    }

    for (const event of reflex.log) {
      kindsPresent.add(event.kind);
      expect(typeof event.at).toBe('number');
      if (event.kind === 'decided') {
        expect(typeof event.delayMs).toBe('number');
        expect(event.action).toBeDefined();
      }
      if (event.kind === 'acted') {
        expect(event.action).toBeDefined();
      }
      if (event.kind === 'slipped-wrong') {
        expect(event.intended).toBe('MOVE');
        expect(event.action).toMatch(/ALT1|ALT2/);
      }
    }

    expect(kindsPresent.has('decided')).toBe(true);
    expect(kindsPresent.has('acted')).toBe(true);
    expect(kindsPresent.has('slipped-late')).toBe(true);
    expect(kindsPresent.has('slipped-wrong')).toBe(true);
    expect(kindsPresent.has('noticed')).toBe(true);
    expect(kindsPresent.has('missed')).toBe(true);
  });
});

describe('Determinism and reset', () => {
  it('gives identical logs with the same seed and different logs with a different seed', () => {
    function simulate(seed: string): readonly ReflexEvent<string>[] {
      const reflex = createKidReflex<string>(KID_REFLEXES.pip, createRng(seed));
      for (let step = 0; step < 50; step++) {
        const time = step * 100;
        reflex.notices(time, halfPressure);
        reflex.decide(`act-${step % 4}`, time, halfPressure, ['altA', 'altB']);
        reflex.act(time + 150);
      }
      return reflex.log;
    }

    const runA = simulate('deterministic-run');
    const runB = simulate('deterministic-run');
    const runC = simulate('other-seed');

    expect(runA).toEqual(runB);
    expect(runA).not.toEqual(runC);
  });

  it('forgets pending decisions on reset but keeps the historical log', () => {
    const profile: ReflexProfile = {
      ...KID_REFLEXES.lou,
      reactionMs: { mean: 200, spread: 0 },
      slipRate: 0,
    };
    const reflex = createKidReflex<string>(profile, createRng('reset-test'));

    reflex.decide('MOVE', 0, calm, []);
    const logLengthBefore = reflex.log.length;
    expect(logLengthBefore).toBe(1);

    reflex.reset();

    expect(reflex.log).toHaveLength(logLengthBefore);

    expect(reflex.act(300)).toBeNull();
  });
});
