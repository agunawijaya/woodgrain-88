/**
 * The four looks by id, and the stage each one is drawn on. A look brings its
 * own light, finish and exposure, so changing look means a new stage; changing
 * appearance does not.
 */
import { createStage, type Quality, type Stage } from '@woodgrain-88/arena';
import type { Appearance } from '@woodgrain-88/kit';
import { Color } from 'three';
import { BRASS_LOOK } from '../looks/brass/look.ts';
import { DEEP_LOOK } from '../looks/deep/look.ts';
import { PAPER_LOOK } from '../looks/paper/look.ts';
import { WHIRL_LOOK } from '../looks/whirl/look.ts';
import type { LookDefinition, LookId } from './look.ts';

export const LOOKS: Readonly<Record<LookId, LookDefinition>> = {
  deep: DEEP_LOOK,
  brass: BRASS_LOOK,
  paper: PAPER_LOOK,
  whirl: WHIRL_LOOK,
};

export const LOOK_IDS: readonly LookId[] = ['deep', 'brass', 'paper', 'whirl'];

export function lookById(id: LookId): LookDefinition {
  return LOOKS[id];
}

export interface LookStageOptions {
  readonly host: HTMLElement;
  readonly look: LookDefinition;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly preserveDrawingBuffer?: boolean;
}

export function createLookStage(options: LookStageOptions): Stage {
  const { look } = options;
  const stage = createStage({
    host: options.host,
    appearance: options.appearance,
    quality: options.quality,
    framing: look.framing,
    ...(options.preserveDrawingBuffer ? { preserveDrawingBuffer: true } : {}),
    ...(look.mood ? { mood: look.mood } : {}),
    ...(look.finish ? { finish: look.finish } : {}),
    ...(look.reflections ? { reflections: look.reflections } : {}),
    ...(look.exposure ? { exposure: look.exposure } : {}),
  });
  stage.scene.background = new Color(look.background(options.appearance));
  return stage;
}
