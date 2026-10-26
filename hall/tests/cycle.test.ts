/**
 * Tests for the Counter's slot cycle: 32-place wrapping, step sequence generation,
 * secret slot flags, digit formatting and deterministic daily game selection.
 */
import { powerCycleOfTheDay } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { counterDigits, cycleSlots, isSecretSlot, nextSlot } from '../src/data/cycle.ts';
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

  it('returns true only for secret slots 31 and 32 and pads counter digits to two places', () => {
    expect(isSecretSlot(31)).toBe(true);
    expect(isSecretSlot(32)).toBe(true);

    for (let slot = 1; slot <= 30; slot++) {
      expect(isSecretSlot(slot)).toBe(false);
    }
    expect(isSecretSlot(0)).toBe(false);
    expect(isSecretSlot(33)).toBe(false);

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
});
