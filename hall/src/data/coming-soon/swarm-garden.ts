/**
 * Swarm Garden, slot 28: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/swarm-garden/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'swarm-garden',
  slot: 28,
  title: "Swarm Garden",
  tagline: "Steer the swarm away from the picnic before it builds a nest.",
  teaser: "A cloud of busy critters wants your picnic. Herd them, scatter them, and keep the garden clear before the nest goes up.",
  family: 'arcade',
  players: '1P',
  versus: 'none',
  sessionMinutes: [3, 8],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#2f8a3e', night: '#93f0a2' },
  emblem: "M12 14v7M12 14a3 3 0 1 0 0-6 3 3 0 1 0 0 6M18 5h0M20 8h0M16 3h0M5 6h0",
  label: {
    pattern: 'scales',
    paper: '#caffbf',
    ink: '#7fd98c',
    band: '#c2185b',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Cosmic Swarm",
    uiTitle: "the swarm shooter",
    publisher: "CommaVid",
    year: null,
    cartridgeSlots: [30],
  },
  controls: [
    { keys: ["Arrows or WASD"], does: "move" },
    { keys: ["Space"], does: "act" },
  ],
  channels: [
    { id: 'classic', kind: 'original', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
