/**
 * Tests for the hash router: path parsing, query parameter handling, invalid route
 * detection and bidirectional routeHash serialization.
 */
import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash } from '../src/routes/router.ts';

describe('hash router', () => {
  it('parses valid route paths and query parameters while marking invalid paths as not-found', () => {
    expect(parseRoute('')).toEqual({ name: 'den' });
    expect(parseRoute('#/')).toEqual({ name: 'den' });
    expect(parseRoute('#/list')).toEqual({ name: 'list' });
    expect(parseRoute('#/records')).toEqual({ name: 'records' });
    expect(parseRoute('#/about')).toEqual({ name: 'about' });
    expect(parseRoute('#/game/paint-tanks')).toEqual({ name: 'game', id: 'paint-tanks' });

    const playRoute = parseRoute('#/play/paint-tanks?mode=daily&ch=classic');
    expect(playRoute.name).toBe('play');
    if (playRoute.name === 'play') {
      expect(playRoute.id).toBe('paint-tanks');
      expect(playRoute.params.get('mode')).toBe('daily');
      expect(playRoute.params.get('ch')).toBe('classic');
    }

    expect(parseRoute('#/game/Not_Valid')).toEqual({
      name: 'not-found',
      hash: '#/game/Not_Valid',
    });
    expect(parseRoute('#/nowhere')).toEqual({
      name: 'not-found',
      hash: '#/nowhere',
    });
  });

  it('round-trips parsed routes back to their canonical hash representation', () => {
    expect(routeHash(parseRoute(''))).toBe('#/');
    expect(routeHash(parseRoute('#/'))).toBe('#/');
    expect(routeHash(parseRoute('#/list'))).toBe('#/list');
    expect(routeHash(parseRoute('#/records'))).toBe('#/records');
    expect(routeHash(parseRoute('#/about'))).toBe('#/about');
    expect(routeHash(parseRoute('#/game/paint-tanks'))).toBe('#/game/paint-tanks');
    expect(routeHash(parseRoute('#/play/paint-tanks?mode=daily&ch=classic'))).toBe(
      '#/play/paint-tanks?mode=daily&ch=classic',
    );
  });
});
