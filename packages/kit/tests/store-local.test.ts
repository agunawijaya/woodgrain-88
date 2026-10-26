// Unit tests for the low-level key-value store, memory fallback and browser probe.
import { describe, expect, it } from 'vitest';
import {
  browserBackend,
  createLocalStore,
  memoryBackend,
  type StorageBackend,
} from '../src/store/local-store.ts';

describe('createLocalStore', () => {
  it('round-trips envelopes through read, write and remove', () => {
    const backend = memoryBackend();
    const store = createLocalStore(backend);

    expect(store.persistent).toBe(true);
    expect(store.read('profile')).toBeUndefined();

    store.write('profile', { v: 1, data: { displayName: 'Ada' } });
    expect(store.read('profile')).toEqual({ v: 1, data: { displayName: 'Ada' } });
    expect(backend.getItem('wg88:profile')).toBe(
      JSON.stringify({ v: 1, data: { displayName: 'Ada' } }),
    );

    store.remove('profile');
    expect(store.read('profile')).toBeUndefined();
    expect(backend.getItem('wg88:profile')).toBeNull();
  });

  it('returns undefined for corrupt JSON and malformed envelope shapes without throwing', () => {
    const backend = memoryBackend({
      'wg88:profile': '{not-valid-json',
      'wg88:settings': JSON.stringify('just-a-string'),
      'wg88:progress': JSON.stringify([1, 2, 3]),
      'wg88:records': JSON.stringify({ v: 1.5, data: {} }),
      'wg88:stats': JSON.stringify({ v: '1', data: {} }),
      'wg88:saves': JSON.stringify({ v: 1 }),
    });
    const store = createLocalStore(backend);

    expect(store.read('profile')).toBeUndefined();
    expect(store.read('settings')).toBeUndefined();
    expect(store.read('progress')).toBeUndefined();
    expect(store.read('records')).toBeUndefined();
    expect(store.read('stats')).toBeUndefined();
    expect(store.read('saves')).toBeUndefined();
    // Corrupt raw data remains untouched in the backend so an export or fix can inspect it.
    expect(backend.getItem('wg88:profile')).toBe('{not-valid-json');
  });

  it('removes only wg88: keys on clearAll and leaves foreign keys intact', () => {
    const backend = memoryBackend({
      'wg88:profile': JSON.stringify({ v: 1, data: { id: 'p1' } }),
      'wg88:settings': JSON.stringify({ v: 1, data: { muted: true } }),
      'other:theme': 'dark',
      unrelated: 'keep-me',
    });
    const store = createLocalStore(backend);

    store.clearAll();

    expect(store.read('profile')).toBeUndefined();
    expect(store.read('settings')).toBeUndefined();
    expect(backend.getItem('other:theme')).toBe('dark');
    expect(backend.getItem('unrelated')).toBe('keep-me');
  });

  it('switches to memory when setItem throws, preserving existing and newly written data', () => {
    const underlying = memoryBackend({
      'wg88:profile': JSON.stringify({ v: 1, data: { id: 'existing' } }),
    });
    let failWrites = false;
    const quotaBackend: StorageBackend = {
      getItem: (key) => underlying.getItem(key),
      setItem: (key, value) => {
        if (failWrites) {
          throw new Error('QuotaExceededError');
        }
        underlying.setItem(key, value);
      },
      removeItem: (key) => {
        underlying.removeItem(key);
      },
      keys: () => underlying.keys(),
    };

    const store = createLocalStore(quotaBackend, { persistent: true });
    expect(store.persistent).toBe(true);

    failWrites = true;
    store.write('settings', { v: 1, data: { muted: true } });

    expect(store.persistent).toBe(false);
    expect(store.read('profile')).toEqual({ v: 1, data: { id: 'existing' } });
    expect(store.read('settings')).toEqual({ v: 1, data: { muted: true } });
  });

  it('notifies onChange listeners after write, remove and clearAll', () => {
    const store = createLocalStore(memoryBackend());
    const events: (string | null)[] = [];
    const unsubscribe = store.onChange((name) => {
      events.push(name);
    });

    store.write('profile', { v: 1, data: {} });
    store.remove('profile');
    store.clearAll();
    unsubscribe();
    store.write('settings', { v: 1, data: {} });

    expect(events).toEqual(['profile', 'profile', null]);
  });
});

describe('browserBackend', () => {
  it('uses localStorage when available and falls back to memory when localStorage throws', () => {
    const working = browserBackend();
    expect(working.persistent).toBe(true);
    working.backend.setItem('wg88:test', 'ok');
    expect(working.backend.getItem('wg88:test')).toBe('ok');
    expect(working.backend.keys()).toContain('wg88:test');
    working.backend.removeItem('wg88:test');
    expect(working.backend.getItem('wg88:test')).toBeNull();

    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): Storage {
        throw new Error('SecurityError');
      },
    });
    try {
      const fallback = browserBackend();
      expect(fallback.persistent).toBe(false);
      fallback.backend.setItem('wg88:key', 'value');
      expect(fallback.backend.getItem('wg88:key')).toBe('value');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      }
    }
  });
});
