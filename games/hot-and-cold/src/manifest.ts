/**
 * Hot & Cold's manifest: what the Hall shows before the game loads. The
 * channels come straight from `channels.ts`, so a channel is defined once.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import { CHANNELS } from './channels.ts';
import { HOT_COLD_EVENTS } from './progress/events.ts';

export const manifest: GameManifest = {
  id: 'hot-and-cold',
  slot: 5,
  title: 'Hot & Cold',
  tagline: 'Find the hidden flag. Every square you dig up says warmer or colder.',
  teaser:
    'A flag is buried somewhere on a snowfield, a tabletop or a radar plot. Each square you check gives a distance, an arrow or a bomb that blows you home. Race a friend or a Neighbourhood Kid to it, take turns, or hunt alone against the clock.',
  family: 'brain',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 10],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#c25b2b', night: '#ffab76' },
  emblem: 'M6 21V4l9 3-9 3M14 15a4 4 0 0 1 4 4M14 11a8 8 0 0 1 8 8',
  label: {
    pattern: 'rings',
    paper: '#fdf0d5',
    ink: '#f4a59d',
    band: '#264653',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Flag Capture',
    uiTitle: 'the hidden-flag hunt',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [5],
  },
  controls: [
    {
      keys: ['Arrows or WASD', 'Enter or Space'],
      does: 'walk, and hold to check a square, playing alone',
    },
    { keys: ['Click a square'], does: 'walk there; click it again to check it' },
    { keys: ['Arrows', 'Keypad 7 9 1 3'], does: 'walk, diagonals included', seat: 1 },
    { keys: ['Enter'], does: 'check the square you stand on', seat: 1 },
    { keys: ['WASD', 'Q E Z C'], does: 'walk, diagonals included', seat: 2 },
    { keys: ['Space'], does: 'check the square you stand on', seat: 2 },
  ],
  channels: CHANNELS.map((channel) => channel.def),
  supports: { daily: true, challengeLinks: true, microChallenges: true },
  difficulty: {
    left: {
      a: 'Slower steps in the race; in hunt for hunt every check counts twice',
      b: 'Full pace, checks count once',
    },
    right: {
      a: 'Slower steps in the race; in hunt for hunt every check counts twice',
      b: 'Full pace, checks count once',
    },
    liveChange: false,
  },
  events: HOT_COLD_EVENTS,
};
