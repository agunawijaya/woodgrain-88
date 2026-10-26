/**
 * Hot & Cold, slot 5: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/hot-and-cold/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'hot-and-cold',
  slot: 5,
  title: "Hot & Cold",
  tagline: "Find the hidden flag with clues that paint the board.",
  teaser: "Somewhere on the grid a flag is hiding. Every square you uncover tells you warmer or colder, and the board slowly lights up with what you know.",
  family: 'brain',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [3, 10],
  status: 'coming-soon',
  scoreOrder: 'lower',
  accent: { day: '#c25b2b', night: '#ffab76' },
  emblem: "M6 21V4l9 3-9 3M14 15a4 4 0 0 1 4 4M14 11a8 8 0 0 1 8 8",
  label: {
    pattern: 'rings',
    paper: '#fdf0d5',
    ink: '#f4a59d',
    band: '#264653',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Flag Capture",
    uiTitle: "the hidden-flag hunt",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [5],
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
