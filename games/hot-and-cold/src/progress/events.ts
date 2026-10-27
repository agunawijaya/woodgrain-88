/**
 * What Hot & Cold tells Den Life as seat 1 plays: each flag it finds (and
 * how), each bomb it sets off, how its solo hunts are going, and how its
 * matches end. Patches and micro-challenges are measured from these.
 */
import type { GameEvent, GameEventSchema, KidId } from '@woodgrain-88/kit';
import type { ClueMode } from '../ai/kid.ts';
import type { MatchResult } from '../engine/match.ts';
import type { Rules } from '../engine/rules.ts';

export const HOT_COLD_EVENTS: readonly GameEventSchema[] = [
  {
    type: 'capture',
    description: 'Seat 1 found a flag.',
    fields: {
      checks: 'number',
      clean: 'number',
      streak: 'number',
      onLastCheck: 'number',
    },
  },
  { type: 'bomb', description: 'Seat 1 checked a bomb square.' },
  {
    type: 'hunts-progress',
    description: 'Seat 1, hunting alone, found another flag; how many within its first 12 checks.',
    fields: { flagsWithin12: 'number' },
  },
  {
    type: 'match-won',
    description: 'Seat 1 won a match.',
    fields: {
      vsKid: 'number',
      mossTurnsClassic: 'number',
      louMovingClassicOnA: 'number',
      kid: 'string',
    },
  },
  { type: 'match-lost', description: 'Seat 1 lost a match.', fields: { kid: 'string' } },
];

export interface CaptureFacts {
  /** Checks seat 1 made on this field, the capture included. */
  readonly checks: number;
  /** No bomb on this field. */
  readonly clean: boolean;
  /** Flags found in a row without setting off a bomb. */
  readonly streak: number;
  readonly onLastCheck: boolean;
}

export function captureEvent(facts: CaptureFacts): GameEvent {
  return {
    type: 'capture',
    data: {
      checks: facts.checks,
      clean: facts.clean ? 1 : 0,
      streak: facts.streak,
      onLastCheck: facts.onLastCheck ? 1 : 0,
    },
  };
}

export const BOMB_EVENT: GameEvent = { type: 'bomb' };

export function huntsProgressEvent(flagsWithin12: number): GameEvent {
  return { type: 'hunts-progress', data: { flagsWithin12 } };
}

export interface MatchCircumstances {
  readonly rules: Rules;
  /** The Kid in seat 2, or null for a person or nobody. */
  readonly kid: KidId | null;
  readonly clues: ClueMode;
  readonly playerOnA: boolean;
}

/** The end of a two-seat match, from seat 1's side; nothing for solo play. */
export function matchEndEvents(
  result: MatchResult,
  circumstances: MatchCircumstances,
): GameEvent[] {
  if (result.kind !== 'first-to' && result.kind !== 'hunts') return [];
  if (result.winner === null) return [];
  const kid = circumstances.kid ?? '';
  if (result.winner !== 0) return [{ type: 'match-lost', data: { kid } }];
  const { rules, clues } = circumstances;
  const classic = clues === 'classic';
  const vsKid = circumstances.kid !== null && (rules.style === 'race' || rules.style === 'turns');
  return [
    {
      type: 'match-won',
      data: {
        vsKid: vsKid ? 1 : 0,
        mossTurnsClassic:
          circumstances.kid === 'moss' && rules.style === 'turns' && classic ? 1 : 0,
        louMovingClassicOnA:
          circumstances.kid === 'lou' &&
          rules.motion !== 'still' &&
          classic &&
          circumstances.playerOnA
            ? 1
            : 0,
        kid,
      },
    },
  ];
}
