/**
 * Toy Trains' wind-up locomotives, painted tin toys of our own design.
 * Seat 1's Ember is a tender engine: a long orange boiler with gold bands, a
 * tall flared funnel, a cowcatcher and big red driving wheels, with its key
 * in its side. Seat 2's Bluebell is a squat tank engine: blue side tanks, a
 * short chimney, a square cab, buffers at the front and its key on the roof.
 *
 * A locomotive chuffs as it rolls, its key turning and a puff of steam rising
 * every half cell; derailed, it tips onto its side with its wheels spinning.
 */
import {
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Crash, Seat } from '../../engine/types.ts';
import type { SeatColours } from '../../look/look.ts';
import type { RiderFigure } from '../../look/trail-rig.ts';
import { BED_HEIGHT, MAT_TOP } from './track.ts';

/** The locomotives ride on their own track's rails. */
const RIDE_HEIGHT = MAT_TOP + BED_HEIGHT + 0.06;
/** A puff of steam every this many cells travelled. */
const PUFF_EVERY = 0.5;
const TIP_SECONDS = 0.55;
/** Built to a cell and drawn a third larger, so the engines read on a full board. */
const LOCO_SCALE = 1.3;

export interface LocoOptions {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
  /** Called with the funnel's top whenever the engine puffs. */
  readonly onPuff: (at: Vector3, speedStage: number) => void;
}

export interface Loco extends RiderFigure {
  /** Where the headlamp points from, for the night's light cone. */
  readonly lamp: Group;
}

interface Parts {
  readonly wheels: Mesh[];
  readonly key: Group;
  readonly funnelTop: Vector3;
  readonly lamp: Group;
}

export function createLoco(options: LocoOptions): Loco {
  const { seat } = options;
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const tin = (colour: string | Color, roughness = 0.38) =>
    own(new MeshStandardMaterial({ color: colour, roughness, metalness: 0.25 }));
  const palette = {
    body: tin(options.colours.main),
    deep: tin(options.colours.deep),
    black: tin('#26221f', 0.5),
    gold: own(new MeshStandardMaterial({ color: '#d9a93b', roughness: 0.3, metalness: 0.8 })),
    red: tin('#c8322b'),
    cream: tin('#f2e6c9'),
    glass: tin('#2e3a48', 0.15),
    lens: own(
      new MeshBasicMaterial({
        color: new Color('#fff2c4').multiplyScalar(options.night ? 3 : 1.4),
      }),
    ),
  };

  const root = new Group();
  root.name = `loco-${seat}`;
  const body = new Group();
  body.scale.setScalar(LOCO_SCALE);
  root.add(body);
  const tilt = new Group();
  body.add(tilt);
  const parts = seat === 0 ? buildEmber(tilt, palette, keep) : buildBluebell(tilt, palette, keep);
  tilt.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });

  let travelled = 0;
  let sincePuff = 0;
  let wheelTurn = 0;
  let derail: { age: number; side: number } | null = null;
  const lastPosition = new Vector3();
  let hasLast = false;
  const funnelWorld = new Vector3();

  function animateWheels(distance: number): void {
    wheelTurn += distance / 0.1;
    for (const wheel of parts.wheels) wheel.rotation.z = -wheelTurn;
  }

  return {
    root,
    lamp: parts.lamp,
    ride(position, yaw, dt, speedStage) {
      root.position.copy(position).setY(RIDE_HEIGHT);
      root.rotation.y = yaw;
      if (dt <= 0) return;
      const distance = hasLast ? lastPosition.distanceTo(position) : 0;
      lastPosition.copy(position);
      hasLast = true;
      // A wrap jumps across the board; that is not distance rolled.
      const rolled = distance < 1.5 ? distance : 0;
      travelled += rolled;
      sincePuff += rolled;
      animateWheels(rolled);
      parts.key.rotation.z += dt * (2 + speedStage * 2.5);
      tilt.position.y = Math.abs(Math.sin(travelled * Math.PI * 2)) * 0.02;
      tilt.rotation.x = Math.sin(travelled * Math.PI * 4) * 0.03;
      if (sincePuff >= PUFF_EVERY) {
        sincePuff -= PUFF_EVERY;
        options.onPuff(tilt.localToWorld(funnelWorld.copy(parts.funnelTop)), speedStage);
      }
    },
    crash(_crash: Crash, direction) {
      // Tip away from the turn the wall forced: to the right of the heading, a toy's usual fall.
      derail = { age: 0, side: direction.x + direction.z >= 0 ? 1 : -1 };
    },
    reset() {
      derail = null;
      tilt.rotation.set(0, 0, 0);
      tilt.position.set(0, 0, 0);
      body.position.set(0, 0, 0);
      hasLast = false;
    },
    update(dt) {
      if (!derail) return;
      derail.age += dt;
      const t = Math.min(1, derail.age / TIP_SECONDS);
      // Up on one side, over, and a small bounce as it lands.
      const fall =
        t < 1
          ? easeInBack(t)
          : 1 +
            Math.sin((derail.age - TIP_SECONDS) * 18) *
              Math.exp(-(derail.age - TIP_SECONDS) * 6) *
              0.06;
      tilt.rotation.x = derail.side * fall * 1.45;
      body.position.y = Math.sin(t * Math.PI) * 0.18;
      body.position.x = t * 0.12;
      animateWheels(dt * 2.5);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

function easeInBack(t: number): number {
  const overshoot = 1.4;
  return t * t * ((overshoot + 1) * t - overshoot);
}

type Palette = Record<
  'body' | 'deep' | 'black' | 'gold' | 'red' | 'cream' | 'glass' | 'lens',
  Material
>;
type Keep = <T extends BufferGeometry>(geometry: T) => T;

function add(
  parent: Group,
  geometry: BufferGeometry,
  material: Material,
  x: number,
  y: number,
  z = 0,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A cylinder lying along x. */
function barrel(keep: Keep, radius: number, length: number, segments = 24): BufferGeometry {
  const geometry = keep(new CylinderGeometry(radius, radius, length, segments));
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}

/** A wheel standing in the xy plane, its axle along z, with a rim of the given colour. */
function wheel(keep: Keep, radius: number): BufferGeometry {
  const geometry = keep(new CylinderGeometry(radius, radius, 0.05, 20));
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** The key on a mount (placed by the caller) and a spinner that turns about the key's shaft. */
function windUpKey(parent: Group, palette: Palette, keep: Keep): { mount: Group; spinner: Group } {
  const mount = new Group();
  const key = new Group();
  mount.add(key);
  const shaft = keep(new CylinderGeometry(0.02, 0.02, 0.1, 8));
  shaft.rotateX(Math.PI / 2);
  add(key, shaft, palette.gold, 0, 0, 0.05);
  const lobe = keep(new SphereGeometry(0.06, 14, 10));
  lobe.scale(1, 1, 0.25);
  add(key, lobe, palette.gold, 0, 0.065, 0.1);
  add(key, lobe, palette.gold, 0, -0.065, 0.1);
  parent.add(mount);
  return { mount, spinner: key };
}

function headlamp(parent: Group, palette: Palette, keep: Keep, x: number, y: number): Group {
  const lamp = new Group();
  lamp.position.set(x, y, 0);
  add(lamp, barrel(keep, 0.045, 0.06, 14), palette.black, 0, 0);
  add(lamp, barrel(keep, 0.034, 0.012, 14), palette.lens, 0.032, 0);
  parent.add(lamp);
  return lamp;
}

function buildEmber(parent: Group, palette: Palette, keep: Keep): Parts {
  add(parent, keep(new RoundedBoxGeometry(0.92, 0.07, 0.4, 2, 0.02)), palette.black, -0.02, 0.06);
  const wheels = [
    add(parent, wheel(keep, 0.11), palette.red, -0.22, 0.02, 0.2),
    add(parent, wheel(keep, 0.11), palette.red, -0.22, 0.02, -0.2),
    add(parent, wheel(keep, 0.11), palette.red, 0.02, 0.02, 0.2),
    add(parent, wheel(keep, 0.11), palette.red, 0.02, 0.02, -0.2),
    add(parent, wheel(keep, 0.075), palette.red, 0.29, -0.01, 0.2),
    add(parent, wheel(keep, 0.075), palette.red, 0.29, -0.01, -0.2),
  ];
  add(parent, barrel(keep, 0.16, 0.54), palette.body, 0.13, 0.25);
  for (const x of [0.0, 0.26])
    add(
      parent,
      keep(new TorusGeometry(0.162, 0.014, 8, 28)).rotateY(Math.PI / 2),
      palette.gold,
      x,
      0.25,
    );
  add(parent, barrel(keep, 0.165, 0.06), palette.black, 0.42, 0.25);
  const funnel = keep(new CylinderGeometry(0.075, 0.045, 0.22, 16));
  add(parent, funnel, palette.black, 0.33, 0.48);
  add(parent, keep(new SphereGeometry(0.065, 14, 10)), palette.gold, 0.13, 0.42);
  add(parent, keep(new RoundedBoxGeometry(0.3, 0.32, 0.44, 2, 0.03)), palette.body, -0.3, 0.3);
  add(parent, keep(new RoundedBoxGeometry(0.36, 0.05, 0.5, 2, 0.02)), palette.deep, -0.3, 0.48);
  for (const z of [0.221, -0.221])
    add(
      parent,
      keep(new RoundedBoxGeometry(0.14, 0.12, 0.01, 1, 0.004)),
      palette.glass,
      -0.28,
      0.36,
      z,
    );
  const catcher = new Shape();
  catcher.moveTo(0, 0);
  catcher.lineTo(0.16, -0.12);
  catcher.lineTo(0, -0.12);
  catcher.closePath();
  const catcherGeometry = keep(new ExtrudeGeometry(catcher, { depth: 0.36, bevelEnabled: false }));
  catcherGeometry.translate(0, 0, -0.18);
  add(parent, catcherGeometry, palette.red, 0.44, 0.1);
  const key = windUpKey(parent, palette, keep);
  key.mount.position.set(-0.1, 0.24, 0.17);
  const lamp = headlamp(parent, palette, keep, 0.44, 0.4);
  return { wheels, key: key.spinner, funnelTop: new Vector3(0.33, 0.6, 0), lamp };
}

function buildBluebell(parent: Group, palette: Palette, keep: Keep): Parts {
  add(parent, keep(new RoundedBoxGeometry(0.86, 0.07, 0.42, 2, 0.02)), palette.black, 0, 0.06);
  const wheels: Mesh[] = [];
  for (const x of [-0.24, 0.0, 0.24]) {
    for (const z of [0.2, -0.2])
      wheels.push(add(parent, wheel(keep, 0.09), palette.black, x, 0.0, z));
  }
  add(parent, barrel(keep, 0.13, 0.5), palette.deep, 0.1, 0.27);
  for (const z of [0.15, -0.15])
    add(
      parent,
      keep(new RoundedBoxGeometry(0.46, 0.24, 0.13, 2, 0.03)),
      palette.body,
      0.1,
      0.22,
      z,
    );
  add(parent, keep(new CylinderGeometry(0.05, 0.05, 0.12, 14)), palette.black, 0.3, 0.44);
  add(parent, keep(new SphereGeometry(0.055, 14, 10)), palette.gold, 0.12, 0.42);
  add(parent, keep(new RoundedBoxGeometry(0.3, 0.36, 0.46, 2, 0.03)), palette.body, -0.26, 0.31);
  const roof = keep(new CylinderGeometry(0.26, 0.26, 0.34, 20, 1, false, 0, Math.PI));
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(Math.PI / 2);
  roof.scale(1, 0.32, 1);
  add(parent, roof, palette.cream, -0.26, 0.49);
  for (const z of [0.231, -0.231])
    add(
      parent,
      keep(new RoundedBoxGeometry(0.14, 0.13, 0.01, 1, 0.004)),
      palette.glass,
      -0.25,
      0.37,
      z,
    );
  for (const z of [0.13, -0.13])
    add(parent, barrel(keep, 0.035, 0.08, 12), palette.red, 0.46, 0.1, z);
  const key = windUpKey(parent, palette, keep);
  key.mount.rotation.x = -Math.PI / 2;
  key.mount.position.set(-0.26, 0.55, 0);
  const lamp = headlamp(parent, palette, keep, 0.4, 0.33);
  return { wheels, key: key.spinner, funnelTop: new Vector3(0.3, 0.52, 0), lamp };
}
