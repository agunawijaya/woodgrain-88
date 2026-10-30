import {
  DEFAULT_BINDINGS,
  type InputController,
  type InputFrame,
  type SeatFrame,
} from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import {
  classicBindings,
  createPlayerControls,
  modernBindings,
  PLAYER_FOR_SEAT,
} from '../../src/session/controls.ts';
import { setupFor } from '../helpers.ts';

function seatFrame(overrides: Partial<SeatFrame> = {}): SeatFrame {
  return {
    held: new Set(),
    pressed: new Set(),
    released: new Set(),
    axis: { x: 0, y: 0 },
    usingPad: false,
    ...overrides,
  };
}

/** A fake input controller that hands out the given frames in order, repeating the last. */
function fakeInput(frames: readonly InputFrame[]): InputController & { readonly polls: number } {
  let index = 0;
  let polls = 0;
  return {
    poll(): InputFrame {
      polls += 1;
      const frame = frames[Math.min(index, frames.length - 1)];
      index += 1;
      if (!frame) throw new Error('fakeInput needs at least one frame');
      return frame;
    },
    get polls() {
      return polls;
    },
    pointer: { x: null, y: null, down: false, pressed: false, released: false, kind: null },
    layout: 'split',
    setLayout: () => undefined,
    bindings: DEFAULT_BINDINGS,
    setBindings: () => undefined,
    onPause: () => () => undefined,
    reset: () => undefined,
    dispose: () => undefined,
  };
}

describe('classic scheme', () => {
  it('reads left, right, thrust and fire straight off their actions', () => {
    const input = fakeInput([
      {
        poll: 1,
        seats: { 1: seatFrame({ held: new Set(['left', 'up', 'fire']) }), 2: seatFrame() },
      },
    ]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    const result = controls.driver(1, PLAYER_FOR_SEAT[1], 'classic').controls(match);
    expect(result).toEqual({ left: true, right: false, thrust: true, cloak: false, fire: true });
  });

  it('cloaks on the stick down or the pad alt button', () => {
    const input = fakeInput([
      { poll: 1, seats: { 1: seatFrame(), 2: seatFrame({ held: new Set(['alt']) }) } },
    ]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    const result = controls.driver(0, PLAYER_FOR_SEAT[0], 'classic').controls(match);
    expect(result.cloak).toBe(true);
  });

  it('counts a tap that came and went between two ticks', () => {
    const input = fakeInput([
      { poll: 1, seats: { 1: seatFrame({ pressed: new Set(['fire']) }), 2: seatFrame() } },
    ]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    const result = controls.driver(1, PLAYER_FOR_SEAT[1], 'classic').controls(match);
    expect(result.fire).toBe(true);
  });
});

describe('modern scheme', () => {
  it('turns the short way toward the nearest of the 16 headings', () => {
    const input = fakeInput([
      { poll: 1, seats: { 1: seatFrame({ axis: { x: 1, y: 0 } }), 2: seatFrame() } },
    ]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    match.ships[1].heading = 4; // facing away from east; the short way back is right
    const result = controls.driver(1, PLAYER_FOR_SEAT[1], 'modern').controls(match);
    expect(result.left).toBe(false);
    expect(result.right).toBe(true);
  });

  it('turns nothing once it already faces the wanted heading', () => {
    const input = fakeInput([
      { poll: 1, seats: { 1: seatFrame({ axis: { x: 1, y: 0 } }), 2: seatFrame() } },
    ]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    match.ships[1].heading = 0;
    const result = controls.driver(1, PLAYER_FOR_SEAT[1], 'modern').controls(match);
    expect(result.left).toBe(false);
    expect(result.right).toBe(false);
  });

  it('turns nothing with the stick centred', () => {
    const input = fakeInput([{ poll: 1, seats: { 1: seatFrame(), 2: seatFrame() } }]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    match.ships[1].heading = 3;
    const result = controls.driver(1, PLAYER_FOR_SEAT[1], 'modern').controls(match);
    expect(result.left).toBe(false);
    expect(result.right).toBe(false);
  });

  it('reads thrust, cloak and fire from their own actions', () => {
    const input = fakeInput([
      {
        poll: 1,
        seats: { 1: seatFrame({ held: new Set(['thrust', 'cloak', 'fire']) }), 2: seatFrame() },
      },
    ]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    const result = controls.driver(1, PLAYER_FOR_SEAT[1], 'modern').controls(match);
    expect(result.thrust).toBe(true);
    expect(result.cloak).toBe(true);
    expect(result.fire).toBe(true);
  });
});

describe('createPlayerControls', () => {
  it('polls the kit input once a tick however many seats read it', () => {
    const input = fakeInput([{ poll: 1, seats: { 1: seatFrame(), 2: seatFrame() } }]);
    const controls = createPlayerControls(input);
    const match = setupFor(1);
    const left = controls.driver(0, PLAYER_FOR_SEAT[0], 'classic');
    const right = controls.driver(1, PLAYER_FOR_SEAT[1], 'classic');
    left.controls(match);
    right.controls(match);
    expect(input.polls).toBe(1);
  });
});

describe('bindings', () => {
  it("classic adds Right Ctrl beside kit player 1's fire key, and leaves player 2 alone", () => {
    const bindings = classicBindings(DEFAULT_BINDINGS);
    expect(bindings[1].keys.fire).toContain('ControlRight');
    expect(bindings[2].keys.fire).toEqual(DEFAULT_BINDINGS[2].keys.fire);
  });

  it('modern adds thrust and cloak beside the standard six, per seat', () => {
    const bindings = modernBindings(DEFAULT_BINDINGS);
    expect(bindings[2].keys.thrust).toEqual(['ShiftLeft']);
    expect(bindings[2].keys.cloak).toEqual(['KeyQ']);
    expect(bindings[1].keys.thrust).toEqual(['ShiftRight']);
    expect(bindings[1].keys.cloak).toEqual(['ControlRight']);
    expect(bindings[1].pad.fire).toEqual([{ button: 1 }]);
    expect(bindings[1].pad.thrust).toEqual([{ button: 0 }]);
    expect(bindings[1].pad.cloak).toEqual([{ button: 3 }]);
  });
});
