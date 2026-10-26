/**
 * Shore Battery, slot 18: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/shore-battery/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'shore-battery',
  slot: 18,
  title: "Shore Battery",
  tagline: "Planes overhead, ships below, two gunners racing for the score.",
  teaser: "Two gun batteries on the shore, bombers crossing overhead and ships steaming past below. Lead your shots, time each shell and outscore the gunner beside you.",
  family: 'arcade',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#5a2bc0', night: '#c9a8ff' },
  emblem: "M3.5 8.5h11.5l3.5-1.5M9.5 8.5 7 12.5h2l3-4M5 8.5 3.5 5h1.8l2.2 3.5M14 17.5l2.5-5M3 20q2.25-2.5 4.5 0t4.5 0 4.5 0 4.5 0",
  label: {
    pattern: "waves",
    paper: "#d3e6f1",
    ink: "#93bdd6",
    band: "#14213d",
    bandText: "#ffffff",
  },
  inspiredBy: {
    originalTitle: "Air-Sea Battle",
    uiTitle: "the air and sea gunnery game",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [18],
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
