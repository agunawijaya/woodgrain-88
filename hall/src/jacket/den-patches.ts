/**
 * The Den's own patch: Block champion, for beating all six Neighbourhood
 * Kids at least once. It belongs to no game, so it is not tracked by events
 * like the others; it is earned the moment the Block Ladder's top rung is,
 * and sewn in gold once every kid has been beaten with the switch on A.
 *
 * It is drawn by the same patch-art generator as every game's patches, in
 * the Den's own mustard and walnut, with a little house for its emblem.
 */
import { blockLadder, KID_IDS, type PatchDef, type ProgressData } from '@woodgrain-88/kit';
import type { DrawerPatch } from './arrange.ts';
import type { PatchOwner } from './patch-look.ts';

export const DEN_OWNER: PatchOwner & { family: string; slot: number } = {
  id: 'den',
  title: 'The Den',
  emblem: 'M4 20V10.5L12 4l8 6.5V20M9.5 20v-5.5h5V20',
  label: { pattern: 'stripes', paper: '#f3e6cc', ink: '#5a3420', band: '#d9a21b', bandText: '#2a1b12' },
  family: 'den',
  slot: 0,
};

export const BLOCK_CHAMPION: PatchDef = {
  id: 'block-champion',
  tier: 'legend',
  title: 'Block champion',
  description: 'Beat all six Neighbourhood Kids at least once, in any games',
  goal: { metric: { kind: 'count', event: 'block-champion' }, target: 1 },
};

/** Whether Block champion is earned, and in gold. */
export function blockChampionStatus(progress: ProgressData): { earned: boolean; gold: boolean; earnedAt: string | null } {
  const ladder = blockLadder(progress.den.kids);
  if (!ladder.champion) return { earned: false, gold: false, earnedAt: null };
  // The day the last of the six was first beaten.
  const earnedAt = KID_IDS.flatMap((kid) => progress.den.kids[kid]?.firstBeatenAt ?? [])
    .sort()
    .at(-1);
  return { earned: true, gold: ladder.beatenOnA.length === KID_IDS.length, earnedAt: earnedAt ?? null };
}

/** The Den's patches as drawer entries: Block champion, once earned. */
export function denDrawer(progress: ProgressData): DrawerPatch[] {
  const status = blockChampionStatus(progress);
  return status.earned ? [{ game: DEN_OWNER.id, patch: BLOCK_CHAMPION.id, tier: BLOCK_CHAMPION.tier, family: DEN_OWNER.family, gold: status.gold, slot: DEN_OWNER.slot }] : [];
}
