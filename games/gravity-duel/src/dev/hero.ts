/**
 * Hero scenes: two moments in each look, for the owner's art review and the
 * README. Played on a stand-in for the engine (orbits.ts) in fixed 20 ms
 * ticks, the cartridge's frame, so a frame comes out the same every time. Dev
 * only.
 *
 * ?look=deep|brass|paper|whirl  ?scene=duel|bank  ?appearance=light|dark
 * ?t=<extra seconds>  ?quality=high|medium|low
 * ?zoom=<factor>&at=<x>,<z> looks closer at one spot, for checking models.
 */
import type { Quality, Stage, TableFraming } from '@woodgrain-88/arena';
import { createRng, type Appearance } from '@woodgrain-88/kit';
import { Vector3 } from 'three';
import { HALF_DEPTH, HALF_WIDTH } from '../look/field.ts';
import type {
  CentreKind,
  LookId,
  MissilePose,
  SceneFrame,
  ShipPose,
  SpaceView,
} from '../look/look.ts';
import { createLookStage, lookById } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';
import { beltRocks, binaryStars } from '../engine/remix.ts';
import { headingOf, MISSILE_SPEED, stepBody, type Body } from './orbits.ts';

const params = new URLSearchParams(location.search);
const LOOK_NAMES: readonly LookId[] = ['deep', 'brass', 'paper', 'whirl'];
const lookId: LookId = LOOK_NAMES.find((id) => id === params.get('look')) ?? 'deep';
const sceneName = params.get('scene') === 'bank' ? 'bank' : 'duel';
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const extra = Number(params.get('t') ?? '0');
const quality = (params.get('quality') ?? 'high') as Quality;
const CENTRES: readonly CentreKind[] = ['star', 'starbase', 'beacon'];
/** ?centre= puts the starbase or the beacon in the middle instead of the star (or none). */
const centre: CentreKind =
  params.get('centre') === 'none'
    ? null
    : (CENTRES.find((kind) => kind === params.get('centre')) ?? 'star');
/** ?pods=own|shared floats docking pods over the scene, to judge their art. */
/** ?cloak=0..1 shows both ships part-way into their cloaks, to judge the shimmer. */
const cloakTest = Math.min(1, Math.max(0, Number(params.get('cloak') ?? '0')));
/** ?remix=binary-stars|comet|asteroid-belt shows that Remix channel's bodies over the scene. */
const REMIXES = ['binary-stars', 'comet', 'asteroid-belt'] as const;
const remixMode = REMIXES.find((id) => id === params.get('remix'));
const podMode =
  params.get('pods') === 'own' || params.get('pods') === 'shared' ? params.get('pods') : 'none';
const POD_SPOTS = [
  { x: -6.5, z: 3.2 },
  { x: 7.5, z: -3.6 },
] as const;

const TICK = 1 / 50;
const WALLS = { halfWidth: HALF_WIDTH - 0.6, halfDepth: HALF_DEPTH - 0.6 };
/** A missile flies for 128 frames. */
const MISSILE_LIFE = 128 * TICK;

interface Pilot {
  readonly body: Body;
  heading: number;
  /** Seconds at which the engine burns, as [from, to] pairs. */
  readonly burns: readonly (readonly [number, number])[];
  /** Turns toward this heading at the cartridge's rate while set. */
  aim: number | null;
}

interface Shot {
  readonly body: Body;
  age: number;
}

/** The cartridge turns a ship a sixteenth of a circle every 8 frames. */
const TURN_RATE = (Math.PI * 2) / 16 / (8 * TICK);

function turnToward(pilot: Pilot, dt: number): void {
  if (pilot.aim === null) return;
  let delta = pilot.aim - pilot.heading;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  const step = Math.min(Math.abs(delta), TURN_RATE * dt);
  pilot.heading += Math.sign(delta) * step;
}

function burning(pilot: Pilot, time: number): boolean {
  return pilot.burns.some(([from, to]) => time >= from && time < to);
}

function fire(from: Pilot): Shot {
  const { body, heading } = from;
  return {
    body: {
      x: body.x + Math.cos(heading) * 1.2,
      z: body.z - Math.sin(heading) * 1.2,
      vx: body.vx + Math.cos(heading) * MISSILE_SPEED,
      vz: body.vz - Math.sin(heading) * MISSILE_SPEED,
    },
    age: 0,
  };
}

function shipPose(pilot: Pilot, time: number): ShipPose {
  return {
    x: pilot.body.x,
    z: pilot.body.z,
    heading: pilot.heading,
    thrusting: burning(pilot, time),
    cloak: cloakTest,
  };
}

function missilePose(shot: Shot | null): MissilePose | null {
  if (!shot) return null;
  return { x: shot.body.x, z: shot.body.z, heading: headingOf(shot.body.vx, shot.body.vz) };
}

/** A scene runs tick by tick and says when the frame is taken. */
interface Scene {
  tick(view: SpaceView, time: number): void;
  readonly endsAt: number;
}

/** A missile's flight from a launch: where it is after each tick, and the first tick it bounced (or -1). */
interface Flight {
  readonly heading: number;
  readonly path: readonly Body[];
  readonly bouncedAt: number;
}

function flight(from: Body, heading: number): Flight {
  const shot = fire({ body: { ...from }, heading, burns: [], aim: null });
  const path: Body[] = [];
  let bouncedAt = -1;
  for (let tick = 0; tick * TICK < MISSILE_LIFE; tick++) {
    const bounced = stepBody(shot.body, TICK, { walls: WALLS });
    if (bounced && bouncedAt < 0) bouncedAt = tick;
    path.push({ ...shot.body });
  }
  return { heading, path, bouncedAt };
}

/** How far a flight has turned by a tick, and how close it came to the star on the way. */
function bend(path: readonly Body[], upTo: number): { turned: number; closest: number } {
  let turned = 0;
  let closest = Infinity;
  for (let index = 1; index <= Math.min(upTo, path.length - 1); index++) {
    const before = path[index - 1];
    const now = path[index];
    if (!before || !now) break;
    let delta = headingOf(now.vx, now.vz) - headingOf(before.vx, before.vz);
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    turned += delta;
    closest = Math.min(closest, Math.hypot(now.x, now.z));
  }
  return { turned: Math.abs(turned), closest };
}

/** Of every launch heading in a range, the flight a score likes best (lowest; null rules it out). */
function bestFlight(
  from: Body,
  [low, high]: readonly [number, number],
  score: (candidate: Flight) => number | null,
): Flight {
  let best: { candidate: Flight; value: number } | null = null;
  for (let degrees = low; degrees <= high; degrees += 0.25) {
    const candidate = flight(from, (degrees * Math.PI) / 180);
    const value = score(candidate);
    if (value !== null && (!best || value < best.value)) best = { candidate, value };
  }
  if (!best) throw new Error('no flight fits this scene');
  return best.candidate;
}

const DEGREES = Math.PI / 180;
/** Clear of the star's glow: the star is 1.05 across its radius, its corona a little more. */
const CLEAR_OF_STAR = 2;

/**
 * Mid-duel around the star by day: blue's missile is halfway round the star toward orange,
 * orange swings in with its engine lit, and orange's own earlier shot is still curling away.
 */
function duelScene(): Scene {
  const orange: Pilot = {
    body: { x: -10.5, z: -4.8, vx: 1.8, vz: 0.6 },
    heading: 0,
    burns: [[1.2, 3]],
    aim: null,
  };
  const blue: Pilot = {
    body: { x: 10.5, z: 4.8, vx: -1.4, vz: -0.6 },
    heading: Math.PI,
    burns: [[0, 0.7]],
    aim: null,
  };
  const orangeFires = 0.1;
  const blueFires = 1.1;
  const takenAt = blueFires + 1.0;
  const ticksTo = (seconds: number) => Math.round(seconds / TICK);

  const orangeShot = bestFlight(orange.body, [-60, 60], (candidate) => {
    const upTo = ticksTo(takenAt - orangeFires);
    if (candidate.bouncedAt >= 0 && candidate.bouncedAt < upTo) return null;
    const { turned, closest } = bend(candidate.path, upTo);
    if (closest < CLEAR_OF_STAR) return null;
    return Math.abs(turned - 150 * DEGREES);
  });
  orange.heading = orangeShot.heading;
  const blueAtFire = {
    ...blue.body,
    x: blue.body.x + blue.body.vx * blueFires,
    z: blue.body.z + blue.body.vz * blueFires,
  };
  const blueShot = bestFlight(blueAtFire, [120, 240], (candidate) => {
    const upTo = ticksTo(takenAt - blueFires);
    if (candidate.bouncedAt >= 0 && candidate.bouncedAt < upTo) return null;
    const { turned, closest } = bend(candidate.path, upTo);
    if (closest < CLEAR_OF_STAR) return null;
    return Math.abs(turned - 95 * DEGREES);
  });
  blue.heading = blueShot.heading;

  const shots: (Shot | null)[] = [null, null];
  return {
    endsAt: takenAt,
    tick(view, time) {
      if (Math.abs(time - orangeFires) < TICK / 2) shots[0] = fire(orange);
      if (Math.abs(time - blueFires) < TICK / 2) shots[1] = fire(blue);
      orange.aim = time > 1.0 ? orange.heading - 0.9 : null;
      for (const pilot of [orange, blue]) {
        turnToward(pilot, TICK);
        pilot.body.x += pilot.body.vx * TICK;
        pilot.body.z += pilot.body.vz * TICK;
      }
      shots.forEach((shot, seat) => {
        if (!shot) return;
        stepBody(shot.body, TICK, { walls: WALLS });
        shot.age += TICK;
        if (shot.age > MISSILE_LIFE) shots[seat] = null;
      });
      view.show({
        ships: [shipPose(orange, time), shipPose(blue, time)],
        missiles: shots.map(missilePose),
        pods: [],
      } satisfies SceneFrame);
    },
  };
}

/**
 * The first tick at which a flight has swung at least 130° round the star, clear of its glow and
 * without touching a wall, and come out into open space where a ship could be waiting; -1 if never.
 */
function landingTick(candidate: Flight): number {
  for (let index = 10; index < candidate.path.length; index++) {
    if (candidate.bouncedAt >= 0 && candidate.bouncedAt <= index) return -1;
    const now = candidate.path[index];
    if (!now) return -1;
    const { turned, closest } = bend(candidate.path, index);
    if (closest < CLEAR_OF_STAR) return -1;
    const inOpenSpace =
      Math.hypot(now.x, now.z) > 5.5 && Math.abs(now.x) < 12 && Math.abs(now.z) < 6.5;
    if (turned > 130 * DEGREES && inOpenSpace) return index;
  }
  return -1;
}

/** The bank shot by night: orange's missile swings well round the star and strikes blue. */
function bankScene(): Scene {
  const orange: Pilot = {
    body: { x: -11, z: 4.5, vx: 1.2, vz: -0.6 },
    heading: 0,
    burns: [],
    aim: null,
  };
  const bank = bestFlight(orange.body, [-60, 70], (candidate) => {
    const index = landingTick(candidate);
    if (index < 0) return null;
    return Math.abs(bend(candidate.path, index).turned - 150 * DEGREES) + index * 0.003;
  });
  const hitIndex = landingTick(bank);
  orange.heading = bank.heading;
  const fireAt = 0.1;
  const hitAt = fireAt + (hitIndex + 1) * TICK;
  const strike = bank.path[hitIndex] ?? { x: 0, z: 0, vx: 0, vz: 0 };
  // Blue drifts so that it is exactly where the missile comes out at the moment it does.
  const drift = { vx: -1.2, vz: 0.8 };
  const blue: Pilot = {
    body: { x: strike.x - drift.vx * hitAt, z: strike.z - drift.vz * hitAt, ...drift },
    heading: headingOf(-strike.vx, -strike.vz) + 0.7,
    burns: [[0, 0.6]],
    aim: null,
  };
  let shot: Shot | null = null;
  let struck = false;
  return {
    endsAt: hitAt + 0.09,
    tick(view, time) {
      if (Math.abs(time - fireAt) < TICK / 2) shot = fire(orange);
      orange.body.x += orange.body.vx * TICK;
      orange.body.z += orange.body.vz * TICK;
      blue.body.x += blue.body.vx * TICK;
      blue.body.z += blue.body.vz * TICK;
      if (shot) {
        stepBody(shot.body, TICK, { walls: WALLS });
        shot.age += TICK;
      }
      if (!struck && time >= hitAt) {
        struck = true;
        shot = null;
        view.moment({ kind: 'hit', seat: 1, at: new Vector3(blue.body.x, 0, blue.body.z) });
      }
      view.show({
        ships: [shipPose(orange, time), shipPose(blue, time)],
        missiles: [missilePose(shot), null],
        pods: [],
      });
    },
  };
}

/** The Remix bodies where the engine puts them at this moment; the comet crosses on a fixed line. */
function remixAt(time: number): SceneFrame['remix'] {
  const tick = Math.round(time * 50);
  const table = (body: { x: number; y: number; radius: number }) => ({
    x: body.x / 256 / 5 - HALF_WIDTH,
    z: body.y / 256 / 5 - HALF_DEPTH,
    radius: body.radius / 5,
  });
  if (remixMode === 'binary-stars') return { stars: binaryStars(tick + 300).map(table) };
  if (remixMode === 'asteroid-belt') return { rocks: beltRocks(tick).map(table) };
  if (remixMode === 'comet')
    return { comet: { x: -12 + time * 3.2, z: -4 + time * 0.6, heading: -0.18 } };
  return undefined;
}

function podsAt(time: number): SceneFrame['pods'] {
  if (podMode === 'none') return [];
  return POD_SPOTS.map((spot, index) =>
    podMode === 'shared' && index === 1
      ? null
      : { x: spot.x + Math.sin(time * 0.6 + index) * 0.6, z: spot.z, tumble: time * 1.4 + index },
  );
}

/** ?zoom= and ?at= look closer at one spot: the framing shrinks round it. */
function lookCloser(stage: Stage, view: SpaceView, framing: TableFraming): void {
  const zoom = Number(params.get('zoom') ?? '1');
  const at = (params.get('at') ?? '').split(',').map(Number);
  if (zoom === 1 || at.length !== 2) return;
  const [x = 0, z = 0] = at;
  view.root.position.set(-x, 0, -z);
  stage.setFraming({
    ...framing,
    width: framing.width / zoom,
    depth: framing.depth / zoom,
    height: framing.height / zoom,
  });
}

function main(): void {
  const look = lookById(lookId);
  const host = document.getElementById('stage');
  if (!host) throw new Error('hero page needs #stage');
  const stage = createLookStage({ host, look, appearance, quality, preserveDrawingBuffer: true });
  const view = look.createView({
    stage,
    appearance,
    quality,
    rng: createRng(`hero/${lookId}/${sceneName}`),
    seats: seatColours(),
    centre,
    edges: 'bounce',
    pods: podMode === 'own' ? 'own' : podMode === 'shared' ? 'shared' : 'none',
    ...(remixMode ? { remix: remixMode } : {}),
    reducedEffects: false,
  });
  stage.scene.add(view.root);
  lookCloser(stage, view, look.framing);

  const scene = sceneName === 'bank' ? bankScene() : duelScene();
  let time = 0;
  const withPods: SpaceView = {
    ...view,
    show(frame) {
      const remix = remixAt(time);
      view.show({ ...frame, pods: podsAt(time), ...(remix ? { remix } : {}) });
    },
  };
  while (time < scene.endsAt + extra) {
    scene.tick(withPods, time);
    view.update(TICK, time);
    stage.lights.update(TICK);
    time += TICK;
  }

  let warm = 0;
  const warmUp = () => {
    stage.render();
    warm++;
    if (warm < 4) requestAnimationFrame(warmUp);
    else document.body.dataset.ready = 'true';
  };
  requestAnimationFrame(warmUp);
}

try {
  main();
} catch (error: unknown) {
  document.body.dataset.error = String(error);
  console.error(error);
}
