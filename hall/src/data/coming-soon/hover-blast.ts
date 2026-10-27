/**
 * Hover Blast, slot 26: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/hover-blast/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'hover-blast',
  slot: 26,
  title: 'Hover Blast',
  tagline: 'A hovercraft against ground drones in a neon canyon.',
  teaser:
    'Skim the canyon floor and tag the drones before they lock on. Every wave lights the canyon a new colour.',
  family: 'arcade',
  players: '1P',
  versus: 'none',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#b0124f', night: '#ff6fae' },
  emblem: 'M4 15h16l-2 3H6ZM7 15l2-4h6l2 4M12 11V4',
  label: {
    pattern: 'chevrons',
    paper: '#240046',
    ink: '#ff006e',
    band: '#2667d9',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Laser Blast',
    uiTitle: 'the hover-craft shooter',
    publisher: 'Activision',
    year: null,
    cartridgeSlots: [28],
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
