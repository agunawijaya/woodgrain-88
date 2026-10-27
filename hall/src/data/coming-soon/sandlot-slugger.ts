/**
 * Sandlot Slugger, slot 30: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/sandlot-slugger/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'sandlot-slugger',
  slot: 30,
  title: 'Sandlot Slugger',
  tagline: 'Backyard baseball with pitch types and an eye you train.',
  teaser:
    'Curveballs, change-ups and a batting eye that gets sharper with every at-bat. Nine innings in a backyard where the fence is always just out of reach.',
  family: 'sports',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [6, 20],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#8f3b2f', night: '#ff9a8a' },
  emblem: 'M4 20 15 9l3 3L7 23M18 5a2 2 0 1 0 0-.01',
  label: {
    pattern: 'diamonds',
    paper: '#b5d478',
    ink: '#7fae4f',
    band: '#bc4749',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Home Run',
    uiTitle: 'the baseball cartridge',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [32],
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
