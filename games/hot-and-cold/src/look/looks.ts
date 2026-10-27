/**
 * The three looks by id, and the stage each one is drawn on. A look brings
 * its own light, finish and exposure, so changing look means a new stage;
 * changing appearance does not.
 */
import { createStage, type Quality, type Stage } from '@woodgrain-88/arena';
import type { Appearance } from '@woodgrain-88/kit';
import { Color } from 'three';
import { POLAR_LOOK } from '../looks/polar/look.ts';
import { RADAR_LOOK } from '../looks/radar/look.ts';
import { TABLETOP_LOOK } from '../looks/tabletop/look.ts';
import type { LookDefinition, LookId } from './look.ts';

export const LOOKS: Readonly<Record<LookId, LookDefinition>> = {
  polar: POLAR_LOOK,
  tabletop: TABLETOP_LOOK,
  radar: RADAR_LOOK,
};

export const LOOK_IDS: readonly LookId[] = ['polar', 'tabletop', 'radar'];

export interface LookStageOptions {
  readonly host: HTMLElement;
  readonly look: LookDefinition;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly preserveDrawingBuffer?: boolean;
  readonly size?: { readonly width: number; readonly height: number };
}

export function createLookStage(options: LookStageOptions): Stage {
  const { look } = options;
  const stage = createStage({
    host: options.host,
    appearance: options.appearance,
    quality: options.quality,
    framing: look.framing,
    ...(options.preserveDrawingBuffer ? { preserveDrawingBuffer: true } : {}),
    ...(options.size ? { size: options.size } : {}),
    ...(look.mood ? { mood: look.mood } : {}),
    ...(look.finish ? { finish: look.finish } : {}),
    ...(look.reflections ? { reflections: look.reflections } : {}),
    ...(look.exposure ? { exposure: look.exposure } : {}),
  });
  paintBackground(stage, look, options.appearance);
  return stage;
}

/** The look's backdrop colour for an appearance; call again after `stage.setAppearance`. */
export function paintBackground(stage: Stage, look: LookDefinition, appearance: Appearance): void {
  stage.scene.background = new Color(look.background(appearance));
}
