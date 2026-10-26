/**
 * The Power Cycle Run scheduler and state machine. Five games, each started
 * with one of its 45-second micro-challenges. The power switch flips by itself
 * between rounds, a little faster each round, leading to a final results tally
 * and sharable summary.
 */
import { dailyNumber, utcDateKey } from './daily.ts';
import type { MicroChallengeDef, MicroResult } from './micro.ts';
import { MICRO_DEFAULT_SECONDS } from './micro.ts';
import { createRng, hashSeed } from './rng.ts';
import { RECORDS_PER_BOARD } from './store/types.ts';
import type { RunResultData, RunRoundData, RunsData } from './store/types.ts';
import type { IsoTime } from './types.ts';

export const RUN_ROUNDS = 5;

export interface RunCandidate {
  game: string;
  challenges: readonly MicroChallengeDef[];
}

export interface RunRound {
  game: string;
  challenge: MicroChallengeDef;
}

export interface RunPlan {
  seed: number;
  rounds: readonly RunRound[];
}

export type RunPhase = 'intro' | 'transition' | 'round' | 'results';

export interface RunState {
  readonly plan: RunPlan;
  readonly phase: RunPhase;
  /** 0-based index of the current or upcoming round. */
  readonly roundIndex: number;
  readonly results: readonly MicroResult[];
}

export interface TransitionTiming {
  dimMs: number;
  collapseMs: number;
  snowMs: number;
  slideMs: number;
  flipMs: number;
  cardMs: number;
}

const BASE_TRANSITION: TransitionTiming = {
  dimMs: 400,
  collapseMs: 350,
  snowMs: 700,
  slideMs: 450,
  flipMs: 300,
  cardMs: 600,
};

const PASS_ICON = '\u2705';
const FAIL_ICON = '\u274C';

function usableCandidates(candidates: readonly RunCandidate[]): RunCandidate[] {
  const seen = new Set<string>();
  const usable: RunCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.challenges.length > 0 && !seen.has(candidate.game)) {
      seen.add(candidate.game);
      usable.push(candidate);
    }
  }
  return usable;
}

/** At least RUN_ROUNDS candidates with one or more challenges each. */
export function canPlanRun(candidates: readonly RunCandidate[]): boolean {
  return usableCandidates(candidates).length >= RUN_ROUNDS;
}

/** Five distinct games in a seeded order, each with one seeded challenge. Throws if `canPlanRun` is false. */
export function planRun(candidates: readonly RunCandidate[], seed: number): RunPlan {
  const usable = usableCandidates(candidates);
  if (usable.length < RUN_ROUNDS) {
    throw new Error(`Cannot plan run: need at least ${RUN_ROUNDS} usable candidates.`);
  }

  // Pre-sorting by game id guarantees identical order regardless of candidate input order
  const sorted = [...usable].sort((a, b) => (a.game < b.game ? -1 : a.game > b.game ? 1 : 0));
  const rng = createRng(seed);
  const shuffledGames = rng.shuffle(sorted).slice(0, RUN_ROUNDS);

  const rounds: RunRound[] = shuffledGames.map((candidate) => ({
    game: candidate.game,
    challenge: rng.pick(candidate.challenges),
  }));

  return {
    seed,
    rounds,
  };
}

/** The day's run is the same for everyone: hashSeed(`run/${dailyNumber(date)}`). */
export function dailyRunSeed(date: Date): number {
  return hashSeed(`run/${dailyNumber(date)}`);
}

/** Phase 'intro', round 0. */
export function startRun(plan: RunPlan): RunState {
  return {
    plan,
    phase: 'intro',
    roundIndex: 0,
    results: [],
  };
}

/** 'intro' or 'transition'-pending → 'transition' for roundIndex. */
export function beginTransition(state: RunState): RunState {
  if (state.phase !== 'intro' && state.phase !== 'transition') {
    throw new Error(`Cannot begin transition from phase "${state.phase}".`);
  }
  return {
    ...state,
    phase: 'transition',
  };
}

/** 'transition' → 'round'. */
export function beginRound(state: RunState): RunState {
  if (state.phase !== 'transition') {
    throw new Error(`Cannot begin round from phase "${state.phase}".`);
  }
  return {
    ...state,
    phase: 'round',
  };
}

/** 'round' → 'transition' for the next round, or 'results' after the fifth. */
export function finishRound(state: RunState, result: MicroResult): RunState {
  if (state.phase !== 'round') {
    throw new Error(`Cannot finish round from phase "${state.phase}".`);
  }
  const nextResults = [...state.results, result];
  if (nextResults.length >= RUN_ROUNDS) {
    return {
      plan: state.plan,
      phase: 'results',
      roundIndex: state.roundIndex,
      results: nextResults,
    };
  }
  return {
    plan: state.plan,
    phase: 'transition',
    roundIndex: state.roundIndex + 1,
    results: nextResults,
  };
}

/** 0 when failed; otherwise 100 + 10 points per whole second left on the clock. */
export function roundScore(result: MicroResult, challengeSeconds: number): number {
  if (!result.passed) {
    return 0;
  }
  const secondsLeft = Math.max(0, challengeSeconds - result.seconds);
  const wholeSeconds = Math.floor(secondsLeft);
  return 100 + wholeSeconds * 10;
}

export function runScore(state: RunState): number {
  return state.results.reduce((total, result, index) => {
    const challenge = state.plan.rounds[index]?.challenge;
    const seconds = challenge?.seconds ?? MICRO_DEFAULT_SECONDS;
    return total + roundScore(result, seconds);
  }, 0);
}

export function runPasses(state: RunState): number {
  return state.results.filter((result) => result.passed).length;
}

/**
 * The automatic power flip before round `roundIndex` (0–4). Round 0 runs at full length
 * (dim 400, collapse 350, snow 700, slide 450, flip 300, card 600 ms), and every later round
 * multiplies all six by 0.85^roundIndex, rounded, so round 5 is frantic.
 */
export function transitionTiming(roundIndex: number): TransitionTiming {
  const clamped = Math.min(4, Math.max(0, Math.floor(roundIndex)));
  const factor = Math.pow(0.85, clamped);
  return {
    dimMs: Math.round(BASE_TRANSITION.dimMs * factor),
    collapseMs: Math.round(BASE_TRANSITION.collapseMs * factor),
    snowMs: Math.round(BASE_TRANSITION.snowMs * factor),
    slideMs: Math.round(BASE_TRANSITION.slideMs * factor),
    flipMs: Math.round(BASE_TRANSITION.flipMs * factor),
    cardMs: Math.round(BASE_TRANSITION.cardMs * factor),
  };
}

/**
 * Formats the run share line with pass and fail icons.
 * e.g. "Woodgrain '88 Run #12 · [passes/fails] · 4/5"; runNumber is omitted for a free run.
 */
export function runShareLine(state: RunState, runNumber?: number): string {
  const prefix = runNumber !== undefined ? `Woodgrain '88 Run #${runNumber}` : "Woodgrain '88 Run";
  const icons = state.results.map((result) => (result.passed ? PASS_ICON : FAIL_ICON)).join('');
  const passes = runPasses(state);
  return `${prefix} · ${icons} · ${passes}/${RUN_ROUNDS}`;
}

/** The stored result of a finished run (phase 'results'); throws otherwise. */
export function runResult(state: RunState, at: IsoTime): RunResultData {
  if (state.phase !== 'results') {
    throw new Error(`Cannot get run result in phase "${state.phase}".`);
  }
  const rounds: RunRoundData[] = state.results.map((result) => ({
    game: result.game,
    challenge: result.challenge,
    passed: result.passed,
    seconds: result.seconds,
  }));
  return {
    at,
    seed: state.plan.seed,
    score: runScore(state),
    rounds,
  };
}

/**
 * Free runs: inserted by score, best first, capped at 10.
 * Daily: only the first finished run of a day is kept (under `dayKey`).
 */
export function recordRun(
  data: RunsData,
  result: RunResultData,
  mode: 'free' | 'daily',
  dayKey?: string,
): RunsData {
  if (mode === 'free') {
    const free = [...data.free, result]
      .sort((a, b) => b.score - a.score)
      .slice(0, RECORDS_PER_BOARD);
    return {
      free,
      daily: { ...data.daily },
    };
  }

  const key = dayKey ?? utcDateKey(new Date(result.at));
  const daily = { ...data.daily };
  // Only the first finished run of a day counts.
  daily[key] ??= result;
  return {
    free: [...data.free],
    daily,
  };
}
