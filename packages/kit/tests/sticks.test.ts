import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BINDINGS,
  digitalStick,
  heldOrTapped,
  withDiagonalKeys,
  type Bindings,
  type SeatFrame,
} from '../src/index.ts';

function frame(held: string[] = [], axis = { x: 0, y: 0 }, pressed: string[] = []): SeatFrame {
  return {
    held: new Set(held),
    pressed: new Set(pressed),
    released: new Set(),
    axis,
    usingPad: false,
  };
}

describe('diagonal keys', () => {
  it('adds Q E Z C beside WASD and the keypad round the arrows', () => {
    const bindings = withDiagonalKeys(DEFAULT_BINDINGS);
    expect(bindings[2].keys['up-left']).toEqual(['KeyQ']);
    expect(bindings[2].keys['down-right']).toEqual(['KeyC']);
    expect(bindings[1].keys['up-right']).toEqual(['Numpad9']);
    expect(bindings[1].keys.up).toEqual(['ArrowUp', 'Numpad8']);
  });

  it('leaves out a key the player already uses elsewhere', () => {
    const custom: Bindings = {
      ...DEFAULT_BINDINGS,
      1: { ...DEFAULT_BINDINGS[1], keys: { ...DEFAULT_BINDINGS[1].keys, fire: ['KeyQ'] } },
    };
    expect(withDiagonalKeys(custom)[2].keys['up-left']).toBeUndefined();
  });
});

describe('digital stick', () => {
  it('reads keys and the d-pad as full steps, and ignores a small push of the stick', () => {
    expect(digitalStick(frame([], { x: 1, y: 0 }))).toEqual({ east: 1, south: 0 });
    expect(digitalStick(frame([], { x: -1, y: -1 }))).toEqual({ east: -1, south: -1 });
    expect(digitalStick(frame([], { x: 0.2, y: 0.3 }))).toEqual({ east: 0, south: 0 });
  });

  it('lets a held diagonal key win', () => {
    expect(digitalStick(frame(['down-left'], { x: 1, y: 0 }))).toEqual({ east: -1, south: 1 });
  });

  it('counts a tap that came and went within the tick as down', () => {
    expect(heldOrTapped(frame([], undefined, ['fire']), 'fire')).toBe(true);
    expect(heldOrTapped(frame(['fire']), 'fire')).toBe(true);
    expect(heldOrTapped(frame(), 'fire')).toBe(false);
  });
});
