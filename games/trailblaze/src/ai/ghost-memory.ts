/**
 * Memory for Ghost Trails: riders form straight wall runs as they lay trail,
 * commit them as facts when turning or when the round ends, and recall them
 * into a perception mask so a Kid can navigate trails that have turned invisible.
 */
import {
  createKidMemory,
  salienceOf,
  type FactAdapter,
  type KidMemory,
  type MemoryProfile,
  type Rng,
} from '@woodgrain-88/kit';
import { stepFrom } from '../engine/grid.ts';
import {
  CELL_COUNT,
  type Cell,
  type Heading,
  type Laid,
  type Match,
  type Seat,
} from '../engine/types.ts';

/** A straight run of trail as a person remembers it: where it starts, which way, how long. */
export interface WallRun {
  readonly from: Cell;
  readonly heading: Heading;
  readonly length: number;
}

export interface GhostMemory {
  readonly memory: KidMemory<WallRun>;
  /** Every step's laid cells, so runs are formed as the riders lay them. */
  hear(laid: readonly Laid[], match: Readonly<Match>, nowSeconds: number, rng: Rng): void;
  /** Marks remembered runs' cells in `mask` (1 = believed blocked), as recalled now. */
  recallInto(mask: Uint8Array, match: Readonly<Match>, nowSeconds: number, rng: Rng): void;
  reset(): void;
}

const HEADINGS_COMPASS: readonly Heading[] = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
];

export const WALL_RUN_ADAPTER: FactAdapter<WallRun> = {
  key(run: WallRun): string {
    return `${run.from}:${run.heading}`;
  },
  distort(run: WallRun, rng: Rng): WallRun {
    if (rng.chance(0.5)) {
      const idx = HEADINGS_COMPASS.indexOf(run.heading);
      const rightSide = HEADINGS_COMPASS[(idx + 2) % 8] ?? 'down';
      const leftSide = HEADINGS_COMPASS[(idx + 6) % 8] ?? 'up';
      const sideHeading = rng.chance(0.5) ? rightSide : leftSide;
      const next = stepFrom(run.from, sideHeading);
      return { ...run, from: next.cell };
    }
    const delta = run.length > 1 && rng.chance(0.5) ? -1 : 1;
    return { ...run, length: run.length + delta };
  },
};

interface ActiveRun {
  from: Cell;
  heading: Heading;
  length: number;
}

export function createGhostMemory(profile: MemoryProfile, seat: Seat): GhostMemory {
  const memory = createKidMemory<WallRun>(profile, WALL_RUN_ADAPTER);
  const activeRuns = new Map<Seat, ActiveRun>();

  function commitRun(run: ActiveRun, riderSeat: Seat, nowSeconds: number, rng: Rng): void {
    const wallRun: WallRun = {
      from: run.from,
      heading: run.heading,
      length: run.length,
    };
    const striking = wallRun.length > 8;
    if (riderSeat === seat) {
      const salience = salienceOf(profile, 'own', striking);
      memory.observe(wallRun, salience, nowSeconds);
    } else {
      const salience = salienceOf(profile, 'theirs', striking);
      memory.witness(wallRun, salience, nowSeconds, rng);
    }
  }

  function hear(laid: readonly Laid[], match: Readonly<Match>, nowSeconds: number, rng: Rng): void {
    for (const item of laid) {
      const itemSeat = item.seat;
      const current = activeRuns.get(itemSeat);

      if (current === undefined) {
        const run: ActiveRun = {
          from: item.cell,
          heading: item.entered,
          length: 1,
        };
        if (item.left !== item.entered) {
          commitRun(run, itemSeat, nowSeconds, rng);
        } else {
          activeRuns.set(itemSeat, run);
        }
      } else if (current.heading === item.entered) {
        current.length += 1;
        if (item.left !== item.entered) {
          commitRun(current, itemSeat, nowSeconds, rng);
          activeRuns.delete(itemSeat);
        }
      } else {
        commitRun(current, itemSeat, nowSeconds, rng);
        const run: ActiveRun = {
          from: item.cell,
          heading: item.entered,
          length: 1,
        };
        if (item.left !== item.entered) {
          commitRun(run, itemSeat, nowSeconds, rng);
          activeRuns.delete(itemSeat);
        } else {
          activeRuns.set(itemSeat, run);
        }
      }
    }

    if (match.phase !== 'running') {
      for (const [itemSeat, run] of activeRuns.entries()) {
        commitRun(run, itemSeat, nowSeconds, rng);
      }
      activeRuns.clear();
    } else {
      for (const [itemSeat, run] of activeRuns.entries()) {
        const rider = match.riders[itemSeat];
        if (rider?.crashed) {
          commitRun(run, itemSeat, nowSeconds, rng);
          activeRuns.delete(itemSeat);
        }
      }
    }
  }

  function recallInto(
    mask: Uint8Array,
    match: Readonly<Match>,
    nowSeconds: number,
    rng: Rng,
  ): void {
    const recalled = memory.recall(nowSeconds, rng);
    const wraparound = match.setup.rules.edges === 'wraparound';

    for (const run of recalled) {
      if (run.length <= 0) continue;
      let current = run.from;
      if (current >= 0 && current < CELL_COUNT) {
        mask[current] = 1;
      }
      for (let step = 1; step < run.length; step++) {
        const next = stepFrom(current, run.heading);
        if (next.wrapped && !wraparound) {
          break;
        }
        current = next.cell;
        mask[current] = 1;
      }
    }
  }

  function reset(): void {
    activeRuns.clear();
    memory.forgetAll();
  }

  return {
    memory,
    hear,
    recallInto,
    reset,
  };
}
