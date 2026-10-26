/**
 * Unit tests for channel registry lookup, unlock rules, and manifest validation.
 */
import { describe, expect, it } from 'vitest';
import {
  type ChannelDef,
  createChannelRegistry,
  MAX_CHANNELS,
  validateChannels,
} from '../src/channels.ts';
import type { ProgressData } from '../src/store/types.ts';
import { emptyDenLife } from '../src/store/schema.ts';
import { fakeRepo } from './helpers/fake-repo.ts';

const TANK_CHANNELS: readonly ChannelDef[] = [
  {
    id: 'open-field',
    kind: 'original',
    title: 'Open Field',
    description: 'Clear arena with long sightlines and standard shells.',
  },
  {
    id: 'billiard-walls',
    kind: 'original',
    title: 'Billiard Walls',
    description: 'Shots bank off walls before they hit the opposing tank.',
  },
  {
    id: 'fog-bank',
    kind: 'original',
    title: 'Fog Bank',
    description: 'Opponents appear briefly when they fire or move at top speed.',
  },
];

describe('createChannelRegistry', () => {
  it('lists channels in manifest order with EVERY_CHANNEL_OPEN by default', () => {
    const progress = fakeRepo<ProgressData>({ games: {}, den: emptyDenLife() });
    const registry = createChannelRegistry({
      games: [{ id: 'tank-duel', channels: TANK_CHANNELS }],
      progress,
    });

    expect(registry.list('tank-duel')).toEqual([
      { ...TANK_CHANNELS[0], index: 0, unlocked: true },
      { ...TANK_CHANNELS[1], index: 1, unlocked: true },
      { ...TANK_CHANNELS[2], index: 2, unlocked: true },
    ]);
    expect(registry.defaultChannel('tank-duel')).toEqual(TANK_CHANNELS[0]);
    expect(registry.get('tank-duel', 'billiard-walls')).toEqual({
      ...TANK_CHANNELS[1],
      index: 1,
      unlocked: true,
    });
    expect(registry.isUnlocked('tank-duel', 'fog-bank')).toBe(true);
  });

  it('handles unknown games, unknown channels, and games with no channels', () => {
    const progress = fakeRepo<ProgressData>({ games: {}, den: emptyDenLife() });
    const registry = createChannelRegistry({
      games: [
        { id: 'tank-duel', channels: TANK_CHANNELS },
        { id: 'empty-game', channels: [] },
      ],
      progress,
    });

    expect(registry.list('unknown-game')).toEqual([]);
    expect(registry.get('unknown-game', 'open-field')).toBeNull();
    expect(registry.get('tank-duel', 'missing-channel')).toBeNull();
    expect(registry.isUnlocked('unknown-game', 'open-field')).toBe(false);
    expect(registry.isUnlocked('tank-duel', 'missing-channel')).toBe(false);

    expect(() => registry.defaultChannel('unknown-game')).toThrow('unknown-game has no channels');
    expect(() => registry.defaultChannel('empty-game')).toThrow('empty-game has no channels');
  });

  it('evaluates custom unlock rules and persisted unlocks in progress', () => {
    const progress = fakeRepo<ProgressData>({ games: {}, den: emptyDenLife() });
    const fixedNow = () => new Date('2026-10-25T19:00:00.000Z');
    const registry = createChannelRegistry({
      games: [{ id: 'tank-duel', channels: TANK_CHANNELS }],
      progress,
      rule: (_gameId, _channel, index) => index === 0,
      now: fixedNow,
    });

    expect(registry.isUnlocked('tank-duel', 'open-field')).toBe(true);
    expect(registry.isUnlocked('tank-duel', 'billiard-walls')).toBe(false);
    expect(registry.isUnlocked('tank-duel', 'fog-bank')).toBe(false);

    expect(registry.unlock('tank-duel', 'billiard-walls')).toBe(true);
    expect(registry.unlock('tank-duel', 'billiard-walls')).toBe(false);

    expect(progress.get().games['tank-duel']).toEqual({
      patches: {},
      channels: {
        'billiard-walls': { unlockedAt: '2026-10-25T19:00:00.000Z' },
      },
      firstPlayedAt: null,
      versionsFinished: {},
    });

    expect(registry.isUnlocked('tank-duel', 'billiard-walls')).toBe(true);
    expect(registry.get('tank-duel', 'billiard-walls')?.unlocked).toBe(true);
    expect(registry.isUnlocked('tank-duel', 'fog-bank')).toBe(false);
  });
});

describe('validateChannels', () => {
  it('accepts a valid channel list and rejects count, id, title, and description errors', () => {
    expect(validateChannels(TANK_CHANNELS)).toEqual([]);

    expect(validateChannels([]).length).toBeGreaterThan(0);

    const tooMany: ChannelDef[] = Array.from({ length: MAX_CHANNELS + 1 }, (_, i) => ({
      id: `ch-${i + 1}`,
      kind: 'original',
      title: `Channel ${i + 1}`,
      description: 'Valid description.',
    }));
    expect(validateChannels(tooMany).length).toBeGreaterThan(0);

    const invalidItems: ChannelDef[] = [
      { id: 'Bad_Id', kind: 'original', title: 'Bad Id', description: 'Non-kebab id.' },
      { id: 'dup-id', kind: 'original', title: 'First', description: 'First with id.' },
      { id: 'dup-id', kind: 'original', title: 'Second', description: 'Duplicate id.' },
      { id: 'empty-title', kind: 'original', title: '', description: 'Valid description.' },
      {
        id: 'long-title',
        kind: 'original',
        title: 'This Channel Title Is Definitely Too Long',
        description: 'Valid description.',
      },
      { id: 'empty-desc', kind: 'original', title: 'Empty Desc', description: '' },
      {
        id: 'long-desc',
        kind: 'original',
        title: 'Long Desc',
        description:
          'This channel description exceeds ninety characters so the validator will reject it right away.',
      },
    ];
    expect(validateChannels(invalidItems).length).toBeGreaterThanOrEqual(6);
  });
});
