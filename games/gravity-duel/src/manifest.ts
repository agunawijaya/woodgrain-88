/**
 * Gravity Duel's manifest: what the Hall shows before the game loads. The
 * channels come straight from `channels.ts` and the events from
 * `progress/events.ts`, so each is defined once.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import { CHANNELS } from './channels.ts';
import { GRAVITY_EVENTS } from './progress/events.ts';

export const manifest: GameManifest = {
  id: 'gravity-duel',
  slot: 16,
  title: 'Gravity Duel',
  tagline: 'No brakes in space.',
  teaser:
    'A two-ship duel with real momentum and a star that bends every shot. Fight a friend or a Neighbourhood Kid, or race to dock with drifting pods, in deep space, a brass orrery, a crayon sky or a whirlpool.',
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [3, 8],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#6a4fa0', night: '#c3a9ff' },
  emblem: 'M12 12h0M4 12a8 4 0 1 0 16 0 8 4 0 1 0-16 0M12 3v2.5M12 18.5V21',
  label: {
    pattern: 'stars',
    paper: '#14112b',
    ink: '#f6e27f',
    band: '#7b5ea7',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Space War',
    uiTitle: 'the 1978 orbital duel',
    publisher: 'Atari',
    year: 1978,
    cartridgeSlots: [16],
  },
  controls: [
    { keys: ['←', '→'], does: 'turn', seat: 1 },
    { keys: ['↑'], does: 'thrust', seat: 1 },
    { keys: ['↓'], does: 'cloak on or off', seat: 1 },
    { keys: ['Enter', 'Right Ctrl'], does: 'fire', seat: 1 },
    { keys: ['A', 'D'], does: 'turn', seat: 2 },
    { keys: ['W'], does: 'thrust', seat: 2 },
    { keys: ['S'], does: 'cloak on or off', seat: 2 },
    { keys: ['Space'], does: 'fire', seat: 2 },
    { keys: ['Stick, left/right'], does: 'turn (Classic) or face a heading (Modern)' },
    { keys: ['Stick up, or A'], does: 'thrust (Classic: stick up; Modern: A)' },
    { keys: ['Stick down, or B'], does: 'cloak (Classic); Modern cloaks on Y' },
    { keys: ['A'], does: 'fire (Classic)' },
    { keys: ['B'], does: 'fire (Modern)' },
  ],
  channels: CHANNELS.map((channel) => channel.def),
  supports: { daily: true, challengeLinks: true, microChallenges: true },
  difficulty: {
    left: {
      a: 'Your missile can hit you; docks need an exact speed match',
      b: 'Your missile is harmless to you; docks forgive a close match',
    },
    right: {
      a: 'Your missile can hit you; docks need an exact speed match',
      b: 'Your missile is harmless to you; docks forgive a close match',
    },
    liveChange: false,
  },
  events: GRAVITY_EVENTS,
};
