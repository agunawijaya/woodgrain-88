/**
 * Deep Space's other residents, our own designs: the starbase, a slowly
 * turning ring station whose docking lights chase round its rim; the gravity
 * beacon of the docking runs, a violet orb inside three turning rings that
 * sends a ripple across the field as it pulls; and the pods, small capsules
 * banded in the colour of the seat that must catch them, tumbling as they
 * drift.
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
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

const STATION_HEIGHT = 0.4;
const STATION_TURN_SECONDS = 24;
const RIM_LIGHTS = 12;
const POD_HEIGHT = 0.5;
/** Pods are drawn larger than their touching circle so they read from across the room. */
const POD_SCALE = 1.5;
const INK = '#16203a';

export function createDeepStarbase(night: boolean): MiddleFigure {
  const kit = createKeeper();
  const root = new Group();
  root.name = 'deep-starbase';
  const turning = new Group();
  turning.position.y = STATION_HEIGHT;
  root.add(turning);

  const hull = kit.material(
    new MeshStandardMaterial({
      color: night ? '#9aa6bb' : '#f4f6fa',
      metalness: night ? 0.6 : 0.05,
      roughness: night ? 0.35 : 0.45,
      emissive: night ? '#141a26' : '#000000',
    }),
  );
  const ink = kit.material(new MeshBasicMaterial({ color: INK }));
  const deck = kit.material(
    new MeshStandardMaterial({ color: night ? '#2c3446' : '#3c4a66', roughness: 0.5 }),
  );

  const ring = kit.geometry(new TorusGeometry(0.85, 0.11, 14, 64).rotateX(Math.PI / 2));
  turning.add(new Mesh(ring, hull));
  if (!night) {
    // By day an ink line round the station, as the ships have, so it stays crisp on the pale dome.
    const rim = new Mesh(ring, ink);
    rim.scale.set(1.05, 0.6, 1.05);
    rim.position.y = -0.03;
    turning.add(rim);
  }
  const hub = kit.geometry(new CylinderGeometry(0.3, 0.34, 0.24, 28));
  turning.add(new Mesh(hub, hull));
  const hubTop = new Mesh(kit.geometry(new CylinderGeometry(0.2, 0.2, 0.26, 24)), deck);
  turning.add(hubTop);
  const spoke = kit.geometry(new BoxGeometry(0.62, 0.05, 0.07));
  const bay = kit.geometry(new BoxGeometry(0.16, 0.12, 0.22));
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
    const arm = new Mesh(spoke, deck);
    arm.position.set(Math.cos(angle) * 0.56, 0, Math.sin(angle) * 0.56);
    arm.rotation.y = -angle;
    turning.add(arm);
    const dock = new Mesh(bay, hull);
    dock.position.set(Math.cos(angle) * 0.86, 0.06, Math.sin(angle) * 0.86);
    dock.rotation.y = -angle;
    turning.add(dock);
  }

  const panel = kit.material(
    new MeshStandardMaterial({
      color: night ? '#1b3a66' : '#2a5fa8',
      metalness: 0.3,
      roughness: 0.35,
      emissive: night ? '#0c1d3a' : '#000000',
    }),
  );
  const wing = kit.geometry(new BoxGeometry(0.62, 0.03, 0.34));
  const strut = kit.geometry(new BoxGeometry(0.3, 0.04, 0.05));
  for (const side of [-1, 1]) {
    const arm = new Mesh(strut, deck);
    arm.position.set(side * 1.08, 0, 0);
    turning.add(arm);
    const array = new Mesh(wing, panel);
    array.position.set(side * 1.52, 0, 0);
    turning.add(array);
    if (!night) {
      const edge = new Mesh(wing, ink);
      edge.scale.set(1.08, 0.5, 1.14);
      edge.position.set(side * 1.52, -0.02, 0);
      turning.add(edge);
    }
  }
  const band = kit.material(
    new MeshStandardMaterial({ color: night ? '#2fbfa8' : '#14a08c', roughness: 0.4 }),
  );
  const stripe = new Mesh(
    kit.geometry(new TorusGeometry(0.85, 0.115, 6, 64, Math.PI / 2).rotateX(Math.PI / 2)),
    band,
  );
  stripe.position.y = 0.005;
  turning.add(stripe);
  const stripeOpposite = stripe.clone();
  stripeOpposite.rotation.y = Math.PI;
  turning.add(stripeOpposite);

  const lightColour = new Color(night ? '#5cf2d6' : '#0f8f7c');
  const lightGeometry = kit.geometry(new SphereGeometry(0.035, 8, 6));
  const lights: MeshBasicMaterial[] = [];
  for (let index = 0; index < RIM_LIGHTS; index++) {
    const angle = (index / RIM_LIGHTS) * Math.PI * 2;
    const material = kit.material(new MeshBasicMaterial({ color: lightColour.clone() }));
    lights.push(material);
    const light = new Mesh(lightGeometry, material);
    light.position.set(Math.cos(angle) * 0.85, 0.11, Math.sin(angle) * 0.85);
    turning.add(light);
  }
  const glowMaterial = kit.material(
    new MeshBasicMaterial({
      color: lightColour.clone().multiplyScalar(night ? 1.6 : 1),
      transparent: true,
      opacity: night ? 0.55 : 0.25,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const glow = new Mesh(kit.geometry(new CylinderGeometry(0.12, 0.12, 0.28, 20)), glowMaterial);
  turning.add(glow);

  let flare = 0;
  return {
    root,
    update(dt, clock) {
      turning.rotation.y = (clock / STATION_TURN_SECONDS) * Math.PI * 2;
      flare = Math.max(0, flare - dt * 1.5);
      // The docking lights chase round the rim, brightest at the head of the chase.
      const head = (clock * 6) % RIM_LIGHTS;
      lights.forEach((material, index) => {
        const behind = (head - index + RIM_LIGHTS) % RIM_LIGHTS;
        const lit = Math.max(0.25, 1 - behind / 4) + flare;
        material.color.copy(lightColour).multiplyScalar(night ? lit * 2.2 : 0.6 + lit * 0.5);
      });
      glowMaterial.opacity = (night ? 0.45 : 0.2) + flare * 0.4;
    },
    welcome() {
      flare = 1;
    },
    dispose: kit.dispose,
  };
}

export function createDeepBeacon(night: boolean): MiddleFigure {
  const kit = createKeeper();
  const root = new Group();
  root.name = 'deep-beacon';
  const violet = new Color(night ? '#b98cff' : '#6b4bc4');

  const core = kit.material(
    new MeshStandardMaterial({
      color: night ? '#3d2a66' : '#e9e2ff',
      emissive: night ? violet.clone().multiplyScalar(1.4) : new Color('#000000'),
      roughness: 0.3,
    }),
  );
  const orb = new Mesh(kit.geometry(new SphereGeometry(0.3, 28, 20)), core);
  orb.position.y = STATION_HEIGHT;
  root.add(orb);
  if (!night) {
    const rim = new Mesh(
      orb.geometry,
      kit.material(new MeshBasicMaterial({ color: INK, side: BackSide })),
    );
    rim.scale.setScalar(1.1);
    orb.add(rim);
  }

  const ringMaterial = kit.material(
    new MeshStandardMaterial({
      color: night ? '#d9ccff' : violet,
      emissive: night ? violet.clone().multiplyScalar(0.8) : new Color('#000000'),
      metalness: 0.4,
      roughness: 0.3,
    }),
  );
  const gimbals: Mesh[] = [0.55, 0.66, 0.77].map((radius, index) => {
    const ring = new Mesh(kit.geometry(new TorusGeometry(radius, 0.025, 8, 64)), ringMaterial);
    ring.position.y = STATION_HEIGHT;
    ring.rotation.set(index * 0.9, index * 0.6, 0);
    root.add(ring);
    return ring;
  });

  // The pull made visible: a ripple sent across the field every couple of seconds.
  const rippleMaterial = kit.material(
    new MeshBasicMaterial({
      color: violet.clone().multiplyScalar(night ? 1.2 : 1),
      transparent: true,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const ripple = new Mesh(
    kit.geometry(new RingGeometry(0.94, 1, 72).rotateX(-Math.PI / 2)),
    rippleMaterial,
  );
  ripple.position.y = 0.04;
  root.add(ripple);

  let flare = 0;
  return {
    root,
    update(dt, clock) {
      gimbals.forEach((ring, index) => {
        ring.rotation.x += dt * (0.5 + index * 0.25);
        ring.rotation.y += dt * (0.3 - index * 0.2);
      });
      const phase = (clock / 2.2) % 1;
      ripple.scale.setScalar(0.5 + phase * 4.5);
      rippleMaterial.opacity = (1 - phase) * (night ? 0.5 : 0.35);
      flare = Math.max(0, flare - dt * 1.5);
      core.emissiveIntensity = 1 + flare * 1.5;
    },
    welcome() {
      flare = 1;
    },
    dispose: kit.dispose,
  };
}

/** Pod 0 belongs to seat 0 and pod 1 to seat 1; a shared pod wears gold. */
export function createDeepPods(
  colours: readonly string[],
  shared: boolean,
  night: boolean,
): PodFigure[] {
  return colours.map((colour, index) =>
    createPod(shared && index === 0 ? '#ffc94a' : colour, night),
  );
}

function createPod(colour: string, night: boolean): PodFigure {
  const kit = createKeeper();
  const root = new Group();
  const body = new Group();
  body.position.y = POD_HEIGHT;
  body.scale.setScalar(POD_SCALE);
  root.add(body);
  const shell = kit.material(
    new MeshStandardMaterial({
      color: night ? '#c4ccd9' : '#fbfcfe',
      metalness: night ? 0.5 : 0.05,
      roughness: 0.35,
      emissive: night ? '#151b28' : '#000000',
    }),
  );
  const band = kit.material(
    new MeshStandardMaterial({
      color: colour,
      emissive: night ? new Color(colour).multiplyScalar(0.6) : new Color('#000000'),
      roughness: 0.4,
    }),
  );
  const capsule = kit.geometry(new CapsuleGeometry(0.17, 0.36, 6, 14).rotateZ(Math.PI / 2));
  body.add(new Mesh(capsule, shell));
  if (!night) {
    // A slightly larger copy turned inside out draws an ink outline from every side as it tumbles.
    const rim = new Mesh(
      capsule,
      kit.material(new MeshBasicMaterial({ color: INK, side: BackSide })),
    );
    rim.scale.setScalar(1.12);
    body.add(rim);
  }
  const belt = new Mesh(
    kit.geometry(new CylinderGeometry(0.18, 0.18, 0.12, 20).rotateZ(Math.PI / 2)),
    band,
  );
  body.add(belt);
  const tipMaterial = kit.material(new MeshBasicMaterial({ color: new Color(colour) }));
  const tip = new Mesh(kit.geometry(new SphereGeometry(0.05, 10, 8)), tipMaterial);
  tip.position.x = 0.36;
  body.add(tip);
  const base = new Color(colour);
  let blink = 0;
  return {
    root,
    place(pose: PodPose, dt: number) {
      root.position.set(pose.x, 0, pose.z);
      body.rotation.set(pose.tumble * 1.7, pose.tumble, 0);
      blink += dt;
      const on = blink % 1 < 0.18;
      tipMaterial.color.copy(base).multiplyScalar(on ? (night ? 3 : 1.4) : 0.5);
    },
    dispose: kit.dispose,
  };
}
