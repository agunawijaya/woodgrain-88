/**
 * Drop Zone, slot 25: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/drop-zone/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'drop-zone',
  slot: 25,
  title: "Drop Zone",
  tagline: "Read the wind and land on the moving target.",
  teaser: "Jump, fall, open the chute at the last good moment, and steer onto the target. Land it for the crowd; miss and you drop into a soft hay bale.",
  family: 'arcade',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [2, 6],
  status: 'coming-soon',
  scoreOrder: 'lower',
  accent: { day: '#1d6d96', night: '#8fd2ff' },
  emblem: "M3 11a9 7 0 0 1 18 0ZM3 11l9 8 9-8M12 11v8",
  label: {
    pattern: 'sunburst',
    paper: '#a6d8ee',
    ink: '#ffc94d',
    band: '#023047',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: "Sky Diver",
    uiTitle: "the skydiving game",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [27],
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
};
