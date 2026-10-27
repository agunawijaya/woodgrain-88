/**
 * The match as you hear it: each engine event becomes the look's cue for it,
 * panned to the square it happened on. A distance plays higher the nearer
 * the flag; the clock ticks through its last ten.
 */
import type { AudioEngine } from '@woodgrain-88/kit';
import { COLUMNS, spotOf, type Square } from '../engine/grid.ts';
import type { MatchEvent } from '../engine/match.ts';
import type { LookId } from '../look/look.ts';
import { cueName, distancePitch, HOT_COLD_SOUNDS, type Cue } from './sounds.ts';

export interface MatchSoundOptions {
  readonly audio: AudioEngine;
  readonly look: LookId;
  /** The player's effects volume, 0–1, read at every sound so a change applies at once. */
  readonly volume: () => number;
}

export interface MatchSound {
  hear(events: readonly MatchEvent[]): void;
}

/** How far to either side a square on the field's edge is panned. */
const PAN_REACH = 0.6;
/** The clock ticks aloud from here down. */
const TICKING_FROM = 10;

function panAt(square: Square): number {
  return (spotOf(square).column / (COLUMNS - 1)) * 2 * PAN_REACH - PAN_REACH;
}

export function createMatchSound(options: MatchSoundOptions): MatchSound {
  const { audio, look } = options;
  audio.register(HOT_COLD_SOUNDS);

  function play(cue: Cue, square: Square | null, pitch = 1): void {
    audio.play(cueName(look, cue), {
      pan: square === null ? 0 : panAt(square),
      pitch,
      gain: options.volume(),
    });
  }

  return {
    hear(events) {
      for (const event of events) {
        switch (event.type) {
          case 'step':
            play('step', event.to);
            break;
          case 'blocked':
            play('bump', event.at);
            break;
          case 'check': {
            const { square, clue } = event.check;
            play('check', square);
            // The flag's own sound is the fanfare, which the capture plays.
            if (clue.kind === 'distance') play('distance', square, distancePitch(clue.distance));
            else if (clue.kind === 'arrow') play('arrow', square);
            else if (clue.kind === 'bomb') play('bomb', square);
            break;
          }
          case 'home':
            if (event.to !== null) play('home', event.to);
            break;
          case 'capture':
            play('flag', event.square);
            break;
          case 'turn':
          case 'final-turn':
            play('turn', null);
            break;
          case 'clock':
            if (event.remaining <= TICKING_FROM) play('tick', null);
            break;
          case 'round':
          case 'release':
          case 'score':
          case 'over':
            break;
        }
      }
    },
  };
}
