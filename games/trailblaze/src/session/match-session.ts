/**
 * The match session: the glue between the engine, whoever steers each seat,
 * and a look's view. Runs the match in fixed 20 ms ticks from real frame
 * times, routes events to the view and driver listeners, spots sealed traps,
 * and tracks match statistics for results and sharing.
 */
import { isBorderCell, startOf } from '../engine/grid.ts';
import { createMatch, startMatch, stepMatch, upcomingHeading } from '../engine/match.ts';
import {
  BORDER,
  CELL_COUNT,
  FOUR_WAY_SEATS,
  IDLE,
  SEATS,
  TICKS_PER_SECOND,
  type Cell,
  type Laid,
  type Match,
  type MatchEvent,
  type MatchSetup,
  type Seat,
  type Stick,
} from '../engine/types.ts';
import type { TrailView } from '../look/look.ts';
import { spotTraps, type Trap } from './trap.ts';

export interface SeatDriver {
  /** Everything the match said this tick (a Kid takes in what a player would see). */
  hear?(events: readonly MatchEvent[], match: Readonly<Match>): void;
  /** What the seat holds this tick. */
  stick(match: Readonly<Match>): Stick;
}

export type SessionEvent = MatchEvent | ({ readonly type: 'trap' } & Trap);

/** Who took each point, in order: one seat, or both on a shared crash. */
export type PointTaker = Seat | 'both';

export interface SessionStats {
  readonly points: readonly PointTaker[];
  /** Trail cells each rider laid over the whole match. */
  readonly cellsLaid: readonly number[];
  /** The longest a round lasted, in seconds of play (crash pauses excluded). */
  readonly longestRoundSeconds: number;
  /** Seconds each rider spent riding in the current round. */
  readonly roundSeconds: number;
  readonly traps: readonly Trap[];
}

export interface MatchSessionOptions {
  readonly setup: MatchSetup;
  readonly drivers: readonly SeatDriver[];
  readonly view?: TrailView;
  /** Called for every event as it happens, after the view has been told. */
  readonly onEvent?: (event: SessionEvent) => void;
  /** At most this many ticks run per `advance`, so a stalled tab does not fast-forward a match. */
  readonly maxTicksPerAdvance?: number; // default 10
}

export interface MatchSession {
  readonly match: Readonly<Match>;
  readonly stats: SessionStats;
  /** Moves time on by `seconds` of real time: whole 20 ms ticks, the rest carried over. */
  advance(seconds: number): void;
  /**
   * Swaps in a new view (another look, or the other appearance) drawn as the match stands: this
   * round's trails, the riders where they are and the current speed. The old view is disposed.
   */
  setView(next: TrailView): void;
  readonly over: boolean;
  dispose(): void;
}

const TICK_SECONDS = 1 / TICKS_PER_SECOND;
const DEFAULT_MAX_TICKS_PER_ADVANCE = 10;

export function createMatchSession(options: MatchSessionOptions): MatchSession {
  const { setup, drivers, onEvent } = options;
  let view = options.view;
  const match = createMatch(setup);
  const ridingSeats: readonly Seat[] =
    setup.players === 1 ? [0] : setup.players === 4 ? FOUR_WAY_SEATS : SEATS;
  const maxTicks = options.maxTicksPerAdvance ?? DEFAULT_MAX_TICKS_PER_ADVANCE;

  const points: PointTaker[] = [];
  const cellsLaid: number[] = new Array<number>(ridingSeats.length).fill(0);
  const traps: Trap[] = [];
  const alreadyTrapped = new Set<Seat>();

  /** This round's trail as laid, so a new view can be drawn up to date. */
  const roundTrail = new Map<Cell, Laid>();
  let speedStage = 0;
  let currentRoundTicks = 0;
  let maxFinishedRoundTicks = 0;
  let accumulator = 0;
  let disposed = false;

  /** Each rider's queued turn, so the picture bends toward it before the step that takes it. */
  function aimRiders(): void {
    for (const seat of ridingSeats) {
      if (match.riders[seat]?.crashed === false) view?.steer(seat, upcomingHeading(match, seat));
    }
  }

  function dispatchEvents(events: readonly MatchEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'round': {
          maxFinishedRoundTicks = Math.max(maxFinishedRoundTicks, currentRoundTicks);
          currentRoundTicks = 0;
          alreadyTrapped.clear();
          roundTrail.clear();
          speedStage = 0;
          view?.reset(setup.rules.edges);
          for (const seat of ridingSeats) {
            const start = startOf(setup, seat);
            view?.placeRider(seat, start.cell, start.heading);
          }
          onEvent?.(event);
          break;
        }
        case 'step': {
          view?.step(event.laid, event.erased, event.moves, event.period / TICKS_PER_SECOND);
          for (const cell of event.erased) roundTrail.delete(cell);
          for (const laid of event.laid) roundTrail.set(laid.cell, laid);
          for (const laid of event.laid) {
            const seatIndex = ridingSeats.indexOf(laid.seat);
            if (seatIndex !== -1) {
              cellsLaid[seatIndex] = (cellsLaid[seatIndex] ?? 0) + 1;
            }
          }
          onEvent?.(event);
          const newlyTrapped = spotTraps(match, event.laid, alreadyTrapped);
          for (const trap of newlyTrapped) {
            alreadyTrapped.add(trap.seat);
            traps.push(trap);
            view?.trap(trap.seat, trap.pocket, trap.seal);
            onEvent?.({ type: 'trap', ...trap });
          }
          break;
        }
        case 'shrink': {
          for (const cell of event.cells) roundTrail.delete(cell);
          view?.shrink(event.cells);
          onEvent?.(event);
          break;
        }
        case 'speed': {
          speedStage = event.stage;
          view?.setSpeedStage(event.stage);
          onEvent?.(event);
          break;
        }
        case 'crash': {
          for (const crash of event.crashes) {
            view?.crash(crash);
          }
          if (setup.players === 2) {
            const crashed0 = event.crashes.some((c) => c.seat === 0);
            const crashed1 = event.crashes.some((c) => c.seat === 1);
            if (crashed0 && crashed1) {
              points.push('both');
            } else if (crashed0) {
              points.push(1);
            } else if (crashed1) {
              points.push(0);
            }
          }
          onEvent?.(event);
          break;
        }
        case 'over': {
          view?.freeze();
          onEvent?.(event);
          break;
        }
        case 'point': {
          if (setup.players === 4) {
            points.push(event.seat);
          }
          onEvent?.(event);
          break;
        }
        case 'turn': {
          onEvent?.(event);
          break;
        }
      }
    }
  }

  /** Read through a function, so a check after `tick()` is not narrowed by one made before it. */
  function isOver(): boolean {
    return match.phase === 'over';
  }

  function tick(): void {
    const wasRunning = match.phase === 'running';

    const sticks = ridingSeats.map((seat) => {
      const driver = drivers[seat];
      return driver ? driver.stick(match) : IDLE;
    });
    const events = stepMatch(match, sticks);

    if (wasRunning) {
      currentRoundTicks += 1;
    }

    for (const seat of ridingSeats) {
      drivers[seat]?.hear?.(events, match);
    }

    dispatchEvents(events);
  }

  /** Cells the Shrinking Arena has walled off this round: border that is not the arena's edge. */
  function closedRings(): Cell[] {
    const closed: Cell[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (match.cells[cell] === BORDER && !isBorderCell(cell)) closed.push(cell);
    }
    return closed;
  }

  view?.setRemix(setup.rules.remix);
  const initialEvents = startMatch(match);
  for (const seat of ridingSeats) {
    drivers[seat]?.hear?.(initialEvents, match);
  }
  dispatchEvents(initialEvents);

  return {
    get match(): Readonly<Match> {
      return match;
    },
    get stats(): SessionStats {
      const longestRoundSeconds =
        Math.max(maxFinishedRoundTicks, currentRoundTicks) / TICKS_PER_SECOND;
      const roundSeconds = currentRoundTicks / TICKS_PER_SECOND;
      return {
        points: [...points],
        cellsLaid: [...cellsLaid],
        longestRoundSeconds,
        roundSeconds,
        traps: [...traps],
      };
    },
    advance(seconds: number): void {
      if (disposed) return;

      if (match.phase !== 'over') {
        accumulator += seconds;
        let ticksToRun = Math.floor((accumulator + 1e-9) / TICK_SECONDS);
        if (ticksToRun > maxTicks) {
          ticksToRun = maxTicks;
          accumulator = 0;
        } else {
          accumulator -= ticksToRun * TICK_SECONDS;
          if (accumulator < 1e-9) {
            accumulator = 0;
          }
        }

        for (let i = 0; i < ticksToRun; i++) {
          tick();
          if (isOver()) {
            accumulator = 0;
            break;
          }
        }
        aimRiders();
      }

      view?.update(seconds);
    },
    setView(next: TrailView): void {
      view?.dispose();
      view = next;
      next.setRemix(setup.rules.remix);
      next.reset(setup.rules.edges);
      next.shrink(closedRings());
      next.step([...roundTrail.values()], [], [], 0);
      for (const seat of ridingSeats) {
        const rider = match.riders[seat];
        if (rider) {
          next.placeRider(seat, rider.cell, rider.heading);
        }
      }
      next.setSpeedStage(speedStage);
      if (match.phase === 'over') next.freeze();
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
