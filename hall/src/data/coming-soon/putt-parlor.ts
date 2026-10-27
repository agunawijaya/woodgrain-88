/**
 * Putt Parlor, slot 12: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/putt-parlor/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'putt-parlor',
  slot: 12,
  title: 'Putt Parlor',
  tagline: 'Toy-box mini golf with moving obstacles we built ourselves.',
  teaser:
    'Nine handmade holes full of moving parts. Bank it off the bumper, time the swinging gate, sink it in one.',
  family: 'sports',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [5, 15],
  status: 'coming-soon',
  scoreOrder: 'lower',
  accent: { day: '#b8571a', night: '#ffb063' },
  emblem: 'M5 17a2 2 0 1 0 0-.01M7 15c4-6 9-7 12-3M19 17.5h0',
  label: {
    pattern: 'zigzag',
    paper: '#f9c74f',
    ink: '#f3722c',
    band: '#277da1',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Miniature Golf',
    uiTitle: 'the mini golf',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [12],
  },
  controls: [
    { keys: ['Arrows or WASD'], does: 'move and aim' },
    { keys: ['Space'], does: 'act' },
  ],
  channels: [
    {
      id: 'classic',
      kind: 'original',
      title: 'Classic',
      description: 'The original rules, rebuilt and polished.',
    },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
