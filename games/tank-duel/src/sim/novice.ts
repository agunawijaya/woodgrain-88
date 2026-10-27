/**
 * Scripted novice human player for Tank Duel balance simulations.
 *
 * Emulates a first-time player: slow reaction cycle (0.45 s), straightforward
 * movement, turns towards the opponent when visible, drives along clear paths or
 * navigator routes in mazes, and fires when roughly facing the opponent in
 * unobstructed line of sight. Never banks shots and never dodges incoming shells.
 */
import type { Rng } from '@woodgrain-88/kit';
import { turnSteps } from '../ai/aim.ts';
import { createNavigator, type Navigator } from '../ai/navigation.ts';
import { DUEL_TUNING, type DuelTuning } from '../ai/tuning.ts';
import { createLookout, type Lookout } from '../ai/perception.ts';
import type { Arena } from '../arenas/format.ts';
import type { MatchWorld } from '../engine/match.ts';
import type { ChannelRules, MatchState, Side, StickInput } from '../engine/types.ts';
import { NO_INPUT } from '../engine/types.ts';
import { distance, HEADING_STEPS, sub, wrapStep, type Vec2 } from '../engine/vec.ts';
import { muzzlePoint } from '../engine/vehicles.ts';
import { segmentBlocked } from '../engine/walls.ts';

const NOVICE_REACTION_SECONDS = 0.45;
const WAYPOINT_REACHED_DISTANCE = 1.0;

/** Anything that plays a seat: a Kid commander or the scripted novice. */
export interface Player {
  think(state: MatchState, world: MatchWorld, dt: number): StickInput;
}

// Converts a directional 2D vector into the nearest of the 16 heading steps
function vectorToHeading(dir: Vec2): number {
  const angle = (Math.atan2(dir.y, dir.x) + 2 * Math.PI) % (2 * Math.PI);
  return wrapStep(Math.round((angle / (2 * Math.PI)) * HEADING_STEPS));
}

// Finds the shortest directional offset between two points across a toroidal wrapping sky
function torusOffset(from: Vec2, to: Vec2): Vec2 {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (dx > 32) dx -= 64;
  else if (dx < -32) dx += 64;
  if (dy > 20) dy -= 40;
  else if (dy < -20) dy += 40;
  return { x: dx, y: dy };
}

/**
 * A first-time player, scripted: slow to react, turns towards the opponent when it can see it, drives
 * when roughly facing its way, fires when the opponent is within one heading step of straight ahead
 * and in line of sight, never banks a shot and never dodges. Mazes: it drives along a navigator route
 * towards the last place it saw the opponent.
 */
export function createNovice(
  side: Side,
  channel: ChannelRules,
  world: MatchWorld,
  _rng: Rng,
  tuning: DuelTuning = DUEL_TUNING,
): Player {
  // After a spin a first-time player needs at least as long as a Kid to pick the target up again.
  const settleSeconds = tuning.settleSeconds + NOVICE_REACTION_SECONDS * tuning.settleThinks;
  const lookout: Lookout = createLookout(side);
  const isArena = channel.field.kind === 'arena';
  const isMaze = isArena && channel.field.id !== 'open-field';
  const navigator: Navigator | null = isArena ? createNavigator(world.field as Arena) : null;

  let decisionTimer = 0;
  let targetHeading = 0;
  let wantDrive = false;
  let wantFire = false;
  let firedLastStep = false;

  let waypoints: Vec2[] = [];
  let waypointIndex = 0;
  // A person needs a moment after the spin to find the target again
  let holdFireUntil = -1;
  let wasFrozen = false;

  return {
    think(state: MatchState, _world: MatchWorld, dt: number): StickInput {
      const frozen = state.freeze !== null;
      if (wasFrozen && !frozen) holdFireUntil = state.time + settleSeconds;
      wasFrozen = frozen;
      if (frozen || state.over) {
        // The board stays in view during a spin: a hidden tank that was hit shows where it ends up.
        lookout.observe(state, world);
        return NO_INPUT;
      }

      const picture = lookout.observe(state, world);
      const ownLeader = picture.own.find((v) => v.slot === 0);
      const enemy = picture.enemies[0];

      if (!ownLeader || !enemy) {
        return NO_INPUT;
      }

      const isSky = channel.field.kind === 'sky';
      const offsetToEnemy = isSky
        ? torusOffset(ownLeader.position, enemy.position)
        : sub(enemy.position, ownLeader.position);
      const directBearing = vectorToHeading(offsetToEnemy);

      const muzzle = muzzlePoint(ownLeader);
      const lineOfSight = !segmentBlocked(muzzle, enemy.position, world.edges);
      const hasLiveShell = state.shells[side] !== null;

      decisionTimer -= dt;

      // Periodic human reaction tick
      if (decisionTimer <= 0) {
        decisionTimer = NOVICE_REACTION_SECONDS;

        if (ownLeader.vehicle === 'tank') {
          if (isMaze && !lineOfSight && navigator) {
            // In a maze with obstructed line of sight, route towards last seen position
            waypoints = navigator.route(ownLeader.position, enemy.position);
            waypointIndex = 0;
            const wp = waypoints[waypointIndex];
            if (wp) {
              targetHeading = vectorToHeading(sub(wp, ownLeader.position));
            } else {
              targetHeading = directBearing;
            }
          } else {
            // In open ground or clear line of sight, turn directly towards enemy
            waypoints = [];
            waypointIndex = 0;
            targetHeading = directBearing;
          }

          // Tanks drive when roughly facing their route waypoint or direct target
          const headingDiff = Math.abs(turnSteps(ownLeader.heading, targetHeading));
          wantDrive = headingDiff <= 1;
        } else {
          // Aircraft always steer towards the opponent at cruising speed
          targetHeading = directBearing;
          wantDrive = false;
        }

        // Plan to fire if the opponent is in view and line of sight is clear
        wantFire = enemy.visible && lineOfSight && !hasLiveShell;
      }

      // Advance along path waypoints as the tank passes through them
      if (ownLeader.vehicle === 'tank' && waypoints.length > 0) {
        let wp = waypoints[waypointIndex];
        while (wp && distance(ownLeader.position, wp) <= WAYPOINT_REACHED_DISTANCE) {
          waypointIndex++;
          wp = waypoints[waypointIndex];
        }

        if (wp) {
          targetHeading = vectorToHeading(sub(wp, ownLeader.position));
          const diff = Math.abs(turnSteps(ownLeader.heading, targetHeading));
          wantDrive = diff <= 1;
        }
      }

      // Turn towards the current target heading
      const turnDiff = turnSteps(ownLeader.heading, targetHeading);
      const stickX: -1 | 0 | 1 = turnDiff > 0 ? 1 : turnDiff < 0 ? -1 : 0;

      // Throttle: tanks drive forward or stop; aircraft maintain cruise throttle (0)
      const stickY: -1 | 0 | 1 = ownLeader.vehicle === 'tank' ? (wantDrive ? 1 : 0) : 0;

      // Fire on a new press when facing within one heading step of dead ahead
      let stickFire = false;
      const facingOpponent = Math.abs(turnSteps(ownLeader.heading, directBearing)) <= 1;

      if (firedLastStep) {
        stickFire = false;
        firedLastStep = false;
      } else if (
        wantFire &&
        facingOpponent &&
        lineOfSight &&
        enemy.visible &&
        !hasLiveShell &&
        state.time >= holdFireUntil
      ) {
        stickFire = true;
        firedLastStep = true;
        wantFire = false;
      }

      return { x: stickX, y: stickY, fire: stickFire };
    },
  };
}
