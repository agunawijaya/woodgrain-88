/**
 * Tests for multi-seat input management: keyboard routing, solo vs split layouts,
 * event buffering, gamepad button/axis dead zones, bindings validation, and lifecycle.
 */
import { describe, expect, it } from 'vitest';
import type { Bindings } from '../src/input.ts';
import { createInput, DEFAULT_BINDINGS, rebind, validateBindings } from '../src/input.ts';

interface FakeGamepadOptions {
  connected?: boolean;
  buttons?: { pressed: boolean }[];
  axes?: number[];
}

function createFakeGamepad(options: FakeGamepadOptions = {}): Gamepad {
  const pad = {
    connected: options.connected ?? true,
    buttons: options.buttons ?? [],
    axes: options.axes ?? [],
  };
  return pad as unknown as Gamepad;
}

function dispatchKey(
  target: EventTarget,
  type: 'keydown' | 'keyup',
  code: string,
  repeat = false,
): void {
  target.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('input', () => {
  it('leaves keys pressed on a focused menu button to the button', () => {
    const page = document.createElement('div');
    const button = document.createElement('button');
    page.append(button);
    const input = createInput({ keyTarget: page, layout: 'split' });
    const onButton = new KeyboardEvent('keydown', {
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(onButton);
    dispatchKey(page, 'keydown', 'Enter');

    const frame = input.poll();

    expect(onButton.defaultPrevented).toBe(false);
    expect(frame.seats[2].pressed.has('fire')).toBe(false);
    expect(frame.seats[1].pressed.has('fire')).toBe(true);
    input.dispose();
  });

  it('routes ArrowUp/Enter to seat 1 and KeyW/Space to seat 2 in split layout', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget, layout: 'split' });

    dispatchKey(keyTarget, 'keydown', 'KeyW');
    dispatchKey(keyTarget, 'keydown', 'Space');
    dispatchKey(keyTarget, 'keydown', 'ArrowUp');
    dispatchKey(keyTarget, 'keydown', 'Enter');

    const frame = input.poll();

    expect(frame.seats[1].pressed.has('up')).toBe(true);
    expect(frame.seats[1].held.has('up')).toBe(true);
    expect(frame.seats[1].pressed.has('fire')).toBe(true);
    expect(frame.seats[1].held.has('fire')).toBe(true);

    expect(frame.seats[2].pressed.has('up')).toBe(true);
    expect(frame.seats[2].held.has('up')).toBe(true);
    expect(frame.seats[2].pressed.has('fire')).toBe(true);
    expect(frame.seats[2].held.has('fire')).toBe(true);

    dispatchKey(keyTarget, 'keyup', 'KeyW');
    dispatchKey(keyTarget, 'keyup', 'Space');
    dispatchKey(keyTarget, 'keyup', 'ArrowUp');
    dispatchKey(keyTarget, 'keyup', 'Enter');
    input.poll();

    dispatchKey(keyTarget, 'keydown', 'KeyW');
    const separatePoll = input.poll();
    expect(separatePoll.seats[1].held.has('up')).toBe(false);
    expect(separatePoll.seats[2].held.has('up')).toBe(true);

    input.dispose();
  });

  it('routes KeyW and ArrowUp to seat 1 in solo layout, keeping action held on release', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget, layout: 'solo' });

    dispatchKey(keyTarget, 'keydown', 'KeyW');
    dispatchKey(keyTarget, 'keydown', 'ArrowUp');
    const firstPoll = input.poll();

    expect(firstPoll.seats[1].pressed.has('up')).toBe(true);
    expect(firstPoll.seats[1].held.has('up')).toBe(true);

    dispatchKey(keyTarget, 'keyup', 'KeyW');
    const secondPoll = input.poll();
    expect(secondPoll.seats[1].held.has('up')).toBe(true);
    expect(secondPoll.seats[1].released.has('up')).toBe(false);

    dispatchKey(keyTarget, 'keyup', 'ArrowUp');
    const thirdPoll = input.poll();
    expect(thirdPoll.seats[1].held.has('up')).toBe(false);
    expect(thirdPoll.seats[1].released.has('up')).toBe(true);

    input.dispose();
  });

  it('buffers keydown and keyup between polls as both pressed and released on next poll', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget });

    dispatchKey(keyTarget, 'keydown', 'Enter');
    dispatchKey(keyTarget, 'keyup', 'Enter');

    const firstPoll = input.poll();
    expect(firstPoll.seats[1].pressed.has('fire')).toBe(true);
    expect(firstPoll.seats[1].released.has('fire')).toBe(true);
    expect(firstPoll.seats[1].held.has('fire')).toBe(false);

    const secondPoll = input.poll();
    expect(secondPoll.seats[1].pressed.has('fire')).toBe(false);
    expect(secondPoll.seats[1].released.has('fire')).toBe(false);
    expect(secondPoll.seats[1].held.has('fire')).toBe(false);

    input.dispose();
  });

  it('ignores repeat keydown events for pressed state', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget });

    dispatchKey(keyTarget, 'keydown', 'ArrowUp', false);
    const initialFrame = input.poll();
    expect(initialFrame.seats[1].pressed.has('up')).toBe(true);
    expect(initialFrame.seats[1].held.has('up')).toBe(true);

    dispatchKey(keyTarget, 'keydown', 'ArrowUp', true);
    const repeatFrame = input.poll();
    expect(repeatFrame.seats[1].pressed.has('up')).toBe(false);
    expect(repeatFrame.seats[1].held.has('up')).toBe(true);

    input.dispose();
  });

  it('never maps Escape to action and notifies onPause once per press excluding repeats', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget });
    let pauseCalls = 0;
    input.onPause(() => {
      pauseCalls++;
    });

    dispatchKey(keyTarget, 'keydown', 'Escape', false);
    expect(pauseCalls).toBe(1);

    dispatchKey(keyTarget, 'keydown', 'Escape', true);
    expect(pauseCalls).toBe(1);

    const frame = input.poll();
    expect(frame.seats[1].held.size).toBe(0);
    expect(frame.seats[1].pressed.size).toBe(0);
    expect(frame.seats[2].held.size).toBe(0);
    expect(frame.seats[2].pressed.size).toBe(0);

    input.dispose();
  });

  it('follows digital keys for axis and gamepad stick beyond the 0.4 dead zone', () => {
    const keyTarget = new EventTarget();
    let padAxes: number[] = [0, 0];
    const pads = [createFakeGamepad({ connected: true, axes: padAxes })];
    const input = createInput({
      keyTarget,
      gamepads: () => pads,
    });

    dispatchKey(keyTarget, 'keydown', 'ArrowLeft');
    const leftFrame = input.poll();
    expect(leftFrame.seats[1].axis).toEqual({ x: -1, y: 0 });

    dispatchKey(keyTarget, 'keyup', 'ArrowLeft');
    input.poll();

    // Stick inside 0.4 deadzone falls back to digital keys (neutral)
    padAxes = [0.2, 0.2];
    pads[0] = createFakeGamepad({ connected: true, axes: padAxes });
    const deadZoneFrame = input.poll();
    expect(deadZoneFrame.seats[1].axis).toEqual({ x: 0, y: 0 });

    // Stick beyond 0.4 deadzone provides raw stick coordinates
    padAxes = [-0.6, 0.8];
    pads[0] = createFakeGamepad({ connected: true, axes: padAxes });
    const liveFrame = input.poll();
    expect(liveFrame.seats[1].axis).toEqual({ x: -0.6, y: 0.8 });

    input.dispose();
  });

  it('handles pad button edges, button 9 pause, and routes pads by padSeats or solo', () => {
    let pauseCalls = 0;
    const buttonsPad1 = Array.from({ length: 16 }, () => ({ pressed: false }));
    const buttonsPad2 = Array.from({ length: 16 }, () => ({ pressed: false }));

    const pads = [
      createFakeGamepad({ connected: true, buttons: buttonsPad1 }),
      createFakeGamepad({ connected: true, buttons: buttonsPad2 }),
    ];

    const input = createInput({
      gamepads: () => pads,
      layout: 'split',
      padSeats: [1, 2],
    });
    input.onPause(() => {
      pauseCalls++;
    });

    // Press button 0 (fire) on pad 1
    const btn0 = buttonsPad1[0];
    if (btn0) {
      btn0.pressed = true;
    }

    const poll1 = input.poll();
    expect(poll1.seats[1].pressed.has('fire')).toBe(true);
    expect(poll1.seats[1].held.has('fire')).toBe(true);
    expect(poll1.seats[1].usingPad).toBe(true);

    // Button 0 remains held on next poll
    const poll2 = input.poll();
    expect(poll2.seats[1].pressed.has('fire')).toBe(false);
    expect(poll2.seats[1].held.has('fire')).toBe(true);

    // Release button 0
    if (btn0) {
      btn0.pressed = false;
    }
    const poll3 = input.poll();
    expect(poll3.seats[1].released.has('fire')).toBe(true);
    expect(poll3.seats[1].held.has('fire')).toBe(false);

    // Button 9 (pause) pressed
    const btn9 = buttonsPad1[9];
    if (btn9) {
      btn9.pressed = true;
    }
    input.poll();
    expect(pauseCalls).toBe(1);

    // Button 9 held
    input.poll();
    expect(pauseCalls).toBe(1);

    if (btn9) {
      btn9.pressed = false;
    }
    input.poll();

    // Pad 2 drives seat 2 in split layout
    const pad2Btn0 = buttonsPad2[0];
    if (pad2Btn0) {
      pad2Btn0.pressed = true;
    }
    const pollSeat2 = input.poll();
    expect(pollSeat2.seats[2].pressed.has('fire')).toBe(true);
    expect(pollSeat2.seats[1].held.has('fire')).toBe(false);

    // In solo layout, pad 2 routes to seat 1
    input.setLayout('solo');
    const pollSolo = input.poll();
    expect(pollSolo.seats[1].held.has('fire')).toBe(true);

    input.dispose();
  });

  it('validates bindings for Escape and collisions, and rebinds keys cleanly', () => {
    const invalidWithEscape: Bindings = {
      1: {
        keys: { ...DEFAULT_BINDINGS[1].keys, fire: ['Escape'] },
        pad: DEFAULT_BINDINGS[1].pad,
      },
      2: DEFAULT_BINDINGS[2],
    };
    const escapeErrors = validateBindings(invalidWithEscape, 'split');
    expect(escapeErrors.some((err) => err.includes('Escape is reserved'))).toBe(true);

    const crossSeatCollisions: Bindings = {
      1: {
        keys: { ...DEFAULT_BINDINGS[1].keys, fire: ['Space'] },
        pad: DEFAULT_BINDINGS[1].pad,
      },
      2: {
        keys: { ...DEFAULT_BINDINGS[2].keys, fire: ['Space'] },
        pad: DEFAULT_BINDINGS[2].pad,
      },
    };
    const splitErrors = validateBindings(crossSeatCollisions, 'split');
    expect(splitErrors.some((err) => err.includes('bound to both'))).toBe(true);

    const soloErrors = validateBindings(crossSeatCollisions, 'solo');
    expect(soloErrors).toEqual([]);

    const rebound = rebind(DEFAULT_BINDINGS, 2, 'fire', 'Enter');
    expect(rebound[2].keys.fire).toEqual(['Enter']);
    expect(rebound[1].keys.fire?.includes('Enter')).toBe(false);
    expect(DEFAULT_BINDINGS[1].keys.fire?.includes('Enter')).toBe(true);

    expect(() => rebind(DEFAULT_BINDINGS, 1, 'fire', 'Escape')).toThrow('reserved for pause');
  });

  it('releases all held keys when the window blurs, producing released edges on next poll', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget });

    dispatchKey(keyTarget, 'keydown', 'ArrowUp');
    dispatchKey(keyTarget, 'keydown', 'Enter');
    const firstPoll = input.poll();
    expect(firstPoll.seats[1].held.has('up')).toBe(true);
    expect(firstPoll.seats[1].held.has('fire')).toBe(true);

    keyTarget.dispatchEvent(new Event('blur'));

    const pollAfterBlur = input.poll();
    expect(pollAfterBlur.seats[1].held.has('up')).toBe(false);
    expect(pollAfterBlur.seats[1].held.has('fire')).toBe(false);
    expect(pollAfterBlur.seats[1].released.has('up')).toBe(true);
    expect(pollAfterBlur.seats[1].released.has('fire')).toBe(true);

    input.dispose();
  });

  it('clears held state on reset and stops reacting to events after dispose', () => {
    const keyTarget = new EventTarget();
    const input = createInput({ keyTarget });

    dispatchKey(keyTarget, 'keydown', 'ArrowUp');
    input.poll();

    input.reset();
    const pollAfterReset = input.poll();
    expect(pollAfterReset.seats[1].held.size).toBe(0);
    expect(pollAfterReset.seats[1].pressed.size).toBe(0);

    input.dispose();

    dispatchKey(keyTarget, 'keydown', 'ArrowUp');
    const pollAfterDispose = input.poll();
    expect(pollAfterDispose.seats[1].held.size).toBe(0);
    expect(pollAfterDispose.seats[1].pressed.size).toBe(0);
  });
});
