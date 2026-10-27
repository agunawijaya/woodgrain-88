/**
 * Quickdraw, slot 24: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/quickdraw/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'quickdraw',
  slot: 24,
  title: 'Quickdraw',
  tagline: 'High noon on Main Street. Six shots, one winner.',
  teaser:
    'Two gunslingers on a dusty main street at high noon. Duck behind the cactus or the wagon, ricochet a shot off the saloon wall and fire first. Six shots in the cylinder, then reload.',
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#a4512f', night: '#ffae85' },
  emblem:
    'M12.5 8.5H20.5M20.3 8.5V7.3M8.2 7.5h3.3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1ZM12.5 10.5H17M7.6 11.5C6.2 14 5.2 17 5.6 19.8h2.9c0-2.6.8-5.2 2.3-8.3M10.6 11.5q.4 3.1 3 2.6M7.4 7.5 6 6.1',
  label: {
    pattern: 'sunburst',
    paper: '#f2c57c',
    ink: '#e3926c',
    band: '#3d405b',
    bandText: '#f4f1de',
  },
  inspiredBy: {
    originalTitle: 'Outlaw',
    uiTitle: 'the western gunfight',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [25],
  },
  controls: [
    { keys: ['Arrows + Enter'], does: 'move and act', seat: 1 },
    { keys: ['WASD + Space'], does: 'move and act', seat: 2 },
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
