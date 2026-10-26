/**
 * Glove Box, slot 17: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/glove-box/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'glove-box',
  slot: 17,
  title: "Glove Box",
  tagline: "Cartoon boxing scored on clean hits. Bells, not bruises.",
  teaser: "Duck, weave and land the clean hits. It is all cartoon gloves and confetti, scored round by round, and nobody ever hits the canvas.",
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [3, 8],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#c43a1d', night: '#ff9d7a' },
  emblem: "M7 20v-4c-2-1-3-3-3-6a5 5 0 0 1 10 0h2a3 3 0 0 1 0 6h-3v4Z",
  label: {
    pattern: 'sunburst',
    paper: '#e84a27',
    ink: '#f28c38',
    band: '#fff4e0',
    bandText: '#8c1c13',
  },
  inspiredBy: {
    originalTitle: "Boxing",
    uiTitle: "the top-down boxing",
    publisher: "Activision",
    year: null,
    cartridgeSlots: [17],
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
