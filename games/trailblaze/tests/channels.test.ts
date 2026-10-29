/**
 * Tests for Trailblaze channels: the 14 cartridge originals, the 5 Remix
 * variations, channel validation against kit rules, channel facts inspection,
 * remix patch unlock links, and Boost Lanes layout symmetry.
 */
import { validateChannels, validateRemixUnlocks } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { cellAt, columnOf, rowOf } from '../src/engine/grid.ts';
import {
  BOOST_LANES,
  CHANNELS,
  channelById,
  channelFacts,
  type TrailblazeChannel,
} from '../src/channels.ts';
import { TRAILBLAZE_PATCHES } from '../src/progress/patches.ts';

describe('channels', () => {
  it('contains exactly 19 channels with unique kebab-case ids in catalog order', () => {
    expect(CHANNELS).toHaveLength(19);

    const ids = CHANNELS.map((ch) => ch.def.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(19);

    const expectedIds = [
      'game-1',
      'game-2',
      'game-3',
      'game-4',
      'game-5',
      'game-6',
      'game-7',
      'game-8',
      'game-9',
      'game-10',
      'game-11',
      'game-12',
      'game-13',
      'game-14',
      'fading-trails',
      'shrinking-arena',
      'boost-lanes',
      'four-way',
      'ghost-trails',
    ];
    expect(ids).toEqual(expectedIds);
  });

  it('validates every channel definition against kit rules without problems', () => {
    const problems = validateChannels(CHANNELS.map((ch) => ch.def));
    expect(problems).toEqual([]);
  });

  it('finds channels by id and returns undefined for unknown ids', () => {
    expect(channelById('game-1')?.def.title).toBe('Classic');
    expect(channelById('four-way')?.riders).toBe(4);
    expect(channelById('unknown-id')).toBeUndefined();
  });

  it('reports expected channel facts for channels 1, 7, 12, and 13', () => {
    const ch1 = channelById('game-1') as TrailblazeChannel;
    expect(channelFacts(ch1)).toEqual({
      speed: 'constant',
      edges: 'bordered',
      steering: 4,
      fire: 'none',
    });

    const ch7 = channelById('game-7') as TrailblazeChannel;
    expect(channelFacts(ch7)).toEqual({
      speed: 'speed-up',
      edges: 'bordered',
      steering: 8,
      fire: 'gaps',
    });

    const ch12 = channelById('game-12') as TrailblazeChannel;
    expect(channelFacts(ch12)).toEqual({
      speed: 'speed-up',
      edges: 'wraparound',
      steering: 8,
      fire: 'gaps',
    });

    const ch13 = channelById('game-13') as TrailblazeChannel;
    expect(channelFacts(ch13)).toEqual({
      speed: 'constant',
      edges: 'wraparound',
      steering: 4,
      fire: 'erase',
    });
  });

  it('assigns 4 riders only to four-way and 2 riders to all other channels', () => {
    for (const channel of CHANNELS) {
      if (channel.def.id === 'four-way') {
        expect(channel.riders).toBe(4);
      } else {
        expect(channel.riders).toBe(2);
      }
    }
  });

  it('ensures every remix channel unlockedBy names an existing patch', () => {
    const patchIds = TRAILBLAZE_PATCHES.map((p) => p.id);
    const problems = validateRemixUnlocks(
      CHANNELS.map((ch) => ch.def),
      patchIds,
    );
    expect(problems).toEqual([]);
  });

  it('defines BOOST_LANES without duplicates and symmetric under a 180-degree rotation', () => {
    expect(BOOST_LANES.length).toBe(56);
    const uniqueCells = new Set(BOOST_LANES);
    expect(uniqueCells.size).toBe(56);

    for (const cell of BOOST_LANES) {
      const col = columnOf(cell);
      const row = rowOf(cell);
      const rotatedCol = 39 - col;
      const rotatedRow = 19 - row;
      const rotatedCell = cellAt(rotatedCol, rotatedRow);
      expect(uniqueCells.has(rotatedCell)).toBe(true);
    }
  });
});
