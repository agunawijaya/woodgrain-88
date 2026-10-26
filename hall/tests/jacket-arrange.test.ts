/**
 * Tests for the jacket layout engine: zone spot grids, patch snapping,
 * drawer and cross-side swapping, rotation normalisation, directional nudging,
 * auto-arrange placement and determinism, drawer filtering, and undo/redo history.
 */
import { describe, expect, it } from 'vitest';
import type { PatchPlacement } from '@woodgrain-88/kit';
import {
  JACKET_SIZE,
  PATCH_UNITS,
  SPOT_SPACING,
  autoArrange,
  dropPatch,
  filterDrawer,
  freeSpots,
  jacketSpots,
  nudgePatch,
  patchAt,
  patchKey,
  removePatch,
  rotatePatch,
  unsewn,
  type DrawerPatch,
} from '../src/jacket/arrange.ts';
import { createHistory } from '../src/jacket/history.ts';

describe('jacket arrange geometry and spots', () => {
  it('exports fixed jacket dimensions and spacing units', () => {
    expect(JACKET_SIZE.width).toBe(600);
    expect(JACKET_SIZE.height).toBe(700);
    expect(PATCH_UNITS).toBe(92);
    expect(SPOT_SPACING).toBe(76);
  });

  it('produces the exact spot grid counts per zone: left-chest 2x5, sleeves 1x5, yoke 4x1, panel 5x5', () => {
    const frontSpots = jacketSpots('front');
    const backSpots = jacketSpots('back');

    const frontByZone: Record<string, number> = {};
    for (const spot of frontSpots) {
      frontByZone[spot.zone] = (frontByZone[spot.zone] ?? 0) + 1;
    }

    const backByZone: Record<string, number> = {};
    for (const spot of backSpots) {
      backByZone[spot.zone] = (backByZone[spot.zone] ?? 0) + 1;
    }

    expect(frontByZone['left-chest']).toBe(10); // 2 cols * 5 rows
    expect(frontByZone['right-chest']).toBe(10); // 2 cols * 5 rows
    expect(frontByZone['left-sleeve']).toBe(5); // 1 col * 5 rows
    expect(frontByZone['right-sleeve']).toBe(5); // 1 col * 5 rows
    expect(frontSpots).toHaveLength(30);

    expect(backByZone.yoke).toBe(4); // 4 cols * 1 row
    expect(backByZone.panel).toBe(25); // 5 cols * 5 rows
    expect(backByZone['left-sleeve']).toBe(5); // 1 col * 5 rows
    expect(backByZone['right-sleeve']).toBe(5); // 1 col * 5 rows
    expect(backSpots).toHaveLength(39);
  });

  it('centres spot grids with equal margins and rounds coordinates to whole units', () => {
    const frontSpots = jacketSpots('front');
    const leftChestSpots = frontSpots.filter((s) => s.zone === 'left-chest');
    const first = leftChestSpots[0];
    const second = leftChestSpots[1];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first && second) {
      // In 175 width with 2 cols, (175 - 76)/2 = 49.5; 110 + 49.5 = 159.5 rounded to 160.
      expect(first.x).toBe(160);
      expect(second.x).toBe(236);
      expect(second.x - first.x).toBe(SPOT_SPACING);
    }
  });

  it('generates a canonical patch key from game and patch identifiers', () => {
    expect(patchKey({ game: 'tank-duel', patch: 'marksman' })).toBe('tank-duel/marksman');
    expect(patchKey({ game: 'lane-hopper', patch: 'speed-demon' })).toBe('lane-hopper/speed-demon');
  });
});

describe('patchAt and freeSpots', () => {
  it('detects free spots and excludes spots occupied within SPOT_SPACING / 2', () => {
    const frontSpots = jacketSpots('front');
    const firstSpot = frontSpots[0];
    expect(firstSpot).toBeDefined();
    if (!firstSpot) return;

    const placement: PatchPlacement = {
      game: 'tank-duel',
      patch: 'marksman',
      side: 'front',
      x: firstSpot.x,
      y: firstSpot.y,
      rotation: 0,
      z: 1,
    };

    const occupied = freeSpots('front', [placement]);
    expect(occupied).toHaveLength(frontSpots.length - 1);
    expect(occupied.some((s) => s.x === firstSpot.x && s.y === firstSpot.y)).toBe(false);

    // Free spots on the other side are unaffected
    const backFree = freeSpots('back', [placement]);
    expect(backFree).toHaveLength(jacketSpots('back').length);

    // Ignoring the patch reveals its occupied spot as free
    const ignored = freeSpots('front', [placement], 'tank-duel/marksman');
    expect(ignored).toHaveLength(frontSpots.length);
  });

  it('finds topmost placement within PATCH_UNITS / 2 radius and returns null when empty', () => {
    const lower: PatchPlacement = {
      game: 'tank-duel',
      patch: 'first-win',
      side: 'front',
      x: 160,
      y: 223,
      rotation: 0,
      z: 1,
    };
    const upper: PatchPlacement = {
      game: 'tank-duel',
      patch: 'ace',
      side: 'front',
      x: 165,
      y: 225,
      rotation: 15,
      z: 5,
    };

    // Upper patch has higher z and is within diameter 92 (radius 46)
    const found = patchAt('front', 162, 224, [lower, upper]);
    expect(found).not.toBeNull();
    expect(found?.patch).toBe('ace');
    expect(found?.z).toBe(5);

    // Checking the other side finds nothing
    expect(patchAt('back', 160, 223, [lower, upper])).toBeNull();

    // Checking with ignoreKey ignores the upper patch and returns lower
    const ignored = patchAt('front', 160, 223, [lower, upper], 'tank-duel/ace');
    expect(ignored?.patch).toBe('first-win');

    // Far away coordinates find nothing
    expect(patchAt('front', 50, 50, [lower, upper])).toBeNull();
  });
});

describe('dropPatch snapping, swapping, and capacity', () => {
  it('snaps a patch dragged from the drawer to the nearest free spot and assigns z = max z + 1', () => {
    const frontSpots = jacketSpots('front');
    const targetSpot = frontSpots[0];
    expect(targetSpot).toBeDefined();
    if (!targetSpot) return;

    const initial: PatchPlacement[] = [
      {
        game: 'lane-hopper',
        patch: 'hopper',
        side: 'front',
        x: frontSpots[1]?.x ?? 0,
        y: frontSpots[1]?.y ?? 0,
        rotation: 0,
        z: 3,
      },
    ];

    const result = dropPatch(
      initial,
      { game: 'tank-duel', patch: 'ace' },
      'front',
      targetSpot.x + 4,
      targetSpot.y - 3,
    );

    expect(result.reason).toBeNull();
    expect(result.placements).toHaveLength(2);

    const placed = result.placements.find((p) => p.game === 'tank-duel' && p.patch === 'ace');
    expect(placed).toBeDefined();
    expect(placed?.x).toBe(targetSpot.x);
    expect(placed?.y).toBe(targetSpot.y);
    expect(placed?.side).toBe('front');
    expect(placed?.rotation).toBe(0);
    expect(placed?.z).toBe(4); // max(3) + 1
  });

  it('keeps a patch in place without swapping when dropped onto its own spot', () => {
    const spot = jacketSpots('front')[0];
    expect(spot).toBeDefined();
    if (!spot) return;

    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: spot.x,
        y: spot.y,
        rotation: 30,
        z: 2,
      },
    ];

    const result = dropPatch(initial, { game: 'tank-duel', patch: 'ace' }, 'front', spot.x, spot.y);
    expect(result.reason).toBeNull();
    expect(result.placements).toHaveLength(1);
    const placed = result.placements[0];
    expect(placed?.x).toBe(spot.x);
    expect(placed?.y).toBe(spot.y);
    expect(placed?.rotation).toBe(30);
  });

  it('returns No room left on this side when the target side is completely full', () => {
    const frontSpots = jacketSpots('front');
    const fullPlacements: PatchPlacement[] = frontSpots.map((spot, i) => ({
      game: `game-${i}`,
      patch: `patch-${i}`,
      side: 'front',
      x: spot.x,
      y: spot.y,
      rotation: 0,
      z: i + 1,
    }));

    const result = dropPatch(
      fullPlacements,
      { game: 'new-game', patch: 'new-patch' },
      'front',
      // Between the chest zones, below the last row: over no patch, so no swap either.
      300,
      660,
    );

    expect(result.reason).toBe('No room left on this side');
    expect(result.placements).toHaveLength(fullPlacements.length);
  });

  it('removes the displaced patch when a drawer patch is dropped onto an existing patch', () => {
    const spot = jacketSpots('front')[0];
    expect(spot).toBeDefined();
    if (!spot) return;

    const existing: PatchPlacement = {
      game: 'lane-hopper',
      patch: 'hopper',
      side: 'front',
      x: spot.x,
      y: spot.y,
      rotation: 45,
      z: 7,
    };

    const result = dropPatch(
      [existing],
      { game: 'tank-duel', patch: 'ace' },
      'front',
      spot.x,
      spot.y,
    );

    expect(result.reason).toBeNull();
    expect(result.placements).toHaveLength(1);

    const placed = result.placements[0];
    expect(placed?.game).toBe('tank-duel');
    expect(placed?.patch).toBe('ace');
    expect(placed?.x).toBe(spot.x);
    expect(placed?.y).toBe(spot.y);
    expect(placed?.rotation).toBe(0); // Reset to 0 from drawer
    expect(placed?.z).toBe(8); // max(7) + 1
  });

  it('swaps positions, sides, and rotations between two placed patches', () => {
    const frontSpot = jacketSpots('front')[0];
    const backSpot = jacketSpots('back')[0];
    expect(frontSpot).toBeDefined();
    expect(backSpot).toBeDefined();
    if (!frontSpot || !backSpot) return;

    const patchA: PatchPlacement = {
      game: 'tank-duel',
      patch: 'ace',
      side: 'front',
      x: frontSpot.x,
      y: frontSpot.y,
      rotation: 15,
      z: 2,
    };
    const patchB: PatchPlacement = {
      game: 'lane-hopper',
      patch: 'hopper',
      side: 'back',
      x: backSpot.x,
      y: backSpot.y,
      rotation: -30,
      z: 4,
    };

    // User is viewing the back and drops patchA onto patchB's coordinates
    const result = dropPatch(
      [patchA, patchB],
      { game: 'tank-duel', patch: 'ace' },
      'back',
      backSpot.x,
      backSpot.y,
    );

    expect(result.reason).toBeNull();
    expect(result.placements).toHaveLength(2);

    const movedA = result.placements.find((p) => p.game === 'tank-duel');
    const swappedB = result.placements.find((p) => p.game === 'lane-hopper');

    expect(movedA).toBeDefined();
    expect(swappedB).toBeDefined();

    // patchA takes patchB's position, side, and rotation, plus highest z
    expect(movedA?.side).toBe('back');
    expect(movedA?.x).toBe(backSpot.x);
    expect(movedA?.y).toBe(backSpot.y);
    expect(movedA?.rotation).toBe(-30);
    expect(movedA?.z).toBe(5); // max(2, 4) + 1

    // patchB takes patchA's original position, side, and rotation
    expect(swappedB?.side).toBe('front');
    expect(swappedB?.x).toBe(frontSpot.x);
    expect(swappedB?.y).toBe(frontSpot.y);
    expect(swappedB?.rotation).toBe(15);
    expect(swappedB?.z).toBe(4); // preserves its original z
  });

  it('never mutates input arrays or placement objects', () => {
    const spot = jacketSpots('front')[0];
    expect(spot).toBeDefined();
    if (!spot) return;

    const initial: readonly PatchPlacement[] = Object.freeze([
      Object.freeze({
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: spot.x,
        y: spot.y,
        rotation: 0,
        z: 1,
      }),
    ]);

    const result = dropPatch(
      initial,
      { game: 'lane-hopper', patch: 'hopper' },
      'front',
      spot.x + 100,
      spot.y,
    );

    expect(result.placements).not.toBe(initial);
    expect(result.placements[0]).not.toBe(initial[0]);
  });
});

describe('rotatePatch normalisation', () => {
  it('normalises 165 + 15 -> 180 and 180 + 15 -> -165', () => {
    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: 160,
        y: 223,
        rotation: 165,
        z: 1,
      },
    ];

    const step1 = rotatePatch(initial, 'tank-duel/ace', 1);
    expect(step1[0]?.rotation).toBe(180);

    const step2 = rotatePatch(step1, 'tank-duel/ace', 1);
    expect(step2[0]?.rotation).toBe(-165);
  });

  it('normalises -165 - 15 -> 180 and handles negative rotation steps', () => {
    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: 160,
        y: 223,
        rotation: -165,
        z: 1,
      },
    ];

    const stepDown = rotatePatch(initial, 'tank-duel/ace', -1);
    expect(stepDown[0]?.rotation).toBe(180);

    const stepDownAgain = rotatePatch(stepDown, 'tank-duel/ace', -1);
    expect(stepDownAgain[0]?.rotation).toBe(165);
  });

  it('returns placements unchanged for an unknown patch key', () => {
    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: 160,
        y: 223,
        rotation: 0,
        z: 1,
      },
    ];
    const rotated = rotatePatch(initial, 'unknown/key', 1);
    expect(rotated[0]?.rotation).toBe(0);
    expect(rotated).not.toBe(initial);
  });
});

describe('nudgePatch directional movement', () => {
  it('nudges patch to the nearest free spot in all four directions', () => {
    // Left-chest has 2 cols x 5 rows. Pick (col 0, row 2) so it can move in all directions.
    const spots = jacketSpots('front').filter((s) => s.zone === 'left-chest');
    const startSpot = spots[4]; // row 2, col 0
    expect(startSpot).toBeDefined();
    if (!startSpot) return;

    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: startSpot.x,
        y: startSpot.y,
        rotation: 15,
        z: 3,
      },
    ];

    // Nudge up (dy < 0)
    const up = nudgePatch(initial, 'tank-duel/ace', 'up');
    expect(up[0]?.y).toBeLessThan(startSpot.y);
    expect(up[0]?.x).toBe(startSpot.x);
    expect(up[0]?.rotation).toBe(15);
    expect(up[0]?.z).toBe(3);

    // Nudge down (dy > 0)
    const down = nudgePatch(initial, 'tank-duel/ace', 'down');
    expect(down[0]?.y).toBeGreaterThan(startSpot.y);
    expect(down[0]?.x).toBe(startSpot.x);

    // Nudge right (dx > 0)
    const right = nudgePatch(initial, 'tank-duel/ace', 'right');
    expect(right[0]?.x).toBeGreaterThan(startSpot.x);
    expect(right[0]?.y).toBe(startSpot.y);

    const firstPlacement = initial[0];
    const rightSpot = spots[5]; // row 2, col 1
    if (rightSpot && firstPlacement) {
      const atRight: PatchPlacement[] = [{ ...firstPlacement, x: rightSpot.x, y: rightSpot.y }];
      const left = nudgePatch(atRight, 'tank-duel/ace', 'left');
      expect(left[0]?.x).toBe(startSpot.x);
      expect(left[0]?.y).toBe(startSpot.y);
    }
  });

  it('leaves placement unchanged when nudging against an edge with no spots in that direction', () => {
    // The chest's top row is the highest on the front; the left sleeve is the leftmost column.
    const topSpot = jacketSpots('front').find((s) => s.zone === 'left-chest');
    const sleeveSpot = jacketSpots('front').find((s) => s.zone === 'left-sleeve');
    expect(topSpot).toBeDefined();
    expect(sleeveSpot).toBeDefined();
    if (!topSpot || !sleeveSpot) return;

    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: topSpot.x,
        y: topSpot.y,
        rotation: 0,
        z: 1,
      },
    ];

    const nudgedUp = nudgePatch(initial, 'tank-duel/ace', 'up');
    expect(nudgedUp[0]?.x).toBe(topSpot.x);
    expect(nudgedUp[0]?.y).toBe(topSpot.y);

    const onSleeve: PatchPlacement[] = [
      { ...initial[0], x: sleeveSpot.x, y: sleeveSpot.y } as PatchPlacement,
    ];
    const nudgedLeft = nudgePatch(onSleeve, 'tank-duel/ace', 'left');
    expect(nudgedLeft[0]?.x).toBe(sleeveSpot.x);
    expect(nudgedLeft[0]?.y).toBe(sleeveSpot.y);
  });
});

describe('removePatch', () => {
  it('removes matching patch and returns copy when key is not found', () => {
    const initial: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'ace',
        side: 'front',
        x: 100,
        y: 100,
        rotation: 0,
        z: 1,
      },
      {
        game: 'lane-hopper',
        patch: 'hopper',
        side: 'front',
        x: 200,
        y: 200,
        rotation: 0,
        z: 2,
      },
    ];

    const removed = removePatch(initial, 'tank-duel/ace');
    expect(removed).toHaveLength(1);
    expect(removed[0]?.game).toBe('lane-hopper');

    const unchanged = removePatch(initial, 'non-existent/key');
    expect(unchanged).toHaveLength(2);
  });
});

describe('autoArrange determinism and placement rules', () => {
  const sampleDrawer: DrawerPatch[] = [
    { game: 'tank-duel', patch: 'club', tier: 'club', family: 'duels', gold: false, slot: 1 },
    { game: 'tank-duel', patch: 'pro', tier: 'pro', family: 'duels', gold: true, slot: 1 },
    { game: 'tank-duel', patch: 'legend', tier: 'legend', family: 'duels', gold: true, slot: 1 },
    {
      game: 'lane-hopper',
      patch: 'legend',
      tier: 'legend',
      family: 'arcade',
      gold: false,
      slot: 13,
    },
    {
      game: 'putt-parlor',
      patch: 'legend',
      tier: 'legend',
      family: 'sports',
      gold: true,
      slot: 19,
    },
    { game: 'sum-rush', patch: 'secret', tier: 'secret', family: 'brain', gold: false, slot: 27 },
  ];

  it('returns empty array when drawer is empty', () => {
    expect(autoArrange([])).toEqual([]);
  });

  it('produces deterministic output across multiple invocations', () => {
    const first = autoArrange(sampleDrawer);
    const second = autoArrange(sampleDrawer);
    expect(first).toEqual(second);
  });

  it('places Legend patches first on the back panel centred, largest slot first', () => {
    const placements = autoArrange(sampleDrawer);
    const panelSpots = jacketSpots('back').filter((s) => s.zone === 'panel');

    // The back panel center is (300, 407)
    const centerSpot = panelSpots.find((s) => s.x === 300 && s.y === 407);
    expect(centerSpot).toBeDefined();

    // putt-parlor has slot 19 (largest among legends 19, 13, 1), so it gets center
    const centerPlacement = placements.find((p) => p.x === 300 && p.y === 407 && p.side === 'back');
    expect(centerPlacement).toBeDefined();
    expect(centerPlacement?.game).toBe('putt-parlor');
    expect(centerPlacement?.patch).toBe('legend');

    // All three legends must be placed on the back panel
    const placedLegends = placements.filter((p) => p.patch === 'legend');
    expect(placedLegends).toHaveLength(3);
    for (const leg of placedLegends) {
      expect(leg.side).toBe('back');
      expect(panelSpots.some((s) => s.x === leg.x && s.y === leg.y)).toBe(true);
    }

    // z increases in placement order
    for (let i = 0; i < placements.length; i++) {
      expect(placements[i]?.z).toBe(i + 1);
    }
  });

  it('keeps extra patches in drawer when there are more patches than jacket spots', () => {
    const totalSpots = jacketSpots('front').length + jacketSpots('back').length; // 69 spots
    const largeDrawer: DrawerPatch[] = Array.from({ length: totalSpots + 10 }, (_, i) => ({
      game: `game-${i}`,
      patch: `patch-${i}`,
      tier: 'club',
      family: 'arcade',
      gold: false,
      slot: (i % 30) + 1,
    }));

    const placements = autoArrange(largeDrawer);
    expect(placements).toHaveLength(totalSpots);

    // Every spot is unique (spots are never shared)
    const coords = new Set(placements.map((p) => `${p.side}:${p.x},${p.y}`));
    expect(coords.size).toBe(totalSpots);
  });
});

describe('filterDrawer and unsewn', () => {
  const drawer: DrawerPatch[] = [
    { game: 'tank-duel', patch: 'club', tier: 'club', family: 'duels', gold: false, slot: 1 },
    { game: 'tank-duel', patch: 'pro', tier: 'pro', family: 'duels', gold: true, slot: 1 },
    { game: 'lane-hopper', patch: 'pro', tier: 'pro', family: 'arcade', gold: false, slot: 13 },
    { game: 'lane-hopper', patch: 'club', tier: 'club', family: 'arcade', gold: true, slot: 13 },
  ];

  it('filters by multiple fields matching every set criterion', () => {
    const goldOnly = filterDrawer(drawer, { gold: true });
    expect(goldOnly).toHaveLength(2);
    expect(goldOnly.every((p) => p.gold)).toBe(true);

    const gameAndTier = filterDrawer(drawer, { game: 'tank-duel', tier: 'pro' });
    expect(gameAndTier).toHaveLength(1);
    expect(gameAndTier[0]?.patch).toBe('pro');
  });

  it('orders filtered results by slot ascending, then tier order (club, pro, legend, secret)', () => {
    const results = filterDrawer(drawer, {});
    expect(results).toHaveLength(4);
    // Slot 1 first (club then pro)
    expect(results[0]?.game).toBe('tank-duel');
    expect(results[0]?.tier).toBe('club');
    expect(results[1]?.game).toBe('tank-duel');
    expect(results[1]?.tier).toBe('pro');
    // Slot 13 next (club then pro)
    expect(results[2]?.game).toBe('lane-hopper');
    expect(results[2]?.tier).toBe('club');
    expect(results[3]?.game).toBe('lane-hopper');
    expect(results[3]?.tier).toBe('pro');
  });

  it('identifies unsewn patches that are not yet placed on the jacket', () => {
    const placements: PatchPlacement[] = [
      {
        game: 'tank-duel',
        patch: 'club',
        side: 'front',
        x: 100,
        y: 100,
        rotation: 0,
        z: 1,
      },
    ];

    const remaining = unsewn(drawer, placements);
    expect(remaining).toHaveLength(3);
    expect(remaining.some((p) => p.game === 'tank-duel' && p.patch === 'club')).toBe(false);
  });
});

describe('createHistory undo, redo, and state limit', () => {
  it('manages initial state, push, undo, and redo transitions', () => {
    const history = createHistory('A');
    expect(history.current).toBe('A');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    // Undo at start returns current unchanged
    expect(history.undo()).toBe('A');

    history.push('B');
    expect(history.current).toBe('B');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    history.push('C');
    expect(history.current).toBe('C');

    expect(history.undo()).toBe('B');
    expect(history.current).toBe('B');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);

    expect(history.undo()).toBe('A');
    expect(history.current).toBe('A');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    expect(history.redo()).toBe('B');
    expect(history.current).toBe('B');
    expect(history.canUndo).toBe(true);

    // Push clears redo
    history.push('D');
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBe('D');
  });

  it('drops the oldest past states when limit is exceeded', () => {
    const history = createHistory(1, 2); // limit = 2 past states
    history.push(2);
    history.push(3);
    history.push(4); // past holds at most [2, 3], 1 was dropped

    expect(history.current).toBe(4);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBe(2); // no further undo possible
  });
});
