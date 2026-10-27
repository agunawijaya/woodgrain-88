/**
 * Disc Duel, slot 6: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/disc-duel/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'disc-duel',
  slot: 6,
  title: 'Disc Duel',
  tagline: 'Flip the board in one move, if you can see it coming.',
  teaser:
    'Place a disc, trap a line, flip it your colour. Previews show every flip before you commit, and the neighbourhood rivals each play with their own style.',
  family: 'brain',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [5, 20],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#1e7a55', night: '#6fdcab' },
  emblem: 'M3 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0M11 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0',
  label: {
    pattern: 'checker',
    paper: '#1e6f50',
    ink: '#2b8a65',
    band: '#f9f7f3',
    bandText: '#1e6f50',
  },
  inspiredBy: {
    originalTitle: 'Othello',
    uiTitle: 'the disc-flipping strategy game',
    publisher: 'Atari',
    year: null,
    cartridgeSlots: [6],
  },
  controls: [
    { keys: ['Mouse or arrows'], does: 'choose' },
    { keys: ['Enter or click'], does: 'play a move' },
  ],
  channels: [
    {
      id: 'classic',
      kind: 'original',
      title: 'Classic',
      description: 'The original rules, rebuilt and polished.',
    },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
