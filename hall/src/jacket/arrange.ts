/**
 * Where patches may go on the jacket, and every way of moving them: snapping
 * a dropped patch to a free spot, swapping when it lands on another one,
 * turning in 15° steps, keyboard moves, and "Auto-arrange". No DOM; the
 * Jacket screen turns pointer and key events into these calls.
 *
 * Positions are in the jacket drawing's own 600×700 units. Snap spots sit a
 * little closer together than a patch is wide, so neighbours overlap at the
 * edges the way patches sewn by hand do.
 */
import { createRng, type PatchPlacement, type PatchTier } from '@woodgrain-88/kit';

export const JACKET_SIZE = { width: 600, height: 700 } as const;
/** A patch's footprint on the jacket, as a diameter. */
export const PATCH_UNITS = 92;
/** Distance between neighbouring snap spots; less than PATCH_UNITS so patches overlap a little, as sewn ones do. */
export const SPOT_SPACING = 76;

export interface JacketZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const JACKET_ZONES: Record<'front' | 'back', readonly JacketZone[]> = {
  front: [
    { id: 'left-chest', x: 110, y: 160, width: 175, height: 430 },
    { id: 'right-chest', x: 315, y: 160, width: 175, height: 430 },
    { id: 'left-sleeve', x: 22, y: 210, width: 84, height: 380 },
    { id: 'right-sleeve', x: 494, y: 210, width: 84, height: 380 },
  ],
  back: [
    { id: 'yoke', x: 120, y: 104, width: 360, height: 96 },
    { id: 'panel', x: 104, y: 214, width: 392, height: 386 },
    { id: 'left-sleeve', x: 22, y: 210, width: 84, height: 380 },
    { id: 'right-sleeve', x: 494, y: 210, width: 84, height: 380 },
  ],
};

export type JacketSide = 'front' | 'back';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Spot {
  side: JacketSide;
  zone: string;
  x: number;
  y: number;
}

/** A patch the player can sew: earned, from the drawer. */
export interface DrawerPatch {
  game: string;
  patch: string;
  tier: PatchTier;
  family: string;
  gold: boolean;
  /** Slot of the game, for a stable order. */
  slot: number;
}

export const NO_ROOM = 'No room left on this side';

export function patchKey(p: { game: string; patch: string }): string {
  return `${p.game}/${p.patch}`;
}

/** The candidate with the smallest score; undefined for none. */
function minBy<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = Infinity;
  for (const item of items) {
    const value = score(item);
    if (value < bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Degrees folded into -165..180, the range the rotate buttons step through. */
export function normalizeRotation(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

export function jacketSpots(side: JacketSide): Spot[] {
  return JACKET_ZONES[side].flatMap((zone) => {
    const columns = Math.max(1, Math.floor(zone.width / SPOT_SPACING));
    const rows = Math.max(1, Math.floor(zone.height / SPOT_SPACING));
    // The grid is centred in its zone, with the spare room split evenly round it.
    const left = zone.x + (zone.width - (columns - 1) * SPOT_SPACING) / 2;
    const top = zone.y + (zone.height - (rows - 1) * SPOT_SPACING) / 2;
    return Array.from({ length: rows * columns }, (_, index) => ({
      side,
      zone: zone.id,
      x: Math.round(left + (index % columns) * SPOT_SPACING),
      y: Math.round(top + Math.floor(index / columns) * SPOT_SPACING),
    }));
  });
}

const others = (placements: readonly PatchPlacement[], side: JacketSide, ignoreKey?: string) =>
  placements.filter((p) => p.side === side && patchKey(p) !== ignoreKey);

/** Spots with no placement centre within SPOT_SPACING / 2 (ignoring `ignoreKey`). */
export function freeSpots(side: JacketSide, placements: readonly PatchPlacement[], ignoreKey?: string): Spot[] {
  const taken = others(placements, side, ignoreKey);
  return jacketSpots(side).filter((spot) => taken.every((p) => distance(p, spot) > SPOT_SPACING / 2));
}

/** The placement whose centre is within PATCH_UNITS / 2 of (x, y) on that side, topmost z first; null if none. */
export function patchAt(side: JacketSide, x: number, y: number, placements: readonly PatchPlacement[], ignoreKey?: string): PatchPlacement | null {
  const under = others(placements, side, ignoreKey).filter((p) => distance(p, { x, y }) <= PATCH_UNITS / 2);
  return minBy(under, (p) => -p.z) ?? null;
}

const topZ = (placements: readonly PatchPlacement[]) => placements.reduce((max, p) => Math.max(max, p.z), 0);

/** Replaces the placements with these keys, keeps the rest, and never shares objects with the input. */
function withReplaced(placements: readonly PatchPlacement[], replacements: ReadonlyMap<string, PatchPlacement>): PatchPlacement[] {
  return placements.map((p) => ({ ...(replacements.get(patchKey(p)) ?? p) }));
}

/**
 * Drop a patch (from the drawer, or already on the jacket) at (x, y).
 * - Dropped on another patch: they swap. If the dragged patch came from the drawer, the patch it
 *   landed on goes back to the drawer and the dragged one takes its place, rotation 0. If both are
 *   on the jacket, they exchange x, y, side and rotation.
 * - Otherwise it snaps to the nearest free spot on that side; with no free spot the placements
 *   come back unchanged and `reason` says so.
 * - The moved patch goes on top.
 */
export function dropPatch(
  placements: readonly PatchPlacement[],
  patch: { game: string; patch: string },
  side: JacketSide,
  x: number,
  y: number,
): { placements: PatchPlacement[]; reason: string | null } {
  const key = patchKey(patch);
  const dragged = placements.find((p) => patchKey(p) === key);
  const z = topZ(placements) + 1;
  const target = patchAt(side, x, y, placements, key);

  if (target) {
    const targetKey = patchKey(target);
    const moved = { game: patch.game, patch: patch.patch, side: target.side, x: target.x, y: target.y, z };
    if (!dragged) {
      return { placements: withReplaced(placements, new Map([[targetKey, { ...moved, rotation: 0 }]])), reason: null };
    }
    const swapped = { ...target, side: dragged.side, x: dragged.x, y: dragged.y, rotation: dragged.rotation };
    return {
      placements: withReplaced(placements, new Map([[key, { ...moved, rotation: target.rotation }], [targetKey, swapped]])),
      reason: null,
    };
  }

  const spot = minBy(freeSpots(side, placements, key), (candidate) => distance(candidate, { x, y }));
  if (!spot) return { placements: placements.map((p) => ({ ...p })), reason: NO_ROOM };
  const placed: PatchPlacement = { game: patch.game, patch: patch.patch, side, x: spot.x, y: spot.y, rotation: dragged?.rotation ?? 0, z };
  return dragged
    ? { placements: withReplaced(placements, new Map([[key, placed]])), reason: null }
    : { placements: [...placements.map((p) => ({ ...p })), placed], reason: null };
}

/** Rotate by `step` × 15 degrees, normalised to -165..180. */
export function rotatePatch(placements: readonly PatchPlacement[], key: string, step: 1 | -1): PatchPlacement[] {
  return placements.map((p) => (patchKey(p) === key ? { ...p, rotation: normalizeRotation(p.rotation + step * 15) } : { ...p }));
}

/** How far a spot lies in a direction (negative when behind) and how far off to the side. */
function offsets(direction: Direction, dx: number, dy: number): { along: number; across: number } {
  switch (direction) {
    case 'up':
      return { along: -dy, across: Math.abs(dx) };
    case 'down':
      return { along: dy, across: Math.abs(dx) };
    case 'left':
      return { along: -dx, across: Math.abs(dy) };
    case 'right':
      return { along: dx, across: Math.abs(dy) };
  }
}

/**
 * Keyboard move: to the nearest free spot in that direction on the same side; unchanged if none.
 * Sideways distance counts double, so "up" climbs the same column before it jumps to a sleeve.
 */
export function nudgePatch(placements: readonly PatchPlacement[], key: string, direction: Direction): PatchPlacement[] {
  const moving = placements.find((p) => patchKey(p) === key);
  if (!moving) return placements.map((p) => ({ ...p }));
  const ahead = freeSpots(moving.side, placements, key)
    .map((spot) => ({ spot, ...offsets(direction, spot.x - moving.x, spot.y - moving.y) }))
    .filter((candidate) => candidate.along > 0);
  const next = minBy(ahead, (candidate) => candidate.along + candidate.across * 2);
  if (!next) return placements.map((p) => ({ ...p }));
  return withReplaced(placements, new Map([[key, { ...moving, x: next.spot.x, y: next.spot.y }]]));
}

export function removePatch(placements: readonly PatchPlacement[], key: string): PatchPlacement[] {
  return placements.filter((p) => patchKey(p) !== key).map((p) => ({ ...p }));
}

const ARRANGE_TIER_ORDER: Record<PatchTier, number> = { legend: 0, pro: 1, club: 2, secret: 3 };
const DRAWER_TIER_ORDER: Record<PatchTier, number> = { club: 0, pro: 1, legend: 2, secret: 3 };
const BACK_PANEL_CENTRE = { x: 300, y: 407 };

/** Spots in the order Auto-arrange fills them: back panel from its centre out, front chests, yoke, sleeves. */
function arrangeOrder(): Spot[] {
  const back = jacketSpots('back');
  const front = jacketSpots('front');
  const inZones = (spots: Spot[], ...zones: string[]) => spots.filter((spot) => zones.includes(spot.zone));
  const panel = inZones(back, 'panel').sort(
    (a, b) => distance(a, BACK_PANEL_CENTRE) - distance(b, BACK_PANEL_CENTRE) || a.y - b.y || a.x - b.x,
  );
  return [
    ...panel,
    ...inZones(front, 'left-chest', 'right-chest'),
    ...inZones(back, 'yoke'),
    ...inZones(front, 'left-sleeve', 'right-sleeve'),
    ...inZones(back, 'left-sleeve', 'right-sleeve'),
  ];
}

/**
 * "Auto-arrange": as many drawer patches as there are spots, looking deliberate.
 * Legend patches take the middle of the back panel (later slots first); the rest follow by
 * tier (legend, pro, club, secret), then slot. A quarter of the patches, picked by a seeded
 * draw on their key, sit turned 15° one way or the other, so the same jacket always arranges
 * the same way and never looks machine-stamped.
 */
export function autoArrange(drawer: readonly DrawerPatch[]): PatchPlacement[] {
  const unique = [...new Map(drawer.map((p) => [patchKey(p), p])).values()];
  const spots = arrangeOrder();
  const panelSize = spots.filter((spot) => spot.zone === 'panel' && spot.side === 'back').length;
  const legends = unique
    .filter((p) => p.tier === 'legend')
    .sort((a, b) => b.slot - a.slot || patchKey(a).localeCompare(patchKey(b)))
    .slice(0, panelSize);
  const centred = new Set(legends.map(patchKey));
  const rest = unique
    .filter((p) => !centred.has(patchKey(p)))
    .sort((a, b) => ARRANGE_TIER_ORDER[a.tier] - ARRANGE_TIER_ORDER[b.tier] || a.slot - b.slot || patchKey(a).localeCompare(patchKey(b)));
  return [...legends, ...rest].slice(0, spots.length).flatMap((p, index) => {
    const spot = spots[index];
    if (!spot) return [];
    const rng = createRng(patchKey(p));
    const rotation = rng.chance(0.25) ? rng.pick([-15, 15] as const) : 0;
    return [{ game: p.game, patch: p.patch, side: spot.side, x: spot.x, y: spot.y, rotation, z: index + 1 }];
  });
}

export interface DrawerFilter {
  game?: string;
  family?: string;
  tier?: PatchTier;
  gold?: boolean;
}

/** Drawer patches matching every set field, in slot then tier order (club, pro, legend, secret). */
export function filterDrawer(drawer: readonly DrawerPatch[], filter: DrawerFilter): DrawerPatch[] {
  return drawer
    .filter(
      (p) =>
        (filter.game === undefined || p.game === filter.game) &&
        (filter.family === undefined || p.family === filter.family) &&
        (filter.tier === undefined || p.tier === filter.tier) &&
        (filter.gold === undefined || p.gold === filter.gold),
    )
    .map((p) => ({ ...p }))
    .sort((a, b) => a.slot - b.slot || DRAWER_TIER_ORDER[a.tier] - DRAWER_TIER_ORDER[b.tier] || patchKey(a).localeCompare(patchKey(b)));
}

/** Drawer patches not yet on the jacket. */
export function unsewn(drawer: readonly DrawerPatch[], placements: readonly PatchPlacement[]): DrawerPatch[] {
  const sewn = new Set(placements.map(patchKey));
  return drawer.filter((p) => !sewn.has(patchKey(p))).map((p) => ({ ...p }));
}
