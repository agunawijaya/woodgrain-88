/**
 * Tests for the Counter's slot cycle: 32-place wrapping, step sequence generation,
 * version places, digit formatting and deterministic daily game selection.
 */
import { powerCycleOfTheDay, type ProgressData, emptyDenLife } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import {
  counterDigits,
  counterPlaces,
  cycleSlots,
  isVersionPlace,
  nextSlot,
  placeFinished,
} from '../src/data/cycle.ts';
import { createRegistry } from '../src/data/registry.ts';
import { fakeManifest } from './fixtures/fake-game.ts';

describe('slot cycling and counter', () => {
  it('steps forward 30 -> 31 -> 32 -> 1 and backward 1 -> 32 -> 31 -> 30 with nextSlot', () => {
    expect(nextSlot(30, 1)).toBe(31);
    expect(nextSlot(31, 1)).toBe(32);
    expect(nextSlot(32, 1)).toBe(1);

    expect(nextSlot(1, -1)).toBe(32);
    expect(nextSlot(32, -1)).toBe(31);
    expect(nextSlot(31, -1)).toBe(30);
  });

  it('generates sequences wrapping around the counter boundaries with cycleSlots', () => {
    expect(cycleSlots(29, 1, 5)).toEqual([30, 31, 32, 1, 2]);
    expect(cycleSlots(2, -1, 3)).toEqual([1, 32, 31]);
  });

  it('marks only places 31 and 32 as version places and pads counter digits to two places', () => {
    expect(isVersionPlace(31)).toBe(true);
    expect(isVersionPlace(32)).toBe(true);

    for (let slot = 1; slot <= 30; slot++) {
      expect(isVersionPlace(slot)).toBe(false);
    }
    expect(isVersionPlace(0)).toBe(false);
    expect(isVersionPlace(33)).toBe(false);

    expect(counterDigits(7)).toBe('07');
    expect(counterDigits(32)).toBe('32');
  });

  it('yields null for all-unreleased registry and returns the overridden fixture for any date', () => {
    const baseManifests = createRegistry().manifests;
    const testDates = [
      new Date('2026-10-25T12:00:00.000Z'),
      new Date('2026-10-26T12:00:00.000Z'),
      new Date('2027-01-01T00:00:00.000Z'),
    ];

    for (const date of testDates) {
      expect(powerCycleOfTheDay(baseManifests, date)).toBeNull();
    }

    const overriddenManifests = createRegistry([{ manifest: fakeManifest }]).manifests;
    for (const date of testDates) {
      const pick = powerCycleOfTheDay(overriddenManifests, date);
      expect(pick).not.toBeNull();
      expect(pick?.id).toBe(fakeManifest.id);
    }
  });

  it('orders counterPlaces 1-32 with base registry version placements and reflects fixture override', () => {
    const baseManifests = createRegistry().manifests;
    const places = counterPlaces(baseManifests);

    expect(places).toHaveLength(32);
    expect(places.map((p) => p.slot)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));

    const place11 = places.find((p) => p.slot === 11);
    expect(place11?.manifest.id).toBe('lane-hopper');
    expect(place11?.version?.id).toBe('chicken');

    const place15 = places.find((p) => p.slot === 15);
    expect(place15?.manifest.id).toBe('pier-derby');
    expect(place15?.version?.id).toBe('derby');

    const place31 = places.find((p) => p.slot === 31);
    expect(place31?.manifest.id).toBe('lane-hopper');
    expect(place31?.version?.id).toBe('rabbit');

    const place32 = places.find((p) => p.slot === 32);
    expect(place32?.manifest.id).toBe('pier-derby');
    expect(place32?.version?.id).toBe('hack');

    const overriddenManifests = createRegistry([{ manifest: fakeManifest }]).manifests;
    const overriddenPlaces = counterPlaces(overriddenManifests);

    const overridden31 = overriddenPlaces.find((p) => p.slot === 31);
    expect(overridden31?.manifest.id).toBe('test-paddles');
    expect(overridden31?.version?.id).toBe('tall');

    const overridden32 = overriddenPlaces.find((p) => p.slot === 32);
    expect(overridden32?.manifest.id).toBe('pier-derby');
    expect(overridden32?.version?.id).toBe('hack');
  });

  it('lights places 1–30 with a first patch, and 31–32 only with their own version finished', () => {
    const places = counterPlaces(createRegistry().manifests);
    const place1 = places.find((p) => p.slot === 1);
    const place11 = places.find((p) => p.slot === 11);
    const place31 = places.find((p) => p.slot === 31);

    if (!place1 || !place11 || !place31) {
      throw new Error('Expected places 1, 11, and 31 to exist');
    }

    const earned = { value: 1, earnedAt: '2026-10-25T12:00:00Z', gold: false };
    const gameWith = (
      patches: ProgressData['games'][string]['patches'],
      versionsFinished: Record<string, string> = {},
    ) => ({
      patches,
      channels: {},
      firstPlayedAt: '2026-10-25T12:00:00Z',
      versionsFinished,
    });

    // Places 1–30 light with the game's first patch, not with plays.
    const empty: ProgressData = { games: {}, den: emptyDenLife() };
    expect(placeFinished(place1, empty)).toBe(false);
    const firstPatch: ProgressData = {
      games: { [place1.manifest.id]: gameWith({ club: earned }) },
      den: emptyDenLife(),
    };
    expect(placeFinished(place1, firstPatch)).toBe(true);
    const inProgressOnly: ProgressData = {
      games: {
        [place1.manifest.id]: gameWith({ club: { value: 1, earnedAt: null, gold: false } }),
      },
      den: emptyDenLife(),
    };
    expect(placeFinished(place1, inProgressOnly)).toBe(false);

    // A merged game's own place follows the patch rule too; finishing a version does not light it.
    const chickenFinished: ProgressData = {
      games: { 'lane-hopper': gameWith({}, { chicken: '2026-10-25T12:00:00Z' }) },
      den: emptyDenLife(),
    };
    expect(placeFinished(place11, chickenFinished)).toBe(false);
    expect(placeFinished(place31, chickenFinished)).toBe(false);

    // Place 31 lights only with its own version finished.
    const rabbitFinished: ProgressData = {
      games: { 'lane-hopper': gameWith({}, { rabbit: '2026-10-25T12:00:00Z' }) },
      den: emptyDenLife(),
    };
    expect(placeFinished(place31, rabbitFinished)).toBe(true);
  });
});
