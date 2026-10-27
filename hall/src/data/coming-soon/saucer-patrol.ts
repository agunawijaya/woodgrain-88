/**
 * Saucer Patrol, slot 1: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/saucer-patrol/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'saucer-patrol',
  slot: 1,
  title: 'Saucer Patrol',
  tagline: 'Hold the skyline against waves you can learn by heart.',
  teaser:
    'Fly low over the hills and keep the skyline clear. Every wave has a rhythm, and once you hear it you start dancing through it.',
  family: 'arcade',
  players: '1P',
  versus: 'none',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#1f6f8b', night: '#6fd3e0' },
  emblem:
    'M3 13c0-2 4-3.5 9-3.5s9 1.5 9 3.5-4 3.5-9 3.5-9-1.5-9-3.5ZM8 10a4 4 0 0 1 8 0M6 19.5h0M12 20.5h0M18 19.5h0',
  label: {
    pattern: 'stars',
    paper: '#0b132b',
    ink: '#5bc0be',
    band: '#ffd166',
    bandText: '#0b132b',
  },
  inspiredBy: {
    originalTitle: 'Space Jockey',
    uiTitle: 'the side-scrolling sky shooter',
    publisher: 'US Games',
    year: null,
    cartridgeSlots: [1],
  },
  controls: [
    { keys: ['Arrows or WASD'], does: 'move' },
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
