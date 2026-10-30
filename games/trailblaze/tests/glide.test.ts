/**
 * Tests for how far the picture runs behind the rules: a scripted round on the
 * real engine drives the real trail rig, and after every frame each rider is
 * drawn no more than one cell from where the rules have its head, half a cell
 * on average. A turn the rules have queued bends the glide before the step
 * that takes it.
 */
import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { vectorOf } from '../src/engine/headings.ts';
import { createMatch, startMatch, stepMatch, upcomingHeading } from '../src/engine/match.ts';
import {
  IDLE,
  SEATS,
  TICKS_PER_SECOND,
  type Heading,
  type Match,
  type MatchEvent,
  type Stick,
} from '../src/engine/types.ts';
import { variationRules } from '../src/engine/variations.ts';
import { cellCentre } from '../src/look/board-space.ts';
import type { TrailView, ViewOptions } from '../src/look/look.ts';
import { createTrailView, type LookParts, type RiderFigure } from '../src/look/trail-rig.ts';

const noop = (): void => undefined;
/** Drawn frames at 60 a second; the rules tick at 50. */
const FRAME = 1 / 60;
const TICK = 1 / TICKS_PER_SECOND;

function figure(): RiderFigure {
  return { root: new Group(), ride: noop, crash: noop, reset: noop, dispose: noop };
}

function createView(): TrailView {
  const parts: LookParts = {
    root: new Group(),
    pieces: { addCell: noop, removeCell: noop, setTail: noop, clear: noop, dispose: noop },
    riders: [figure(), figure()],
    remixStyle: { wall: '#ffffff', wallHeight: 1, lane: '#ffffff', night: false },
    reset: noop,
    crash: noop,
    trap: noop,
    update: noop,
    dispose: noop,
  };
  return createTrailView({ players: 2 } as ViewOptions, parts);
}

function play(view: TrailView, match: Match, events: readonly MatchEvent[]): void {
  for (const event of events) {
    if (event.type === 'round') {
      view.reset(match.setup.rules.edges);
      for (const seat of SEATS) {
        const rider = match.riders[seat];
        if (rider) view.placeRider(seat, rider.cell, rider.heading);
      }
    } else if (event.type === 'step') {
      view.step(event.laid, event.erased, event.moves, event.period / TICKS_PER_SECOND);
    } else if (event.type === 'crash') {
      for (const crash of event.crashes) view.crash(crash);
    }
  }
}

function stickFor(heading: Heading | undefined): Stick {
  if (!heading) return IDLE;
  const { east, south } = vectorOf(heading);
  return { east, south, fire: false };
}

/** Each seat's heading for every step, unrolled from runs of [heading, steps]. */
function plan(runs: readonly (readonly [Heading, number])[]): Heading[] {
  return runs.flatMap(([heading, steps]) => Array.from({ length: steps }, () => heading));
}

/** Seat 1 boxes in the left half, seat 2 the right: plenty of turns and no crash for a while. */
const PLANS = [
  plan([
    ['up', 4],
    ['right', 5],
    ['down', 7],
    ['right', 3],
    ['up', 9],
    ['left', 6],
  ]),
  plan([
    ['down', 4],
    ['left', 5],
    ['up', 7],
    ['left', 3],
    ['down', 9],
    ['right', 6],
  ]),
];

/**
 * Plays the scripted round frame by frame, the rules ticking at 50 a second and the picture
 * drawn at 60, and measures each riding seat's distance from its head after every frame.
 */
function measureLag(variation: number): number[] {
  const match = createMatch({
    rules: variationRules(variation),
    players: 2,
    switches: ['B', 'B'],
    target: 10,
  });
  const view = createView();
  play(view, match, startMatch(match));
  const lags: number[] = [];
  const drawn = new Vector3();
  const head = new Vector3();
  let rulesClock = 0;
  for (let frame = 0; frame < 60 * 12 && match.round === 1; frame++) {
    rulesClock += FRAME;
    while (rulesClock >= TICK) {
      rulesClock -= TICK;
      const sticks = SEATS.map((seat) => stickFor(PLANS[seat]?.[match.steps]));
      play(view, match, stepMatch(match, sticks));
    }
    for (const seat of SEATS) {
      if (!match.riders[seat]?.crashed) view.steer(seat, upcomingHeading(match, seat));
    }
    view.update(FRAME);
    if (match.riders.some((rider) => rider.crashed)) break;
    for (const seat of SEATS) {
      const rider = match.riders[seat];
      if (!rider) continue;
      view.riderPosition(seat, drawn);
      cellCentre(rider.cell, 0, head);
      lags.push(Math.hypot(drawn.x - head.x, drawn.z - head.z));
    }
  }
  return lags;
}

describe('the glide', () => {
  for (const [name, variation] of [
    ['at a constant speed', 1],
    ['through the speed-up', 3],
  ] as const) {
    it(`never draws a rider more than one cell behind the rules ${name}`, () => {
      const lags = measureLag(variation);
      expect(lags.length).toBeGreaterThan(600);
      expect(Math.max(...lags)).toBeLessThanOrEqual(1.0001);
      const mean = lags.reduce((sum, lag) => sum + lag, 0) / lags.length;
      expect(mean).toBeGreaterThan(0.35);
      expect(mean).toBeLessThan(0.65);
    });
  }

  it('bends toward a queued turn before the step that takes it', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    const view = createView();
    play(view, match, startMatch(match));
    // Ride straight until the first step, then queue a turn and watch the picture before the next.
    while (match.steps < 1) play(view, match, stepMatch(match, [IDLE, IDLE]));
    const heading = match.riders[0]?.heading ?? 'right';
    const turn: Heading = heading === 'up' || heading === 'down' ? 'right' : 'up';
    const stepsBefore = match.steps;
    const drawn = new Vector3();
    let bent = false;
    while (match.steps === stepsBefore) {
      play(view, match, stepMatch(match, [stickFor(turn), IDLE]));
      if (match.steps !== stepsBefore) break;
      view.steer(0, upcomingHeading(match, 0));
      view.update(TICK);
      view.riderPosition(0, drawn);
      const head = cellCentre(match.riders[0]?.cell ?? 0);
      const { east, south } = vectorOf(turn);
      const sideways = (drawn.x - head.x) * east + (drawn.z - head.z) * south;
      if (sideways > 0.01) bent = true;
    }
    expect(bent).toBe(true);
  });
});
