/**
 * Gravity Duel's channels: the cartridge's 17 variations, grouped as the
 * cartridge ordered them (seven duels, six docking races, four solo docking
 * runs), and four Remix channels of our own, each opened by a patch. Channel
 * ids are stable forever: records, challenge links and progress are keyed by
 * them.
 */
import type { ChannelDef } from '@woodgrain-88/kit';
import type { Centre, Edges, Mode, Remix, VariationRules } from './engine/types.ts';
import { variation } from './engine/variations.ts';

export interface GravityChannel {
  readonly def: ChannelDef;
  readonly rules: VariationRules;
}

/** What every channel shows as icons on the dial. */
export interface ChannelFacts {
  readonly mode: Mode;
  readonly edges: Edges;
  readonly centre: Centre;
  readonly gravity: boolean;
  readonly cloak: boolean;
  readonly pods: VariationRules['pods'];
}

export const GROUPS = { duel: 'Duel', race: 'Docking race', solo: 'Solo docking' } as const;

function original(number: number, title: string, description: string): GravityChannel {
  const rules = variation(number);
  return {
    def: {
      id: `game-${number}`,
      kind: 'original',
      title,
      description,
      group: GROUPS[rules.mode],
      originalGame: [number],
    },
    rules,
  };
}

function remix(
  id: Remix['id'],
  base: number,
  title: string,
  description: string,
  unlockedBy: string,
): GravityChannel {
  return {
    def: { id, kind: 'remix', title, description, group: 'Remix', unlockedBy },
    rules: { ...variation(base), remix: { id } },
  };
}

export const CHANNELS: readonly GravityChannel[] = [
  original(1, 'Open Space', 'Two ships, walls that bounce you back, no cloak. First to ten.'),
  original(
    2,
    'Open Space · Cloak',
    'Bouncing walls. Pull down alone to vanish, at a cost in fuel.',
  ),
  original(3, 'Wraparound · Cloak', 'Fly off one edge and in at the other. Cloak with care.'),
  original(4, 'The Star', 'A star in the middle pulls on everything and swallows what it touches.'),
  original(
    5,
    'The Star · Wraparound',
    "The star's pull with open edges: bend your shots round the sun.",
  ),
  original(6, 'Starbase', 'Touch the station in the middle to refuel and rearm, at any speed.'),
  original(7, 'Starbase · Wraparound', 'The refuelling station, with open edges.'),
  original(8, 'Rendezvous', 'A pod each, drifting free. Match its speed and touch it to dock.'),
  original(9, 'One Pod', 'A single pod and two ships racing to dock with it.'),
  original(10, 'Beacon · One Each', 'A beacon swings the pods into curves. Dock with yours first.'),
  original(11, 'Beacon · Walls', "The beacon's pull, with walls that bounce you back."),
  original(12, 'One Pod · Walls', 'Race for the one pod between bouncing walls.'),
  original(13, 'One Each · Walls', 'A pod each, and walls all round.'),
  original(
    14,
    'Solo Rendezvous',
    'You and a drifting pod. How many docks before the clock runs out?',
  ),
  original(15, 'Solo Beacon', 'Dock with a pod the beacon keeps swinging round.'),
  original(16, 'Solo · Walls', 'One pod bouncing round a walled field.'),
  original(17, 'Solo Beacon · Walls', "The beacon's pull and bouncing walls, alone."),
  remix(
    'binary-stars',
    5,
    'Binary Stars',
    'Two stars orbit each other in the middle, and both of them pull.',
    'lous-orbit',
  ),
  remix(
    'comet',
    3,
    'Comet',
    'Every twenty seconds a comet crosses the field, dragging everything near it.',
    'soft-dock',
  ),
  remix(
    'asteroid-belt',
    6,
    'Asteroid Belt',
    'A ring of slow rocks round the starbase blocks shots and bounces ships.',
    'ghost-kill',
  ),
  remix(
    'last-fuel',
    5,
    'Last Fuel',
    'Eight missiles and one tank for the whole match. No reloads.',
    'fuel-miser',
  ),
];

export function channelById(id: string): GravityChannel | undefined {
  return CHANNELS.find((channel) => channel.def.id === id);
}

export function channelFacts(channel: GravityChannel): ChannelFacts {
  const { mode, edges, centre, gravity, cloak, pods } = channel.rules;
  return { mode, edges, centre, gravity, cloak, pods };
}
