/**
 * Hero scenes: live renders of chosen moments, for the owner's art review and
 * the README. Each scene is built from the real boards, models and effects
 * and then simulated in fixed steps up to its moment, so a frame can be taken
 * again at any time and come out the same. Dev only; never part of a build.
 *
 * ?scene=duel|kill|sky  ?appearance=light|dark  ?t=<extra seconds>  ?quality=high|medium|low
 * ?craft=jet flies jets instead of biplanes in the sky scene.
 * ?measure=1 keeps rendering for 300 frames afterwards and reports frame times in data-stats.
 */
import {
  createCameraShake,
  createEffects,
  createRibbon,
  createStage,
  type Effects,
  type GroundPaint,
  type Quality,
  type Ribbon,
} from '@woodgrain-88/arena';
import { createRng, type Appearance } from '@woodgrain-88/kit';
import { CapsuleGeometry, Color, Fog, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { compileArena, wallPolygons } from '../arenas/format.ts';
import { OLD_QUARTER } from '../arenas/layouts.ts';
import { CLOUD_BANKS } from '../arenas/skies.ts';
import { buildWallEdges, traceShot } from '../engine/walls.ts';
import { add, headingAngle, headingVector, scale, type Vec2 } from '../engine/vec.ts';
import { createBoard, toTable } from '../render/board.ts';
import { createBiplaneModel, type AircraftModel } from '../render/models/biplane.ts';
import { createJetModel } from '../render/models/jet.ts';
import { createTankModel, type TankModel } from '../render/models/tank.ts';
import { createSkyScene, FLYING_HEIGHT } from '../render/sky.ts';
import { teamColours } from '../render/teams.ts';

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? 'duel';
const appearance: Appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const extra = Number(params.get('t') ?? '0');
const quality = (params.get('quality') ?? 'high') as Quality;
const night = appearance === 'dark';

const STEP = 1 / 60;
const SHELL_SPEED = 40;
const SHELL_HEIGHT = 1.0;
const MUZZLE_REACH = 2.15;
const GUN_SPEED = 80;

const host = document.getElementById('stage');
if (!host) throw new Error('hero page needs #stage');

const inTheAir = sceneName === 'sky';
const stage = createStage({
  host,
  appearance,
  quality,
  framing: inTheAir
    ? {
        width: 64,
        depth: 40,
        tilt: 55,
        height: 3,
        margin: 0,
        topInset: 0.085,
        elevation: FLYING_HEIGHT,
      }
    : { width: 65.2, depth: 42.4, tilt: 55, height: 2, margin: 0.004, topInset: 0.085 },
  preserveDrawingBuffer: true,
});
stage.scene.background = new Color(night ? '#07080c' : '#3b2a1e');
const rng = createRng(`hero/${sceneName}`);
const shake = createCameraShake({ maxOffset: 0.6, maxRoll: 0.012, recovery: 1.6, enabled: true });
const updates: ((dt: number) => void)[] = [];

function effectsOn(groundPaint: GroundPaint): Effects {
  const effects = createEffects({
    parent: stage.scene,
    lights: stage.lights,
    rng: rng.fork('effects'),
    intensity: 'full',
    groundPaint,
    shake,
  });
  updates.push((dt) => effects.update(dt, stage.camera));
  return effects;
}

function simulate(seconds: number, each?: (time: number) => void): void {
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps; step++) {
    each?.(step * STEP);
    for (const update of updates) update(STEP);
    stage.lights.update(STEP);
    stage.setShake(shake.update(STEP));
  }
}

interface Placed {
  readonly model: TankModel;
  position: Vec2;
  heading: number;
}

function bankShotScene(kill: boolean): GroundPaint {
  const arena = compileArena(OLD_QUARTER);
  const edges = buildWallEdges(wallPolygons(arena));
  const board = createBoard(arena, rng.fork('board'));
  board.setNight(night);
  stage.scene.add(board.root);
  updates.push((dt) => board.update(dt));
  const effects = effectsOn(board.groundPaint);

  const placeTank = (team: 0 | 1, position: Vec2, heading: number): Placed => {
    const model = createTankModel(teamColours().tanks[team]);
    stage.scene.add(model.root);
    model.setHeadlights(night ? 1 : 0);
    updates.push((dt) => model.update(dt));
    const placed = { model, position, heading };
    pose(placed);
    return placed;
  };
  const pose = (tank: Placed) => {
    tank.model.root.position.copy(toTable(tank.position.x, tank.position.y));
    tank.model.root.rotation.y = -headingAngle(tank.heading);
  };
  /** Tread marks along the way a tank came, ending under it. */
  const driveIn = (tank: Placed, from: Vec2, bend: number) => {
    const steps = 60;
    const along = (t: number): Vec2 => ({
      x: from.x + (tank.position.x - from.x) * t + Math.sin(t * Math.PI) * bend,
      y: from.y + (tank.position.y - from.y) * t - Math.sin(t * Math.PI) * bend * 0.6,
    });
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const here = along(t);
      const next = along(Math.min(1, t + 1 / steps));
      const angle = Math.atan2(next.y - here.y, next.x - here.x);
      board.groundPaint.stamp({
        kind: 'track',
        x: here.x - 32,
        z: here.y - 20,
        width: 2.2,
        length: 0.55,
        angle,
        strength: 0.7 * t + 0.3,
      });
    }
    tank.model.roll(3.1, 3.4);
  };

  const shooter = placeTank(0, { x: 6, y: 20 }, 1);
  const target = placeTank(1, { x: 30, y: 35 }, 10);
  driveIn(shooter, { x: 4, y: 29 }, 2.5);
  driveIn(target, { x: 40, y: 36.2 }, -0.8);

  const direction = headingVector(shooter.heading);
  const muzzle = add(shooter.position, scale(direction, MUZZLE_REACH));
  const flight = traceShot(muzzle, direction, 60, edges, { bounce: true });
  const bounce = flight.hits[0];
  if (!bounce) throw new Error('the hero shot needs a bounce');
  // The shell meets the target's hull a little before its centre.
  const toTarget = Math.hypot(target.position.x - bounce.at.x, target.position.y - bounce.at.y);
  const impactDistance = bounce.distance + toTarget - 0.9;
  const capture = kill
    ? impactDistance / SHELL_SPEED + 0.3 + extra
    : bounce.distance / SHELL_SPEED + 0.07 + extra;

  shooter.model.recoil();
  effects.muzzleFlash(
    toTable(muzzle.x, muzzle.y, SHELL_HEIGHT),
    new Vector3(direction.x, 0, direction.y),
  );
  effects.dust(toTable(shooter.position.x - 1.2, shooter.position.y), 1);
  effects.dust(toTable(target.position.x - 1.2, target.position.y), 1);

  let bounced = false;
  let exploded = false;
  const shell = shellMesh();
  stage.scene.add(shell);
  simulate(capture, (time) => {
    const travelled = time * SHELL_SPEED;
    if (!bounced && travelled >= bounce.distance) {
      bounced = true;
      const at = toTable(bounce.at.x, bounce.at.y, SHELL_HEIGHT);
      effects.ricochet(at, new Vector3(bounce.normal.x, 0.2, bounce.normal.y));
      // The bounce flares and lingers for a moment, so the turn in the path reads.
      effects.glow.emit({
        x: at.x,
        y: at.y,
        z: at.z,
        life: 0.45,
        size: 1.6,
        sizeEnd: 0.6,
        colour: new Color(6, 4, 2),
        alpha: 1,
        alphaEnd: 0,
      });
    }
    if (kill && !exploded && travelled >= impactDistance) {
      exploded = true;
      const push = new Vector3(
        target.position.x - bounce.at.x,
        0,
        target.position.y - bounce.at.y,
      ).normalize();
      effects.explosion(toTable(target.position.x, target.position.y, 0.6), {
        push,
        paint: new Color(teamColours().tanks[1].paint),
      });
      effects.burn(() => toTable(target.position.x, target.position.y, 0.5), 2.5);
      // 1977: the shooter twitches one step on a scoring hit.
      shooter.heading -= 1;
      pose(shooter);
      shell.visible = false;
    }
    if (exploded) {
      // The victim spins one step per frame and is shoved back along the shot for the first moment.
      target.heading += 50 * STEP;
      const since = time - impactDistance / SHELL_SPEED;
      if (since < 0.08) {
        const shove = { x: target.position.x - bounce.at.x, y: target.position.y - bounce.at.y };
        target.position = add(target.position, scale(shove, (0.9 * STEP) / toTarget / 0.08));
      }
      pose(target);
      target.model.jolt(0.6);
    }
  });

  const travelled = Math.min(capture * SHELL_SPEED, kill ? impactDistance : Infinity);
  const shellTrace = traceShot(muzzle, direction, travelled, edges, { bounce: true });
  shell.position.copy(toTable(shellTrace.end.x, shellTrace.end.y, SHELL_HEIGHT));
  shell.rotation.set(0, -Math.atan2(shellTrace.direction.y, shellTrace.direction.x), Math.PI / 2);
  const ribbon = pathRibbon(shellTrace.points, travelled, SHELL_SPEED);
  if (shell.visible) {
    effects.glow.emit({
      x: shell.position.x,
      y: shell.position.y,
      z: shell.position.z,
      life: 10,
      size: 0.9,
      colour: new Color(7, 4.5, 2),
      alpha: 1,
      alphaEnd: 1,
      fadeIn: 0,
    });
    effects.glow.update(0, stage.camera);
  }
  if (kill) ribbon.opacity = 0.75;
  ribbon.update(0, stage.camera);
  return board.groundPaint;
}

function skyScene(): GroundPaint {
  // A high sun, so each plane's shadow falls close beneath it on the fields.
  stage.lights.aimSun(32, 63);
  // The fields lie far below the planes: a touch of haze puts air between them.
  stage.scene.fog = new Fog(night ? '#0b1222' : '#cdd9e6', 118, 182);
  const sky = createSkyScene(CLOUD_BANKS, stage.lights.palette, night, rng.fork('sky'));
  stage.scene.add(sky.root);
  updates.push((dt) => sky.update(dt, stage.camera));
  const effects = effectsOn(sky.groundPaint);

  const place = (team: 0 | 1, position: Vec2, heading: number, bank: number): AircraftModel => {
    const model =
      params.get('craft') === 'jet'
        ? createJetModel(teamColours().aircraft[team])
        : createBiplaneModel(teamColours().aircraft[team]);
    model.root.position.copy(toTable(position.x, position.y, FLYING_HEIGHT));
    model.root.rotation.y = -headingAngle(heading);
    model.setAttitude(bank, 0.04);
    model.setNavigationLights(night ? 1 : 0);
    updates.push((dt) => model.update(dt, 0.7));
    stage.scene.add(model.root);
    return model;
  };

  const hunter = place(0, { x: 21, y: 24 }, 14.4, 0.55);
  place(1, { x: 37.5, y: 12.6 }, 1.2, -0.35);
  simulate(0.4 + extra);

  // A burst from the hunter's guns: short tracer streaks along the line of fire.
  const gun = hunter.muzzle(new Vector3());
  const aim = headingVector(14.4);
  for (let round = 0; round < 6; round++) {
    const reach = 1.5 + round * 2.3;
    effects.glow.emit({
      x: gun.x + aim.x * reach,
      y: gun.y - round * 0.05,
      z: gun.z + aim.y * reach,
      vx: aim.x * GUN_SPEED,
      vz: aim.y * GUN_SPEED,
      life: 10,
      size: 0.24,
      stretch: 0.02,
      colour: new Color(6, 4.2, 1.6),
      alpha: 1,
      alphaEnd: 1,
      fadeIn: 0,
    });
  }
  effects.muzzleFlash(gun, new Vector3(aim.x, 0, aim.y));
  effects.glow.update(0, stage.camera);
  return sky.groundPaint;
}

function shellMesh(): Mesh {
  const mesh = new Mesh(
    new CapsuleGeometry(0.09, 0.3, 4, 8),
    new MeshStandardMaterial({
      color: '#2a2014',
      emissive: new Color(6, 3.4, 1.2),
      emissiveIntensity: 1,
    }),
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

/** The lingering glow of a shot's path, dimmer towards the muzzle it left. */
function pathRibbon(points: readonly Vec2[], travelled: number, speed: number): Ribbon {
  const ribbon = createRibbon({
    look: 'glow',
    width: 0.2,
    widthEnd: 0.1,
    colour: new Color(5.5, 2.6, 0.7),
    colourEnd: new Color(1.6, 0.35, 0.05),
    fade: 1.9,
    maxPoints: 256,
  });
  const along: Vector3[] = [];
  const ages: number[] = [];
  let walked = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const pieces = Math.max(1, Math.ceil(length / 0.5));
    for (let piece = 0; piece < pieces; piece++) {
      const t = piece / pieces;
      along.push(toTable(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, SHELL_HEIGHT));
      ages.push((travelled - (walked + length * t)) / speed);
    }
    walked += length;
  }
  const last = points.at(-1);
  if (last) {
    along.push(toTable(last.x, last.y, SHELL_HEIGHT));
    ages.push(0);
  }
  ribbon.setPath(along, ages);
  stage.scene.add(ribbon.mesh);
  return ribbon;
}

const groundPaint = inTheAir ? skyScene() : bankShotScene(sceneName === 'kill');

// Render a few frames so shadows, textures and shaders are all in place before the capture.
let warm = 0;
function warmUp(): void {
  groundPaint.flush(stage.renderer);
  stage.render();
  warm++;
  if (warm < 4) requestAnimationFrame(warmUp);
  else if (params.get('measure') === '1') requestAnimationFrame(measure);
  else document.body.dataset.ready = 'true';
}
requestAnimationFrame(warmUp);

const cpu: number[] = [];
const intervals: number[] = [];
let last = 0;
function measure(now: number): void {
  if (last > 0) intervals.push(now - last);
  last = now;
  const started = performance.now();
  for (const update of updates) update(STEP);
  stage.lights.update(STEP);
  groundPaint.flush(stage.renderer);
  stage.render();
  cpu.push(performance.now() - started);
  if (cpu.length < 300) {
    requestAnimationFrame(measure);
    return;
  }
  const middle = (list: number[]) =>
    [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0;
  const p95 = (list: number[]) =>
    [...list].sort((a, b) => a - b)[Math.floor(list.length * 0.95)] ?? 0;
  const info = stage.renderer.info.render;
  document.body.dataset.stats = JSON.stringify({
    frameMedian: middle(intervals),
    frameP95: p95(intervals),
    cpuMedian: middle(cpu),
    cpuP95: p95(cpu),
    drawCalls: info.calls,
    triangles: info.triangles,
  });
  document.body.dataset.ready = 'true';
}
