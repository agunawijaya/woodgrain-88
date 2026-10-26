/**
 * Chalk Talk, slot 13: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/chalk-talk/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'chalk-talk',
  slot: 13,
  title: "Chalk Talk",
  tagline: "Call the play on a chalkboard, then watch it run.",
  teaser: "Draw up the play, snap the ball, and see your chalk lines come alive. Two coaches, one board, every down a little chess match.",
  family: 'sports',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [8, 20],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#2d7a52', night: '#8fe3b4' },
  emblem: "M4 5l4 4M8 5 4 9M16 15a3 3 0 1 0 0-.01M8 9c2 6 5 8 8 6",
  label: {
    pattern: 'stripes',
    paper: '#2d6a4f',
    ink: '#5d9c80',
    band: '#e9c46a',
    bandText: '#1b4332',
  },
  inspiredBy: {
    originalTitle: "Football",
    uiTitle: "the pocket football",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [13],
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
