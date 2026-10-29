/**
 * Trailblaze patches: two Club, three Pro (each opening a Remix channel),
 * one Legend (opening two Remix channels), and two secret patches, measured
 * from the Den Life events in `events.ts`.
 */
import type { PatchDef } from '@woodgrain-88/kit';

export const TRAILBLAZE_PATCHES: readonly PatchDef[] = [
  {
    id: 'first-wall',
    tier: 'club',
    title: 'First Wall',
    description: 'Win a match against anyone.',
    goal: { metric: { kind: 'count', event: 'match-won' }, target: 1 },
  },
  {
    id: 'long-ride',
    tier: 'club',
    title: 'Long Ride',
    description: 'Ride 60 seconds in one point on a speed-up channel.',
    goal: { metric: { kind: 'max', event: 'ride', field: 'speedUpSeconds' }, target: 60 },
  },
  {
    id: 'boxed-in',
    tier: 'pro',
    title: 'Boxed In',
    description: 'Win a point by shutting a rival in ten cells or fewer. Opens Fading Trails.',
    goal: { metric: { kind: 'max', event: 'point-won', field: 'boxedIn' }, target: 1 },
  },
  {
    id: 'clean-sweep',
    tier: 'pro',
    title: 'Clean Sweep',
    description: 'Win a match against a Kid without losing a point. Opens Shrinking Arena.',
    goal: { metric: { kind: 'max', event: 'match-won', field: 'shutout' }, target: 1 },
  },
  {
    id: 'old-machine',
    tier: 'pro',
    title: 'Old Machine',
    description: 'Beat Computer 1977 with its switch on A. Opens Boost Lanes.',
    goal: { metric: { kind: 'max', event: 'match-won', field: 'computerOnA' }, target: 1 },
  },
  {
    id: 'faster-than-lou',
    tier: 'legend',
    title: 'Faster Than Lou',
    description:
      'Beat Grandpa Lou in an eight-way speed-up channel with your switch on A. Opens Four Way and Ghost Trails.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'louEightSpeedOnPlayerA' },
      target: 1,
    },
  },
  {
    id: 'ghost-rider',
    tier: 'secret',
    title: 'Ghost Rider',
    description: 'Win a point within a second of riding straight through your rival.',
    hint: 'The old riders never quite touched.',
    goal: { metric: { kind: 'max', event: 'point-won', field: 'ghostPass' }, target: 1 },
  },
  {
    id: 'fine-art',
    tier: 'secret',
    title: 'Fine Art',
    description: 'Export a Doodle that covers half the board.',
    hint: 'Some trails are worth keeping.',
    goal: { metric: { kind: 'max', event: 'doodle-exported', field: 'filledPercent' }, target: 50 },
  },
];
