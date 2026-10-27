/**
 * Hot & Cold's channels: the cartridge's ten variations, as the 1978 program
 * plays them (see NOTES.md), and four Remix channels of our own, each opened
 * by a patch. A channel id is stable forever; records, challenge links and
 * progress are keyed by it.
 */
import type { ChannelDef } from '@woodgrain-88/kit';
import { cartridgeRules, type Rules } from './engine/rules.ts';

export interface HotColdChannel {
  readonly def: ChannelDef;
  readonly rules: Rules;
  /** Notebook clues fade from the field after this many seconds (Thin Ice). */
  readonly clueFadeSeconds?: number;
}

function original(
  number: number,
  title: string,
  group: string,
  description: string,
): HotColdChannel {
  return {
    def: {
      id: `game-${number}`,
      kind: 'original',
      title,
      description,
      group,
      originalGame: [number],
    },
    rules: cartridgeRules(number),
  };
}

const RACE = cartridgeRules(1);

export const CHANNELS: readonly HotColdChannel[] = [
  original(
    1,
    'Race',
    'Race',
    'Both explorers at once: first to the flag scores, first to 15 wins.',
  ),
  original(2, 'Turns', 'Turns', 'One check each in turn, board-game style. First to 15 flags.'),
  original(
    3,
    'Turns · Bouncing',
    'Turns',
    'Turns, and every miss nudges the flag; it bounces off the edges.',
  ),
  original(
    4,
    'Turns · Wrapping',
    'Turns',
    'The flag wanders off one edge and back in at the other. First to 75.',
  ),
  original(
    5,
    'Hunt for Hunt',
    'Hunt for hunt',
    'Take whole hunts in turn; every check counts. Fewest checks wins.',
  ),
  original(
    6,
    'Hunt · Bouncing',
    'Hunt for hunt',
    'Hunt for hunt with a flag that bounces a square at every miss.',
  ),
  original(
    7,
    'Hunt · Wrapping',
    'Hunt for hunt',
    'Hunt for hunt with a flag that wraps round the field.',
  ),
  original(8, 'Clock', 'Clock', 'Alone against a 75-tick clock: catch as many flags as you can.'),
  original(
    9,
    'Clock · Bouncing',
    'Clock',
    'Against the clock, with a flag that bounces at every miss.',
  ),
  original(
    10,
    'Clock · Wrapping',
    'Clock',
    'Against the clock, with a flag that wraps round the field.',
  ),
  {
    def: {
      id: 'two-flags',
      kind: 'remix',
      title: 'Two Flags',
      description: 'Two flags hide at once and every clue points to the nearer one.',
      group: 'Remix',
      unlockedBy: 'pure-memory',
    },
    rules: { ...RACE, flags: 2 },
  },
  {
    def: {
      id: 'minefield',
      kind: 'remix',
      title: 'Minefield',
      description: 'Twice the bombs, fewer arrows: tread carefully or walk home a lot.',
      group: 'Remix',
      unlockedBy: 'bomb-dodger',
    },
    rules: { ...RACE, composition: { bombs: 16, distances: 27 } },
  },
  {
    def: {
      id: 'thin-ice',
      kind: 'remix',
      title: 'Thin Ice',
      description: 'Clues stay on the field for ten seconds, then melt away.',
      group: 'Remix',
      unlockedBy: 'sharp-eyes',
    },
    rules: RACE,
    clueFadeSeconds: 10,
  },
  {
    def: {
      id: 'drift-storm',
      kind: 'remix',
      title: 'Drift Storm',
      description: 'The flag drifts two squares at every miss, bouncing off the edges.',
      group: 'Remix',
      unlockedBy: 'old-fox',
    },
    rules: { ...RACE, motion: 'bounce', flagSteps: 2 },
  },
];

export function channelById(id: string): HotColdChannel {
  return (
    CHANNELS.find((channel) => channel.def.id === id) ??
    CHANNELS[0] ??
    original(1, 'Race', 'Race', '')
  );
}

/** A channel's place on the dial, from 1: the ten variations, then the Remix channels. */
export function channelNumber(id: string): number {
  return CHANNELS.findIndex((channel) => channel.def.id === id) + 1;
}

/** The daily field: one still flag, one hunt, the same field for everyone. */
export const DAILY_RULES: Rules = { ...cartridgeRules(5), singleHunt: true };
