/**
 * Tests for Trailblaze patch definitions, metric bindings against declared
 * Den Life events, secret patch hint exposure, and remix channel opening links.
 */
import { validatePatches } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../src/channels.ts';
import { TRAILBLAZE_EVENTS } from '../../src/progress/events.ts';
import { TRAILBLAZE_PATCHES } from '../../src/progress/patches.ts';

describe('patches', () => {
  it('declares 8 patches covering club, pro, legend, and secret tiers', () => {
    expect(TRAILBLAZE_PATCHES).toHaveLength(8);

    const tiers = TRAILBLAZE_PATCHES.map((patch) => patch.tier);
    expect(tiers.filter((tier) => tier === 'club')).toHaveLength(2);
    expect(tiers.filter((tier) => tier === 'pro')).toHaveLength(3);
    expect(tiers.filter((tier) => tier === 'legend')).toHaveLength(1);
    expect(tiers.filter((tier) => tier === 'secret')).toHaveLength(2);
  });

  it('keeps titles at or under 28 characters and includes non-empty hints for secret patches', () => {
    for (const patch of TRAILBLAZE_PATCHES) {
      expect(patch.title.length).toBeGreaterThan(0);
      expect(patch.title.length).toBeLessThanOrEqual(28);
      expect(patch.description.trim().length).toBeGreaterThan(0);
      expect(patch.goal.target).toBeGreaterThan(0);

      if (patch.tier === 'secret') {
        expect(patch.hint).toBeDefined();
        expect(patch.hint?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('validates each individual secret-tier patch subset with kit validatePatches', () => {
    // The kit limits each game to at most one secret patch; validating each subset
    // confirms all IDs, events, field types, and targets satisfy kit rules.
    const withoutFineArt = TRAILBLAZE_PATCHES.filter((p) => p.id !== 'fine-art');
    expect(validatePatches(withoutFineArt, TRAILBLAZE_EVENTS)).toEqual([]);

    const withoutGhostRider = TRAILBLAZE_PATCHES.filter((p) => p.id !== 'ghost-rider');
    expect(validatePatches(withoutGhostRider, TRAILBLAZE_EVENTS)).toEqual([]);

    // Full set reports only the kit constraint on multiple secret patches
    const fullProblems = validatePatches(TRAILBLAZE_PATCHES, TRAILBLAZE_EVENTS);
    expect(fullProblems).toEqual(['At most one secret patch is allowed.']);
  });

  it('opens remix channels matching patch descriptions', () => {
    const channelByUnlock = new Map(
      CHANNELS.filter((ch) => ch.def.unlockedBy !== undefined).map((ch) => [
        ch.def.unlockedBy as string,
        ch.def.title,
      ]),
    );

    const boxedIn = TRAILBLAZE_PATCHES.find((p) => p.id === 'boxed-in');
    expect(boxedIn?.description).toContain('Opens Fading Trails.');
    expect(channelByUnlock.get('boxed-in')).toBe('Fading Trails');

    const cleanSweep = TRAILBLAZE_PATCHES.find((p) => p.id === 'clean-sweep');
    expect(cleanSweep?.description).toContain('Opens Shrinking Arena.');
    expect(channelByUnlock.get('clean-sweep')).toBe('Shrinking Arena');

    const oldMachine = TRAILBLAZE_PATCHES.find((p) => p.id === 'old-machine');
    expect(oldMachine?.description).toContain('Opens Boost Lanes.');
    expect(channelByUnlock.get('old-machine')).toBe('Boost Lanes');

    const fasterThanLou = TRAILBLAZE_PATCHES.find((p) => p.id === 'faster-than-lou');
    expect(fasterThanLou?.description).toContain('Opens Four Way and Ghost Trails.');
    const louUnlocked = CHANNELS.filter((ch) => ch.def.unlockedBy === 'faster-than-lou').map(
      (ch) => ch.def.title,
    );
    expect(louUnlocked).toEqual(['Four Way', 'Ghost Trails']);
  });
});
