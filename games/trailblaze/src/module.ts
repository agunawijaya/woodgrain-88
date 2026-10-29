/**
 * Trailblaze's game module: what the Hall loads when the cartridge goes in.
 * The heavy parts (three.js and the four looks) arrive with this chunk only.
 */
import type { GameModule } from '@woodgrain-88/kit';
import { mountTrailblaze } from './app/controller.ts';
import { createTrailblazeDemo } from './demo/demo.ts';
import { manifest } from './manifest.ts';
import { TRAILBLAZE_MICRO_CHALLENGES } from './progress/micro.ts';
import { TRAILBLAZE_PATCHES } from './progress/patches.ts';

export const trailblaze: GameModule = {
  manifest,
  patches: TRAILBLAZE_PATCHES,
  microChallenges: TRAILBLAZE_MICRO_CHALLENGES,
  howToPlay: {
    goal: 'Steer a rider that never stops. Every cell it leaves becomes a wall: make your rival hit one first.',
    controls: manifest.controls,
    tips: [
      'Turn early at speed: the faster it gets, the more cells pass before your hands react.',
      'Cut across your rival a few cells ahead of their bike, never right in front of it.',
      'Claim the big side first, then fill your own space tightly along the walls.',
      'On wraparound channels the edges are open: a rival can come at you from behind.',
      'Switch A makes turning straight back crash you; switch B ignores it.',
    ],
  },
  mount: mountTrailblaze,
  demo: createTrailblazeDemo,
};

export default trailblaze;
