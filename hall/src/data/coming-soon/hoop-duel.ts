/**
 * Hoop Duel, slot 27: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/hoop-duel/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'hoop-duel',
  slot: 27,
  title: 'Hoop Duel',
  tagline: 'One-on-one street ball with a shot arc you can feel.',
  teaser:
    'Dribble, fake, pull up. The arc of every shot is yours to feel, and the street court is just big enough for a grudge match.',
  family: 'sports',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#c25a00', night: '#ffb05c' },
  emblem: 'M5 6h14M7 6l1.5 6h7L17 6M12 21a3 3 0 1 0 0-6 3 3 0 1 0 0 6',
  label: {
    pattern: 'bricks',
    paper: '#f77f00',
    ink: '#d65a00',
    band: '#003049',
    bandText: '#fcbf49',
  },
  inspiredBy: {
    originalTitle: 'Basketball',
    uiTitle: 'the one-on-one basketball',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [29],
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
