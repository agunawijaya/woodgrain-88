/**
 * Tank Duel's 31 channels. The first 27 play the 1977 variations in order,
 * rule for rule (vehicle, shot, walls, billiard, invisibility, formation),
 * on our own boards: Sandbag Line where 1977 had its light maze, the Old
 * Quarter for its dense one, the Open Field, and two skies. Titles are ours.
 * The four Remix channels are new games built on the same engine, each
 * opened by a patch.
 */
import {
  ACE_FUEL_SECONDS,
  ACE_REFILL_PER_SECOND,
  BLACKOUT_SWEEP_EVERY,
  BLACKOUT_SWEEP_SHOWS,
  LAST_TANK_ROUND_SECONDS,
  LAST_TANK_ROUNDS,
} from './rules.ts';
import type { ChannelGroup, ChannelRules, RemixRule, ShotKind, VehicleClass } from './types.ts';

type Field = ChannelRules['field'];

const SANDBAGS: Field = { kind: 'arena', id: 'sandbag-line' };
const QUARTER: Field = { kind: 'arena', id: 'old-quarter' };
const OPEN: Field = { kind: 'arena', id: 'open-field' };
const BUMPERS: Field = { kind: 'arena', id: 'bumper-yard' };
const CLOUDS: Field = { kind: 'sky', id: 'cloud-banks' };
const OPEN_SKY: Field = { kind: 'sky', id: 'clear-sky' };

interface Variation {
  readonly title: string;
  readonly group: ChannelGroup;
  readonly field: Field;
  readonly vehicles?: readonly [VehicleClass, VehicleClass];
  readonly formation?: readonly [number, number];
  readonly shot: ShotKind;
  readonly bounce?: boolean;
  readonly billiard?: boolean;
  readonly invisible?: boolean;
}

const TANKS: readonly [VehicleClass, VehicleClass] = ['tank', 'tank'];
const BIPLANES: readonly [VehicleClass, VehicleClass] = ['biplane', 'biplane'];
const JETS: readonly [VehicleClass, VehicleClass] = ['jet', 'jet'];

/** The 27 originals, in 1977 order. */
const ORIGINALS: readonly Variation[] = [
  { title: 'Guided · Sandbags', group: 'Tanks', field: SANDBAGS, shot: 'guided' },
  { title: 'Guided · Old Quarter', group: 'Tanks', field: QUARTER, shot: 'guided' },
  { title: 'Straight · Old Quarter', group: 'Tanks', field: QUARTER, shot: 'straight' },
  { title: 'Guided · Open Field', group: 'Tanks', field: OPEN, shot: 'guided' },
  { title: 'Straight · Open Field', group: 'Tanks', field: OPEN, shot: 'straight' },
  {
    title: 'Bouncing · Old Quarter',
    group: 'Tanks',
    field: QUARTER,
    shot: 'straight',
    bounce: true,
  },
  { title: 'Bouncing · Open Field', group: 'Tanks', field: OPEN, shot: 'straight', bounce: true },
  {
    title: 'Billiard · Sandbags',
    group: 'Tanks',
    field: SANDBAGS,
    shot: 'straight',
    bounce: true,
    billiard: true,
  },
  {
    title: 'Billiard · Old Quarter',
    group: 'Tanks',
    field: QUARTER,
    shot: 'straight',
    bounce: true,
    billiard: true,
  },
  {
    title: 'Ghost guided · Sandbags',
    group: 'Invisible Tanks',
    field: SANDBAGS,
    shot: 'guided',
    invisible: true,
  },
  {
    title: 'Ghost guided · Quarter',
    group: 'Invisible Tanks',
    field: QUARTER,
    shot: 'guided',
    invisible: true,
  },
  {
    title: 'Ghost bounce · Quarter',
    group: 'Invisible Tanks',
    field: QUARTER,
    shot: 'straight',
    bounce: true,
    invisible: true,
  },
  {
    title: 'Ghost pool · Sandbags',
    group: 'Invisible Tanks',
    field: SANDBAGS,
    shot: 'straight',
    bounce: true,
    billiard: true,
    invisible: true,
  },
  {
    title: 'Ghost pool · Quarter',
    group: 'Invisible Tanks',
    field: QUARTER,
    shot: 'straight',
    bounce: true,
    billiard: true,
    invisible: true,
  },
  {
    title: 'Guided · Clouds',
    group: 'Biplanes',
    field: CLOUDS,
    vehicles: BIPLANES,
    shot: 'guided',
  },
  {
    title: 'Straight · Clouds',
    group: 'Biplanes',
    field: CLOUDS,
    vehicles: BIPLANES,
    shot: 'straight',
  },
  {
    title: 'Machine gun · Clouds',
    group: 'Biplanes',
    field: CLOUDS,
    vehicles: BIPLANES,
    shot: 'machine-gun',
  },
  {
    title: 'Machine gun · Open sky',
    group: 'Biplanes',
    field: OPEN_SKY,
    vehicles: BIPLANES,
    shot: 'machine-gun',
  },
  {
    title: 'Guided pairs · Open sky',
    group: 'Biplanes',
    field: OPEN_SKY,
    vehicles: BIPLANES,
    formation: [2, 2],
    shot: 'guided',
  },
  {
    title: 'Giant bomber vs three',
    group: 'Biplanes',
    field: OPEN_SKY,
    vehicles: ['bomber', 'biplane'],
    formation: [1, 3],
    shot: 'straight',
  },
  { title: 'Guided jets · Clouds', group: 'Jets', field: CLOUDS, vehicles: JETS, shot: 'guided' },
  {
    title: 'Straight jets · Clouds',
    group: 'Jets',
    field: CLOUDS,
    vehicles: JETS,
    shot: 'straight',
  },
  {
    title: 'Guided jets · Open sky',
    group: 'Jets',
    field: OPEN_SKY,
    vehicles: JETS,
    shot: 'guided',
  },
  {
    title: 'Straight jets · Open sky',
    group: 'Jets',
    field: OPEN_SKY,
    vehicles: JETS,
    shot: 'straight',
  },
  {
    title: 'Jet pairs · Clouds',
    group: 'Jets',
    field: CLOUDS,
    vehicles: JETS,
    formation: [2, 2],
    shot: 'guided',
  },
  {
    title: 'One jet vs three',
    group: 'Jets',
    field: OPEN_SKY,
    vehicles: JETS,
    formation: [1, 3],
    shot: 'guided',
  },
  {
    title: 'Jet pairs · Open sky',
    group: 'Jets',
    field: OPEN_SKY,
    vehicles: JETS,
    formation: [2, 2],
    shot: 'straight',
  },
];

interface Remix extends Variation {
  readonly id: string;
  readonly rule: RemixRule;
}

const REMIXES: readonly Remix[] = [
  {
    id: 'ricochet-royale',
    title: 'Ricochet Royale',
    group: 'Remix',
    field: BUMPERS,
    shot: 'straight',
    bounce: true,
    billiard: true,
    rule: { kind: 'ricochet-royale' },
  },
  {
    id: 'blackout',
    title: 'Blackout',
    group: 'Remix',
    field: SANDBAGS,
    shot: 'guided',
    invisible: true,
    rule: { kind: 'blackout', sweepEvery: BLACKOUT_SWEEP_EVERY, sweepShows: BLACKOUT_SWEEP_SHOWS },
  },
  {
    id: 'ace-duel',
    title: 'Ace Duel',
    group: 'Remix',
    field: CLOUDS,
    vehicles: JETS,
    shot: 'guided',
    rule: {
      kind: 'ace-duel',
      fuelSeconds: ACE_FUEL_SECONDS,
      refillPerSecond: ACE_REFILL_PER_SECOND,
    },
  },
  {
    id: 'last-tank',
    title: 'Last Tank',
    group: 'Remix',
    field: QUARTER,
    shot: 'straight',
    bounce: true,
    rule: {
      kind: 'last-tank',
      roundSeconds: LAST_TANK_ROUND_SECONDS,
      roundsToWin: LAST_TANK_ROUNDS,
    },
  },
];

function toRules(
  variation: Variation,
  number: number,
  extra: { id: string; originalGame: number | null; remix: RemixRule | null },
): ChannelRules {
  return {
    id: extra.id,
    number,
    title: variation.title,
    kind: extra.remix ? 'remix' : 'original',
    group: variation.group,
    originalGame: extra.originalGame,
    field: variation.field,
    vehicles: variation.vehicles ?? TANKS,
    formation: variation.formation ?? [1, 1],
    shot: variation.shot,
    walls: variation.bounce === true ? 'bounce' : 'stop',
    billiard: variation.billiard === true,
    invisible: variation.invisible === true,
    remix: extra.remix,
  };
}

/** Every channel in dial order: originals 1–27, then Remix 28–31. */
export const CHANNELS: readonly ChannelRules[] = [
  ...ORIGINALS.map((variation, index) =>
    toRules(variation, index + 1, {
      id: `game-${index + 1}`,
      originalGame: index + 1,
      remix: null,
    }),
  ),
  ...REMIXES.map((remix, index) =>
    toRules(remix, ORIGINALS.length + index + 1, {
      id: remix.id,
      originalGame: null,
      remix: remix.rule,
    }),
  ),
];

export function channelById(id: string): ChannelRules {
  const channel = CHANNELS.find((candidate) => candidate.id === id);
  if (!channel) throw new Error(`No Tank Duel channel ${id}`);
  return channel;
}
