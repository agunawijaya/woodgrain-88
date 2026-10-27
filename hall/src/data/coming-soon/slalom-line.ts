/**
 * Slalom Line, slot 22: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/slalom-line/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'slalom-line',
  slot: 22,
  title: 'Slalom Line',
  tagline: 'Carve the gates on a fresh mountain every run.',
  teaser:
    'Downhill and slalom on mountains generated for each run. Race your own ghost and shave the hundredths off the line you know.',
  family: 'sports',
  players: '1P',
  versus: 'none',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'lower',
  accent: { day: '#00707a', night: '#6fe0e8' },
  emblem: 'M6 4v6M6 4l3 1.5L6 7M18 12v6M18 12l3 1.5-3 1.5M4 21c4-4 4-8 8-9s4-4 8-9',
  label: {
    pattern: 'chevrons',
    paper: '#edf6f9',
    ink: '#9fd3cc',
    band: '#006d77',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Skiing',
    uiTitle: 'the downhill cartridge',
    publisher: 'Activision',
    year: null,
    cartridgeSlots: [23],
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
