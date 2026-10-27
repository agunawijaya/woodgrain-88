/**
 * Tests for arena navigation: tank footprint pathfinding, waypoint corner trimming,
 * walkability checks, routing to nearest reachable footprints, and cover spot discovery.
 */
import { describe, expect, it } from 'vitest';
import { createNavigator } from '../src/ai/navigation.ts';
import { compileArena, wallPolygons, type Arena } from '../src/arenas/format.ts';
import { OLD_QUARTER, OPEN_FIELD } from '../src/arenas/layouts.ts';
import { distance, vec } from '../src/engine/vec.ts';
import { buildWallEdges, segmentBlocked } from '../src/engine/walls.ts';

describe('navigation Navigator', () => {
  const arenaQuarter = compileArena(OLD_QUARTER);
  const edgesQuarter = buildWallEdges(wallPolygons(arenaQuarter));

  it('finds routes on Old Quarter between spawns where every waypoint is walkable', () => {
    const nav = createNavigator(arenaQuarter);
    const from = arenaQuarter.spawns[0].position;
    const to = arenaQuarter.spawns[1].position;

    const waypoints = nav.route(from, to);
    expect(waypoints.length).toBeGreaterThan(0);

    for (const wp of waypoints) {
      expect(nav.walkable(wp)).toBe(true);
    }

    const destination = waypoints[waypoints.length - 1];
    expect(destination).toBeDefined();
    if (destination) {
      expect(distance(destination, to)).toBeLessThan(2);
    }
  });

  it('routes to the nearest footprint for an obstructed goal or returns empty when unreachable', () => {
    const nav = createNavigator(arenaQuarter);
    const from = arenaQuarter.spawns[0].position;

    // A point inside a solid wall block (col 3, row 6 in OLD_QUARTER is '#')
    const wallPoint = vec(7, 13);
    expect(arenaQuarter.isSolid(3, 6)).toBe(true);

    const routeToWall = nav.route(from, wallPoint);
    expect(routeToWall.length).toBeGreaterThan(0);
    const endWp = routeToWall[routeToWall.length - 1];
    expect(endWp).toBeDefined();
    if (endWp) {
      // Must be a valid walkable footprint near the wall
      expect(nav.walkable(endWp)).toBe(true);
    }

    // A map with completely walled-off chambers to test genuinely unreachable goals
    // Valid arenas never have unreachable pockets (the validator refuses them), so build one by hand:
    // the open field with a wall across its whole height between the two spawns.
    const openArena = compileArena(OPEN_FIELD);
    const pocketArena: Arena = {
      ...openArena,
      isSolid: (col, row) => col === 15 || col === 16 || openArena.isSolid(col, row),
    };
    const pocketNav = createNavigator(pocketArena);

    const unreachableRoute = pocketNav.route(
      pocketArena.spawns[0].position,
      pocketArena.spawns[1].position,
    );
    expect(unreachableRoute).toEqual([]);
  });

  it('finds coverFrom spots that have no straight line of sight to the threat', () => {
    const nav = createNavigator(arenaQuarter);
    const threat = arenaQuarter.spawns[1].position;

    const coverSpots = nav.coverFrom(threat);
    expect(coverSpots.length).toBeGreaterThan(0);

    for (const spot of coverSpots) {
      // Must have a wall segment obstructing direct line of sight
      expect(segmentBlocked(spot, threat, edgesQuarter)).toBe(true);
      expect(nav.walkable(spot)).toBe(true);
    }
  });
});
