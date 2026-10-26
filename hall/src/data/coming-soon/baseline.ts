/**
 * Baseline, slot 19: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/baseline/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'baseline',
  slot: 19,
  title: "Baseline",
  tagline: "Two-button tennis where the angle comes from your timing.",
  teaser: "Hit early to go cross-court, late to go down the line. Simple to pick up, endless to master, and doubles against the neighbourhood kids.",
  family: 'sports',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [4, 12],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#b9472c', night: '#ffa184' },
  emblem: "M9 3a6 6 0 1 0 0 12 6 6 0 1 0 0-12M13 13l7 7M19 5h0",
  label: {
    pattern: 'blocks',
    paper: '#e76f51',
    ink: '#f0956f',
    band: '#ffffff',
    bandText: '#9b2c16',
  },
  inspiredBy: {
    originalTitle: "Tennis",
    uiTitle: "the tennis cartridge",
    publisher: "Activision",
    year: null,
    cartridgeSlots: [20],
  },
  controls: [
    { keys: ["Arrows or WASD"], does: "move and aim" },
    { keys: ["Space"], does: "act" },
  ],
  channels: [
    { id: 'classic', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
};
