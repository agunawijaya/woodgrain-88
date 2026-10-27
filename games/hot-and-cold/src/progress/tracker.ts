/**
 * Follows a match from seat 1's side and turns what happens into the events
 * Den Life measures patches and micro-challenges by: each flag found (in how
 * many checks, whether its field stayed clean of bombs, the clean streak so
 * far), each bomb, solo hunting progress, and the end of the match.
 */
import type { GameEvent } from '@woodgrain-88/kit';
import type { Match, MatchEvent } from '../engine/match.ts';
import {
  BOMB_EVENT,
  captureEvent,
  huntsProgressEvent,
  matchEndEvents,
  type MatchCircumstances,
} from './events.ts';

/** Sharp Eyes counts the flags found within a solo hunter's first this-many checks. */
const SHARP_EYES_CHECKS = 12;

export interface ProgressTracker {
  /** The events for Den Life from one tick of the match. */
  hear(events: readonly MatchEvent[], match: Match): GameEvent[];
  /** Flags found in a row without a bomb, counting on from the save's. */
  readonly streak: number;
}

export function createProgressTracker(
  startStreak: number,
  circumstances: MatchCircumstances,
): ProgressTracker {
  let streak = startStreak;
  let fieldChecks = 0;
  let fieldBombed = false;
  let flagsWithin12 = 0;

  return {
    get streak() {
      return streak;
    },
    hear(events, match) {
      const told: GameEvent[] = [];
      for (const event of events) {
        if (event.type === 'round') {
          fieldChecks = 0;
          fieldBombed = false;
        } else if (event.type === 'check' && event.check.seat === 0) {
          fieldChecks++;
          if (event.check.clue.kind === 'bomb') {
            fieldBombed = true;
            streak = 0;
            told.push(BOMB_EVENT);
          }
        } else if (event.type === 'capture' && event.seat === 0) {
          const clean = !fieldBombed;
          streak = clean ? streak + 1 : 0;
          told.push(
            captureEvent({
              checks: fieldChecks,
              clean,
              streak,
              onLastCheck: event.onLastCheck,
            }),
          );
          const huntingAlone = match.rules.style === 'hunts' && match.setup.seats === 1;
          if (huntingAlone && match.seats[0].checks <= SHARP_EYES_CHECKS) {
            flagsWithin12++;
            told.push(huntsProgressEvent(flagsWithin12));
          }
        } else if (event.type === 'over') {
          told.push(...matchEndEvents(event.result, circumstances));
        }
      }
      return told;
    },
  };
}
