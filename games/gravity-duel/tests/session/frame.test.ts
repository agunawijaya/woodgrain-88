import { describe, expect, it } from 'vitest';
import { createCloakFader, headingRadians, sceneFrame, toTable } from '../../src/session/frame.ts';
import {
  CENTRE_X,
  CENTRE_Y,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  SUBPIXELS,
} from '../../src/engine/types.ts';
import { setupFor } from '../helpers.ts';

describe('toTable', () => {
  it('puts the corners and the centre where the look expects them', () => {
    expect(toTable(0, 0)).toEqual({ x: -16, z: -9 });
    expect(toTable(FIELD_WIDTH * SUBPIXELS, FIELD_HEIGHT * SUBPIXELS)).toEqual({ x: 16, z: 9 });
    expect(toTable(CENTRE_X, CENTRE_Y)).toEqual({ x: 0, z: 0 });
  });
});

describe('headingRadians', () => {
  it('turns the 16 engine headings into radians, counter-clockwise from +x', () => {
    expect(headingRadians(0)).toBeCloseTo(0);
    expect(headingRadians(4)).toBeCloseTo(Math.PI / 2);
    expect(headingRadians(8)).toBeCloseTo(Math.PI);
    expect(headingRadians(12)).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe('sceneFrame', () => {
  it('glides a ship from its previous tick to its current one', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    ship.prevX = 10 * SUBPIXELS;
    ship.prevY = 10 * SUBPIXELS;
    ship.x = 20 * SUBPIXELS;
    ship.y = 10 * SUBPIXELS;
    ship.wrapped = false;

    const pose = sceneFrame(match, 0.5, [0, 0]).ships[0];
    const expected = toTable(15 * SUBPIXELS, 10 * SUBPIXELS);
    expect(pose?.x).toBeCloseTo(expected.x);
    expect(pose?.z).toBeCloseTo(expected.z);
  });

  it('snaps to the current spot instead of gliding across a wrap', () => {
    const match = setupFor(1);
    const ship = match.ships[0];
    ship.prevX = 159 * SUBPIXELS;
    ship.x = 1 * SUBPIXELS;
    ship.wrapped = true;

    const pose = sceneFrame(match, 0.2, [0, 0]).ships[0];
    const expected = toTable(ship.x, ship.y);
    expect(pose?.x).toBeCloseTo(expected.x);
    expect(pose?.z).toBeCloseTo(expected.z);
  });

  it('is null for a seat with no ship', () => {
    const solo = setupFor(14);
    expect(sceneFrame(solo, 1, [0, 0]).ships[1]).toBeNull();
  });

  it('reads a missile heading from its velocity, not its launch heading', () => {
    const match = setupFor(1);
    const shot = match.shots[0];
    shot.live = true;
    shot.vx = 4 * 256;
    shot.vy = -4 * 256;

    const pose = sceneFrame(match, 1, [0, 0]).missiles[0];
    expect(pose?.heading).toBeCloseTo(Math.atan2(4 * 256, 4 * 256));
  });

  it('shows missiles only in a duel, and pods only in docking', () => {
    const duel = setupFor(1);
    duel.shots[0].live = true;
    const duelFrame = sceneFrame(duel, 1, [0, 0]);
    expect(duelFrame.missiles[0]).not.toBeNull();
    expect(duelFrame.pods[0]).toBeNull();

    const docking = setupFor(8);
    const dockFrame = sceneFrame(docking, 1, [0, 0]);
    expect(dockFrame.missiles[0]).toBeNull();
    expect(dockFrame.pods[0]).not.toBeNull();
    expect(dockFrame.pods[1]).not.toBeNull();
  });

  it('tumbles each pod by the tick and its own offset', () => {
    const match = setupFor(8);
    match.tick = 10;
    const [pod0, pod1] = sceneFrame(match, 1, [0, 0]).pods;
    expect(pod0?.tumble).toBeCloseTo(10 * 0.04);
    expect(pod1?.tumble).toBeCloseTo(10 * 0.04 + 1.3);
  });
});

describe('CloakFader', () => {
  it('eases toward 1 when cloaked and back toward 0, over a quarter second', () => {
    const fader = createCloakFader(false);
    fader.update(0.1, [true, false]);
    expect(fader.values[0]).toBeCloseTo(0.4);
    expect(fader.values[1]).toBe(0);
    fader.update(0.1, [true, false]);
    expect(fader.values[0]).toBeCloseTo(0.8);
    fader.update(0.1, [true, false]);
    expect(fader.values[0]).toBe(1);
    fader.update(0.1, [false, false]);
    expect(fader.values[0]).toBeCloseTo(0.6);
  });

  it('jumps straight there with reduced motion', () => {
    const fader = createCloakFader(true);
    fader.update(0.001, [true, true]);
    expect(fader.values).toEqual([1, 1]);
    fader.update(0.001, [false, true]);
    expect(fader.values).toEqual([0, 1]);
  });
});
