/**
 * Lasso Run, slot 23: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/lasso-run/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'lasso-run',
  slot: 23,
  title: "Lasso Run",
  tagline: "Round up the herd to the rhythm of hooves.",
  teaser: "Ride alongside the herd and rope each calf before it escapes. Keep the rhythm going and the round-up turns into a song.",
  family: 'arcade',
  players: '1P',
  versus: 'none',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#9c5a2c', night: '#f0b585' },
  emblem: "M12 5c4.5 0 8 1.8 8 4s-3.5 4-8 4-8-1.8-8-4 3.5-4 8-4ZM9 12.5c-1 3-3 5-5 7",
  label: {
    pattern: 'zigzag',
    paper: '#e0b98c',
    ink: '#b9774a',
    band: '#fefae0',
    bandText: '#6b3e26',
  },
  inspiredBy: {
    originalTitle: "Stampede",
    uiTitle: "the cattle round-up",
    publisher: "Activision",
    year: null,
    cartridgeSlots: [24],
  },
  controls: [
    { keys: ["Arrows or WASD"], does: "move" },
    { keys: ["Space"], does: "act" },
  ],
  channels: [
    { id: 'classic', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
};
