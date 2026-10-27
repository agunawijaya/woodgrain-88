/**
 * Tank Duel progression events: schemas declared for the kit manifest,
 * event mapping per engine step, and match outcome reporting.
 */
import type { GameEvent, GameEventSchema, KidId } from '@woodgrain-88/kit';
import type { ChannelRules, MatchEvent, MatchState } from '../engine/types.ts';

/** Every event Tank Duel reports, for the manifest's `events`. */
export const TANK_EVENTS: readonly GameEventSchema[] = [
  {
    type: 'hit',
    description: 'Seat 1 scored a hit on the opposing vehicle.',
    fields: {
      bounces: 'number',
      banked: 'number',
      billiard: 'number',
      points: 'number',
    },
  },
  {
    type: 'hit-taken',
    description: 'Seat 1 was struck by an opposing shell.',
  },
  {
    type: 'match-won',
    description: 'Seat 1 won the match.',
    fields: {
      vsKid: 'number',
      invisible: 'number',
      jet: 'number',
      louInvisibleMazeOnA: 'number',
      loneJet: 'number',
      kid: 'string',
    },
  },
  {
    type: 'match-lost',
    description: 'Seat 1 lost the match.',
    fields: {
      kid: 'string',
    },
  },
  {
    type: 'survived',
    description: 'Seat 1 survived the invisible challenge without being hit.',
  },
];

export interface MatchCircumstances {
  readonly channel: ChannelRules;
  /** The Kid in seat 2, or null when seat 2 is a person. */
  readonly kid: KidId | null;
  /** Seat 1's difficulty switch is on A. */
  readonly playerOnA: boolean;
}

// Sandbag Line and Old Quarter boards correspond to the classic light and dense mazes
function isMazeArena(channel: ChannelRules): boolean {
  return (
    channel.field.kind === 'arena' &&
    (channel.field.id === 'sandbag-line' || channel.field.id === 'old-quarter')
  );
}

/** The kit events one engine step produced (hits by seat 1, shots that bounced...). */
export function progressEvents(
  events: readonly MatchEvent[],
  circumstances: MatchCircumstances,
): GameEvent[] {
  const kitEvents: GameEvent[] = [];
  const isBilliard = circumstances.channel.billiard;

  for (const event of events) {
    // Caught by your own ricochet is still a hit taken, though nobody earned it.
    if (event.kind === 'own-hit' && event.side === 0) {
      kitEvents.push({ type: 'hit-taken' });
      continue;
    }
    if (event.kind !== 'hit') {
      continue;
    }

    if (event.shooter === 0) {
      kitEvents.push({
        type: 'hit',
        data: {
          bounces: event.bounces,
          banked: event.bounces >= 1 ? 1 : 0,
          billiard: isBilliard ? 1 : 0,
          points: event.points,
        },
      });
    }

    if (event.victim === 0) {
      kitEvents.push({
        type: 'hit-taken',
      });
    }
  }

  return kitEvents;
}

/** The kit events for a finished match (who won, and against whom). */
export function matchEndEvents(state: MatchState, circumstances: MatchCircumstances): GameEvent[] {
  if (!state.over) {
    return [];
  }

  if (state.winner === 0) {
    const isKid = circumstances.kid !== null;
    const isJetChannel = circumstances.channel.vehicles.includes('jet');
    const isMaze = isMazeArena(circumstances.channel);

    const vsKid = isKid ? 1 : 0;
    const invisible = isKid && circumstances.channel.invisible ? 1 : 0;
    const jet = isKid && isJetChannel ? 1 : 0;
    const louInvisibleMazeOnA =
      circumstances.kid === 'lou' &&
      circumstances.channel.invisible &&
      isMaze &&
      circumstances.playerOnA
        ? 1
        : 0;
    const loneJet = circumstances.channel.id === 'game-26' ? 1 : 0;
    const kid = circumstances.kid ?? '';

    return [
      {
        type: 'match-won',
        data: {
          vsKid,
          invisible,
          jet,
          louInvisibleMazeOnA,
          loneJet,
          kid,
        },
      },
    ];
  }

  if (state.winner === 1) {
    return [
      {
        type: 'match-lost',
        data: {
          kid: circumstances.kid ?? '',
        },
      },
    ];
  }

  return [];
}

/** For the "Survive invisible" micro-challenge: emitted when its time runs out without seat 1 being hit. */
export const SURVIVED_EVENT: GameEvent = { type: 'survived' };
