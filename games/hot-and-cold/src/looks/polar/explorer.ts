/**
 * A Polar explorer: a small round figure in a team-coloured parka with a fur
 * ruff, snow goggles, a pack and a pennant on a tall whip so each team reads
 * from across the field. Built from lathes and primitives, posed by hand:
 * walking swings the legs and arms, probing crouches and plants a probe pole,
 * cheering throws both arms up, and a tumble curls the explorer up for the
 * sled ride home. By night a lantern hangs from the left mitten.
 */
import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  BufferGeometry,
  Float32BufferAttribute,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SeatColours } from '../../look/look.ts';

export type ExplorerPose = 'stand' | 'walk' | 'probe' | 'cheer' | 'tumble';

export interface Explorer {
  readonly root: Group;
  /** Turns to face a direction: radians about the vertical, 0 facing north (up the field). */
  face(yaw: number, immediately?: boolean): void;
  setPose(pose: ExplorerPose): void;
  readonly pose: ExplorerPose;
  setLantern(lit: boolean): void;
  update(dt: number): void;
  dispose(): void;
}

/** The figure is modelled about 2.2 units tall and shown larger, so it reads from across the field. */
const SCALE = 1.45;
const HIP = 0.5;
const SHOULDER = 1.22;
const HOOD_CENTRE = 1.66;

export function createExplorer(colours: SeatColours, seed: number): Explorer {
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
  const mesh = (geometry: BufferGeometry, material: Material): Mesh => {
    const part = new Mesh(keep(geometry), material);
    part.castShadow = true;
    part.receiveShadow = true;
    return part;
  };

  const parka = own(new MeshStandardMaterial({ color: colours.main, roughness: 0.82 }));
  const parkaDeep = own(new MeshStandardMaterial({ color: colours.deep, roughness: 0.8 }));
  const fur = own(new MeshStandardMaterial({ color: '#f1e6d2', roughness: 1 }));
  const trousers = own(new MeshStandardMaterial({ color: '#2d3342', roughness: 0.85 }));
  const boots = own(new MeshStandardMaterial({ color: '#4a3326', roughness: 0.7 }));
  const skin = own(new MeshStandardMaterial({ color: '#e0a985', roughness: 0.7 }));
  const strap = own(new MeshStandardMaterial({ color: '#1b1f27', roughness: 0.5 }));
  const lens = own(
    new MeshStandardMaterial({
      color: '#ffb23e',
      roughness: 0.1,
      metalness: 0.4,
      emissive: new Color('#ff9a2a'),
      emissiveIntensity: 0.25,
    }),
  );
  const pack = own(new MeshStandardMaterial({ color: '#8b7b55', roughness: 0.85 }));
  const mat = own(new MeshStandardMaterial({ color: '#3d7f86', roughness: 0.8 }));
  const pole = own(new MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.5 }));
  const pennant = own(
    new MeshStandardMaterial({ color: colours.main, roughness: 0.7, side: DoubleSide }),
  );

  const root = new Group();
  root.name = 'explorer';
  root.scale.setScalar(SCALE);
  const turnable = new Group();
  root.add(turnable);
  const body = new Group();
  body.position.y = HIP;
  turnable.add(body);

  // The parka: a bell from the hem to the shoulders, with a fur hem.
  const coat = mesh(
    new LatheGeometry(
      [
        new Vector2(0.0, -0.08),
        new Vector2(0.5, -0.08),
        new Vector2(0.54, 0.02),
        new Vector2(0.5, 0.3),
        new Vector2(0.46, 0.58),
        new Vector2(0.4, 0.74),
        new Vector2(0.26, 0.86),
        new Vector2(0.0, 0.9),
      ],
      28,
    ),
    parka,
  );
  body.add(coat);
  const hem = mesh(new TorusGeometry(0.52, 0.07, 8, 28), fur);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.04;
  body.add(hem);
  // A zip and pocket flaps in the deeper shade, so the coat has a front.
  const zip = mesh(new RoundedBoxGeometry(0.07, 0.7, 0.05, 2, 0.02), parkaDeep);
  zip.position.set(0, 0.36, -0.47);
  zip.rotation.x = -0.08;
  body.add(zip);
  for (const side of [-1, 1]) {
    const flap = mesh(new RoundedBoxGeometry(0.22, 0.08, 0.05, 2, 0.02), parkaDeep);
    flap.position.set(side * 0.26, 0.2, -0.47);
    flap.rotation.set(-0.12, side * 0.35, 0);
    body.add(flap);
  }

  // The hood, with the ruff framing a face behind goggles.
  const head = new Group();
  head.position.y = HOOD_CENTRE - HIP;
  body.add(head);
  const hood = mesh(new SphereGeometry(0.47, 28, 18), parka);
  hood.scale.set(1, 0.98, 1.02);
  head.add(hood);
  const face = mesh(new SphereGeometry(0.3, 20, 14), skin);
  face.scale.set(1, 0.95, 0.6);
  face.position.set(0, -0.03, -0.3);
  head.add(face);
  const ruff = mesh(ruffGeometry(seed), fur);
  ruff.position.set(0, -0.02, -0.36);
  head.add(ruff);
  // The goggle strap runs round the hood at eye height.
  const band = mesh(new TorusGeometry(0.475, 0.026, 6, 36), strap);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.04;
  head.add(band);
  for (const side of [-1, 1]) {
    const goggle = mesh(new SphereGeometry(0.095, 14, 10), lens);
    goggle.scale.set(1, 0.82, 0.5);
    goggle.position.set(side * 0.12, 0.04, -0.47);
    head.add(goggle);
    const rim = mesh(new TorusGeometry(0.095, 0.022, 6, 16), strap);
    rim.position.set(side * 0.12, 0.04, -0.47);
    rim.scale.set(1, 0.82, 1);
    head.add(rim);
  }
  const bobble = mesh(new SphereGeometry(0.09, 12, 8), fur);
  bobble.position.set(0, 0.47, 0.04);
  head.add(bobble);

  // The pack, its rolled mat, and the pennant whip that marks the team from afar.
  const backpack = mesh(new RoundedBoxGeometry(0.66, 0.68, 0.36, 3, 0.1), pack);
  backpack.position.set(0, 0.42, 0.44);
  body.add(backpack);
  const roll = mesh(new CylinderGeometry(0.14, 0.14, 0.82, 14), mat);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.86, 0.46);
  body.add(roll);
  const whip = mesh(new CylinderGeometry(0.018, 0.024, 1.75, 6), pole);
  whip.position.set(0.24, 1.42, 0.56);
  whip.rotation.z = -0.05;
  body.add(whip);
  const flag = mesh(pennantGeometry(), pennant);
  flag.position.set(0.28, 2.18, 0.56);
  body.add(flag);

  // Arms hang from the shoulders; the left mitten can carry a lantern, the right a probe.
  const arms = ([-1, 1] as const).map((side) => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.4, SHOULDER - HIP, 0);
    const sleeve = mesh(new CapsuleGeometry(0.12, 0.34, 6, 12), parka);
    sleeve.position.y = -0.24;
    shoulder.add(sleeve);
    const cuff = mesh(new TorusGeometry(0.12, 0.045, 6, 14), fur);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.43;
    shoulder.add(cuff);
    const mitten = mesh(new SphereGeometry(0.14, 14, 10), parkaDeep);
    mitten.position.y = -0.53;
    mitten.scale.set(1, 1.1, 0.9);
    shoulder.add(mitten);
    shoulder.rotation.z = side * 0.18;
    body.add(shoulder);
    return shoulder;
  });
  const [leftArm, rightArm] = arms as [Group, Group];

  const probe = mesh(new CylinderGeometry(0.022, 0.022, 1.5, 6), pole);
  probe.position.set(0, -1.1, 0);
  probe.visible = false;
  rightArm.add(probe);

  const lantern = new Group();
  lantern.position.set(0, -0.72, 0);
  const cage = mesh(new CylinderGeometry(0.1, 0.12, 0.22, 8, 1, true), strap);
  const glass = new Mesh(
    keep(new SphereGeometry(0.085, 12, 8)),
    own(
      new MeshStandardMaterial({
        color: '#ffd28a',
        emissive: new Color('#ffb24a'),
        emissiveIntensity: 5,
      }),
    ),
  );
  const lanternLight = new PointLight('#ffb35c', 0, 7, 1.6);
  lanternLight.position.y = 0.1;
  lantern.add(cage, glass, lanternLight);
  lantern.visible = false;
  leftArm.add(lantern);

  // Legs pivot at the hips under the coat.
  const legs = ([-1, 1] as const).map((side) => {
    const hip = new Group();
    hip.position.set(side * 0.2, HIP, 0);
    const leg = mesh(new CapsuleGeometry(0.13, 0.22, 6, 12), trousers);
    leg.position.y = -0.22;
    hip.add(leg);
    const boot = mesh(new RoundedBoxGeometry(0.26, 0.18, 0.38, 2, 0.07), boots);
    boot.position.set(0, -0.42, -0.05);
    hip.add(boot);
    turnable.add(hip);
    return hip;
  });
  const [leftLeg, rightLeg] = legs as [Group, Group];

  let pose: ExplorerPose = 'stand';
  let phase = seed % 7;
  let poseBlend = 0;
  let yaw = 0;
  let targetYaw = 0;
  let time = 0;

  function apply(dt: number): void {
    time += dt;
    // Turn along the shortest way round.
    const turnBy = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
    yaw += turnBy * Math.min(1, dt * 12);
    turnable.rotation.y = yaw;

    poseBlend = Math.min(1, poseBlend + dt * 8);
    const walking = pose === 'walk' ? 1 : 0;
    if (walking) phase += dt * 9.5;
    const swing = Math.sin(phase) * 0.6 * walking;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.7;
    rightArm.rotation.x = swing * 0.7;
    body.position.y = HIP + Math.abs(Math.sin(phase)) * 0.07 * walking;
    body.rotation.x = -0.08 * walking;
    body.rotation.z = 0;
    leftArm.rotation.z = -0.18;
    rightArm.rotation.z = 0.18;
    probe.visible = false;
    turnable.position.y = 0;
    turnable.rotation.x = 0;
    turnable.rotation.z = 0;
    head.rotation.set(0, 0, 0);

    if (pose === 'stand') {
      // Breathing: a slow rise and fall, and a glance round now and then.
      body.position.y = HIP + Math.sin(time * 2.1 + seed) * 0.012;
      head.rotation.y =
        Math.sin(time * 0.7 + seed) * 0.25 * Math.max(0, Math.sin(time * 0.31 + seed));
    } else if (pose === 'probe') {
      const k = poseBlend;
      body.position.y = HIP - 0.14 * k;
      body.rotation.x = -0.38 * k;
      leftLeg.rotation.x = -0.5 * k;
      rightLeg.rotation.x = 0.35 * k;
      rightArm.rotation.x = -0.95 * k;
      leftArm.rotation.x = -0.35 * k;
      head.rotation.x = 0.22 * k;
      probe.visible = k > 0.5;
    } else if (pose === 'cheer') {
      const hop = Math.max(0, Math.sin(time * 9));
      turnable.position.y = hop * 0.22;
      leftArm.rotation.z = -2.7;
      rightArm.rotation.z = 2.7;
      leftArm.rotation.x = Math.sin(time * 18) * 0.15;
      rightArm.rotation.x = -Math.sin(time * 18) * 0.15;
      head.rotation.x = -0.25;
      body.rotation.z = Math.sin(time * 9) * 0.06;
    } else if (pose === 'tumble') {
      turnable.rotation.x = Math.sin(time * 11) * 0.5;
      turnable.rotation.z = Math.cos(time * 9) * 0.4;
      leftArm.rotation.z = -1.4;
      rightArm.rotation.z = 1.4;
      leftLeg.rotation.x = -0.9;
      rightLeg.rotation.x = -0.6;
      body.position.y = HIP - 0.1;
    }
    // The pennant ripples whatever the explorer is doing.
    flag.rotation.y = Math.sin(time * 6 + seed) * 0.35;
  }

  apply(0);

  return {
    root,
    get pose() {
      return pose;
    },
    face(next, immediately = false) {
      targetYaw = next;
      if (immediately) yaw = next;
    },
    setPose(next) {
      if (next === pose) return;
      pose = next;
      poseBlend = 0;
    },
    setLantern(lit) {
      lantern.visible = lit;
      lanternLight.intensity = lit ? 9 : 0;
      lens.emissiveIntensity = lit ? 0.9 : 0.25;
    },
    update: apply,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** The fur ruff round the face: a fat ring with tufts, shaggier than a plain torus. */
function ruffGeometry(seed: number): BufferGeometry {
  const geometry = new TorusGeometry(0.31, 0.11, 10, 36);
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const angle = Math.atan2(y, x);
    const tuft = 1 + 0.12 * Math.sin(angle * 23 + seed) * Math.sin(angle * 7 - seed);
    const ring = Math.hypot(x, y);
    const out = 0.31 + (ring - 0.31) * tuft;
    position.setXYZ(index, (x / ring) * out, (y / ring) * out, z * tuft);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A swallow-tailed pennant hanging from the whip's tip, flying towards +x. */
function pennantGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  // Two triangles make the swallow tail: from the pole to a notched end.
  const vertices = [
    0, 0.14, 0, 0.62, 0.1, 0, 0.44, 0, 0, 0, 0.14, 0, 0.44, 0, 0, 0, -0.14, 0, 0, -0.14, 0, 0.44, 0,
    0, 0.62, -0.1, 0,
  ];
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
