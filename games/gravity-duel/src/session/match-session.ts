/**
 * The match session: the glue between the engine, whoever flies each seat,
 * and a look's view. Runs the match in fixed 20 ms ticks from real frame
 * times, turns every engine event into the view's moments, and tallies the
 * session's own statistics for results and sharing.
 */
import { Vector3 } from 'three';
import { createMatch, stepMatch } from '../engine/match.ts';
import {
  CENTRE_X,
  CENTRE_Y,
  SEATS,
  TICKS_PER_SECOND,
  type Controls,
  type Match,
  type MatchEvent,
  type MatchSetup,
  type Seat,
} from '../engine/types.ts';
import type { SceneFrame, SpaceView, ViewMoment } from '../look/look.ts';
import { createCloakFader, sceneFrame, toTable } from './frame.ts';

export interface SeatDriver {
  /** Everything the match said last tick (a Kid takes in what a player would see). */
  hear?(events: readonly MatchEvent[], match: Readonly<Match>): void;
  /** What the seat's hands hold this tick. */
  controls(match: Readonly<Match>): Controls;
}

export interface SessionStats {
  /** Who scored each point, in order (for the share line and the results). */
  readonly points: readonly Seat[];
  /** Per seat. */
  readonly shotsFired: readonly [number, number];
  readonly hits: readonly [number, number];
  readonly fuelUsed: readonly [number, number]; // whole segments burned (thrust, cloak)
  readonly docks: readonly [number, number];
  readonly starCrashes: readonly [number, number];
  /** The largest |turned| (radians) of any missile that scored, per seat. */
  readonly bestBend: readonly [number, number];
}

export interface MatchSessionOptions {
  readonly setup: MatchSetup;
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly view?: SpaceView;
  readonly reducedMotion?: boolean;
  /** Called for every engine event as it happens, after the view has been told. */
  readonly onEvent?: (event: MatchEvent, match: Readonly<Match>) => void;
  /** Called once after every engine tick (not every frame), for the tracker and the Kid replay. */
  readonly onTick?: (match: Readonly<Match>) => void;
  /**
   * The trajectory guide, recomputed as often as the caller likes (it is cheap to call every
   * frame; the controller only bothers every few ticks). Left out, no seat shows a guide.
   */
  readonly guides?: (match: Readonly<Match>) => SceneFrame['guides'];
  readonly maxTicksPerAdvance?: number; // default 10
}

export interface MatchSession {
  readonly match: Readonly<Match>;
  readonly stats: SessionStats;
  /** Real seconds: whole 20 ms ticks, the remainder carried; then the view is shown at the remainder. */
  advance(seconds: number): void;
  /** Swap in another view (look or appearance change), drawn as the match stands. */
  setView(next: SpaceView): void;
  readonly over: boolean;
  dispose(): void;
}

const TICK_SECONDS = 1 / TICKS_PER_SECOND;
const DEFAULT_MAX_TICKS_PER_ADVANCE = 10;

/** A spot on the table, as a `ViewMoment` wants it. */
function tablePoint(x: number, y: number): Vector3 {
  const { x: tx, z: tz } = toTable(x, y);
  return new Vector3(tx, 0, tz);
}

/** Halfway between the middle and a spot on the table. */
function midTablePoint(x: number, y: number): Vector3 {
  const middle = toTable(CENTRE_X, CENTRE_Y);
  const spot = toTable(x, y);
  return new Vector3((middle.x + spot.x) / 2, 0, (middle.z + spot.z) / 2);
}

/** A spot before this tick ran, for the one moment the engine has already moved its ship away from. */
interface PreTickSpot {
  readonly x: number;
  readonly y: number;
}

export function createMatchSession(options: MatchSessionOptions): MatchSession {
  const { setup, drivers, onEvent } = options;
  let view = options.view;
  const match = createMatch(setup);
  const maxTicks = options.maxTicksPerAdvance ?? DEFAULT_MAX_TICKS_PER_ADVANCE;
  const fader = createCloakFader(options.reducedMotion ?? false);

  let accumulator = 0;
  let clock = 0;
  let disposed = false;

  const points: Seat[] = [];
  const shotsFired: [number, number] = [0, 0];
  const hits: [number, number] = [0, 0];
  const fuelUsed: [number, number] = [0, 0];
  const docks: [number, number] = [0, 0];
  const starCrashes: [number, number] = [0, 0];
  const bestBend: [number, number] = [0, 0];
  const lastFuel: [number, number] = [match.ships[0].fuel, match.ships[1].fuel];

  /**
   * The moment to show the view, at the spot the brief asks for. Every kind but a star crash
   * reads the ship's or shot's `prev` position: the engine always sets it to where the body
   * stood before this tick's move, which is exactly where a touch happened. A star crash is the
   * exception — the engine sends the ship home before the tick finishes, overwriting `prev` too —
   * so `preTick` (each ship's spot as this tick began) stands in for it.
   */
  function momentFor(
    event: MatchEvent,
    preTick: readonly [PreTickSpot, PreTickSpot],
  ): ViewMoment | null {
    switch (event.kind) {
      case 'fired': {
        const ship = match.ships[event.seat];
        return { kind: 'fired', seat: event.seat, at: tablePoint(ship.prevX, ship.prevY) };
      }
      case 'hit': {
        const victim = match.ships[event.victim];
        return { kind: 'hit', seat: event.victim, at: tablePoint(victim.prevX, victim.prevY) };
      }
      case 'self-hit': {
        if (!event.exploded) return null;
        const ship = match.ships[event.seat];
        return { kind: 'self-hit', seat: event.seat, at: tablePoint(ship.prevX, ship.prevY) };
      }
      case 'star-crash': {
        const spot = preTick[event.seat];
        return { kind: 'star-crash', seat: event.seat, at: midTablePoint(spot.x, spot.y) };
      }
      case 'cloak-burnout': {
        const ship = match.ships[event.seat];
        return { kind: 'burnout', seat: event.seat, at: tablePoint(ship.prevX, ship.prevY) };
      }
      case 'swallowed': {
        const shot = match.shots[event.seat];
        return { kind: 'swallowed', seat: event.seat, at: tablePoint(shot.x, shot.y) };
      }
      case 'refuelled':
        return { kind: 'refuelled', seat: event.seat, at: tablePoint(CENTRE_X, CENTRE_Y) };
      case 'docked': {
        const pod = match.shots[event.pod];
        return { kind: 'docked', seat: event.seat, at: tablePoint(pod.prevX, pod.prevY) };
      }
      default:
        return null;
    }
  }

  function tally(event: MatchEvent): void {
    switch (event.kind) {
      case 'fired':
        shotsFired[event.seat] += 1;
        break;
      case 'hit':
        hits[event.shooter] += 1;
        bestBend[event.shooter] = Math.max(bestBend[event.shooter], Math.abs(event.turned));
        break;
      case 'docked':
        docks[event.seat] += 1;
        break;
      case 'star-crash':
        starCrashes[event.seat] += 1;
        break;
      case 'scored':
        points.push(event.seat);
        break;
      default:
        break;
    }
  }

  function dispatch(
    events: readonly MatchEvent[],
    preTick: readonly [PreTickSpot, PreTickSpot],
  ): void {
    for (const event of events) {
      const moment = momentFor(event, preTick);
      if (moment) view?.moment(moment);
      onEvent?.(event, match);
      tally(event);
    }
  }

  function tick(): void {
    const preTick: [PreTickSpot, PreTickSpot] = [
      { x: match.ships[0].x, y: match.ships[0].y },
      { x: match.ships[1].x, y: match.ships[1].y },
    ];
    const controls: [Controls, Controls] = [drivers[0].controls(match), drivers[1].controls(match)];
    stepMatch(match, controls);
    const events = match.events;
    for (const driver of drivers) driver.hear?.(events, match);
    dispatch(events, preTick);
    for (const seat of SEATS) {
      const fuel = match.ships[seat].fuel;
      if (fuel < lastFuel[seat]) fuelUsed[seat] += lastFuel[seat] - fuel;
      lastFuel[seat] = fuel;
    }
    options.onTick?.(match);
  }

  /** Read through a function, so a check after `tick()` is not narrowed by one made before it. */
  function isOver(): boolean {
    return match.phase === 'over';
  }

  /** This tick's picture, with the trajectory guide merged in when the caller asks for one. */
  function framed(alpha: number): SceneFrame {
    const frame = sceneFrame(match, alpha, fader.values);
    const guides = options.guides?.(match);
    return guides ? { ...frame, guides } : frame;
  }

  return {
    get match(): Readonly<Match> {
      return match;
    },
    get stats(): SessionStats {
      return {
        points: [...points],
        shotsFired: [...shotsFired] as [number, number],
        hits: [...hits] as [number, number],
        fuelUsed: [...fuelUsed] as [number, number],
        docks: [...docks] as [number, number],
        starCrashes: [...starCrashes] as [number, number],
        bestBend: [...bestBend] as [number, number],
      };
    },
    advance(elapsed: number): void {
      if (disposed) return;
      // Time never runs backwards here, whatever a caller's clock does.
      const seconds = Math.max(0, elapsed);
      clock += seconds;

      if (match.phase !== 'over') {
        accumulator += seconds;
        let ticksToRun = Math.floor((accumulator + 1e-9) / TICK_SECONDS);
        if (ticksToRun > maxTicks) {
          ticksToRun = maxTicks;
          accumulator = 0;
        } else {
          accumulator -= ticksToRun * TICK_SECONDS;
          if (accumulator < 1e-9) accumulator = 0;
        }
        for (let i = 0; i < ticksToRun; i++) {
          tick();
          if (isOver()) {
            accumulator = 0;
            break;
          }
        }
      }

      fader.update(seconds, [match.ships[0].cloaked, match.ships[1].cloaked]);
      const alpha = accumulator / TICK_SECONDS;
      view?.show(framed(alpha));
      view?.update(seconds, clock);
    },
    setView(next: SpaceView): void {
      view?.dispose();
      view = next;
      const alpha = accumulator / TICK_SECONDS;
      next.show(framed(alpha));
    },
    get over(): boolean {
      return match.phase === 'over';
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      view?.dispose();
    },
  };
}
