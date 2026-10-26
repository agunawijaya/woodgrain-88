/**
 * Sum Rush, slot 3: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/sum-rush/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'sum-rush',
  slot: 3,
  title: "Sum Rush",
  tagline: "Quick sums, gentle for kids and fierce for grown-ups.",
  teaser: "Answers race toward you and only the right one counts. A friendly ladder for new counters and a daily sprint that keeps grown-ups honest.",
  family: 'brain',
  players: '1P',
  versus: 'none',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#2f5fa8', night: '#8ab4ff' },
  emblem: "M4 7h6M7 4v6M14 7h6M4 15.5h6M14 14h6M14 18h6",
  label: {
    pattern: 'grid',
    paper: '#fffdf5',
    ink: '#7aa6e0',
    band: '#d62839',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Basic Math",
    uiTitle: "the arithmetic cartridge",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [3],
  },
  controls: [
    { keys: ["Mouse or arrows"], does: "choose" },
    { keys: ["Enter or click"], does: "play a move" },
  ],
  channels: [
    { id: 'classic', kind: 'original', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, microChallenges: false },
  events: [],
};
