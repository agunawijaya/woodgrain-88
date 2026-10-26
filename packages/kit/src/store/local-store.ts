/**
 * The only door to persistence (docs/adr/0006-store.md). Nothing else in the
 * Hall, the kit or a game touches localStorage; `pnpm check` enforces it.
 *
 * Each repository is one JSON document under `wg88:<name>`, wrapped as
 * `{ "v": <schema version>, "data": ... }`. The store never throws at its
 * callers: in private mode, with storage full or disabled, it keeps working in
 * memory and reports `persistent: false` so the UI can say so once.
 */
import { createEmitter, type Unsubscribe } from '../emitter.ts';

/** The repositories that exist. Adding one means adding a migration chain in schema.ts. */
export const REPO_NAMES = [
  'profile',
  'settings',
  'progress',
  'records',
  'stats',
  'saves',
  'event-log',
] as const;
export type RepoName = (typeof REPO_NAMES)[number];

export const STORE_NAMESPACE = 'wg88';

/** The minimal storage surface the store needs; localStorage and a Map both fit. */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Every key currently stored, so clearAll can find ours. */
  keys(): string[];
}

/** A stored document: its schema version and its data. */
export interface Envelope<T> {
  v: number;
  data: T;
}

export interface LocalStore {
  /** The repository's data, or undefined when it has never been written or cannot be parsed. */
  read(name: RepoName): Envelope<unknown> | undefined;
  write(name: RepoName, envelope: Envelope<unknown>): void;
  remove(name: RepoName): void;
  /** Removes every `wg88:` key and nothing else. */
  clearAll(): void;
  /** False when storage is unavailable and the store fell back to memory. */
  readonly persistent: boolean;
  /** Fires after any write, remove or clear, with the repository name (null for clearAll). */
  onChange(listener: (name: RepoName | null) => void): Unsubscribe;
}

const PROBE_KEY = `${STORE_NAMESPACE}:probe`;

function storageKey(name: RepoName): string {
  return `${STORE_NAMESPACE}:${name}`;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * localStorage when it works (probed with a write and a read of a test key),
 * otherwise a memory backend. Never throws.
 */
export function browserBackend(): { backend: StorageBackend; persistent: boolean } {
  try {
    if (typeof localStorage === 'undefined') {
      return { backend: memoryBackend(), persistent: false };
    }
    const storage = localStorage;
    storage.setItem(PROBE_KEY, '1');
    const readBack = storage.getItem(PROBE_KEY);
    storage.removeItem(PROBE_KEY);
    if (readBack !== '1') {
      return { backend: memoryBackend(), persistent: false };
    }
    return {
      backend: {
        getItem(key) {
          return storage.getItem(key);
        },
        setItem(key, value) {
          storage.setItem(key, value);
        },
        removeItem(key) {
          storage.removeItem(key);
        },
        keys() {
          const result: string[] = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key !== null) result.push(key);
          }
          return result;
        },
      },
      persistent: true,
    };
  } catch {
    return { backend: memoryBackend(), persistent: false };
  }
}

export function memoryBackend(seed?: Record<string, string>): StorageBackend {
  const map = new Map<string, string>(seed ? Object.entries(seed) : undefined);
  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    keys() {
      return [...map.keys()];
    },
  };
}

/**
 * Wraps a backend. Reads that fail to parse return undefined (and are left in
 * place for a later export to rescue). Writes that throw (quota exceeded)
 * switch the store to memory for the rest of the session and set
 * `persistent` to false, keeping the latest data in memory.
 */
export function createLocalStore(
  backend: StorageBackend,
  options?: { persistent?: boolean },
): LocalStore {
  let active = backend;
  let isPersistent = options?.persistent ?? true;
  const changes = createEmitter<RepoName | null>();
  const prefix = `${STORE_NAMESPACE}:`;

  function switchToMemory(): void {
    const snapshot: Record<string, string> = {};
    try {
      for (const key of active.keys()) {
        const val = active.getItem(key);
        if (val !== null) snapshot[key] = val;
      }
    } catch {
      // Ignore read failures while rescuing keys from a failing backend.
    }
    active = memoryBackend(snapshot);
    isPersistent = false;
  }

  return {
    read(name) {
      try {
        const raw = active.getItem(storageKey(name));
        if (raw === null) return undefined;
        const parsed: unknown = JSON.parse(raw);
        if (!isPlainObject(parsed)) return undefined;
        const version = parsed.v;
        if (typeof version !== 'number' || !Number.isInteger(version) || !('data' in parsed)) {
          return undefined;
        }
        return { v: version, data: parsed.data };
      } catch {
        return undefined;
      }
    },
    write(name, envelope) {
      const serialized = JSON.stringify({ v: envelope.v, data: envelope.data });
      try {
        active.setItem(storageKey(name), serialized);
      } catch {
        switchToMemory();
        active.setItem(storageKey(name), serialized);
      }
      changes.emit(name);
    },
    remove(name) {
      try {
        active.removeItem(storageKey(name));
      } catch {
        switchToMemory();
        active.removeItem(storageKey(name));
      }
      changes.emit(name);
    },
    clearAll() {
      try {
        for (const key of [...active.keys()]) {
          if (key.startsWith(prefix)) active.removeItem(key);
        }
      } catch {
        switchToMemory();
        for (const key of [...active.keys()]) {
          if (key.startsWith(prefix)) active.removeItem(key);
        }
      }
      changes.emit(null);
    },
    get persistent() {
      return isPersistent;
    },
    onChange(listener) {
      return changes.on(listener);
    },
  };
}
