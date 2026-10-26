/**
 * Gravity Duel, slot 16: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/gravity-duel/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'gravity-duel',
  slot: 16,
  title: "Gravity Duel",
  tagline: "Two ships, one star, and orbits you learn by feel.",
  teaser: "A star pulls at both ships. Slingshot around it, drift into position and land the shot while your friend fights the same gravity.",
  family: 'duels',
  players: '2P',
  versus: 'local',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#6a4fa0', night: '#c3a9ff' },
  emblem: "M12 12h0M4 12a8 4 0 1 0 16 0 8 4 0 1 0-16 0M12 3v2.5M12 18.5V21",
  label: {
    pattern: 'stars',
    paper: '#14112b',
    ink: '#f6e27f',
    band: '#7b5ea7',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Space War",
    uiTitle: "the star-gravity dogfight",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [16],
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
