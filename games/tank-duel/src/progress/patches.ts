/**
 * Tank Duel patch definitions: seven visible and secret milestones earned
 * across tank, jet, and billiard battles, including keys to remix channels.
 */
import type { PatchDef } from '@woodgrain-88/kit';

export const TANK_PATCHES: readonly PatchDef[] = [
  {
    id: 'rookie-commander',
    tier: 'club',
    title: 'Rookie Commander',
    description: 'Win a match against any Neighbourhood Kid.',
    goal: {
      metric: { kind: 'sum', event: 'match-won', field: 'vsKid' },
      target: 1,
    },
  },
  {
    id: 'ricochet',
    tier: 'club',
    title: 'Ricochet',
    description: 'Score 10 hits with shells that bounced off a wall.',
    goal: {
      metric: { kind: 'sum', event: 'hit', field: 'banked' },
      target: 10,
    },
  },
  {
    id: 'bank-manager',
    tier: 'pro',
    title: 'Bank Manager',
    description: 'Score 10 hits on billiard channels. Opens Ricochet Royale.',
    goal: {
      metric: { kind: 'sum', event: 'hit', field: 'billiard' },
      target: 10,
    },
  },
  {
    id: 'ghost',
    tier: 'pro',
    title: 'Ghost',
    description: 'Win a match on an invisible tank channel against a Kid. Opens Blackout.',
    goal: {
      metric: { kind: 'sum', event: 'match-won', field: 'invisible' },
      target: 1,
    },
  },
  {
    id: 'top-gun',
    tier: 'pro',
    title: 'Top Gun',
    description: 'Win 3 jet dogfights against a Kid. Opens Ace Duel.',
    goal: {
      metric: { kind: 'sum', event: 'match-won', field: 'jet' },
      target: 3,
    },
  },
  {
    id: 'grandpas-respect',
    tier: 'legend',
    title: "Grandpa's Respect",
    description: 'Defeat Grandpa Lou in an invisible maze with switch A. Opens Last Tank.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'louInvisibleMazeOnA' },
      target: 1,
    },
  },
  {
    id: 'lone-wolf',
    tier: 'secret',
    title: 'Lone Wolf',
    description: 'Win as the lone jet against three enemy fighters.',
    hint: 'Not every fight is fair. Win the one that is not.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'loneJet' },
      target: 1,
    },
  },
];
