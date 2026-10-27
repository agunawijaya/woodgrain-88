/**
 * The match as you hear it. Engine events become one-shot sounds (shots,
 * pings rising per bounce, explosions in each side's own pitch, the click of
 * every turning step); each vehicle in view hums its engine or propeller,
 * pitched by its speed and panned to where it is on the table. A vehicle the
 * rules hide makes no sound at all, so the speakers never give away what the
 * screen does not show.
 */
import type { AudioEngine, HeldSound, HeldVoice } from '@woodgrain-88/kit';
import { AIRCRAFT_SPEEDS, TANK_SPEED, WARNING_SECONDS } from '../engine/rules.ts';
import type { MatchEvent, MatchState, Side, VehicleState } from '../engine/types.ts';
import { ARENA_WIDTH } from '../arenas/format.ts';
import {
  JET_ROAR,
  PING_RISE_PER_BOUNCE,
  PROPELLER,
  SIDE_EXPLOSION_PITCH,
  TANK_ENGINE,
  TANK_SOUNDS,
} from './sounds.ts';

export interface MatchSoundOptions {
  readonly audio: AudioEngine;
  /** Whether the rules let a vehicle be seen (and so heard) right now. */
  readonly revealed: (state: MatchState, vehicle: VehicleState) => boolean;
  /** The player's mix, 0–1 each, read every frame so a change in settings applies at once. */
  readonly volumes: () => { readonly engines: number; readonly effects: number };
}

export interface MatchSound {
  /** Sounds for one engine step's events. */
  step(state: MatchState, events: readonly MatchEvent[]): void;
  /** Keeps the hums in step with the vehicles; call once per drawn frame. */
  frame(state: MatchState): void;
  /** After the chrome silenced everything (pause), start the hums afresh. */
  restart(): void;
  dispose(): void;
}

/** How far to either side a vehicle at the board's edge is panned. */
const PAN_REACH = 0.7;

function panAt(x: number): number {
  return (Math.max(0, Math.min(ARENA_WIDTH, x)) / ARENA_WIDTH) * 2 * PAN_REACH - PAN_REACH;
}

function humFor(vehicle: VehicleState): readonly HeldVoice[] {
  if (vehicle.vehicle === 'tank') return TANK_ENGINE;
  return vehicle.vehicle === 'jet' ? JET_ROAR : PROPELLER;
}

/** 0 at rest (or slowest), 1 at full speed: what the engine note follows. */
function effort(vehicle: VehicleState): number {
  if (vehicle.vehicle === 'tank') return vehicle.speed / TANK_SPEED;
  const [slowest, , fastest] = AIRCRAFT_SPEEDS[vehicle.vehicle];
  return Math.max(0, Math.min(1, (vehicle.speed - slowest) / (fastest - slowest)));
}

export function createMatchSound(options: MatchSoundOptions): MatchSound {
  const { audio } = options;
  audio.register(TANK_SOUNDS);
  const hums = new Map<number, HeldSound>();
  let lastTick = Infinity;

  function effect(name: string, pan: number, pitch = 1, gain = 1): void {
    audio.play(name, { pan, pitch, gain: gain * options.volumes().effects });
  }

  function leader(state: MatchState, side: Side): VehicleState | undefined {
    return state.vehicles.find((vehicle) => vehicle.side === side && vehicle.slot === 0);
  }

  function soundFor(state: MatchState, event: MatchEvent): void {
    switch (event.kind) {
      case 'fired': {
        const shooter = leader(state, event.side);
        const name =
          event.shot === 'machine-gun'
            ? 'machine-gun'
            : shooter?.vehicle === 'tank'
              ? 'tank-fire'
              : 'air-fire';
        effect(name, panAt(event.at.x));
        return;
      }
      case 'bounced':
        effect('ricochet', panAt(event.at.x), PING_RISE_PER_BOUNCE ** (event.bounces - 1));
        return;
      case 'hit':
      case 'own-hit': {
        const victim = event.kind === 'hit' ? event.victim : event.side;
        effect('explosion', panAt(event.at.x), SIDE_EXPLOSION_PITCH[victim]);
        effect('spin', panAt(event.at.x), SIDE_EXPLOSION_PITCH[victim], 0.8);
        return;
      }
      case 'bumped': {
        const vehicle = state.vehicles.find((each) => each.id === event.vehicle);
        if (vehicle && options.revealed(state, vehicle)) effect('bump', panAt(event.at.x));
        return;
      }
      case 'turned': {
        const vehicle = state.vehicles.find((each) => each.id === event.vehicle);
        if (vehicle?.slot === 0 && options.revealed(state, vehicle))
          effect('turn-step', panAt(vehicle.position.x));
        return;
      }
      case 'radar':
        effect('radar', 0);
        return;
      case 'match-over':
        if (event.winner !== null) effect('fanfare', 0);
        return;
      default:
        return;
    }
  }

  function fuseTicks(state: MatchState): void {
    if (state.over || state.clock > WARNING_SECONDS) return;
    const second = Math.ceil(state.clock);
    if (second < lastTick) effect('fuse-tick', 0);
    lastTick = second;
  }

  function stopHums(): void {
    for (const hum of hums.values()) hum.stop();
    hums.clear();
  }

  return {
    step(state, events) {
      for (const event of events) soundFor(state, event);
      fuseTicks(state);
    },
    frame(state) {
      if (!audio.unlocked) return;
      const engines = options.volumes().engines;
      for (const vehicle of state.vehicles) {
        if (vehicle.slot !== 0) continue;
        let hum = hums.get(vehicle.id);
        if (!hum) {
          hum = audio.hold(humFor(vehicle), { gain: 0 });
          hums.set(vehicle.id, hum);
        }
        const heard = options.revealed(state, vehicle) && !state.over;
        const push = effort(vehicle);
        hum.set({
          pitch: 0.8 + push * 0.7,
          gain: heard ? (0.3 + push * 0.5) * engines * 0.5 : 0,
          pan: panAt(vehicle.position.x),
        });
      }
    },
    restart() {
      hums.clear();
    },
    dispose() {
      stopHums();
    },
  };
}
