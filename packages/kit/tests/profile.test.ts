/**
 * Tests for display-name validation, deterministic avatar generation and the
 * profile API over an in-memory repository.
 */
import { describe, expect, it } from 'vitest';
import {
  createProfile,
  DISPLAY_NAME_MAX,
  randomAvatar,
  validateDisplayName,
} from '../src/profile.ts';
import { createRng } from '../src/rng.ts';
import type { Repository } from '../src/store/repos.ts';
import type { ProfileData } from '../src/store/types.ts';

function createMemoryProfileRepo(initial?: Partial<ProfileData>): Repository<ProfileData> {
  const defaultData: ProfileData = {
    id: 'player-1',
    displayName: 'Player',
    avatar: { hue: 28, shape: 'round', pattern: 'plain' },
    createdAt: '2026-10-25T00:00:00.000Z',
    ...initial,
  };
  let current: ProfileData = structuredClone(defaultData);
  const listeners = new Set<(value: ProfileData) => void>();

  return {
    get() {
      return current;
    },
    set(value) {
      current = structuredClone(value);
      for (const listener of listeners) listener(current);
    },
    update(change) {
      const draft = structuredClone(current);
      change(draft);
      current = draft;
      for (const listener of listeners) listener(current);
      return current;
    },
    reset() {
      current = structuredClone(defaultData);
      for (const listener of listeners) listener(current);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

describe('validateDisplayName', () => {
  it('trims and collapses inner whitespace runs to a single space', () => {
    expect(validateDisplayName('  Robin   of   Locksley  ')).toEqual({
      ok: true,
      value: 'Robin of Locksley',
    });
  });

  it('rejects empty names and names longer than 20 characters', () => {
    expect(validateDisplayName('   ')).toEqual({
      ok: false,
      reason: 'Pick a name with 1 to 20 characters.',
    });
    expect(validateDisplayName('A'.repeat(DISPLAY_NAME_MAX))).toEqual({
      ok: true,
      value: 'A'.repeat(DISPLAY_NAME_MAX),
    });
    expect(validateDisplayName('A'.repeat(DISPLAY_NAME_MAX + 1))).toEqual({
      ok: false,
      reason: 'Pick a name with 1 to 20 characters.',
    });
  });

  it('rejects control characters with a friendly message', () => {
    expect(validateDisplayName('Player\u0007One')).toEqual({
      ok: false,
      reason: 'Letters, numbers and spaces work best.',
    });
    expect(validateDisplayName('Player\u0000One')).toEqual({
      ok: false,
      reason: 'Letters, numbers and spaces work best.',
    });
  });

  it('rejects deny-listed words even when disguised with digits and punctuation', () => {
    expect(validateDisplayName('Capt. $h.1.7!')).toEqual({
      ok: false,
      reason: "Let's pick a different name.",
    });
    expect(validateDisplayName('B-4-5-7-4-r-d')).toEqual({
      ok: false,
      reason: "Let's pick a different name.",
    });
  });

  it('allows normal names and places like Scunthorpe and Cassandra', () => {
    expect(validateDisplayName('Scunthorpe')).toEqual({
      ok: true,
      value: 'Scunthorpe',
    });
    expect(validateDisplayName('Cassandra')).toEqual({
      ok: true,
      value: 'Cassandra',
    });
  });
});

describe('randomAvatar', () => {
  it('generates deterministic valid avatars for a seeded Rng', () => {
    const first = randomAvatar(createRng('oak-tv-88'));
    const second = randomAvatar(createRng('oak-tv-88'));
    expect(first).toEqual(second);
    expect(first.hue).toBeGreaterThanOrEqual(0);
    expect(first.hue).toBeLessThanOrEqual(359);
    expect(['round', 'square', 'tall']).toContain(first.shape);
    expect(['plain', 'stripes', 'dots', 'checks']).toContain(first.pattern);
  });
});

describe('createProfile', () => {
  it('reads profile data, renames only when valid and wraps avatar hue into 0-359', () => {
    const repo = createMemoryProfileRepo();
    const profile = createProfile(repo);

    expect(profile.get().displayName).toBe('Player');

    const bad = profile.rename('   ');
    expect(bad.ok).toBe(false);
    expect(profile.get().displayName).toBe('Player');

    const good = profile.rename('  Maple   Kid  ');
    expect(good).toEqual({ ok: true, value: 'Maple Kid' });
    expect(profile.get().displayName).toBe('Maple Kid');

    profile.setAvatar({ hue: -30, shape: 'tall', pattern: 'stripes' });
    expect(profile.get().avatar).toEqual({ hue: 330, shape: 'tall', pattern: 'stripes' });

    profile.setAvatar({ hue: 725, shape: 'square', pattern: 'dots' });
    expect(profile.get().avatar).toEqual({ hue: 5, shape: 'square', pattern: 'dots' });
  });
});
