import { validateManifest } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { manifest } from '../src/manifest.ts';

describe('manifest', () => {
  it('passes validateManifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('is playable, versus local or a Kid, with every support switched on', () => {
    expect(manifest.id).toBe('gravity-duel');
    expect(manifest.slot).toBe(16);
    expect(manifest.status).toBe('playable');
    expect(manifest.versus).toBe('local+bot');
    expect(manifest.supports).toEqual({ daily: true, challengeLinks: true, microChallenges: true });
  });

  it("names the original without putting it in the game's own words", () => {
    expect(manifest.inspiredBy.originalTitle).toBe('Space War');
    expect(manifest.inspiredBy.uiTitle).toBe('the 1978 orbital duel');
    expect(manifest.title).not.toContain('Space War');
    expect(manifest.tagline).not.toContain('Space War');
  });

  it('lists all 21 channels (17 cartridge variations, 4 Remix)', () => {
    expect(manifest.channels).toHaveLength(21);
  });
});
