/**
 * The patch drawer's contents: every patch the player has earned, in any
 * game and the Den's own, ready to sew. Built from Den Life's patch definitions and the
 * progress store, so the Jacket screen, the door jacket and the showcase all
 * agree on what is in it.
 */
import type { GameManifest, PatchDef, ProgressData } from '@woodgrain-88/kit';
import type { DrawerPatch } from './arrange.ts';
import { denDrawer } from './den-patches.ts';

export function earnedDrawer(
  manifests: readonly GameManifest[],
  patchesFor: (gameId: string) => readonly PatchDef[],
  progress: ProgressData,
): DrawerPatch[] {
  const games = manifests.flatMap((manifest) =>
    patchesFor(manifest.id).flatMap((def) => {
      const earned = progress.games[manifest.id]?.patches[def.id];
      if (!earned?.earnedAt) return [];
      return [
        {
          game: manifest.id,
          patch: def.id,
          tier: def.tier,
          family: manifest.family,
          gold: earned.gold,
          slot: manifest.slot,
        },
      ];
    }),
  );
  return [...denDrawer(progress), ...games];
}
