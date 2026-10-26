/**
 * Repositories: typed, cached views over the store's documents. The Hall and
 * the kit modules hold a `Repositories` object and never see keys, envelopes
 * or versions.
 *
 * Each repository reads its document once (upgrading and sanitising it, or
 * starting from defaults), keeps it in memory, and writes the whole document
 * back on every change. Writes are synchronous; documents are small.
 */
import { createEmitter, type Unsubscribe } from '../emitter.ts';
import type { LocalStore, RepoName } from './local-store.ts';
import {
  defaults,
  sanitize,
  SCHEMA_VERSIONS,
  upgrade,
  type RepoDataMap,
  type SchemaContext,
} from './schema.ts';

export interface Repository<T> {
  /** The current data. Treat it as read-only; change it with set or update. */
  get(): T;
  /** Replaces the data (sanitised first) and persists it. */
  set(value: T): void;
  /** Changes the data by mutating a deep copy, then persists and returns the result. */
  update(change: (draft: T) => void): T;
  /** Back to defaults, persisted. */
  reset(): void;
  /** Fires after every set, update or reset with the new data. */
  onChange(listener: (value: T) => void): Unsubscribe;
}

export type Repositories = { [N in RepoName]: Repository<RepoDataMap[N]> } & {
  /** False when the store is running in memory only. */
  readonly persistent: boolean;
  /** Resets every repository (the "Forget my data" button). */
  forgetAll(): void;
};

interface ManagedRepo<N extends RepoName> {
  repo: Repository<RepoDataMap[N]>;
  forget(): void;
}

function createManagedRepo<N extends RepoName>(
  name: N,
  store: LocalStore,
  context: SchemaContext,
): ManagedRepo<N> {
  let cached: RepoDataMap[N] | undefined;
  const changes = createEmitter<RepoDataMap[N]>();

  function load(): RepoDataMap[N] {
    if (cached !== undefined) return cached;
    const stored = store.read(name);
    if (stored !== undefined) {
      const upgraded = upgrade(name, stored, context);
      if (upgraded !== null) {
        cached = upgraded;
        return cached;
      }
    }
    cached = defaults(name, context);
    return cached;
  }

  function commit(next: RepoDataMap[N]): RepoDataMap[N] {
    cached = next;
    store.write(name, { v: SCHEMA_VERSIONS[name], data: next });
    changes.emit(next);
    return next;
  }

  return {
    repo: {
      get() {
        return load();
      },
      set(value) {
        const clean = sanitize(name, value, context) ?? defaults(name, context);
        commit(clean);
      },
      update(change) {
        const draft = structuredClone(load());
        change(draft);
        const clean = sanitize(name, draft, context) ?? defaults(name, context);
        return commit(clean);
      },
      reset() {
        commit(defaults(name, context));
      },
      onChange(listener) {
        return changes.on(listener);
      },
    },
    forget() {
      cached = defaults(name, context);
    },
  };
}

export function createRepositories(
  store: LocalStore,
  context?: Partial<SchemaContext>,
): Repositories {
  const fullContext: SchemaContext = {
    now: context?.now ?? (() => new Date()),
    newId: context?.newId ?? (() => crypto.randomUUID()),
  };

  const profile = createManagedRepo('profile', store, fullContext);
  const settings = createManagedRepo('settings', store, fullContext);
  const progress = createManagedRepo('progress', store, fullContext);
  const records = createManagedRepo('records', store, fullContext);
  const stats = createManagedRepo('stats', store, fullContext);
  const saves = createManagedRepo('saves', store, fullContext);
  const eventLog = createManagedRepo('event-log', store, fullContext);
  const all = [profile, settings, progress, records, stats, saves, eventLog];

  return {
    profile: profile.repo,
    settings: settings.repo,
    progress: progress.repo,
    records: records.repo,
    stats: stats.repo,
    saves: saves.repo,
    'event-log': eventLog.repo,
    get persistent() {
      return store.persistent;
    },
    forgetAll() {
      store.clearAll();
      for (const item of all) item.forget();
    },
  };
}
