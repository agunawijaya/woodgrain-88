/**
 * Gravity Duel micro-challenges for the Power Cycle Run: 45 seconds each,
 * testing docking dexterity, orbital scoring, solar survival, and thrust
 * conservation.
 */
import type { MicroChallengeDef } from '@woodgrain-88/kit';

export const GRAVITY_MICRO_CHALLENGES: readonly MicroChallengeDef[] = [
  {
    id: 'dock-three',
    channel: 'game-14',
    title: 'Three docks',
    goal: 'Dock 3 pods',
    seconds: 45,
    pass: {
      metric: { kind: 'count', event: 'dock' },
      target: 3,
    },
  },
  {
    id: 'star-point',
    channel: 'game-4',
    title: 'Round the star',
    goal: 'Score once with the star in play',
    seconds: 45,
    pass: {
      metric: { kind: 'count', event: 'point-won' },
      target: 1,
    },
  },
  {
    id: 'star-sitter',
    channel: 'game-4',
    title: 'Close to the sun',
    goal: 'Fly 30 s close to the star without crashing',
    seconds: 45,
    pass: {
      metric: { kind: 'max', event: 'near-star', field: 'seconds' },
      target: 30,
    },
  },
  {
    id: 'light-touch',
    channel: 'game-1',
    title: 'Light touch',
    goal: 'Win a point with 5 s of thrust or less',
    seconds: 45,
    pass: {
      metric: { kind: 'sum', event: 'point-won', field: 'frugal' },
      target: 1,
    },
  },
];
