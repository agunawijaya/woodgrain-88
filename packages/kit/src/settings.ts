/**
 * Settings everyone shares (appearance, sound, motion, CRT, controls) and a
 * small per-game namespace, over the store's settings repository.
 *
 * The resolved appearance and motion preference follow the OS live when the
 * player chose "System", so The Den can switch from day to night the moment
 * the OS does, without a reload.
 */
import { createEmitter, type Unsubscribe } from './emitter.ts';
import type { Repository } from './store/repos.ts';
import type { SettingsData } from './store/types.ts';
import type { Appearance } from './types.ts';

export type VolumeChannel = 'sfx' | 'music' | 'ambience';

export interface GameSettingsStore {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}

export interface SettingsApi {
  get(): SettingsData;
  update(change: (draft: SettingsData) => void): SettingsData;
  onChange(listener: (settings: SettingsData) => void): Unsubscribe;
  /** Light or dark as shown right now, after resolving "system". */
  appearance(): Appearance;
  onAppearance(listener: (appearance: Appearance) => void): Unsubscribe;
  /** True when motion should be reduced, by the player's choice or the OS. */
  reducedMotion(): boolean;
  onReducedMotion(listener: (reduced: boolean) => void): Unsubscribe;
  /** CRT effects on, and never under reduced motion. */
  crtEnabled(): boolean;
  /** The effective gain for a sound channel: master × channel, or 0 when muted. */
  volume(channel: VolumeChannel): number;
  game(gameId: string): GameSettingsStore;
  dispose(): void;
}

type MediaQuery = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

export interface SettingsEnvironment {
  matchMedia(query: string): MediaQuery;
}

function browserEnvironment(): SettingsEnvironment {
  const noMatch: MediaQuery = {
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  return {
    matchMedia: (query) => (typeof matchMedia === 'function' ? matchMedia(query) : noMatch),
  };
}

export function createSettings(
  repo: Repository<SettingsData>,
  env: SettingsEnvironment = browserEnvironment(),
): SettingsApi {
  const darkQuery = env.matchMedia('(prefers-color-scheme: dark)');
  const motionQuery = env.matchMedia('(prefers-reduced-motion: reduce)');
  const appearanceChanges = createEmitter<Appearance>();
  const motionChanges = createEmitter<boolean>();

  const resolveAppearance = (settings: SettingsData): Appearance => {
    if (settings.appearance === 'system') return darkQuery.matches ? 'dark' : 'light';
    return settings.appearance;
  };
  const resolveMotion = (settings: SettingsData): boolean => {
    if (settings.reducedMotion === 'system') return motionQuery.matches;
    return settings.reducedMotion === 'on';
  };

  let lastAppearance = resolveAppearance(repo.get());
  let lastMotion = resolveMotion(repo.get());

  /** Re-resolves after any change, from the repo or the OS, and tells only real changes. */
  const refresh = () => {
    const settings = repo.get();
    const appearance = resolveAppearance(settings);
    if (appearance !== lastAppearance) {
      lastAppearance = appearance;
      appearanceChanges.emit(appearance);
    }
    const reduced = resolveMotion(settings);
    if (reduced !== lastMotion) {
      lastMotion = reduced;
      motionChanges.emit(reduced);
    }
  };

  const stopRepo = repo.onChange(refresh);
  darkQuery.addEventListener('change', refresh);
  motionQuery.addEventListener('change', refresh);

  return {
    get: () => repo.get(),
    update(change) {
      return repo.update((draft) => {
        change(draft);
      });
    },
    onChange: (listener) => repo.onChange(listener),
    appearance: () => lastAppearance,
    onAppearance: (listener) => appearanceChanges.on(listener),
    reducedMotion: () => lastMotion,
    onReducedMotion: (listener) => motionChanges.on(listener),
    crtEnabled: () => repo.get().crtEffects && !lastMotion,
    volume(channel) {
      const { muted, volume } = repo.get();
      return muted ? 0 : volume.master * volume[channel];
    },
    game(gameId) {
      return {
        get<T>(key: string, fallback: T): T {
          const stored = repo.get().games[gameId]?.[key];
          return stored === undefined ? fallback : (stored as T);
        },
        set(key, value) {
          repo.update((draft) => {
            draft.games[gameId] = { ...draft.games[gameId], [key]: value };
          });
        },
      };
    },
    dispose() {
      stopRepo();
      darkQuery.removeEventListener('change', refresh);
      motionQuery.removeEventListener('change', refresh);
      appearanceChanges.clear();
      motionChanges.clear();
    },
  };
}
