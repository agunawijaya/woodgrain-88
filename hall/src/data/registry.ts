/**
 * The registry: every game The Den knows about, in slot order. Each entry is
 * a manifest, plus a module loader once the game is playable. Coming-soon
 * games live in ./coming-soon/ until their own prompt moves the manifest into
 * games/<id>/ and adds a loader here.
 *
 * Titles live only in manifests, so renaming a game is a one-file change.
 */
import { FAMILIES, type Family, type GameEntry, type GameManifest } from '@woodgrain-88/kit';
import { manifest as baseline } from './coming-soon/baseline.ts';
import { manifest as bigTopCannon } from './coming-soon/big-top-cannon.ts';
import { manifest as bumperChase } from './coming-soon/bumper-chase.ts';
import { manifest as chalkTalk } from './coming-soon/chalk-talk.ts';
import { manifest as crownJump } from './coming-soon/crown-jump.ts';
import { manifest as discDuel } from './coming-soon/disc-duel.ts';
import { manifest as dropZone } from './coming-soon/drop-zone.ts';
import { manifest as gloveBox } from './coming-soon/glove-box.ts';
import { manifest as gravityDuel } from './coming-soon/gravity-duel.ts';
import { manifest as hoopDuel } from './coming-soon/hoop-duel.ts';
import { manifest as hotAndCold } from './coming-soon/hot-and-cold.ts';
import { manifest as hoverBlast } from './coming-soon/hover-blast.ts';
import { manifest as laneHopper } from './coming-soon/lane-hopper.ts';
import { manifest as laneTen } from './coming-soon/lane-ten.ts';
import { manifest as lassoRun } from './coming-soon/lasso-run.ts';
import { manifest as pierDerby } from './coming-soon/pier-derby.ts';
import { manifest as pocketLinks } from './coming-soon/pocket-links.ts';
import { manifest as puttParlor } from './coming-soon/putt-parlor.ts';
import { manifest as quadCube } from './coming-soon/quad-cube.ts';
import { manifest as quickdraw } from './coming-soon/quickdraw.ts';
import { manifest as luckyReels } from './coming-soon/lucky-reels.ts';
import { manifest as sandlotSlugger } from './coming-soon/sandlot-slugger.ts';
import { manifest as saucerPatrol } from './coming-soon/saucer-patrol.ts';
import { manifest as shoreBattery } from './coming-soon/shore-battery.ts';
import { manifest as slalomLine } from './coming-soon/slalom-line.ts';
import { manifest as sumRush } from './coming-soon/sum-rush.ts';
import { manifest as swarmGarden } from './coming-soon/swarm-garden.ts';
import { manifest as tableTwentyone } from './coming-soon/table-21.ts';
import { manifest as tankDuel } from '@woodgrain-88/tank-duel/manifest';
import { manifest as trailblaze } from '@woodgrain-88/trailblaze/manifest';

export const BASE_ENTRIES: readonly GameEntry[] = [
  { manifest: baseline },
  { manifest: bigTopCannon },
  { manifest: bumperChase },
  { manifest: chalkTalk },
  { manifest: crownJump },
  { manifest: discDuel },
  { manifest: dropZone },
  { manifest: gloveBox },
  { manifest: gravityDuel },
  { manifest: hoopDuel },
  { manifest: hotAndCold },
  { manifest: hoverBlast },
  { manifest: laneHopper },
  { manifest: laneTen },
  { manifest: lassoRun },
  // three.js and the diorama arrive with this chunk only, never in the Hall's own bundle.
  {
    manifest: tankDuel,
    load: () => import('@woodgrain-88/tank-duel/module').then((module) => module.tankDuel),
  },
  { manifest: pierDerby },
  { manifest: pocketLinks },
  { manifest: puttParlor },
  { manifest: quadCube },
  { manifest: quickdraw },
  { manifest: luckyReels },
  { manifest: sandlotSlugger },
  { manifest: saucerPatrol },
  { manifest: shoreBattery },
  { manifest: slalomLine },
  { manifest: sumRush },
  { manifest: swarmGarden },
  { manifest: tableTwentyone },
  // As with Tank Duel: three.js and the four looks arrive with this chunk only.
  {
    manifest: trailblaze,
    load: () => import('@woodgrain-88/trailblaze/module').then((module) => module.trailblaze),
  },
];

export interface Registry {
  /** Every game, ordered by its fixed slot on the Counter and the wall. */
  readonly entries: readonly GameEntry[];
  readonly manifests: readonly GameManifest[];
  entryById(id: string): GameEntry | undefined;
  entryBySlot(slot: number): GameEntry | undefined;
}

/**
 * The registry the Hall runs on. `overrides` replace the entry in the same
 * slot; only the dev harness passes any (the test-only fake game), so the
 * built site always runs on BASE_ENTRIES alone.
 */
export function createRegistry(overrides: readonly GameEntry[] = []): Registry {
  const bySlot = new Map(BASE_ENTRIES.map((entry) => [entry.manifest.slot, entry]));
  for (const entry of overrides) bySlot.set(entry.manifest.slot, entry);
  const entries = [...bySlot.values()].sort((a, b) => a.manifest.slot - b.manifest.slot);
  const manifests = entries.map((entry) => entry.manifest);
  return {
    entries,
    manifests,
    entryById: (id) => entries.find((entry) => entry.manifest.id === id),
    entryBySlot: (slot) => entries.find((entry) => entry.manifest.slot === slot),
  };
}

/** The Label Wall's four rows, one per family, each in slot order. */
export function wallRows(manifests: readonly GameManifest[]): Record<Family, GameManifest[]> {
  const rows = Object.fromEntries(
    FAMILIES.map((family) => [family, [] as GameManifest[]]),
  ) as Record<Family, GameManifest[]>;
  for (const manifest of manifests) rows[manifest.family].push(manifest);
  for (const family of FAMILIES) rows[family].sort((a, b) => a.slot - b.slot);
  return rows;
}

export const FAMILY_NAMES: Readonly<Record<Family, string>> = {
  duels: 'Duels',
  brain: 'Brain',
  sports: 'Sports',
  arcade: 'Arcade',
};
