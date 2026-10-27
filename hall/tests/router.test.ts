/**
 * Tests for the hash router: path parsing, query parameter handling, invalid route
 * detection and bidirectional routeHash serialization.
 */
import { describe, expect, it } from 'vitest';
import { DEN_LIFE_SCREENS, parseRoute, routeHash } from '../src/routes/router.ts';

describe('hash router', () => {
  it('parses valid route paths and query parameters while marking invalid paths as not-found', () => {
    expect(parseRoute('')).toEqual({ name: 'den' });
    expect(parseRoute('#/')).toEqual({ name: 'den' });
    expect(parseRoute('#/list')).toEqual({ name: 'list' });
    expect(parseRoute('#/records')).toEqual({ name: 'records' });
    expect(parseRoute('#/about')).toEqual({ name: 'about' });
    expect(parseRoute('#/game/tank-duel')).toEqual({ name: 'game', id: 'tank-duel' });
    expect(parseRoute('#/details/tank-duel')).toEqual({ name: 'details', id: 'tank-duel' });

    const playRoute = parseRoute('#/play/tank-duel?mode=daily&ch=classic');
    expect(playRoute.name).toBe('play');
    if (playRoute.name === 'play') {
      expect(playRoute.id).toBe('tank-duel');
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
    expect(routeHash(parseRoute('#/game/tank-duel'))).toBe('#/game/tank-duel');
    expect(routeHash(parseRoute('#/details/lane-hopper?version=rabbit'))).toBe(
      '#/details/lane-hopper?version=rabbit',
    );
    expect(routeHash(parseRoute('#/play/tank-duel?mode=daily&ch=classic'))).toBe(
      '#/play/tank-duel?mode=daily&ch=classic',
    );
  });

  it('parses cartridge version on game routes and round-trips while dropping invalid version formats', () => {
    const route = parseRoute('#/game/lane-hopper?version=rabbit');
    expect(route).toEqual({ name: 'game', id: 'lane-hopper', version: 'rabbit' });
    expect(routeHash(route)).toBe('#/game/lane-hopper?version=rabbit');

    const invalidRoute = parseRoute('#/game/lane-hopper?version=Not_Ok');
    expect(invalidRoute).toEqual({ name: 'game', id: 'lane-hopper' });
    expect(routeHash(invalidRoute)).toBe('#/game/lane-hopper');
  });

  it('parses Den Life screen routes and round-trips them through routeHash', () => {
    for (const screen of DEN_LIFE_SCREENS) {
      const hash = `#/${screen}`;
      const route = parseRoute(hash);
      expect(route).toEqual({ name: screen });
      expect(routeHash(route)).toBe(hash);
    }
  });

  it('marks sub-paths under Den Life screens as not-found', () => {
    expect(parseRoute('#/jacket/extra')).toEqual({
      name: 'not-found',
      hash: '#/jacket/extra',
    });
    expect(parseRoute('#/kids/extra')).toEqual({
      name: 'not-found',
      hash: '#/kids/extra',
    });
    expect(parseRoute('#/versus/extra')).toEqual({
      name: 'not-found',
      hash: '#/versus/extra',
    });
    expect(parseRoute('#/run/extra')).toEqual({
      name: 'not-found',
      hash: '#/run/extra',
    });
  });

  it('preserves Power Cycle Run parameters mode and micro on play routes', () => {
    const hash = '#/play/test-catch?mode=power-cycle-run&micro=catch-five&ch=slow-1';
    const route = parseRoute(hash);
    expect(route.name).toBe('play');
    if (route.name === 'play') {
      expect(route.id).toBe('test-catch');
      expect(route.params.get('mode')).toBe('power-cycle-run');
      expect(route.params.get('micro')).toBe('catch-five');
      expect(route.params.get('ch')).toBe('slow-1');
    }
    expect(routeHash(route)).toBe(hash);
  });
});
