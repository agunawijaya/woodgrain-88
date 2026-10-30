/**
 * Engine state to picture: the subpixel/fine-unit world turned into the
 * table coordinates and radians a look understands, with the half-tick
 * glide a renderer needs between two simulated moments.
 *
 * The field is 32 x 18 table units, centred on the origin, mapping five of
 * the cartridge's steps to one unit (look/field.ts); heading steps become
 * radians the same way in the engine and in a look, both counter-clockwise
 * from +x seen from above, so no flip is needed either way.
 */
import { HALF_DEPTH, HALF_WIDTH } from '../look/field.ts';
import type {
  MissilePose,
  PodPose,
  RemixPose,
  SceneFrame,
  ShipPose,
  TablePoint,
} from '../look/look.ts';
import { beltRocks, binaryStars, cometAt, type RemixBody } from '../engine/remix.ts';
import { SEATS, SUBPIXELS, type Body, type Match, type Ship, type Shot } from '../engine/types.ts';

/** Table units per cartridge step: five steps make one unit (look/field.ts). */
const UNITS_PER_STEP = 5;

/** Engine subpixels to a point on the table, the field centred on the origin. */
export function toTable(x: number, y: number): TablePoint {
  return {
    x: x / SUBPIXELS / UNITS_PER_STEP - HALF_WIDTH,
    z: y / SUBPIXELS / UNITS_PER_STEP - HALF_DEPTH,
  };
}

/** One of the engine's 16 headings to radians, counter-clockwise from +x as the look expects. */
export function headingRadians(heading: number): number {
  return (heading * Math.PI) / 8;
}

/** A body's spot on the table, glided from its previous tick to its current one by `alpha`. */
function tablePosition(body: Body, alpha: number): TablePoint {
  if (body.wrapped) return toTable(body.x, body.y);
  return toTable(
    body.prevX + (body.x - body.prevX) * alpha,
    body.prevY + (body.y - body.prevY) * alpha,
  );
}

function shipPose(ship: Ship, alpha: number, cloak: number): ShipPose | null {
  if (!ship.present) return null;
  const { x, z } = tablePosition(ship, alpha);
  return { x, z, heading: headingRadians(ship.heading), thrusting: ship.thrusting, cloak };
}

function missilePose(shot: Shot, alpha: number): MissilePose | null {
  if (!shot.live) return null;
  const { x, z } = tablePosition(shot, alpha);
  // The way it travels, not the way it was launched: the star can bend it since.
  return { x, z, heading: Math.atan2(-shot.vy, shot.vx) };
}

/** How fast a pod tumbles, and how far apart the two pods' spins start (radians a tick, and offset). */
const POD_TUMBLE_RATE = 0.04;
const POD_TUMBLE_OFFSET = 1.3;

function podPose(shot: Shot, index: number, tick: number, alpha: number): PodPose | null {
  if (!shot.live) return null;
  const { x, z } = tablePosition(shot, alpha);
  return { x, z, tumble: tick * POD_TUMBLE_RATE + index * POD_TUMBLE_OFFSET };
}

/** A Remix body's spot on the table, and its radius in table units (steps ÷ 5). */
function remixPoint(body: RemixBody): TablePoint & { readonly radius: number } {
  const { x, z } = toTable(body.x, body.y);
  return { x, z, radius: body.radius / UNITS_PER_STEP };
}

/** The comet's last seen spot, per match, so its heading can be read from its own travel. */
const lastComet = new WeakMap<Match, TablePoint>();

/** The Remix channel's own bodies this tick, or undefined on a cartridge channel. */
function remixPose(match: Readonly<Match>): RemixPose | undefined {
  const remix = match.setup.rules.remix?.id;
  if (remix === 'binary-stars') {
    return { stars: binaryStars(match.tick).map(remixPoint) };
  }
  if (remix === 'comet') {
    const comet = cometAt(match);
    if (!comet) return { comet: null };
    const { x, z } = toTable(comet.x, comet.y);
    const previous = lastComet.get(match);
    // The comet carries no heading of its own; two consecutive spots give its travel.
    const heading = previous ? Math.atan2(-(z - previous.z), x - previous.x) : 0;
    lastComet.set(match, { x, z });
    return { comet: { x, z, heading } };
  }
  if (remix === 'asteroid-belt') {
    return { rocks: beltRocks(match.tick).map(remixPoint) };
  }
  return undefined;
}

/**
 * One picture of the field at `alpha` (0 at the previous tick, 1 at the current one): ships and,
 * in a duel, missiles, or in docking, pods. `cloak` is each seat's shimmer, from a `CloakFader`.
 * `remix` carries a Remix channel's own bodies (the binary stars, the comet, the belt's rocks).
 */
export function sceneFrame(
  match: Readonly<Match>,
  alpha: number,
  cloak: readonly [number, number],
): SceneFrame {
  const duel = match.setup.rules.mode === 'duel';
  const remix = remixPose(match);
  return {
    ships: SEATS.map((seat) => shipPose(match.ships[seat], alpha, cloak[seat])),
    missiles: SEATS.map((seat) => (duel ? missilePose(match.shots[seat], alpha) : null)),
    pods: SEATS.map((seat) => (duel ? null : podPose(match.shots[seat], seat, match.tick, alpha))),
    ...(remix ? { remix } : {}),
  };
}

/** How long the cloak's shimmer takes to fade fully on or off, in real seconds. */
const CLOAK_FADE_SECONDS = 0.25;

export interface CloakFader {
  /** Moves each seat's value toward 1 (cloaked) or 0 (not) by `dt` real seconds. */
  update(dt: number, cloaked: readonly [boolean, boolean]): void;
  readonly values: readonly [number, number];
}

/** A seat's shimmer eases over `CLOAK_FADE_SECONDS`, or jumps straight there with reduced motion. */
export function createCloakFader(reducedMotion: boolean): CloakFader {
  const values: [number, number] = [0, 0];
  return {
    update(dt, cloaked) {
      for (const seat of SEATS) {
        const target = cloaked[seat] ? 1 : 0;
        if (reducedMotion) {
          values[seat] = target;
          continue;
        }
        const step = dt / CLOAK_FADE_SECONDS;
        values[seat] =
          values[seat] < target
            ? Math.min(target, values[seat] + step)
            : Math.max(target, values[seat] - step);
      }
    },
    get values() {
      return values;
    },
  };
}
