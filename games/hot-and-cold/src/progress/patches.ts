/**
 * Hot & Cold's patches: two Club, three Pro (each opening a Remix channel),
 * one Legend and one secret, measured from the events in `events.ts`.
 */
import type { PatchDef } from '@woodgrain-88/kit';

export const HOT_COLD_PATCHES: readonly PatchDef[] = [
  {
    id: 'flag-finder',
    tier: 'club',
    title: 'Flag Finder',
    description: 'Find 10 flags, in any channel.',
    goal: { metric: { kind: 'count', event: 'capture' }, target: 10 },
  },
  {
    id: 'neighbours-rival',
    tier: 'club',
    title: "Neighbour's Rival",
    description: 'Win a race or a turns match against any Neighbourhood Kid.',
    goal: { metric: { kind: 'sum', event: 'match-won', field: 'vsKid' }, target: 1 },
  },
  {
    id: 'bomb-dodger',
    tier: 'pro',
    title: 'Bomb Dodger',
    description: 'Find 5 flags in a row without setting off a bomb. Opens Minefield.',
    goal: { metric: { kind: 'max', event: 'capture', field: 'streak' }, target: 5 },
  },
  {
    id: 'sharp-eyes',
    tier: 'pro',
    title: 'Sharp Eyes',
    description: 'Hunting alone, find 3 flags with your first 12 checks. Opens Thin Ice.',
    goal: { metric: { kind: 'max', event: 'hunts-progress', field: 'flagsWithin12' }, target: 3 },
  },
  {
    id: 'pure-memory',
    tier: 'pro',
    title: 'Pure Memory',
    description: 'Win a turns match against Moss in Classic Memory. Opens Two Flags.',
    goal: { metric: { kind: 'max', event: 'match-won', field: 'mossTurnsClassic' }, target: 1 },
  },
  {
    id: 'old-fox',
    tier: 'legend',
    title: 'Old Fox',
    description:
      'Beat Grandpa Lou with a moving flag, in Classic Memory, with your switch on A. Opens Drift Storm.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'louMovingClassicOnA' },
      target: 1,
    },
  },
  {
    id: 'lucky-75',
    tier: 'secret',
    title: 'Lucky 75',
    description: 'In hunt for hunt, find a flag with exactly your 75th check.',
    hint: 'Some finds come right at the last moment.',
    goal: { metric: { kind: 'max', event: 'capture', field: 'onLastCheck' }, target: 1 },
  },
];
