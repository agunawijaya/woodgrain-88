/**
 * Pins the Hall's channel groups: game-1 is its own group, the turn-based and
 * hunt-for-hunt variations share one, the clock games share another, and the
 * four Remix channels share the last. See briefs/hc-integration.md §2.
 */
import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../src/channels.ts';

function groupOf(id: string): string | undefined {
  return CHANNELS.find((channel) => channel.def.id === id)?.def.group;
}

describe('channel groups', () => {
  it('puts the race in its own group', () => {
    expect(groupOf('game-1')).toBe('Race');
  });

  it('groups the turn-based and hunt-for-hunt variations together', () => {
    for (const id of ['game-2', 'game-3', 'game-4', 'game-5', 'game-6', 'game-7']) {
      expect(groupOf(id)).toBe('Turns');
    }
  });

  it('groups the clock games together', () => {
    for (const id of ['game-8', 'game-9', 'game-10']) {
      expect(groupOf(id)).toBe('Solo');
    }
  });

  it('groups the four Remix channels together', () => {
    for (const id of ['two-flags', 'minefield', 'thin-ice', 'drift-storm']) {
      expect(groupOf(id)).toBe('Remix');
    }
  });
});
