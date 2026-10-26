/**
 * Tank Duel, slot 20: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/tank-duel/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'tank-duel',
  slot: 20,
  title: "Tank Duel",
  tagline: "Tanks, jets and biplanes. Ricochets, cover and big explosions.",
  teaser: "Tanks, jets and biplanes face off in an arena of walls and cover. Bank shells off the walls, steer guided shots round the corners and blow your rival up before they get you.",
  family: 'duels',
  players: '2P',
  versus: 'local+bot',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#2e7d32', night: '#8fe08f' },
  emblem: "M3 15.5h12l2 3.5H5ZM6 15.5V12.5h6v3M12 13.5h5M19.5 11.5l1.6-1.6M19.8 13.5h2.2M19.5 15.5l1.6 1.6M7.5 17.3h0M10.5 17.3h0M13.5 17.3h0",
  label: {
    pattern: "bricks",
    paper: "#56652b",
    ink: "#71833b",
    band: "#f2a22c",
    bandText: "#22160a",
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
    { id: 'classic', kind: 'original', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
