/**
 * Bumper Chase, slot 14: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/bumper-chase/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'bumper-chase',
  slot: 14,
  title: 'Bumper Chase',
  tagline: 'Two cars, one maze, and missiles round every corner.',
  teaser:
    'Chase your friend through a maze of corners and fire missiles round the turns. Lose them in the corridors, then sneak up behind.',
  family: 'duels',
  players: '2P',
  versus: 'local',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#c0242f', night: '#ff7a84' },
  emblem: 'M7 4h10l1 4v10l-1 2H7l-1-2V8ZM6 9h12M6 15h12',
  label: {
    pattern: 'checker',
    paper: '#f4d35e',
    ink: '#e0b83a',
    band: '#d7263d',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Slot Racers',
    uiTitle: 'the maze-car duel',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [14],
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
