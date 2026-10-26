/**
 * Quad Cube, slot 4: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/quad-cube/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'quad-cube',
  slot: 4,
  title: "Quad Cube",
  tagline: "Four in a row, in a cube of glass you can turn in your hands.",
  teaser: "Sixty-four cells, seventy-six ways to win. Spin the glass cube, hover a cell and see every line it could finish.",
  family: 'brain',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [4, 15],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#1b6e8a', night: '#7fd0e8' },
  emblem: "M12 3 20 7.5v9L12 21l-8-4.5v-9ZM12 12l8-4.5M12 12v9M12 12 4 7.5",
  label: {
    pattern: 'diamonds',
    paper: '#dceef2',
    ink: '#8cc5d6',
    band: '#0b3954',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "3-D Tic-Tac-Toe",
    uiTitle: "the four-level tic-tac-toe",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [4],
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
