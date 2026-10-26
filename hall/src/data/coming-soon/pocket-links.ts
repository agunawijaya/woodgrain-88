/**
 * Pocket Links, slot 7: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/pocket-links/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'pocket-links',
  slot: 7,
  title: "Pocket Links",
  tagline: "Nine holes, a breeze you can read, a swing in three clicks.",
  teaser: "Every round is nine fresh holes. Read the wind and the lie, time your three-click swing, and watch the ball drop.",
  family: 'sports',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [6, 18],
  status: 'coming-soon',
  scoreOrder: 'lower',
  accent: { day: '#3c7d32', night: '#9ee089' },
  emblem: "M8 20V4l8 3-8 3M4 20c2-1.5 6-2 8-2s6 .5 8 2",
  label: {
    pattern: 'ripples',
    paper: '#a9cf8a',
    ink: '#7fb062',
    band: '#f8f9fa',
    bandText: '#386641',
  },
  inspiredBy: {
    originalTitle: "Golf",
    uiTitle: "the golf cartridge",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [7],
  },
  controls: [
    { keys: ["Arrows or WASD"], does: "move and aim" },
    { keys: ["Space"], does: "act" },
  ],
  channels: [
    { id: 'classic', kind: 'original', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
