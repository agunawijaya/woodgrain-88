/**
 * The pieces between the engine and the screen: the keys (diagonals added
 * only where free), the mouse's walk, the progress events for Den Life, and
 * how a finished match reads as a result.
 */
import { DEFAULT_BINDINGS, withDiagonalKeys, type SeatFrame } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { squareAt } from '../src/engine/grid.ts';
import {
  createMatch,
  startMatch,
  type Check,
  type Match,
  type MatchEvent,
} from '../src/engine/match.ts';
import { cartridgeRules, SETTLE_TICKS } from '../src/engine/rules.ts';
import { squareAtPoint, squareCentre } from '../src/look/field-space.ts';
import { createProgressTracker } from '../src/progress/tracker.ts';
import { seatInput } from '../src/session/controls.ts';
import { createMouseWalk } from '../src/session/mouse.ts';
import { buildResult, DAILY_PAR, emojiTrail, seatOneOutcome } from '../src/session/result.ts';

function frame(held: string[], axis = { x: 0, y: 0 }, pressed: string[] = []): SeatFrame {
  return {
    held: new Set(held),
    pressed: new Set(pressed),
    released: new Set(),
    axis,
    usingPad: false,
  };
}

describe('keys', () => {
  it('adds the diagonals beside each seat’s keys', () => {
    const bindings = withDiagonalKeys(DEFAULT_BINDINGS);
    expect(bindings[2].keys['up-left']).toEqual(['KeyQ']);
    expect(bindings[2].keys['down-right']).toEqual(['KeyC']);
    expect(bindings[1].keys['up-right']).toEqual(['Numpad9']);
    expect(bindings[1].keys.up).toEqual(['ArrowUp', 'Numpad8']);
  });

  it('never takes a key the player has already bound', () => {
    const custom = {
      ...DEFAULT_BINDINGS,
      2: { ...DEFAULT_BINDINGS[2], keys: { ...DEFAULT_BINDINGS[2].keys, fire: ['KeyQ'] } },
    };
    const bindings = withDiagonalKeys(custom);
    expect(bindings[2].keys['up-left']).toBeUndefined();
    expect(bindings[2].keys.fire).toEqual(['KeyQ']);
  });

  it('reads the axis and the diagonal keys as one of eight steps', () => {
    expect(seatInput(frame([], { x: 1, y: 0 }))).toEqual({ east: 1, south: 0, reveal: false });
    expect(seatInput(frame([], { x: -1, y: -1 }))).toEqual({ east: -1, south: -1, reveal: false });
    expect(seatInput(frame(['down-left']))).toEqual({ east: -1, south: 1, reveal: false });
    expect(seatInput(frame([], { x: 0.2, y: 0.3 }))).toEqual({ east: 0, south: 0, reveal: false });
  });

  it('counts a tap shorter than a tick as a press of reveal', () => {
    expect(seatInput(frame([], undefined, ['fire'])).reveal).toBe(true);
    expect(seatInput(frame(['fire'])).reveal).toBe(true);
  });
});

describe('the field under the pointer', () => {
  it('finds every square from its own centre', () => {
    for (const square of [0, 8, 31, 54, 62]) {
      const centre = squareCentre(square);
      expect(squareAtPoint(centre.x, centre.z)).toBe(square);
    }
  });

  it('is null off the field', () => {
    expect(squareAtPoint(-100, 0)).toBeNull();
    expect(squareAtPoint(0, 100)).toBeNull();
  });
});

describe('the mouse walk', () => {
  it('walks towards a clicked square and stops there', () => {
    const walk = createMouseWalk('notebook');
    walk.press(squareAt(3, 0), squareAt(0, 0));
    walk.release();
    expect(walk.input(squareAt(0, 0), null)).toEqual({ east: 1, south: 0, reveal: false });
    expect(walk.input(squareAt(3, 0), null)).toEqual({ east: 0, south: 0, reveal: false });
    expect(walk.target).toBeNull();
  });

  it('checks the square it stands on while the button is down', () => {
    const walk = createMouseWalk('classic');
    walk.press(squareAt(2, 2), squareAt(2, 2));
    expect(walk.input(squareAt(2, 2), null).reveal).toBe(true);
    walk.release();
    expect(walk.input(squareAt(2, 2), null).reveal).toBe(false);
  });

  it('checks on arrival when the target is clicked again, long enough to settle', () => {
    const walk = createMouseWalk('notebook');
    walk.press(squareAt(1, 0), squareAt(0, 0));
    walk.press(squareAt(1, 0), squareAt(0, 0));
    walk.release();
    walk.input(squareAt(0, 0), null);
    let held = 0;
    for (let tick = 0; tick < 40; tick++) if (walk.input(squareAt(1, 0), null).reveal) held++;
    expect(held).toBeGreaterThan(SETTLE_TICKS);
  });

  it('gives up a walk to the square the other explorer stands on', () => {
    const walk = createMouseWalk('notebook');
    walk.press(squareAt(4, 4), squareAt(0, 0));
    expect(walk.input(squareAt(0, 0), squareAt(4, 4))).toEqual({
      east: 0,
      south: 0,
      reveal: false,
    });
    expect(walk.target).toBeNull();
  });
});

function check(square: number, kind: 'bomb' | 'flag' | 'distance', seat: 0 | 1 = 0): MatchEvent {
  const clue = kind === 'distance' ? { kind, distance: 3 } : { kind };
  const made: Check = { seat, square, clue, flagMoves: 0 };
  return { type: 'check', check: made };
}

function matchFor(variation: number, seats: 1 | 2 = 2): Match {
  const match = createMatch({
    rules: cartridgeRules(variation),
    seats,
    switches: ['B', 'B'],
    seed: 'session-test',
  });
  startMatch(match);
  return match;
}

describe('progress for Den Life', () => {
  const circumstances = {
    rules: cartridgeRules(1),
    kid: 'moss' as const,
    clues: 'notebook' as const,
    playerOnA: false,
  };

  it('counts a clean flag onto the streak it was given', () => {
    const tracker = createProgressTracker(2, circumstances);
    const match = matchFor(1);
    const told = tracker.hear(
      [
        check(10, 'distance'),
        check(11, 'flag'),
        { type: 'capture', seat: 0, square: 11, onLastCheck: false },
      ],
      match,
    );
    expect(told).toEqual([
      { type: 'capture', data: { checks: 2, clean: 1, streak: 3, onLastCheck: 0 } },
    ]);
    expect(tracker.streak).toBe(3);
  });

  it('breaks the streak at a bomb, and a flag after it on that field is not clean', () => {
    const tracker = createProgressTracker(4, circumstances);
    const match = matchFor(1);
    const told = tracker.hear(
      [
        check(5, 'bomb'),
        check(6, 'flag'),
        { type: 'capture', seat: 0, square: 6, onLastCheck: false },
      ],
      match,
    );
    expect(told[0]).toEqual({ type: 'bomb' });
    expect(told[1]).toEqual({
      type: 'capture',
      data: { checks: 2, clean: 0, streak: 0, onLastCheck: 0 },
    });
  });

  it('ignores the rival’s checks and flags', () => {
    const tracker = createProgressTracker(0, circumstances);
    const told = tracker.hear(
      [check(5, 'bomb', 1), { type: 'capture', seat: 1, square: 6, onLastCheck: false }],
      matchFor(1),
    );
    expect(told).toEqual([]);
  });
});

describe('results', () => {
  it('writes the share trail one symbol per check, at most twelve', () => {
    expect(emojiTrail(['distance', 'arrow', 'bomb', 'flag'])).toBe('🔢➡️💥🚩');
    expect(emojiTrail(Array.from({ length: 20 }, () => 'distance' as const))).toBe('🔢'.repeat(12));
  });

  it('scores the daily as points with its checks in the label', () => {
    const match = matchFor(5, 1);
    const result = buildResult({
      match,
      result: { kind: 'single', checks: 4 },
      trail: ['distance', 'arrow', 'distance', 'flag'],
      durationMs: 1000,
      kid: null,
      clues: 'notebook',
      versus: false,
    });
    expect(result.score).toBe(DAILY_PAR - 4);
    expect(result.scoreLabel).toBe('4 checks');
    expect(result.emoji).toBe('🔢➡️🔢🚩');
  });

  it('scores a race by flags, with the winning seat in versus', () => {
    const match = matchFor(1);
    const result = buildResult({
      match,
      result: { kind: 'first-to', winner: 1, captures: [9, 15] },
      trail: [],
      durationMs: 1000,
      kid: null,
      clues: 'classic',
      versus: true,
    });
    expect(result.score).toBe(9);
    expect(result.scoreLabel).toBe('9–15');
    expect(result.winnerSeat).toBe(2);
    expect(result.won).toBe(false);
  });

  it('reads a hunt-for-hunt tie as a draw and a solo hunt as no outcome', () => {
    expect(
      seatOneOutcome({ kind: 'hunts', winner: null, checks: [75, 75], captures: [3, 3] }, 2),
    ).toBe('draw');
    expect(
      seatOneOutcome({ kind: 'hunts', winner: null, checks: [75, 0], captures: [4, 0] }, 1),
    ).toBeNull();
    expect(seatOneOutcome(null, 2)).toBeNull();
  });
});
