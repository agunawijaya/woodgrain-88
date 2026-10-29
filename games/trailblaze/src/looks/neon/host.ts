/**
 * The Neon Grid's watcher: the arena's host, our own character, standing on
 * a lit dais beyond the far side. She wears a sleek black bodysuit traced
 * with lines of white light and a glossy black bob, and stands with one hand
 * on her hip, following the bikes with her eyes. When a bike blows up, the
 * lines of her suit flash in the colour of the rider who scored and she
 * points at the wreck.
 */
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Crash } from '../../engine/types.ts';
import { rivalColours, type SeatColours } from '../../look/look.ts';
import { turnHeadTowards, WATCHER_SPOT, type Watcher } from '../../look/watcher.ts';

const SCALE = 2.4;
const REACTION_SECONDS = 1.6;
const LINE_RADIUS = 0.006;

interface Limb {
  readonly shoulder: Group;
  readonly elbow: Group;
}

export function createHost(options: {
  readonly night: boolean;
  readonly seats: readonly SeatColours[];
}): Watcher {
  const { night } = options;
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
  const suit = own(
    new MeshPhysicalMaterial({
      color: '#0b0c11',
      roughness: 0.28,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
  );
  const skin = own(new MeshStandardMaterial({ color: '#efcdb9', roughness: 0.55 }));
  const hair = own(new MeshPhysicalMaterial({ color: '#0a0a0d', roughness: 0.3, clearcoat: 0.8 }));
  const dark = own(new MeshStandardMaterial({ color: '#1b1418', roughness: 0.4 }));
  const lips = own(new MeshStandardMaterial({ color: '#8a2f3c', roughness: 0.45 }));
  const restingLight = new Color('#d4ecff').multiplyScalar(night ? 2.4 : 1.3);
  const light = own(new MeshBasicMaterial({ color: restingLight.clone() }));
  const glass = own(
    new MeshPhysicalMaterial({
      color: night ? '#0d1122' : '#c4cbd8',
      roughness: 0.15,
      clearcoat: 1,
    }),
  );

  const root = new Group();
  root.name = 'host';
  root.position.copy(WATCHER_SPOT);
  const dais = new Mesh(keep(new CylinderGeometry(1.5, 1.6, 0.2, 48)), glass);
  dais.position.y = 0.1;
  dais.receiveShadow = true;
  const rim = new Mesh(keep(new TorusGeometry(1.55, 0.03, 8, 64)), light);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.2;
  root.add(dais, rim);

  const figure = new Group();
  figure.position.y = 0.2;
  figure.scale.setScalar(SCALE);
  root.add(figure);
  // A touch of contrapposto: the weight on her left leg, hips tilted against the shoulders.
  const hips = new Group();
  hips.rotation.z = 0.05;
  figure.add(hips);

  const mesh = (
    geometry: BufferGeometry,
    material: Material,
    parent: Group,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const part = new Mesh(keep(geometry), material);
    part.position.set(x, y, z);
    part.castShadow = true;
    parent.add(part);
    return part;
  };
  const tube = (points: readonly [number, number, number][], parent: Group) => {
    const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
    mesh(new TubeGeometry(curve, 24, LINE_RADIUS, 6, false), light, parent);
  };

  // Legs: the left one straight and bearing her weight, the right one easy, knee forward.
  for (const side of [-1, 1]) {
    const leg = new Group();
    leg.position.set(side * 0.075, 0.92, 0);
    leg.rotation.z = side * 0.03;
    leg.rotation.x = side > 0 ? -0.08 : 0;
    hips.add(leg);
    mesh(taper(0.074, 0.052, 0.44), suit, leg, 0, -0.22);
    const shin = new Group();
    shin.position.y = -0.44;
    shin.rotation.x = side > 0 ? 0.16 : 0;
    leg.add(shin);
    mesh(new SphereGeometry(0.053, 12, 10), suit, shin);
    mesh(taper(0.05, 0.034, 0.4), suit, shin, 0, -0.2);
    const boot = mesh(new SphereGeometry(0.045, 12, 8), dark, shin, 0, -0.42, 0.035);
    boot.scale.set(0.9, 0.6, 1.8);
    tube(
      [
        [side * 0.07, 0, 0],
        [side * 0.072, -0.22, 0],
        [side * 0.056, -0.43, 0],
      ],
      leg,
    );
    tube(
      [
        [side * 0.05, 0, 0],
        [side * 0.042, -0.2, 0],
        [side * 0.034, -0.4, 0],
      ],
      shin,
    );
  }

  const torso = new Group();
  hips.add(torso);
  const body = mesh(torsoGeometry(), suit, torso);
  body.scale.z = 0.7;
  const belt = mesh(new TorusGeometry(0.108, LINE_RADIUS, 6, 40), light, torso, 0, 1.12);
  belt.rotation.x = Math.PI / 2;
  belt.scale.y = 0.7;
  tube(
    [
      [-0.13, 1.47, 0.06],
      [-0.06, 1.3, 0.098],
      [0, 1.13, 0.078],
    ],
    torso,
  );
  tube(
    [
      [0.13, 1.47, 0.06],
      [0.06, 1.3, 0.098],
      [0, 1.13, 0.078],
    ],
    torso,
  );
  const collar = mesh(new TorusGeometry(0.048, LINE_RADIUS, 6, 24), light, torso, 0, 1.55);
  collar.rotation.x = Math.PI / 2;

  const head = new Group();
  head.position.y = 1.6;
  torso.add(head);
  mesh(new CylinderGeometry(0.036, 0.04, 0.1, 12), skin, head, 0, 0.02);
  const face = mesh(new SphereGeometry(0.1, 24, 18), skin, head, 0, 0.13);
  face.scale.set(0.88, 1.12, 0.95);
  for (const side of [-1, 1]) {
    const eye = mesh(new SphereGeometry(0.014, 10, 8), dark, head, side * 0.034, 0.145, 0.085);
    eye.scale.set(1.5, 0.7, 0.6);
  }
  const mouth = mesh(new SphereGeometry(0.014, 10, 8), lips, head, 0, 0.082, 0.088);
  mouth.scale.set(1.5, 0.55, 0.6);
  // The bob: a cap over the crown and a curtain round the back and sides, open at the face.
  mesh(
    new SphereGeometry(0.114, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.34),
    hair,
    head,
    0,
    0.14,
    -0.005,
  );
  mesh(
    new SphereGeometry(
      0.118,
      28,
      12,
      Math.PI / 2 + 0.8,
      Math.PI * 2 - 1.6,
      Math.PI * 0.3,
      Math.PI * 0.34,
    ),
    hair,
    head,
    0,
    0.14,
    -0.008,
  );

  const arms = [-1, 1].map((side): Limb => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.165, 1.47, 0);
    torso.add(shoulder);
    mesh(new SphereGeometry(0.045, 12, 10), suit, shoulder);
    const ring = mesh(new TorusGeometry(0.046, LINE_RADIUS, 6, 20), light, shoulder);
    ring.rotation.y = Math.PI / 2;
    mesh(taper(0.038, 0.03, 0.27), suit, shoulder, 0, -0.135);
    tube(
      [
        [side * 0.036, 0, 0],
        [side * 0.032, -0.26, 0],
      ],
      shoulder,
    );
    const elbow = new Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    mesh(taper(0.03, 0.024, 0.24), suit, elbow, 0, -0.12);
    mesh(new SphereGeometry(0.03, 10, 8), skin, elbow, 0, -0.26);
    return { shoulder, elbow };
  });
  const [restingArm, hipArm] = arms as [Limb, Limb];
  // Her right hand on her hip: the arm out and down, the forearm folded back in.
  hipArm.shoulder.rotation.z = 0.75;
  hipArm.elbow.rotation.z = -1.9;
  restingArm.shoulder.rotation.z = -0.12;

  let target: Vector3 | null = null;
  let reaction: { age: number; at: Vector3; colour: Color } | null = null;

  return {
    root,
    follow(point) {
      target = point;
    },
    react(crash: Crash, at: Vector3) {
      const scorer = rivalColours(options.seats, crash.seat);
      reaction = {
        age: 0,
        at: at.clone(),
        colour: new Color(scorer.main).multiplyScalar(night ? 3 : 1.6),
      };
    },
    update(dt, clock) {
      const looking = reaction && reaction.age < REACTION_SECONDS ? reaction.at : target;
      turnHeadTowards(head, looking, dt);
      torso.rotation.y = head.rotation.y * 0.25;
      // A slow breath, so she never looks frozen.
      torso.position.y = Math.sin(clock * 1.6) * 0.004;
      if (reaction) {
        reaction.age += dt;
        const t = reaction.age / REACTION_SECONDS;
        const point = t < 1 ? Math.min(1, t * 5) * Math.min(1, (1 - t) * 4) : 0;
        const toward = Math.max(-1, Math.min(1, (reaction.at.x - root.position.x) / 12));
        restingArm.shoulder.rotation.x = -point * 1.35;
        restingArm.shoulder.rotation.z = -0.12 - point * 0.25 + toward * point * 0.5;
        restingArm.elbow.rotation.x = -point * 0.2;
        const flash = t < 1 ? Math.max(0, 1 - t) : 0;
        light.color.copy(restingLight).lerp(reaction.colour, Math.min(1, flash * 1.4));
        if (t >= 1) reaction = null;
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** A limb segment hanging down from its joint: wide at the top, narrower at the end. */
function taper(top: number, bottom: number, length: number): CylinderGeometry {
  return new CylinderGeometry(top, bottom, length, 14);
}

/** Hips, waist, chest and shoulders as one turned shape, from the top of the legs to the neck. */
function torsoGeometry(): LatheGeometry {
  const profile: [number, number][] = [
    [0.0, 0.88],
    [0.14, 0.9],
    [0.158, 0.98],
    [0.145, 1.05],
    [0.108, 1.15],
    [0.118, 1.25],
    [0.138, 1.36],
    [0.14, 1.43],
    [0.155, 1.48],
    [0.11, 1.53],
    [0.045, 1.56],
    [0.0, 1.565],
  ];
  return new LatheGeometry(
    profile.map(([radius, y]) => new Vector2(radius, y)),
    36,
  );
}
