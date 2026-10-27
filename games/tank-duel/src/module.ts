/**
 * Tank Duel's game module: what the Hall loads when the cartridge goes in.
 * The heavy parts (three.js, the diorama) arrive with this chunk only.
 */
import type { GameModule } from '@woodgrain-88/kit';
import { mountTankDuel } from './app/controller.ts';
import { createTankDemo } from './demo/demo.ts';
import { manifest } from './manifest.ts';
import { TANK_MICRO_CHALLENGES } from './progress/micro.ts';
import { TANK_PATCHES } from './progress/patches.ts';

export const tankDuel: GameModule = {
  manifest,
  patches: TANK_PATCHES,
  microChallenges: TANK_MICRO_CHALLENGES,
  howToPlay: {
    goal: 'Hit the other tank, plane or jet more times than it hits you before the fuse burns down.',
    controls: manifest.controls,
    tips: [
      'Guided shells follow your turning: fire, then steer them round the cover.',
      'Shells that bounce come back off walls. On billiard channels only a banked shot scores.',
      'Invisible tanks show themselves when they fire, bump into something or get hit.',
      'A handicap (switch A on the console) means shorter shots and slower aircraft, to even out a match.',
    ],
  },
  mount: mountTankDuel,
  demo: createTankDemo,
};
