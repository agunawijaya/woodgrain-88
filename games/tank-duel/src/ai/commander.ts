/**
 * A Neighbourhood Kid at the controls. One shared brain for every kid: it
 * looks (only at what a player could see), decides every so often (as
 * quickly as the kid reacts), and answers with a stick like a person's:
 * dodge a shell coming at it, steer its own guided shell, take a shot the
 * aim planner finds (banks included), or move: close in, take cover, wander.
 * Who the kid is changes only the choices, timing and mistakes.
 */
import { aiSettings, errorRateForRound, kidById, type KidId, type Rng } from '@woodgrain-88/kit';
import { TANK_RADIUS, type Arena, type SkyDef } from '../arenas/format.ts';
import {
  AIRCRAFT_MUZZLE,
  MACHINE_GUN_LIFE,
  MACHINE_GUN_SPEED,
  TANK_MUZZLE,
  TURN_STEP_SECONDS,
} from '../engine/rules.ts';
import { shellRulesFor, type MatchWorld } from '../engine/match.ts';
import type { ChannelRules, MatchState, Side, StickInput, VehicleState } from '../engine/types.ts';
import { NO_INPUT } from '../engine/types.ts';
import type { Shell } from '../engine/shell.ts';
import {
  add,
  cross,
  distance,
  dot,
  HEADING_STEPS,
  headingVector,
  scale,
  sub,
  vec,
  wrapStep,
  type Vec2,
} from '../engine/vec.ts';
import {
  bestShot,
  incomingThreat,
  planShots,
  turnSteps,
  type AimTarget,
  type ShotModel,
  type ShotPlan,
  type ShotPreference,
  type Threat,
} from './aim.ts';
import { segmentBlocked } from '../engine/walls.ts';
import { createNavigator, type Navigator } from './navigation.ts';
import { createLookout, type Lookout, type Sighting } from './perception.ts';
import { duelStyle, type DuelStyle } from './personality.ts';
import { DUEL_TUNING, type DuelTuning } from './tuning.ts';

export interface Commander {
  readonly kid: KidId;
  /** The stick for this step. Call once per step with the state before stepping. */
  think(state: MatchState, world: MatchWorld, dt: number): StickInput;
}

/** Units of open floor a kid wants in front of the barrel before letting fly on a hunch. */
const OPEN_AHEAD = 8;
/** A shell is let go along its line and first corrected this many seconds after firing. */
const FIRST_CORRECTION = 0.25;
/**
 * Seconds before a guided shell can be bent: the first correction, then one turn step of the
 * barrel. Over a shorter flight a guided shell flies as straight as any other.
 */
const CURL_DELAY_SECONDS = FIRST_CORRECTION + TURN_STEP_SECONDS;
/** The shortest flight (seconds) on which a feint can swing a guided shell a step out and back. */
const FEINT_FLIGHT_SECONDS = CURL_DELAY_SECONDS + 2 * TURN_STEP_SECONDS;
/** How far sideways one heading step bends a shell, per unit it flies afterwards. */
const BEND_PER_UNIT = Math.sin((2 * Math.PI) / HEADING_STEPS);
/** A shell gone this soon without scoring fizzled on a wall: time to move rather than try again. */
const FIZZLE_SECONDS = 0.3;
/** With Own ricochets on, how wide a berth (units) a kid gives its own tank when judging a bank. */
const SELF_MARGIN = 0.4;
/** A shell back this soon was fired at a wall under the kid's nose: nobody does that on purpose. */
const OBVIOUS_RETURN_SECONDS = 0.6;
/** With the Reverse gear setting, how long a wedged kid backs away before driving on (seconds). */
const BACK_OFF_SECONDS = 0.6;
/** Misses in a row from one place after which a kid goes closer instead of trying again. */
const MISSES_BEFORE_CLOSING_IN = 3;
/** How far (units) a kid may move and still be missing "from the same place". */
const SAME_PLACE = 8;
/** Seconds an enemy must sit within a couple of units before a kid treats it as dug in. */
const DUG_IN_SECONDS = 30;
/** How far (units) an enemy may shift and still count as sitting still. */
const DUG_IN_DRIFT = 2;
/** How far off the line (a share of the tank's radius) a straight shot may pass and still hit. */
const LINE_UP_SHARE = 0.8;
/** Units a second a chasing pilot reckons on closing at, to judge where to meet the enemy. */
const CHASE_SPEED = 8;
/** The furthest ahead (seconds) a pilot leads its chase. */
const MAX_CHASE_LEAD = 2;
/** How far a machine-gun burst carries. */
const MACHINE_GUN_REACH = MACHINE_GUN_SPEED * MACHINE_GUN_LIFE;

interface PointMemory {
  readonly zoneCounts: readonly number[];
  readonly clockwiseTurns: number;
  readonly anticlockwiseTurns: number;
}

function positionToZone(pos: Vec2): number {
  const col = Math.min(3, Math.max(0, Math.floor(pos.x / 16)));
  const row = Math.min(2, Math.max(0, Math.floor(pos.y / (40 / 3))));
  return row * 4 + col;
}

function zoneToCenter(zone: number): Vec2 {
  const col = zone % 4;
  const row = Math.floor(zone / 4);
  return vec((col + 0.5) * 16, (row + 0.5) * (40 / 3));
}

function vectorToHeading(dir: Vec2): number {
  const angle = (Math.atan2(dir.y, dir.x) + 2 * Math.PI) % (2 * Math.PI);
  return wrapStep(Math.round((angle / (2 * Math.PI)) * 16));
}

function torusDistance(ax: number, ay: number, bx: number, by: number): number {
  let dx = Math.abs(ax - bx) % 64;
  if (dx > 32) dx = 64 - dx;
  let dy = Math.abs(ay - by) % 40;
  if (dy > 20) dy = 40 - dy;
  return Math.hypot(dx, dy);
}

function torusOffset(from: Vec2, to: Vec2): Vec2 {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (dx > 32) dx -= 64;
  else if (dx < -32) dx += 64;
  if (dy > 20) dy -= 40;
  else if (dy < -20) dy += 40;
  return { x: dx, y: dy };
}

/** Instantiates a commander controlling one side of the battlefield. */
export function createCommander(
  kid: KidId,
  side: Side,
  channel: ChannelRules,
  world: MatchWorld,
  rng: Rng,
  tuning: DuelTuning = DUEL_TUNING,
): Commander {
  const style: DuelStyle = duelStyle(kid, tuning);
  const settings = aiSettings(kid, {
    reactionMs: [tuning.reactionSlowMs, tuning.reactionFastMs],
    errorRate: [0.02, tuning.errorRateMax],
  });
  const lookout: Lookout = createLookout(side);
  const navigator: Navigator | null =
    channel.field.kind === 'arena' ? createNavigator(world.field as Arena) : null;

  // Decision timing and pacing
  let decisionTimer = 0;
  let wasThreatened = false;
  // The Own ricochets setting, read from the match each step: then a kid's own bounced shell is a
  // danger too, and the most pressing shell is the one it dodges.
  let ownRicochets = false;
  let dangerShell: Shell | null = null;

  // Active tactical intentions
  let targetHeading = 0;
  let plannedFireHeading = -1;
  let wantFire = false;
  let tankDrive = false;
  let aircraftThrottle: -1 | 0 | 1 = 0;

  // Navigation waypoint tracking
  let currentGoal: Vec2 | null = null;
  let waypoints: Vec2[] = [];
  let waypointIndex = 0;
  let routeAge = 0;

  // Steering latency and lag mechanics
  let turnLagTimer = 0;
  let lastTurnInput: -1 | 0 | 1 = 0;
  let firedLastStep = false;

  // Rosa guided shot baiting
  let baitOffset = 0;
  let baitStepsLeft = 0;
  // How far off a kid steers its guided shell, chosen at each decision and held in between
  let steerOffset = 0;
  // A shell let fly without a plan is curled about wildly, not brought in on target
  let wildShell = false;
  // When the kid next corrects its guided shell's line
  let nextSteer = 0;
  // When the kid last fired (for fizzles), and last scored: the longer it goes without a hit, the
  // closer it is willing to fight, as a person who keeps missing from range moves in.
  let lastShotAt = 0;
  let lastScoredAt = 0;
  let ownScore = 0;
  let hadShell = false;
  // Misses in a row, and where the run of misses began.
  let missesInARow = 0;
  let missingFrom: Vec2 | null = null;
  // Where the enemy settled, and when: an enemy dug in behind cover has to be gone after.
  let enemySettled: { readonly position: Vec2; readonly since: number } | null = null;

  // Benny adaptive habit memory
  const memoryHistory: PointMemory[] = [];
  let currentZoneCounts = new Array<number>(12).fill(0);
  let currentCw = 0;
  let currentCcw = 0;
  let lastEnemyHeading = -1;
  let lastPointTotal = 0;

  // Round hot and cold spell variance
  let roundMisjudge = style.misjudge;

  // Where a careful kid means to shoot from, kept until the enemy is seen somewhere new
  let firingSpotCache: {
    readonly enemy: Vec2;
    readonly spot: Vec2 | null;
    readonly age: number;
  } | null = null;
  // After being hit, a careful kid gets out of the line of fire before anything else
  let retreatUntil = -1;
  let wasVictim = false;
  // After any spin a person takes a moment to find the target again; so does a kid.
  let holdFireUntil = -1;
  let wasFrozen = false;
  // Where and when the tank set off: a tank that keeps driving without getting anywhere picks
  // somewhere else to go.
  let drivingFrom: { readonly position: Vec2; readonly since: number } | null = null;
  // With the Reverse gear setting a wedged tank backs out first, as a player would.
  let backingUntil = -1;
  let detour: Vec2 | null = null;

  function recordBennyPoint(): void {
    memoryHistory.push({
      zoneCounts: [...currentZoneCounts],
      clockwiseTurns: currentCw,
      anticlockwiseTurns: currentCcw,
    });
    if (memoryHistory.length > settings.memory) {
      memoryHistory.shift();
    }
    currentZoneCounts = new Array<number>(12).fill(0);
    currentCw = 0;
    currentCcw = 0;
  }

  /** The walkable spot nearest to where the kid would stand to fight the enemy from its favourite range. */
  function standOff(from: Vec2, enemyPos: Vec2, range: number): Vec2 {
    const away = sub(from, enemyPos);
    const span = Math.max(1e-6, Math.hypot(away.x, away.y));
    // Tanks only drive forwards: backing off means turning tail under fire, so a kid the enemy has
    // already closed on stands its ground, shuffling a little sideways so it is no sitting duck.
    if (span <= range) {
      if (!navigator || rng.chance(0.5)) return from;
      const across = vec(-away.y / span, away.x / span);
      const shuffle = add(from, scale(across, rng.pick([-1, 1]) * rng.float(3, 5)));
      return navigator.walkable(shuffle) ? shuffle : from;
    }
    const wanted = add(enemyPos, scale(away, range / span));
    if (!navigator) return wanted;
    return navigator
      .spots()
      .reduce(
        (best, spot) => (distance(spot, wanted) < distance(best, wanted) ? spot : best),
        from,
      );
  }

  /**
   * The heading that points the kid's own guided shell at the enemy's led position, with its error.
   * While a wall still stands between the shell and the enemy the shell is held on its line: turned
   * in early it would only fly into the wall.
   */
  function guidedBearing(state: MatchState, enemy: Sighting): number {
    const ownShell = state.shells[side];
    if (!ownShell) return targetHeading;
    const arrival = distance(ownShell.position, enemy.position) / 40;
    const led = add(enemy.position, scale(enemy.velocity, arrival));
    if (segmentBlocked(ownShell.position, led, world.edges)) {
      return vectorToHeading(ownShell.direction);
    }
    return wrapStep(vectorToHeading(sub(led, ownShell.position)) + steerOffset);
  }

  /** A walkable spot a few units from `place`, picked at random among the close ones. */
  function spotNear(place: Vec2): Vec2 | null {
    if (!navigator) return null;
    const close = navigator.spots().filter((spot) => distance(spot, place) < 8);
    return close.length > 0 ? rng.pick(close) : null;
  }

  /**
   * A shell gone without a point. One that died just past the barrel fizzled, and a person stops
   * and finds a better spot at once. One who keeps missing from the same place at an enemy dug in
   * behind cover goes closer to winkle it out.
   */
  function noteMiss(state: MatchState, ownLeader: VehicleState, enemy: Sighting): void {
    if (missingFrom === null || distance(missingFrom, ownLeader.position) > SAME_PLACE) {
      missingFrom = ownLeader.position;
      missesInARow = 0;
    }
    missesInARow++;
    const fizzled = state.time - lastShotAt < FIZZLE_SECONDS;
    const dugIn = enemySettled !== null && state.time - enemySettled.since > DUG_IN_SECONDS;
    const closeIn = dugIn && missesInARow >= MISSES_BEFORE_CLOSING_IN;
    if (!fizzled && !closeIn) return;
    holdFireUntil = Math.max(holdFireUntil, state.time + 2 * style.thinkEvery + 0.4);
    // A fizzle on the way in keeps to the way in.
    detour = closeIn ? spotNear(enemy.position) : (detour ?? nearbySpot(ownLeader.position));
    routeAge = 99;
    if (closeIn) missingFrom = null;
  }

  /** Somewhere a short drive away, for a kid that wants a different angle. */
  function nearbySpot(from: Vec2): Vec2 | null {
    if (!navigator) return null;
    const near = navigator.spots().filter((spot) => {
      const reach = distance(spot, from);
      return reach > 4 && reach < 12;
    });
    return near.length > 0 ? rng.pick(near) : null;
  }

  /**
   * Whether the barrel, turned to its nearest heading, points a straight shot at `target`. With
   * sixteen headings, a target that sits between two of them cannot be hit from where the tank is.
   */
  function linesUp(ownLeader: VehicleState, target: Vec2): boolean {
    const toTarget = sub(target, ownLeader.position);
    const barrel = headingVector(vectorToHeading(toTarget));
    if (Math.abs(cross(barrel, toTarget)) > TANK_RADIUS * LINE_UP_SHARE) return false;
    // The shell flies the barrel's line, not the line between the two tanks: through a gap in the
    // cover the one can be clear while the other clips a corner.
    const abreast = add(ownLeader.position, scale(barrel, dot(barrel, toTarget)));
    return !segmentBlocked(ownLeader.position, abreast, world.edges);
  }

  /**
   * Whether a shell fired straight from here can score on `target`: a guided shell from far enough
   * off curls in from any heading, anything closer needs the barrel lined up, and under the
   * billiard rule a straight line never scores.
   */
  function scoresStraight(ownLeader: VehicleState, target: Vec2): boolean {
    if (channel.billiard) return false;
    const curlsIn =
      channel.shot === 'guided' &&
      distance(ownLeader.position, target) >
        shellRulesFor(channel, false).speed * CURL_DELAY_SECONDS;
    return curlsIn || linesUp(ownLeader, target);
  }

  /** How far off (units) the kid may judge where an enemy this far away really is. */
  function aimBlur(range: number): number {
    return (tuning.blurBase + roundMisjudge * tuning.blurPerError) * range * tuning.blurPerUnit;
  }

  /** The enemy's velocity as the kid judges it when leading a shot: a little too fast or too slow. */
  function misjudgedVelocity(enemy: Sighting): Vec2 {
    return scale(enemy.velocity, 1 + rng.float(-style.leadError, style.leadError));
  }

  /** The heading the kid actually picks for a planned shot: now and then a step off, banks more so. */
  function misjudgedHeading(planned: number, bounces: number): number {
    const bankSlip = 1 - (1 - style.bankMisjudge) ** bounces;
    if (rng.chance(roundMisjudge) || rng.chance(bankSlip)) {
      return wrapStep(planned + rng.pick([-1, 1]));
    }
    return planned;
  }

  /** Whether a shell fired along `heading` now would fly a fair way before meeting a wall. */
  function openAhead(ownLeader: VehicleState, heading: number): boolean {
    const reach = add(ownLeader.position, scale(headingVector(heading), OPEN_AHEAD));
    return !segmentBlocked(ownLeader.position, reach, world.edges);
  }

  /**
   * The heading to sidestep a shell flying along `shellDirection`: a quarter turn either way,
   * whichever leads into open floor (or the nearer turn when both do).
   */
  function sidestep(ownLeader: VehicleState, shellDirection: Vec2): number {
    const shellHeading = vectorToHeading(shellDirection);
    const options = [wrapStep(shellHeading + 4), wrapStep(shellHeading - 4)].sort(
      (a, b) =>
        Math.abs(turnSteps(ownLeader.heading, a)) - Math.abs(turnSteps(ownLeader.heading, b)),
    );
    for (const heading of options) {
      const ahead = add(ownLeader.position, scale(headingVector(heading), 3));
      if (!navigator || navigator.walkable(ahead)) return heading;
    }
    return options[0] ?? ownLeader.heading;
  }

  /**
   * The nearest place, within reach, from which a shot would hit the enemy where it was last seen.
   * Searched only when the enemy turns up somewhere new or every few seconds: it is the costliest
   * thought a kid has.
   */
  function firingSpot(
    ownLeader: VehicleState,
    enemyPos: Vec2,
    now: number,
    range: number,
  ): Vec2 | null {
    if (!navigator) return null;
    const cached = firingSpotCache;
    if (cached && distance(cached.enemy, enemyPos) < 3 && now - cached.age < 3) return cached.spot;
    // In billiard channels only banks count, so look as deep as the kid can see.
    const depth = channel.billiard ? style.bankDepth : Math.min(1, style.bankDepth);
    const model = tankShotModel(depth, null);
    const target: AimTarget = { position: enemyPos, velocity: vec(0, 0), radius: TANK_RADIUS };
    const preference: ShotPreference = {
      ...(channel.billiard ? { minBounces: 1 } : {}),
      maxBounces: depth,
    };
    const candidates = [...navigator.spots()]
      .filter((spot) => {
        const reach = distance(spot, enemyPos);
        return reach > range * 0.6 && reach < range * 1.5;
      })
      .sort((a, b) => distance(a, ownLeader.position) - distance(b, ownLeader.position))
      .slice(0, channel.billiard ? 48 : 24);
    let found: Vec2 | null = null;
    for (const spot of candidates) {
      const plans = planShots(spot, TANK_MUZZLE, target, world.edges, model);
      if (bestShot(plans, ownLeader.heading, preference)) {
        found = spot;
        break;
      }
    }
    firingSpotCache = { enemy: enemyPos, spot: found, age: now };
    return found;
  }

  function planTankMove(ownLeader: VehicleState, enemy: Sighting, now: number): void {
    const enemyPos = enemy.position;
    wantFire = false;
    plannedFireHeading = -1;

    let goal: Vec2;
    const wanderRoll = rng.chance(style.wander);

    if (detour) {
      goal = detour;
      if (distance(ownLeader.position, detour) < 2) detour = null;
    } else if (wanderRoll && navigator) {
      // Wandering picks an unpredictable reachable position
      const spots = navigator.coverFrom(enemyPos);
      goal = spots.length > 0 ? rng.pick(spots) : enemyPos;
    } else if (style.learns && memoryHistory.length > 0) {
      // Benny targets the zone the opponent visits most often
      const totalZones = new Array<number>(12).fill(0);
      let totalCw = 0;
      let totalCcw = 0;

      for (const pt of memoryHistory) {
        totalCw += pt.clockwiseTurns;
        totalCcw += pt.anticlockwiseTurns;
        for (let z = 0; z < 12; z++) {
          totalZones[z] = (totalZones[z] ?? 0) + (pt.zoneCounts[z] ?? 0);
        }
      }

      let bestZone = 0;
      let maxVisits = -1;
      for (let z = 0; z < 12; z++) {
        const count = totalZones[z] ?? 0;
        if (count > maxVisits) {
          maxVisits = count;
          bestZone = z;
        }
      }

      const zoneCenter = zoneToCenter(bestZone);
      // Approach from the side the opponent turns away from most
      const approachOffset = totalCw > totalCcw ? -4 : 4;
      goal = vec(zoneCenter.x + approachOffset, zoneCenter.y);
    } else if (navigator) {
      // Work round to a spot with a shot on the enemy, near the kid's favourite range; failing that,
      // close in. A kid that has not scored for a while grows impatient and accepts a closer fight.
      const range =
        style.preferredRange * Math.max(0.45, 1 - (now - lastScoredAt) / tuning.impatienceSeconds);
      goal =
        firingSpot(ownLeader, enemyPos, now, range) ??
        standOff(ownLeader.position, enemyPos, range);
    } else {
      goal = enemyPos;
    }

    // Refresh route if goal moved significantly or periodically
    const goalShifted = currentGoal === null || distance(goal, currentGoal) > 2;
    const routeExpired = routeAge >= 2.0;
    const needsRoute = waypoints.length === 0 || waypointIndex >= waypoints.length;

    if (navigator && (goalShifted || routeExpired || needsRoute)) {
      currentGoal = goal;
      waypoints = navigator.route(ownLeader.position, goal);
      waypointIndex = 0;
      routeAge = 0;
    }

    // Progress along path waypoints
    let wp = waypoints[waypointIndex];
    while (wp && distance(ownLeader.position, wp) <= 1.0) {
      waypointIndex++;
      wp = waypoints[waypointIndex];
    }

    // At close quarters with a clear line that can score, or with nowhere left to drive, a person
    // keeps the gun on the enemy rather than on the route.
    const canHit = scoresStraight(ownLeader, enemyPos);
    const closeQuarters =
      enemy.visible &&
      canHit &&
      distance(ownLeader.position, enemyPos) < tuning.closeQuarters &&
      !segmentBlocked(ownLeader.position, enemyPos, world.edges);
    if (wp && !closeQuarters) {
      targetHeading = vectorToHeading(sub(wp, ownLeader.position));
      const headingDiff = Math.abs(turnSteps(ownLeader.heading, targetHeading));
      tankDrive = headingDiff <= 1;
      return;
    }
    targetHeading = vectorToHeading(sub(enemyPos, ownLeader.position));
    tankDrive = false;
    // Arrived with a wall still in the way: two kids would face each other through it for ever, so
    // go round to the enemy instead.
    if (closeQuarters) return;
    if (segmentBlocked(ownLeader.position, enemyPos, world.edges)) {
      detour = spotNear(enemyPos);
      routeAge = 99;
    } else if (!canHit) {
      // In plain view but with no shot that can score from here: shuffle to a new angle.
      detour = nearbySpot(ownLeader.position);
      routeAge = 99;
    }
  }

  /**
   * A tank's decision, in order of urgency: get out of a shell's way, steer its own guided shell,
   * hunt an enemy it has lost, let fly on a hunch, take a planned shot, or move.
   */
  function decideTank(
    state: MatchState,
    ownLeader: VehicleState,
    enemy: Sighting,
    isThreat: boolean,
    hasShell: boolean,
  ): void {
    if (tryDodge(state, ownLeader, isThreat)) return;
    if (hasShell && channel.shot === 'guided') {
      steerOwnShell(ownLeader, enemy);
      return;
    }
    const retreating = state.time < retreatUntil;
    const settling = state.time < holdFireUntil;
    if (huntUnseen(state, ownLeader, enemy, hasShell, settling)) return;
    if (!hasShell && !settling && !retreating && tryWildShot(ownLeader, enemy)) return;
    if (!hasShell && !settling && tryPlannedShot(ownLeader, enemy, retreating)) return;
    if (retreating) takeCover(ownLeader, enemy);
    planTankMove(ownLeader, enemy, state.time);
  }

  /** Dodges a shell on a collision course, or one heading this way that could still curl in. */
  function tryDodge(state: MatchState, ownLeader: VehicleState, isThreat: boolean): boolean {
    // The enemy's shell, or with Own ricochets the kid's own when that is the nearer danger.
    const enemyShell = dangerShell ?? state.shells[(1 - side) as Side];
    const comingThisWay =
      enemyShell !== null &&
      distance(enemyShell.position, ownLeader.position) < 24 &&
      dot(enemyShell.direction, sub(ownLeader.position, enemyShell.position)) > 0;
    const dodgeChance = isThreat
      ? 0.3 + style.care * 0.7
      : comingThisWay
        ? style.care * tuning.dodgePerCare
        : 0;
    if (!enemyShell || !rng.chance(dodgeChance)) return false;
    // A tank turns too slowly to dodge by turning: it only works if it can already drive clear.
    const escape = sidestep(ownLeader, enemyShell.direction);
    if (Math.abs(turnSteps(ownLeader.heading, escape)) > 2) return false;
    targetHeading = escape;
    tankDrive = true;
    wantFire = false;
    plannedFireHeading = -1;
    return true;
  }

  /** Chooses how far off the kid steers its guided shell this time, and how it drives meanwhile. */
  function steerOwnShell(ownLeader: VehicleState, enemy: Sighting): void {
    // Steering a shell is a skill: a steady hand holds the line, a wild one overcorrects.
    steerOffset = wildShell
      ? rng.pick([-3, -2, 2, 3])
      : rng.chance(
            roundMisjudge * tuning.steerErrorPerMisjudge +
              settings.randomness * tuning.steerErrorPerRandom,
          )
        ? rng.pick([-1, 1]) * (rng.chance(settings.randomness * 0.6) ? 2 : 1)
        : 0;
    if (baitStepsLeft > 0) {
      steerOffset += baitOffset;
      baitStepsLeft--;
    }
    wantFire = false;
    plannedFireHeading = -1;
    // Hold position while the shell flies, unless the enemy is closing in at point-blank range.
    const distToEnemy = distance(ownLeader.position, enemy.position);
    const enemyClosing = dot(enemy.velocity, sub(ownLeader.position, enemy.position)) > 0.5;
    tankDrive = distToEnemy < 6 && enemyClosing;
  }

  /**
   * An enemy unseen for a while is hunted: a probing shot towards where it was (true when one is
   * fired), or a drive to look where it was last seen.
   */
  function huntUnseen(
    state: MatchState,
    ownLeader: VehicleState,
    enemy: Sighting,
    hasShell: boolean,
    settling: boolean,
  ): boolean {
    const unseenFor = state.time - enemy.seenAt;
    if (enemy.visible || unseenFor <= 2.5) return false;
    const bearing = vectorToHeading(sub(enemy.position, ownLeader.position));
    if (
      !hasShell &&
      !settling &&
      !segmentBlocked(ownLeader.position, enemy.position, world.edges) &&
      scoresStraight(ownLeader, enemy.position) &&
      !comesBack(ownLeader, bearing, enemy.position) &&
      rng.chance(0.15 + style.push * 0.3)
    ) {
      targetHeading = bearing;
      plannedFireHeading = bearing;
      wantFire = true;
      wildShell = false;
      tankDrive = false;
      return true;
    }
    // Out of sight for long, a kid goes looking where the enemy was last seen, as a person would.
    if (navigator && !detour && unseenFor > 4 && rng.chance(0.35)) {
      detour = spotNear(enemy.position) ?? rng.pick(navigator.spots());
    }
    return false;
  }

  /**
   * How a tank's shell flies for the planner, as deep as `maxBounces`. With Own ricochets on, a
   * shooter standing at `self` is told when its own ricochet would come back at it.
   */
  function tankShotModel(maxBounces: number, self: Vec2 | null): ShotModel {
    const rules = shellRulesFor(channel, false);
    return {
      speed: rules.speed,
      life: rules.lifetime,
      walls: rules.walls,
      billiard: rules.billiard,
      bounceLifeRefresh: rules.bounceLifeRefresh,
      maxBounces,
      ...(rules.wrap ? { wrap: rules.wrap } : {}),
      ...(ownRicochets && self
        ? { self: { position: self, radius: TANK_RADIUS + SELF_MARGIN } }
        : {}),
    };
  }

  /** With Own ricochets on, how a shell fired along `heading` now would fly, watched for coming home. */
  function homeWatch(ownLeader: VehicleState, heading: number, toward: Vec2): ShotPlan | undefined {
    const target: AimTarget = { position: toward, velocity: vec(0, 0), radius: TANK_RADIUS };
    const model = tankShotModel(1, ownLeader.position);
    return planShots(ownLeader.position, TANK_MUZZLE, target, world.edges, model)[heading];
  }

  /** With Own ricochets on, whether a shell fired along `heading` now would bounce back into us. */
  function comesBack(ownLeader: VehicleState, heading: number, toward: Vec2): boolean {
    return ownRicochets && (homeWatch(ownLeader, heading, toward)?.selfHit ?? false);
  }

  /** With Own ricochets on, whether firing now would put the shell straight back into us. */
  function backInTheFace(ownLeader: VehicleState, toward: Vec2): boolean {
    if (!ownRicochets) return false;
    const watch = homeWatch(ownLeader, ownLeader.heading, toward);
    return (watch?.returnsAt ?? Infinity) < OBVIOUS_RETURN_SECONDS;
  }

  /** A wild kid sometimes just lets fly at whatever is in front of it (Pip most of all). */
  function tryWildShot(ownLeader: VehicleState, enemy: Sighting): boolean {
    if (!openAhead(ownLeader, ownLeader.heading)) return false;
    if (comesBack(ownLeader, ownLeader.heading, enemy.position)) return false;
    if (!rng.chance(settings.randomness * tuning.wildPerRandom)) return false;
    targetHeading = ownLeader.heading;
    plannedFireHeading = ownLeader.heading;
    wantFire = true;
    wildShell = true;
    tankDrive = rng.chance(0.5);
    return true;
  }

  /** Plans a shot from the muzzle and lines up for it; true when it found one worth firing. */
  function tryPlannedShot(ownLeader: VehicleState, enemy: Sighting, retreating: boolean): boolean {
    const chosen = chooseShot(ownLeader, enemy, retreating);
    if (chosen === null) return false;
    const shotHeading = misjudgedHeading(chosen.heading, chosen.bounces);
    // The baiting kid's feint: a guided shot sent off to one side before it is curled in, on a
    // flight long enough to bring it back.
    if (channel.shot === 'guided' && chosen.time > FEINT_FLIGHT_SECONDS && rng.chance(style.bait)) {
      baitOffset = rng.pick([-1, 1]);
      baitStepsLeft = 1;
    }
    wildShell = false;
    targetHeading = shotHeading;
    plannedFireHeading = shotHeading;
    wantFire = true;
    tankDrive = false;
    return true;
  }

  /** The shot the kid would take now, as it judges the enemy, or null. */
  function chooseShot(
    ownLeader: VehicleState,
    enemy: Sighting,
    retreating: boolean,
  ): ShotPlan | null {
    // Pip sees two-bounce banks now and then, by luck as much as genius.
    const maxBounces = kid === 'pip' ? (rng.chance(1 / 6) ? 2 : 1) : style.bankDepth;
    const shotModel = tankShotModel(maxBounces, ownLeader.position);

    // Judging where a distant tank is gets harder with range, and harder still for a sloppy eye.
    const blur = aimBlur(distance(ownLeader.position, enemy.position));
    const target: AimTarget = {
      position: add(enemy.position, vec(rng.float(-blur, blur), rng.float(-blur, blur))),
      velocity: misjudgedVelocity(enemy),
      radius: TANK_RADIUS,
    };

    const plans = planShots(ownLeader.position, TANK_MUZZLE, target, world.edges, shotModel);
    const preference: ShotPreference = {
      ...(channel.billiard ? { minBounces: 1 } : {}),
      maxBounces,
      // A guided shell can be curled in from off the line, as far as the kid trusts its hands.
      slack: style.slack + (channel.shot === 'guided' ? style.curlReach : 0),
    };

    // A shell can only be curled in where it would pass in plain view of the target, not into the
    // far side of the wall the target hides behind, and only as far as it can bend on the way.
    const curlable = plans.filter((plan) => {
      if (plan.miss <= style.slack) return true;
      const closest = plan.path.at(-1);
      const bendable =
        Math.max(0, plan.time - CURL_DELAY_SECONDS) * shotModel.speed * BEND_PER_UNIT;
      return (
        plan.miss <= style.slack + Math.min(style.curlReach, bendable) &&
        closest !== undefined &&
        !segmentBlocked(closest, enemy.position, world.edges)
      );
    });
    let chosen = bestShot(curlable, ownLeader.heading, preference);

    // A random kid sometimes takes the second-best shot instead.
    if (chosen !== null && rng.chance(settings.randomness * tuning.secondChoicePerRandom)) {
      const first = chosen;
      const second = bestShot(
        curlable.filter((plan) => plan.heading !== first.heading),
        ownLeader.heading,
        preference,
      );
      if (second !== null) chosen = second;
    }

    // While retreating, only a sure shot; a patient kid saves straight fire for close or banked ones.
    if (chosen !== null && retreating && chosen.miss > 0) return null;
    const patient = kidById(kid).personality.patience > 0.6;
    if (chosen !== null && patient && channel.shot !== 'guided') {
      if (chosen.time >= 0.9 && chosen.bounces === 0) return null;
    }
    return chosen;
  }

  /** After a hit, a careful kid backs into the nearest cover before anything else. */
  function takeCover(ownLeader: VehicleState, enemy: Sighting): void {
    if (!navigator) return;
    const nearest = navigator
      .coverFrom(enemy.position)
      .reduce<Vec2 | null>(
        (best, spot) =>
          best === null || distance(spot, ownLeader.position) < distance(best, ownLeader.position)
            ? spot
            : best,
        null,
      );
    if (nearest) detour = nearest;
  }

  function decideAircraft(
    ownLeader: VehicleState,
    enemy: Sighting,
    hasShell: boolean,
    settling: boolean,
  ): void {
    wantFire = false;
    plannedFireHeading = -1;

    const rules = shellRulesFor(channel, false);
    const shotModel: ShotModel = {
      speed: rules.speed,
      life: rules.lifetime,
      walls: 'stop',
      billiard: false,
      bounceLifeRefresh: 1,
      maxBounces: 0,
      wrap: { width: 64, height: 40 },
    };

    const muzzleReach =
      ownLeader.vehicle === 'tank' ? TANK_MUZZLE : AIRCRAFT_MUZZLE[ownLeader.vehicle];
    const range = torusDistance(
      ownLeader.position.x,
      ownLeader.position.y,
      enemy.position.x,
      enemy.position.y,
    );
    const blur = aimBlur(range);
    const target: AimTarget = {
      position: add(enemy.position, vec(rng.float(-blur, blur), rng.float(-blur, blur))),
      velocity: misjudgedVelocity(enemy),
      radius: 1.5,
    };

    if ((!hasShell || channel.shot === 'machine-gun') && !settling) {
      const plans = planShots(ownLeader.position, muzzleReach, target, [], shotModel);
      const chosen = bestShot(plans, ownLeader.heading, { slack: style.slack });

      if (chosen !== null) {
        targetHeading = misjudgedHeading(chosen.heading, 0);
        plannedFireHeading = targetHeading;
        wantFire = true;
        return;
      }
    }

    // Air combat positioning
    const p = kidById(kid).personality;

    // Cautious pilots seek cloud cover when opponent lines up on them
    let fleeingToCloud = false;
    if (p.caution > 0.5 && channel.field.kind === 'sky') {
      const sky = world.field as SkyDef;
      const enemyToUs = torusOffset(enemy.position, ownLeader.position);
      const enemyAimBearing = vectorToHeading(enemyToUs);
      const enemyLinedUp = Math.abs(turnSteps(enemy.heading, enemyAimBearing)) <= 1;

      const usToEnemy = torusOffset(ownLeader.position, enemy.position);
      const ourAimBearing = vectorToHeading(usToEnemy);
      const weLinedUp = Math.abs(turnSteps(ownLeader.heading, ourAimBearing)) <= 1;

      if (enemyLinedUp && !weLinedUp && sky.clouds.length > 0) {
        let nearestCloud = sky.clouds[0];
        let minCloudDist = Infinity;
        for (const cloud of sky.clouds) {
          const d = torusDistance(ownLeader.position.x, ownLeader.position.y, cloud.x, cloud.y);
          if (d < minCloudDist) {
            minCloudDist = d;
            nearestCloud = cloud;
          }
        }
        if (nearestCloud) {
          const cloudVec = torusOffset(ownLeader.position, vec(nearestCloud.x, nearestCloud.y));
          targetHeading = vectorToHeading(cloudVec);
          fleeingToCloud = true;
        }
      }
    }

    if (!fleeingToCloud) {
      // A machine gun reaches only a few lengths, so a pilot flies to where the enemy will be and
      // gets on its tail; chasing where it is only ever passes it head on.
      const lead =
        channel.shot === 'machine-gun' ? Math.min(MAX_CHASE_LEAD, range / CHASE_SPEED) : 0;
      const chased = add(enemy.position, scale(enemy.velocity, lead));
      targetHeading = vectorToHeading(torusOffset(ownLeader.position, chased));
    }

    // Two planes chasing each other's tails at one speed circle for ever. With a machine gun's short
    // reach a pilot breaks the circle the way pilots do: the one behind throttles back and turns
    // inside, the one in front opens the throttle to get away.
    const offTheNose = Math.abs(turnSteps(ownLeader.heading, targetHeading)) > 1;
    if (channel.shot === 'machine-gun' && range < MACHINE_GUN_REACH * 1.5 && offTheNose) {
      const behindIt =
        dot(headingVector(enemy.heading), torusOffset(ownLeader.position, enemy.position)) > 0;
      aircraftThrottle = behindIt ? -1 : 1;
    } else if (p.aggression > 0.5) {
      if (range > 25) {
        aircraftThrottle = 1;
      } else if (range < 12) {
        const enemyDir = headingVector(enemy.heading);
        const fromEnemy = torusOffset(enemy.position, ownLeader.position);
        aircraftThrottle = dot(enemyDir, fromEnemy) < 0 ? -1 : 0;
      } else {
        aircraftThrottle = 0;
      }
    } else {
      aircraftThrottle = 0;
    }
  }

  return {
    kid,
    think(state: MatchState, _world: MatchWorld, dt: number): StickInput {
      ownRicochets = state.options.ownRicochets ?? false;
      // Being hit: once the spin ends, a careful kid makes for cover (Moss at once, Dee hardly).
      const spinningNow = state.freeze !== null && state.freeze.victim === side;
      if (
        wasVictim &&
        !spinningNow &&
        rng.chance(tuning.retreatBase + style.care * tuning.retreatPerCare)
      ) {
        retreatUntil = state.time + tuning.retreatSeconds + style.care;
        routeAge = 99;
      }
      wasVictim = spinningNow;
      const frozenNow = state.freeze !== null;
      if (wasFrozen && !frozenNow) {
        holdFireUntil = state.time + tuning.settleSeconds + style.thinkEvery * tuning.settleThinks;
      }
      wasFrozen = frozenNow;
      if (state.freeze !== null || state.over) {
        // The board stays in view during a spin: a hidden tank that was hit shows where it ends up.
        lookout.observe(state, world);
        return NO_INPUT;
      }

      const hasShellNow = state.shells[side] !== null;
      const shellEnded = hadShell && !hasShellNow;
      hadShell = hasShellNow;
      const scoredNow = state.scores[side] > ownScore;
      if (scoredNow) {
        ownScore = state.scores[side];
        lastScoredAt = state.time;
        missingFrom = null;
      }

      // Track round points for Benny adaptation and error spells
      const currentPointTotal = state.scores[0] + state.scores[1];
      if (currentPointTotal !== lastPointTotal) {
        lastPointTotal = currentPointTotal;
        if (style.learns) {
          recordBennyPoint();
        }
        const spellDraw = rng.next();
        roundMisjudge = errorRateForRound(settings, spellDraw) * 0.6;
      }

      // Step perception
      const picture = lookout.observe(state, world);
      const ownLeader = picture.own.find((v) => v.slot === 0);
      const enemy = picture.enemies[0];

      if (!ownLeader || !enemy) {
        return NO_INPUT;
      }
      if (enemySettled === null || distance(enemySettled.position, enemy.position) > DUG_IN_DRIFT) {
        enemySettled = { position: enemy.position, since: state.time };
      }
      if (shellEnded && !scoredNow && ownLeader.vehicle === 'tank')
        noteMiss(state, ownLeader, enemy);

      // Track Benny zone usage and turning habits
      if (style.learns && enemy.visible) {
        const zone = positionToZone(enemy.position);
        currentZoneCounts[zone] = (currentZoneCounts[zone] ?? 0) + 1;

        if (lastEnemyHeading >= 0 && lastEnemyHeading !== enemy.heading) {
          const diff = turnSteps(lastEnemyHeading, enemy.heading);
          if (diff > 0) currentCw++;
          else if (diff < 0) currentCcw++;
        }
        lastEnemyHeading = enemy.heading;
      }

      // Check incoming shell threat
      const enemySide = (1 - side) as Side;
      const enemyShell = state.shells[enemySide];
      let threat: Threat | null = null;
      dangerShell = null;

      if (enemyShell !== null) {
        const enemyRules = shellRulesFor(channel, state.options.handicap[enemySide]);
        threat = incomingThreat(
          enemyShell,
          enemyRules,
          ownLeader.position,
          ownLeader.radius,
          world.edges,
        );
      }

      // A kid's own shell, once it has bounced, is a danger like any other when ricochets bite.
      const ownShell = state.shells[side];
      if (ownRicochets && ownShell !== null && ownShell.bounces >= 1) {
        const ownRules = shellRulesFor(channel, state.options.handicap[side]);
        const back = incomingThreat(
          ownShell,
          ownRules,
          ownLeader.position,
          ownLeader.radius,
          world.edges,
        );
        if (back !== null && (threat === null || back.time < threat.time)) {
          threat = back;
          dangerShell = ownShell;
        }
      }

      const isThreat = threat !== null && threat.miss <= 0.6 && threat.time <= 0.8;
      const threatTriggered = isThreat && !wasThreatened;
      wasThreatened = isThreat;

      // Driving for a second and a half without getting a unit further means wedged: go somewhere
      // else nearby. Progress is measured from where the tank set off, because a tank nosing into a corner
      // is bumped back a little every step and never quite stands still.
      if (ownLeader.vehicle === 'tank' && navigator) {
        if (!tankDrive) {
          drivingFrom = null;
        } else if (drivingFrom === null || distance(drivingFrom.position, ownLeader.position) > 1) {
          drivingFrom = { position: ownLeader.position, since: state.time };
        } else if (state.time - drivingFrom.since > 1.5) {
          detour = nearbySpot(ownLeader.position) ?? rng.pick(navigator.spots());
          routeAge = 99;
          drivingFrom = null;
          if (state.options.reverseGear) backingUntil = state.time + BACK_OFF_SECONDS;
        }
      }

      // Periodic decision cycle
      decisionTimer -= dt;
      routeAge += dt;

      if (decisionTimer <= 0 || threatTriggered) {
        decisionTimer = style.thinkEvery * rng.float(0.8, 1.2);
        const hasOwnShell = state.shells[side] !== null;

        if (ownLeader.vehicle === 'tank') {
          decideTank(state, ownLeader, enemy, isThreat, hasOwnShell);
        } else {
          decideAircraft(ownLeader, enemy, hasOwnShell, state.time < holdFireUntil);
        }
      }

      // A guided shell is corrected at the kid's own cadence: often for a steady hand, seldom for a wild one.
      if (
        channel.shot === 'guided' &&
        ownLeader.vehicle === 'tank' &&
        state.shells[side] !== null &&
        state.time >= nextSteer
      ) {
        nextSteer = state.time + style.steerEvery;
        targetHeading = guidedBearing(state, enemy);
      }

      // Turning steering output
      let stickX: -1 | 0 | 1;
      const headingDiff = turnSteps(ownLeader.heading, targetHeading);

      if (headingDiff !== 0) {
        stickX = headingDiff > 0 ? 1 : -1;
        lastTurnInput = stickX;
        turnLagTimer = style.turnLag;
      } else if (turnLagTimer > 0) {
        turnLagTimer -= dt;
        stickX = lastTurnInput;
      } else {
        stickX = 0;
        lastTurnInput = 0;
      }

      // Throttle and drive output
      const backingOut = ownLeader.vehicle === 'tank' && state.time < backingUntil;
      const stickY: -1 | 0 | 1 =
        ownLeader.vehicle === 'tank' ? (backingOut ? -1 : tankDrive ? 1 : 0) : aircraftThrottle;

      // Firing output
      let stickFire = false;
      const hasLiveShell = state.shells[side] !== null;

      if (channel.shot === 'machine-gun') {
        const linedUp = Math.abs(turnSteps(ownLeader.heading, plannedFireHeading)) <= 1;
        stickFire = wantFire && linedUp;
      } else if (firedLastStep) {
        stickFire = false;
        firedLastStep = false;
      } else if (
        !hasLiveShell &&
        wantFire &&
        ownLeader.heading === plannedFireHeading &&
        backInTheFace(ownLeader, enemy.position)
      ) {
        // About to shoot the wall under its own nose: think again instead.
        wantFire = false;
        plannedFireHeading = -1;
        decisionTimer = 0;
      } else if (!hasLiveShell && wantFire && ownLeader.heading === plannedFireHeading) {
        stickFire = true;
        firedLastStep = true;
        lastShotAt = state.time;
        nextSteer = state.time + FIRST_CORRECTION;
        wantFire = false;
        plannedFireHeading = -1;
      }

      return { x: stickX, y: stickY, fire: stickFire };
    },
  };
}
