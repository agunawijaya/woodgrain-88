import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { START_SPOTS } from '../../src/engine/match.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  IDLE,
  type Controls,
  type MatchEvent,
  type MatchSetup,
} from '../../src/engine/types.ts';
import { variation } from '../../src/engine/variations.ts';
import type { SceneFrame, SpaceView, ViewMoment } from '../../src/look/look.ts';
import { toTable } from '../../src/session/frame.ts';
import { createMatchSession, type SeatDriver } from '../../src/session/match-session.ts';

const TICK_SECONDS = 0.02;

function setupOptions(variationNumber: number, overrides: Partial<MatchSetup> = {}): MatchSetup {
  return {
    rules: variation(variationNumber),
    switches: ['B', 'B'],
    target: 10,
    clockTicks: CARTRIDGE_MATCH_TICKS,
    seed: 1,
    ...overrides,
  };
}

function idleDriver(): SeatDriver {
  return { controls: () => IDLE };
}

function fakeView(): SpaceView & {
  readonly moments: ViewMoment[];
  readonly shows: SceneFrame[];
  disposed: boolean;
} {
  const moments: ViewMoment[] = [];
  const shows: SceneFrame[] = [];
  const view = {
    root: new Group(),
    moments,
    shows,
    disposed: false,
    show(frame: SceneFrame) {
      shows.push(frame);
    },
    moment(moment: ViewMoment) {
      moments.push(moment);
    },
    update: () => undefined,
    dispose() {
      view.disposed = true;
    },
  };
  return view;
}

/** Puts shot 0 right on top of ship 1, so the very next tick scores a hit. */
function armAHit(setup: MatchSetup): ReturnType<typeof createMatchSession> {
  const session = createMatchSession({ setup, drivers: [idleDriver(), idleDriver()] });
  const match = session.match;
  match.shots[0].live = true;
  match.shots[0].life = 50;
  match.shots[0].x = match.ships[1].x;
  match.shots[0].y = match.ships[1].y;
  return session;
}

describe('advance', () => {
  it('runs whole 20 ms ticks and carries the remainder', () => {
    const session = createMatchSession({
      setup: setupOptions(1),
      drivers: [idleDriver(), idleDriver()],
    });
    session.advance(0.03); // one tick, 10 ms left over
    expect(session.match.tick).toBe(1);
    session.advance(0.03); // 10 ms carried + 30 ms: two more ticks, 10 ms left over again
    expect(session.match.tick).toBe(3);
  });

  it('runs at most maxTicksPerAdvance ticks and drops the rest', () => {
    const session = createMatchSession({
      setup: setupOptions(1),
      drivers: [idleDriver(), idleDriver()],
      maxTicksPerAdvance: 5,
    });
    session.advance(1); // fifty ticks' worth of real time
    expect(session.match.tick).toBe(5);
    session.advance(0);
    expect(session.match.tick).toBe(5); // no leftover time to catch up on
  });
});

describe('events reach the view', () => {
  it('sends a hit to the view at the victim, and nowhere else', () => {
    const view = fakeView();
    const session = createMatchSession({
      setup: setupOptions(1),
      drivers: [idleDriver(), idleDriver()],
      view,
    });
    const match = session.match;
    match.shots[0].live = true;
    match.shots[0].life = 50;
    match.shots[0].x = match.ships[1].x;
    match.shots[0].y = match.ships[1].y;

    session.advance(TICK_SECONDS);

    const hit = view.moments.find((moment) => moment.kind === 'hit');
    expect(hit).toBeDefined();
    expect(hit?.seat).toBe(1);
    const expected = toTable(START_SPOTS[1].x, START_SPOTS[1].y);
    expect(hit?.at.x).toBeCloseTo(expected.x);
    expect(hit?.at.z).toBeCloseTo(expected.z);
  });

  it('shows the current state on a new view right away, and disposes the old one', () => {
    const viewA = fakeView();
    const session = createMatchSession({
      setup: setupOptions(1),
      drivers: [idleDriver(), idleDriver()],
      view: viewA,
    });
    session.advance(TICK_SECONDS);
    const viewB = fakeView();
    session.setView(viewB);
    expect(viewB.shows).toHaveLength(1);
    expect(viewA.disposed).toBe(true);
  });
});

describe('stats', () => {
  it('counts a scored hit and the point it wins', () => {
    const session = armAHit(setupOptions(1));
    session.advance(TICK_SECONDS);
    expect(session.stats.hits[0]).toBe(1);
    expect(session.stats.points).toEqual([0]);
    expect(session.stats.bestBend[0]).toBe(0);
  });

  it('counts fuel burned as the ship thrusts', () => {
    const session = createMatchSession({
      setup: setupOptions(1),
      drivers: [{ controls: () => ({ ...IDLE, thrust: true }) }, idleDriver()],
    });
    for (let i = 0; i < 1024; i++) session.advance(TICK_SECONDS);
    expect(session.stats.fuelUsed[0]).toBeGreaterThan(0);
  });

  it('counts a dock', () => {
    const setup = setupOptions(8);
    const session = createMatchSession({ setup, drivers: [idleDriver(), idleDriver()] });
    const match = session.match;
    match.shots[0].vx = match.ships[0].vx;
    match.shots[0].vy = match.ships[0].vy;
    match.shots[0].x = match.ships[0].x;
    match.shots[0].y = match.ships[0].y;
    session.advance(TICK_SECONDS);
    expect(session.stats.docks[0]).toBe(1);
  });
});

describe('drivers', () => {
  it('lets every driver hear each tick exactly once, with the same events', () => {
    const heardA: (readonly MatchEvent[])[] = [];
    const heardB: (readonly MatchEvent[])[] = [];
    const driverA: SeatDriver = {
      hear: (events) => heardA.push(events),
      controls: () => IDLE,
    };
    const driverB: SeatDriver = {
      hear: (events) => heardB.push(events),
      controls: (): Controls => IDLE,
    };
    const session = createMatchSession({ setup: setupOptions(1), drivers: [driverA, driverB] });
    session.match.shots[0].live = true;
    session.match.shots[0].life = 50;
    session.match.shots[0].x = session.match.ships[1].x;
    session.match.shots[0].y = session.match.ships[1].y;

    session.advance(TICK_SECONDS);

    expect(heardA).toHaveLength(1);
    expect(heardB).toHaveLength(1);
    expect(heardA[0]?.some((event) => event.kind === 'hit')).toBe(true);
    expect(heardB[0]).toEqual(heardA[0]);
  });
});
