/**
 * Big Top Splash, slot 2: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/big-top-splash/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'big-top-splash',
  slot: 2,
  title: "Big Top Splash",
  tagline: "Aim the cannon, read the arc, land the splash.",
  teaser: "Set the angle, set the power, and send the star of the show sailing into the pool. Miss and it is a cannonball into the water; land it and the crowd grows.",
  family: 'arcade',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [3, 8],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#c0392b', night: '#ff8a7a' },
  emblem: "M3 20 12 6l9 14ZM12 6V3l3 1-3 1M8.5 20l3.5-8 3.5 8",
  label: {
    pattern: 'stripes',
    paper: '#fffaf0',
    ink: '#e63946',
    band: '#1d3557',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Human Cannonball",
    uiTitle: "the circus cannon game",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [2],
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
