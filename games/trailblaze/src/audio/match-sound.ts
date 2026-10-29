/**
 * What a match sounds like: every session event mapped to its cue in the
 * current look's palette, panned to where it happened, and one hum per rider
 * that climbs with the speed-up and stops when the rider crashes. The kit's
 * engine does the synthesis; this only decides what plays when.
 */
import type { AudioEngine, HeldSound } from '@woodgrain-88/kit';
import { columnOf } from '../engine/grid.ts';
import { COLUMNS, type Cell, type Match, type Seat } from '../engine/types.ts';
import type { LookId } from '../look/look.ts';
import type { SessionEvent } from '../session/match-session.ts';
import { HUM_PITCH, LOOK_SOUNDS, type Cue } from './sounds.ts';

export interface MatchSound {
  /** Every session event, with the match as it stands after it. */
  hear(event: SessionEvent, match: Readonly<Match>): void;
  /** The pre-match countdown: 3, 2, 1, then 0 for go. */
  countdown(count: number): void;
  /** A new look mid-match: its palette and hums from now on. */
  setLook(look: LookId): void;
  /** Hums fall silent (pause, results, leaving). */
  quiet(): void;
  dispose(): void;
}

/** How far a sound at the arena's edge sits to that side: never hard left or right. */
const PAN_WIDTH = 0.6;
/** Hums sit under everything else. */
const HUM_GAIN = 0.8;

/** Where a rider is; Four Way matches have riders a duel does not. */
function riderCell(match: Readonly<Match>, seat: Seat): Cell {
  return match.riders.at(seat)?.cell ?? 0;
}

function panOf(cell: Cell): number {
  const middle = (COLUMNS - 1) / 2;
  return ((columnOf(cell) - middle) / middle) * PAN_WIDTH;
}

export function createMatchSound(audio: AudioEngine, initialLook: LookId): MatchSound {
  let look = initialLook;
  let speedStage = 0;
  const hums = new Map<Seat, HeldSound>();

  function play(cue: Cue, pan = 0): void {
    audio.playDef(LOOK_SOUNDS[look].cues[cue], { pan });
  }

  function stopHum(seat: Seat): void {
    hums.get(seat)?.stop();
    hums.delete(seat);
  }

  function quiet(): void {
    for (const seat of [...hums.keys()]) stopHum(seat);
  }

  function startHums(match: Readonly<Match>): void {
    quiet();
    const riding = match.setup.players === 1 ? 1 : match.riders.length;
    for (let seat = 0; seat < riding; seat++) {
      const rider = match.riders.at(seat);
      if (!rider || rider.crashed) continue;
      hums.set(
        seat as Seat,
        audio.hold(LOOK_SOUNDS[look].hum, {
          gain: HUM_GAIN,
          pan: panOf(rider.cell),
        }),
      );
    }
    for (const hum of hums.values()) hum.set({ pitch: HUM_PITCH[speedStage] ?? 1 });
  }

  /** A gap: the rider moved but left no trail behind, because fire was held. */
  function gapsIn(event: Extract<SessionEvent, { type: 'step' }>): Seat[] {
    const laidBy = new Set(event.laid.map((laid) => laid.seat));
    return event.moves.filter((move) => !laidBy.has(move.seat)).map((move) => move.seat);
  }

  return {
    hear(event, match) {
      switch (event.type) {
        case 'round':
          speedStage = 0;
          startHums(match);
          break;
        case 'step':
          for (const move of event.moves) hums.get(move.seat)?.set({ pan: panOf(move.to) });
          if (match.setup.rules.fire === 'gaps') {
            for (const seat of gapsIn(event)) play('gap', panOf(riderCell(match, seat)));
          }
          break;
        case 'turn':
          play('turn', panOf(riderCell(match, event.seat)));
          break;
        case 'speed':
          speedStage = event.stage;
          for (const hum of hums.values()) hum.set({ pitch: HUM_PITCH[event.stage] ?? 1 });
          break;
        case 'crash':
          for (const crash of event.crashes) {
            stopHum(crash.seat);
            play('crash', panOf(crash.cell));
          }
          break;
        case 'trap':
          play('trap', panOf(event.seal));
          break;
        case 'point':
          play('point');
          break;
        case 'over':
          quiet();
          if (event.winner !== null) play('win');
          break;
        case 'shrink':
          break;
      }
    },
    countdown(count) {
      play(count > 0 ? 'count' : 'go');
    },
    setLook(next) {
      look = next;
      if (hums.size === 0) return;
      const riding = [...hums.keys()];
      quiet();
      for (const seat of riding) {
        hums.set(seat, audio.hold(LOOK_SOUNDS[look].hum, { gain: HUM_GAIN }));
      }
      for (const hum of hums.values()) hum.set({ pitch: HUM_PITCH[speedStage] ?? 1 });
    },
    quiet,
    dispose() {
      quiet();
    },
  };
}
