/**
 * Playing with the mouse: click a square and the explorer walks there, a
 * square at a time on the 1978 clock, the shortest way round the field's
 * wrapped edges and round the other explorer. Click the square it stands on
 * to check it (held, the clue stays up while the button is down); click the
 * square it is walking to and it checks on arrival.
 */
import type { Camera } from 'three';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { nextMove } from '../ai/path.ts';
import type { ClueMode } from '../ai/kid.ts';
import type { Square } from '../engine/grid.ts';
import { IDLE, type SeatInput } from '../engine/match.ts';
import { SETTLE_TICKS } from '../engine/rules.ts';
import { squareAtPoint } from '../look/field-space.ts';

/** The square under a pointer at (x, y) CSS pixels in an area `width` × `height`, or null. */
export function squareUnderPointer(
  camera: Camera,
  fieldHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
): Square | null {
  if (width <= 0 || height <= 0) return null;
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
  const surface = new Plane(new Vector3(0, 1, 0), -fieldHeight);
  const hit = ray.ray.intersectPlane(surface, new Vector3());
  return hit ? squareAtPoint(hit.x, hit.z) : null;
}

/**
 * How long a check queued for arrival holds the button: long enough for the step to settle, and in
 * Classic Memory, where the clue shows only while held, about a second more to read it.
 */
const ARRIVAL_HOLD_TICKS: Readonly<Record<ClueMode, number>> = {
  notebook: SETTLE_TICKS + 3,
  classic: SETTLE_TICKS + 26,
};

export interface MouseWalk {
  /** Where the explorer is walking to, for the HUD's marker; null when it is not. */
  readonly target: Square | null;
  /** The button went down over `square` while the explorer stood on `at`. */
  press(square: Square, at: Square): void;
  /** The button came up. */
  release(): void;
  /** What the mouse holds for the seat this tick; `blocked` is the other explorer's square. */
  input(at: Square, blocked: Square | null): SeatInput;
  /** Keys or a pad took over, or the field changed: drop the walk. */
  cancel(): void;
}

export function createMouseWalk(clues: ClueMode): MouseWalk {
  let target: Square | null = null;
  let checkOnArrival = false;
  let buttonOnSquare = false;
  let holdTicks = 0;

  return {
    get target() {
      return target;
    },
    press(square, at) {
      if (square === at) {
        target = null;
        checkOnArrival = false;
        buttonOnSquare = true;
        return;
      }
      checkOnArrival = square === target;
      target = square;
    },
    release() {
      buttonOnSquare = false;
    },
    input(at, blocked) {
      let east: SeatInput['east'] = 0;
      let south: SeatInput['south'] = 0;
      if (target !== null && target === at) {
        target = null;
        if (checkOnArrival) holdTicks = ARRIVAL_HOLD_TICKS[clues];
        checkOnArrival = false;
      } else if (target !== null) {
        const move = nextMove(at, target, blocked);
        if (move) ({ east, south } = move);
        // Nowhere to go (the other explorer is standing on the target): give up the walk.
        else target = null;
      }
      const reveal = buttonOnSquare || holdTicks > 0;
      if (holdTicks > 0) holdTicks--;
      if (east === 0 && south === 0 && !reveal) return IDLE;
      return { east, south, reveal };
    },
    cancel() {
      target = null;
      checkOnArrival = false;
      holdTicks = 0;
    },
  };
}
