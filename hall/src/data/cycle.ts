/**
 * What the power switch steps through. The Counter has 32 places, one for
 * each program on the 1988 cartridge: 1–30 are our games, each in its default
 * cartridge version, and 31 and 32 are the other versions of the two merged
 * games, in slot order. Flipping past 32 wraps to 1, and backwards past 1
 * wraps to 32.
 */
import {
  alternateVersions,
  defaultVersion,
  type CartridgeVersion,
  type GameManifest,
  type ProgressData,
} from '@woodgrain-88/kit';

export const COUNTER_SLOTS = 32;
export const GAME_SLOTS = 30;

export type Direction = 1 | -1;

export interface CounterPlace {
  /** 1–32, as the Counter shows it. */
  slot: number;
  manifest: GameManifest;
  /** The cartridge version this place plays; undefined for a game without versions. */
  version?: CartridgeVersion;
}

/** Places 31 and 32 hold a merged game's other version rather than a game of their own. */
export function isVersionPlace(slot: number): boolean {
  return slot > GAME_SLOTS && slot <= COUNTER_SLOTS;
}

/** Every filled place on the Counter, in slot order. */
export function counterPlaces(manifests: readonly GameManifest[]): CounterPlace[] {
  const inSlotOrder = [...manifests].sort((a, b) => a.slot - b.slot);
  const places: CounterPlace[] = inSlotOrder.map((manifest) => {
    const version = defaultVersion(manifest);
    return version ? { slot: manifest.slot, manifest, version } : { slot: manifest.slot, manifest };
  });
  const others = inSlotOrder.flatMap((manifest) => alternateVersions(manifest).map((version) => ({ manifest, version })));
  others.slice(0, COUNTER_SLOTS - GAME_SLOTS).forEach((other, index) => {
    places.push({ slot: GAME_SLOTS + 1 + index, ...other });
  });
  return places;
}

/**
 * Whether a place's lamp is lit. Places 1–30 light with the game's first
 * patch (Den Life); 31 and 32, a merged game's other version, light once a
 * run has been finished with that version.
 */
export function placeFinished(place: CounterPlace, progress: ProgressData): boolean {
  const game = progress.games[place.manifest.id];
  if (isVersionPlace(place.slot)) {
    return place.version !== undefined && Boolean(game?.versionsFinished[place.version.id]);
  }
  return Object.values(game?.patches ?? {}).some((patch) => patch.earnedAt !== null);
}

/** The slot one power cycle away from `current`, wrapping around all 32 places. */
export function nextSlot(current: number, direction: Direction): number {
  return ((current - 1 + direction + COUNTER_SLOTS) % COUNTER_SLOTS) + 1;
}

/** Slots visited by `count` flips from `start`, not including `start`. */
export function cycleSlots(start: number, direction: Direction, count: number): number[] {
  const visited: number[] = [];
  let slot = start;
  for (let i = 0; i < count; i++) {
    slot = nextSlot(slot, direction);
    visited.push(slot);
  }
  return visited;
}

/** "07": the Counter always shows two digits. */
export function counterDigits(slot: number): string {
  return String(slot).padStart(2, '0');
}
