/**
 * Lucky Reels, slot 21: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/lucky-reels/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'lucky-reels',
  slot: 21,
  title: "Lucky Reels",
  tagline: "Pick your paylines, place your bet, pull the lever.",
  teaser: "A proper slot machine: choose how many paylines to play, set your bet in credits, pull the lever and watch the reels stop one by one. Credits are play money in this game only; nothing is ever bought.",
  family: 'brain',
  players: '1P',
  versus: 'none',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#9a5a0d', night: '#ffcf6b' },
  emblem: "M3 6h14v12H3ZM7.67 6v12M12.33 6v12M3 12h14M20.5 7v7.5H17M20.5 5.2h0",
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
    uiTitle: "the slot machine",
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
