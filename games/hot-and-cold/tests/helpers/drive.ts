/**
 * Playing a match by hand in tests: holding directions and the reveal button
 * for a number of ticks, or walking an explorer to a square and checking it.
 */
import { COLUMNS, ROWS, spotOf, type Square } from '../../src/engine/grid.ts';
import {
  IDLE,
  stepMatch,
  type Match,
  type MatchEvent,
  type Seat,
  type SeatInput,
} from '../../src/engine/match.ts';

/** Stepping input that holds a given direction without revealing. */
export function holdDirection(east: -1 | 0 | 1, south: -1 | 0 | 1): SeatInput {
  return { east, south, reveal: false };
}

/** Input pressing the reveal button without moving. */
export function pressReveal(): SeatInput {
  return { east: 0, south: 0, reveal: true };
}

/**
 * Computes a directional step that moves an explorer towards a target square,
 * taking the shortest path across the wrapped field edges.
 */
export function walkToward(from: Square, to: Square): SeatInput {
  const current = spotOf(from);
  const target = spotOf(to);
  return {
    east: wrappedDelta(target.column - current.column, COLUMNS),
    south: wrappedDelta(target.row - current.row, ROWS),
    reveal: false,
  };
}

function wrappedDelta(difference: number, size: number): -1 | 0 | 1 {
  const forward = ((difference % size) + size) % size;
  if (forward === 0) return 0;
  return forward > size / 2 ? -1 : 1;
}

/** Advances a match by a fixed count of ticks using the given inputs, collecting all events. */
export function drive(
  match: Match,
  inputs: readonly [SeatInput, SeatInput],
  ticks: number,
): MatchEvent[] {
  const allEvents: MatchEvent[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const events = stepMatch(match, inputs);
    allEvents.push(...events);
    if (match.result) break;
  }
  return allEvents;
}

/**
 * Advances a match tick by tick with dynamic inputs until a predicate is satisfied
 * or the match ends.
 */
export function driveUntil(
  match: Match,
  getInput: (tick: number, match: Match) => readonly [SeatInput, SeatInput],
  predicate: (events: readonly MatchEvent[], match: Match) => boolean,
  maxTicks = 1000,
): MatchEvent[] {
  const allEvents: MatchEvent[] = [];
  for (let tick = 0; tick < maxTicks; tick++) {
    const inputs = getInput(tick, match);
    const events = stepMatch(match, inputs);
    allEvents.push(...events);
    if (predicate(events, match) || match.result) break;
  }
  return allEvents;
}

/** Walks a seat to a target square and performs a full check (press and release). */
export function walkAndCheck(
  match: Match,
  seat: Seat,
  target: Square,
  maxTicks = 500,
): MatchEvent[] {
  const events: MatchEvent[] = [];

  for (let tick = 0; tick < maxTicks; tick++) {
    const current = match.seats[seat].square;
    if (current === target) break;
    const input = walkToward(current, target);
    const pair: [SeatInput, SeatInput] = seat === 0 ? [input, IDLE] : [IDLE, input];
    const stepEvents = stepMatch(match, pair);
    events.push(...stepEvents);
    if (match.result) return events;
  }

  // A fresh step leaves the reveal button asleep for a few ticks.
  while (match.seats[seat].settle > 0) {
    const pair: [SeatInput, SeatInput] = [IDLE, IDLE];
    events.push(...stepMatch(match, pair));
    if (match.result) return events;
  }

  const pressInput = pressReveal();
  const pressPair: [SeatInput, SeatInput] = seat === 0 ? [pressInput, IDLE] : [IDLE, pressInput];
  events.push(...stepMatch(match, pressPair));

  // Letting go completes the check: it is counted and a turn may pass.
  const releasePair: [SeatInput, SeatInput] = [IDLE, IDLE];
  events.push(...stepMatch(match, releasePair));

  return events;
}
