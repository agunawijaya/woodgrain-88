/**
 * The Chase camera: a closer picture that follows the player's rider, a
 * little ahead of where it is going, so the board opens up in front of them.
 * The table camera cannot move, so the world slides under it instead and the
 * framing shrinks round the middle, as the hero page's close-ups do. It is
 * for a lone player: two people share one screen, so they keep the overhead.
 */
import type { Stage, TableFraming } from '@woodgrain-88/arena';
import { Vector3 } from 'three';
import type { Seat } from '../engine/types.ts';
import { HALF_DEPTH, HALF_WIDTH } from './board-space.ts';
import type { TrailView } from './look.ts';

export interface ChaseCamera {
  /** Once a frame, after the view has moved the riders. */
  update(dt: number): void;
  /** Back to the overhead picture of the whole board. */
  release(): void;
}

/** How much closer than the overhead picture. */
const ZOOM = 2;
/** How far ahead of the rider the picture centres, in seconds of its travel. */
const LEAD_SECONDS = 0.6;
/** How quickly the picture catches up, per second. */
const FOLLOW_RATE = 4;
/** A jump longer than this (riding off a wraparound edge) is followed at once. */
const SNAP_DISTANCE = 8;

export function createChaseCamera(
  stage: Stage,
  currentView: () => TrailView,
  framing: TableFraming,
  seat: Seat,
): ChaseCamera {
  stage.setFraming({
    ...framing,
    width: framing.width / ZOOM,
    depth: framing.depth / ZOOM,
    height: framing.height / ZOOM,
  });
  const focus = new Vector3();
  const rider = new Vector3();
  const previous = new Vector3();
  const desired = new Vector3();
  let started = false;
  // Keep the board's edge at the picture's edge rather than showing the floor beyond it.
  const reachX = Math.max(0, HALF_WIDTH - framing.width / ZOOM / 2 + 1);
  const reachZ = Math.max(0, HALF_DEPTH - framing.depth / ZOOM / 2 + 1);

  return {
    update(dt) {
      const view = currentView();
      view.riderPosition(seat, rider);
      if (!started || rider.distanceTo(previous) > SNAP_DISTANCE) {
        focus.copy(rider);
        previous.copy(rider);
        started = true;
      }
      const speed = dt > 0 ? rider.clone().sub(previous).divideScalar(dt) : new Vector3();
      previous.copy(rider);
      desired.copy(rider).addScaledVector(speed, LEAD_SECONDS);
      desired.x = Math.max(-reachX, Math.min(reachX, desired.x));
      desired.z = Math.max(-reachZ, Math.min(reachZ, desired.z));
      focus.lerp(desired, 1 - Math.exp(-FOLLOW_RATE * dt));
      view.root.position.set(-focus.x, 0, -focus.z);
    },
    release() {
      currentView().root.position.set(0, 0, 0);
      stage.setFraming(framing);
    },
  };
}
