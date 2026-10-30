/**
 * The Neon Grid's light-bikes, our own design, drawn about three cells long so
 * that from the overhead camera they read as a person on a motorbike: a disc
 * wheel at each end with a glowing rim on both faces, the front one out ahead
 * of the fairing on its fork, a long narrow body between them, bars across the
 * front, and a crouched rider in a white helmet with a stripe in the seat's
 * colour over the helmet and down the back.
 *
 * The two bikes differ in more than colour: seat 1's Lancer has a pointed
 * fairing, one stripe and one tail light; seat 2's Comet a round fairing, twin
 * stripes and twin tail lights.
 *
 * The glowing parts, tail light included, are kept just under the bloom
 * threshold, so the bike's outline stays crisp against the light walls
 * instead of melting into them.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Crash, Seat } from '../../engine/types.ts';
import type { SeatColours } from '../../look/look.ts';
import { NOSE_AHEAD, yawDelta } from '../../look/board-space.ts';
import { createRiderHalo } from '../../look/rider-halo.ts';
import type { RiderFigure } from '../../look/trail-rig.ts';

const WHEEL_RADIUS = 0.42;
/** The front tyre's leading edge is the bike's nose. */
const FRONT_AXLE = NOSE_AHEAD - WHEEL_RADIUS;
const REAR_AXLE = -2.05;
/** From the rider's point, which the rules move, back to the rear tyre's trailing edge. */
export const BIKE_TAIL_BEHIND = -REAR_AXLE + WHEEL_RADIUS;
const BIKE_LENGTH = NOSE_AHEAD + BIKE_TAIL_BEHIND;
const FENDER_GAP = 0.03;
/** The narrow spine over the wheels; wider than a light wall, so the wall it rides on stays inside. */
const SPINE_WIDTH = 0.14;
const BODY_WIDTH = 0.4;
const FAIRING_WIDTH = 0.3;
const BARS = { x: -0.42, y: 1.02, span: 0.62 };
/** The engine block's side outline, rear to front: low between the wheels, tapering underneath. */
const ENGINE_OUTLINE: readonly (readonly [number, number])[] = [
  [-1.6, 0.53],
  [-1.5, 0.16],
  [-0.7, 0.16],
  [-0.6, 0.53],
];

/** How far a bike banks into a turn, per radian per second of turning, and its steepest bank. */
const LEAN_PER_TURN_RATE = 0.1;
const MAX_LEAN = 0.3;
/** A jump longer than this between frames is a wrap to the other edge or a new round, not a ride. */
const TELEPORT = 1.5;

interface BikeStyle {
  readonly fairing: 'point' | 'round';
  /** Across-the-bike offsets of the stripes over the rider's helmet and down the back. */
  readonly stripes: readonly number[];
  readonly tailLights: readonly number[];
}

/** The left rider's Lancer and the right rider's Comet; Four Way's corners reuse them. */
const STYLES: readonly [BikeStyle, BikeStyle] = [
  { fairing: 'point', stripes: [0], tailLights: [0] },
  { fairing: 'round', stripes: [-0.05, 0.05], tailLights: [-0.045, 0.045] },
];

export interface BikeOptions {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}

/** Every material by its part of the bike; the index lets disposal walk them all. */
interface BikeMaterials extends Readonly<Record<string, Material>> {
  readonly paint: Material;
  readonly trim: Material;
  readonly suit: Material;
  readonly helmet: Material;
  readonly visor: Material;
  /** The rims, stripes and grips: the seat's colour, as bright as it gets without blooming. */
  readonly glow: Material;
  /** Spokes and the hub rings, a step dimmer so the rim stays the wheel's outline. */
  readonly dimGlow: Material;
  readonly tailLight: Material;
  readonly headlight: Material;
}

type Keep = <T extends BufferGeometry>(geometry: T) => T;

export function createBike(options: BikeOptions): RiderFigure {
  const { seat, night } = options;
  const style = STYLES[seat % 2] ?? STYLES[0];
  const geometries: BufferGeometry[] = [];
  const keep: Keep = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };
  const materials = bikeMaterials(options.colours, night);

  const root = new Group();
  root.name = `bike-${seat}`;
  // The shadow alone: the glowing rims and stripes already carry the seat's colour, and a ring
  // round a bike this size only adds light around its outline.
  const halo = createRiderHalo({
    colours: options.colours,
    length: BIKE_LENGTH,
    width: BARS.span,
    floor: 0,
    back: (BIKE_TAIL_BEHIND - NOSE_AHEAD) / 2,
    night,
    ring: false,
  });
  root.add(halo.root);
  // Banks about the line where the wheels meet the floor, so they stay on it.
  const banked = new Group();
  root.add(banked);

  const wheels = [
    wheel(FRONT_AXLE, 0.22, materials, keep),
    wheel(REAR_AXLE, 0.28, materials, keep),
  ];
  for (const spinning of wheels) banked.add(spinning);
  banked.add(bodywork(style, materials, keep));
  banked.add(frontEnd(style, materials, keep));
  banked.add(rider(style, materials, keep));
  banked.add(lights(style, materials, keep));

  const steering = createRearWheelSteering();
  let lastYaw: number | null = null;
  let lean = 0;
  let spin = 0;

  return {
    root,
    ride(position, yaw, dt, speedStage) {
      root.position.copy(position);
      const bikeYaw = steering.follow(position, yaw);
      root.rotation.y = bikeYaw;
      if (dt > 0 && lastYaw !== null) {
        const rate = yawDelta(lastYaw, bikeYaw) / dt;
        const target = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, rate * LEAN_PER_TURN_RATE));
        lean += (target - lean) * Math.min(1, dt * 8);
      }
      lastYaw = bikeYaw;
      banked.rotation.x = -lean;
      spin += dt * (6 + speedStage * 4);
      for (const spinning of wheels) spinning.rotation.z = -spin;
    },
    crash(_crash: Crash) {
      banked.visible = false;
      halo.root.visible = false;
    },
    reset() {
      banked.visible = true;
      halo.root.visible = true;
      steering.forget();
      lean = 0;
      lastYaw = null;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      halo.dispose();
    },
  };
}

/**
 * The bike turns the way a real one does: the front goes where the rules send the rider, and the
 * rear wheel follows the line the bike actually rode, so the bike stays over its own light wall
 * through a turn instead of swinging its tail across the floor.
 */
function createRearWheelSteering() {
  const behind = -REAR_AXLE;
  const ridden: Vector3[] = [];
  const rear = new Vector3();

  function remember(position: Vector3): void {
    const last = ridden[ridden.length - 1];
    if (last && last.distanceTo(position) > TELEPORT) ridden.length = 0;
    if (ridden.length === 0 || (last && last.distanceTo(position) > 0.04)) {
      ridden.push(position.clone());
    }
    // Keep only as much of the line as the rear wheel can reach back to.
    let length = 0;
    for (let index = ridden.length - 1; index > 0; index--) {
      length += distanceBetween(ridden, index);
      if (length > behind + 0.5) {
        ridden.splice(0, index - 1);
        break;
      }
    }
  }

  /** Where the rear wheel sits: `behind` back along the ridden line, or straight on past its start. */
  function rearWheel(position: Vector3, yaw: number): Vector3 {
    let left = behind;
    let from = position;
    for (let index = ridden.length - 1; index >= 0; index--) {
      const to = ridden[index];
      if (!to) break;
      const step = from.distanceTo(to);
      if (step >= left && step > 1e-6) return rear.lerpVectors(from, to, left / step);
      left -= step;
      from = to;
    }
    return rear.set(from.x - Math.cos(yaw) * left, 0, from.z + Math.sin(yaw) * left);
  }

  return {
    follow(position: Vector3, yaw: number): number {
      remember(position);
      const wheel = rearWheel(position, yaw);
      const east = position.x - wheel.x;
      const south = position.z - wheel.z;
      if (east * east + south * south < 1e-4) return yaw;
      return Math.atan2(-south, east);
    },
    forget() {
      ridden.length = 0;
    },
  };
}

function distanceBetween(points: readonly Vector3[], index: number): number {
  const a = points[index];
  const b = points[index - 1];
  return a && b ? a.distanceTo(b) : 0;
}

function bikeMaterials(colours: SeatColours, night: boolean): BikeMaterials {
  const main = new Color(colours.main);
  // By day the deep shade carries on white; by night the bright one, lifted to just under bloom.
  const line = night ? main.clone().multiplyScalar(2.2) : new Color(colours.deep);
  return {
    // By day a soft white with a satin coat: a glossy one under the studio sun blooms at the edges.
    paint: new MeshPhysicalMaterial({
      color: night ? '#b9c1d2' : '#e4e8ef',
      emissive: night ? '#1e2433' : '#000000',
      roughness: night ? 0.3 : 0.38,
      metalness: night ? 0.35 : 0.05,
      clearcoat: night ? 1 : 0.5,
      clearcoatRoughness: night ? 0.15 : 0.3,
    }),
    trim: new MeshStandardMaterial({ color: night ? '#12151c' : '#262b35', roughness: 0.6 }),
    suit: new MeshStandardMaterial({
      color: night ? '#15181f' : '#2a2f3a',
      emissive: night ? '#07080c' : '#000000',
      roughness: 0.55,
    }),
    helmet: new MeshPhysicalMaterial({
      color: '#f4f1ea',
      emissive: night ? '#3a3d45' : '#000000',
      roughness: 0.25,
      clearcoat: 1,
    }),
    visor: new MeshPhysicalMaterial({
      color: '#0b1220',
      roughness: 0.05,
      metalness: 0.4,
      clearcoat: 1,
    }),
    glow: new MeshBasicMaterial({ color: line }),
    dimGlow: new MeshBasicMaterial({ color: line.clone().multiplyScalar(0.55) }),
    tailLight: new MeshBasicMaterial({ color: main.clone().multiplyScalar(night ? 2.4 : 1.4) }),
    headlight: new MeshBasicMaterial({ color: night ? '#fff1dc' : '#ffffff' }),
  };
}

/**
 * The side outline of the spine, from the top of the front fender to the tail over the rear
 * wheel: arched over both wheels and low between them, so the light wall it rides along stays
 * inside it until it streams out under the tail.
 */
function spineOutline(): Shape {
  const fender = WHEEL_RADIUS + FENDER_GAP;
  const top = Math.PI * 0.56;
  const outline = new Shape();
  outline.moveTo(FRONT_AXLE + Math.cos(top) * fender, WHEEL_RADIUS + Math.sin(top) * fender);
  outline.lineTo(-0.3, 0.97);
  outline.lineTo(-1.8, 0.93);
  outline.lineTo(-2.15, 0.97);
  outline.quadraticCurveTo(-2.36, 0.98, -2.36, 0.86);
  outline.absarc(REAR_AXLE, WHEEL_RADIUS, fender, Math.PI * 0.72, Math.PI * 0.2, true);
  for (const [x, y] of ENGINE_OUTLINE) outline.lineTo(x, y);
  outline.absarc(FRONT_AXLE, WHEEL_RADIUS, fender, Math.PI * 0.84, top, true);
  outline.closePath();
  return outline;
}

/** The side outline of the tank and seat between the wheels; the engine block hangs below it. */
function bodyOutline(): Shape {
  const outline = new Shape();
  outline.moveTo(-0.62, 0.62);
  outline.quadraticCurveTo(-0.6, 1.0, -0.84, 1.03);
  outline.lineTo(-1.1, 0.99);
  outline.quadraticCurveTo(-1.16, 0.88, -1.26, 0.87);
  outline.lineTo(-1.48, 0.87);
  outline.quadraticCurveTo(-1.54, 0.88, -1.55, 0.95);
  outline.lineTo(-1.56, 0.6);
  outline.lineTo(-1.46, 0.52);
  outline.lineTo(-0.74, 0.52);
  outline.closePath();
  return outline;
}

/** The fairing over the back of the front wheel, which the rider tucks in behind. */
function fairingOutline(shape: BikeStyle['fairing']): Shape {
  const outline = new Shape();
  if (shape === 'point') {
    outline.moveTo(-0.1, 0.9);
    outline.lineTo(-0.34, 1.1);
  } else {
    outline.moveTo(-0.2, 0.76);
    outline.quadraticCurveTo(-0.04, 0.84, -0.16, 1.0);
    outline.quadraticCurveTo(-0.26, 1.12, -0.42, 1.11);
  }
  outline.lineTo(-0.74, 1.08);
  outline.lineTo(-0.76, 0.8);
  outline.lineTo(-0.36, 0.74);
  outline.closePath();
  return outline;
}

/** A thin arc over the front of the front tyre. */
function fenderOutline(): Shape {
  const inner = WHEEL_RADIUS + 0.015;
  const outer = WHEEL_RADIUS + 0.045;
  const outline = new Shape();
  outline.absarc(FRONT_AXLE, WHEEL_RADIUS, outer, Math.PI * 0.12, Math.PI * 0.6, false);
  outline.absarc(FRONT_AXLE, WHEEL_RADIUS, inner, Math.PI * 0.6, Math.PI * 0.12, true);
  outline.closePath();
  return outline;
}

function extruded(outline: Shape, width: number, bevel: number, keep: Keep): BufferGeometry {
  const geometry = keep(
    new ExtrudeGeometry(outline, {
      depth: width - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 14,
    }),
  );
  geometry.translate(0, 0, -(width - bevel * 2) / 2);
  return geometry;
}

function bodywork(style: BikeStyle, materials: BikeMaterials, keep: Keep): Group {
  const group = new Group();
  const shell = (outline: Shape, width: number, bevel: number): Mesh => {
    const mesh = new Mesh(extruded(outline, width, bevel, keep), materials.paint);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  shell(spineOutline(), SPINE_WIDTH, 0.03);
  shell(bodyOutline(), BODY_WIDTH, 0.06);
  shell(fairingOutline(style.fairing), FAIRING_WIDTH, 0.04);
  // The engine block low between the wheels, dark, so the body reads as a shell over a machine.
  const engineOutline = new Shape();
  for (const [x, y] of ENGINE_OUTLINE) engineOutline.lineTo(x, y);
  engineOutline.closePath();
  group.add(new Mesh(extruded(engineOutline, BODY_WIDTH + 0.03, 0.03, keep), materials.trim));
  // A line in the seat's colour along each flank, so the bike's length shows from the side.
  for (const side of [-1, 1]) {
    const flank = new Mesh(keep(new BoxGeometry(0.86, 0.035, 0.01)), materials.glow);
    flank.position.set(-1.08, 0.7, side * (BODY_WIDTH / 2 + 0.006));
    group.add(flank);
  }
  return group;
}

/** The fork, the fender and the bars: what holds the front wheel out ahead of the fairing. */
function frontEnd(style: BikeStyle, materials: BikeMaterials, keep: Keep): Group {
  const group = new Group();
  const fender = new Mesh(extruded(fenderOutline(), 0.1, 0.015, keep), materials.paint);
  group.add(fender);
  const forkTop = new Vector3(-0.3, 0.95, 0);
  for (const side of [-1, 1]) {
    const offset = side * 0.14;
    group.add(
      limb(
        new Vector3(FRONT_AXLE, WHEEL_RADIUS, offset),
        forkTop.clone().setZ(offset),
        0.024,
        materials.trim,
        keep,
      ),
    );
  }
  const bar = new Mesh(
    keep(new CylinderGeometry(0.022, 0.022, BARS.span, 10).rotateX(Math.PI / 2)),
    materials.trim,
  );
  bar.position.set(BARS.x, BARS.y, 0);
  group.add(bar);
  const grip = keep(new SphereGeometry(0.046, 12, 8));
  for (const side of [-1, 1]) {
    const end = new Mesh(grip, materials.glow);
    end.position.set(BARS.x, BARS.y, (side * BARS.span) / 2);
    group.add(end);
  }
  // On the fairing's nose: the tip of Lancer's point, the front of Comet's round.
  const headlight = new Mesh(keep(new SphereGeometry(0.035, 10, 8)), materials.headlight);
  if (style.fairing === 'point') headlight.position.set(-0.07, 0.9, 0);
  else headlight.position.set(-0.08, 0.86, 0);
  group.add(headlight);
  return group;
}

/** A disc wheel with a glowing rim on both faces, so it reads as a ring from the side and from above. */
function wheel(axle: number, width: number, materials: BikeMaterials, keep: Keep): Group {
  const group = new Group();
  group.position.set(axle, WHEEL_RADIUS, 0);
  const tyre = new Mesh(
    keep(new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, width, 40).rotateX(Math.PI / 2)),
    materials.trim,
  );
  tyre.castShadow = true;
  group.add(tyre);
  // Thick enough to stay a line of light, not a hairline, from the whole-board camera.
  const rim = keep(new TorusGeometry(WHEEL_RADIUS - 0.035, 0.038, 8, 56));
  const hubRing = keep(new TorusGeometry(WHEEL_RADIUS * 0.42, 0.016, 6, 32));
  const spokes = keep(spokeGeometry());
  for (const side of [-1, 1]) {
    const face = side * (width / 2 + 0.004);
    for (const [geometry, material] of [
      [rim, materials.glow],
      [hubRing, materials.dimGlow],
      [spokes, materials.dimGlow],
    ] as const) {
      const part = new Mesh(geometry, material);
      part.position.z = face;
      group.add(part);
    }
  }
  return group;
}

/** Three short spokes between the hub ring and the rim, which show the wheel turning. */
function spokeGeometry(): BufferGeometry {
  const inner = WHEEL_RADIUS * 0.42;
  const outer = WHEEL_RADIUS - 0.04;
  const pieces = [0, 1, 2].map((index) =>
    new BoxGeometry(outer - inner, 0.026, 0.004)
      .translate((inner + outer) / 2, 0, 0)
      .rotateZ((index * Math.PI * 2) / 3),
  );
  const merged = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return merged;
}

/** The rider crouched over the tank: knees out, arms to the bars, chin on the fairing. */
function rider(style: BikeStyle, materials: BikeMaterials, keep: Keep): Group {
  const group = new Group();
  const hips = new Vector3(-1.4, 1.02, 0);
  const shoulders = new Vector3(-0.9, 1.2, 0);
  const torso = limb(hips, shoulders, 0.15, materials.suit, keep);
  torso.scale.set(0.85, 1, 1.35);
  group.add(torso);

  // The back stripes lie along the top of the torso, where the overhead camera sees them first.
  const along = new Vector3().subVectors(shoulders, hips).normalize();
  const up = new Vector3(-along.y, along.x, 0).multiplyScalar(0.125);
  for (const offset of style.stripes) {
    const across = new Vector3(0, 0, offset);
    const stripe = limb(
      hips.clone().add(up).add(across).addScaledVector(along, 0.06),
      shoulders.clone().add(up).add(across),
      0.034,
      materials.glow,
      keep,
    );
    stripe.scale.x = 0.5;
    group.add(stripe);
  }

  for (const side of [-1, 1]) {
    const shoulder = new Vector3(-0.92, 1.18, side * 0.19);
    const grip = new Vector3(BARS.x, BARS.y, side * (BARS.span / 2 - 0.05));
    group.add(limb(shoulder, grip, 0.05, materials.suit, keep));
    const hip = new Vector3(-1.32, 1.0, side * 0.12);
    const knee = new Vector3(-0.98, 0.84, side * 0.26);
    const foot = new Vector3(-1.32, 0.52, side * 0.24);
    group.add(limb(hip, knee, 0.07, materials.suit, keep));
    group.add(limb(knee, foot, 0.055, materials.suit, keep));
  }

  group.add(helmet(style, materials, keep));
  return group;
}

function helmet(style: BikeStyle, materials: BikeMaterials, keep: Keep): Group {
  const radius = 0.145;
  const group = new Group();
  group.position.set(-0.64, 1.26, 0);
  group.scale.set(1.18, 0.95, 1);
  const shell = new Mesh(keep(new SphereGeometry(radius, 24, 16)), materials.helmet);
  shell.castShadow = true;
  group.add(shell);
  // The visor wraps the front, below the crown.
  const visor = new Mesh(
    keep(new SphereGeometry(radius + 0.004, 20, 10, Math.PI - 0.95, 1.9, 1.0, 0.7)),
    materials.visor,
  );
  group.add(visor);
  // Each stripe runs over the crown from the brow to the nape, sitting on the shell's surface.
  for (const offset of style.stripes) {
    const lineRadius = Math.sqrt(radius * radius - offset * offset) + 0.004;
    const stripe = new Mesh(
      keep(new TorusGeometry(lineRadius, 0.024, 6, 24, Math.PI)),
      materials.glow,
    );
    stripe.position.z = offset;
    group.add(stripe);
  }
  return group;
}

function lights(style: BikeStyle, materials: BikeMaterials, keep: Keep): Group {
  const group = new Group();
  const tail = keep(new BoxGeometry(0.03, 0.1, 0.06));
  for (const offset of style.tailLights) {
    const light = new Mesh(tail, materials.tailLight);
    light.position.set(-2.4, 0.9, offset);
    group.add(light);
  }
  return group;
}

const capsuleAxis = new Vector3(0, 1, 0);

/** A capsule from one point to another, for the rider's body and limbs and the fork legs. */
function limb(from: Vector3, to: Vector3, radius: number, material: Material, keep: Keep): Mesh {
  const span = new Vector3().subVectors(to, from);
  const length = span.length();
  const mesh = new Mesh(
    keep(new CapsuleGeometry(radius, Math.max(0, length - radius), 4, 12)),
    material,
  );
  mesh.position.copy(from).addScaledVector(span, 0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(capsuleAxis, span.normalize()));
  mesh.castShadow = true;
  return mesh;
}
