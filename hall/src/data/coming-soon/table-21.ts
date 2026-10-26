/**
 * Table 21, slot 10: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/table-21/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'table-21',
  slot: 10,
  title: "Table 21",
  tagline: "Chips, bets and the dealer's upcard. Hit, stand or double.",
  teaser: "Blackjack the way it is dealt: bet your chips, read the dealer's upcard, then hit, stand or double down. An optional coach shows the odds. The chips are play money for this table only.",
  family: 'brain',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [4, 12],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#9a2b1e', night: '#ffb08a' },
  emblem: "M4 7l8-2 3 13-8 2ZM13 5.5l6 1-1.5 12.5",
  label: {
    pattern: 'diamonds',
    angle: 45,
    paper: '#6a040f',
    ink: '#9d2a2a',
    band: '#ffba08',
    bandText: '#370617',
  },
  inspiredBy: {
    originalTitle: "Blackjack",
    uiTitle: "the card table",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [10],
  },
  controls: [
    { keys: ["Mouse or arrows"], does: "choose" },
    { keys: ["Enter or click"], does: "play a move" },
  ],
  channels: [
    { id: 'classic', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
};
