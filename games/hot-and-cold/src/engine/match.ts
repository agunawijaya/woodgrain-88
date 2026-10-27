/**
 * A match, one tick at a time. Each seat sends what it is holding (a
 * direction and the reveal button) and the match answers with events: steps,
 * checks and their clues, bombs, captures, scores, turns and the end. The
 * rules are the 1978 program's, timed in its own ticks:
 *
 * - Holding a direction steps one square every 16 ticks (20 for an expert in the race); the field
 *   wraps, and two explorers never share a square.
 * - A step wakes the reveal button again after 7 ticks. A check needs a fresh press; while it is
 *   held the explorer stands still, and letting go completes it: the check is counted, a turn
 *   passes, and the next step waits a full step.
 * - The flag is checked before the square, so a flag on a bomb square is caught safely. Every miss
 *   (bombs too) moves a moving flag.
 * - A bomb blasts for 8 ticks and sends its explorer home, unless the other explorer stands on
 *   that home, in which case it stays put.
 * - A capture celebrates for 32 ticks with everyone frozen; then the score, and a new field with
 *   both explorers home (or the end).
 *
 * The flag's square is hidden information: no event carries it until the match ends without it
 * being found.
 */
import { createRng, type Rng, type Seed } from '@woodgrain-88/kit';
import { clueAt, generateBoard, type Board, type Clue } from './board.ts';
import { HEADINGS, stepFlag, type Heading } from './flag.ts';
import { HOME_SQUARES, stepFrom, type Square } from './grid.ts';
import {
  BOMB_TICKS,
  CAPTURE_TICKS,
  CLOCK_TICK_TICKS,
  doublesChecksOnA,
  SETTLE_TICKS,
  SLOW_STEP_TICKS,
  slowsStepsOnA,
  STEP_TICKS,
  TURN_DELAY_TICKS,
  type DifficultySwitch,
  type Rules,
} from './rules.ts';

export type Seat = 0 | 1;
export const SEATS: readonly Seat[] = [0, 1];

export interface SeatInput {
  readonly east: -1 | 0 | 1;
  readonly south: -1 | 0 | 1;
  readonly reveal: boolean;
}

export const IDLE: SeatInput = { east: 0, south: 0, reveal: false };

export interface MatchSetup {
  readonly rules: Rules;
  /** Seats playing: 1 alone, 2 for a friend or a Kid. The clock games are always alone. */
  readonly seats: 1 | 2;
  readonly switches: readonly [DifficultySwitch, DifficultySwitch];
  /** Seeds every field of the match, so a daily or a challenge link is the same for everyone. */
  readonly seed: Seed;
}

/** A check as it was seen: who, where, what it said, and how often the flag had moved before it. */
export interface Check {
  readonly seat: Seat;
  readonly square: Square;
  readonly clue: Clue;
  readonly flagMoves: number;
}

export type MatchResult =
  | {
      /** Race or turns: first to the goal. */
      readonly kind: 'first-to';
      readonly winner: Seat;
      readonly captures: readonly [number, number];
    }
  | {
      /** Hunt for hunt: fewest checks wins; a tie is a draw (null). Alone, `winner` is null. */
      readonly kind: 'hunts';
      readonly winner: Seat | null;
      readonly checks: readonly [number, number];
      readonly captures: readonly [number, number];
    }
  | { readonly kind: 'clock'; readonly captures: number }
  | { readonly kind: 'single'; readonly checks: number };

export type MatchEvent =
  | {
      readonly type: 'round';
      readonly round: number;
      /** Seats on the field this round (in hunt for hunt, only the hunter). */
      readonly playing: readonly Seat[];
    }
  | { readonly type: 'step'; readonly seat: Seat; readonly from: Square; readonly to: Square }
  | { readonly type: 'blocked'; readonly seat: Seat; readonly at: Square; readonly toward: Square }
  | { readonly type: 'check'; readonly check: Check }
  | { readonly type: 'release'; readonly seat: Seat; readonly square: Square }
  | {
      readonly type: 'home';
      readonly seat: Seat;
      readonly from: Square;
      readonly to: Square | null;
    }
  | {
      readonly type: 'capture';
      readonly seat: Seat;
      readonly square: Square;
      /** The capture that brought a hunt-for-hunt total to exactly its goal. */
      readonly onLastCheck: boolean;
    }
  | { readonly type: 'score'; readonly seat: Seat; readonly score: number }
  | { readonly type: 'turn'; readonly seat: Seat }
  | { readonly type: 'final-turn'; readonly seat: Seat }
  | { readonly type: 'clock'; readonly remaining: number }
  | {
      readonly type: 'over';
      readonly result: MatchResult;
      /** Where the flags were, shown when the match ends without them being found. */
      readonly flags: readonly Square[];
    };

interface SeatState {
  square: Square;
  /** On the field this round. */
  playing: boolean;
  /** May move and check now (it is this seat's turn, nobody is celebrating). */
  active: boolean;
  stepWait: number;
  settle: number;
  /** The reveal button as it was last tick, to find fresh presses. */
  wasHeld: boolean;
  /** A press made on this square, waiting for the button to wake. */
  armed: boolean;
  /** A check made and not yet let go. */
  holding: boolean;
  blast: number;
  /** The tick this seat was handed the turn: it starts counting its wait from the next one. */
  handedTurnAt: number;
  /** Captures (race, turns, clock), or checks counted against the seat (hunt for hunt). */
  score: number;
  captures: number;
  checks: number;
}

export interface Match {
  readonly setup: MatchSetup;
  readonly rules: Rules;
  round: number;
  board: Board;
  flags: Square[];
  headings: Heading[];
  readonly seats: readonly [SeatState, SeatState];
  /** Checks made on this round's field, in order. */
  checks: Check[];
  /** Times the flag has moved on this field. */
  flagMoves: number;
  turn: Seat;
  hunter: Seat;
  finalTurn: boolean;
  clock: { remaining: number; ticks: number; frozen: boolean };
  celebration: { seat: Seat; ticks: number; square: Square } | null;
  tick: number;
  result: MatchResult | null;
  readonly rng: Rng;
}

export function createMatch(setup: MatchSetup): Match {
  const rules = setup.rules;
  const seats = setup.rules.style === 'clock' ? 1 : setup.seats;
  const match: Match = {
    setup: { ...setup, seats },
    rules,
    round: 0,
    board: { kinds: [], flags: [] },
    flags: [],
    headings: [],
    seats: [newSeat(HOME_SQUARES[0]), newSeat(HOME_SQUARES[1])],
    checks: [],
    flagMoves: 0,
    turn: 0,
    hunter: 0,
    finalTurn: false,
    clock: { remaining: rules.goal, ticks: 0, frozen: false },
    celebration: null,
    tick: 0,
    result: null,
    rng: createRng(setup.seed),
  };
  return match;
}

/** Lays out the first field. Call once before stepping; its events start the match. */
export function startMatch(match: Match): MatchEvent[] {
  const events: MatchEvent[] = [];
  newRound(match, events);
  return events;
}

/** One tick with what each seat is holding. */
export function stepMatch(match: Match, inputs: readonly [SeatInput, SeatInput]): MatchEvent[] {
  const events: MatchEvent[] = [];
  if (match.result) return events;
  match.tick++;
  if (match.rules.style === 'clock') runClock(match, events);
  if (isOver(match)) return events;
  if (match.celebration) {
    match.celebration.ticks--;
    if (match.celebration.ticks <= 0) finishCapture(match, events);
    return events;
  }
  for (const seat of SEATS) {
    const input = inputs[seat];
    updateSeat(match, seat, input, events);
    match.seats[seat].wasHeld = input.reveal;
    // A capture or the end freezes everyone at once, before the other seat moves.
    if (isOver(match) || isCelebrating(match)) break;
  }
  return events;
}

/** Read through a function: the checks above change the match as they run. */
function isOver(match: Match): boolean {
  return match.result !== null;
}

function isCelebrating(match: Match): boolean {
  return match.celebration !== null;
}

function newSeat(home: Square): SeatState {
  return {
    square: home,
    playing: true,
    active: true,
    stepWait: 0,
    settle: 0,
    wasHeld: false,
    armed: false,
    holding: false,
    blast: 0,
    handedTurnAt: -1,
    score: 0,
    captures: 0,
    checks: 0,
  };
}

function stepTicksFor(match: Match, seat: Seat): number {
  const slow = slowsStepsOnA(match.rules) && match.setup.switches[seat] === 'A';
  return slow ? SLOW_STEP_TICKS : STEP_TICKS;
}

function checkWorth(match: Match, seat: Seat): number {
  return doublesChecksOnA(match.rules) && match.setup.switches[seat] === 'A' ? 2 : 1;
}

/** A fresh field: both explorers home, waiting a full step before they move or check. */
function newRound(match: Match, events: MatchEvent[]): void {
  const { rules } = match;
  match.round++;
  const rng = match.rng.fork(`round-${match.round}`);
  match.board = generateBoard(rng, rules.composition, rules.flags);
  match.flags = [...match.board.flags];
  match.headings = match.flags.map(() => rng.pick(HEADINGS));
  match.checks = [];
  match.flagMoves = 0;
  const playing = playingSeats(match);
  for (const seat of SEATS) {
    const state = match.seats[seat];
    state.square = HOME_SQUARES[seat];
    state.playing = playing.includes(seat);
    state.stepWait = stepTicksFor(match, seat);
    state.settle = stepTicksFor(match, seat) - 1;
    state.armed = false;
    state.holding = false;
    state.blast = 0;
    state.active = state.playing && (rules.style !== 'turns' || seat === match.turn);
  }
  events.push({ type: 'round', round: match.round, playing });
  if (rules.style === 'turns') events.push({ type: 'turn', seat: match.turn });
}

function playingSeats(match: Match): Seat[] {
  if (match.setup.seats === 1 || match.rules.style === 'clock') return [0];
  if (match.rules.style === 'hunts') return [match.hunter];
  return [0, 1];
}

function updateSeat(match: Match, seat: Seat, input: SeatInput, events: MatchEvent[]): void {
  const state = match.seats[seat];
  if (!state.playing || state.handedTurnAt === match.tick) return;
  if (state.blast > 0) {
    state.blast--;
    if (state.blast === 0) endBlast(match, seat, events);
    if (state.blast === 0 && !input.reveal && state.holding) release(match, seat, events);
    return;
  }
  if (!state.active) return;
  if (state.stepWait > 0) state.stepWait--;
  if (state.settle > 0) state.settle--;
  const pressed = input.reveal && !state.wasHeld;

  if (state.holding) {
    if (!input.reveal) release(match, seat, events);
    return;
  }
  if (pressed) state.armed = true;
  if (!input.reveal) state.armed = false;
  if (state.armed && state.settle === 0 && !match.clock.frozen) {
    check(match, seat, events);
    return;
  }
  if ((input.east !== 0 || input.south !== 0) && state.stepWait === 0 && !match.clock.frozen) {
    step(match, seat, input, events);
  }
}

function step(match: Match, seat: Seat, input: SeatInput, events: MatchEvent[]): void {
  const state = match.seats[seat];
  const other = match.seats[seat === 0 ? 1 : 0];
  const to = stepFrom(state.square, input.east, input.south);
  state.stepWait = stepTicksFor(match, seat);
  state.settle = SETTLE_TICKS;
  state.armed = false;
  if (other.playing && other.square === to) {
    events.push({ type: 'blocked', seat, at: state.square, toward: to });
    return;
  }
  events.push({ type: 'step', seat, from: state.square, to });
  state.square = to;
}

function check(match: Match, seat: Seat, events: MatchEvent[]): void {
  const state = match.seats[seat];
  const clue = clueAt(match.board, state.square, match.flags);
  const made: Check = { seat, square: state.square, clue, flagMoves: match.flagMoves };
  match.checks.push(made);
  state.armed = false;
  state.holding = true;
  state.checks++;
  events.push({ type: 'check', check: made });
  if (clue.kind === 'flag') {
    beginCapture(match, seat, events);
    return;
  }
  moveFlags(match);
  if (clue.kind === 'bomb') state.blast = BOMB_TICKS;
}

function moveFlags(match: Match): void {
  if (match.rules.motion === 'still') return;
  for (let move = 0; move < match.rules.flagSteps; move++) {
    match.flags.forEach((square, index) => {
      const heading = match.headings[index];
      if (!heading) return;
      const next = stepFlag(square, heading, match.rules.motion);
      match.flags[index] = next.square;
      match.headings[index] = next.heading;
    });
    match.flagMoves++;
  }
}

/** The blast is over: home, unless the other explorer is standing on it. */
function endBlast(match: Match, seat: Seat, events: MatchEvent[]): void {
  const state = match.seats[seat];
  const other = match.seats[seat === 0 ? 1 : 0];
  const home = HOME_SQUARES[seat];
  const blocked = other.playing && other.square === home;
  events.push({ type: 'home', seat, from: state.square, to: blocked ? null : home });
  if (!blocked) state.square = home;
}

/** Letting go completes a check: it is counted, a turn passes, and stepping waits a full step. */
function release(match: Match, seat: Seat, events: MatchEvent[]): void {
  const state = match.seats[seat];
  state.holding = false;
  state.stepWait = stepTicksFor(match, seat);
  events.push({ type: 'release', seat, square: state.square });
  const { style } = match.rules;
  if (style === 'hunts') {
    countCheck(match, seat, events);
    if (match.result || !state.playing) return;
  }
  if (style === 'turns') passTurn(match, seat, events);
}

function countCheck(match: Match, seat: Seat, events: MatchEvent[]): void {
  const state = match.seats[seat];
  state.score += checkWorth(match, seat);
  events.push({ type: 'score', seat, score: state.score });
  if (state.score >= match.rules.goal) endHunterRun(match, seat, events, false);
}

function passTurn(match: Match, seat: Seat, events: MatchEvent[]): void {
  const next: Seat = seat === 0 ? 1 : 0;
  match.turn = next;
  match.seats[seat].active = false;
  const other = match.seats[next];
  other.active = true;
  other.handedTurnAt = match.tick;
  other.settle = TURN_DELAY_TICKS;
  other.stepWait = stepTicksFor(match, next);
  other.armed = false;
  events.push({ type: 'turn', seat: next });
}

function beginCapture(match: Match, seat: Seat, events: MatchEvent[]): void {
  const square = match.seats[seat].square;
  const state = match.seats[seat];
  const worth = match.rules.style === 'hunts' ? checkWorth(match, seat) : 0;
  const onLastCheck = match.rules.style === 'hunts' && state.score + worth === match.rules.goal;
  events.push({ type: 'capture', seat, square, onLastCheck });
  match.celebration = { seat, ticks: CAPTURE_TICKS, square };
  for (const other of match.seats) other.active = false;
}

/** After the celebration: the score, and then a new field or the end of the match. */
function finishCapture(match: Match, events: MatchEvent[]): void {
  const celebration = match.celebration;
  match.celebration = null;
  if (!celebration) return;
  const seat = celebration.seat;
  const state = match.seats[seat];
  state.holding = false;
  state.captures++;
  const { style, goal } = match.rules;

  if (match.rules.singleHunt) {
    finish(match, { kind: 'single', checks: state.checks }, events, false);
    return;
  }
  if (style === 'hunts') {
    state.score += checkWorth(match, seat);
    events.push({ type: 'score', seat, score: state.score });
    if (state.score >= goal) {
      endHunterRun(match, seat, events, true);
      return;
    }
    if (match.setup.seats === 2) {
      if (match.finalTurn) {
        finishHunts(match, events, false);
        return;
      }
      match.hunter = seat === 0 ? 1 : 0;
    }
    newRound(match, events);
    return;
  }
  if (style === 'clock') {
    // 1978: a capture whose celebration ends with the clock at zero is not counted.
    if (match.clock.remaining === 0) {
      state.captures--;
      finish(match, { kind: 'clock', captures: state.captures }, events, false);
      return;
    }
    state.score++;
    events.push({ type: 'score', seat, score: state.score });
    newRound(match, events);
    return;
  }
  state.score++;
  events.push({ type: 'score', seat, score: state.score });
  if (state.score >= goal) {
    finish(
      match,
      { kind: 'first-to', winner: seat, captures: [match.seats[0].score, match.seats[1].score] },
      events,
      false,
    );
    return;
  }
  // In turns the seat that captured sits out the start of the next field.
  if (style === 'turns') match.turn = seat === 0 ? 1 : 0;
  newRound(match, events);
}

/**
 * A hunter's total reached the goal. The first seat's reaching it hands the second one last,
 * equal turn; the second seat's (or a lone hunter's) ends the match.
 */
function endHunterRun(match: Match, seat: Seat, events: MatchEvent[], flagFound: boolean): void {
  if (match.setup.seats === 2 && seat === 0 && !match.finalTurn) {
    match.finalTurn = true;
    match.hunter = 1;
    events.push({ type: 'final-turn', seat: 1 });
    newRound(match, events);
    return;
  }
  finishHunts(match, events, !flagFound);
}

function finishHunts(match: Match, events: MatchEvent[], flagStillHidden: boolean): void {
  const [first, second] = match.seats;
  const checks: [number, number] = [first.score, second.score];
  const captures: [number, number] = [first.captures, second.captures];
  let winner: Seat | null = null;
  if (match.setup.seats === 2 && checks[0] !== checks[1]) winner = checks[0] < checks[1] ? 0 : 1;
  finish(match, { kind: 'hunts', winner, checks, captures }, events, flagStillHidden);
}

function finish(
  match: Match,
  result: MatchResult,
  events: MatchEvent[],
  flagStillHidden: boolean,
): void {
  match.result = result;
  for (const seat of match.seats) seat.active = false;
  events.push({ type: 'over', result, flags: flagStillHidden ? [...match.flags] : [] });
}

/**
 * The clock counts down a tick at a time. At zero the explorer freezes for one last tick, then
 * time is up and the flag is shown.
 */
function runClock(match: Match, events: MatchEvent[]): void {
  const clock = match.clock;
  clock.ticks++;
  if (clock.ticks < CLOCK_TICK_TICKS) return;
  clock.ticks = 0;
  if (clock.remaining === 0) {
    match.celebration = null;
    finish(match, { kind: 'clock', captures: match.seats[0].captures }, events, true);
    return;
  }
  clock.remaining--;
  events.push({ type: 'clock', remaining: clock.remaining });
  if (clock.remaining === 0) clock.frozen = true;
}
