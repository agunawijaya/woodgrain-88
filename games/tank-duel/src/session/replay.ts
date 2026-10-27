/**
 * The results screen's replay: a recorder keeps the last few seconds of the
 * match and turns the best hit into a clip (the run-up, the shot, the
 * explosion); a cursor plays the clip back at any time, between frames, with
 * each frame's events reported once so sparks and fireballs replay too.
 */
import type { MatchEvent, MatchState, Side } from '../engine/types.ts';
import { distance, type Vec2 } from '../engine/vec.ts';

export interface ReplayFrame {
  readonly state: MatchState;
  /** The events of the step that produced `state`. */
  readonly events: readonly MatchEvent[];
}

export type HitEvent = Extract<MatchEvent, { kind: 'hit' }>;

export interface ReplayClip {
  readonly frames: readonly ReplayFrame[];
  readonly hit: HitEvent;
  /** Index into `frames` of the frame whose events contain `hit`. */
  readonly hitIndex: number;
  /** Seconds from the first frame to the last. */
  readonly duration: number;
}

export interface ReplayOptions {
  /** Seconds kept before a hit. Default 3. */
  readonly before?: number;
  /** Seconds recorded after a hit before its clip is closed. Default 1.6. */
  readonly after?: number;
  /**
   * Whose hits count as the best: one side's (Kid matches, seat 1 = 0),
   * or either (two humans).
   */
  readonly favour: Side | 'either';
}

export interface ReplayRecorder {
  /** Call after every engine step, in order. */
  record(frame: ReplayFrame): void;
  /**
   * The best clip so far, or null. A clip still collecting its `after` frames
   * is returned as it stands.
   */
  best(): ReplayClip | null;
}

export interface ReplayMoment {
  readonly previous: MatchState;
  readonly current: MatchState;
  /** 0–1 between `previous` and `current`, for smooth drawing. */
  readonly alpha: number;
  /** Events of every frame passed since the last call (for sparks and explosions), in order. */
  readonly events: readonly MatchEvent[];
}

export interface ReplayCursor {
  /** Moves the playhead to `seconds` from the clip's start (clamped) and says what to draw. */
  seek(seconds: number): ReplayMoment;
  readonly duration: number;
}

/** Path lengths closer than this count as a tie. */
const PATH_EPSILON = 1e-6;

function pathLength(path: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    if (prev && curr) {
      total += distance(prev, curr);
    }
  }
  return total;
}

/** Which hit is better: positive when `a` beats `b`. */
export function compareHits(a: HitEvent, b: HitEvent, favour: Side | 'either'): number {
  if (favour !== 'either') {
    const aFavoured = a.shooter === favour;
    const bFavoured = b.shooter === favour;
    if (aFavoured && !bFavoured) {
      return 1;
    }
    if (!aFavoured && bFavoured) {
      return -1;
    }
  }

  if (a.bounces !== b.bounces) {
    return a.bounces - b.bounces;
  }

  if (a.points !== b.points) {
    return a.points - b.points;
  }

  const lengthDiff = pathLength(a.path) - pathLength(b.path);
  if (Math.abs(lengthDiff) > PATH_EPSILON) {
    return lengthDiff;
  }

  return 0;
}

interface CandidateClip {
  readonly frames: ReplayFrame[];
  readonly hit: HitEvent;
  readonly hitIndex: number;
  readonly hitTime: number;
  closed: boolean;
}

export function createReplayRecorder(options: ReplayOptions): ReplayRecorder {
  const before = options.before ?? 3;
  const after = options.after ?? 1.6;
  const favour = options.favour;

  const ring: ReplayFrame[] = [];
  let candidate: CandidateClip | null = null;
  let hasFavouredHit = false;

  return {
    record(frame: ReplayFrame): void {
      ring.push(frame);

      // Keep at least `before` seconds in the buffer without growing indefinitely.
      const cutoff = frame.state.time - before;
      while (ring.length > 1) {
        const next = ring[1];
        if (next && next.state.time <= cutoff) {
          ring.shift();
        } else {
          break;
        }
      }

      if (candidate && !candidate.closed) {
        candidate.frames.push(frame);
        if (frame.state.time - candidate.hitTime >= after) {
          candidate.closed = true;
        }
      }

      for (const event of frame.events) {
        if (event.kind !== 'hit') {
          continue;
        }
        const hit = event;

        // When a side is favoured, hits from the other side only count as a fall-back
        // before any favoured hit has occurred.
        if (favour !== 'either' && hit.shooter !== favour && hasFavouredHit) {
          continue;
        }

        const isBetter = !candidate || compareHits(hit, candidate.hit, favour) > 0;
        if (isBetter) {
          if (favour !== 'either' && hit.shooter === favour) {
            hasFavouredHit = true;
          }
          candidate = {
            frames: [...ring],
            hit,
            hitIndex: ring.length - 1,
            hitTime: frame.state.time,
            closed: after <= 0,
          };
        }
      }
    },

    best(): ReplayClip | null {
      if (!candidate) {
        return null;
      }
      const first = candidate.frames[0];
      const last = candidate.frames[candidate.frames.length - 1];
      const duration = first && last ? Math.max(0, last.state.time - first.state.time) : 0;
      return {
        frames: [...candidate.frames],
        hit: candidate.hit,
        hitIndex: candidate.hitIndex,
        duration,
      };
    },
  };
}

/** Plays a clip; seeking backwards (a loop restarting) reports the events from the start again. */
export function createReplayCursor(clip: ReplayClip): ReplayCursor {
  const frames = clip.frames;
  const firstFrame = frames[0];
  if (!firstFrame) {
    throw new Error('ReplayClip must contain at least one frame');
  }

  const startTime = firstFrame.state.time;
  const duration = clip.duration;
  let reportedIndex = -1;
  let lastSeekSeconds: number | null = null;

  return {
    duration,
    seek(seconds: number): ReplayMoment {
      const clampedSeconds = Math.max(0, Math.min(seconds, duration));
      const targetTime = startTime + clampedSeconds;

      // Seeking backwards indicates a loop restart, so re-arm event emission from the beginning.
      if (lastSeekSeconds !== null && seconds < lastSeekSeconds) {
        reportedIndex = -1;
      }
      lastSeekSeconds = seconds;

      let targetIndex = -1;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (f && f.state.time - startTime <= clampedSeconds + PATH_EPSILON) {
          targetIndex = i;
        }
      }

      const events: MatchEvent[] = [];
      for (let i = reportedIndex + 1; i <= targetIndex; i++) {
        const frame = frames[i];
        if (frame) {
          events.push(...frame.events);
        }
      }
      if (targetIndex > reportedIndex) {
        reportedIndex = targetIndex;
      }

      let prevFrame = firstFrame;
      let currFrame = firstFrame;
      let alpha = 1;

      if (frames.length > 1) {
        let index = 0;
        while (index < frames.length - 2) {
          const next = frames[index + 1];
          if (next && next.state.time <= targetTime) {
            index++;
          } else {
            break;
          }
        }
        const foundPrev = frames[index];
        const foundCurr = frames[index + 1];
        if (foundPrev && foundCurr) {
          prevFrame = foundPrev;
          currFrame = foundCurr;
          const span = currFrame.state.time - prevFrame.state.time;
          alpha =
            span > 0 ? Math.min(1, Math.max(0, (targetTime - prevFrame.state.time) / span)) : 1;
        }
      }

      return {
        previous: prevFrame.state,
        current: currFrame.state,
        alpha,
        events,
      };
    },
  };
}
