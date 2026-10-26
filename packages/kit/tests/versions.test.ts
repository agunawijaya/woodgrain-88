/**
 * Tests for cartridge version helpers: defaultVersion, alternateVersions, findVersion,
 * and candidate fallback resolution via resolveVersion.
 */
import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../src/contract.ts';
import {
  alternateVersions,
  defaultVersion,
  findVersion,
  resolveVersion,
  VERSION_SETTING,
} from '../src/versions.ts';

const WITH_VERSIONS: GameManifest = {
  id: 'test-game',
  slot: 1,
  title: 'Test Game',
  tagline: 'A game for testing',
  teaser: 'A longer teaser for testing.',
  family: 'arcade',
  players: '1–2P',
  versus: 'local',
  sessionMinutes: [2, 5],
  status: 'playable',
  scoreOrder: 'higher',
  accent: { day: '#112233', night: '#445566' },
  emblem: 'M0 0h10v10H0z',
  label: {
    pattern: 'stripes',
    paper: '#ffffff',
    ink: '#000000',
    band: '#000000',
    bandText: '#ffffff',
  },
  inspiredBy: {
    originalTitle: 'Original',
    uiTitle: 'the original',
    publisher: 'Test Publisher',
    year: 1980,
    cartridgeSlots: [1, 2],
  },
  controls: [{ keys: ['Space'], does: 'jump' }],
  channels: [{ id: 'classic', title: 'Classic', description: 'Classic channel' }],
  supports: { daily: false, challengeLinks: false, proSwitch: false, microChallenges: false },
  events: [],
  versions: [
    { id: 'first', label: 'First', cartridgeSlot: 1, description: 'First version' },
    { id: 'second', label: 'Second', cartridgeSlot: 2, description: 'Second version' },
  ],
};

const { versions: _versions, ...WITHOUT_VERSIONS_BASE } = WITH_VERSIONS;
const WITHOUT_VERSIONS: GameManifest = { ...WITHOUT_VERSIONS_BASE, id: 'single-game' };

describe('cartridge versions', () => {
  it('identifies the version setting key in game namespaces', () => {
    expect(VERSION_SETTING).toBe('cartridgeVersion');
  });

  it('returns the first version for defaultVersion and the rest for alternateVersions, or undefined/empty when without versions', () => {
    expect(defaultVersion(WITH_VERSIONS)).toEqual({
      id: 'first',
      label: 'First',
      cartridgeSlot: 1,
      description: 'First version',
    });
    expect(defaultVersion(WITHOUT_VERSIONS)).toBeUndefined();

    expect(alternateVersions(WITH_VERSIONS)).toEqual([
      {
        id: 'second',
        label: 'Second',
        cartridgeSlot: 2,
        description: 'Second version',
      },
    ]);
    expect(alternateVersions(WITHOUT_VERSIONS)).toEqual([]);
  });

  it('resolves the first declared candidate, skipping unknown, null, and undefined values and falling back to default or undefined', () => {
    expect(resolveVersion(WITH_VERSIONS, 'second')).toBe('second');
    expect(resolveVersion(WITH_VERSIONS, 'first')).toBe('first');

    // Skips unknown, null and undefined candidates to pick the first valid declared match
    expect(resolveVersion(WITH_VERSIONS, 'unknown', null, undefined, 'second', 'first')).toBe(
      'second',
    );

    // Falls back to default when no candidates match
    expect(resolveVersion(WITH_VERSIONS, null, undefined, 'unknown')).toBe('first');
    expect(resolveVersion(WITH_VERSIONS)).toBe('first');

    // Returns undefined for games that declare no versions
    expect(resolveVersion(WITHOUT_VERSIONS)).toBeUndefined();
    expect(resolveVersion(WITHOUT_VERSIONS, 'first', 'second')).toBeUndefined();
    expect(resolveVersion(WITHOUT_VERSIONS, null, undefined, 'unknown')).toBeUndefined();
  });

  it('finds declared versions by id or returns undefined for absent or nullish ids', () => {
    expect(findVersion(WITH_VERSIONS, 'first')?.label).toBe('First');
    expect(findVersion(WITH_VERSIONS, 'second')?.label).toBe('Second');
    expect(findVersion(WITH_VERSIONS, 'missing')).toBeUndefined();
    expect(findVersion(WITH_VERSIONS, null)).toBeUndefined();
    expect(findVersion(WITH_VERSIONS, undefined)).toBeUndefined();
    expect(findVersion(WITHOUT_VERSIONS, 'first')).toBeUndefined();
  });
});
