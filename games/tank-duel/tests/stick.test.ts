import type { SeatFrame } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { stickFromFrame } from '../src/session/match-session.ts';

function frame(held: string[], pressed: string[], axis = { x: 0, y: 0 }): SeatFrame {
  return {
    held: new Set(held),
    pressed: new Set(pressed),
    released: new Set(),
    axis,
    usingPad: false,
  };
}

describe('stickFromFrame', () => {
  it('fires on a tap that went down and up between two steps', () => {
    expect(stickFromFrame(frame([], ['fire'])).fire).toBe(true);
    expect(stickFromFrame(frame(['fire'], [])).fire).toBe(true);
    expect(stickFromFrame(frame([], [])).fire).toBe(false);
  });

  it('turns a pushed stick into whole steps, up meaning forward', () => {
    expect(stickFromFrame(frame([], [], { x: 0.8, y: -0.9 }))).toMatchObject({ x: 1, y: 1 });
    expect(stickFromFrame(frame([], [], { x: -0.2, y: 0.6 }))).toMatchObject({ x: 0, y: -1 });
  });
});
