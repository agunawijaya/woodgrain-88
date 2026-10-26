/**
 * Cartridge versions: which of a merged game's programs the player plays.
 * The choice is saved in the game's own settings namespace under
 * VERSION_SETTING; a run can also ask for one version explicitly (the Den's
 * channels 31 and 32 do), and an unknown id always falls back to the default.
 */
import type { CartridgeVersion, GameManifest } from './contract.ts';

/** The key in a game's settings namespace that holds the chosen version id. */
export const VERSION_SETTING = 'cartridgeVersion';

/** The first listed version, or undefined for a game without versions. */
export function defaultVersion(manifest: GameManifest): CartridgeVersion | undefined {
  return manifest.versions?.[0];
}

/** Every version but the default: the ones with their own Counter lamps. */
export function alternateVersions(manifest: GameManifest): readonly CartridgeVersion[] {
  return manifest.versions?.slice(1) ?? [];
}

export function findVersion(manifest: GameManifest, id: string | null | undefined): CartridgeVersion | undefined {
  return id ? manifest.versions?.find((version) => version.id === id) : undefined;
}

/**
 * The version a run plays: the first candidate the manifest declares, in the
 * order given (an explicit request, then the saved choice), else the default.
 * Undefined exactly when the game has no versions.
 */
export function resolveVersion(
  manifest: GameManifest,
  ...candidates: readonly (string | null | undefined)[]
): string | undefined {
  for (const candidate of candidates) {
    const found = findVersion(manifest, candidate);
    if (found) return found.id;
  }
  return defaultVersion(manifest)?.id;
}
