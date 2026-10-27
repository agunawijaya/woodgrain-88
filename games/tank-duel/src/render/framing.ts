/**
 * How the camera frames a channel's board: the whole arena (or the sky's
 * flying layer) with the top strip kept clear for the score plates.
 */
import type { TableFraming } from '@woodgrain-88/arena';
import type { ChannelRules } from '../engine/types.ts';
import { FLYING_HEIGHT } from './sky.ts';

const ARENA_FRAMING: TableFraming = {
  width: 65.2,
  depth: 42.4,
  tilt: 55,
  height: 2,
  margin: 0.004,
  topInset: 0.085,
};

const SKY_FRAMING: TableFraming = {
  width: 64,
  depth: 40,
  tilt: 55,
  height: 3,
  margin: 0,
  topInset: 0.085,
  elevation: FLYING_HEIGHT,
};

export function framingFor(channel: ChannelRules, topInset = 0.085): TableFraming {
  return { ...(channel.field.kind === 'sky' ? SKY_FRAMING : ARENA_FRAMING), topInset };
}
