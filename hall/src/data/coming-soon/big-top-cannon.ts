/**
 * Big Top Cannon, slot 2: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/big-top-cannon/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'big-top-cannon',
  slot: 2,
  title: "Big Top Cannon",
  tagline: "Aim the cannon, fly through the big top, land in the net.",
  teaser: "Set the angle and the speed, light the fuse and fire the daredevil across the big top. Hit the net and the crowd roars; miss it and it is a crash in the sawdust, then another go.",
  family: 'arcade',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [3, 8],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#c0392b', night: '#ff8a7a' },
  emblem: "M4 15.5l9.5-6.5 1.9 2.9-9.5 6.5ZM10 18.5a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0M16.5 8.5q2-3.5 4.5-3.5M21 5h0",
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
