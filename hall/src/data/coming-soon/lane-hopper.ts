/**
 * Lane Hopper, slot 11: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/lane-hopper/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'lane-hopper',
  slot: 11,
  title: "Lane Hopper",
  tagline: "Race a friend across ten lanes of traffic.",
  teaser: "Ten lanes, a ticking clock and a friend in the next lane. Read the gaps, hop through, and get bumped back when you guess wrong.",
  family: 'arcade',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#5f7a12', night: '#c8f25a' },
  emblem: "M3 9h4M10 9h4M17 9h4M3 15h4M10 15h4M17 15h4M12 21v-2.5M12 6V3",
  label: {
    pattern: 'stripes',
    angle: 90,
    paper: '#343a40',
    ink: '#ffd60a',
    band: '#8ac926',
    bandText: '#1a3300',
  },
  inspiredBy: {
    originalTitle: "Freeway",
    uiTitle: "the road-crossing race",
    publisher: "Activision",
    year: null,
    cartridgeSlots: [11, 19],
  },
  controls: [
    { keys: ["Arrows or WASD"], does: "move" },
    { keys: ["Space"], does: "act" },
  ],
  channels: [
    { id: 'classic', title: 'Classic', description: 'The original rules, rebuilt and polished.' },
  ],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
  secrets: [
    {
      id: 'long-ears',
      counterSlot: 31,
      title: 'Long Ears',
      hint: 'Something with longer ears is said to cross at first light.',
    },
  ],
};
