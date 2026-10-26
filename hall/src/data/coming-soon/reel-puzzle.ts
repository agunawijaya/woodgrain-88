/**
 * Reel Puzzle, slot 21: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/reel-puzzle/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'reel-puzzle',
  slot: 21,
  title: "Reel Puzzle",
  tagline: "A timing and pattern puzzle. No bets, no credits.",
  teaser: "Stop the reels to build patterns against a quiet clock. It looks like the old fruit reels and plays like a puzzle: nothing to bet, nothing to buy.",
  family: 'brain',
  players: '1P',
  versus: 'none',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#9a5a0d', night: '#ffcf6b' },
  emblem: "M3 6h18v12H3ZM9 6v12M15 6v12M5.5 12h1M11.5 10v4M17 11h1",
  label: {
    pattern: 'stripes',
    angle: 90,
    paper: '#fff3b0',
    ink: '#e9b965',
    band: '#540b0e',
    bandText: '#fff3b0',
  },
  inspiredBy: {
    originalTitle: "Slot Machine",
    uiTitle: "the fruit-reel cartridge",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [22],
  },
  controls: [
    { keys: ["Mouse or arrows"], does: "choose" },
    { keys: ["Enter or click"], does: "play a move" },
  ],
  channels: [
    { id: 'classic', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
};
