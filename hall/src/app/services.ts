/**
 * Everything the Hall shares across views, created once at start-up: the
 * store and its repositories, settings with live appearance, the audio
 * engine, the event bus, and the records, stats, channels and patches books.
 * Views receive this object; nothing else creates its own store.
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
} from '@woodgrain-88/kit';
import { createRegistry, type Registry } from '../data/registry.ts';
import { DEN_SOUNDS } from '../den/sound.ts';
import type { GameEntry } from '@woodgrain-88/kit';

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
}

export function createServices(overrides: readonly GameEntry[] = []): Services {
  const registry = createRegistry(overrides);
  const { backend, persistent } = browserBackend();
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
  const patches = createPatchTracker({ games: [], progress: repos.progress, isPro: () => false });
  patches.connect(bus);

  const applyVolumes = () =>
    audio.setVolumes({
      sfx: settings.volume('sfx'),
      music: settings.volume('music'),
      ambience: settings.volume('ambience'),
    });
  applyVolumes();
  settings.onChange(applyVolumes);

  return {
    registry,
    repos,
    settings,
    audio,
    bus,
    records: createRecordsBook(repos.records),
    stats: createStatsBook(repos.stats),
    channels,
    patches,
    profile: createProfile(repos.profile),
  };
}
