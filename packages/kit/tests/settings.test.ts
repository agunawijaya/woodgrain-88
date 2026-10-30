import { describe, expect, it } from 'vitest';
import { createSettings } from '../src/settings.ts';
import { defaults, type SchemaContext } from '../src/store/schema.ts';
import { fakeRepo } from './helpers/fake-repo.ts';

function makeContext(): SchemaContext {
  return {
    now: () => new Date('2026-10-25T12:00:00Z'),
    newId: () => 'id-1',
  };
}

describe('createSettings kids()', () => {
  it('reads the stored Kid setting and follows update', () => {
    const ctx = makeContext();
    const repo = fakeRepo(defaults('settings', ctx));
    const settings = createSettings(repo);

    expect(settings.kids()).toBe('human');

    settings.update((draft) => {
      draft.kids = 'sharp';
    });
    expect(settings.kids()).toBe('sharp');

    settings.update((draft) => {
      draft.kids = 'human';
    });
    expect(settings.kids()).toBe('human');

    settings.dispose();
  });
});
