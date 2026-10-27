/**
 * Pier Derby, slot 15: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/pier-derby/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'pier-derby',
  slot: 15,
  title: 'Pier Derby',
  tagline: 'Two anglers, one pier, one hungry shark to dodge.',
  teaser:
    'Drop your line, feel the bite and reel in before the shark gets curious. Bigger fish swim deeper, and your rival is fishing the same pond.',
  family: 'sports',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [3, 8],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#0f6fa0', night: '#7cd1ff' },
  emblem: 'M12 3v9a4 4 0 1 1-4-4M5 18c3-3 8-3 11 0-3 3-8 3-11 0ZM16 18l3-2v4Z',
  label: {
    pattern: 'waves',
    paper: '#7fd4e8',
    ink: '#3aa8cc',
    band: '#ffe8d6',
    bandText: '#023e8a',
  },
  inspiredBy: {
    originalTitle: 'Fishing Derby',
    uiTitle: 'the two-angler fishing game',
    publisher: 'Activision',
    year: null,
    cartridgeSlots: [15, 26],
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
  versions: [
    {
      id: 'derby',
      label: 'Derby',
      cartridgeSlot: 26,
      description: 'The derby as it shipped: its own pond, its own anglers.',
    },
    {
      id: 'hack',
      label: 'Hack',
      cartridgeSlot: 15,
      description:
        'The other copy: new colours and anglers, and the two difficulty switches handicap the opposite angler.',
    },
  ],
};
