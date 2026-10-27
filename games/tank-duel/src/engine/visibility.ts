/**
 * Visibility rules for Tank Duel: determining when invisible tanks are revealed
 * and whether coordinates lie within cloud banks in dogfight skies.
 */
import { ARENA_HEIGHT, ARENA_WIDTH, type SkyDef } from '../arenas/format.ts';
import type { MatchState, VehicleState } from './types.ts';
import type { Vec2 } from './vec.ts';

/** Whether a vehicle can be seen right now (by the other player, a bot, or the renderer). */
export function isRevealed(state: MatchState, vehicle: VehicleState): boolean {
  // Aircraft always show up, as do vehicles in regular (visible) channels
  if (vehicle.vehicle !== 'tank' || !state.channel.invisible) {
    return true;
  }

  // Blackout radar sweep reveals both sides (handled in Remix round)
  if (state.radar.showing > 0) {
    return true;
  }

  // A tank reveals itself while its shell flies
  if (state.shells[vehicle.side] !== null) {
    return true;
  }

  // Bumping walls or the other tank gives away position, except in Blackout
  if (state.channel.remix?.kind !== 'blackout' && vehicle.bumped > 0) {
    return true;
  }

  // Being hit and spinning during the freeze pause reveals the victim
  if (state.freeze !== null && state.freeze.victim === vehicle.side) {
    return true;
  }

  return false;
}

/** Whether a point is inside one of the sky's cloud banks (ellipses); always false for no clouds. */
export function insideCloud(point: Vec2, sky: SkyDef): boolean {
  for (const cloud of sky.clouds) {
    if (cloud.radiusX <= 0 || cloud.radiusY <= 0) {
      continue;
    }

    // Sky coordinates wrap horizontally (64 units) and vertically (40 units)
    const rawDx = (point.x - cloud.x) % ARENA_WIDTH;
    const wrappedDx = ((rawDx % ARENA_WIDTH) + ARENA_WIDTH) % ARENA_WIDTH;
    const dx = wrappedDx > ARENA_WIDTH / 2 ? ARENA_WIDTH - wrappedDx : wrappedDx;

    const rawDy = (point.y - cloud.y) % ARENA_HEIGHT;
    const wrappedDy = ((rawDy % ARENA_HEIGHT) + ARENA_HEIGHT) % ARENA_HEIGHT;
    const dy = wrappedDy > ARENA_HEIGHT / 2 ? ARENA_HEIGHT - wrappedDy : wrappedDy;

    const normX = dx / cloud.radiusX;
    const normY = dy / cloud.radiusY;

    if (normX * normX + normY * normY <= 1) {
      return true;
    }
  }

  return false;
}
