/**
 * The match on the table: keeps the 3D diorama in step with the engine. The
 * engine advances in fixed steps; the view draws between them, easing
 * positions and the sixteen-step headings so turning keeps the 1977 rhythm
 * but never looks jumpy. Engine events become what you see: muzzle flashes,
 * ricochet sparks, the glowing path of a bank shot, explosions and scorch.
 *
 * Nothing about a hidden vehicle reaches the screen: an unseen tank draws no
 * model, no shadow, no dust and no tread marks, so the picture never gives
 * away what the rules hide.
 */
import {
  createEffects,
  createRibbon,
  type CameraShake,
  type Effects,
  type GroundPaint,
  type Ribbon,
  type Stage,
} from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  CapsuleGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Material,
} from 'three';
import type { Arena, SkyDef } from '../arenas/format.ts';
import type { ChannelRules, MatchEvent, MatchState, Side, VehicleState } from '../engine/types.ts';
import { headingAngle, type Vec2 } from '../engine/vec.ts';
import { createBoard, toTable, type Board } from './board.ts';
import { createBiplaneModel, type AircraftModel } from './models/biplane.ts';
import { createBomberModel } from './models/bomber.ts';
import { createJetModel } from './models/jet.ts';
import { createTankModel, type TankModel } from './models/tank.ts';
import { createSkyScene, FLYING_HEIGHT, type SkyScene } from './sky.ts';
import { teamColours, type TeamPalette } from './teams.ts';

export interface MatchViewOptions {
  readonly stage: Stage;
  readonly channel: ChannelRules;
  readonly field: Arena | SkyDef;
  readonly night: boolean;
  readonly rng: Rng;
  /** Whether a vehicle may be drawn (the rules' visibility); the view never draws a hidden one. */
  readonly revealed: (state: MatchState, vehicle: VehicleState) => boolean;
  readonly reducedEffects: boolean;
  /** Explosions knock the camera through this, when the player allows it. */
  readonly shake?: CameraShake;
  readonly palette?: TeamPalette;
}

export interface MatchView {
  /** Turns a step's events into effects. Call once per engine step, with the state after it. */
  applyEvents(state: MatchState, events: readonly MatchEvent[]): void;
  /** Draws a frame between two engine states; `alpha` is how far real time is past `previous`. */
  draw(previous: MatchState, current: MatchState, alpha: number, frameSeconds: number): void;
  /** The practice aim line, from the muzzle through its bounces; null hides it. */
  setAimLine(path: readonly Vec2[] | null): void;
  readonly groundPaint: GroundPaint;
  dispose(): void;
}

const SHELL_HEIGHT = 1;
/** A vehicle that moved further than this between steps wrapped round the sky: do not ease across. */
const WRAP_JUMP = 20;
/** How quickly the drawn heading catches up with a new step, per second. */
const HEADING_EASE = 26;
const TRACK_SPACING = 0.32;

interface DrawnVehicle {
  readonly id: number;
  readonly root: Group;
  readonly tank: TankModel | null;
  readonly aircraft: AircraftModel | null;
  angle: number;
  bank: number;
  lastTrack: Vec2 | null;
  /** Its materials and meshes, gathered the first time it is drawn as a heat shimmer. */
  ghost: { readonly materials: readonly Material[]; readonly meshes: readonly Mesh[] } | null;
}

interface DrawnShell {
  readonly slug: Mesh;
  readonly tracer: Ribbon;
  readonly smoke: Ribbon | null;
  /** The last point laid on its trails. */
  last: Vector3 | null;
}

export function createMatchView(options: MatchViewOptions): MatchView {
  const { stage, channel, night } = options;
  const colours = teamColours(options.palette);
  const inTheAir = channel.field.kind === 'sky';
  const board: Board | null = inTheAir
    ? null
    : createBoard(options.field as Arena, options.rng.fork('board'));
  const sky: SkyScene | null = inTheAir
    ? createSkyScene(options.field as SkyDef, stage.lights.palette, night, options.rng.fork('sky'))
    : null;
  const groundPaint = board?.groundPaint ?? sky?.groundPaint;
  if (!groundPaint) throw new Error('a match view needs a board or a sky');
  board?.setNight(night);
  if (board) stage.scene.add(board.root);
  if (sky) stage.scene.add(sky.root);

  const effects: Effects = createEffects({
    parent: stage.scene,
    lights: stage.lights,
    rng: options.rng.fork('effects'),
    intensity: options.reducedEffects ? 'reduced' : 'full',
    groundPaint,
    ...(options.shake ? { shake: options.shake } : {}),
  });

  const vehicles = new Map<number, DrawnVehicle>();
  /** Seconds of drawing, for the shimmer's flicker. */
  let clock = 0;
  const shells: (DrawnShell | null)[] = [null, null];
  const lingering: { ribbon: Ribbon; left: number }[] = [];
  const height = inTheAir ? FLYING_HEIGHT : 0;

  function drawnVehicle(vehicle: VehicleState): DrawnVehicle {
    const existing = vehicles.get(vehicle.id);
    if (existing) return existing;
    let tank: TankModel | null = null;
    let aircraft: AircraftModel | null = null;
    if (vehicle.vehicle === 'tank') {
      tank = createTankModel(colours.tanks[vehicle.side]);
      tank.setHeadlights(night ? 1 : 0);
    } else {
      const look = colours.aircraft[vehicle.side];
      aircraft =
        vehicle.vehicle === 'jet'
          ? createJetModel(look)
          : vehicle.vehicle === 'bomber'
            ? createBomberModel(look)
            : createBiplaneModel(look);
      aircraft.setNavigationLights(night ? 1 : 0);
    }
    const root = tank?.root ?? aircraft?.root;
    if (!root) throw new Error('unknown vehicle');
    stage.scene.add(root);
    const drawn: DrawnVehicle = {
      id: vehicle.id,
      root,
      tank,
      aircraft,
      angle: -headingAngle(vehicle.heading),
      bank: 0,
      lastTrack: null,
      ghost: null,
    };
    vehicles.set(vehicle.id, drawn);
    return drawn;
  }

  // One shell look shared by every shot, so firing never creates a material mid-match.
  const slugGeometry = new CapsuleGeometry(0.09, 0.3, 4, 8);
  const slugMaterial = new MeshStandardMaterial({
    color: '#2a2014',
    emissive: new Color(6, 3.4, 1.2),
    emissiveIntensity: 1,
  });

  function shellFor(side: 0 | 1): DrawnShell {
    const current = shells[side];
    if (current) return current;
    const slug = new Mesh(slugGeometry, slugMaterial);
    stage.scene.add(slug);
    const tracer = createRibbon({
      look: 'glow',
      width: 0.22,
      widthEnd: 0.05,
      colour: new Color(6, 3, 0.9),
      colourEnd: new Color(1.4, 0.3, 0.05),
      fade: 0.22,
      maxPoints: 48,
    });
    stage.scene.add(tracer.mesh);
    const smoke =
      channel.shot === 'guided'
        ? createRibbon({
            look: 'smoke',
            width: 0.3,
            widthEnd: 1.2,
            colour: new Color(0.55, 0.54, 0.52),
            colourEnd: new Color(0.7, 0.69, 0.67),
            alpha: 0.5,
            fade: 1.4,
            maxPoints: 160,
          })
        : null;
    if (smoke) stage.scene.add(smoke.mesh);
    const drawn: DrawnShell = { slug, tracer, smoke, last: null };
    shells[side] = drawn;
    return drawn;
  }

  function retireShell(side: 0 | 1): void {
    const drawn = shells[side];
    if (!drawn) return;
    drawn.slug.removeFromParent();
    lingering.push({ ribbon: drawn.tracer, left: 0.3 });
    if (drawn.smoke) lingering.push({ ribbon: drawn.smoke, left: 1.5 });
    shells[side] = null;
  }

  function at(point: Vec2, lift = SHELL_HEIGHT): Vector3 {
    return toTable(point.x, point.y, height + lift);
  }

  function applyEvent(state: MatchState, event: MatchEvent): void {
    switch (event.kind) {
      case 'fired': {
        const direction = new Vector3(event.direction.x, 0, event.direction.y);
        effects.muzzleFlash(at(event.at), direction);
        const shooter = state.vehicles.find(
          (vehicle) => vehicle.side === event.side && vehicle.slot === 0,
        );
        if (shooter) vehicles.get(shooter.id)?.tank?.recoil();
        break;
      }
      case 'bounced':
        effects.ricochet(at(event.at), new Vector3(event.normal.x, 0.25, event.normal.y));
        break;
      case 'shell-gone':
        if (event.reason === 'wall') effects.ricochet(at(event.at), new Vector3(0, 1, 0));
        retireShell(event.side);
        break;
      case 'hit':
        blowUp(state, event.victim, event);
        break;
      case 'own-hit':
        // The same blast: the ricochet's owner goes up, its path traced back to the barrel.
        blowUp(state, event.side, event);
        break;
      case 'bumped': {
        const drawn = vehicles.get(event.vehicle);
        drawn?.tank?.jolt(0.4);
        const bumper = state.vehicles.find((vehicle) => vehicle.id === event.vehicle);
        if (bumper && options.revealed(state, bumper)) effects.dust(at(event.at, 0), 1);
        break;
      }
      default:
        break;
    }
  }

  /** A struck vehicle's blast and burn, the shell's path traced, and both shells gone. */
  function blowUp(
    state: MatchState,
    victimSide: Side,
    hit: {
      readonly vehicle: number;
      readonly at: Vec2;
      readonly direction: Vec2;
      readonly path: readonly Vec2[];
    },
  ): void {
    const victim = state.vehicles.find((vehicle) => vehicle.id === hit.vehicle);
    const push = new Vector3(hit.direction.x, 0, hit.direction.y);
    effects.explosion(at(hit.at, inTheAir ? 0 : 0.6), {
      push,
      paint: new Color(
        victim?.vehicle === 'tank'
          ? colours.tanks[victimSide].paint
          : colours.aircraft[victimSide].trim,
      ),
      scale: inTheAir ? 0.7 : 1,
      scorch: !inTheAir,
    });
    if (victim) {
      effects.burn(() => {
        const drawn = vehicles.get(victim.id);
        return drawn ? drawn.root.position.clone().setY(drawn.root.position.y + 0.5) : at(hit.at);
      }, 2.5);
    }
    bankTrace(hit.path);
    retireShell(0);
    retireShell(1);
  }

  /** Points every half unit along a path, so a ribbon follows it closely through each bounce. */
  function alongPath(path: readonly Vec2[]): Vector3[] {
    const points: Vector3[] = [];
    for (let index = 0; index < path.length - 1; index++) {
      const from = path[index];
      const to = path[index + 1];
      if (!from || !to) continue;
      const pieces = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.5));
      for (let piece = 0; piece < pieces; piece++) {
        const t = piece / pieces;
        points.push(at({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }));
      }
    }
    const last = path.at(-1);
    if (last) points.push(at(last));
    return points;
  }

  // A faint mustard thread for the practice aim line; it never fades, it is redrawn every frame.
  const aimRibbon = createRibbon({
    look: 'glow',
    width: 0.12,
    colour: new Color(1.6, 1.05, 0.25),
    alpha: 0.45,
    fade: 1e6,
    maxPoints: 256,
  });
  stage.scene.add(aimRibbon.mesh);

  /** A scoring shell's whole path glows for a moment, every bounce lit: the bank shot's signature. */
  function bankTrace(path: readonly Vec2[]): void {
    if (path.length < 2) return;
    const ribbon = createRibbon({
      look: 'glow',
      width: 0.2,
      widthEnd: 0.1,
      colour: new Color(5.5, 2.6, 0.7),
      colourEnd: new Color(1.6, 0.35, 0.05),
      fade: 1.6,
      maxPoints: 256,
    });
    ribbon.setPath(alongPath(path));
    stage.scene.add(ribbon.mesh);
    lingering.push({ ribbon, left: 1.6 });
  }

  function easeAngle(current: number, target: number, dt: number): number {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return current + delta * Math.min(1, HEADING_EASE * dt);
  }

  function drawVehicle(
    previous: VehicleState | undefined,
    current: VehicleState,
    state: MatchState,
    alpha: number,
    dt: number,
  ): void {
    const drawn = drawnVehicle(current);
    const visible = options.revealed(state, current);
    drawn.root.visible = visible;
    const from = previous?.position ?? current.position;
    const jumped = Math.hypot(current.position.x - from.x, current.position.y - from.y) > WRAP_JUMP;
    const x = jumped ? current.position.x : from.x + (current.position.x - from.x) * alpha;
    const y = jumped ? current.position.y : from.y + (current.position.y - from.y) * alpha;
    const moved = drawn.root.position.clone();
    drawn.root.position.copy(toTable(x, y, height));
    const before = drawn.angle;
    drawn.angle = easeAngle(drawn.angle, -headingAngle(current.heading), dt);

    if (drawn.tank) {
      const travel = moved.distanceTo(drawn.root.position);
      const turning = (drawn.angle - before) * 0.8;
      drawn.tank.roll(travel - turning, travel + turning);
      drawn.tank.update(dt);
      if (visible) layTracks(drawn, { x, y });
    }
    if (drawn.aircraft) {
      const turn = previous ? Math.sign(((current.heading - previous.heading + 24) % 16) - 8) : 0;
      drawn.bank += (turn * 0.55 - drawn.bank) * Math.min(1, 6 * dt);
      drawn.aircraft.setAttitude(drawn.bank, 0.03);
      drawn.aircraft.update(dt, Math.min(1, current.speed / 15));
    }
    drawn.root.rotation.y = drawn.angle;
    if (channel.invisible && visible) shimmer(drawn, x, y);
  }

  /**
   * On invisible channels a vehicle the rules reveal is a heat shimmer, not a solid model: faint,
   * flickering, wobbling a little and casting no shadow, so a glimpse reads as a glimpse.
   */
  function shimmer(drawn: DrawnVehicle, x: number, y: number): void {
    if (!drawn.ghost) {
      const meshes: Mesh[] = [];
      const materials = new Set<Material>();
      drawn.root.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const mesh = child as Mesh;
        meshes.push(mesh);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          materials.add(material);
      });
      for (const material of materials) material.transparent = true;
      for (const mesh of meshes) mesh.castShadow = false;
      drawn.ghost = { materials: [...materials], meshes };
    }
    const flicker = 0.42 + 0.14 * Math.sin(clock * 23 + drawn.id) + 0.08 * Math.sin(clock * 57);
    for (const material of drawn.ghost.materials) material.opacity = flicker;
    const wobble = 0.05 * Math.sin(clock * 31 + drawn.id * 2);
    drawn.root.position.copy(toTable(x + wobble, y - wobble * 0.6, height));
  }

  function layTracks(drawn: DrawnVehicle, position: Vec2): void {
    const last = drawn.lastTrack;
    if (last && Math.hypot(position.x - last.x, position.y - last.y) < TRACK_SPACING) return;
    if (last) {
      const angle = Math.atan2(position.y - last.y, position.x - last.x);
      groundPaint?.stamp({
        kind: 'track',
        x: position.x - 32,
        z: position.y - 20,
        width: 2.2,
        length: 0.5,
        angle,
        strength: 0.75,
      });
      if (options.rng.chance(0.18)) effects.dust(toTable(position.x, position.y, 0.1), 0.5);
    }
    drawn.lastTrack = position;
  }

  function drawShells(previous: MatchState, current: MatchState, alpha: number): void {
    for (const side of [0, 1] as const) {
      const shell = current.shells[side];
      if (!shell) continue;
      const drawn = shellFor(side);
      const before = previous.shells[side];
      const from =
        before &&
        Math.hypot(before.position.x - shell.position.x, before.position.y - shell.position.y) <
          WRAP_JUMP
          ? before.position
          : shell.position;
      const point = {
        x: from.x + (shell.position.x - from.x) * alpha,
        y: from.y + (shell.position.y - from.y) * alpha,
      };
      const world = at(point);
      drawn.slug.position.copy(world);
      drawn.slug.rotation.set(0, -Math.atan2(shell.direction.y, shell.direction.x), Math.PI / 2);
      // A shell that wrapped round the sky starts a fresh trail, or it would streak across the board.
      if (drawn.last && drawn.last.distanceTo(world) > WRAP_JUMP) {
        drawn.tracer.clear();
        drawn.smoke?.clear();
      }
      drawn.last = world.clone();
      drawn.tracer.push(world);
      drawn.smoke?.push(world);
    }
  }

  /**
   * Compiles every shader a match can need before the first frame: a shell, its trails and a bank
   * trace are built once, hidden, so the first shot or hit never stalls on a shader compile.
   */
  const keepers: Ribbon[] = [];
  let modelsWarmed = false;

  /**
   * Builds every vehicle's model and renders it once, shown, before the first real frame. Unseen
   * tanks start hidden, and a hidden model's programs, shadow passes and textures are only prepared
   * when first drawn: without this the first reveal stalls the game for a third of a second. The
   * real frame drawn straight after replaces this one, so nothing hidden is ever seen.
   */
  function warmModels(state: MatchState): void {
    const models = state.vehicles.map((vehicle) => drawnVehicle(vehicle).root);
    for (const root of models) root.visible = true;
    stage.render();
    modelsWarmed = true;
  }

  function warmShaders(): void {
    const samples = [shellFor(0), shellFor(1)];
    bankTrace([
      { x: 30, y: 20 },
      { x: 34, y: 20 },
    ]);
    stage.renderer.compile(stage.scene, stage.camera);
    // The sample trails stay alive (empty) for the whole match, keeping their compiled programs.
    for (const sample of samples) {
      sample.slug.removeFromParent();
      sample.tracer.clear();
      sample.smoke?.clear();
      keepers.push(sample.tracer);
      if (sample.smoke) keepers.push(sample.smoke);
    }
    shells[0] = null;
    shells[1] = null;
    for (const item of lingering) item.ribbon.clear();
  }
  warmShaders();

  return {
    groundPaint,
    applyEvents(state, events) {
      for (const event of events) applyEvent(state, event);
    },
    draw(previous, current, alpha, frameSeconds) {
      clock += frameSeconds;
      if (!modelsWarmed) warmModels(current);
      const before = new Map(previous.vehicles.map((vehicle) => [vehicle.id, vehicle]));
      for (const vehicle of current.vehicles)
        drawVehicle(before.get(vehicle.id), vehicle, current, alpha, frameSeconds);
      drawShells(previous, current, alpha);
      aimRibbon.update(frameSeconds, stage.camera);
      for (const drawn of shells) {
        drawn?.tracer.update(frameSeconds, stage.camera);
        drawn?.smoke?.update(frameSeconds, stage.camera);
      }
      for (let index = lingering.length - 1; index >= 0; index--) {
        const item = lingering[index];
        if (!item) continue;
        item.left -= frameSeconds;
        item.ribbon.update(frameSeconds, stage.camera);
        if (item.left <= 0) {
          item.ribbon.dispose();
          lingering.splice(index, 1);
        }
      }
      effects.update(frameSeconds, stage.camera);
      board?.update(frameSeconds);
      sky?.update(frameSeconds, stage.camera);
      groundPaint.flush(stage.renderer);
    },
    setAimLine(path) {
      if (path === null || path.length < 2) aimRibbon.clear();
      else aimRibbon.setPath(alongPath(path), 0);
    },
    dispose() {
      aimRibbon.dispose();
      for (const drawn of vehicles.values()) {
        drawn.tank?.dispose();
        drawn.aircraft?.dispose();
      }
      for (const side of [0, 1] as const) retireShell(side);
      slugGeometry.dispose();
      slugMaterial.dispose();
      for (const keeper of keepers) keeper.dispose();
      for (const item of lingering) item.ribbon.dispose();
      effects.dispose();
      board?.dispose();
      sky?.dispose();
    },
  };
}
