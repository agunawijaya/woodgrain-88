/**
 * Trailblaze, slot 8: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/trailblaze/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'trailblaze',
  slot: 8,
  title: "Trailblaze",
  tagline: "Leave a trail of light and box your rival in.",
  teaser: "Two racers, one arena, and every move leaves a wall behind you. Out-think your rival before the space runs out.",
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 8],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#16808f', night: '#5ee6dc' },
  emblem: "M4 20v-8h6V6h10M4 20h0M20 6h0",
  label: {
    pattern: 'grid',
    paper: '#1b2a41',
    ink: '#3fd0c9',
    band: '#f2e8d5',
    bandText: '#1b2a41',
  },
  inspiredBy: {
    originalTitle: "Surround",
    uiTitle: "the trail duel",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [8],
  },
  controls: [
    { keys: ["WASD + Space"], does: "move and act", seat: 1 },
    { keys: ["Arrows + Enter"], does: "move and act", seat: 2 },
  ],
  channels: [
    { id: 'classic', kind: 'original', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
