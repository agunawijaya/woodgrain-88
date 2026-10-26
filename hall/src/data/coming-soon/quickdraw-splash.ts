/**
 * Quickdraw Splash, slot 24: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/quickdraw-splash/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'quickdraw-splash',
  slot: 24,
  title: "Quickdraw Splash",
  tagline: "High noon, water pistols, and a cactus to hide behind.",
  teaser: "Two gunslingers with water pistols on a sun-baked main street. Duck behind the cactus, bounce a shot off the saloon wall, and get them soaked first.",
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#a4512f', night: '#ffae85' },
  emblem: "M4 9h12v4h-6l-1 6H6l1-6H4ZM16 10h3M21 8.5h0M21 11.5h0",
  label: {
    pattern: 'waves',
    paper: '#f2c57c',
    ink: '#e3926c',
    band: '#3d405b',
    bandText: '#f4f1de',
  },
  inspiredBy: {
    originalTitle: "Outlaw",
    uiTitle: "the western duel",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [25],
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
