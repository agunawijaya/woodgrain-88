// Unit tests for typed repositories: lazy loading, persistence, drafts and forgetAll.
import { describe, expect, it } from 'vitest';
import { createLocalStore, memoryBackend } from '../src/store/local-store.ts';
import { createRepositories } from '../src/store/repos.ts';
import type { SchemaContext } from '../src/store/schema.ts';

function makeContext(): SchemaContext {
  let counter = 0;
  return {
    now: () => new Date('2026-10-25T12:00:00Z'),
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
  };
}

describe('createRepositories', () => {
  it('loads defaults lazily on first get without persisting to the store', () => {
    const backend = memoryBackend();
    const store = createLocalStore(backend);
    const ctx = makeContext();
    const repos = createRepositories(store, ctx);

    expect(backend.keys()).toEqual([]);

    const profile = repos.profile.get();
    expect(profile.id).toBe('id-1');
    expect(profile.displayName).toBe('Player');
    expect(repos.profile.get()).toBe(profile);
    expect(backend.keys()).toEqual([]);
  });

  it('persists and notifies listeners on set, update and reset', () => {
    const backend = memoryBackend();
    const store = createLocalStore(backend);
    const ctx = makeContext();
    const repos = createRepositories(store, ctx);

    const names: string[] = [];
    const unsubscribe = repos.profile.onChange((value) => {
      names.push(value.displayName);
    });

    repos.profile.set({
      id: 'id-custom',
      displayName: '  Casey  ',
      avatar: { hue: 120, shape: 'square', pattern: 'stripes' },
      createdAt: '2026-10-25T12:00:00.000Z',
    });
    expect(repos.profile.get().displayName).toBe('Casey');

    const updated = repos.profile.update((draft) => {
      draft.displayName = 'Morgan';
      draft.avatar.hue = 200;
    });
    expect(updated.displayName).toBe('Morgan');
    expect(repos.profile.get().avatar.hue).toBe(200);

    repos.profile.reset();
    expect(repos.profile.get().displayName).toBe('Player');

    unsubscribe();
    repos.profile.set({ ...repos.profile.get(), displayName: 'Quiet' });
    expect(names).toEqual(['Casey', 'Morgan', 'Player']);
  });

  it('passes a deep copy to update so mutating the draft does not alter get()', () => {
    const store = createLocalStore(memoryBackend());
    const repos = createRepositories(store, makeContext());

    const initialHue = repos.profile.get().avatar.hue;
    let observedDuringUpdate = -1;

    repos.profile.update((draft) => {
      draft.avatar.hue = 300;
      observedDuringUpdate = repos.profile.get().avatar.hue;
    });

    expect(observedDuringUpdate).toBe(initialHue);
    expect(repos.profile.get().avatar.hue).toBe(300);
  });

  it('reads back data written by an earlier instance over the same backend', () => {
    const backend = memoryBackend();
    const first = createRepositories(createLocalStore(backend), makeContext());

    first.settings.update((draft) => {
      draft.muted = true;
      draft.volume.master = 0.5;
    });
    first.saves.set({
      games: {
        'laser-grid': {
          v: 1,
          savedAt: '2026-10-25T12:00:00.000Z',
          state: { level: 3 },
        },
      },
    });

    const second = createRepositories(createLocalStore(backend), makeContext());
    expect(second.settings.get().muted).toBe(true);
    expect(second.settings.get().volume.master).toBe(0.5);
    expect(second.saves.get().games['laser-grid']?.state).toEqual({ level: 3 });
  });

  it('clears stored keys and assigns a new profile id on forgetAll without writing', () => {
    const backend = memoryBackend({ foreign: 'stay' });
    const store = createLocalStore(backend);
    const repos = createRepositories(store, makeContext());

    const firstId = repos.profile.get().id;
    repos.profile.update((draft) => {
      draft.displayName = 'Alex';
    });
    repos.settings.update((draft) => {
      draft.muted = true;
    });
    expect(backend.getItem('wg88:profile')).not.toBeNull();
    expect(backend.getItem('wg88:settings')).not.toBeNull();

    repos.forgetAll();

    expect(backend.keys()).toEqual(['foreign']);
    expect(repos.profile.get().displayName).toBe('Player');
    expect(repos.profile.get().id).not.toBe(firstId);
    expect(repos.settings.get().muted).toBe(false);
    expect(backend.keys()).toEqual(['foreign']);
  });
});
