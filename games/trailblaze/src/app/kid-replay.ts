/**
 * "How Rosa saw it": the last two seconds before a Kid's crash, as the
 * results screen shows them. While the Kid rides, the board is copied every
 * half second with where the Kid's head was and how far round it looked; the
 * Kid's reflex log says what it fumbled or missed in between. At the Kid's
 * crash the newest copies become the four frames of the strip.
 */
import type { KidRider } from '../ai/kid.ts';
import type { Match } from '../engine/types.ts';
import type { KidReplayFrame } from '../screens/results.ts';

type Mark = KidReplayFrame['marks'][number];

interface Snapshot {
  readonly tick: number;
  readonly cells: Int8Array;
  readonly head: number;
  /** Where the reflex log stood when the copy was taken. */
  readonly logLength: number;
}

export interface KidReplay {
  /** Once a tick, after the match has moved. */
  watch(match: Readonly<Match>): void;
  /** The match has just crashed someone: keep the strip if the Kid was among them. */
  crashed(match: Readonly<Match>, seats: readonly number[]): void;
  /** The strip of the Kid's last crash, or its last two seconds if it never crashed. */
  frames(): readonly KidReplayFrame[];
}

/** A copy every half second, four of them: 1.5 s, 1 s and 0.5 s before, and the moment itself. */
const EVERY_TICKS = 25;
const FRAMES = 4;
const TICK_MS = 20;
const MARKED: readonly Mark[] = ['slipped-late', 'slipped-wrong', 'missed'];

export function createKidReplay(rider: KidRider): KidReplay {
  const recent: Snapshot[] = [];
  let kept: readonly KidReplayFrame[] | null = null;

  function snapshot(match: Readonly<Match>): Snapshot {
    return {
      tick: match.tick,
      cells: match.cells.slice(),
      head: match.riders[rider.seat]?.cell ?? 0,
      logLength: rider.reflex.log.length,
    };
  }

  function stripEndingWith(last: Snapshot): KidReplayFrame[] {
    const shots = [...recent.filter((shot) => shot.tick < last.tick).slice(-(FRAMES - 1)), last];
    return shots.map((shot, index) => {
      const from =
        index === 0 ? Math.max(0, shot.logLength - 8) : (shots[index - 1]?.logLength ?? 0);
      const marks = rider.reflex.log
        .slice(from, shot.logLength)
        .map((entry) => entry.kind)
        .filter((kind): kind is Mark => MARKED.includes(kind as Mark));
      return {
        atMs: (last.tick - shot.tick) * TICK_MS,
        cells: shot.cells,
        kidHead: shot.head,
        awareness: rider.reflex.profile.awareness,
        marks,
      };
    });
  }

  return {
    watch(match) {
      if (match.phase !== 'running' || match.tick % EVERY_TICKS !== 0) return;
      recent.push(snapshot(match));
      if (recent.length > FRAMES) recent.shift();
    },
    crashed(match, seats) {
      if (!seats.includes(rider.seat)) return;
      kept = stripEndingWith(snapshot(match));
    },
    frames() {
      if (kept) return kept;
      const last = recent.at(-1);
      return last ? stripEndingWith(last) : [];
    },
  };
}
