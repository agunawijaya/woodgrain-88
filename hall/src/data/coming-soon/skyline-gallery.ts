/**
 * Skyline Gallery, slot 18: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/skyline-gallery/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'skyline-gallery',
  slot: 18,
  title: "Skyline Gallery",
  tagline: "A harbour fair of balloons, kites and toy boats.",
  teaser: "Pop the balloons, clip the kites, splash the toy boats bobbing in the harbour. Two stalls side by side, one prize for the sharper eye.",
  family: 'arcade',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#5a2bc0', night: '#c9a8ff' },
  emblem: "M12 3a5 6 0 1 0 0 12 5 6 0 1 0 0-12M12 15l-1 2h2l-1 2v2",
  label: {
    pattern: 'dots',
    paper: '#ffd6e5',
    ink: '#ff8fab',
    band: '#3a0ca3',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Air-Sea Battle",
    uiTitle: "the shooting gallery",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [18],
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
