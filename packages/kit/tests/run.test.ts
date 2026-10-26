/**
 * Tests for the Power Cycle Run scheduler, phase transitions, scoring,
 * transition timing, share line formatting, and result recording.
 */
import { describe, expect, it } from 'vitest';
import { hashSeed } from '../src/rng.ts';
import {
  RUN_ROUNDS,
  beginRound,
  beginTransition,
  canPlanRun,
  dailyRunSeed,
  finishRound,
  planRun,
  recordRun,
  roundScore,
  runPasses,
  runResult,
  runScore,
  runShareLine,
  startRun,
  transitionTiming,
  type RunCandidate,
  type RunPlan,
} from '../src/run.ts';
import type { MicroChallengeDef, MicroResult } from '../src/micro.ts';
import type { RunsData, RunResultData } from '../src/store/types.ts';

function createChallenge(id: string, seconds = 45): MicroChallengeDef {
  return {
    id,
    channel: 'main',
    title: `Challenge ${id}`,
    goal: `Goal ${id}`,
    seconds,
    pass: { metric: { kind: 'count', event: 'hit' }, target: 3 },
  };
}

function createCandidate(game: string, challengeCount = 2): RunCandidate {
  const challenges: MicroChallengeDef[] = [];
  for (let index = 1; index <= challengeCount; index++) {
    challenges.push(createChallenge(`${game}-ch-${index}`));
  }
  return { game, challenges };
}

function createDummyPlan(): RunPlan {
  const candidates = [
    createCandidate('tank-duel'),
    createCandidate('sky-duel'),
    createCandidate('burn-rubber'),
    createCandidate('deep-dive'),
    createCandidate('star-patrol'),
  ];
  return planRun(candidates, 42);
}

function createDummyResult(
  game: string,
  challenge: string,
  passed: boolean,
  seconds: number,
): MicroResult {
  return {
    game,
    challenge,
    passed,
    score: passed ? 10 : 0,
    seconds,
  };
}

describe('planRun and canPlanRun', () => {
  it('picks exactly five distinct games, ignoring candidates with no challenges, and varies by seed', () => {
    const validCandidates = [
      createCandidate('tank-duel', 2),
      createCandidate('sky-duel', 1),
      createCandidate('empty-game', 0),
      createCandidate('burn-rubber', 2),
      createCandidate('deep-dive', 1),
      createCandidate('star-patrol', 3),
      createCandidate('laser-maze', 2),
    ];

    expect(canPlanRun(validCandidates)).toBe(true);

    const planA = planRun(validCandidates, 12345);
    expect(planA.rounds.length).toBe(RUN_ROUNDS);

    const pickedGames = planA.rounds.map((round) => round.game);
    const uniqueGames = new Set(pickedGames);
    expect(uniqueGames.size).toBe(RUN_ROUNDS);
    expect(uniqueGames.has('empty-game')).toBe(false);

    // The same seed gives the exact same plan
    const planB = planRun(validCandidates, 12345);
    expect(planB.rounds).toEqual(planA.rounds);

    // 20 different seeds yield at least 15 distinct plans
    const distinctPlans = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const plan = planRun(validCandidates, seed);
      const signature = plan.rounds.map((round) => `${round.game}:${round.challenge.id}`).join('|');
      distinctPlans.add(signature);
    }
    expect(distinctPlans.size).toBeGreaterThanOrEqual(15);

    // Below five usable candidates throws
    const tooFew = [
      createCandidate('tank-duel', 2),
      createCandidate('sky-duel', 1),
      createCandidate('empty-game', 0),
      createCandidate('burn-rubber', 2),
    ];
    expect(canPlanRun(tooFew)).toBe(false);
    expect(() => planRun(tooFew, 123)).toThrow();

    // Derives daily run seed deterministically from daily number
    const date = new Date('2026-10-25T12:00:00.000Z');
    expect(dailyRunSeed(date)).toBe(hashSeed('run/1'));
  });
});

describe('run state and phase transitions', () => {
  it('progresses through phases, enforces valid transitions, counts rounds 0-4, and reaches results', () => {
    const plan = createDummyPlan();
    let state = startRun(plan);

    expect(state.phase).toBe('intro');
    expect(state.roundIndex).toBe(0);
    expect(state.results.length).toBe(0);

    // Cannot begin round or finish round from intro
    expect(() => beginRound(state)).toThrow();
    expect(() => finishRound(state, createDummyResult('tank-duel', 'ch-1', true, 10))).toThrow();
    expect(() => runResult(state, '2026-10-25T12:00:00.000Z')).toThrow();

    state = beginTransition(state);
    expect(state.phase).toBe('transition');
    expect(state.roundIndex).toBe(0);

    // Calling beginTransition while in transition is valid
    state = beginTransition(state);
    expect(state.phase).toBe('transition');

    // Playing rounds 0 through 4
    for (let index = 0; index < RUN_ROUNDS; index++) {
      state = beginRound(state);
      expect(state.phase).toBe('round');
      expect(state.roundIndex).toBe(index);

      // Wrong phase throws
      expect(() => beginTransition(state)).toThrow();
      expect(() => beginRound(state)).toThrow();

      const currentRound = plan.rounds[index];
      if (currentRound === undefined) throw new Error(`round ${index} is missing`);
      const result = createDummyResult(
        currentRound.game,
        currentRound.challenge.id,
        index % 2 === 0,
        15,
      );

      state = finishRound(state, result);
      expect(state.results.length).toBe(index + 1);

      if (index + 1 < RUN_ROUNDS) {
        expect(state.phase).toBe('transition');
        expect(state.roundIndex).toBe(index + 1);
      } else {
        // After round 5, state enters results with roundIndex clamped to 0-4
        expect(state.phase).toBe('results');
        expect(state.roundIndex).toBe(4);
      }
    }

    // From results phase, actions throw
    expect(() => beginRound(state)).toThrow();
    expect(() => finishRound(state, createDummyResult('tank-duel', 'ch-1', true, 10))).toThrow();

    // Results snapshot can now be extracted
    const resultData = runResult(state, '2026-10-25T12:30:00.000Z');
    expect(resultData.seed).toBe(plan.seed);
    expect(resultData.rounds.length).toBe(RUN_ROUNDS);
    expect(resultData.score).toBe(runScore(state));
  });
});

describe('roundScore, runScore and runPasses', () => {
  it('scores 0 on fail, calculates time bonus for passes, and sums run results', () => {
    // Failed challenge scores 0
    const failResult = createDummyResult('tank-duel', 'ch-1', false, 45);
    expect(roundScore(failResult, 45)).toBe(0);

    const earlyFail = createDummyResult('tank-duel', 'ch-1', false, 10);
    expect(roundScore(earlyFail, 45)).toBe(0);

    // Passed with 30.4s left of 45s (seconds 14.6) scores 100 + 300 = 400
    const passWithTime = createDummyResult('tank-duel', 'ch-1', true, 14.6);
    expect(roundScore(passWithTime, 45)).toBe(400);

    // Passed at the last moment scores 100
    const passLastMoment = createDummyResult('tank-duel', 'ch-1', true, 45);
    expect(roundScore(passLastMoment, 45)).toBe(100);

    // Run totals
    const plan = createDummyPlan();
    let state = startRun(plan);
    state = beginTransition(state);
    state = beginRound(state);
    state = finishRound(state, passWithTime); // 400
    state = beginRound(state);
    state = finishRound(state, failResult); // 0
    state = beginRound(state);
    state = finishRound(state, passLastMoment); // 100

    expect(runPasses(state)).toBe(2);
    expect(runScore(state)).toBe(500);
  });
});

describe('transitionTiming', () => {
  it('matches round 0 defaults, strictly decreases across rounds, and clamps out-of-range indexes', () => {
    const round0 = transitionTiming(0);
    expect(round0).toEqual({
      dimMs: 400,
      collapseMs: 350,
      snowMs: 700,
      slideMs: 450,
      flipMs: 300,
      cardMs: 600,
    });

    for (let index = 0; index < 4; index++) {
      const current = transitionTiming(index);
      const next = transitionTiming(index + 1);

      expect(current.dimMs).toBeGreaterThan(next.dimMs);
      expect(current.collapseMs).toBeGreaterThan(next.collapseMs);
      expect(current.snowMs).toBeGreaterThan(next.snowMs);
      expect(current.slideMs).toBeGreaterThan(next.slideMs);
      expect(current.flipMs).toBeGreaterThan(next.flipMs);
      expect(current.cardMs).toBeGreaterThan(next.cardMs);
    }

    // Clamps out-of-range indexes
    expect(transitionTiming(-1)).toEqual(round0);
    expect(transitionTiming(-10)).toEqual(round0);
    expect(transitionTiming(4)).toEqual(transitionTiming(5));
    expect(transitionTiming(4)).toEqual(transitionTiming(99));
  });
});

describe('runShareLine', () => {
  it('formats pass/fail icons in round order, includes pass count, and omits number for free runs', () => {
    const plan = createDummyPlan();
    let state = startRun(plan);

    const outcomes = [true, true, false, true, true];
    for (const passed of outcomes) {
      state = beginTransition(state);
      state = beginRound(state);
      state = finishRound(state, createDummyResult('game', 'ch', passed, 20));
    }

    const numbered = runShareLine(state, 12);
    expect(numbered).toBe("Woodgrain '88 Run #12 · ✅✅❌✅✅ · 4/5");

    const free = runShareLine(state);
    expect(free).toBe("Woodgrain '88 Run · ✅✅❌✅✅ · 4/5");
  });
});

describe('recordRun', () => {
  it('orders free runs best first up to 10, keeps only the first daily run, and never mutates input', () => {
    const initial: RunsData = {
      free: [],
      daily: {},
    };

    const run100: RunResultData = {
      at: '2026-10-25T10:00:00.000Z',
      seed: 1,
      score: 100,
      rounds: [],
    };
    const run300: RunResultData = {
      at: '2026-10-25T11:00:00.000Z',
      seed: 2,
      score: 300,
      rounds: [],
    };
    const run200: RunResultData = {
      at: '2026-10-25T12:00:00.000Z',
      seed: 3,
      score: 200,
      rounds: [],
    };

    let data = recordRun(initial, run100, 'free');
    data = recordRun(data, run300, 'free');
    data = recordRun(data, run200, 'free');

    expect(data.free.map((entry) => entry.score)).toEqual([300, 200, 100]);
    expect(initial.free.length).toBe(0); // initial not mutated

    // Fill to 10 entries
    for (let score = 400; score <= 1000; score += 100) {
      data = recordRun(
        data,
        { at: '2026-10-25T13:00:00.000Z', seed: score, score, rounds: [] },
        'free',
      );
    }
    expect(data.free.length).toBe(10);
    expect(data.free[0]?.score).toBe(1000);
    // 1000 down to 400, then the first three: the tenth place is 100.
    expect(data.free[9]?.score).toBe(100);

    // Score lower than all 10 is not kept
    const lowRun: RunResultData = {
      at: '2026-10-25T14:00:00.000Z',
      seed: 50,
      score: 50,
      rounds: [],
    };
    const dataWithLow = recordRun(data, lowRun, 'free');
    expect(dataWithLow.free.length).toBe(10);
    expect(dataWithLow.free.some((entry) => entry.score === 50)).toBe(false);

    // Daily runs: first run of a day counts, subsequent runs ignored
    const dailyDay1First: RunResultData = {
      at: '2026-10-25T08:00:00.000Z',
      seed: 10,
      score: 250,
      rounds: [],
    };
    const dailyDay1Second: RunResultData = {
      at: '2026-10-25T18:00:00.000Z',
      seed: 11,
      score: 500,
      rounds: [],
    };
    const dailyDay2: RunResultData = {
      at: '2026-10-26T08:00:00.000Z',
      seed: 12,
      score: 400,
      rounds: [],
    };

    let dailyData = recordRun(initial, dailyDay1First, 'daily', '2026-10-25');
    expect(dailyData.daily['2026-10-25']?.score).toBe(250);

    dailyData = recordRun(dailyData, dailyDay1Second, 'daily', '2026-10-25');
    expect(dailyData.daily['2026-10-25']?.score).toBe(250);

    dailyData = recordRun(dailyData, dailyDay2, 'daily', '2026-10-26');
    expect(dailyData.daily['2026-10-26']?.score).toBe(400);

    expect(initial.daily['2026-10-25']).toBeUndefined();
  });
});
