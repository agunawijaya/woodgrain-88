/**
 * The two camera moves on top of the overhead picture. The table camera never
 * moves, so both shrink the framing and slide the world under it instead, as
 * the hero page's close-ups do.
 *
 * - **Follow** (a lone player's choice in the 3D looks): a closer picture that
 *   keeps the player's ship a little behind the middle, so the field opens up
 *   where it is going.
 * - **Hit nudge** (overhead only, never with reduced motion): on a hit the
 *   picture leans a few percent toward it for a quarter of a second and
 *   settles back. It never crops the field: at most it comes a little closer.
 */
import type { Stage, TableFraming } from '@woodgrain-88/arena';
import { Vector3, type Object3D } from 'three';
import { HALF_DEPTH, HALF_WIDTH } from './field.ts';

export interface CameraMove {
  /** Once a frame, after the view has been shown. */
  update(dt: number): void;
  /** Back to the overhead picture of the whole field. */
  release(): void;
}

function zoomed(framing: TableFraming, zoom: number): TableFraming {
  return {
    ...framing,
    width: framing.width / zoom,
    depth: framing.depth / zoom,
    height: framing.height / zoom,
  };
}

/** How much closer than the overhead picture Follow sits. */
const FOLLOW_ZOOM = 1.8;
/** How far ahead of the ship the picture centres, in seconds of its drift. */
const LEAD_SECONDS = 0.8;
const FOLLOW_RATE = 3;
/** A jump longer than this (a wrap, a trip home from the star) is followed at once. */
const SNAP_DISTANCE = 8;

/**
 * `shipAt` writes where the followed ship is on the table into `out`, or returns null while it is
 * not on the field.
 */
export function createFollowCamera(
  stage: Stage,
  world: () => Object3D,
  framing: TableFraming,
  shipAt: (out: Vector3) => Vector3 | null,
): CameraMove {
  stage.setFraming(zoomed(framing, FOLLOW_ZOOM));
  const focus = new Vector3();
  const ship = new Vector3();
  const previous = new Vector3();
  const desired = new Vector3();
  const drift = new Vector3();
  let started = false;
  // Keep the field's edge at the picture's edge rather than showing much beyond it.
  const reachX = Math.max(0, HALF_WIDTH - framing.width / FOLLOW_ZOOM / 2 + 1);
  const reachZ = Math.max(0, HALF_DEPTH - framing.depth / FOLLOW_ZOOM / 2 + 1);

  return {
    update(dt) {
      if (!shipAt(ship)) return;
      if (!started || ship.distanceTo(previous) > SNAP_DISTANCE) {
        focus.copy(ship);
        previous.copy(ship);
        started = true;
      }
      drift.copy(ship).sub(previous).divideScalar(Math.max(dt, 1e-3));
      previous.copy(ship);
      desired.copy(ship).addScaledVector(drift, LEAD_SECONDS);
      desired.x = Math.max(-reachX, Math.min(reachX, desired.x));
      desired.z = Math.max(-reachZ, Math.min(reachZ, desired.z));
      focus.lerp(desired, 1 - Math.exp(-FOLLOW_RATE * dt));
      world().position.set(-focus.x, 0, -focus.z);
    },
    release() {
      world().position.set(0, 0, 0);
      stage.setFraming(framing);
    },
  };
}

/** How much closer the nudge leans at its height, and how far toward the hit. */
const NUDGE_ZOOM = 1.05;
const NUDGE_SHIFT = 0.04;
const NUDGE_SECONDS = 0.25;

export interface HitNudge extends CameraMove {
  /** A hit at this spot on the table. */
  nudge(at: Vector3): void;
}

export function createHitNudge(
  stage: Stage,
  world: () => Object3D,
  framing: TableFraming,
): HitNudge {
  const toward = new Vector3();
  let elapsed = Number.POSITIVE_INFINITY;

  return {
    nudge(at) {
      toward.copy(at);
      elapsed = 0;
    },
    update(dt) {
      if (elapsed >= NUDGE_SECONDS) return;
      elapsed += dt;
      // Up and back down again on a half sine: no hold, nothing to wait for.
      const weight = Math.sin(Math.PI * Math.min(1, elapsed / NUDGE_SECONDS));
      stage.setFraming(zoomed(framing, 1 + (NUDGE_ZOOM - 1) * weight));
      world().position.set(-toward.x * NUDGE_SHIFT * weight, 0, -toward.z * NUDGE_SHIFT * weight);
      if (elapsed >= NUDGE_SECONDS) {
        world().position.set(0, 0, 0);
        stage.setFraming(framing);
      }
    },
    release() {
      elapsed = Number.POSITIVE_INFINITY;
      world().position.set(0, 0, 0);
      stage.setFraming(framing);
    },
  };
}
