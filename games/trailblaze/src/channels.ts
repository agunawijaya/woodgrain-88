/**
 * Trailblaze channels: the 14 cartridge originals as the 1977 program plays
 * them, and five Remix channels of our own, each unlocked by earning a patch.
 * Channel definitions are stable forever: records, challenge links, and
 * progression are keyed by their ids.
 */
import type { ChannelDef } from '@woodgrain-88/kit';
import { cellAt } from './engine/grid.ts';
import type { Cell, VariationRules } from './engine/types.ts';
import { variationRules } from './engine/variations.ts';

export interface TrailblazeChannel {
  readonly def: ChannelDef;
  readonly rules: VariationRules;
  /** 4 only for Four Way; every other channel is a duel. */
  readonly riders: 2 | 4;
}

/** The four facts every channel shows as icons. */
export interface ChannelFacts {
  readonly speed: 'constant' | 'speed-up';
  readonly edges: 'bordered' | 'wraparound';
  readonly steering: 4 | 8;
  readonly fire: 'none' | 'gaps' | 'erase';
}

function buildBoostLanes(): readonly Cell[] {
  const lanes: Cell[] = [];
  // Rows 5 and 14, columns 8 to 31 inclusive
  for (const row of [5, 14]) {
    for (let col = 8; col <= 31; col++) {
      lanes.push(cellAt(col, row));
    }
  }
  // Columns 13 and 26, rows 8 to 11 inclusive
  for (const col of [13, 26]) {
    for (let row = 8; row <= 11; row++) {
      lanes.push(cellAt(col, row));
    }
  }
  return lanes;
}

/**
 * Floor cells where a rider steps twice as often, symmetric about the
 * arena's centre so neither start side is favoured.
 */
export const BOOST_LANES: readonly Cell[] = buildBoostLanes();

function original(
  number: number,
  title: string,
  group: string,
  description: string,
): TrailblazeChannel {
  return {
    def: {
      id: `game-${number}`,
      kind: 'original',
      title,
      description,
      group,
      originalGame: [number],
    },
    rules: variationRules(number),
    riders: 2,
  };
}

const BASE_RULES = variationRules(1);

export const CHANNELS: readonly TrailblazeChannel[] = [
  original(1, 'Classic', 'Bordered', 'Two riders, solid walls, a steady pace. First to ten.'),
  original(
    2,
    'Classic vs Computer',
    'Bordered',
    'The old machine takes the left rider. Steady pace, solid walls.',
  ),
  original(
    3,
    'Speed-Up',
    'Bordered',
    'The pace climbs every five seconds until the arena is a blur.',
  ),
  original(4, 'Speed-Up vs Computer', 'Bordered', 'The old machine at a climbing pace.'),
  original(5, 'Eight Ways', 'Bordered', 'Diagonals open up: cut corners and slip between trails.'),
  original(6, 'Eight Ways · Speed-Up', 'Bordered', 'Diagonals and a climbing pace.'),
  original(
    7,
    'Eight Ways · Gaps',
    'Bordered',
    'Hold fire to leave holes in your trail. Diagonals, climbing pace.',
  ),
  original(
    8,
    'Wraparound',
    'Wraparound',
    'No walls at the edges: ride off one side and in at the other.',
  ),
  original(9, 'Wrap · Speed-Up', 'Wraparound', 'Open edges at a climbing pace.'),
  original(10, 'Wrap · Eight Ways', 'Wraparound', 'Open edges and diagonals at a steady pace.'),
  original(
    11,
    'Wrap · Eight · Speed-Up',
    'Wraparound',
    'Open edges, diagonals and a climbing pace.',
  ),
  original(
    12,
    'Wrap · Eight · Gaps',
    'Wraparound',
    'Everything at once: open edges, diagonals, gaps, a climbing pace.',
  ),
  original(
    13,
    'Doodle',
    'Doodle',
    'Draw with your trail; hold fire to rub it out. No walls, no score.',
  ),
  original(
    14,
    'Doodle · Eight Ways',
    'Doodle',
    'Draw in eight directions; hold fire to rub it out.',
  ),
  {
    def: {
      id: 'fading-trails',
      kind: 'remix',
      title: 'Fading Trails',
      description: 'Trails melt away eight seconds after you lay them.',
      group: 'Remix',
      unlockedBy: 'boxed-in',
    },
    rules: { ...BASE_RULES, remix: { fadeAfter: 400 } },
    riders: 2,
  },
  {
    def: {
      id: 'shrinking-arena',
      kind: 'remix',
      title: 'Shrinking Arena',
      description: 'The walls close in one cell every six seconds.',
      group: 'Remix',
      unlockedBy: 'clean-sweep',
    },
    rules: { ...BASE_RULES, remix: { shrinkEvery: 300 } },
    riders: 2,
  },
  {
    def: {
      id: 'boost-lanes',
      kind: 'remix',
      title: 'Boost Lanes',
      description: 'Glowing lanes on the floor double your speed while you ride them.',
      group: 'Remix',
      unlockedBy: 'old-machine',
    },
    rules: { ...BASE_RULES, remix: { boostLanes: BOOST_LANES } },
    riders: 2,
  },
  {
    def: {
      id: 'four-way',
      kind: 'remix',
      title: 'Four Way',
      description: 'Four riders, one from each corner. Last one riding scores.',
      group: 'Remix',
      unlockedBy: 'faster-than-lou',
    },
    rules: BASE_RULES,
    riders: 4,
  },
  {
    def: {
      id: 'ghost-trails',
      kind: 'remix',
      title: 'Ghost Trails',
      description: 'Trails turn invisible after three seconds but stay solid. Ride from memory.',
      group: 'Remix',
      unlockedBy: 'faster-than-lou',
    },
    rules: { ...BASE_RULES, remix: { ghostAfter: 150 } },
    riders: 2,
  },
];

export function channelById(id: string): TrailblazeChannel | undefined {
  return CHANNELS.find((channel) => channel.def.id === id);
}

export function channelFacts(channel: TrailblazeChannel): ChannelFacts {
  return {
    speed: channel.rules.speedUp ? 'speed-up' : 'constant',
    edges: channel.rules.edges,
    steering: channel.rules.steering,
    fire: channel.rules.fire,
  };
}
