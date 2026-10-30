/**
 * "How the Kid flew it": a rolling record of the last 4 seconds of a match a
 * Kid flew, at 25 pictures a second, so that when the Kid was hit or
 * scored, the results panel can show a strip of 6 frames from the last 3
 * seconds before that moment, each with the Kid's planned shot and its
 * believed fuel.
 */
import type { KidPilot, PilotMoment } from '../ai/pilot.ts';
import type { Match, Seat } from '../engine/types.ts';
import { sceneFrame } from '../session/frame.ts';

export interface KidReplayFrame {
  /** Milliseconds before the moment this strip ends on. */
  readonly beforeMs: number;
  /** The field as it stood, for a small canvas sketch (ships, missiles, the centre). */
  readonly ships: readonly { readonly x: number; readonly z: number; readonly heading: number }[];
  readonly missiles: readonly { readonly x: number; readonly z: number }[];
  /** The Kid's planned shot heading at this frame, for a dotted aim line; null when not attacking. */
  readonly aimHeading: number | null;
  /** What the Kid believed its own fuel to be, 0–8; null in docking. */
  readonly believedFuel: number | null;
  /** The true fuel at this frame, for the panel's "against the true count". */
  readonly trueFuel: number | null;
}

export interface KidReplay {
  /** Once a tick, after the match has moved. */
  watch(match: Readonly<Match>): void;
  /** The Kid was hit or scored this tick: keep the strip ending here. */
  moment(match: Readonly<Match>): void;
  /** The strip of the Kid's latest kept moment, or its last 3 seconds if it never had one. */
  frames(): readonly KidReplayFrame[];
}

const TICKS_PER_SECOND = 50;
const SNAPSHOT_EVERY_TICKS = TICKS_PER_SECOND / 25; // 25 a second
const HISTORY_SECONDS = 4;
const HISTORY_SIZE = Math.round((HISTORY_SECONDS * TICKS_PER_SECOND) / SNAPSHOT_EVERY_TICKS);
const STRIP_FRAMES = 6;
const STRIP_SECONDS = 3;

interface Snapshot {
  readonly tick: number;
  readonly frame: KidReplayFrame;
}

export function createKidReplay(pilot: KidPilot): KidReplay {
  const seat: Seat = pilot.seat;
  const recent: Snapshot[] = [];
  let kept: readonly KidReplayFrame[] | null = null;

  function latestMoment(moments: readonly PilotMoment[]): PilotMoment | undefined {
    return moments.at(-1);
  }

  function snapshot(match: Readonly<Match>): Snapshot {
    const frame = sceneFrame(match, 1, [0, 0]);
    const ships = frame.ships
      .filter((pose): pose is NonNullable<typeof pose> => pose !== null)
      .map((pose) => ({ x: pose.x, z: pose.z, heading: pose.heading }));
    const missiles = frame.missiles
      .filter((pose): pose is NonNullable<typeof pose> => pose !== null)
      .map((pose) => ({ x: pose.x, z: pose.z }));
    const own = latestMoment(pilot.moments);
    const duel = match.setup.rules.mode === 'duel';
    return {
      tick: match.tick,
      frame: {
        beforeMs: 0,
        ships,
        missiles,
        aimHeading: own?.intent === 'attack' ? (own.face * Math.PI) / 8 : null,
        believedFuel: duel ? (own?.beliefs.fuel ?? null) : null,
        trueFuel: duel ? match.ships[seat].fuel : null,
      },
    };
  }

  function stripEndingWith(last: Snapshot): KidReplayFrame[] {
    const windowStart = last.tick - STRIP_SECONDS * TICKS_PER_SECOND;
    const inWindow = recent.filter((shot) => shot.tick >= windowStart && shot.tick < last.tick);
    const picked = [...inWindow.slice(-(STRIP_FRAMES - 1)), last];
    return picked.map((shot) => ({ ...shot.frame, beforeMs: (last.tick - shot.tick) * 20 }));
  }

  return {
    watch(match) {
      if (match.tick % SNAPSHOT_EVERY_TICKS !== 0) return;
      recent.push(snapshot(match));
      if (recent.length > HISTORY_SIZE) recent.shift();
    },
    moment(match) {
      kept = stripEndingWith(snapshot(match));
    },
    frames() {
      if (kept) return kept;
      const last = recent.at(-1);
      return last ? stripEndingWith(last) : [];
    },
  };
}
