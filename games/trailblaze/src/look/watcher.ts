/**
 * Every look has someone watching the duel from the middle of the far side:
 * a conductor, a host, a priest, a snowman. They follow the riders with their
 * eyes, and every crash gets a reaction. Their reactions run on their own
 * time and never hold the match up.
 */
import { Vector3, type Group, type Object3D } from 'three';
import type { Crash } from '../engine/types.ts';
import { HALF_DEPTH } from './board-space.ts';

/** Where a watcher stands: centred, just beyond the far border. */
export const WATCHER_SPOT = new Vector3(0, 0, -HALF_DEPTH - 2.4);

export interface Watcher {
  readonly root: Group;
  /** Where the action is now (between the riders still riding), or null when nobody rides. */
  follow(target: Vector3 | null): void;
  react(crash: Crash, at: Vector3): void;
  update(dt: number, clock: number): void;
  dispose(): void;
}

/** The point the watcher should look at: the middle of the riders still on the move. */
export function actionPoint(positions: readonly Vector3[]): Vector3 | null {
  if (positions.length === 0) return null;
  const sum = new Vector3();
  for (const position of positions) sum.add(position);
  return sum.divideScalar(positions.length);
}

const scratch = new Vector3();

/**
 * Eases a head round towards a point on the table, within a comfortable neck turn. The head's
 * parent faces +z (towards the table), so the turn is measured from there.
 */
export function turnHeadTowards(
  head: Object3D,
  target: Vector3 | null,
  dt: number,
  limit = 0.9,
): void {
  let yaw = 0;
  let pitch = 0;
  if (target) {
    head.getWorldPosition(scratch);
    const dx = target.x - scratch.x;
    const dz = target.z - scratch.z;
    yaw = Math.max(-limit, Math.min(limit, Math.atan2(dx, dz)));
    pitch = Math.min(0.5, Math.atan2(scratch.y, Math.hypot(dx, dz)) * 0.6);
  }
  const ease = Math.min(1, dt * 5);
  head.rotation.y += (yaw - head.rotation.y) * ease;
  head.rotation.x += (pitch - head.rotation.x) * ease;
}
