/**
 * Lane Ten, slot 29: registered as coming soon. Its own prompt replaces
 * this placeholder with the real manifest in games/lane-ten/.
 */
import type { GameManifest } from '@woodgrain-88/kit';

export const manifest: GameManifest = {
  id: 'lane-ten',
  slot: 29,
  title: "Lane Ten",
  tagline: "Ten-pin with spin you steer after release.",
  teaser: "Roll, then curve the ball down the lane with a touch of spin. The pins tumble like they mean it, and a strike sounds as good as it feels.",
  family: 'sports',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [5, 15],
  status: 'coming-soon',
  scoreOrder: 'higher',
  accent: { day: '#8a5a1c', night: '#f2c27f' },
  emblem: "M9 3c1.5 0 2 1.5 1.5 3-.5 1.5 1.5 3 1.5 6s-1 7-3 9c-2-2-3-6-3-9s2-4.5 1.5-6C7 4.5 7.5 3 9 3ZM18 17a3 3 0 1 0 0-.01",
  label: {
    pattern: 'stripes',
    angle: 90,
    paper: '#dda15e',
    ink: '#c8843f',
    band: '#283618',
    bandText: '#fefae0',
  },
  inspiredBy: {
    originalTitle: "Bowling",
    uiTitle: "the bowling cartridge",
    publisher: "Atari",
    year: null,
    cartridgeSlots: [31],
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
