/**
 * Gravity Duel patches: eight milestones sewn onto the denim jacket, spanning
 * duels, docking runs, cloaked strikes, starbase landings, and beatings of Lou.
 */
import type { PatchDef } from '@woodgrain-88/kit';

export const GRAVITY_PATCHES: readonly PatchDef[] = [
  {
    id: 'first-contact',
    tier: 'club',
    title: 'First Contact',
    description: 'Win any duel.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'duel' },
      target: 1,
    },
  },
  {
    id: 'soft-touch',
    tier: 'club',
    title: 'Soft Touch',
    description: 'Dock five pods in one match.',
    goal: {
      metric: { kind: 'max', event: 'dock', field: 'inMatch' },
      target: 5,
    },
  },
  {
    id: 'ghost-kill',
    tier: 'pro',
    title: 'Ghost Kill',
    description: 'Score within a second of dropping your cloak. Opens Asteroid Belt.',
    goal: {
      metric: { kind: 'max', event: 'point-won', field: 'afterCloak' },
      target: 1,
    },
  },
  {
    id: 'fuel-miser',
    tier: 'pro',
    title: 'Fuel Miser',
    description: 'Win a duel with six or more fuel segments left. Opens Last Fuel.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'fuelLeft' },
      target: 6,
    },
  },
  {
    id: 'soft-dock',
    tier: 'pro',
    title: 'Soft Dock',
    description: 'Dock ten times with your switch on A. Opens Comet.',
    goal: {
      metric: { kind: 'sum', event: 'dock', field: 'switchA' },
      target: 10,
    },
  },
  {
    id: 'lous-orbit',
    tier: 'legend',
    title: "Lou's Orbit",
    description:
      'Beat Grandpa Lou on The Star · Wraparound with your switch on A. Opens Binary Stars.',
    goal: {
      metric: { kind: 'max', event: 'match-won', field: 'louOrbit' },
      target: 1,
    },
  },
  {
    id: 'slingshot',
    tier: 'secret',
    title: 'Slingshot',
    description: 'Hit your rival with a missile the star bent through at least 90°.',
    hint: 'Aim where the star will send it.',
    goal: {
      metric: { kind: 'max', event: 'point-won', field: 'bend' },
      target: 90,
    },
  },
  {
    id: 'hot-landing',
    tier: 'secret',
    title: 'Hot Landing',
    description: 'Hit the starbase at top speed and live.',
    hint: 'The station never checks your speed.',
    goal: {
      metric: { kind: 'max', event: 'refuel', field: 'speed' },
      target: 56,
    },
  },
];
