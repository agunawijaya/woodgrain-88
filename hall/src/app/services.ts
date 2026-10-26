/**
 * Everything the Hall shares across views, created once at start-up: the
 * store and its repositories, settings with live appearance, the audio
 * engine, the event bus, the records, stats, channels and patches books, Den
 * Life, and the Versus Night series and Power Cycle Run in progress. Views receive this object; nothing else creates its own store.
 */
import {
  browserBackend,
  createAudioEngine,
  createChannelRegistry,
  createEventBus,
  createLocalStore,
  createPatchTracker,
  createProfile,
  createRecordsBook,
  createRepositories,
  createSettings,
  createStatsBook,
  type AudioEngine,
  type ChannelRegistry,
  type EventBus,
  type PatchTracker,
  type ProfileApi,
  type RecordsBook,
  type Repositories,
  type SettingsApi,
  type StatsBook,
  type StorageBackend,
} from '@woodgrain-88/kit';
import { createRegistry, type Registry } from '../data/registry.ts';
import { DEN_SOUNDS } from '../den/sound.ts';
import type { GameEntry, GameManifest } from '@woodgrain-88/kit';
import { createDenLife, type DenLife } from './den-life.ts';
import { createPowerRun, type PowerRun } from './power-run.ts';
import { createVersusNight, type VersusNight } from './versus-night.ts';

export interface Services {
  registry: Registry;
  repos: Repositories;
  settings: SettingsApi;
  audio: AudioEngine;
  bus: EventBus;
  records: RecordsBook;
  stats: StatsBook;
  channels: ChannelRegistry;
  patches: PatchTracker;
  profile: ProfileApi;
  denLife: DenLife;
  versusNight: VersusNight;
  powerRun: PowerRun;
}

export interface ServiceOptions {
  /** A store other than the browser's: the dev showcase keeps its profile in memory. */
  backend?: { backend: StorageBackend; persistent: boolean };
  /** Which games count as on the shelf for growth; the showcase counts every game. */
  playable?: (manifest: GameManifest) => boolean;
}

export function createServices(overrides: readonly GameEntry[] = [], options: ServiceOptions = {}): Services {
  const registry = createRegistry(overrides);
  const { backend, persistent } = options.backend ?? browserBackend();
  const repos = createRepositories(createLocalStore(backend, { persistent }));
  const settings = createSettings(repos.settings);
  const audio = createAudioEngine();
  audio.register(DEN_SOUNDS);
  const bus = createEventBus({ eventLog: repos['event-log'] });
  const channels = createChannelRegistry({
    games: registry.manifests.map((manifest) => ({ id: manifest.id, channels: manifest.channels })),
    progress: repos.progress,
  });
  // Patch definitions arrive with each game's module; coming-soon games have none yet.
  const patches = createPatchTracker({ games: [], progress: repos.progress });
  patches.connect(bus);

  const applyVolumes = () =>
    audio.setVolumes({
      sfx: settings.volume('sfx'),
      music: settings.volume('music'),
      ambience: settings.volume('ambience'),
    });
  applyVolumes();
  settings.onChange(applyVolumes);

  const stats = createStatsBook(repos.stats);
  return {
    registry,
    repos,
    settings,
    audio,
    bus,
    records: createRecordsBook(repos.records),
    stats,
    channels,
    patches,
    profile: createProfile(repos.profile),
    denLife: createDenLife({ registry, repos, settings, stats }, options.playable ? { playable: options.playable } : {}),
    versusNight: createVersusNight(registry),
    powerRun: createPowerRun(),
  };
}
