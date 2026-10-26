/**
 * Micro-challenges: 45-second goals inside a game's channel ("hit three
 * tanks without being hit"), the building blocks of prompt 01's Power Cycle
 * Run. A game that supports them lists them in its module; the kit starts the
 * game with `run.micro` set, counts its events against the goal and decides
 * pass or fail, so every game is judged the same way.
 */
import type { StampedEvent } from './events.ts';
import type { PatchMetric } from './patches.ts';

export const MICRO_DEFAULT_SECONDS = 45;

export interface MicroChallengeDef {
  /** kebab-case, unique within the game. */
  id: string;
  /** The channel the game starts in. */
  channel: string;
  /** At most 32 characters. */
  title: string;
  /** The one line shown before and during the challenge, e.g. "Hit 3 tanks". */
  goal: string;
  /** Default MICRO_DEFAULT_SECONDS. */
  seconds?: number;
  pass: { metric: PatchMetric; target: number };
}

/** What the game receives in `run.micro`. */
export interface MicroBrief {
  id: string;
  goal: string;
  seconds: number;
}

export type MicroState = 'running' | 'passed' | 'failed';

export interface MicroResult {
  game: string;
  challenge: string;
  passed: boolean;
  /** The metric's value when the challenge ended. */
  score: number;
  /** Seconds from start to the end (pass, timeout or abandon). */
  seconds: number;
}

export interface MicroRun {
  readonly brief: MicroBrief;
  readonly state: MicroState;
  readonly value: number;
  remainingSeconds(): number;
  /** Counts a matching event (same game, the challenge's channel) toward the goal. */
  handle(event: StampedEvent): void;
  /**
   * Re-evaluates against the clock: passes as soon as the target is reached,
   * fails once time runs out. Returns the state after checking.
   */
  check(): MicroState;
  /** Ends the run (abandoning counts as failed if still running) and returns the result. */
  finish(): MicroResult;
}

const KEBAB_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_SECONDS = 15;
const MAX_SECONDS = 90;
const MAX_TITLE_LENGTH = 32;

function stepMetricValue(metric: PatchMetric, current: number, event: StampedEvent): number {
  if (metric.event !== event.type) {
    return current;
  }
  if (metric.kind === 'count') {
    return current + 1;
  }
  const raw = event.data?.[metric.field];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return current;
  }
  return metric.kind === 'max' ? Math.max(current, raw) : current + raw;
}

export function briefFor(def: MicroChallengeDef): MicroBrief {
  return {
    id: def.id,
    goal: def.goal,
    seconds: def.seconds ?? MICRO_DEFAULT_SECONDS,
  };
}

export function startMicro(gameId: string, def: MicroChallengeDef, now?: () => number): MicroRun {
  const readNow = now ?? (() => performance.now());
  const brief = briefFor(def);
  const startedAtMs = readNow();
  let state: MicroState = 'running';
  let value = 0;
  let endedSeconds: number | null = null;

  function elapsedSeconds(): number {
    return Math.max(0, (readNow() - startedAtMs) / 1000);
  }

  function check(): MicroState {
    if (state !== 'running') {
      return state;
    }
    const elapsed = elapsedSeconds();
    if (value >= def.pass.target) {
      state = 'passed';
      endedSeconds = Math.min(brief.seconds, elapsed);
      return state;
    }
    if (elapsed >= brief.seconds) {
      state = 'failed';
      endedSeconds = brief.seconds;
      return state;
    }
    return state;
  }

  function handle(event: StampedEvent): void {
    if (state !== 'running') {
      return;
    }
    if (event.game !== gameId || event.channel !== def.channel) {
      return;
    }
    value = stepMetricValue(def.pass.metric, value, event);
    check();
  }

  function finish(): MicroResult {
    check();
    if (state === 'running') {
      state = 'failed';
      endedSeconds = Math.min(brief.seconds, elapsedSeconds());
    }
    return {
      game: gameId,
      challenge: def.id,
      passed: state === 'passed',
      score: value,
      seconds: endedSeconds ?? Math.min(brief.seconds, elapsedSeconds()),
    };
  }

  return {
    brief,
    get state() {
      return state;
    },
    get value() {
      return value;
    },
    remainingSeconds() {
      return Math.max(0, brief.seconds - elapsedSeconds());
    },
    handle,
    check,
    finish,
  };
}

/** Problems with a game's micro-challenges: ids, channel exists, seconds 15–90, target positive. */
export function validateMicroChallenges(
  defs: readonly MicroChallengeDef[],
  channelIds: readonly string[],
): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const validChannels = new Set<string>(channelIds);

  for (const def of defs) {
    if (!KEBAB_ID_RE.test(def.id)) {
      problems.push(`Micro-challenge id "${def.id}" must be kebab-case.`);
    }
    if (seenIds.has(def.id)) {
      problems.push(`Duplicate micro-challenge id "${def.id}".`);
    } else {
      seenIds.add(def.id);
    }

    if (!validChannels.has(def.channel)) {
      problems.push(`Micro-challenge "${def.id}" references unknown channel "${def.channel}".`);
    }

    if (
      def.seconds !== undefined &&
      (!Number.isFinite(def.seconds) || def.seconds < MIN_SECONDS || def.seconds > MAX_SECONDS)
    ) {
      problems.push(`Micro-challenge "${def.id}" seconds must be ${MIN_SECONDS}–${MAX_SECONDS}.`);
    }

    if (!Number.isFinite(def.pass.target) || def.pass.target <= 0) {
      problems.push(`Micro-challenge "${def.id}" target must be a positive finite number.`);
    }

    if (def.title.trim().length < 1 || def.title.length > MAX_TITLE_LENGTH) {
      problems.push(`Micro-challenge "${def.id}" title must be 1–${MAX_TITLE_LENGTH} characters.`);
    }

    if (def.goal.trim().length < 1) {
      problems.push(`Micro-challenge "${def.id}" must have a non-empty goal.`);
    }
  }

  return problems;
}
