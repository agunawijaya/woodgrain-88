/**
 * Hot & Cold's micro-challenges for the Power Cycle Run: 45 seconds each.
 * Three run on the clock channel, where flags keep coming; the fourth is a
 * race against Dee to a single flag.
 */
import type { MicroChallengeDef } from '@woodgrain-88/kit';

export const HOT_COLD_MICRO_CHALLENGES: readonly MicroChallengeDef[] = [
  {
    id: 'find-the-flag',
    channel: 'game-8',
    title: 'Find the flag',
    goal: 'Find one flag',
    seconds: 45,
    pass: { metric: { kind: 'count', event: 'capture' }, target: 1 },
  },
  {
    id: 'find-two-flags',
    channel: 'game-8',
    title: 'Find 2 flags',
    goal: 'Find two flags',
    seconds: 45,
    pass: { metric: { kind: 'count', event: 'capture' }, target: 2 },
  },
  {
    id: 'flag-without-bomb',
    channel: 'game-8',
    title: 'A flag without a bomb',
    goal: 'Find a flag without setting off a bomb on its field',
    seconds: 45,
    pass: { metric: { kind: 'sum', event: 'capture', field: 'clean' }, target: 1 },
  },
  {
    id: 'beat-dee',
    channel: 'game-1',
    title: 'Beat Dee to the flag',
    goal: 'Find the flag before Dee does',
    seconds: 45,
    pass: { metric: { kind: 'count', event: 'capture' }, target: 1 },
  },
];
