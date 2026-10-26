/**
 * Crown Jump, slot 9: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/crown-jump/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'crown-jump',
  slot: 9,
  title: "Crown Jump",
  tagline: "Chain the jumps in one sweep and crown your king.",
  teaser: "Classic checkers with capture hints that never nag. Drag a whole multi-jump in one gesture and hear every piece leave the board.",
  family: 'brain',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [8, 25],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#a8322f', night: '#ff8f80' },
  emblem: "M4 18h16M5 18 4 8l5 4 3-6 3 6 5-4-1 10",
  label: {
    pattern: 'plaid',
    paper: '#9b2226',
    ink: '#c4513a',
    band: '#e9d8a6',
    bandText: '#5c1013',
  },
  inspiredBy: {
    originalTitle: "Checkers",
    uiTitle: "the checkers cartridge",
    publisher: "Activision",
    year: null,
    cartridgeSlots: [9],
  },
  controls: [
    { keys: ["Mouse or arrows"], does: "choose" },
    { keys: ["Enter or click"], does: "play a move" },
  ],
  channels: [
    { id: 'classic', kind: 'original', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
