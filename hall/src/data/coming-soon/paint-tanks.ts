/**
 * Paint Tanks, slot 20: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/paint-tanks/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'paint-tanks',
  slot: 20,
  title: "Paint Tanks",
  tagline: "Toy tanks in a diorama that splat paint on each other.",
  teaser: "Ricochet paint shells round the corners of a tabletop diorama. Duck behind cover, bank the shot, and watch your rival turn your colour.",
  family: 'duels',
  players: '2P',
  versus: 'local+bot',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#2e7d32', night: '#8fe08f' },
  emblem: "M3 15h14l2 4H5ZM6 15v-4h8v4M14 12h6",
  label: {
    pattern: 'dots',
    paper: '#2e7d32',
    ink: '#66a86a',
    band: '#fdd835',
    bandText: '#1b3a1d',
  },
  inspiredBy: {
    originalTitle: "Combat",
    uiTitle: "the tank duel",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [21],
  },
  controls: [
    { keys: ["WASD + Space"], does: "move and act", seat: 1 },
    { keys: ["Arrows + Enter"], does: "move and act", seat: 2 },
  ],
  channels: [
    { id: 'classic', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
};
