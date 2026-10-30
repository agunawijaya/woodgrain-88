/**
 * What a match sounds like: every engine event mapped to its cue in the
 * current look's palette, panned to where it happened, and each ship's engine
 * held while it thrusts, a fourth apart between the seats. The kit's engine
 * does the synthesis; this only decides what plays when.
 */
import type { AudioEngine, HeldSound } from '@woodgrain-88/kit';
import {
  FIELD_WIDTH,
  SEATS,
  SUBPIXELS,
  type Match,
  type MatchEvent,
  type Seat,
} from '../engine/types.ts';
import type { LookId } from '../look/look.ts';
import { ENGINE_INTERVAL, LOOK_SOUNDS, type Cue } from './sounds.ts';

export interface MatchSound {
  /** Every engine event, with the match as it stands after it. */
  hear(event: MatchEvent, match: Readonly<Match>): void;
  /** Every frame: the engines follow the thrust, their pan follows the ships. */
  follow(match: Readonly<Match>): void;
  /** The pre-match countdown: 3, 2, 1, then 0 for go. */
  countdown(count: number): void;
  /** A new look mid-match: its palette and engines from now on. */
  setLook(look: LookId): void;
  /** Engines fall silent (pause, results, leaving). */
  quiet(): void;
  dispose(): void;
}

/** How far a sound at the field's edge sits to that side: never hard left or right. */
const PAN_WIDTH = 0.6;

function panAt(match: Readonly<Match>, seat: Seat): number {
  const x = match.ships[seat].x / SUBPIXELS;
  return ((x - FIELD_WIDTH / 2) / (FIELD_WIDTH / 2)) * PAN_WIDTH;
}

export function createMatchSound(audio: AudioEngine, initialLook: LookId): MatchSound {
  let look = initialLook;
  let engines: (HeldSound | null)[] = [null, null];
  const lastFuel: number[] = [Infinity, Infinity];

  function play(cue: Cue, pan = 0, gain = 1): void {
    audio.playDef(LOOK_SOUNDS[look].cues[cue], { pan, gain });
  }

  function quiet(): void {
    for (const engine of engines) engine?.stop();
    engines = [null, null];
  }

  function startEngines(match: Readonly<Match>): void {
    quiet();
    engines = SEATS.map((seat) => {
      if (!match.ships[seat].present) return null;
      const engine = audio.hold(LOOK_SOUNDS[look].engine, { gain: 0, pan: panAt(match, seat) });
      engine.set({ pitch: seat === 0 ? 1 : ENGINE_INTERVAL });
      return engine;
    });
  }

  function follow(match: Readonly<Match>): void {
    if (engines.every((engine) => engine === null)) startEngines(match);
    for (const seat of SEATS) {
      const ship = match.ships[seat];
      const roaring = match.phase === 'playing' && ship.thrusting && !ship.cloaked;
      engines[seat]?.set({ gain: roaring ? 1 : 0, pan: panAt(match, seat) });
      // The last fuel segment gets a warning, once, as a pilot would glance at the bar.
      if (match.setup.rules.mode === 'duel' && ship.fuel === 1 && (lastFuel[seat] ?? 0) > 1) {
        play('low-fuel', panAt(match, seat));
      }
      lastFuel[seat] = ship.fuel;
    }
  }

  function hear(event: MatchEvent, match: Readonly<Match>): void {
    switch (event.kind) {
      case 'fired':
        play('fire', panAt(match, event.seat));
        break;
      case 'hit':
        play('hit', panAt(match, event.victim));
        break;
      case 'self-hit':
        if (event.exploded) play('hit', panAt(match, event.seat));
        else play('swallow', panAt(match, event.seat), 0.5);
        break;
      case 'star-crash':
        play('swallow');
        play('hit');
        break;
      case 'cloak-burnout':
        play('hit', panAt(match, event.seat));
        break;
      case 'swallowed':
        play('swallow');
        break;
      case 'refuelled':
        play('refuel');
        break;
      case 'cloak':
        play(event.on ? 'cloak-on' : 'cloak-off', panAt(match, event.seat));
        break;
      case 'reload':
        play('reload');
        break;
      case 'docked':
        play('dock', panAt(match, event.seat));
        break;
      case 'scored':
        play('point');
        break;
      case 'clock-warning':
        play('warning');
        break;
      case 'over':
        quiet();
        if (event.winner !== null) play('win');
        break;
      case 'fuel-out':
        break;
    }
  }

  return {
    hear,
    follow,
    countdown(count) {
      play(count > 0 ? 'count' : 'go');
    },
    setLook(next) {
      look = next;
      quiet();
    },
    quiet,
    dispose: quiet,
  };
}
