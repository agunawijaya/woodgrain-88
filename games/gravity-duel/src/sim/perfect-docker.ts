/**
 * A scripted, flawless docker: not a player, but a proof that the docking
 * rule (NOTES.md, Docking) can actually be met. It reads the match state
 * directly rather than perceiving it through a Kid's beliefs, works out the
 * velocity it wants, and flies the stick toward it at the cartridge's own
 * turning rate.
 */
import { headingDifference, headingToward } from '../ai/forecast.ts';
import { axisDelta, speedUnits } from '../engine/physics.ts';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  IDLE,
  SUBPIXELS,
  type Controls,
  type Match,
  type Seat,
} from '../engine/types.ts';

/** The fastest, in speed units, the docker closes on its pod from a distance. */
const MAX_CLOSING_SPEED = 4;
/** Fine control gives up a step of closing speed for every 4 steps of distance. */
const CLOSING_PER_STEP = 0.25;
/** Below this many speed units of difference, thrusting would only overshoot the match. */
const MATCHED_ENOUGH = 0.3;

export interface PerfectDocker {
  controls(match: Readonly<Match>): Controls;
}

export function createPerfectDocker(seat: Seat): PerfectDocker {
  function controls(match: Readonly<Match>): Controls {
    const ship = match.ships[seat];
    const { rules } = match.setup;
    const podIndex: Seat = rules.pods === 'own' ? seat : 0;
    const pod = match.shots[podIndex];

    if (!ship.present || match.phase !== 'playing' || !pod.live) return IDLE;

    const dx = axisDelta(ship.x, pod.x, FIELD_WIDTH * SUBPIXELS, rules.edges) / SUBPIXELS;
    const dy = axisDelta(ship.y, pod.y, FIELD_HEIGHT * SUBPIXELS, rules.edges) / SUBPIXELS;
    const distance = Math.hypot(dx, dy);
    const closing = Math.min(MAX_CLOSING_SPEED, CLOSING_PER_STEP * distance);
    const length = distance || 1;

    const wantVx = speedUnits(pod.vx) + (dx / length) * closing;
    const wantVy = speedUnits(pod.vy) + (dy / length) * closing;
    const diffX = wantVx - speedUnits(ship.vx);
    const diffY = wantVy - speedUnits(ship.vy);
    const diffMagnitude = Math.hypot(diffX, diffY);

    const wantedHeading = headingToward(diffX, diffY);
    const off = headingDifference(ship.heading, wantedHeading);
    const linedUp = off === 0;

    return {
      left: off > 0,
      right: off < 0,
      thrust: linedUp && diffMagnitude > MATCHED_ENOUGH,
      cloak: false,
      fire: false,
    };
  }

  return { controls };
}
