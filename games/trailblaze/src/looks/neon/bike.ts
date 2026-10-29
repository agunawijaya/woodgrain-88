/**
 * The Neon Grid's light-bikes, our own design: a closed hull riding inside a
 * single glowing wheel ring, the rider's helmet under a glass canopy with a
 * stripe in the seat's colour. The two bikes differ in shape, not only in
 * colour: seat 1's Lancer is long, with a pointed nose and one swept fin;
 * seat 2's Comet is short and round, with a bubble canopy and twin fins. From
 * the overhead camera the two outlines are told apart at a glance.
 */
import {
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Vector3,
} from 'three';
import type { Crash, Seat } from '../../engine/types.ts';
import type { SeatColours } from '../../look/look.ts';
import type { RiderFigure } from '../../look/trail-rig.ts';

/** Height of the hull's axis above the floor; the ring's foot touches the floor. */
const AXLE = 0.31;
const RING_RADIUS = 0.29;
/** The bikes are built to a cell and drawn a third larger, so they read on a full board. */
const BIKE_SCALE = 1.3;
/** How far a bike banks into a turn, per radian per second of turning. */
const LEAN_PER_TURN_RATE = 0.06;

interface HullShape {
  /** Radius along the hull from nose (first) to tail (last), at even steps. */
  readonly profile: readonly number[];
  readonly length: number;
  /** Squash across the hull, so it reads as a vehicle and not a cigar. */
  readonly width: number;
  readonly canopy: { readonly x: number; readonly size: readonly [number, number, number] };
  readonly ringX: number;
}

/** The left rider's long dart and the right rider's stubby pod; Four Way's corners reuse them. */
const SHAPES: readonly [HullShape, HullShape] = [
  {
    profile: [0, 0.07, 0.12, 0.155, 0.18, 0.195, 0.2, 0.198, 0.19, 0.17, 0.15, 0.13, 0.11, 0],
    length: 1.18,
    width: 0.78,
    canopy: { x: 0.06, size: [0.25, 0.12, 0.12] },
    ringX: -0.1,
  },
  {
    profile: [0, 0.13, 0.19, 0.22, 0.235, 0.24, 0.235, 0.22, 0.2, 0.17, 0],
    length: 0.96,
    width: 0.92,
    canopy: { x: 0.02, size: [0.2, 0.16, 0.16] },
    ringX: -0.06,
  },
];

export interface BikeOptions {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}

export function createBike(options: BikeOptions): RiderFigure {
  const { seat, night } = options;
  const shape = SHAPES[seat % 2] ?? SHAPES[0];
  const accent = new Color(options.colours.main);
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

  const shell = own(
    new MeshPhysicalMaterial({
      color: night ? '#c9cfdc' : '#f3f4f7',
      roughness: night ? 0.28 : 0.22,
      metalness: night ? 0.3 : 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
  );
  const glowing = own(
    new MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: night ? 3.2 : 1.35,
      roughness: 0.4,
    }),
  );
  const glass = own(
    new MeshPhysicalMaterial({
      color: night ? '#0b1220' : '#1d2a3c',
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1,
      transparent: true,
      opacity: 0.62,
    }),
  );
  const helmetPaint = own(new MeshStandardMaterial({ color: '#f6f2ea', roughness: 0.35 }));
  const hot = own(
    new MeshBasicMaterial({ color: new Color(accent).multiplyScalar(night ? 4 : 2) }),
  );

  const root = new Group();
  root.name = `bike-${seat}`;
  const body = new Group();
  body.scale.setScalar(BIKE_SCALE);
  root.add(body);
  const banked = new Group();
  body.add(banked);

  const hull = new Mesh(keep(hullGeometry(shape)), shell);
  hull.position.y = AXLE;
  hull.castShadow = true;
  banked.add(hull);

  const stripe = new Mesh(keep(hullStripeGeometry(shape)), glowing);
  stripe.position.y = AXLE;
  banked.add(stripe);

  const ring = new Mesh(keep(new TorusGeometry(RING_RADIUS, 0.042, 14, 56)), glowing);
  ring.position.set(shape.ringX, AXLE, 0);
  ring.castShadow = true;
  banked.add(ring);
  // A hub inside the ring so the wheel reads as a wheel and not a hoop.
  const hub = new Mesh(keep(new CylinderGeometry(0.07, 0.07, shape.width * 0.42, 18)), shell);
  hub.rotation.x = Math.PI / 2;
  hub.position.copy(ring.position);
  banked.add(hub);

  const canopy = new Mesh(
    keep(new SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)),
    glass,
  );
  canopy.scale.set(...shape.canopy.size);
  canopy.position.set(shape.canopy.x, AXLE + 0.1, 0);
  banked.add(canopy);

  const helmet = new Mesh(keep(new SphereGeometry(0.068, 16, 12)), helmetPaint);
  helmet.position.set(shape.canopy.x - 0.03, AXLE + 0.15, 0);
  banked.add(helmet);
  const helmetStripe = new Mesh(keep(new TorusGeometry(0.069, 0.013, 8, 24)), glowing);
  helmetStripe.rotation.y = Math.PI / 2;
  helmetStripe.position.copy(helmet.position);
  banked.add(helmetStripe);

  for (const fin of finsFor(seat, keep)) {
    const mesh = new Mesh(fin.geometry, shell);
    mesh.position.set(fin.x, AXLE + 0.05, fin.z);
    mesh.castShadow = true;
    banked.add(mesh);
    const edge = new Mesh(fin.edge, glowing);
    edge.position.copy(mesh.position);
    banked.add(edge);
  }

  const tailLights = seat === 0 ? [0] : [-0.08, 0.08];
  for (const z of tailLights) {
    const light = new Mesh(keep(new SphereGeometry(0.035, 10, 8)), hot);
    light.position.set(-shape.length / 2 + 0.02, AXLE + 0.03, z);
    banked.add(light);
  }
  const noseLight = new Mesh(keep(new SphereGeometry(0.03, 10, 8)), hot);
  noseLight.position.set(shape.length / 2 - 0.04, AXLE - 0.02, 0);
  banked.add(noseLight);

  let lastYaw: number | null = null;
  let lean = 0;
  let spin = 0;

  return {
    root,
    ride(position: Vector3, yaw: number, dt: number, speedStage: number) {
      root.position.copy(position);
      root.rotation.y = yaw;
      if (dt > 0 && lastYaw !== null) {
        const rate = (yaw - lastYaw) / dt;
        const target = Math.max(-0.45, Math.min(0.45, rate * LEAN_PER_TURN_RATE));
        lean += (target - lean) * Math.min(1, dt * 10);
      }
      lastYaw = yaw;
      banked.rotation.x = -lean;
      spin += dt * (5 + speedStage * 4);
      ring.rotation.z = -spin;
    },
    crash(_crash: Crash) {
      body.visible = false;
    },
    reset() {
      body.visible = true;
      lean = 0;
      lastYaw = null;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** A body of revolution along +x, squashed across, from the shape's radius profile. */
function hullGeometry(shape: HullShape): LatheGeometry {
  const steps = shape.profile.length - 1;
  const points = shape.profile.map(
    (radius, index) => new Vector2(radius, shape.length / 2 - (index / steps) * shape.length),
  );
  const geometry = new LatheGeometry(points, 32);
  geometry.rotateZ(-Math.PI / 2);
  geometry.scale(1, 0.92, shape.width);
  geometry.computeVertexNormals();
  return geometry;
}

/** A thin glowing band round the hull's widest point, in the seat's colour. */
function hullStripeGeometry(shape: HullShape): TorusGeometry {
  const widest = Math.max(...shape.profile);
  const geometry = new TorusGeometry(widest * 0.99, 0.016, 8, 40);
  geometry.rotateY(Math.PI / 2);
  geometry.scale(1, 0.92, shape.width);
  geometry.translate(shape.length * 0.12, 0, 0);
  return geometry;
}

interface Fin {
  readonly geometry: BufferGeometry;
  readonly edge: BufferGeometry;
  readonly x: number;
  readonly z: number;
}

/** Lancer: one tall swept fin. Comet: two short fins splayed at the sides. */
function finsFor(seat: Seat, keep: <T extends BufferGeometry>(geometry: T) => T): Fin[] {
  if (seat === 0) {
    const outline = new Shape();
    outline.moveTo(0.18, 0);
    outline.lineTo(-0.2, 0.3);
    outline.lineTo(-0.32, 0.3);
    outline.lineTo(-0.26, 0);
    outline.closePath();
    const geometry = keep(new ExtrudeGeometry(outline, { depth: 0.025, bevelEnabled: false }));
    geometry.translate(0, 0, -0.0125);
    const edge = keep(new CylinderGeometry(0.012, 0.012, 0.46, 6));
    edge.rotateZ(Math.atan2(0.38, 0.3));
    edge.translate(-0.01, 0.15, 0);
    return [{ geometry, edge, x: -0.18, z: 0 }];
  }
  return [-1, 1].map((side) => {
    const outline = new Shape();
    outline.moveTo(0.12, 0);
    outline.lineTo(-0.1, 0.2);
    outline.lineTo(-0.2, 0.2);
    outline.lineTo(-0.16, 0);
    outline.closePath();
    const geometry = keep(new ExtrudeGeometry(outline, { depth: 0.02, bevelEnabled: false }));
    geometry.rotateX(side * 0.35);
    const edge = keep(new CylinderGeometry(0.01, 0.01, 0.2, 6));
    edge.rotateX(side * 0.35);
    edge.translate(-0.15, 0.2, side * 0.07);
    return { geometry, edge, x: -0.24, z: side * 0.15 };
  });
}
