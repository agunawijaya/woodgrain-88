/**
 * Gravity Duel game events: what the match tells Den Life about points won
 * and lost, pod docking, orbital slingshot turns, starbase refuels, and match
 * outcomes.
 */
import type { GameEvent, GameEventSchema } from '@woodgrain-88/kit';

export const GRAVITY_EVENTS: readonly GameEventSchema[] = [
  {
    type: 'point-won',
    description: 'The player scores a point.',
    fields: {
      bend: 'number',
      afterCloak: 'number',
      frugal: 'number',
    },
  },
  {
    type: 'point-lost',
    description: 'The rival scores a point.',
  },
  {
    type: 'dock',
    description: 'The player docks with a pod.',
    fields: {
      inMatch: 'number',
      switchA: 'number',
    },
  },
  {
    type: 'near-star',
    description: 'A stretch of flying close to the star has ended.',
    fields: {
      seconds: 'number',
    },
  },
  {
    type: 'refuel',
    description: "The player's ship touched the starbase.",
    fields: {
      speed: 'number',
    },
  },
  {
    type: 'match-won',
    description: 'The player wins a match.',
    fields: {
      duel: 'number',
      vsKid: 'number',
      fuelLeft: 'number',
      louOrbit: 'number',
      kid: 'string',
    },
  },
  {
    type: 'match-lost',
    description: 'The player loses a match.',
    fields: {
      kid: 'string',
    },
  },
];

export interface PointWonFacts {
  readonly bend: number;
  readonly afterCloak: boolean;
  readonly frugal: boolean;
}

export function pointWonEvent(facts: PointWonFacts): GameEvent {
  const degrees = Math.round((Math.abs(facts.bend) * 180) / Math.PI);
  return {
    type: 'point-won',
    data: {
      bend: degrees,
      afterCloak: facts.afterCloak ? 1 : 0,
      frugal: facts.frugal ? 1 : 0,
    },
  };
}

export function pointLostEvent(): GameEvent {
  return { type: 'point-lost' };
}

export interface DockFacts {
  readonly inMatch: number;
  readonly switchA: boolean;
}

export function dockEvent(facts: DockFacts): GameEvent {
  return {
    type: 'dock',
    data: {
      inMatch: facts.inMatch,
      switchA: facts.switchA ? 1 : 0,
    },
  };
}

export function nearStarEvent(seconds: number): GameEvent {
  return {
    type: 'near-star',
    data: {
      seconds: Math.floor(seconds),
    },
  };
}

export function refuelEvent(speed: number): GameEvent {
  return {
    type: 'refuel',
    data: {
      speed,
    },
  };
}

export interface MatchWonFacts {
  readonly duel: boolean;
  readonly vsKid: boolean;
  readonly fuelLeft: number;
  readonly louOrbit: boolean;
  readonly kid: string;
}

export function matchWonEvent(facts: MatchWonFacts): GameEvent {
  return {
    type: 'match-won',
    data: {
      duel: facts.duel ? 1 : 0,
      vsKid: facts.vsKid ? 1 : 0,
      fuelLeft: facts.fuelLeft,
      louOrbit: facts.louOrbit ? 1 : 0,
      kid: facts.kid,
    },
  };
}

export function matchLostEvent(kid: string): GameEvent {
  return {
    type: 'match-lost',
    data: {
      kid,
    },
  };
}
