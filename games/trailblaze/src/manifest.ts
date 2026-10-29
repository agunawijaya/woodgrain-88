/**
 * Trailblaze's manifest: what the Hall shows before the game loads. The
 * channels come straight from `channels.ts` and the events from
 * `progress/events.ts`, so each is defined once.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import { CHANNELS } from './channels.ts';
import { TRAILBLAZE_EVENTS } from './progress/events.ts';

export const manifest: GameManifest = {
  id: 'trailblaze',
  slot: 8,
  title: 'Trailblaze',
  tagline: 'Every cell you ride becomes a wall. Box your rival in first.',
  teaser:
    'Two riders who can never stop, one arena, and every move leaves a wall behind. Cut across, claim the big side, seal the last gap. Ride a light-bike, a toy train, a runaway mummy or a skater, against a friend, a Neighbourhood Kid or the old machine itself.',
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 8],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#16808f', night: '#5ee6dc' },
  emblem: 'M4 20v-8h6V6h10M4 20h0M20 6h0',
  label: {
    pattern: 'grid',
    paper: '#1b2a41',
    ink: '#3fd0c9',
    band: '#f2e8d5',
    bandText: '#1b2a41',
  },
  inspiredBy: {
    originalTitle: 'Surround',
    uiTitle: 'the trail duel',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [8],
  },
  controls: [
    { keys: ['Arrows', 'Keypad 7 9 1 3'], does: 'steer, diagonals on eight-way channels', seat: 1 },
    { keys: ['Enter'], does: 'leave a gap, or rub out in a Doodle', seat: 1 },
    { keys: ['WASD', 'Q E Z C'], does: 'steer, diagonals on eight-way channels', seat: 2 },
    { keys: ['Space'], does: 'leave a gap, or rub out in a Doodle', seat: 2 },
    { keys: ['X'], does: 'keep a Doodle as a picture' },
  ],
  channels: CHANNELS.map((channel) => channel.def),
  supports: { daily: true, challengeLinks: true, microChallenges: true },
  difficulty: {
    left: {
      a: 'Turning straight back goes through, into your own trail',
      b: 'Turning straight back is ignored',
    },
    right: {
      a: 'Turning straight back goes through, into your own trail',
      b: 'Turning straight back is ignored',
    },
    liveChange: false,
  },
  events: TRAILBLAZE_EVENTS,
};
