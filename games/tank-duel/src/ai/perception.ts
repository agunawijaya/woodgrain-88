/**
 * Remembers what one side has seen of the other during a Tank Duel match.
 * Enforces fair play by tracking sightings through game visibility rules
 * and never peeking at hidden opponent positions.
 */
import { ARENA_HEIGHT, ARENA_WIDTH, type SkyDef } from '../arenas/format.ts';
import type { MatchWorld } from '../engine/match.ts';
import type { MatchState, Side, VehicleState } from '../engine/types.ts';
import type { Vec2 } from '../engine/vec.ts';
import { vec } from '../engine/vec.ts';
import { insideCloud, isRevealed } from '../engine/visibility.ts';

export interface Sighting {
  readonly id: number;
  readonly position: Vec2;
  /** Estimated from the last two sightings; zero when only seen once. */
  readonly velocity: Vec2;
  readonly heading: number;
  /** Match time when it was last seen. */
  readonly seenAt: number;
  /** Whether it is in view this step. */
  readonly visible: boolean;
}

export interface Picture {
  readonly own: readonly VehicleState[];
  readonly enemies: readonly Sighting[];
}

/** Remembers what one side has seen of the other; feed it every step. */
export interface Lookout {
  observe(state: MatchState, world: MatchWorld): Picture;
}

/** Creates a stateful lookout that maintains visual memory for one side. */
export function createLookout(side: Side): Lookout {
  const sightings = new Map<number, Sighting>();
  let lastObservedTime = -1;

  return {
    observe(state: MatchState, world: MatchWorld): Picture {
      const own = state.vehicles.filter((v) => v.side === side);
      const enemyVehicles = state.vehicles.filter((v) => v.side !== side);
      const isSky = state.channel.field.kind === 'sky';
      const sky = isSky ? (world.field as SkyDef) : null;

      const enemySightings: Sighting[] = [];

      for (const v of enemyVehicles) {
        const revealed = isRevealed(state, v);
        const inCloud = sky !== null && insideCloud(v.position, sky);
        const visible = revealed && !inCloud;

        const prev = sightings.get(v.id);

        if (visible) {
          let velocity = vec(0, 0);

          // Only derive velocity if the vehicle was in plain view on the previous step
          if (prev !== undefined && prev.visible && lastObservedTime >= 0) {
            const dt = state.time - prev.seenAt;
            if (dt > 1e-6) {
              let dx = v.position.x - prev.position.x;
              let dy = v.position.y - prev.position.y;

              // Wrapping in open sky preserves smooth velocity across borders
              if (isSky) {
                if (dx > ARENA_WIDTH / 2) {
                  dx -= ARENA_WIDTH;
                } else if (dx < -ARENA_WIDTH / 2) {
                  dx += ARENA_WIDTH;
                }
                if (dy > ARENA_HEIGHT / 2) {
                  dy -= ARENA_HEIGHT;
                } else if (dy < -ARENA_HEIGHT / 2) {
                  dy += ARENA_HEIGHT;
                }
              }

              velocity = vec(dx / dt, dy / dt);
            }
          }

          const currentSighting: Sighting = {
            id: v.id,
            position: v.position,
            velocity,
            heading: v.heading,
            seenAt: state.time,
            visible: true,
          };
          sightings.set(v.id, currentSighting);
          enemySightings.push(currentSighting);
        } else {
          // Hidden enemies retain their last recorded sighting without reading new coordinates
          let hiddenSighting: Sighting;
          if (prev !== undefined) {
            hiddenSighting = {
              ...prev,
              visible: false,
            };
          } else {
            // Vehicles hidden from the opening second are assumed at their spawn positions
            hiddenSighting = {
              id: v.id,
              position: v.position,
              velocity: vec(0, 0),
              heading: v.heading,
              seenAt: 0,
              visible: false,
            };
          }
          sightings.set(v.id, hiddenSighting);
          enemySightings.push(hiddenSighting);
        }
      }

      lastObservedTime = state.time;
      return { own, enemies: enemySightings };
    },
  };
}
