/**
 * The Den grows: room changes earned by play, defined here as data so the
 * rules, the toasts and the drawings stay in one place and "Forget my data"
 * (which clears progress) takes them all away again.
 *
 * `growthFacts` reads what the player has done; `earnedGrowth` turns that
 * into the items now in the room, each with the anchor it is drawn at. Every
 * anchor was chosen with the whole set in view, so a fully grown Den still
 * leaves the TV, the Counter and the labels clear.
 */
import {
  blockLadder,
  FAMILIES,
  type Family,
  type GameManifest,
  type ProgressData,
} from '@woodgrain-88/kit';

export type GrowthKind =
  | 'trophy'
  | 'poster'
  | 'paper-chain'
  | 'string-lights'
  | 'on-air'
  | 'ribbon'
  | 'second-beanbag'
  | 'plaque-and-remote';

export interface GrowthItem {
  /** Stable forever: progress remembers which items have already sparkled in. */
  id: string;
  kind: GrowthKind;
  /** The one-line toast the first time it appears. */
  toast: string;
  /** For a trophy, the game it is for; for a poster, the family. */
  game?: string;
  family?: Family;
}

/** Everything growth depends on, worked out once from the stores. */
export interface GrowthFacts {
  /** Games with at least one Legend patch earned, in slot order. */
  legendGames: readonly GameManifest[];
  /** Families in which every playable game has a Club patch (and at least one game is playable). */
  clubFamilies: readonly Family[];
  bestStreak: number;
  blockChampion: boolean;
  versusSeries: number;
  allLampsLit: boolean;
}

export const STREAK_MILESTONES = { paperChain: 7, stringLights: 30, onAir: 100 } as const;
export const VERSUS_SERIES_FOR_BEANBAG = 10;

const FAMILY_POSTER_TOAST: Record<Family, string> = {
  duels: 'The Duels poster goes up on the wall',
  brain: 'The Brain poster goes up on the wall',
  sports: 'The Sports poster goes up on the wall',
  arcade: 'The Arcade poster goes up on the wall',
};

function hasTierPatch(
  progress: ProgressData,
  gameId: string,
  patchIds: readonly string[],
): boolean {
  const patches = progress.games[gameId]?.patches ?? {};
  return patchIds.some((id) => Boolean(patches[id]?.earnedAt));
}

/**
 * The facts growth is decided on. `patchTiers` maps each game to its patch ids
 * by tier, from the game modules (coming-soon games have none).
 */
export function growthFacts(input: {
  manifests: readonly GameManifest[];
  patchTiers: ReadonlyMap<string, { club: readonly string[]; legend: readonly string[] }>;
  progress: ProgressData;
  allLampsLit: boolean;
  /** Which games count as on the shelf; the dev showcase treats every game as playable. */
  playable?: (manifest: GameManifest) => boolean;
}): GrowthFacts {
  const { manifests, patchTiers, progress } = input;
  const playable = input.playable ?? ((manifest: GameManifest) => manifest.status === 'playable');
  const legendGames = manifests.filter((m) =>
    hasTierPatch(progress, m.id, patchTiers.get(m.id)?.legend ?? []),
  );
  const clubFamilies = FAMILIES.filter((family) => {
    const onShelf = manifests.filter((m) => m.family === family && playable(m));
    return (
      onShelf.length > 0 &&
      onShelf.every((m) => hasTierPatch(progress, m.id, patchTiers.get(m.id)?.club ?? []))
    );
  });
  return {
    legendGames,
    clubFamilies,
    bestStreak: progress.den.streak.best,
    blockChampion: blockLadder(progress.den.kids).champion,
    versusSeries: progress.den.versus.seriesPlayed,
    allLampsLit: input.allLampsLit,
  };
}

/** The items the room shows for these facts, in drawing order. */
export function earnedGrowth(facts: GrowthFacts): GrowthItem[] {
  const items: GrowthItem[] = [];
  for (const family of facts.clubFamilies) {
    items.push({
      id: `poster:${family}`,
      kind: 'poster',
      toast: FAMILY_POSTER_TOAST[family],
      family,
    });
  }
  if (facts.bestStreak >= STREAK_MILESTONES.paperChain) {
    items.push({
      id: 'paper-chain',
      kind: 'paper-chain',
      toast: 'A paper chain across the window: seven days in a row',
    });
  }
  if (facts.bestStreak >= STREAK_MILESTONES.stringLights) {
    items.push({
      id: 'string-lights',
      kind: 'string-lights',
      toast: 'String lights along the shelves: thirty days in a row',
    });
  }
  if (facts.bestStreak >= STREAK_MILESTONES.onAir) {
    items.push({
      id: 'on-air',
      kind: 'on-air',
      toast: 'An ON AIR sign for the TV: a hundred days in a row',
    });
  }
  if (facts.blockChampion) {
    items.push({ id: 'ribbon', kind: 'ribbon', toast: 'A Block champion ribbon on the corkboard' });
  }
  if (facts.versusSeries >= VERSUS_SERIES_FOR_BEANBAG) {
    items.push({
      id: 'second-beanbag',
      kind: 'second-beanbag',
      toast: 'A second beanbag for Versus Night. The cat has taken it',
    });
  }
  if (facts.allLampsLit) {
    items.push({
      id: 'plaque-and-remote',
      kind: 'plaque-and-remote',
      toast: 'All 32 lamps: a 32 in 1 plaque, and a remote for the TV',
    });
  }
  for (const manifest of facts.legendGames) {
    items.push({
      id: `trophy:${manifest.id}`,
      kind: 'trophy',
      toast: `A trophy for ${manifest.title}`,
      game: manifest.id,
    });
  }
  return items;
}

/** Items earned but not yet revealed: each sparkles in once, with its toast. */
export function newGrowth(
  items: readonly GrowthItem[],
  seen: Readonly<Record<string, string>>,
): GrowthItem[] {
  return items.filter((item) => seen[item.id] === undefined);
}
