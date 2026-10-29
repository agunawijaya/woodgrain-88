/**
 * Toy Trains' watcher: a wooden toy conductor on a little station platform
 * beyond the far side of the mat, in a navy coat and peaked cap, with a
 * white moustache. He follows the trains with his eyes; when one runs into
 * track, he whips his whistle up and blows, puffing his cheeks and hopping on
 * his toes, while the toot rings out in lines round the whistle.
 */
import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { turnHeadTowards, WATCHER_SPOT, type Watcher } from '../../look/watcher.ts';

const WHISTLE_SECONDS = 1.3;
const SCALE = 2.1;

export function createConductor(options: { readonly night: boolean }): Watcher {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const paint = (colour: string, roughness = 0.45) => {
    const material = new MeshStandardMaterial({ color: colour, roughness });
    materials.push(material);
    return material;
  };
  const navy = paint('#23305c');
  const gold = paint('#d9a93b', 0.3);
  const skin = paint('#f0c39d', 0.6);
  const white = paint('#f4f1ea', 0.7);
  const black = paint('#1e1b1a', 0.4);
  const boards = paint('#c9a46c', 0.7);
  const lineMaterial = new MeshBasicMaterial({
    color: new Color('#ffffff').multiplyScalar(options.night ? 1.6 : 1),
    transparent: true,
    opacity: 0,
  });
  materials.push(lineMaterial);

  const root = new Group();
  root.name = 'conductor';
  root.position.copy(WATCHER_SPOT);
  const figure = new Group();
  figure.scale.setScalar(SCALE);
  root.add(figure);
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z = 0,
  ) => {
    const mesh = new Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  add(root, new RoundedBoxGeometry(4.2, 0.32, 2.2, 2, 0.06), boards, 0, 0.16);
  const body = new Group();
  body.position.y = 0.32 / SCALE;
  figure.add(body);
  for (const x of [-0.13, 0.13]) add(body, new CapsuleGeometry(0.11, 0.42, 4, 10), black, x, 0.32);
  add(body, new CapsuleGeometry(0.34, 0.5, 6, 16), navy, 0, 0.95);
  for (const y of [0.78, 0.95, 1.12]) add(body, new SphereGeometry(0.035, 8, 6), gold, 0, y, 0.335);

  const head = new Group();
  head.position.y = 1.62;
  body.add(head);
  add(head, new SphereGeometry(0.3, 20, 16), skin, 0, 0);
  const cheeks = [-1, 1].map((side) =>
    add(head, new SphereGeometry(0.12, 12, 10), skin, side * 0.17, -0.06, 0.18),
  );
  add(head, new SphereGeometry(0.06, 10, 8), skin, 0, 0, 0.3);
  for (const side of [-1, 1]) {
    add(head, new SphereGeometry(0.035, 8, 6), black, side * 0.1, 0.08, 0.27);
    const moustache = add(head, new SphereGeometry(0.1, 12, 8), white, side * 0.09, -0.08, 0.27);
    moustache.scale.set(1.2, 0.45, 0.6);
  }
  add(head, new CylinderGeometry(0.3, 0.3, 0.2, 24), navy, 0, 0.26);
  add(head, new CylinderGeometry(0.305, 0.305, 0.05, 24), gold, 0, 0.19);
  const visor = add(
    head,
    new CylinderGeometry(0.22, 0.22, 0.03, 20, 1, false, -Math.PI / 2, Math.PI),
    black,
    0,
    0.17,
    0.12,
  );
  visor.rotation.y = Math.PI;

  // The whistle arm: the shoulder swings up to bring the whistle to his lips.
  const shoulder = new Group();
  shoulder.position.set(0.36, 1.25, 0);
  body.add(shoulder);
  add(shoulder, new CapsuleGeometry(0.08, 0.38, 4, 10), navy, 0, -0.24);
  add(shoulder, new SphereGeometry(0.08, 10, 8), white, 0, -0.5);
  const whistle = add(shoulder, new CylinderGeometry(0.035, 0.03, 0.18, 10), gold, 0, -0.58, 0.06);
  whistle.rotation.x = Math.PI / 2;
  const otherArm = add(body, new CapsuleGeometry(0.08, 0.38, 4, 10), navy, -0.36, 1.0);
  otherArm.rotation.z = -0.15;

  const toot = new Group();
  toot.position.set(0, -0.6, 0.18);
  shoulder.add(toot);
  const lines = [-0.6, 0, 0.6].map((angle) => {
    const line = new Mesh(keep(new CapsuleGeometry(0.03, 0.22, 2, 6)), lineMaterial);
    line.rotation.z = Math.PI / 2 + angle;
    toot.add(line);
    return { line, angle };
  });
  const halo = new Mesh(keep(new TorusGeometry(0.2, 0.012, 6, 24)), lineMaterial);
  toot.add(halo);

  let whistling = Infinity;
  let target: Parameters<Watcher['follow']>[0] = null;

  return {
    root,
    follow(point) {
      target = point;
    },
    react() {
      whistling = 0;
    },
    update(dt) {
      turnHeadTowards(head, target, dt);
      whistling += dt;
      const t = whistling / WHISTLE_SECONDS;
      const raise = t < 1 ? Math.min(1, t * 6) * Math.min(1, (1 - t) * 6) : 0;
      // From hanging at his side to the whistle at his lips.
      shoulder.rotation.x = -raise * 2.1;
      shoulder.rotation.z = -raise * 0.75;
      const blowing = t > 0.15 && t < 0.85;
      const puff = blowing ? 1.25 + Math.sin(whistling * 30) * 0.05 : 1;
      for (const cheek of cheeks) cheek.scale.setScalar(puff);
      body.position.y = 0.32 / SCALE + (blowing ? Math.abs(Math.sin(whistling * 14)) * 0.08 : 0);
      lineMaterial.opacity = blowing ? 0.9 : 0;
      const ring = blowing ? (whistling * 4) % 1 : 0;
      for (const { line, angle } of lines) {
        line.position.set(
          Math.cos(angle) * (0.2 + ring * 0.25),
          Math.sin(angle) * (0.2 + ring * 0.25),
          0,
        );
      }
      halo.scale.setScalar(0.6 + ring * 1.4);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
