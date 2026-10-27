/**
 * Hot & Cold's game module: what the Hall loads when the cartridge goes in.
 * The heavy parts (three.js and the three looks) arrive with this chunk only.
 */
import type { GameModule } from '@woodgrain-88/kit';
import { mountHotAndCold } from './app/controller.ts';
import { createHotColdDemo } from './demo/demo.ts';
import { manifest } from './manifest.ts';
import { HOT_COLD_MICRO_CHALLENGES } from './progress/micro.ts';
import { HOT_COLD_PATCHES } from './progress/patches.ts';

export const hotAndCold: GameModule = {
  manifest,
  patches: HOT_COLD_PATCHES,
  microChallenges: HOT_COLD_MICRO_CHALLENGES,
  howToPlay: {
    goal: 'Find the hidden flag. Walk to a square and check it: it shows how far away the flag is, which way it lies, or a bomb that sends you home.',
    controls: manifest.controls,
    tips: [
      'A distance counts king’s steps, diagonals included: a 1 means the flag is right next to it.',
      'Arrows point along a row or column only when the flag shares it; otherwise they point diagonally.',
      'Two clues together narrow it down fast: where their rings and wedges cross, the flag must be.',
      'On the bouncing and wrapping channels the flag moves a square every time anyone misses.',
      'Classic Memory shows a clue only while you hold the button, as in 1978. Notebook keeps them all.',
    ],
  },
  mount: mountHotAndCold,
  demo: createHotColdDemo,
};
