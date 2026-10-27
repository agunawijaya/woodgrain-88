/**
 * Tank Duel micro-challenge definitions for 45-second Power Cycle Runs
 * across tank, aircraft, and invisible maze channels.
 */
import type { MicroChallengeDef } from '@woodgrain-88/kit';

export const TANK_MICRO_CHALLENGES: readonly MicroChallengeDef[] = [
  {
    id: 'hit-three',
    channel: 'game-4',
    title: 'Hit 3 times',
    goal: 'Hit the other tank 3 times',
    seconds: 45,
    pass: {
      metric: { kind: 'count', event: 'hit' },
      target: 3,
    },
  },
  {
    id: 'land-a-bank',
    channel: 'game-7',
    title: 'Land a bank shot',
    goal: 'Score with a shell that bounced',
    seconds: 45,
    pass: {
      metric: { kind: 'sum', event: 'hit', field: 'banked' },
      target: 1,
    },
  },
  {
    id: 'survive-invisible',
    channel: 'game-11',
    title: 'Survive invisible',
    goal: 'Get through without being hit',
    seconds: 45,
    pass: {
      metric: { kind: 'count', event: 'survived' },
      target: 1,
    },
  },
  {
    id: 'down-a-biplane',
    channel: 'game-15',
    title: 'Down a biplane',
    goal: 'Shoot the other biplane down',
    seconds: 45,
    pass: {
      metric: { kind: 'count', event: 'hit' },
      target: 1,
    },
  },
  {
    id: 'jet-duel',
    channel: 'game-23',
    title: 'Jet duel: 2 hits',
    goal: 'Hit the other jet twice',
    seconds: 45,
    pass: {
      metric: { kind: 'count', event: 'hit' },
      target: 2,
    },
  },
];
