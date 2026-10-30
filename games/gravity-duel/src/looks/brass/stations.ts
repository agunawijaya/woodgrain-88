/**
 * The Brass Orrery's other pieces, our own designs: the starbase, a great
 * brass gear hub turning under a smaller one, capped in enamel; the docking
 * runs' beacon, a dark lodestone on a pedestal inside a turning gimbal, whose
 * pull shows as a ring of brass light rolling out across the board; and the
 * pods, brass spheres girdled with enamel in the colour of the seat that must
 * catch them.
 */
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
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
import { gearGeometry } from './ships.ts';

const HUB_HEIGHT = 0.12;
const POD_HEIGHT = 0.5;
/** Pods are drawn larger than their touching circle so they read from across the room. */
const POD_SCALE = 1.6;
const ENAMEL_BLUE = '#1f4a86';

function brassMaterials(night: boolean) {
  return {
    brass: new MeshStandardMaterial({
      color: '#d1a04b',
      metalness: 1,
      roughness: 0.28,
      emissive: night ? '#2a1a06' : '#000000',
    }),
    dark: new MeshStandardMaterial({ color: '#80602c', metalness: 1, roughness: 0.38 }),
  };
}

export function createBrassHub(night: boolean): MiddleFigure {
  const keep = createKeeper();
  const { brass, dark } = brassMaterials(night);
  keep.material(brass);
  keep.material(dark);
  const enamel = keep.material(
    new MeshStandardMaterial({ color: ENAMEL_BLUE, roughness: 0.25, metalness: 0.1 }),
  );
  const root = new Group();
  root.name = 'brass-hub';

  const base = new Mesh(keep.geometry(new CylinderGeometry(1.0, 1.08, 0.08, 48)), dark);
  base.position.y = 0.04;
  root.add(base);
  const big = new Mesh(
    gearGeometry(0.98, (geometry) => keep.geometry(geometry)),
    brass,
  );
  big.position.y = HUB_HEIGHT;
  root.add(big);
  const small = new Mesh(
    gearGeometry(0.58, (geometry) => keep.geometry(geometry)),
    dark,
  );
  small.position.y = HUB_HEIGHT + 0.06;
  root.add(small);
  const cap = new Mesh(keep.geometry(new CylinderGeometry(0.26, 0.28, 0.12, 32)), enamel);
  cap.position.y = HUB_HEIGHT + 0.14;
  root.add(cap);
  const capRim = new Mesh(
    keep.geometry(new TorusGeometry(0.27, 0.03, 8, 40).rotateX(Math.PI / 2)),
    brass,
  );
  capRim.position.y = HUB_HEIGHT + 0.2;
  root.add(capRim);

  // Four little lamps round the cap glow warm, brighter when a craft comes home.
  const lampMaterial = keep.material(
    new MeshBasicMaterial({ color: new Color('#ffcf7a').multiplyScalar(night ? 2 : 1) }),
  );
  const lampGeometry = keep.geometry(new SphereGeometry(0.045, 10, 8));
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2;
    const lamp = new Mesh(lampGeometry, lampMaterial);
    lamp.position.set(Math.cos(angle) * 0.42, HUB_HEIGHT + 0.1, Math.sin(angle) * 0.42);
    root.add(lamp);
  }

  let rush = 0;
  let turn = 0;
  return {
    root,
    update(dt) {
      rush = Math.max(0, rush - dt * 0.8);
      turn += dt * (0.25 + rush * 3);
      big.rotation.y = turn;
      // Meshed gears turn the other way, faster by the ratio of their sizes.
      small.rotation.y = -turn * (0.98 / 0.58);
      lampMaterial.color.set('#ffcf7a').multiplyScalar((night ? 1.6 : 0.9) + rush * 1.5);
    },
    welcome() {
      rush = 1;
    },
    dispose: keep.dispose,
  };
}

export function createBrassLodestone(night: boolean): MiddleFigure {
  const keep = createKeeper();
  const { brass, dark } = brassMaterials(night);
  keep.material(brass);
  keep.material(dark);
  const root = new Group();
  root.name = 'brass-lodestone';
  // Drawn a size up from its parts, so it holds the middle as the bulb does.
  root.scale.setScalar(1.45);

  const pedestal = new Mesh(keep.geometry(new CylinderGeometry(0.22, 0.4, 0.3, 24)), dark);
  pedestal.position.y = 0.15;
  root.add(pedestal);
  const stone = new Mesh(
    keep.geometry(new IcosahedronGeometry(0.3, 0)),
    keep.material(
      new MeshStandardMaterial({
        color: '#2b2a2e',
        metalness: 0.6,
        roughness: 0.35,
        flatShading: true,
        emissive: night ? '#140f22' : '#000000',
      }),
    ),
  );
  stone.position.y = 0.62;
  root.add(stone);
  const gimbals = [0.55, 0.68].map((radius, index) => {
    const ring = new Mesh(keep.geometry(new TorusGeometry(radius, 0.03, 8, 56)), brass);
    ring.position.y = 0.62;
    ring.rotation.x = index === 0 ? Math.PI / 2 : 0.3;
    root.add(ring);
    return ring;
  });

  const ringMaterial = keep.material(
    new MeshBasicMaterial({
      color: new Color('#ffcf7a').multiplyScalar(night ? 1.1 : 0.8),
      transparent: true,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const ripple = new Mesh(
    keep.geometry(new RingGeometry(0.95, 1, 72).rotateX(-Math.PI / 2)),
    ringMaterial,
  );
  ripple.position.y = 0.03;
  root.add(ripple);

  let flare = 0;
  return {
    root,
    update(dt, clock) {
      stone.rotation.y += dt * 0.4;
      gimbals.forEach((ring, index) => {
        ring.rotation.y += dt * (index === 0 ? 0.7 : -0.5);
      });
      const phase = (clock / 2.4) % 1;
      ripple.scale.setScalar(0.6 + phase * 4.2);
      flare = Math.max(0, flare - dt);
      ringMaterial.opacity = (1 - phase) * (night ? 0.45 : 0.3) + flare * 0.3;
    },
    welcome() {
      flare = 1;
    },
    dispose: keep.dispose,
  };
}

/** Pod 0 is seat 0's, pod 1 seat 1's; a shared pod is girdled in plain enamel blue. */
export function createBrassPods(
  colours: readonly string[],
  shared: boolean,
  night: boolean,
): PodFigure[] {
  return colours.map((colour, index) =>
    createBrassPod(shared && index === 0 ? ENAMEL_BLUE : colour, night),
  );
}

function createBrassPod(colour: string, night: boolean): PodFigure {
  const keep = createKeeper();
  const { brass, dark } = brassMaterials(night);
  keep.material(brass);
  keep.material(dark);
  const root = new Group();
  const body = new Group();
  body.position.y = POD_HEIGHT;
  body.scale.setScalar(POD_SCALE);
  root.add(body);
  body.add(new Mesh(keep.geometry(new SphereGeometry(0.24, 24, 16)), brass));
  const girdle = new Mesh(
    keep.geometry(new TorusGeometry(0.245, 0.05, 10, 40).rotateX(Math.PI / 2)),
    keep.material(
      new MeshStandardMaterial({
        color: colour,
        roughness: 0.25,
        emissive: new Color(colour).multiplyScalar(night ? 0.25 : 0),
      }),
    ),
  );
  body.add(girdle);
  const meridian = new Mesh(keep.geometry(new TorusGeometry(0.25, 0.012, 6, 40)), dark);
  body.add(meridian);
  const shadow = new Mesh(
    keep.geometry(new CylinderGeometry(0.34, 0.34, 0.01, 24)),
    keep.material(new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25 })),
  );
  shadow.position.y = 0.02;
  root.add(shadow);
  return {
    root,
    place(pose: PodPose) {
      root.position.set(pose.x, 0, pose.z);
      body.rotation.set(pose.tumble * 0.9, pose.tumble * 1.3, pose.tumble * 0.4);
    },
    dispose: keep.dispose,
  };
}
