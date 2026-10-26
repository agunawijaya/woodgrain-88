/**
 * Tests for the game registry: base game catalog, slot sequencing, coming-soon
 * placeholders, secret counter slots, harness overrides and Label Wall grouping.
 */
import { validateRegistry } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { BASE_ENTRIES, createRegistry, wallRows } from '../src/data/registry.ts';
import { fakeManifest } from './fixtures/fake-game.ts';

const KEBAB_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('game registry', () => {
  it('contains 30 entries with slots exactly 1-30 and unique kebab-case ids in BASE_ENTRIES', () => {
    expect(BASE_ENTRIES).toHaveLength(30);

    const slots = BASE_ENTRIES.map((entry) => entry.manifest.slot).sort((a, b) => a - b);
    const expectedSlots = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(slots).toEqual(expectedSlots);

    const ids = BASE_ENTRIES.map((entry) => entry.manifest.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(30);

    for (const id of ids) {
      expect(id).toMatch(KEBAB_PATTERN);
    }
  });

  it('orders manifests by slot and reports zero validation issues from validateRegistry', () => {
    const registry = createRegistry();
    const slots = registry.manifests.map((manifest) => manifest.slot);
    const expectedSlots = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(slots).toEqual(expectedSlots);

    const problems = validateRegistry(registry.manifests);
    expect(problems).toEqual([]);
  });

  // Holds as games ship one by one: a playable game must bring its loader.
  it('gives a module loader to playable games and none to coming-soon ones', () => {
    for (const entry of BASE_ENTRIES) {
      expect(entry.load !== undefined).toBe(entry.manifest.status === 'playable');
    }
  });

  it('assigns counter slot 31 to lane-hopper and 32 to pier-derby as the only secret slots', () => {
    const secretsWithGame = BASE_ENTRIES.flatMap((entry) =>
      (entry.manifest.secrets ?? []).map((secret) => ({
        gameId: entry.manifest.id,
        counterSlot: secret.counterSlot,
      })),
    );

    const secretsSlot31 = secretsWithGame.filter((item) => item.counterSlot === 31);
    const secretsSlot32 = secretsWithGame.filter((item) => item.counterSlot === 32);

    expect(secretsSlot31).toHaveLength(1);
    expect(secretsSlot31[0]?.gameId).toBe('lane-hopper');

    expect(secretsSlot32).toHaveLength(1);
    expect(secretsSlot32[0]?.gameId).toBe('pier-derby');
  });

  it('keeps total count at 30 and places test fixture into slot 20 when overridden', () => {
    const hasFakeId = BASE_ENTRIES.some((entry) => entry.manifest.id === fakeManifest.id);
    expect(hasFakeId).toBe(false);

    const overriddenRegistry = createRegistry([{ manifest: fakeManifest }]);
    expect(overriddenRegistry.entries).toHaveLength(30);
    expect(overriddenRegistry.manifests).toHaveLength(30);

    const slot20Entry = overriddenRegistry.entryBySlot(20);
    expect(slot20Entry?.manifest.id).toBe(fakeManifest.id);
  });

  it('groups all 30 games into four wall rows with expected family sizes in slot order', () => {
    const manifests = createRegistry().manifests;
    const rows = wallRows(manifests);

    expect(rows.duels).toHaveLength(6);
    expect(rows.brain).toHaveLength(7);
    expect(rows.sports).toHaveLength(9);
    expect(rows.arcade).toHaveLength(8);

    const rowFamilies = [rows.duels, rows.brain, rows.sports, rows.arcade];
    for (const row of rowFamilies) {
      const rowSlots = row.map((manifest) => manifest.slot);
      const sortedSlots = [...rowSlots].sort((a, b) => a - b);
      expect(rowSlots).toEqual(sortedSlots);
    }

    const allRowManifests = [...rows.duels, ...rows.brain, ...rows.sports, ...rows.arcade];
    expect(allRowManifests).toHaveLength(30);

    const allRowIds = new Set(allRowManifests.map((manifest) => manifest.id));
    expect(allRowIds.size).toBe(30);

    const expectedIds = new Set(manifests.map((manifest) => manifest.id));
    expect(allRowIds).toEqual(expectedIds);
  });
});
