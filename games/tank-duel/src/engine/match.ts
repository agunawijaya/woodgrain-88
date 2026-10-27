/**
 * The duel itself, one fixed step at a time: both sticks are read, every
 * vehicle moves, shells fire, fly and bounce, hits score, and the 2.5-second
 * spin after a point plays out while the clock keeps running. Remix channels
 * add their rules here too (bank-only points, the Blackout radar, afterburner
 * fuel, Last Tank's short rounds). Everything that happens is reported as an
 * event, so drawing, sound and statistics never have to guess.
 */
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  compileArena,
  wallPolygons,
  type Arena,
  type SkyDef,
} from '../arenas/format.ts';
import { ARENAS } from '../arenas/layouts.ts';
import { SKIES } from '../arenas/skies.ts';
import { intentFor } from './controls.ts';
import {
  ACE_FUEL_SECONDS,
  AIRCRAFT_MUZZLE,
  BILLIARD_LIFE_FACTOR,
  BLACKOUT_SWEEP_EVERY,
  BOUNCE_LIFE_REFRESH,
  MAX_FLIGHT_FACTOR,
  BOUNCING_LIFE_FACTOR,
  FIRST_TO,
  FIRST_TO_LIMIT_SECONDS,
  HANDICAP_SHELL_LIFE,
  KNOCKBACK_DISTANCE,
  KNOCKBACK_SECONDS,
  MACHINE_GUN_INTERVAL,
  MACHINE_GUN_LIFE,
  MACHINE_GUN_SPEED,
  ROUND_SECONDS,
  SHELL_LIFE,
  SHELL_SPEED,
  SPIN_SECONDS,
  SPIN_STEPS_PER_SECOND,
  TANK_MUZZLE,
  WARNING_SECONDS,
} from './rules.ts';
import {
  canScore,
  fireShell,
  stepShell,
  type Shell,
  type ShellRules,
  type ShellStep,
} from './shell.ts';
import type {
  ChannelRules,
  Freeze,
  MatchEvent,
  MatchOptions,
  MatchState,
  MatchStep,
  RemixRule,
  Side,
  StickInput,
  VehicleState,
} from './types.ts';
import { add, distance, headingVector, normalize, scale, sub, vec, type Vec2 } from './vec.ts';
import {
  burnFuel,
  muzzlePoint,
  shove,
  spawnVehicles,
  stepAircraft,
  stepTank,
  turnBy,
  wrapSky,
} from './vehicles.ts';
import {
  buildWallEdges,
  pathHitsCircle,
  segmentBlocked,
  traceShot,
  type BounceHit,
  type WallEdge,
} from './walls.ts';

/** What a match is played on, built once: the compiled arena or sky and its wall faces. */
export interface MatchWorld {
  readonly field: Arena | SkyDef;
  readonly edges: readonly WallEdge[];
}

/** Looks the channel's field up (ARENAS / SKIES by id), compiles arenas, builds wall faces (none for skies). */
export function createWorld(channel: ChannelRules): MatchWorld {
  if (channel.field.kind === 'arena') {
    const arenaDef = ARENAS.find((candidate) => candidate.id === channel.field.id);
    if (!arenaDef) {
      throw new Error(`Arena definition ${channel.field.id} not found`);
    }
    const field = compileArena(arenaDef);
    const polygons = wallPolygons(field);
    const edges = buildWallEdges(polygons);
    return { field, edges };
  }

  const skyDef = SKIES.find((candidate) => candidate.id === channel.field.id);
  if (!skyDef) {
    throw new Error(`Sky definition ${channel.field.id} not found`);
  }
  return { field: skyDef, edges: [] };
}

/** The shell rules a side fires with on this channel (switch A shortens normal shells, not machine guns). */
export function shellRulesFor(channel: ChannelRules, handicap: boolean): ShellRules {
  const isMachineGun = channel.shot === 'machine-gun';
  const speed = isMachineGun ? MACHINE_GUN_SPEED : SHELL_SPEED;

  const baseLife = isMachineGun ? MACHINE_GUN_LIFE : handicap ? HANDICAP_SHELL_LIFE : SHELL_LIFE;

  let factor = 1;
  if (!isMachineGun) {
    if (channel.billiard) {
      factor = BILLIARD_LIFE_FACTOR;
    } else if (channel.walls === 'bounce') {
      factor = BOUNCING_LIFE_FACTOR;
    }
  }

  const lifetime = baseLife * factor;
  const wrap =
    channel.field.kind === 'sky' ? { width: ARENA_WIDTH, height: ARENA_HEIGHT } : undefined;

  return {
    speed,
    lifetime,
    walls: channel.walls,
    billiard: channel.billiard,
    bounceLifeRefresh: BOUNCE_LIFE_REFRESH,
    maxFlight: lifetime * MAX_FLIGHT_FACTOR,
    ...(wrap ? { wrap } : {}),
  };
}

export function createMatch(
  channel: ChannelRules,
  options: MatchOptions,
  world: MatchWorld,
): MatchState {
  const isLastTank = channel.remix?.kind === 'last-tank';
  const clock = isLastTank
    ? channel.remix.roundSeconds
    : options.scoring === 'timed'
      ? ROUND_SECONDS
      : Infinity;
  const vehicles = spawnVehicles(channel, world.field);
  const sweepEvery =
    channel.remix?.kind === 'blackout' ? channel.remix.sweepEvery : BLACKOUT_SWEEP_EVERY;

  return {
    channel,
    options,
    time: 0,
    clock,
    scores: [0, 0],
    vehicles,
    shells: [null, null],
    reload: [0, 0],
    fireHeld: [false, false],
    freeze: null,
    fuel: [ACE_FUEL_SECONDS, ACE_FUEL_SECONDS],
    radar: { next: sweepEvery, showing: 0 },
    round: 1,
    over: false,
    winner: null,
  };
}

interface RadarStep {
  readonly radar: { readonly next: number; readonly showing: number };
  readonly events: readonly MatchEvent[];
}

// Periodically runs radar sweeps that illuminate unseen tanks in Blackout
function advanceRadar(
  radar: { readonly next: number; readonly showing: number },
  remix: RemixRule | null,
  dt: number,
): RadarStep {
  if (remix?.kind !== 'blackout') {
    return { radar, events: [] };
  }

  const events: MatchEvent[] = [];
  let next = radar.next - dt;
  let showing = Math.max(0, radar.showing - dt);

  if (next <= 0) {
    showing = remix.sweepShows;
    next += remix.sweepEvery;
    events.push({ kind: 'radar' });
  }

  return { radar: { next, showing }, events };
}

interface ClockResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly over: boolean;
}

// Evaluates the match timer and ends the duel if the time limit expires
function advanceClock(
  state: MatchState,
  world: MatchWorld,
  inputs: readonly [StickInput, StickInput],
  nextTime: number,
  dt: number,
): ClockResult {
  const events: MatchEvent[] = [];

  // Last Tank round clock
  if (state.channel.remix?.kind === 'last-tank') {
    const remix = state.channel.remix;

    if (nextTime >= FIRST_TO_LIMIT_SECONDS) {
      const winner: Side | null =
        state.scores[0] > state.scores[1] ? 0 : state.scores[1] > state.scores[0] ? 1 : null;
      events.push({ kind: 'match-over', winner });
      return {
        state: { ...state, time: nextTime, over: true, winner },
        events,
        over: true,
      };
    }

    const nextClock = Math.max(0, state.clock - dt);
    if (nextClock <= 0) {
      events.push({ kind: 'round-over', winner: null, round: state.round });
      const resetVehicles = spawnVehicles(state.channel, world.field);
      const nextFireHeld: [boolean, boolean] = [inputs[0].fire, inputs[1].fire];
      return {
        state: {
          ...state,
          time: nextTime,
          clock: remix.roundSeconds,
          round: state.round + 1,
          vehicles: resetVehicles,
          shells: [null, null],
          reload: [0, 0],
          fireHeld: nextFireHeld,
          freeze: null,
        },
        events,
        over: false,
      };
    }

    return {
      state: {
        ...state,
        time: nextTime,
        clock: nextClock,
      },
      events,
      over: false,
    };
  }

  if (state.options.scoring === 'timed') {
    const nextClock = Math.max(0, state.clock - dt);

    if (state.clock > WARNING_SECONDS && nextClock <= WARNING_SECONDS) {
      events.push({ kind: 'warning' });
    }

    if (nextClock <= 0) {
      const winner: Side | null =
        state.scores[0] > state.scores[1] ? 0 : state.scores[1] > state.scores[0] ? 1 : null;
      events.push({ kind: 'match-over', winner });
      return {
        state: {
          ...state,
          time: nextTime,
          clock: 0,
          over: true,
          winner,
        },
        events,
        over: true,
      };
    }

    return {
      state: {
        ...state,
        time: nextTime,
        clock: nextClock,
      },
      events,
      over: false,
    };
  }

  // First to 10 fallback safety limit
  if (nextTime >= FIRST_TO_LIMIT_SECONDS) {
    const winner: Side | null =
      state.scores[0] > state.scores[1] ? 0 : state.scores[1] > state.scores[0] ? 1 : null;
    events.push({ kind: 'match-over', winner });
    return {
      state: {
        ...state,
        time: nextTime,
        over: true,
        winner,
      },
      events,
      over: true,
    };
  }

  return {
    state: {
      ...state,
      time: nextTime,
    },
    events,
    over: false,
  };
}

// Runs the post-hit spin animation where the victim rotates and is pushed back
function advanceFreeze(
  state: MatchState,
  inputs: readonly [StickInput, StickInput],
  dt: number,
  world: MatchWorld,
): { state: MatchState; events: readonly MatchEvent[] } {
  const freeze = state.freeze;
  if (!freeze) {
    return { state, events: [] };
  }

  const events: MatchEvent[] = [];
  const activeDt = Math.min(dt, freeze.seconds);
  const remainingSeconds = Math.max(0, freeze.seconds - dt);

  const totalSpin = freeze.spinCarry + SPIN_STEPS_PER_SECOND * activeDt;
  const stepsToTurn = Math.floor(totalSpin);
  const nextSpinCarry = totalSpin - stepsToTurn;

  const knockbackTimeLeft = Math.max(0, freeze.seconds - (SPIN_SECONDS - KNOCKBACK_SECONDS));
  const knockbackDt = Math.min(activeDt, knockbackTimeLeft);
  const shoveDelta =
    knockbackDt > 0
      ? scale(freeze.shove, (KNOCKBACK_DISTANCE / KNOCKBACK_SECONDS) * knockbackDt)
      : vec(0, 0);

  let nextVehicles = state.vehicles.map((vehicle) => {
    let current = vehicle;

    if (current.side === freeze.victim) {
      if (stepsToTurn > 0) {
        current = turnBy(current, stepsToTurn);
      }
      if (knockbackDt > 0) {
        current = shove(current, shoveDelta, world.edges);
      }
    }

    if (current.vehicle !== 'tank') {
      const move = scale(headingVector(current.heading), current.speed * activeDt);
      current = {
        ...current,
        position: wrapSky(add(current.position, move)),
      };
    } else {
      current = {
        ...current,
        speed: 0,
        bumped: Math.max(0, current.bumped - dt),
      };
    }

    return current;
  });

  let nextFreeze: Freeze | null = null;
  let nextClock = state.clock;
  let nextRound = state.round;
  let nextShells: [Shell | null, Shell | null] = [state.shells[0], state.shells[1]];
  let nextReload: [number, number] = [
    Math.max(0, state.reload[0] - dt),
    Math.max(0, state.reload[1] - dt),
  ];

  if (remainingSeconds <= 0) {
    events.push({ kind: 'spin-over', victim: freeze.victim });
    if (state.channel.remix?.kind === 'last-tank' && !state.over) {
      nextVehicles = spawnVehicles(state.channel, world.field);
      nextClock = state.channel.remix.roundSeconds;
      nextRound = state.round + 1;
      nextShells = [null, null];
      nextReload = [0, 0];
    }
  } else {
    nextFreeze = {
      seconds: remainingSeconds,
      victim: freeze.victim,
      shove: freeze.shove,
      spinCarry: nextSpinCarry,
    };
  }

  const nextFireHeld: [boolean, boolean] = [inputs[0].fire, inputs[1].fire];

  return {
    state: {
      ...state,
      vehicles: nextVehicles,
      shells: nextShells,
      freeze: nextFreeze,
      clock: nextClock,
      round: nextRound,
      fireHeld: nextFireHeld,
      reload: nextReload,
    },
    events,
  };
}

// Drives tanks and flies aircraft along their current player input intents
function advanceVehicles(
  state: MatchState,
  inputs: readonly [StickInput, StickInput],
  dt: number,
  world: MatchWorld,
): {
  vehicles: readonly VehicleState[];
  fuel: readonly [number, number];
  events: readonly MatchEvent[];
} {
  const events: MatchEvent[] = [];
  const nextVehicles: VehicleState[] = [];
  const isAceDuel = state.channel.remix?.kind === 'ace-duel';
  const aceRule = isAceDuel ? state.channel.remix : null;

  for (const vehicle of state.vehicles) {
    const input = inputs[vehicle.side];
    const intent = intentFor(
      input,
      vehicle.vehicle,
      state.options.wiring,
      state.options.reverseGear ?? false,
    );

    if (vehicle.vehicle === 'tank') {
      const others = state.vehicles.filter((v) => v.id !== vehicle.id);
      const step = stepTank(vehicle, intent, dt, { edges: world.edges, others });
      nextVehicles.push(step.vehicle);
      events.push(...step.events);
    } else {
      const handicap = state.options.handicap[vehicle.side];
      const fastAllowed = !isAceDuel || state.fuel[vehicle.side] > 0;
      const step = stepAircraft(vehicle, intent, dt, { handicap, fastAllowed });
      nextVehicles.push(step.vehicle);
      events.push(...step.events);
    }
  }

  const nextFuel: [number, number] = [state.fuel[0], state.fuel[1]];
  if (aceRule) {
    for (const side of [0, 1] as const) {
      const leader = state.vehicles.find((v) => v.side === side && v.slot === 0);
      const craft = leader?.vehicle ?? 'jet';
      const intent = intentFor(inputs[side], craft, state.options.wiring);
      nextFuel[side] = burnFuel(
        state.fuel[side],
        intent.throttle,
        dt,
        aceRule.fuelSeconds,
        aceRule.refillPerSecond,
      );
    }
  }

  return { vehicles: nextVehicles, fuel: nextFuel, events };
}

interface FiringResult {
  readonly shells: readonly [Shell | null, Shell | null];
  readonly reload: readonly [number, number];
  readonly fireHeld: readonly [boolean, boolean];
  readonly events: readonly MatchEvent[];
}

// Processes fire button triggers and spawns new shells from formation leaders
function advanceFiring(
  state: MatchState,
  vehicles: readonly VehicleState[],
  inputs: readonly [StickInput, StickInput],
  dt: number,
  world: MatchWorld,
): FiringResult {
  const events: MatchEvent[] = [];
  const shells: [Shell | null, Shell | null] = [state.shells[0], state.shells[1]];
  const reload: [number, number] = [
    Math.max(0, state.reload[0] - dt),
    Math.max(0, state.reload[1] - dt),
  ];
  const fireHeld: [boolean, boolean] = [inputs[0].fire, inputs[1].fire];

  for (const side of [0, 1] as const) {
    const leader = vehicles.find((v) => v.side === side && v.slot === 0);
    if (!leader) {
      continue;
    }

    const input = inputs[side];
    const wasHeld = state.fireHeld[side];
    const isDown = input.fire;
    const newlyPressed = isDown && !wasHeld;
    const isMachineGun = state.channel.shot === 'machine-gun';
    const machineGunRepeat = isMachineGun && isDown && reload[side] <= 0;
    const hasShell = shells[side] !== null;

    if ((newlyPressed || machineGunRepeat) && !hasShell) {
      const rules = shellRulesFor(state.channel, state.options.handicap[side]);
      const muzzle = muzzlePoint(leader);
      const direction = headingVector(leader.heading);

      if (segmentBlocked(leader.position, muzzle, world.edges)) {
        const reach = leader.vehicle === 'tank' ? TANK_MUZZLE : AIRCRAFT_MUZZLE[leader.vehicle];
        const trace = traceShot(leader.position, direction, reach, world.edges, {
          bounce: state.channel.walls === 'bounce',
        });

        events.push({
          kind: 'fired',
          side,
          at: muzzle,
          direction,
          shot: state.channel.shot,
        });

        if (state.channel.walls === 'stop') {
          events.push({
            kind: 'shell-gone',
            side,
            at: trace.end,
            reason: 'wall',
          });
          shells[side] = null;
        } else {
          shells[side] = {
            owner: side,
            position: trace.end,
            direction: trace.direction,
            life: rules.lifetime,
            age: 0,
            bounces: trace.hits.length,
            path: [leader.position, ...trace.hits.map((h) => h.at)],
          };
        }
      } else {
        shells[side] = fireShell(side, muzzle, direction, rules);
        events.push({
          kind: 'fired',
          side,
          at: muzzle,
          direction,
          shot: state.channel.shot,
        });
      }

      if (isMachineGun) {
        reload[side] = MACHINE_GUN_INTERVAL;
      }
    }
  }

  return { shells, reload, fireHeld, events };
}

interface SteppedShell {
  readonly side: Side;
  readonly originalShell: Shell;
  readonly stepResult: ShellStep;
  readonly rules: ShellRules;
}

interface ContactCandidate {
  readonly target: VehicleState;
  readonly distance: number;
  readonly at: Vec2;
  readonly direction: Vec2;
  readonly hitsBefore: readonly BounceHit[];
  readonly bouncesAtContact: number;
}

// Finds the direction along the polyline path at a specific distance from the start
function directionAtContact(travelled: readonly Vec2[], hitDistance: number, fallback: Vec2): Vec2 {
  let distAccum = 0;
  for (let i = 0; i < travelled.length - 1; i++) {
    const p1 = travelled[i];
    const p2 = travelled[i + 1];
    if (p1 && p2) {
      const segLen = distance(p1, p2);
      if (hitDistance <= distAccum + segLen + 1e-6) {
        if (segLen > 1e-6) {
          return normalize(sub(p2, p1));
        }
      }
      distAccum += segLen;
    }
  }
  return fallback;
}

/** Where a vehicle can be met: itself, and on a wrapping sky its copies one board away each way. */
const ARENA_COPIES: readonly Vec2[] = [vec(0, 0)];
const SKY_COPIES: readonly Vec2[] = [
  vec(0, 0),
  vec(-ARENA_WIDTH, 0),
  vec(ARENA_WIDTH, 0),
  vec(0, -ARENA_HEIGHT),
  vec(0, ARENA_HEIGHT),
  vec(-ARENA_WIDTH, -ARENA_HEIGHT),
  vec(ARENA_WIDTH, -ARENA_HEIGHT),
  vec(-ARENA_WIDTH, ARENA_HEIGHT),
  vec(ARENA_WIDTH, ARENA_HEIGHT),
];

/** Each side's shell moved on by one step, guided shells turned with their vehicle first. */
function stepEachShell(
  state: MatchState,
  vehicles: readonly VehicleState[],
  shells: readonly [Shell | null, Shell | null],
  dt: number,
  world: MatchWorld,
): SteppedShell[] {
  const stepped: SteppedShell[] = [];
  for (const side of [0, 1] as const) {
    const shell = shells[side];
    if (shell === null) continue;
    const leader = vehicles.find((v) => v.side === side && v.slot === 0);
    const steer =
      state.channel.shot === 'guided' && leader ? headingVector(leader.heading) : undefined;
    const rules = shellRulesFor(state.channel, state.options.handicap[side]);
    stepped.push({
      side,
      originalShell: shell,
      stepResult: stepShell(shell, dt, world.edges, rules, steer),
      rules,
    });
  }
  return stepped;
}

/** Every place this step's flight met one of `targets` with a bounce count that `counts`, nearest first. */
function contacts(
  stepped: SteppedShell,
  targets: readonly VehicleState[],
  copies: readonly Vec2[],
  counts: (bouncesAtContact: number) => boolean,
): ContactCandidate[] {
  const candidates: ContactCandidate[] = [];
  for (const target of targets) {
    for (const offset of copies) {
      const hitCircle = pathHitsCircle(
        stepped.stepResult.travelled,
        add(target.position, offset),
        target.radius,
      );
      if (hitCircle === null) continue;
      const hitsBefore = stepped.stepResult.hits.filter((h) => h.distance < hitCircle.distance);
      const bouncesAtContact = stepped.originalShell.bounces + hitsBefore.length;
      if (!counts(bouncesAtContact)) continue;
      candidates.push({
        target,
        distance: hitCircle.distance,
        at: hitCircle.at,
        direction: directionAtContact(
          stepped.stepResult.travelled,
          hitCircle.distance,
          stepped.originalShell.direction,
        ),
        hitsBefore,
        bouncesAtContact,
      });
    }
  }
  return candidates.sort((a, b) => a.distance - b.distance);
}

/** Where this step's flight met an enemy in a way that scores (the billiard rule included). */
function scoringContact(
  stepped: SteppedShell,
  enemies: readonly VehicleState[],
  copies: readonly Vec2[],
): ContactCandidate | undefined {
  const scores = (bounces: number) =>
    canScore({ ...stepped.originalShell, bounces }, stepped.rules);
  return contacts(stepped, enemies, copies, scores)[0];
}

/**
 * Where this step's flight came back into its own side, with the Own ricochets setting. Only a shell
 * that has bounced can: one straight from the barrel, or curled round by a guided turn, or carried
 * round a wrapping sky, never hurts the side that fired it.
 */
function ownContact(
  state: MatchState,
  stepped: SteppedShell,
  own: readonly VehicleState[],
  copies: readonly Vec2[],
): ContactCandidate | undefined {
  if (!state.options.ownRicochets) return undefined;
  return contacts(stepped, own, copies, (bounces) => bounces >= 1)[0];
}

/** One `bounced` event per wall hit, counting on from the bounces the shell already had. */
function bounceEvents(side: Side, hits: readonly BounceHit[], priorBounces: number): MatchEvent[] {
  return hits.map((h, index) => ({
    kind: 'bounced',
    side,
    at: h.at,
    normal: h.normal,
    bounces: priorBounces + index + 1,
    corner: h.kind === 'corner',
  }));
}

interface ScoredHit {
  readonly events: readonly MatchEvent[];
  readonly scores: readonly [number, number];
  readonly vehicles: readonly VehicleState[];
  readonly freeze: Freeze;
  /** The side that just won the match with this hit, if it did. */
  readonly matchWinner: Side | null;
}

/**
 * A scoring hit: the points, the shooter's one-step twitch (the 1977 recoil), both shells cleared,
 * the victim's spin, and the end of the match when this point decides it.
 */
function scoreHit(
  state: MatchState,
  stepped: SteppedShell,
  contact: ContactCandidate,
  vehicles: readonly VehicleState[],
  scores: readonly [number, number],
  otherShell: Shell | null,
): ScoredHit {
  const side = stepped.side;
  const otherSide = (1 - side) as Side;
  const events: MatchEvent[] = bounceEvents(
    side,
    contact.hitsBefore,
    stepped.originalShell.bounces,
  );
  const points = state.channel.remix?.kind === 'ricochet-royale' ? contact.bouncesAtContact : 1;
  const newScores: [number, number] = [scores[0], scores[1]];
  newScores[side] += points;

  const newVehicles = vehicles.map((v) => {
    if (v.side !== side) return v;
    const turned = turnBy(v, -1);
    events.push({ kind: 'turned', vehicle: turned.id, heading: turned.heading });
    return turned;
  });

  if (otherShell) {
    events.push({
      kind: 'shell-gone',
      side: otherSide,
      at: otherShell.position,
      reason: 'cleared',
    });
  }

  const contactAt = state.channel.field.kind === 'sky' ? wrapSky(contact.at) : contact.at;
  events.push({
    kind: 'hit',
    shooter: side,
    victim: otherSide,
    vehicle: contact.target.id,
    at: contactAt,
    direction: contact.direction,
    bounces: contact.bouncesAtContact,
    points,
    path: [...stepped.originalShell.path, ...contact.hitsBefore.map((h) => h.at), contactAt],
  });

  const won = pointEnds(state, side, newScores);
  events.push(...won.events);

  return {
    events,
    scores: newScores,
    vehicles: newVehicles,
    freeze: { seconds: SPIN_SECONDS, victim: otherSide, shove: contact.direction, spinCarry: 0 },
    matchWinner: won.winner,
  };
}

/** What a point won by `scorer` ends: a Last Tank round, and the match when it decides it. */
function pointEnds(
  state: MatchState,
  scorer: Side,
  scores: readonly [number, number],
): { readonly events: readonly MatchEvent[]; readonly winner: Side | null } {
  const events: MatchEvent[] = [];
  const remix = state.channel.remix;
  if (remix?.kind === 'last-tank') {
    events.push({ kind: 'round-over', winner: scorer, round: state.round });
  }
  const decided =
    (state.options.scoring === 'first-to-10' && scores[scorer] >= FIRST_TO) ||
    (remix?.kind === 'last-tank' && scores[scorer] >= remix.roundsToWin);
  if (decided) events.push({ kind: 'match-over', winner: scorer });
  return { events, winner: decided ? scorer : null };
}

/**
 * A ricochet that came back into its own side: that side spins as if hit, both shells clear, and
 * the point goes to the other side. Nobody fired at it, so nobody twitches.
 */
function ownHit(
  state: MatchState,
  stepped: SteppedShell,
  contact: ContactCandidate,
  vehicles: readonly VehicleState[],
  scores: readonly [number, number],
  otherShell: Shell | null,
): ScoredHit {
  const side = stepped.side;
  const otherSide = (1 - side) as Side;
  const events: MatchEvent[] = bounceEvents(
    side,
    contact.hitsBefore,
    stepped.originalShell.bounces,
  );
  const newScores: [number, number] = [scores[0], scores[1]];
  newScores[otherSide] += 1;

  if (otherShell) {
    events.push({
      kind: 'shell-gone',
      side: otherSide,
      at: otherShell.position,
      reason: 'cleared',
    });
  }

  const contactAt = state.channel.field.kind === 'sky' ? wrapSky(contact.at) : contact.at;
  events.push({
    kind: 'own-hit',
    side,
    vehicle: contact.target.id,
    at: contactAt,
    direction: contact.direction,
    bounces: contact.bouncesAtContact,
    path: [...stepped.originalShell.path, ...contact.hitsBefore.map((h) => h.at), contactAt],
  });

  const won = pointEnds(state, otherSide, newScores);
  events.push(...won.events);

  return {
    events,
    scores: newScores,
    vehicles,
    freeze: { seconds: SPIN_SECONDS, victim: side, shove: contact.direction, spinCarry: 0 },
    matchWinner: won.winner,
  };
}

/** A shell that hit nothing: its bounces, then either still flying or gone (a wall, its life out). */
function missedFlight(
  state: MatchState,
  stepped: SteppedShell,
): {
  readonly events: readonly MatchEvent[];
  readonly shell: Shell | null;
} {
  const { stepResult, originalShell, rules, side } = stepped;
  const events = bounceEvents(side, stepResult.hits, originalShell.bounces);
  if (stepResult.shell !== null) return { events, shell: stepResult.shell };
  const reason = rules.walls === 'stop' && stepResult.hits.length > 0 ? 'wall' : 'expired';
  const end = stepResult.travelled[stepResult.travelled.length - 1] ?? originalShell.position;
  const at = state.channel.field.kind === 'sky' ? wrapSky(end) : end;
  return { events: [...events, { kind: 'shell-gone', side, at, reason }], shell: null };
}

/**
 * Shells fly on; the first to meet an enemy scores (or, with Own ricochets, to come back into its
 * own side after a bounce), and a step holds at most one hit.
 */
function advanceShellsAndHits(
  state: MatchState,
  vehicles: readonly VehicleState[],
  shells: readonly [Shell | null, Shell | null],
  reload: readonly [number, number],
  fireHeld: readonly [boolean, boolean],
  dt: number,
  world: MatchWorld,
): { state: MatchState; events: readonly MatchEvent[] } {
  const events: MatchEvent[] = [];
  const copies = state.channel.field.kind === 'sky' ? SKY_COPIES : ARENA_COPIES;
  let scores: readonly [number, number] = state.scores;
  let currentVehicles = vehicles;
  const activeShells: [Shell | null, Shell | null] = [shells[0], shells[1]];
  let freeze: Freeze | null = null;
  let matchWinner: Side | null = null;

  for (const stepped of stepEachShell(state, vehicles, shells, dt, world)) {
    const otherSide = (1 - stepped.side) as Side;
    const enemies = currentVehicles.filter((v) => v.side === otherSide);
    const own = currentVehicles.filter((v) => v.side === stepped.side);
    const enemyContact = scoringContact(stepped, enemies, copies);
    const selfContact = ownContact(state, stepped, own, copies);
    // Whichever the flight meets first: an enemy, or its own side coming back round.
    const backFirst =
      selfContact !== undefined &&
      (enemyContact === undefined || selfContact.distance < enemyContact.distance);
    const contact = backFirst ? selfContact : enemyContact;
    if (contact) {
      const resolve = backFirst ? ownHit : scoreHit;
      const hit = resolve(
        state,
        stepped,
        contact,
        currentVehicles,
        scores,
        activeShells[otherSide],
      );
      events.push(...hit.events);
      scores = hit.scores;
      currentVehicles = hit.vehicles;
      freeze = hit.freeze;
      matchWinner = hit.matchWinner;
      activeShells[0] = null;
      activeShells[1] = null;
      // One hit a step: the other side's shell was cleared with it.
      break;
    }
    const flight = missedFlight(state, stepped);
    events.push(...flight.events);
    activeShells[stepped.side] = flight.shell;
  }

  return {
    state: {
      ...state,
      scores,
      vehicles: currentVehicles,
      shells: activeShells,
      reload,
      fireHeld,
      freeze,
      over: matchWinner !== null || state.over,
      winner: matchWinner ?? state.winner,
    },
    events,
  };
}

export function stepMatch(
  state: MatchState,
  inputs: readonly [StickInput, StickInput],
  dt: number,
  world: MatchWorld,
): MatchStep {
  if (state.over) {
    return { state, events: [] };
  }

  const events: MatchEvent[] = [];
  const nextTime = state.time + dt;

  // 1. Advance radar sweeps (Blackout remix)
  const radarStep = advanceRadar(state.radar, state.channel.remix, dt);
  events.push(...radarStep.events);

  const stateWithRadar = {
    ...state,
    radar: radarStep.radar,
  };

  // 2. Advance match timer and test for clock expiration
  const clockResult = advanceClock(stateWithRadar, world, inputs, nextTime, dt);
  events.push(...clockResult.events);
  if (clockResult.over) {
    return { state: clockResult.state, events };
  }

  const currentState = clockResult.state;

  // 3. Freeze pause when a victim is spinning after a hit
  if (currentState.freeze !== null) {
    const freezeResult = advanceFreeze(currentState, inputs, dt, world);
    events.push(...freezeResult.events);
    return { state: freezeResult.state, events };
  }

  // 4. Move all vehicles along intent
  const vehicleResult = advanceVehicles(currentState, inputs, dt, world);
  events.push(...vehicleResult.events);

  // 5. Firing inputs from leaders
  const firingResult = advanceFiring(currentState, vehicleResult.vehicles, inputs, dt, world);
  events.push(...firingResult.events);

  // 6. Advance live shells and check vehicle hits
  const shellHitResult = advanceShellsAndHits(
    { ...currentState, fuel: vehicleResult.fuel },
    vehicleResult.vehicles,
    firingResult.shells,
    firingResult.reload,
    firingResult.fireHeld,
    dt,
    world,
  );
  events.push(...shellHitResult.events);

  return {
    state: shellHitResult.state,
    events,
  };
}
