/**
 * Mummy's Wrap's watcher: an old tomb priest of our own design on a stepped
 * stone dais beyond the far wall, shaven-headed, in a white linen robe with a
 * broad collar of gold and turquoise, leaning on a tall staff crowned with a
 * sun disc. He follows the mummies with his eyes. When one of them is wound
 * up, he lifts his staff and strikes it on the stone, and the sun disc glows
 * for a moment. The glow stays on the disc: nothing crosses the board, so the
 * cocoon is the only thing to watch.
 */
import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Stage } from '@woodgrain-88/arena';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { turnHeadTowards, WATCHER_SPOT, type Watcher } from '../../look/watcher.ts';

const SCALE = 2.3;
const LIFT_SECONDS = 0.3;
const STRIKE_SECONDS = 0.1;
/** How long the disc glows after the strike, fading all the while. */
const GLOW_SECONDS = 1.2;

export function createPriest(options: { readonly night: boolean; readonly stage: Stage }): Watcher {
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
  const stone = own(new MeshStandardMaterial({ color: '#cfa970', roughness: 0.85 }));
  const linen = own(new MeshStandardMaterial({ color: '#f2ece0', roughness: 0.8 }));
  const skin = own(new MeshStandardMaterial({ color: '#b97b4f', roughness: 0.6 }));
  const gold = own(new MeshStandardMaterial({ color: '#e0b23f', roughness: 0.3, metalness: 0.85 }));
  const turquoise = own(new MeshStandardMaterial({ color: '#2fa3a0', roughness: 0.4 }));
  const kohl = own(new MeshBasicMaterial({ color: '#16100b' }));
  const wood = own(new MeshStandardMaterial({ color: '#6e4a2c', roughness: 0.6 }));
  const sunGold = own(
    new MeshStandardMaterial({
      color: '#e0b23f',
      roughness: 0.3,
      metalness: 0.85,
      emissive: '#ffb347',
      emissiveIntensity: 0,
    }),
  );
  const fullGlow = night ? 1.6 : 0.8;

  const root = new Group();
  root.name = 'priest';
  root.position.copy(WATCHER_SPOT);
  const step = (width: number, depth: number, y: number) => {
    const block = new Mesh(keep(new RoundedBoxGeometry(width, 0.24, depth, 2, 0.04)), stone);
    block.position.y = y;
    block.castShadow = true;
    block.receiveShadow = true;
    root.add(block);
  };
  step(4.2, 2.4, 0.12);
  step(3.0, 1.8, 0.36);

  const figure = new Group();
  figure.position.y = 0.48;
  figure.scale.setScalar(SCALE);
  root.add(figure);
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const mesh = new Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  add(figure, robeGeometry(), linen);
  for (const x of [-0.06, 0.06]) {
    const foot = add(figure, new SphereGeometry(0.045, 10, 8), skin, x, 0.02, 0.05);
    foot.scale.set(0.8, 0.5, 1.6);
  }
  // The broad collar: rings of gold and turquoise lying on the shoulders.
  [0.17, 0.14, 0.11].forEach((radius, index) => {
    const ring = add(
      figure,
      new TorusGeometry(radius, 0.022, 6, 32),
      index % 2 === 0 ? gold : turquoise,
      0,
      1.29 - index * 0.012,
    );
    ring.rotation.x = Math.PI / 2 - 0.08;
    ring.scale.y = 0.75;
  });

  const head = new Group();
  head.position.y = 1.36;
  figure.add(head);
  add(head, new CylinderGeometry(0.045, 0.05, 0.08, 12), skin, 0, 0);
  const skull = add(head, new SphereGeometry(0.1, 22, 16), skin, 0, 0.12);
  skull.scale.set(0.92, 1.08, 1);
  for (const side of [-1, 1]) {
    const eye = add(head, new SphereGeometry(0.018, 10, 8), kohl, side * 0.036, 0.13, 0.088);
    eye.scale.set(1.8, 0.7, 0.5);
    add(head, new SphereGeometry(0.022, 8, 6), skin, side * 0.098, 0.12, 0).scale.set(0.4, 1, 0.8);
  }
  add(head, new SphereGeometry(0.016, 8, 6), skin, 0, 0.1, 0.098);

  // The staff arm: the staff stands in his right hand and rises and falls with it.
  const shoulder = new Group();
  shoulder.position.set(0.18, 1.24, 0.02);
  figure.add(shoulder);
  const upper = add(shoulder, new CylinderGeometry(0.04, 0.035, 0.28, 10), linen, 0.03, -0.13);
  upper.rotation.z = 0.2;
  const forearm = add(
    shoulder,
    new CylinderGeometry(0.034, 0.03, 0.26, 10),
    skin,
    0.08,
    -0.34,
    0.08,
  );
  forearm.rotation.x = -0.6;
  const hand = new Group();
  hand.position.set(0.09, -0.42, 0.16);
  shoulder.add(hand);
  add(hand, new SphereGeometry(0.035, 10, 8), skin);
  const staff = new Group();
  hand.add(staff);
  add(staff, new CylinderGeometry(0.018, 0.018, 1.7, 10), wood, 0, -0.1);
  const crown = new Group();
  crown.position.y = 0.78;
  staff.add(crown);
  const disc = add(crown, new CylinderGeometry(0.1, 0.1, 0.025, 28), sunGold, 0, 0.1);
  disc.rotation.x = Math.PI / 2;
  add(crown, new TorusGeometry(0.115, 0.015, 8, 28), turquoise, 0, 0.1);
  add(crown, new SphereGeometry(0.04, 12, 10), gold, 0, 0);
  const otherArm = add(figure, new CylinderGeometry(0.04, 0.032, 0.5, 10), linen, -0.2, 1.0, 0);
  otherArm.rotation.z = -0.12;

  let target: Vector3 | null = null;
  let strike: { age: number; at: Vector3; struck: boolean } | null = null;
  const crownWorld = new Vector3();

  return {
    root,
    follow(point) {
      target = point;
    },
    react(_crash, at) {
      strike = { age: 0, at: at.clone(), struck: false };
    },
    update(dt) {
      turnHeadTowards(head, strike ? strike.at : target, dt);
      if (!strike) {
        shoulder.rotation.x = 0;
        return;
      }
      strike.age += dt;
      const { age } = strike;
      const raised = LIFT_SECONDS;
      const down = raised + STRIKE_SECONDS;
      if (age < raised) {
        shoulder.rotation.x = -(age / raised) * 0.9;
      } else if (age < down) {
        shoulder.rotation.x = -0.9 + ((age - raised) / STRIKE_SECONDS) * 0.9;
      } else {
        shoulder.rotation.x = 0;
        if (!strike.struck) {
          strike.struck = true;
          crown.getWorldPosition(crownWorld);
          options.stage.lights.flash(crownWorld, '#ffd27a', night ? 4 : 1.5, 0.6);
        }
        const fading = Math.max(0, 1 - (age - down) / GLOW_SECONDS);
        sunGold.emissiveIntensity = fullGlow * fading;
        if (fading === 0) strike = null;
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** A long linen robe, narrow at the ankles and fuller at the shoulders. */
function robeGeometry(): LatheGeometry {
  const profile: [number, number][] = [
    [0, 0.02],
    [0.13, 0.03],
    [0.15, 0.4],
    [0.13, 0.75],
    [0.12, 0.95],
    [0.15, 1.18],
    [0.17, 1.25],
    [0.07, 1.32],
    [0, 1.33],
  ];
  const geometry = new LatheGeometry(
    profile.map(([radius, y]) => new Vector2(radius, y)),
    28,
  );
  geometry.scale(1, 1, 0.75);
  return geometry;
}
