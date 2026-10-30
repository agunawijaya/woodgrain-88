/**
 * The crash push: on every point, the picture pushes in toward the crash,
 * holds while it plays, then eases back to the whole board. Like Chase, the
 * table camera cannot move, so this shrinks the framing and slides the world
 * under it instead; unlike Chase, it is a framing move only, held on a fixed
 * point rather than following a rider.
 */
import type { Stage, TableFraming } from '@woodgrain-88/arena';
import { Vector3 } from 'three';
import type { Seat } from '../engine/types.ts';
import { HALF_DEPTH, HALF_WIDTH } from './board-space.ts';
import type { TrailView } from './look.ts';

export interface CrashPush {
  /** Called on a crash: focuses the push on the crashed rider(s), sampled now. */
  start(seats: readonly Seat[]): void;
  /** Once a frame, after the view has moved the riders. */
  update(dt: number): void;
  /** Back to the overhead picture of the whole board, root at the origin. */
  release(): void;
}

/** How much closer than the overhead picture, at full weight, for a single crashed rider. */
export const PUSH_ZOOM = 1.5;
/** A head-on crash needs both riders in the picture, so it zooms in less. */
const BOTH_CRASHED_ZOOM = 1.25;

/** How long the push takes to ease in. */
const EASE_IN_SECONDS = 0.6;
/** How long the push holds at full weight before it starts easing back out. */
const HOLD_UNTIL_SECONDS = 3.4;
/** Back to the whole board by here, well inside the shorter crash pause (4.48 s). */
const EASE_OUT_UNTIL_SECONDS = 4.2;
/**
 * How much of the pushed picture may lie beyond the board, as a share of its half-size. Crashes
 * happen at walls, often the board's own edge; held to the board, the picture would put such a
 * crash at its very edge. Half its half-size shows the look's surroundings there (the watcher on
 * the far side among them) and keeps the crash well inside the picture.
 */
const BEYOND_THE_BOARD = 0.5;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** How far into the push the picture is, `seconds` after the crash: 0 (whole board) to 1 (held). */
export function pushWeight(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < EASE_IN_SECONDS) return easeInOutCubic(seconds / EASE_IN_SECONDS);
  if (seconds < HOLD_UNTIL_SECONDS) return 1;
  if (seconds < EASE_OUT_UNTIL_SECONDS) {
    const t = (seconds - HOLD_UNTIL_SECONDS) / (EASE_OUT_UNTIL_SECONDS - HOLD_UNTIL_SECONDS);
    return 1 - easeInOutCubic(t);
  }
  return 0;
}

export function createCrashPush(
  stage: Stage,
  currentView: () => TrailView,
  framing: TableFraming,
): CrashPush {
  const focus = new Vector3();
  const sample = new Vector3();
  let elapsed = Number.POSITIVE_INFINITY;
  let heldZoom = PUSH_ZOOM;

  // The furthest the focus may sit from the middle: where the held picture shows its allowed
  // share beyond the board and no more.
  function reach(zoom: number): { readonly x: number; readonly z: number } {
    const halfWidth = framing.width / zoom / 2;
    const halfDepth = framing.depth / zoom / 2;
    return {
      x: Math.max(0, HALF_WIDTH - halfWidth * (1 - BEYOND_THE_BOARD)),
      z: Math.max(0, HALF_DEPTH - halfDepth * (1 - BEYOND_THE_BOARD)),
    };
  }

  return {
    start(seats) {
      // A crash during a push (another rider going down before this one lets go) carries on
      // from the current weight and focus, with no jump.
      if (seats.length === 0 || pushWeight(elapsed) > 0) return;
      heldZoom = seats.length >= 2 ? BOTH_CRASHED_ZOOM : PUSH_ZOOM;
      const view = currentView();
      const midpoint = new Vector3();
      for (const seat of seats) midpoint.add(view.riderPosition(seat, sample));
      midpoint.divideScalar(seats.length);
      const limit = reach(heldZoom);
      midpoint.x = Math.max(-limit.x, Math.min(limit.x, midpoint.x));
      midpoint.z = Math.max(-limit.z, Math.min(limit.z, midpoint.z));
      focus.copy(midpoint);
      elapsed = 0;
    },
    update(dt) {
      elapsed += dt;
      const weight = pushWeight(elapsed);
      const zoom = 1 + (heldZoom - 1) * weight;
      stage.setFraming({
        ...framing,
        width: framing.width / zoom,
        depth: framing.depth / zoom,
        height: framing.height / zoom,
      });
      currentView().root.position.set(-focus.x * weight, 0, -focus.z * weight);
    },
    release() {
      currentView().root.position.set(0, 0, 0);
      stage.setFraming(framing);
      elapsed = Number.POSITIVE_INFINITY;
    },
  };
}
