/**
 * Tests for the Hot & Cold match engine: game variations, stepping and settled reveal,
 * obstacle blocking, bomb blasts, moving and still flags, turn sharing, hunt-for-hunt golf rules,
 * clock countdown, single-hunt challenges, determinism, and hidden flag information.
 */
import { describe, expect, it } from 'vitest';
import { type SquareKind } from '../src/engine/board.ts';
import {
  createMatch,
  IDLE,
  startMatch,
  stepMatch,
  type Match,
  type MatchEvent,
  type MatchSetup,
  type SeatInput,
} from '../src/engine/match.ts';
import { cartridgeRules, shortened, type Rules } from '../src/engine/rules.ts';
import { drive, holdDirection, pressReveal } from './helpers/drive.ts';

function setupMatch(
  rules: Rules,
  seats: 1 | 2 = 2,
  switches: readonly ['A' | 'B', 'A' | 'B'] = ['B', 'B'],
  seed = 'test-match-seed',
): Match {
  return createMatch({ rules, seats, switches, seed });
}

describe('match', () => {
  describe('start', () => {
    it('starts variation 1 with both seats active on squares 0 and 62', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      const events = startMatch(match);

      expect(events).toEqual([{ type: 'round', round: 1, playing: [0, 1] }]);
      expect(match.seats[0].square).toBe(0);
      expect(match.seats[1].square).toBe(62);
      expect(match.seats[0].playing).toBe(true);
      expect(match.seats[1].playing).toBe(true);
    });

    it('plays only seat 0 in clock games even if configured for two seats', () => {
      const match = setupMatch(cartridgeRules(8), 2);
      const events = startMatch(match);

      expect(match.setup.seats).toBe(1);
      expect(events).toEqual([{ type: 'round', round: 1, playing: [0] }]);
      expect(match.seats[0].playing).toBe(true);
      expect(match.seats[1].playing).toBe(false);
    });

    it('plays only seat 0 on the first field of hunt for hunt', () => {
      const match = setupMatch(cartridgeRules(5), 2);
      const events = startMatch(match);

      expect(events).toEqual([{ type: 'round', round: 1, playing: [0] }]);
      expect(match.seats[0].playing).toBe(true);
      expect(match.seats[1].playing).toBe(false);
    });
  });

  describe('stepping and movement', () => {
    it('steps on tick 16 and every 16 ticks while held, slowing to 20 on switch A in race only', () => {
      // Normal speed: step on tick 16, then tick 32.
      const matchB = setupMatch(cartridgeRules(1), 2, ['B', 'B']);
      startMatch(matchB);
      const holdEast = holdDirection(1, 0);

      const eventsB1 = drive(matchB, [holdEast, IDLE], 15);
      expect(eventsB1.filter((e) => e.type === 'step')).toHaveLength(0);

      const eventsB16 = stepMatch(matchB, [holdEast, IDLE]);
      expect(eventsB16).toContainEqual({ type: 'step', seat: 0, from: 0, to: 1 });

      const eventsBNext15 = drive(matchB, [holdEast, IDLE], 15);
      expect(eventsBNext15.filter((e) => e.type === 'step')).toHaveLength(0);

      const eventsB32 = stepMatch(matchB, [holdEast, IDLE]);
      expect(eventsB32).toContainEqual({ type: 'step', seat: 0, from: 1, to: 2 });

      // Switch A in race (variation 1): slows step to 20 ticks.
      const matchA = setupMatch(cartridgeRules(1), 2, ['A', 'B']);
      startMatch(matchA);
      const eventsA19 = drive(matchA, [holdEast, IDLE], 19);
      expect(eventsA19.filter((e) => e.type === 'step')).toHaveLength(0);

      const eventsA20 = stepMatch(matchA, [holdEast, IDLE]);
      expect(eventsA20).toContainEqual({ type: 'step', seat: 0, from: 0, to: 1 });

      // Switch A in turns (variation 2): movement speed is unaffected (still 16 ticks).
      const matchTurnsA = setupMatch(cartridgeRules(2), 2, ['A', 'B']);
      startMatch(matchTurnsA);
      const eventsTurns15 = drive(matchTurnsA, [holdEast, IDLE], 15);
      expect(eventsTurns15.filter((e) => e.type === 'step')).toHaveLength(0);

      const eventsTurns16 = stepMatch(matchTurnsA, [holdEast, IDLE]);
      expect(eventsTurns16).toContainEqual({ type: 'step', seat: 0, from: 0, to: 1 });
    });

    it('emits blocked and resets wait when stepping onto the other explorer square', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);

      // White-box setup: explorer 0 at 0, explorer 1 at 1.
      match.seats[0].square = 0;
      match.seats[1].square = 1;
      match.seats[0].stepWait = 0;

      const events = stepMatch(match, [holdDirection(1, 0), IDLE]);
      expect(events).toContainEqual({ type: 'blocked', seat: 0, at: 0, toward: 1 });
      expect(match.seats[0].square).toBe(0);
      expect(match.seats[0].stepWait).toBe(16);
    });

    it('wraps around the field when stepping west from home square 0 to square 8', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);

      const holdWest = holdDirection(-1, 0);
      drive(match, [holdWest, IDLE], 15);
      const stepEvents = stepMatch(match, [holdWest, IDLE]);

      expect(stepEvents).toContainEqual({ type: 'step', seat: 0, from: 0, to: 8 });
      expect(match.seats[0].square).toBe(8);
    });
  });

  describe('checking and button settle', () => {
    it('buffers reveal pressed within 7 ticks after step, checking once settled or dropping if released', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);

      // Step explorer 0 from square 0 to square 1 on tick 16.
      drive(match, [holdDirection(1, 0), IDLE], 16);
      expect(match.seats[0].square).toBe(1);
      expect(match.seats[0].settle).toBe(7);

      // Press and hold reveal immediately (tick 1 after step, settle = 6).
      const press = pressReveal();
      const eventsT1 = stepMatch(match, [press, IDLE]);
      expect(eventsT1.filter((e) => e.type === 'check')).toHaveLength(0);

      // Continue holding reveal through settle cooldown. Check triggers on tick 7 after step.
      const bufferEvents = drive(match, [press, IDLE], 5);
      expect(bufferEvents.filter((e) => e.type === 'check')).toHaveLength(0);

      const checkEvents = stepMatch(match, [press, IDLE]);
      expect(checkEvents.some((e) => e.type === 'check')).toBe(true);

      // Verify that letting go before settle drops the check.
      const matchDrop = setupMatch(cartridgeRules(1), 2);
      startMatch(matchDrop);
      drive(matchDrop, [holdDirection(1, 0), IDLE], 16);
      expect(matchDrop.seats[0].settle).toBe(7);

      // Quick tap: press on tick 1, release on tick 2.
      stepMatch(matchDrop, [press, IDLE]);
      stepMatch(matchDrop, [IDLE, IDLE]);

      // Wait out remaining settle time; no check should occur.
      const droppedEvents = drive(matchDrop, [IDLE, IDLE], 10);
      expect(droppedEvents.filter((e) => e.type === 'check')).toHaveLength(0);
    });

    it('checks only once while reveal is held, allowing a second check after release and re-press', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);

      // Let initial round settle count down.
      drive(match, [IDLE, IDLE], 15);

      const press = pressReveal();
      const checkEvents1 = stepMatch(match, [press, IDLE]);
      expect(checkEvents1.filter((e) => e.type === 'check')).toHaveLength(1);

      // Holding continuously does not repeat check.
      const heldEvents = drive(match, [press, IDLE], 10);
      expect(heldEvents.filter((e) => e.type === 'check')).toHaveLength(0);

      // Release reveal.
      const releaseEvents = stepMatch(match, [IDLE, IDLE]);
      expect(releaseEvents).toContainEqual({ type: 'release', seat: 0, square: 0 });

      // Re-pressing checks again.
      const checkEvents2 = stepMatch(match, [press, IDLE]);
      expect(checkEvents2.filter((e) => e.type === 'check')).toHaveLength(1);
    });

    it('freezes explorer movement while check is held and waits 16 ticks before stepping on release', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);
      drive(match, [IDLE, IDLE], 15);

      // Check and hold reveal.
      stepMatch(match, [pressReveal(), IDLE]);
      expect(match.seats[0].holding).toBe(true);

      // Attempt to move while holding check.
      const holdEastWithReveal: SeatInput = { east: 1, south: 0, reveal: true };
      const moveAttemptEvents = drive(match, [holdEastWithReveal, IDLE], 20);
      expect(moveAttemptEvents.filter((e) => e.type === 'step')).toHaveLength(0);
      expect(match.seats[0].square).toBe(0);

      // Release reveal.
      const releaseEvents = stepMatch(match, [IDLE, IDLE]);
      expect(releaseEvents).toContainEqual({ type: 'release', seat: 0, square: 0 });
      expect(match.seats[0].stepWait).toBe(16);

      // Holding direction now requires full 16 ticks to take a step.
      const holdEast = holdDirection(1, 0);
      drive(match, [holdEast, IDLE], 15);
      expect(match.seats[0].square).toBe(0);

      const stepEvents = stepMatch(match, [holdEast, IDLE]);
      expect(stepEvents).toContainEqual({ type: 'step', seat: 0, from: 0, to: 1 });
    });
  });

  describe('captures and celebrations', () => {
    it('emits check and capture, freezes for 32 celebration ticks, then scores and returns home', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);

      // White-box setup: flag at square 0.
      match.flags = [0];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      match.seats[0].settle = 0;

      const captureEvents = stepMatch(match, [pressReveal(), IDLE]);
      expect(captureEvents[0]).toMatchObject({
        type: 'check',
        check: { seat: 0, square: 0, clue: { kind: 'flag' } },
      });
      expect(captureEvents[1]).toMatchObject({
        type: 'capture',
        seat: 0,
        square: 0,
        onLastCheck: false,
      });

      // Celebration freezes match for 32 ticks.
      expect(match.celebration).not.toBeNull();
      const celebEvents = drive(match, [holdDirection(1, 0), holdDirection(1, 0)], 31);
      expect(celebEvents.filter((e) => e.type === 'step' || e.type === 'check')).toHaveLength(0);

      // Tick 32 completes celebration, increments score, and starts new round.
      const finishEvents = stepMatch(match, [IDLE, IDLE]);
      expect(finishEvents).toContainEqual({ type: 'score', seat: 0, score: 1 });
      expect(finishEvents).toContainEqual({ type: 'round', round: 2, playing: [0, 1] });
      expect(match.seats[0].square).toBe(0);
      expect(match.seats[1].square).toBe(62);
    });

    it('ends the race at 15 captures, and at 5 under shortened rules', () => {
      // Standard variation 1 race to 15.
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);
      match.seats[0].score = 14;
      match.flags = [0];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      match.seats[0].settle = 0;

      stepMatch(match, [pressReveal(), IDLE]);
      const endEvents = drive(match, [IDLE, IDLE], 32);

      expect(endEvents).toContainEqual({ type: 'score', seat: 0, score: 15 });
      expect(endEvents).toContainEqual({
        type: 'over',
        result: { kind: 'first-to', winner: 0, captures: [15, 0] },
        flags: [],
      });

      // Shortened variation 1 race to 5.
      const shortMatch = setupMatch(shortened(cartridgeRules(1)), 2);
      startMatch(shortMatch);
      shortMatch.seats[0].score = 4;
      shortMatch.flags = [0];
      shortMatch.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      shortMatch.seats[0].settle = 0;

      stepMatch(shortMatch, [pressReveal(), IDLE]);
      const shortEndEvents = drive(shortMatch, [IDLE, IDLE], 32);

      expect(shortEndEvents).toContainEqual({
        type: 'over',
        result: { kind: 'first-to', winner: 0, captures: [5, 0] },
        flags: [],
      });
    });
  });

  describe('bombs and blasts', () => {
    it('detonates bomb, blasts for 8 ticks, and teleports explorer home unless occupied', () => {
      const match = setupMatch(cartridgeRules(1), 2);
      startMatch(match);

      // Move seat 0 to square 1 which is rigged as a bomb.
      match.seats[0].square = 1;
      const kinds: SquareKind[] = Array.from({ length: 63 }, () => 'arrow');
      kinds[1] = 'bomb';
      match.board = { kinds, flags: [50] };
      match.flags = [50];
      match.seats[0].settle = 0;

      const checkEvents = stepMatch(match, [pressReveal(), IDLE]);
      expect(checkEvents).toContainEqual({
        type: 'check',
        check: { seat: 0, square: 1, clue: { kind: 'bomb' }, flagMoves: 0 },
      });
      expect(match.seats[0].blast).toBe(8);

      // Wait 7 blast ticks: no return home yet.
      const blastEvents = drive(match, [IDLE, IDLE], 7);
      expect(blastEvents.filter((e) => e.type === 'home')).toHaveLength(0);

      // Tick 8: home event and teleport.
      const homeEvents = stepMatch(match, [IDLE, IDLE]);
      expect(homeEvents).toContainEqual({ type: 'home', seat: 0, from: 1, to: 0 });
      expect(match.seats[0].square).toBe(0);

      // Occupied home test: seat 1 stands on seat 0's home square (0).
      match.seats[0].square = 1;
      match.seats[1].square = 0;
      match.seats[0].settle = 0;

      stepMatch(match, [pressReveal(), IDLE]);
      drive(match, [IDLE, IDLE], 7);
      const blockedHomeEvents = stepMatch(match, [IDLE, IDLE]);
      expect(blockedHomeEvents).toContainEqual({ type: 'home', seat: 0, from: 1, to: null });
      expect(match.seats[0].square).toBe(1);
    });
  });

  describe('moving flag', () => {
    it('advances moving flag on misses and bombs, freezes after capture, and keeps still flags put', () => {
      // Variation 6: a bouncing flag hunted by one seat, so seat 0 may check again and again.
      const match = setupMatch(cartridgeRules(6), 2);
      startMatch(match);
      match.flags = [20];
      match.headings = [{ east: 1, south: 0 }];
      const kinds: SquareKind[] = Array.from({ length: 63 }, () => 'arrow');
      kinds[0] = 'arrow';
      kinds[1] = 'bomb';
      match.board = { kinds, flags: [20] };
      match.seats[0].settle = 0;

      // Miss on square 0: flag moves 1 step.
      const missEvents = stepMatch(match, [pressReveal(), IDLE]);
      const checkMiss = missEvents.find((e) => e.type === 'check');
      expect(checkMiss).toBeDefined();
      if (checkMiss) {
        expect(checkMiss.check.flagMoves).toBe(0);
      }
      expect(match.flagMoves).toBe(1);
      expect(match.flags[0]).toBe(21);

      // Release and check bomb on square 1: also moves flag!
      stepMatch(match, [IDLE, IDLE]);
      match.seats[0].square = 1;
      match.seats[0].settle = 0;
      stepMatch(match, [pressReveal(), IDLE]);
      expect(match.flagMoves).toBe(2);
      expect(match.flags[0]).toBe(22);

      // Capture flag on square 22: flag does NOT move after capture.
      drive(match, [IDLE, IDLE], 8); // finish bomb blast
      match.seats[0].square = 22;
      match.seats[0].settle = 0;
      const captureEvents = stepMatch(match, [pressReveal(), IDLE]);
      expect(captureEvents.some((e) => e.type === 'capture')).toBe(true);
      expect(match.flagMoves).toBe(2);
      expect(match.flags[0]).toBe(22);

      // Variation 1: still flag never moves.
      const stillMatch = setupMatch(cartridgeRules(1), 2);
      startMatch(stillMatch);
      stillMatch.flags = [20];
      stillMatch.seats[0].settle = 0;
      stepMatch(stillMatch, [pressReveal(), IDLE]);
      expect(stillMatch.flagMoves).toBe(0);
      expect(stillMatch.flags[0]).toBe(20);
    });
  });

  describe('turns variation', () => {
    it('alternates active seats on release, enforces turn delay, and sits out capturing seat', () => {
      const match = setupMatch(cartridgeRules(2), 2);
      const startEvents = startMatch(match);
      expect(startEvents).toContainEqual({ type: 'turn', seat: 0 });
      expect(match.seats[0].active).toBe(true);
      expect(match.seats[1].active).toBe(false);

      // Seat 1 cannot move while it is seat 0's turn.
      match.seats[1].stepWait = 0;
      const seat1MoveEvents = stepMatch(match, [IDLE, holdDirection(1, 0)]);
      expect(seat1MoveEvents.filter((e) => e.type === 'step')).toHaveLength(0);

      // Seat 0 checks and releases, passing turn to seat 1.
      match.seats[0].settle = 0;
      stepMatch(match, [pressReveal(), IDLE]);
      const passTurnEvents = stepMatch(match, [IDLE, IDLE]);
      expect(passTurnEvents).toContainEqual({ type: 'turn', seat: 1 });
      expect(match.seats[0].active).toBe(false);
      expect(match.seats[1].active).toBe(true);
      expect(match.seats[1].settle).toBe(15);
      expect(match.seats[1].stepWait).toBe(16);

      // Seat 1 captures: on next field, seat 1 sits out the start.
      match.flags = [62];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [62] };
      match.seats[1].settle = 0;
      stepMatch(match, [IDLE, pressReveal()]);
      const celebEvents = drive(match, [IDLE, IDLE], 32);

      expect(celebEvents).toContainEqual({ type: 'turn', seat: 0 });
      expect(match.seats[0].active).toBe(true);
      expect(match.seats[1].active).toBe(false);
    });

    it('plays variation 4 to 75 captures and variations 2 and 3 to 15 captures', () => {
      expect(cartridgeRules(4).goal).toBe(75);
      expect(cartridgeRules(2).goal).toBe(15);
      expect(cartridgeRules(3).goal).toBe(15);

      // Variation 4 does not end at 15 captures.
      const match4 = setupMatch(cartridgeRules(4), 2);
      startMatch(match4);
      match4.seats[0].score = 14;
      match4.flags = [0];
      match4.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      match4.seats[0].settle = 0;
      stepMatch(match4, [pressReveal(), IDLE]);
      const events15 = drive(match4, [IDLE, IDLE], 32);
      expect(events15.some((e) => e.type === 'over')).toBe(false);

      // Variation 4 ends at 75 captures. Seat 0 captured, so the next field opens on seat 1's turn.
      expect(match4.seats[1].active).toBe(true);
      match4.seats[1].score = 74;
      match4.flags = [62];
      match4.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [62] };
      match4.seats[1].settle = 0;
      match4.seats[1].handedTurnAt = -1;
      stepMatch(match4, [IDLE, pressReveal()]);
      const events75 = drive(match4, [IDLE, IDLE], 32);
      expect(events75).toContainEqual({
        type: 'over',
        result: { kind: 'first-to', winner: 1, captures: [15, 75] },
        flags: [],
      });
    });
  });

  describe('hunt for hunt', () => {
    it('runs hunts in turn, scoring released checks and captures, doubling checks on switch A', () => {
      // Switch A on seat 0: checks count 2 points each.
      const match = setupMatch(cartridgeRules(5), 2, ['A', 'B']);
      const startEvents = startMatch(match);
      expect(startEvents).toContainEqual({ type: 'round', round: 1, playing: [0] });

      // Non-flag check: check releases and adds 2 to seat 0's check total.
      match.flags = [50];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [50] };
      match.seats[0].settle = 0;
      stepMatch(match, [pressReveal(), IDLE]);
      const releaseEvents = stepMatch(match, [IDLE, IDLE]);
      expect(releaseEvents).toContainEqual({ type: 'score', seat: 0, score: 2 });

      // Capture flag: adds 2 to score and switches hunter to seat 1 for round 2.
      match.flags = [0];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      match.seats[0].settle = 0;
      stepMatch(match, [pressReveal(), IDLE]);
      const finishEvents = drive(match, [IDLE, IDLE], 32);

      expect(finishEvents).toContainEqual({ type: 'score', seat: 0, score: 4 });
      expect(finishEvents).toContainEqual({ type: 'round', round: 2, playing: [1] });
      expect(match.hunter).toBe(1);
    });

    it('hands seat 1 a final turn when seat 0 reaches 75 checks, with fewest checks winning', () => {
      const match = setupMatch(cartridgeRules(5), 2);
      startMatch(match);
      match.seats[0].score = 74;
      match.flags = [50];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [50] };
      match.seats[0].settle = 0;

      // 75th check for seat 0 triggers final-turn for seat 1.
      stepMatch(match, [pressReveal(), IDLE]);
      const releaseEvents = stepMatch(match, [IDLE, IDLE]);
      expect(releaseEvents).toContainEqual({ type: 'score', seat: 0, score: 75 });
      expect(releaseEvents).toContainEqual({ type: 'final-turn', seat: 1 });
      expect(match.finalTurn).toBe(true);
      expect(match.hunter).toBe(1);

      // Seat 1 captures on its final field with fewer checks (e.g. 10): seat 1 wins.
      match.seats[1].score = 9;
      match.seats[1].square = 62;
      match.flags = [62];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [62] };
      match.seats[1].settle = 0;

      stepMatch(match, [IDLE, pressReveal()]);
      const overEvents = drive(match, [IDLE, IDLE], 32);

      expect(overEvents).toContainEqual({
        type: 'over',
        result: {
          kind: 'hunts',
          winner: 1,
          checks: [75, 10],
          captures: [0, 1],
        },
        flags: [],
      });
    });

    it('ends immediately when seat 1 reaches 75 checks on final turn, listing hidden flags', () => {
      const match = setupMatch(cartridgeRules(5), 2);
      startMatch(match);
      match.finalTurn = true;
      match.hunter = 1;
      match.seats[1].playing = true;
      match.seats[1].active = true;
      match.seats[1].score = 74;
      match.flags = [30];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [30] };
      match.seats[1].settle = 0;

      // 75th miss for seat 1 ends match without capture, revealing flag position.
      stepMatch(match, [IDLE, pressReveal()]);
      const overEvents = stepMatch(match, [IDLE, IDLE]);

      expect(overEvents).toContainEqual({
        type: 'over',
        result: {
          kind: 'hunts',
          winner: 0,
          checks: [0, 75],
          captures: [0, 0],
        },
        flags: [30],
      });
    });

    it('plays solo hunt until reaching 75, marking onLastCheck when exact', () => {
      const match = setupMatch(cartridgeRules(5), 1);
      startMatch(match);
      expect(match.seats[0].playing).toBe(true);

      // Solo hunter reaches 74 checks, then makes 75th check which captures flag.
      match.seats[0].score = 74;
      match.flags = [0];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      match.seats[0].settle = 0;

      const captureEvents = stepMatch(match, [pressReveal(), IDLE]);
      expect(captureEvents).toContainEqual({
        type: 'capture',
        seat: 0,
        square: 0,
        onLastCheck: true,
      });

      const finishEvents = drive(match, [IDLE, IDLE], 32);
      expect(finishEvents).toContainEqual({
        type: 'over',
        result: {
          kind: 'hunts',
          winner: null,
          checks: [75, 0],
          captures: [1, 0],
        },
        flags: [],
      });
    });
  });

  describe('clock mode', () => {
    it('ticks down from 75 every 31 ticks, freezes controls at 0, and ends with flag revealed', () => {
      const match = setupMatch(cartridgeRules(8), 1);
      startMatch(match);

      // Tick 31 emits clock event with 74.
      const tick31 = drive(match, [IDLE, IDLE], 31);
      expect(tick31).toContainEqual({ type: 'clock', remaining: 74 });

      // Fast forward clock remaining to 1.
      match.clock.remaining = 1;
      match.clock.ticks = 0;

      // Advance 31 ticks to reach 0.
      const freezeEvents = drive(match, [IDLE, IDLE], 31);
      expect(freezeEvents).toContainEqual({ type: 'clock', remaining: 0 });
      expect(match.clock.frozen).toBe(true);

      // At 0 remaining, controls are frozen.
      match.seats[0].stepWait = 0;
      match.seats[0].settle = 0;
      const frozenEvents = stepMatch(match, [holdDirection(1, 0), IDLE]);
      expect(frozenEvents.filter((e) => e.type === 'step')).toHaveLength(0);

      // One clock cycle later (31 ticks), match ends and flag is revealed.
      match.flags = [42];
      const endEvents = drive(match, [IDLE, IDLE], 31);
      expect(endEvents).toContainEqual({
        type: 'over',
        result: { kind: 'clock', captures: 0 },
        flags: [42],
      });
    });

    it('scores captures in clock mode and resets for a new field', () => {
      const match = setupMatch(cartridgeRules(8), 1);
      startMatch(match);
      match.flags = [0];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [0] };
      match.seats[0].settle = 0;

      stepMatch(match, [pressReveal(), IDLE]);
      const newRoundEvents = drive(match, [IDLE, IDLE], 32);

      expect(newRoundEvents).toContainEqual({ type: 'score', seat: 0, score: 1 });
      expect(newRoundEvents).toContainEqual({ type: 'round', round: 2, playing: [0] });
    });
  });

  describe('single hunt micro-challenge', () => {
    it('ends at first capture with single result counting all checks including the capture', () => {
      const singleHuntRules: Rules = { ...cartridgeRules(1), singleHunt: true };
      const match = setupMatch(singleHuntRules, 1);
      startMatch(match);

      // First check: miss on square 0.
      match.flags = [1];
      match.board = { kinds: Array.from({ length: 63 }, () => 'arrow'), flags: [1] };
      match.seats[0].settle = 0;
      stepMatch(match, [pressReveal(), IDLE]);
      stepMatch(match, [IDLE, IDLE]);

      // Move to square 1 and check: capture (2nd check).
      match.seats[0].square = 1;
      match.seats[0].settle = 0;
      stepMatch(match, [pressReveal(), IDLE]);
      const finishEvents = drive(match, [IDLE, IDLE], 32);

      expect(finishEvents).toContainEqual({
        type: 'over',
        result: { kind: 'single', checks: 2 },
        flags: [],
      });
    });
  });

  describe('determinism and hidden information', () => {
    it('produces identical event sequences for identical setups and inputs', () => {
      const setup: MatchSetup = {
        rules: cartridgeRules(3),
        seats: 2,
        switches: ['B', 'B'],
        seed: 'replay-consistency-seed',
      };

      const match1 = createMatch(setup);
      const match2 = createMatch(setup);

      const events1: MatchEvent[] = [...startMatch(match1)];
      const events2: MatchEvent[] = [...startMatch(match2)];

      const inputs: readonly [SeatInput, SeatInput][] = [
        [holdDirection(1, 0), holdDirection(-1, 0)],
        [pressReveal(), IDLE],
        [IDLE, pressReveal()],
        [holdDirection(0, 1), holdDirection(0, -1)],
      ];

      for (const input of inputs) {
        for (let tick = 0; tick < 20; tick++) {
          events1.push(...stepMatch(match1, input));
          events2.push(...stepMatch(match2, input));
        }
      }

      expect(events1).toEqual(events2);
    });

    it('never reveals flag location in events prior to over unless checking that square', () => {
      const match = setupMatch(cartridgeRules(1), 2, ['B', 'B'], 'anti-leak-seed');
      const events: MatchEvent[] = [...startMatch(match)];

      // Drive 200 ticks of wandering steps and checks.
      for (let t = 0; t < 200; t++) {
        const east: -1 | 0 | 1 = t % 3 === 0 ? 1 : t % 3 === 1 ? -1 : 0;
        const south: -1 | 0 | 1 = t % 2 === 0 ? 1 : 0;
        const reveal = t % 17 === 0;
        const input: SeatInput = { east, south, reveal };
        const tickEvents = stepMatch(match, [input, IDLE]);
        events.push(...tickEvents);
      }

      for (const event of events) {
        if (event.type === 'over') continue;
        if (event.type === 'capture') {
          // Capture event references the checked square where the flag was found.
          expect(match.board.flags).toContain(event.square);
        } else if (event.type === 'check') {
          if (event.check.clue.kind === 'flag') {
            expect(match.board.flags).toContain(event.check.square);
          }
        } else {
          // No other event type may have a 'flags' property or reveal uncaptured flags.
          expect('flags' in event).toBe(false);
        }
      }
    });
  });
});
