/**
 * Gravity Duel's game module: what the Hall loads when the cartridge goes in.
 * The heavy parts (three.js and the four looks) arrive with this chunk only.
 */
import type { GameModule } from '@woodgrain-88/kit';
import { mountGravityDuel } from './app/controller.ts';
import { createGravityDuelDemo } from './demo/demo.ts';
import { manifest } from './manifest.ts';
import { GRAVITY_MICRO_CHALLENGES } from './progress/micro.ts';
import { GRAVITY_PATCHES } from './progress/patches.ts';

export const gravityDuel: GameModule = {
  manifest,
  patches: GRAVITY_PATCHES,
  microChallenges: GRAVITY_MICRO_CHALLENGES,
  howToPlay: {
    goal: 'Turn, thrust and drift. Hit your rival with missiles the star can bend, or dock with the drifting pods.',
    controls: manifest.controls,
    tips: [
      'Fire across your motion, not along it: at top speed a forward shot folds and comes out slower than you.',
      'Lead a moving ship: aim where it will be when your missile gets there.',
      'Round the star, aim wide. The star bends the shot; let it.',
      'Count your fuel before you cloak. The cloak is not an escape if it burns your last segment.',
      'Out of missiles? Your rival may still have some. Keep moving until they run dry too.',
    ],
  },
  mount: mountGravityDuel,
  demo: createGravityDuelDemo,
};

export default gravityDuel;
