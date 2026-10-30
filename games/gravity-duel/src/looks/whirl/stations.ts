/**
 * The Whirlpool's other residents, our own designs: the starbase is a big
 * striped supply buoy hung with fenders, its lamp blinking; the docking runs'
 * beacon is a rocky islet with a little lighthouse that the current swirls
 * round without swallowing anything; and the pods are small marker buoys in
 * the colour of the seat that must catch them, bobbing as they drift.
 */
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { createKeeper } from '../../look/keeper.ts';
import type { PodPose } from '../../look/look.ts';
import type { MiddleFigure, PodFigure } from '../../look/space-rig.ts';

const BUOY_RED = '#d8392b';
const SHARED_POD = '#ffd23a';

/** A lamp that blinks like a harbour light: a short flash, a long dark. */
function blinking(clock: number, period: number): number {
  return clock % period < 0.25 ? 1 : 0;
}

export function createSupplyBuoy(night: boolean): MiddleFigure {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'whirl-supply-buoy';
  root.scale.setScalar(1.15);
  const bobbing = new Group();
  root.add(bobbing);
  const red = keep.material(new MeshStandardMaterial({ color: BUOY_RED, roughness: 0.55 }));
  const white = keep.material(new MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.6 }));
  const rubber = keep.material(new MeshStandardMaterial({ color: '#23262b', roughness: 0.9 }));
  const steel = keep.material(
    new MeshStandardMaterial({ color: '#7b828c', metalness: 0.6, roughness: 0.4 }),
  );

  // Bands of red and white up the drum, so it reads as a buoy from straight above too.
  const band = keep.geometry(new CylinderGeometry(0.85, 0.9, 0.16, 36));
  for (let index = 0; index < 4; index++) {
    const ring = new Mesh(band, index % 2 === 0 ? red : white);
    ring.position.y = 0.08 + index * 0.16;
    ring.scale.setScalar(1 - index * 0.06);
    bobbing.add(ring);
  }
  const deck = new Mesh(keep.geometry(new CylinderGeometry(0.66, 0.7, 0.06, 36)), steel);
  deck.position.y = 0.68;
  bobbing.add(deck);
  const fender = keep.geometry(new TorusGeometry(0.12, 0.06, 8, 16));
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2;
    const tyre = new Mesh(fender, rubber);
    tyre.position.set(Math.cos(angle) * 0.9, 0.3, Math.sin(angle) * 0.9);
    tyre.rotation.y = -angle;
    bobbing.add(tyre);
  }
  const mast = new Mesh(keep.geometry(new CylinderGeometry(0.05, 0.06, 0.6, 10)), steel);
  mast.position.y = 1.0;
  bobbing.add(mast);
  const lampMaterial = keep.material(new MeshBasicMaterial({ color: '#ffe08a' }));
  const lamp = new Mesh(keep.geometry(new SphereGeometry(0.11, 14, 10)), lampMaterial);
  lamp.position.y = 1.34;
  bobbing.add(lamp);
  const haloMaterial = keep.material(
    new MeshBasicMaterial({
      color: new Color('#ffd27a'),
      transparent: true,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const halo = new Mesh(
    keep.geometry(new RingGeometry(0.2, 1.4, 48).rotateX(-Math.PI / 2)),
    haloMaterial,
  );
  halo.position.y = 0.06;
  root.add(halo);

  let welcome = 0;
  return {
    root,
    update(dt, clock) {
      bobbing.position.y = Math.sin(clock * 1.3) * 0.05;
      bobbing.rotation.z = Math.sin(clock * 0.9) * 0.03;
      welcome = Math.max(0, welcome - dt);
      const lit = Math.max(blinking(clock, 2.4), welcome);
      lampMaterial.color.set('#ffe08a').multiplyScalar(0.5 + lit * (night ? 2.5 : 1));
      haloMaterial.opacity = night ? 0.05 + lit * 0.3 : lit * 0.12;
    },
    welcome() {
      welcome = 1;
    },
    dispose: keep.dispose,
  };
}

export function createLighthouseRock(night: boolean): MiddleFigure {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'whirl-lighthouse-rock';
  root.scale.setScalar(1.35);
  const rock = keep.material(
    new MeshStandardMaterial({ color: '#6d6a62', roughness: 0.95, flatShading: true }),
  );
  for (const [x, z, size] of [
    [0, 0, 0.7],
    [0.45, 0.25, 0.4],
    [-0.4, 0.3, 0.35],
    [0.1, -0.45, 0.38],
  ] as const) {
    const boulder = new Mesh(keep.geometry(new DodecahedronGeometry(size, 0)), rock);
    boulder.position.set(x, size * 0.25, z);
    boulder.scale.y = 0.55;
    root.add(boulder);
  }
  const white = keep.material(new MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6 }));
  const red = keep.material(new MeshStandardMaterial({ color: BUOY_RED, roughness: 0.6 }));
  const tower = new Mesh(keep.geometry(new CylinderGeometry(0.14, 0.2, 0.7, 16)), white);
  tower.position.y = 0.65;
  root.add(tower);
  const stripe = new Mesh(keep.geometry(new CylinderGeometry(0.165, 0.175, 0.14, 16)), red);
  stripe.position.y = 0.68;
  root.add(stripe);
  const roof = new Mesh(keep.geometry(new ConeGeometry(0.18, 0.18, 16)), red);
  roof.position.y = 1.12;
  root.add(roof);
  const lightMaterial = keep.material(new MeshBasicMaterial({ color: '#fff1b0' }));
  const light = new Mesh(keep.geometry(new CylinderGeometry(0.12, 0.12, 0.12, 12)), lightMaterial);
  light.position.y = 0.98;
  root.add(light);
  // The lamp's beam sweeps round by night; by day only the lamp glints.
  const beamMaterial = keep.material(
    new MeshBasicMaterial({
      color: new Color('#fff1b0'),
      transparent: true,
      opacity: night ? 0.22 : 0,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const beam = new Mesh(keep.geometry(new ConeGeometry(0.8, 4, 24, 1, true)), beamMaterial);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(2, 0.98, 0);
  const sweep = new Group();
  sweep.add(beam);
  root.add(sweep);

  let welcome = 0;
  return {
    root,
    update(dt, clock) {
      sweep.rotation.y = clock * 0.9;
      welcome = Math.max(0, welcome - dt);
      lightMaterial.color.set('#fff1b0').multiplyScalar((night ? 2 : 1) + welcome);
    },
    welcome() {
      welcome = 1;
    },
    dispose: keep.dispose,
  };
}

/** Pod 0 is seat 0's, pod 1 seat 1's; a shared pod is harbour yellow. */
export function createMarkerBuoys(colours: readonly string[], shared: boolean): PodFigure[] {
  return colours.map((colour, index) =>
    createMarkerBuoy(shared && index === 0 ? SHARED_POD : colour),
  );
}

function createMarkerBuoy(colour: string): PodFigure {
  const keep = createKeeper();
  const root = new Group();
  // Larger than its touching circle, so a marker buoy reads from across the room.
  root.scale.setScalar(1.5);
  const bobbing = new Group();
  root.add(bobbing);
  const paint = keep.material(new MeshStandardMaterial({ color: colour, roughness: 0.5 }));
  const white = keep.material(new MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6 }));
  const hull = new Mesh(keep.geometry(new SphereGeometry(0.26, 20, 14)), paint);
  hull.scale.y = 0.7;
  hull.position.y = 0.1;
  bobbing.add(hull);
  const belt = new Mesh(
    keep.geometry(new TorusGeometry(0.25, 0.04, 8, 28).rotateX(Math.PI / 2)),
    white,
  );
  belt.position.y = 0.12;
  bobbing.add(belt);
  const topMark = new Mesh(keep.geometry(new ConeGeometry(0.1, 0.22, 12)), paint);
  topMark.position.y = 0.42;
  bobbing.add(topMark);
  const foam = new Mesh(
    keep.geometry(new RingGeometry(0.26, 0.42, 28).rotateX(-Math.PI / 2)),
    keep.material(
      new MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    ),
  );
  foam.position.y = 0.03;
  root.add(foam);
  return {
    root,
    place(pose: PodPose) {
      root.position.set(pose.x, 0, pose.z);
      // A buoy does not tumble on water: it bobs, rocks and turns slowly as the current takes it.
      bobbing.position.y = Math.sin(pose.tumble * 3) * 0.04;
      bobbing.rotation.set(
        Math.sin(pose.tumble * 2.1) * 0.12,
        pose.tumble * 0.5,
        Math.cos(pose.tumble * 1.7) * 0.1,
      );
    },
    dispose: keep.dispose,
  };
}
