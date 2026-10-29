/**
 * What Trailblaze tells Den Life about the player's rider: points won and
 * lost, shut-in traps, passing through ghosts, riding durations at top speed,
 * solo cell coverage, match wins and losses, and exported doodles.
 */
import type { GameEvent, GameEventSchema } from '@woodgrain-88/kit';

export const TRAILBLAZE_EVENTS: readonly GameEventSchema[] = [
  {
    type: 'point-won',
    description: "The player's rider takes a point alone.",
    fields: {
      pocket: 'number',
      boxedIn: 'number',
      trappedDee: 'number',
      ghostPass: 'number',
      wraparound: 'number',
    },
  },
  {
    type: 'point-lost',
    description: 'The rival takes a point alone.',
  },
  {
    type: 'ride',
    description:
      'After each point: how long the player rode in it, and how long of that at the top speed.',
    fields: {
      seconds: 'number',
      speedUpSeconds: 'number',
      topSpeedSeconds: 'number',
    },
  },
  {
    type: 'solo-cells',
    description: 'Riding alone, after each point: cells laid in it.',
    fields: {
      cells: 'number',
    },
  },
  {
    type: 'match-won',
    description: 'The player wins a match.',
    fields: {
      vsKid: 'number',
      shutout: 'number',
      computerOnA: 'number',
      louEightSpeedOnPlayerA: 'number',
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
  {
    type: 'doodle-exported',
    description: 'The player exports a Doodle.',
    fields: {
      filledPercent: 'number',
    },
  },
];

export interface PointWonFacts {
  /** Trap pocket size, 0 if not a trap. */
  readonly pocket: number;
  /** 1 when the pocket is 1–10 cells, else 0. */
  readonly boxedIn: boolean | number;
  /** 1 when won by a trap of any size against Dee, else 0. */
  readonly trappedDee: boolean | number;
  readonly ghostPass: boolean | number;
  readonly wraparound: boolean | number;
}

export function pointWonEvent(facts: PointWonFacts): GameEvent {
  return {
    type: 'point-won',
    data: {
      pocket: facts.pocket,
      boxedIn: typeof facts.boxedIn === 'boolean' ? (facts.boxedIn ? 1 : 0) : facts.boxedIn,
      trappedDee:
        typeof facts.trappedDee === 'boolean' ? (facts.trappedDee ? 1 : 0) : facts.trappedDee,
      ghostPass: typeof facts.ghostPass === 'boolean' ? (facts.ghostPass ? 1 : 0) : facts.ghostPass,
      wraparound:
        typeof facts.wraparound === 'boolean' ? (facts.wraparound ? 1 : 0) : facts.wraparound,
    },
  };
}

export function pointLostEvent(): GameEvent {
  return { type: 'point-lost' };
}

export interface RideFacts {
  readonly seconds: number;
  readonly speedUpSeconds: number;
  readonly topSpeedSeconds: number;
}

export function rideEvent(facts: RideFacts): GameEvent {
  return {
    type: 'ride',
    data: {
      seconds: facts.seconds,
      speedUpSeconds: facts.speedUpSeconds,
      topSpeedSeconds: facts.topSpeedSeconds,
    },
  };
}

export function soloCellsEvent(cells: number): GameEvent {
  return {
    type: 'solo-cells',
    data: { cells },
  };
}

export interface MatchWonFacts {
  readonly vsKid: boolean | number;
  readonly shutout: boolean | number;
  readonly computerOnA: boolean | number;
  readonly louEightSpeedOnPlayerA: boolean | number;
  readonly kid: string;
}

export function matchWonEvent(facts: MatchWonFacts): GameEvent {
  return {
    type: 'match-won',
    data: {
      vsKid: typeof facts.vsKid === 'boolean' ? (facts.vsKid ? 1 : 0) : facts.vsKid,
      shutout: typeof facts.shutout === 'boolean' ? (facts.shutout ? 1 : 0) : facts.shutout,
      computerOnA:
        typeof facts.computerOnA === 'boolean' ? (facts.computerOnA ? 1 : 0) : facts.computerOnA,
      louEightSpeedOnPlayerA:
        typeof facts.louEightSpeedOnPlayerA === 'boolean'
          ? facts.louEightSpeedOnPlayerA
            ? 1
            : 0
          : facts.louEightSpeedOnPlayerA,
      kid: facts.kid,
    },
  };
}

export function matchLostEvent(kid: string): GameEvent {
  return {
    type: 'match-lost',
    data: { kid },
  };
}

export function doodleExportedEvent(filledPercent: number): GameEvent {
  return {
    type: 'doodle-exported',
    data: { filledPercent },
  };
}
