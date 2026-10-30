/**
 * Trailblaze's fixed-step match engine, timed in 20 ms ticks (50 Hz):
 *
 * - Each round starts with a fresh 40x20 grid (bordered in variations 1–7,
 *   open wraparound in 8–14), riders at their starting cells, and a 15-tick
 *   initial step period.
 * - On each step, every active rider first writes its vacated cell (or clears
 *   it to EMPTY if holding fire in gap/erase modes, with seat 0 written before
 *   seat 1), pilots are queried so they see the newly written trail blocks,
 *   turns are resolved, riders advance one cell, and collisions against trail
 *   or border cells are checked.
 * - On difficulty switch B, reversal protection masks out the cardinal axis
 *   directly opposite to a rider's current heading, but only while the rider's
 *   current heading is cardinal; diagonal headings bypass the filter entirely.
 * - When a non-ending crash occurs, play pauses for 240 ticks if seat 0
 *   crashed (alone or with seat 1) or 224 ticks if seat 1 crashed alone; a
 *   crash that brings a seat to the target score ends the match immediately.
 * - In Four Way, a crash leaves the other riders riding; the round ends on
 *   the step where at most one rider survives, scoring one point for a lone
 *   survivor, or nobody if the last riders crashed together.
 * - Remix rules add Fading Trails (cells vanish after fadeAfter ticks),
 *   Shrinking Arena (concentric border rings close in over time), and
 *   Boost Lanes (riders on designated floor lanes take half steps twice as often).
 */
import type { SwitchPosition } from '@woodgrain-88/kit';
import { isBorderCell, startOf, stepFrom } from './grid.ts';
import { headingFromStick, isDiagonal, vectorOf } from './headings.ts';
import { applyShrink, fadeTrails, isBoostLane, isHalfStepTick } from './remix.ts';
import {
  BORDER,
  CELL_COUNT,
  EMPTY,
  FOUR_WAY_SEATS,
  SEATS,
  type Cell,
  type CellContent,
  type Crash,
  type Heading,
  type Laid,
  type Match,
  type MatchEvent,
  type MatchSetup,
  type Move,
  type Rider,
  type Seat,
  type Stick,
} from './types.ts';

export const CARTRIDGE_TARGET = 10;
export const FIRST_STEP_PERIOD = 15;
export const FASTEST_STEP_PERIOD = 3;
export const SPEED_UP_EVERY = 256;
export const CRASH_PAUSE_TICKS = 240;
export const SHORT_CRASH_PAUSE_TICKS = 224;

const SPEED_STEP_DROP = 3;

export function createMatch(setup: MatchSetup): Match {
  const cells = new Int8Array(CELL_COUNT);
  const laidAt = new Int32Array(CELL_COUNT);
  resetBoard(cells, laidAt, setup.rules.edges === 'bordered');

  const isFourWay = setup.players === 4;
  const riders = isFourWay
    ? [createRider(setup, 0), createRider(setup, 1), createRider(setup, 2), createRider(setup, 3)]
    : [createRider(setup, 0), createRider(setup, 1)];

  return {
    setup,
    cells,
    laidAt,
    riders,
    phase: 'running',
    round: 0,
    tick: 0,
    roundTick: 0,
    steps: 0,
    stepPeriod: FIRST_STEP_PERIOD,
    untilStep: FIRST_STEP_PERIOD,
    pauseTicks: 0,
    shrunk: 0,
    winner: null,
  };
}

/** Lays out round 1. Call once; its events start the match. */
export function startMatch(match: Match): MatchEvent[] {
  const events: MatchEvent[] = [];
  match.round = 0;
  beginRound(match, events);
  return events;
}

/**
 * The heading a rider will step on next if nothing more is pushed before the step: its latched
 * push, filtered the way the step will filter it, or its current heading. The picture uses it to
 * start a queued turn at once instead of after the step.
 */
export function upcomingHeading(match: Readonly<Match>, seat: Seat): Heading {
  const rider = match.riders[seat];
  if (!rider) return 'right';
  if (match.setup.rules.motion === 'free-draw' || rider.latched === null) return rider.heading;
  const switchPos = match.setup.switches[seat] ?? 'B';
  const filtered = filterReversal(
    rider.heading,
    rider.latched,
    switchPos,
    match.setup.rules.steering,
  );
  return filtered ?? rider.heading;
}

/** One 20 ms tick with what each seat holds (idle sticks filled when omitted). */
export function stepMatch(match: Match, sticks: readonly Stick[]): MatchEvent[] {
  const events: MatchEvent[] = [];
  if (match.phase === 'over') return events;

  match.tick += 1;

  if (match.phase === 'crash') {
    match.pauseTicks -= 1;
    if (match.pauseTicks <= 0) {
      beginRound(match, events);
    }
    return events;
  }

  match.roundTick += 1;
  latchInputs(match, sticks);
  updateSpeed(match, events);

  if (closeInRing(match, events)) return events;

  match.untilStep -= 1;
  if (match.untilStep === 0) {
    match.untilStep = match.stepPeriod;
    match.steps += 1;
    const movingSeats = activeSeats(match).filter((seat) => {
      const rider = match.riders[seat];
      return rider !== undefined && !rider.crashed;
    });
    executeStep(match, movingSeats, false, sticks, events);
    return events;
  }

  if (isHalfStepTick(match)) {
    executeHalfStep(match, sticks, events);
  }

  return events;
}

function createRider(setup: MatchSetup, seat: Seat): Rider {
  const start = startOf(setup, seat);
  return {
    cell: start.cell,
    heading: start.heading,
    latched: null,
    fire: false,
    crashed: false,
    score: 0,
  };
}

function resetBoard(cells: Int8Array, laidAt: Int32Array, bordered: boolean): void {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    cells[cell] = bordered && isBorderCell(cell) ? BORDER : EMPTY;
    laidAt[cell] = -1;
  }
}

function beginRound(match: Match, events: MatchEvent[]): void {
  resetBoard(match.cells, match.laidAt, match.setup.rules.edges === 'bordered');
  for (let s = 0; s < match.riders.length; s++) {
    const seat = s as Seat;
    const rider = match.riders[seat];
    if (!rider) continue;
    const start = startOf(match.setup, seat);
    rider.cell = start.cell;
    rider.heading = start.heading;
    rider.latched = null;
    rider.fire = false;
    rider.crashed = false;
  }
  match.phase = 'running';
  match.round += 1;
  match.roundTick = 0;
  match.steps = 0;
  match.stepPeriod = FIRST_STEP_PERIOD;
  match.untilStep = FIRST_STEP_PERIOD;
  match.pauseTicks = 0;
  match.shrunk = 0;
  events.push({ type: 'round', round: match.round });
}

function activeSeats(match: Readonly<Match>): readonly Seat[] {
  if (match.setup.players === 1) return [0];
  if (match.setup.players === 4) return FOUR_WAY_SEATS;
  return SEATS;
}

function latchInputs(match: Match, sticks: readonly Stick[]): void {
  const { rules, pilots } = match.setup;
  for (const seat of activeSeats(match)) {
    const rider = match.riders[seat];
    if (!rider || rider.crashed) continue;
    const stick = sticks[seat] ?? { east: 0, south: 0, fire: false };
    rider.fire = stick.fire;
    if (rules.motion === 'continuous' && !pilots?.[seat]) {
      const pushed = headingFromStick(stick, rules.steering);
      if (pushed !== null) {
        rider.latched = pushed;
      }
    }
  }
}

function updateSpeed(match: Match, events: MatchEvent[]): void {
  if (!match.setup.rules.speedUp) return;
  if (match.roundTick % SPEED_UP_EVERY !== 0) return;
  if (match.stepPeriod <= FASTEST_STEP_PERIOD) return;

  const stage = match.roundTick / SPEED_UP_EVERY;
  match.stepPeriod = Math.max(FASTEST_STEP_PERIOD, match.stepPeriod - SPEED_STEP_DROP);
  events.push({ type: 'speed', stage, period: match.stepPeriod });
}

/**
 * Shrinking Arena: closes the next ring when its time comes. Riders standing on it crash at once,
 * and then this tick is over: true when that happened.
 */
function closeInRing(match: Match, events: MatchEvent[]): boolean {
  const shrink = applyShrink(match);
  if (!shrink) return false;

  events.push({ type: 'shrink', ring: shrink.ring, cells: shrink.cells });

  const crashes: Crash[] = [];
  for (const seat of activeSeats(match)) {
    const rider = match.riders[seat];
    if (rider && !rider.crashed && match.cells[rider.cell] === BORDER) {
      rider.crashed = true;
      crashes.push({ seat, cell: rider.cell, into: BORDER });
    }
  }

  if (crashes.length === 0) return false;
  processCrashes(match, crashes, events);
  return true;
}

/**
 * Executes a half step for any active, non-crashed riders currently on boost lanes.
 * Off-lane riders do not move and keep their latched input intact.
 */
function executeHalfStep(match: Match, sticks: readonly Stick[], events: MatchEvent[]): void {
  const movingSeats = activeSeats(match).filter((seat) => {
    const rider = match.riders[seat];
    return rider !== undefined && !rider.crashed && isBoostLane(match, rider.cell);
  });
  if (movingSeats.length === 0) return;
  executeStep(match, movingSeats, true, sticks, events);
}

function executeStep(
  match: Match,
  seats: readonly Seat[],
  isHalfStep: boolean,
  sticks: readonly Stick[],
  events: MatchEvent[],
): void {
  const { rules, switches, pilots } = match.setup;
  const canErase = rules.fire === 'gaps' || rules.fire === 'erase';

  const enteredHeadings: (Heading | null)[] = match.riders.map((r) => r.heading);
  const seatsThatLaid: Seat[] = [];
  const erasedSet = new Set<Cell>(fadeTrails(match));

  // 3a. Write or clear each moving rider's current cell (in seat order).
  for (const seat of seats) {
    const rider = match.riders[seat];
    if (!rider) continue;
    const cell = rider.cell;
    if (rider.fire && canErase) {
      const prior = match.cells[cell] as CellContent;
      if (prior >= 0) {
        erasedSet.add(cell);
      }
      match.cells[cell] = EMPTY;
      match.laidAt[cell] = -1;
    } else {
      erasedSet.delete(cell);
      match.cells[cell] = seat;
      match.laidAt[cell] = match.tick;
      seatsThatLaid.push(seat);
    }
  }

  // 3b. Query pilots (seeing the cells just written) and apply turns.
  const stepHeadings = new Map<Seat, Heading | null>();
  for (const seat of seats) {
    const rider = match.riders[seat];
    if (!rider) continue;
    const pilot = pilots?.[seat];
    const stick = sticks[seat] ?? { east: 0, south: 0, fire: false };

    if (rules.motion === 'free-draw') {
      const desired = pilot ? pilot(match, seat) : headingFromStick(stick, rules.steering);
      stepHeadings.set(seat, desired);
      if (desired !== null && desired !== rider.heading) {
        const from = rider.heading;
        rider.heading = desired;
        events.push({ type: 'turn', seat, from, to: desired });
      }
    } else {
      if (pilot) {
        rider.latched = pilot(match, seat);
      }
      const latched = rider.latched;
      rider.latched = null;
      if (latched !== null) {
        const switchPos = switches[seat] ?? 'B';
        const filtered = filterReversal(rider.heading, latched, switchPos, rules.steering);
        if (filtered !== null && filtered !== rider.heading) {
          const from = rider.heading;
          rider.heading = filtered;
          events.push({ type: 'turn', seat, from, to: filtered });
        }
      }
      stepHeadings.set(seat, rider.heading);
    }
  }

  const laid: Laid[] = seatsThatLaid.map((seat) => {
    const rider = match.riders[seat];
    return {
      cell: rider ? rider.cell : 0,
      seat,
      entered: enteredHeadings[seat] ?? 'right',
      left: rider ? rider.heading : 'right',
    };
  });
  const erased: Cell[] = [...erasedSet];

  // 3c. Advance every moving rider along its step heading.
  const moves: Move[] = [];
  const halfStepPeriod = Math.ceil(match.stepPeriod / 2);
  for (const seat of seats) {
    const moveHeading = stepHeadings.get(seat);
    if (!moveHeading) continue;
    const rider = match.riders[seat];
    if (!rider) continue;
    const from = rider.cell;
    const { cell: to, wrapped } = stepFrom(from, moveHeading);
    rider.cell = to;

    const ticks = isHalfStep
      ? match.stepPeriod - halfStepPeriod
      : isBoostLane(match, to)
        ? halfStepPeriod
        : match.stepPeriod;

    moves.push({ seat, from, to, heading: moveHeading, wrapped, ticks });
  }

  events.push({
    type: 'step',
    laid,
    erased,
    moves,
    period: match.stepPeriod,
  });

  // 3d. Check collisions in continuous-motion variations only.
  if (rules.motion !== 'continuous') return;

  const crashes: Crash[] = [];
  for (const seat of seats) {
    const rider = match.riders[seat];
    if (!rider) continue;
    const into = match.cells[rider.cell] as CellContent;
    if (into !== EMPTY) {
      rider.crashed = true;
      crashes.push({ seat, cell: rider.cell, into });
    }
  }

  if (crashes.length === 0) return;

  processCrashes(match, crashes, events);
}

/**
 * Handles points, victory checks, solo ending, and crash pauses for collisions.
 */
function processCrashes(match: Match, crashes: readonly Crash[], events: MatchEvent[]): void {
  events.push({ type: 'crash', crashes });

  if (match.setup.players === 1) {
    match.phase = 'over';
    match.pauseTicks = 0;
    match.winner = null;
    events.push({
      type: 'over',
      winner: null,
      scores: match.riders.map((r) => r.score),
    });
    return;
  }

  if (match.setup.players === 4) {
    processFourWayCrashes(match, events);
    return;
  }

  // Duel (players === 2): unchanged behaviour
  const rider0 = match.riders[0];
  const rider1 = match.riders[1];
  if (!rider0 || !rider1) return;

  // Each crashed rider gives the rival one point; seat 0's point event comes first.
  if (rider1.crashed) {
    rider0.score += 1;
    events.push({ type: 'point', seat: 0, score: rider0.score });
  }
  if (rider0.crashed) {
    rider1.score += 1;
    events.push({ type: 'point', seat: 1, score: rider1.score });
  }

  const score0 = rider0.score;
  const score1 = rider1.score;
  const target = match.setup.target;

  if (score0 >= target || score1 >= target) {
    match.phase = 'over';
    match.pauseTicks = 0;
    match.winner = score0 >= target && score1 >= target ? null : score0 >= target ? 0 : 1;
    events.push({
      type: 'over',
      winner: match.winner,
      scores: [score0, score1],
    });
  } else {
    match.phase = 'crash';
    match.pauseTicks = rider0.crashed ? CRASH_PAUSE_TICKS : SHORT_CRASH_PAUSE_TICKS;
  }
}

/**
 * Four Way crash resolution: rounds continue while at least two riders remain;
 * the lone survivor scores one point, or nobody scores if the last riders crashed together.
 */
function processFourWayCrashes(match: Match, events: MatchEvent[]): void {
  const survivors = FOUR_WAY_SEATS.filter((seat) => {
    const rider = match.riders[seat];
    return rider !== undefined && !rider.crashed;
  });

  if (survivors.length > 1) {
    return;
  }

  if (survivors.length === 1) {
    const survivorSeat = survivors[0];
    if (survivorSeat !== undefined) {
      const survivor = match.riders[survivorSeat];
      if (survivor) {
        survivor.score += 1;
        events.push({ type: 'point', seat: survivorSeat, score: survivor.score });
      }
    }
  }

  const target = match.setup.target;
  const targetReached = match.riders.some((r) => r.score >= target);

  if (targetReached) {
    match.phase = 'over';
    match.pauseTicks = 0;
    match.winner = determineWinner(match);
    events.push({
      type: 'over',
      winner: match.winner,
      scores: match.riders.map((r) => r.score),
    });
  } else {
    match.phase = 'crash';
    match.pauseTicks = CRASH_PAUSE_TICKS;
  }
}

function determineWinner(match: Match): Seat | null {
  let maxScore = -1;
  let winnerSeat: Seat | null = null;
  let tieAtTop = false;

  for (let s = 0; s < match.riders.length; s++) {
    const rider = match.riders[s];
    if (!rider) continue;
    if (rider.score > maxScore) {
      maxScore = rider.score;
      winnerSeat = s as Seat;
      tieAtTop = false;
    } else if (rider.score === maxScore) {
      tieAtTop = true;
    }
  }

  return tieAtTop ? null : winnerSeat;
}

/**
 * Applies the 1977 reversal filter: on switch B, only when the rider's current
 * heading is one of the four cardinal directions, the axis directly opposite
 * to the current heading is masked out of the latched input. A pure opposite
 * cardinal push becomes empty (null) and is ignored; a diagonal push containing
 * the opposite component keeps its perpendicular component.
 */
function filterReversal(
  current: Heading,
  candidate: Heading,
  difficulty: SwitchPosition,
  steering: 4 | 8,
): Heading | null {
  if (difficulty === 'A' || isDiagonal(current)) {
    return candidate;
  }
  const cur = vectorOf(current);
  const cand = vectorOf(candidate);
  const east: -1 | 0 | 1 = cur.east !== 0 && cand.east === -cur.east ? 0 : cand.east;
  const south: -1 | 0 | 1 = cur.south !== 0 && cand.south === -cur.south ? 0 : cand.south;
  return headingFromStick({ east, south, fire: false }, steering);
}
