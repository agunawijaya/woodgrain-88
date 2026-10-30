import { validateChannels } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { CHANNELS, channelById, channelFacts } from '../src/channels.ts';

describe('Gravity Duel channels', () => {
  it('pass the kit validator', () => {
    expect(validateChannels(CHANNELS.map((channel) => channel.def))).toEqual([]);
  });

  it('list the 17 cartridge variations in order, then four Remix channels', () => {
    const originals = CHANNELS.filter((channel) => channel.def.kind === 'original');
    expect(originals.map((channel) => channel.rules.number)).toEqual(
      Array.from({ length: 17 }, (_, index) => index + 1),
    );
    expect(CHANNELS.filter((channel) => channel.def.kind === 'remix')).toHaveLength(4);
  });

  it('group the originals as the cartridge does', () => {
    const groups = CHANNELS.filter((channel) => channel.def.kind === 'original').map(
      (channel) => channel.def.group,
    );
    expect(groups.slice(0, 7).every((group) => group === 'Duel')).toBe(true);
    expect(groups.slice(7, 13).every((group) => group === 'Docking race')).toBe(true);
    expect(groups.slice(13).every((group) => group === 'Solo docking')).toBe(true);
  });

  it('open each Remix channel with its own patch', () => {
    const remixes = CHANNELS.filter((channel) => channel.def.kind === 'remix');
    expect(remixes.map((channel) => channel.def.unlockedBy)).toEqual([
      'lous-orbit',
      'soft-dock',
      'ghost-kill',
      'fuel-miser',
    ]);
    for (const channel of remixes) expect(channel.rules.remix?.id).toBe(channel.def.id);
  });

  it('describe a channel by its icons', () => {
    const star = channelById('game-5');
    expect(star && channelFacts(star)).toEqual({
      mode: 'duel',
      edges: 'wrap',
      centre: 'star',
      gravity: true,
      cloak: true,
      pods: 'none',
    });
  });
});
