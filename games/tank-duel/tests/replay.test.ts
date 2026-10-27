/**
 * Tests for the duel replay recorder and cursor:
 * - captures lead-up and explosion of scoring hits into replay clips
 * - bounds memory over long matches
 * - respects favoured shooter and hit ranking (bounces, points, path)
 * - smooth interpolation and once-only event delivery during playback
 */
import { describe, expect, it } from 'vitest';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld, stepMatch, type MatchWorld } from '../src/engine/match.ts';
import type { Shell } from '../src/engine/shell.ts';
import type { MatchEvent, MatchOptions, MatchState, Side } from '../src/engine/types.ts';
import { NO_INPUT } from '../src/engine/types.ts';
import { vec, type Vec2 } from '../src/engine/vec.ts';
import {
  compareHits,
  createReplayCursor,
  createReplayRecorder,
  type HitEvent,
  type ReplayClip,
} from '../src/session/replay.ts';

const DEFAULT_OPTIONS: MatchOptions = {
  scoring: 'timed',
  handicap: [false, false],
  wiring: false,
};

function makeTestMatch(): { state: MatchState; world: MatchWorld } {
  const channel = channelById('game-1');
  const world = createWorld(channel);
  const state = createMatch(channel, DEFAULT_OPTIONS, world);
  return { state, world };
}

function plantShell(
  state: MatchState,
  owner: Side,
  position: Vec2,
  direction: Vec2,
  bounces = 0,
  path: readonly Vec2[] = [position],
): MatchState {
  const shell: Shell = {
    owner,
    position,
    direction,
    life: 1.0,
    age: 0,
    bounces,
    path,
  };
  const shells: readonly [Shell | null, Shell | null] =
    owner === 0 ? [shell, state.shells[1]] : [state.shells[0], shell];
  return { ...state, shells };
}

/** A shell just short of the other side's tank, flying straight at it. */
function plantShotAtEnemy(state: MatchState, owner: Side, bounces = 0): MatchState {
  const target = state.vehicles.find((vehicle) => vehicle.side !== owner && vehicle.slot === 0);
  if (!target) throw new Error('Expected an enemy tank');
  const from = vec(target.position.x - 2.6, target.position.y);
  return plantShell(state, owner, from, vec(1, 0), bounces, [vec(from.x - 10, from.y), from]);
}

function makeHit(overrides: Partial<HitEvent> = {}): HitEvent {
  return {
    kind: 'hit',
    shooter: 0,
    victim: 1,
    vehicle: 1,
    at: vec(50, 20),
    direction: vec(1, 0),
    bounces: 0,
    points: 1,
    path: [vec(14, 20), vec(50, 20)],
    ...overrides,
  };
}

function makeFakeState(time: number): MatchState {
  const { state } = makeTestMatch();
  return { ...state, time };
}

describe('replay', () => {
  describe('compareHits', () => {
    it('ranks hits by bounces, points, path length, and keeps earlier hit on tie', () => {
      // Bounces take priority.
      const oneBounce = makeHit({ bounces: 1, points: 1 });
      const twoBounces = makeHit({ bounces: 2, points: 1 });
      expect(compareHits(twoBounces, oneBounce, 'either')).toBeGreaterThan(0);
      expect(compareHits(oneBounce, twoBounces, 'either')).toBeLessThan(0);

      // Points break bounce ties.
      const onePoint = makeHit({ bounces: 1, points: 1 });
      const twoPoints = makeHit({ bounces: 1, points: 2 });
      expect(compareHits(twoPoints, onePoint, 'either')).toBeGreaterThan(0);
      expect(compareHits(onePoint, twoPoints, 'either')).toBeLessThan(0);

      // Path length breaks point ties.
      const shortPath = makeHit({
        bounces: 1,
        points: 1,
        path: [vec(0, 0), vec(10, 0)],
      });
      const longPath = makeHit({
        bounces: 1,
        points: 1,
        path: [vec(0, 0), vec(20, 0), vec(35, 0)],
      });
      expect(compareHits(longPath, shortPath, 'either')).toBeGreaterThan(0);
      expect(compareHits(shortPath, longPath, 'either')).toBeLessThan(0);

      // Identical hits tie with 0.
      const duplicateA = makeHit({ bounces: 1, points: 1, path: [vec(0, 0), vec(10, 0)] });
      const duplicateB = makeHit({ bounces: 1, points: 1, path: [vec(0, 0), vec(10, 0)] });
      expect(compareHits(duplicateA, duplicateB, 'either')).toBe(0);
    });

    it('favours the designated side over the opponent', () => {
      const favouredZero = makeHit({ shooter: 0, bounces: 0 });
      const opponentOne = makeHit({ shooter: 1, bounces: 5, points: 5 });

      // When side 0 is favoured, side 0 beats side 1 regardless of bounces or points.
      expect(compareHits(favouredZero, opponentOne, 0)).toBeGreaterThan(0);
      expect(compareHits(opponentOne, favouredZero, 0)).toBeLessThan(0);

      // When favour is 'either', side 1 wins on bounces.
      expect(compareHits(favouredZero, opponentOne, 'either')).toBeLessThan(0);
      expect(compareHits(opponentOne, favouredZero, 'either')).toBeGreaterThan(0);
    });
  });

  describe('recorder clip creation', () => {
    it('produces a clip spanning before and after a hit with correct hitIndex', () => {
      const { state: initialMatch, world } = makeTestMatch();
      let state = initialMatch;
      const recorder = createReplayRecorder({ before: 1.0, after: 0.5, favour: 'either' });

      // Run match for 2.0 seconds with no hits so history builds up.
      for (let i = 0; i < 120; i++) {
        const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
        state = step.state;
        recorder.record({ state: step.state, events: step.events });
      }

      // A shell just short of the other tank, flying straight at it.
      state = plantShotAtEnemy(state, 0, 1);

      // Step until hit occurs.
      let hitFrameTime = 0;
      let hitOccurred = false;
      for (let i = 0; i < 10; i++) {
        const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
        state = step.state;
        recorder.record({ state: step.state, events: step.events });
        if (step.events.some((e) => e.kind === 'hit')) {
          hitOccurred = true;
          hitFrameTime = step.state.time;
          break;
        }
      }
      expect(hitOccurred).toBe(true);

      // Step an additional 1.0 s past the hit to complete the 0.5 s after window.
      for (let i = 0; i < 60; i++) {
        const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
        state = step.state;
        recorder.record({ state: step.state, events: step.events });
      }

      const clip = recorder.best();
      expect(clip).not.toBeNull();
      if (!clip) return;

      const firstFrame = clip.frames[0];
      const lastFrame = clip.frames[clip.frames.length - 1];
      const hitFrame = clip.frames[clip.hitIndex];

      expect(firstFrame).toBeDefined();
      expect(lastFrame).toBeDefined();
      expect(hitFrame).toBeDefined();

      if (firstFrame && lastFrame && hitFrame) {
        // First frame should start about 1.0 s before the hit.
        expect(firstFrame.state.time).toBeCloseTo(hitFrameTime - 1.0, 1);
        // Last frame should end about 0.5 s after the hit.
        expect(lastFrame.state.time).toBeCloseTo(hitFrameTime + 0.5, 1);
        // hitIndex must point at the frame containing the hit event.
        expect(hitFrame.events.some((e) => e.kind === 'hit')).toBe(true);
        // Duration matches the frame interval.
        expect(clip.duration).toBeCloseTo(lastFrame.state.time - firstFrame.state.time);
      }
    });

    it('starts clip from match start when hit occurs early in the match', () => {
      const { state: initialMatch, world } = makeTestMatch();
      let state = plantShotAtEnemy(initialMatch, 0);
      const recorder = createReplayRecorder({ before: 3.0, after: 1.0, favour: 'either' });

      // Run until hit.
      for (let i = 0; i < 5; i++) {
        const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
        state = step.state;
        recorder.record({ state: step.state, events: step.events });
      }

      const clip = recorder.best();
      expect(clip).not.toBeNull();
      if (!clip) return;

      const firstFrame = clip.frames[0];
      expect(firstFrame).toBeDefined();
      if (firstFrame) {
        expect(firstFrame.state.time).toBeCloseTo(1 / 60, 2);
      }
    });
  });

  describe('favour ranking with recorder', () => {
    it('uses opponent hits as fall-back only until favoured hit occurs', () => {
      const recorder = createReplayRecorder({ before: 1, after: 1, favour: 0 });

      // Step 1: Side 1 scores with 1 bounce (fall-back).
      const side1Hit1 = makeHit({ shooter: 1, bounces: 1 });
      recorder.record({
        state: makeFakeState(1.0),
        events: [side1Hit1],
      });
      expect(recorder.best()?.hit).toBe(side1Hit1);

      // Step 2: Side 1 scores with fewer bounces (0 bounces) -> does not replace best.
      const side1Hit0 = makeHit({ shooter: 1, bounces: 0 });
      recorder.record({
        state: makeFakeState(2.0),
        events: [side1Hit0],
      });
      expect(recorder.best()?.hit).toBe(side1Hit1);

      // Step 3: Side 1 scores with more bounces (2 bounces) -> replaces best.
      const side1Hit2 = makeHit({ shooter: 1, bounces: 2 });
      recorder.record({
        state: makeFakeState(3.0),
        events: [side1Hit2],
      });
      expect(recorder.best()?.hit).toBe(side1Hit2);

      // Step 4: Side 0 scores with 0 bounces -> replaces side 1 because side 0 is favoured.
      const side0Hit0 = makeHit({ shooter: 0, bounces: 0 });
      recorder.record({
        state: makeFakeState(4.0),
        events: [side0Hit0],
      });
      expect(recorder.best()?.hit).toBe(side0Hit0);

      // Step 5: Side 1 scores with 4 bounces -> ignored because side 0 hit has been seen.
      const side1Hit4 = makeHit({ shooter: 1, bounces: 4 });
      recorder.record({
        state: makeFakeState(5.0),
        events: [side1Hit4],
      });
      expect(recorder.best()?.hit).toBe(side0Hit0);

      // Step 6: Side 0 scores with 1 bounce -> replaces side 0 hit with 0 bounces.
      const side0Hit1 = makeHit({ shooter: 0, bounces: 1 });
      recorder.record({
        state: makeFakeState(6.0),
        events: [side0Hit1],
      });
      expect(recorder.best()?.hit).toBe(side0Hit1);
    });
  });

  describe('bounded ring buffer', () => {
    it('bounds held frames after 60 seconds with no hits to about before seconds', () => {
      const { state: initialMatch, world } = makeTestMatch();
      let state = initialMatch;
      const recorder = createReplayRecorder({ before: 3.0, after: 1.6, favour: 'either' });

      // Run 60 seconds of simulation (3600 frames at 60 Hz) with no hits.
      for (let i = 0; i < 3600; i++) {
        const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
        state = step.state;
        recorder.record({ state: step.state, events: step.events });
      }

      // Plant a shell and step until a hit occurs at ~60.05 s.
      state = plantShotAtEnemy(state, 0);
      let hitTime = 0;
      for (let i = 0; i < 5; i++) {
        const step = stepMatch(state, [NO_INPUT, NO_INPUT], 1 / 60, world);
        state = step.state;
        recorder.record({ state: step.state, events: step.events });
        if (step.events.some((e) => e.kind === 'hit')) {
          hitTime = step.state.time;
          break;
        }
      }

      const clip = recorder.best();
      expect(clip).not.toBeNull();
      if (!clip) return;

      const firstFrame = clip.frames[0];
      expect(firstFrame).toBeDefined();
      if (firstFrame) {
        // The first frame must be approximately 3.0 s before hitTime, not at match start (t=0).
        expect(firstFrame.state.time).toBeGreaterThan(hitTime - 3.1);
        expect(firstFrame.state.time).toBeLessThanOrEqual(hitTime - 2.9);
      }
    });
  });

  describe('cursor playback and seeking', () => {
    it('interpolates alpha and frame pairs across playback intervals', () => {
      const state0 = makeFakeState(10.0);
      const state1 = makeFakeState(10.1);
      const state2 = makeFakeState(10.2);

      const hit = makeHit();
      const clip: ReplayClip = {
        frames: [
          { state: state0, events: [] },
          { state: state1, events: [hit] },
          { state: state2, events: [] },
        ],
        hit,
        hitIndex: 1,
        duration: 0.2,
      };

      const cursor = createReplayCursor(clip);
      expect(cursor.duration).toBeCloseTo(0.2);

      // At start: alpha 0, previous is frame 0, current is frame 1.
      const m0 = cursor.seek(0);
      expect(m0.previous).toBe(state0);
      expect(m0.current).toBe(state1);
      expect(m0.alpha).toBeCloseTo(0);

      // Midpoint between frame 0 and frame 1.
      const mHalf = cursor.seek(0.05);
      expect(mHalf.previous).toBe(state0);
      expect(mHalf.current).toBe(state1);
      expect(mHalf.alpha).toBeCloseTo(0.5);

      // At frame 1 timestamp: alpha 0 in second interval.
      const m1 = cursor.seek(0.1);
      expect(m1.previous).toBe(state1);
      expect(m1.current).toBe(state2);
      expect(m1.alpha).toBeCloseTo(0);

      // Midpoint between frame 1 and frame 2.
      const m1Half = cursor.seek(0.15);
      expect(m1Half.previous).toBe(state1);
      expect(m1Half.current).toBe(state2);
      expect(m1Half.alpha).toBeCloseTo(0.5);

      // At the end.
      const mEnd = cursor.seek(0.2);
      expect(mEnd.previous).toBe(state1);
      expect(mEnd.current).toBe(state2);
      expect(mEnd.alpha).toBeCloseTo(1);
    });

    it('holds the last frame with alpha 1 when seeking past the end', () => {
      const state0 = makeFakeState(5.0);
      const state1 = makeFakeState(5.5);
      const hit = makeHit();
      const clip: ReplayClip = {
        frames: [
          { state: state0, events: [] },
          { state: state1, events: [hit] },
        ],
        hit,
        hitIndex: 1,
        duration: 0.5,
      };

      const cursor = createReplayCursor(clip);
      const moment = cursor.seek(10.0);
      expect(moment.current).toBe(state1);
      expect(moment.alpha).toBe(1);
    });

    it('reports events once each and restarts them when seeking backward', () => {
      const state0 = makeFakeState(0.0);
      const state1 = makeFakeState(1.0);
      const state2 = makeFakeState(2.0);

      const ev0: MatchEvent = {
        kind: 'turned',
        vehicle: 0,
        heading: 1,
      };
      const ev1: MatchEvent = makeHit({ bounces: 1 });
      const ev2: MatchEvent = {
        kind: 'bumped',
        vehicle: 1,
        at: vec(10, 20),
      };

      const clip: ReplayClip = {
        frames: [
          { state: state0, events: [ev0] },
          { state: state1, events: [ev1] },
          { state: state2, events: [ev2] },
        ],
        hit: ev1,
        hitIndex: 1,
        duration: 2.0,
      };

      const cursor = createReplayCursor(clip);

      // Seek to frame 0 -> receives ev0.
      const m0 = cursor.seek(0);
      expect(m0.events).toEqual([ev0]);

      // Seek to same time -> reports nothing new.
      const m0Repeat = cursor.seek(0);
      expect(m0Repeat.events).toEqual([]);

      // Advance to frame 1 -> receives ev1 only.
      const m1 = cursor.seek(1.0);
      expect(m1.events).toEqual([ev1]);

      // Advance to end -> receives ev2 only.
      const m2 = cursor.seek(2.0);
      expect(m2.events).toEqual([ev2]);

      // Seek backward to 0.5 (clip looping) -> restarts and reports events up to 0.5 (ev0).
      const mLoop = cursor.seek(0.5);
      expect(mLoop.events).toEqual([ev0]);

      // Advance again to end -> receives ev1 and ev2 in order.
      const mLoopEnd = cursor.seek(2.0);
      expect(mLoopEnd.events).toEqual([ev1, ev2]);
    });
  });
});
