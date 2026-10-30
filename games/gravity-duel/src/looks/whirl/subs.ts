/**
 * The Whirlpool's two little submarines, our own designs, riding surfaced so
 * their decks show from above. Seat 1's Minnow is a long cigar with a conning
 * tower and a periscope; seat 2's Puffer is round and stubby with a glass
 * dome on top and two side propellers. Each sits in a collar of foam at the
 * waterline and, by night, throws a beam of light ahead of it.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Seat, SeatColours, ShipPose } from '../../look/look.ts';
import type { ShipFigure } from '../../look/space-rig.ts';

/** The subs are built about 2.2 long; this brings them to the size that reads from overhead. */
const DRAWN_SCALE = 1.3;

type Keep = <T extends BufferGeometry>(geometry: T) => T;

function softTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the foam');
  const gradient = context.createRadialGradient(32, 32, 6, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.75, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

function beamTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the beam');
  const gradient = context.createRadialGradient(0, 32, 0, 0, 32, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, 30);
  context.lineTo(128, 0);
  context.lineTo(128, 64);
  context.lineTo(0, 34);
  context.closePath();
  context.fill();
  return new CanvasTexture(canvas);
}

export function createSub(options: {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}): ShipFigure {
  const { seat, colours, night } = options;
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep: Keep = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const paint = own(
    new MeshPhysicalMaterial({
      color: colours.main,
      roughness: 0.35,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
    }),
  );
  const deck = own(
    new MeshStandardMaterial({ color: night ? '#2a3038' : '#39424d', roughness: 0.6 }),
  );
  const brass = own(new MeshStandardMaterial({ color: '#c9a050', metalness: 1, roughness: 0.3 }));
  const glass = own(
    new MeshPhysicalMaterial({
      color: night ? '#ffe6a8' : '#bfe8ff',
      emissive: night ? '#ffcf6a' : '#000000',
      emissiveIntensity: night ? 1.4 : 0,
      roughness: 0.05,
      clearcoat: 1,
    }),
  );

  const root = new Group();
  root.name = `sub-${seat}`;
  const body = new Group();
  body.scale.setScalar(DRAWN_SCALE);
  root.add(body);
  const propellers: Mesh[] = [];
  let bowX: number;

  if (seat === 0) {
    const hull = new Mesh(keep(new CapsuleGeometry(0.32, 1.5, 8, 20).rotateZ(Math.PI / 2)), paint);
    hull.scale.set(1, 0.75, 1);
    hull.position.y = 0.05;
    body.add(hull);
    const stripe = new Mesh(keep(new BoxGeometry(1.5, 0.05, 0.16)), deck);
    stripe.position.set(-0.05, 0.3, 0);
    body.add(stripe);
    const tower = new Mesh(keep(new CapsuleGeometry(0.15, 0.3, 6, 12).rotateZ(Math.PI / 2)), paint);
    tower.scale.set(1, 1.6, 1);
    tower.position.set(0.15, 0.42, 0);
    body.add(tower);
    const periscope = new Mesh(keep(new CylinderGeometry(0.03, 0.03, 0.4, 8)), brass);
    periscope.position.set(0.25, 0.75, 0);
    body.add(periscope);
    const eyepiece = new Mesh(keep(new BoxGeometry(0.14, 0.06, 0.06)), brass);
    eyepiece.position.set(0.3, 0.95, 0);
    body.add(eyepiece);
    const propeller = new Mesh(keep(new BoxGeometry(0.04, 0.42, 0.08)), brass);
    propeller.position.set(-1.12, 0.05, 0);
    body.add(propeller);
    propellers.push(propeller);
    bowX = 1.1;
  } else {
    const hull = new Mesh(keep(new SphereGeometry(0.6, 28, 18)), paint);
    hull.scale.set(1.4, 0.7, 1.05);
    hull.position.y = 0.05;
    body.add(hull);
    const dome = new Mesh(
      keep(new SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
      glass,
    );
    dome.position.set(0.15, 0.42, 0);
    body.add(dome);
    const rim = new Mesh(keep(new TorusGeometry(0.3, 0.035, 8, 24).rotateX(Math.PI / 2)), brass);
    rim.position.set(0.15, 0.42, 0);
    body.add(rim);
    for (const side of [-1, 1]) {
      const pod = new Mesh(keep(new CapsuleGeometry(0.1, 0.3, 6, 10).rotateZ(Math.PI / 2)), deck);
      pod.position.set(-0.55, 0.1, side * 0.55);
      body.add(pod);
      const propeller = new Mesh(keep(new BoxGeometry(0.04, 0.3, 0.06)), brass);
      propeller.position.set(-0.82, 0.1, side * 0.55);
      body.add(propeller);
      propellers.push(propeller);
    }
    bowX = 0.85;
  }

  const foamMap = softTexture();
  const foamMaterial = own(
    new MeshBasicMaterial({
      map: foamMap,
      transparent: true,
      opacity: night ? 0.35 : 0.8,
      depthWrite: false,
    }),
  );
  const foam = new Mesh(keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), foamMaterial);
  foam.scale.set(seat === 0 ? 3.0 : 2.1, 1, seat === 0 ? 1.0 : 1.7);
  foam.position.set(-0.05, 0.02, 0);
  body.add(foam);

  const beamMap = beamTexture();
  const beamMaterial = own(
    new MeshBasicMaterial({
      map: beamMap,
      color: new Color('#ffe2a0').multiplyScalar(0.55),
      transparent: true,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const beam = new Mesh(keep(new PlaneGeometry(4, 2).rotateX(-Math.PI / 2)), beamMaterial);
  beam.position.set(bowX + 2, 0.03, 0);
  beam.visible = night;
  body.add(beam);

  let turn = 0;
  const restingEmissive = paint.emissive.clone();
  return {
    root,
    pose(pose: ShipPose, dt: number) {
      root.position.set(pose.x, 0, pose.z);
      root.rotation.y = pose.heading;
      turn += dt * (pose.thrusting ? 30 : 4);
      for (const propeller of propellers) propeller.rotation.x = turn;
      foam.scale.x = (seat === 0 ? 3.0 : 2.1) * (pose.thrusting ? 1.15 : 1);
      root.visible = pose.cloak < 1;
    },
    spin(progress) {
      const flashed = progress !== null && Math.floor(progress * 16) % 2 === 0;
      paint.emissive.copy(flashed ? new Color('#ffffff') : restingEmissive);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      foamMap.dispose();
      beamMap.dispose();
    },
  };
}
