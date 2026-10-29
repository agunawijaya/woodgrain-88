/**
 * Tests for trap spotting: detecting when a running rider is sealed into
 * a pocket of 40 or fewer cells by the rival, leaving the rival outside.
 */
import { describe, expect, it } from 'vitest';
import { START, cellAt } from '../../src/engine/grid.ts';
import { vectorOf } from '../../src/engine/headings.ts';
import { createMatch, startMatch, stepMatch } from '../../src/engine/match.ts';
import {
  IDLE,
  SEATS,
  type Heading,
  type Match,
  type Rider,
  type Seat,
  type Stick,
} from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import { TRAP_POCKET, spotTraps } from '../../src/session/trap.ts';

function rider(match: Readonly<Match>, seat: number): Rider {
  const item = match.riders[seat];
  if (!item) throw new Error(`Missing rider for seat ${seat}`);
  return item;
}

type Run = readonly [Heading, number];

function plannedHeadings(runs: readonly Run[]): Heading[] {
  return runs.flatMap(([heading, steps]) => Array.from({ length: steps }, () => heading));
}

function stickFor(heading: Heading | undefined): Stick {
  if (!heading) return IDLE;
  const { east, south } = vectorOf(heading);
  return { east, south, fire: false };
}

describe('spotTraps', () => {
  it('defines TRAP_POCKET as 40', () => {
    expect(TRAP_POCKET).toBe(40);
  });

  it('detects no trap on an open board where reachable space exceeds TRAP_POCKET', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    // Initial step
    for (let t = 0; t < 15; t++) {
      const events = stepMatch(match, [IDLE, IDLE]);
      for (const event of events) {
        if (event.type === 'step') {
          const traps = spotTraps(match, event.laid, new Set());
          expect(traps).toEqual([]);
        }
      }
    }
  });

  it('detects no trap when the rival is inside the same pocket', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    // Both riders are in the open arena together
    const rider0 = rider(match, 0);
    const rider1 = rider(match, 1);
    expect(rider0.cell).toBe(START[0].cell);
    expect(rider1.cell).toBe(START[1].cell);

    const traps = spotTraps(match, [], new Set());
    expect(traps).toEqual([]);
  });

  it('detects no trap when pocket is bigger than 40 cells, but spots trap when pocket <= 40 cells', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    // Place rider 0 at (1, 1)
    rider(match, 0).cell = cellAt(1, 1);
    // Keep rival rider 1 far away at (30, 10)
    rider(match, 1).cell = cellAt(30, 10);

    // Wall off a room: columns 1..6, rows 1..7 (42 cells: (1, 1) + 41 empty cells)
    for (let r = 1; r <= 7; r++) {
      match.cells[cellAt(7, r)] = 1;
    }
    for (let c = 1; c <= 7; c++) {
      match.cells[cellAt(c, 8)] = 1;
    }

    // Reachable empty cells from (1, 1): exactly 41 cells (> TRAP_POCKET 40)
    const trapsLarge = spotTraps(match, [], new Set());
    expect(trapsLarge).toEqual([]);

    // Now wall off cell (6, 1), reducing reachable empty cells to 40 (<= TRAP_POCKET 40)
    match.cells[cellAt(6, 1)] = 1;
    const trapsSmall = spotTraps(
      match,
      [{ cell: cellAt(6, 1), seat: 1, entered: 'down', left: 'down' }],
      new Set(),
    );
    expect(trapsSmall).toHaveLength(1);
    expect(trapsSmall[0]?.seat).toBe(0);
    expect(trapsSmall[0]?.pocket).toHaveLength(40);
    expect(trapsSmall[0]?.seal).toBe(cellAt(6, 1));
  });

  it('replays the trap story from hero.ts and spots exactly one trap for seat 1', () => {
    // Variation 3 trap story from hero.ts:
    // Orange cuts across the top and seals blue into a pocket of 9 cells against the far wall;
    // three steps later blue rides into the seal.
    const storyRuns: [readonly Run[], readonly Run[]] = [
      [
        ['right', 3],
        ['up', 4],
        ['right', 4],
        ['down', 11],
        ['right', 4],
        ['up', 2],
        ['right', 4],
        ['down', 2],
        ['right', 4],
        ['up', 14],
        ['left', 7],
        ['up', 2],
        ['left', 8],
      ],
      [
        ['down', 8],
        ['right', 8],
        ['up', 8],
        ['left', 2],
        ['down', 6],
        ['left', 3],
        ['up', 6],
        ['right', 2],
        ['up', 1],
        ['left', 5],
        ['up', 8],
        ['left', 9],
      ],
    ];

    const match = createMatch({
      rules: variationRules(3),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    const plans = storyRuns.map(plannedHeadings);
    const alreadyTrapped = new Set<Seat>();
    const allTraps: ReturnType<typeof spotTraps> = [];

    // Run until step 66
    while (match.steps <= 66 && match.phase === 'running') {
      const sticks = SEATS.map((seat) => stickFor(plans[seat]?.[match.steps])) as [Stick, Stick];
      const events = stepMatch(match, sticks);
      for (const event of events) {
        if (event.type === 'step') {
          const traps = spotTraps(match, event.laid, alreadyTrapped);
          for (const trap of traps) {
            alreadyTrapped.add(trap.seat);
            allTraps.push(trap);
          }
        }
      }
    }

    expect(allTraps).toHaveLength(1);
    const trap = allTraps[0];
    expect(trap?.seat).toBe(1);
    expect(trap?.pocket).toHaveLength(9);
    expect(trap?.seal).toBe(cellAt(22, 1));
  });

  it('does not report an already-trapped seat again in the same round', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    const alreadyTrapped = new Set<Seat>([0, 1]);
    const traps = spotTraps(match, [], alreadyTrapped);
    expect(traps).toEqual([]);
  });

  it('does not report traps when match phase is not running', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);
    match.phase = 'over';

    const traps = spotTraps(match, [], new Set());
    expect(traps).toEqual([]);
  });
});
