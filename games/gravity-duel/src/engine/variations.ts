/**
 * The cartridge's 17 variations as rule switches: seven duels, six docking
 * races for two, and four solo docking runs. Our Remix channels are built on
 * top of these in remix.ts.
 */
import type { Centre, Edges, Mode, VariationRules } from './types.ts';

function duel(number: number, edges: Edges, centre: Centre, cloak: boolean): VariationRules {
  return { number, mode: 'duel', edges, centre, gravity: centre === 'star', cloak, pods: 'none' };
}

function docking(
  number: number,
  mode: Exclude<Mode, 'duel'>,
  pods: 'shared' | 'own',
  edges: Edges,
  beacon: boolean,
): VariationRules {
  return {
    number,
    mode,
    edges,
    centre: beacon ? 'beacon' : 'none',
    gravity: beacon,
    cloak: false,
    pods,
  };
}

export const VARIATIONS: readonly VariationRules[] = [
  duel(1, 'bounce', 'none', false),
  duel(2, 'bounce', 'none', true),
  duel(3, 'wrap', 'none', true),
  duel(4, 'bounce', 'star', true),
  duel(5, 'wrap', 'star', true),
  duel(6, 'bounce', 'starbase', true),
  duel(7, 'wrap', 'starbase', true),
  docking(8, 'race', 'own', 'wrap', false),
  docking(9, 'race', 'shared', 'wrap', false),
  docking(10, 'race', 'own', 'wrap', true),
  docking(11, 'race', 'own', 'bounce', true),
  docking(12, 'race', 'shared', 'bounce', false),
  docking(13, 'race', 'own', 'bounce', false),
  docking(14, 'solo', 'shared', 'wrap', false),
  docking(15, 'solo', 'shared', 'wrap', true),
  docking(16, 'solo', 'shared', 'bounce', false),
  docking(17, 'solo', 'shared', 'bounce', true),
];

/** A cartridge variation by its number, 1–17. */
export function variation(number: number): VariationRules {
  const rules = VARIATIONS[number - 1];
  if (!rules) throw new RangeError(`no variation ${number}`);
  return rules;
}
