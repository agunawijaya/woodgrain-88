/**
 * Tank Duel's manifest: what the Hall shows before the game loads. The
 * channels come straight from the rules table (`engine/channels.ts`) and
 * their one-line descriptions from `copy/channel-lines.ts`, so a channel is
 * defined once.
 */
import type { ChannelDef, GameManifest } from '@woodgrain-88/kit';
import { CHANNEL_LINES } from './copy/channel-lines.ts';
import { CHANNELS } from './engine/channels.ts';
import type { ChannelRules } from './engine/types.ts';
import { TANK_EVENTS } from './progress/events.ts';

/** Each Remix channel opens with one of the game's patches. */
const REMIX_UNLOCKS: Readonly<Record<string, string>> = {
  'ricochet-royale': 'bank-manager',
  blackout: 'ghost',
  'ace-duel': 'top-gun',
  'last-tank': 'grandpas-respect',
};

function channelDef(channel: ChannelRules): ChannelDef {
  const description = CHANNEL_LINES[channel.id] ?? channel.title;
  if (channel.originalGame === null) {
    const unlockedBy = REMIX_UNLOCKS[channel.id];
    return {
      id: channel.id,
      kind: 'remix',
      title: channel.title,
      description,
      group: channel.group,
      ...(unlockedBy ? { unlockedBy } : {}),
    };
  }
  return {
    id: channel.id,
    kind: 'original',
    title: channel.title,
    description,
    group: channel.group,
    originalGame: [channel.originalGame],
  };
}

export const manifest: GameManifest = {
  id: 'tank-duel',
  slot: 20,
  title: 'Tank Duel',
  tagline: 'Tanks, jets and biplanes. Ricochets, cover and big explosions.',
  teaser:
    '27 classic duels on one cartridge, rebuilt as a tabletop battlefield. Bank shells off the walls, curl guided shots round corners, hide in the clouds, and finally take on a computer rival who plays like a person.',
  family: 'duels',
  players: '1–2P',
  versus: 'local+bot',
  sessionMinutes: [3, 10],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#2e7d32', night: '#8fe08f' },
  emblem:
    'M3 15.5h12l2 3.5H5ZM6 15.5V12.5h6v3M12 13.5h5M19.5 11.5l1.6-1.6M19.8 13.5h2.2M19.5 15.5l1.6 1.6M7.5 17.3h0M10.5 17.3h0M13.5 17.3h0',
  label: {
    pattern: 'bricks',
    paper: '#56652b',
    ink: '#71833b',
    band: '#f2a22c',
    bandText: '#22160a',
  },
  inspiredBy: {
    originalTitle: 'Combat',
    uiTitle: 'the 1977 tank duel',
    publisher: 'Atari',
    // Shown only once a cited source confirms it (CREDITS.md).
    year: null,
    cartridgeSlots: [21],
  },
  controls: [
    { keys: ['Arrows or WASD', 'Space or Enter'], does: 'drive and fire, playing alone' },
    { keys: ['←', '→'], does: 'turn', seat: 1 },
    { keys: ['↑'], does: 'drive forward, or afterburner in a jet', seat: 1 },
    { keys: ['↓'], does: 'slow down in the air, or back away with Reverse gear', seat: 1 },
    { keys: ['Enter'], does: 'fire', seat: 1 },
    { keys: ['A', 'D'], does: 'turn', seat: 2 },
    { keys: ['W'], does: 'drive forward, or afterburner in a jet', seat: 2 },
    { keys: ['S'], does: 'slow down in the air, or back away with Reverse gear', seat: 2 },
    { keys: ['Space'], does: 'fire', seat: 2 },
  ],
  channels: CHANNELS.map(channelDef),
  supports: { daily: true, challengeLinks: true, microChallenges: true },
  difficulty: {
    left: { a: 'Shorter shots, slower aircraft', b: 'Full range' },
    right: { a: 'Shorter shots, slower aircraft', b: 'Full range' },
    liveChange: false,
  },
  events: TANK_EVENTS,
};
