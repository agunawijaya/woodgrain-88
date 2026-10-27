/**
 * Each team's base camp beside its home corner: a polar pyramid tent in the
 * team's colour, its poles crossing out of the peak and its skirt banked
 * with snow; a sled loaded with crates; skis planted upright; and a lantern
 * on a post that is lit after dark. The same sled design carries a bombed
 * explorer home.
 */
import {
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeatColours } from '../../look/look.ts';

export type Own = <T extends Material>(material: T) => T;
export type Keep = <T extends BufferGeometry>(geometry: T) => T;

export interface Camp {
  readonly root: Group;
  update(time: number): void;
}

/** Corner to centre of the tent's square base. */
const TENT_REACH = 2.3;
const TENT_HEIGHT = 3.0;

export function buildCamp(colours: SeatColours, night: boolean, own: Own, keep: Keep): Camp {
  const root = new Group();
  root.name = 'camp';
  const snow = own(
    new MeshStandardMaterial({ color: night ? '#dfe8f6' : '#f7fbff', roughness: 0.95 }),
  );
  const wood = own(new MeshStandardMaterial({ color: '#9b6a3c', roughness: 0.7 }));
  const cord = own(new MeshStandardMaterial({ color: '#e9dcc0', roughness: 0.9 }));

  root.add(pyramidTent(colours, night, snow, wood, own, keep));

  // Guy lines from each face of the tent out to wooden pegs.
  for (let corner = 0; corner < 4; corner++) {
    const angle = (corner / 4) * Math.PI * 2 + Math.PI / 4;
    const along = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const from = along
      .clone()
      .multiplyScalar(TENT_REACH * 0.56)
      .setY(TENT_HEIGHT * 0.44);
    const to = along.clone().multiplyScalar(TENT_REACH + 1.2);
    root.add(strand(from, to, 0.02, cord, keep));
    const peg = new Mesh(keep(new CylinderGeometry(0.04, 0.05, 0.36, 5)), wood);
    peg.position.copy(to).setY(0.12);
    root.add(peg);
  }

  const sled = buildSled(own, keep, colours);
  sled.position.set(2.7, 0, 2.2);
  sled.rotation.y = 0.5;
  loadSled(sled, own, keep);
  root.add(sled);

  const skis = plantedSkis(colours, own, keep);
  skis.position.set(-2.7, 0, 1.0);
  root.add(skis);

  const lantern = lanternPost(night, own, keep);
  lantern.root.position.set(0.4, 0, 3.1);
  root.add(lantern.root);

  return {
    root,
    update(time) {
      lantern.flicker(time);
    },
  };
}

/**
 * The pyramid tent: four flat faces that each take the light differently, poles crossing out of
 * the peak, a sleeve door on the face towards the field and a skirt of snow over the valance.
 */
function pyramidTent(
  colours: SeatColours,
  night: boolean,
  snow: Material,
  wood: Material,
  own: Own,
  keep: Keep,
): Group {
  const tent = new Group();
  const fabric = own(
    new MeshStandardMaterial({
      color: colours.main,
      roughness: 0.8,
      flatShading: true,
      emissive: new Color(colours.main),
      emissiveIntensity: night ? 0.14 : 0,
    }),
  );
  const body = new Mesh(keep(new ConeGeometry(TENT_REACH, TENT_HEIGHT, 4, 3)), fabric);
  body.position.y = TENT_HEIGHT / 2;
  // Turned an eighth so the faces, not the corners, look along the axes.
  body.rotation.y = Math.PI / 4;
  body.castShadow = true;
  body.receiveShadow = true;
  tent.add(body);

  // A darker band of reinforcing tape up each seam, and the poles crossing out of the peak.
  const seam = own(new MeshStandardMaterial({ color: colours.deep, roughness: 0.75 }));
  for (let corner = 0; corner < 4; corner++) {
    const angle = (corner / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = new Vector3(Math.sin(angle) * TENT_REACH, 0.02, Math.cos(angle) * TENT_REACH);
    tent.add(strand(foot, new Vector3(0, TENT_HEIGHT, 0), 0.05, seam, keep));
    tent.add(
      strand(
        new Vector3(0, TENT_HEIGHT - 0.3, 0),
        new Vector3(-Math.sin(angle) * 0.35, TENT_HEIGHT + 0.45, -Math.cos(angle) * 0.35),
        0.04,
        wood,
        keep,
      ),
    );
  }

  // Snow banked along each side of the skirt.
  for (let side = 0; side < 4; side++) {
    const angle = (side / 4) * Math.PI * 2;
    const reach = TENT_REACH * Math.SQRT1_2 + 0.1;
    const bank = new Mesh(keep(new CapsuleGeometry(0.36, TENT_REACH * 1.15, 6, 12)), snow);
    bank.position.set(Math.sin(angle) * reach, 0.04, Math.cos(angle) * reach);
    bank.rotation.set(0, angle, Math.PI / 2);
    bank.scale.set(0.5, 1, 1);
    bank.castShadow = true;
    bank.receiveShadow = true;
    tent.add(bank);
  }

  // The sleeve door on the face turned towards +z, lamplit from inside by night.
  const out = new Vector3(0, 0.3, 1).normalize();
  const sleeve = new Mesh(
    keep(new CylinderGeometry(0.46, 0.5, 0.55, 18, 1, true)),
    own(new MeshStandardMaterial({ color: colours.deep, roughness: 0.8, side: DoubleSide })),
  );
  sleeve.position.set(0, 0.66, TENT_REACH * Math.SQRT1_2 * 0.72);
  sleeve.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), out);
  tent.add(sleeve);
  const opening = new Mesh(
    keep(new CircleGeometry(0.44, 18)),
    own(
      new MeshStandardMaterial({
        color: night ? '#ffcf7a' : '#2e2622',
        emissive: new Color('#ffb04a'),
        emissiveIntensity: night ? 1.4 : 0,
        roughness: 0.9,
      }),
    ),
  );
  opening.position.copy(sleeve.position).add(out.clone().multiplyScalar(0.27));
  opening.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), out);
  tent.add(opening);
  return tent;
}

/** A thin cord or pole between two points. */
function strand(from: Vector3, to: Vector3, radius: number, material: Material, keep: Keep): Mesh {
  const length = from.distanceTo(to);
  const mesh = new Mesh(keep(new CylinderGeometry(radius, radius, length, 4)), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.copy(
    new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize()),
  );
  return mesh;
}

/** A wooden sled with curled runners in the team's colour: the ride home after a bomb. */
export function buildSled(own: Own, keep: Keep, colours: SeatColours): Group {
  const sled = new Group();
  const wood = own(
    new MeshStandardMaterial({ color: '#b98350', roughness: 0.6, side: DoubleSide }),
  );
  const runner = own(
    new MeshStandardMaterial({ color: colours.deep, roughness: 0.4, metalness: 0.3 }),
  );
  const slats = Array.from({ length: 5 }, (_, slat) =>
    new PlaneGeometry(0.72, 0.2).rotateX(-Math.PI / 2).translate(0, 0.32, -0.62 + slat * 0.31),
  );
  const deck = new Mesh(keep(mergeGeometries(slats)), wood);
  for (const slat of slats) slat.dispose();
  deck.castShadow = true;
  sled.add(deck);
  for (const side of [-0.32, 0.32]) {
    const curve = new CatmullRomCurve3([
      new Vector3(side, 0.05, 0.85),
      new Vector3(side, 0.03, 0.2),
      new Vector3(side, 0.03, -0.6),
      new Vector3(side, 0.12, -0.92),
      new Vector3(side, 0.42, -0.98),
      new Vector3(side, 0.5, -0.82),
    ]);
    const rail = new Mesh(keep(new TubeGeometry(curve, 24, 0.04, 5)), runner);
    rail.castShadow = true;
    sled.add(rail);
    for (const along of [-0.5, 0.1, 0.6]) {
      const post = new Mesh(keep(new CylinderGeometry(0.03, 0.03, 0.3, 5)), wood);
      post.position.set(side, 0.17, along);
      sled.add(post);
    }
  }
  return sled;
}

/** Two crates and a canvas bundle lashed onto a camp sled. */
function loadSled(sled: Group, own: Own, keep: Keep): void {
  const crate = own(new MeshStandardMaterial({ color: '#8d6a43', roughness: 0.75 }));
  const canvas = own(new MeshStandardMaterial({ color: '#b9ad8a', roughness: 0.9 }));
  const box = keep(new RoundedBoxGeometry(0.6, 0.38, 0.5, 2, 0.04));
  const first = new Mesh(box, crate);
  first.position.set(0, 0.52, 0.32);
  const second = new Mesh(box, crate);
  second.position.set(0.02, 0.88, 0.3);
  second.rotation.y = 0.2;
  const bundle = new Mesh(keep(new CapsuleGeometry(0.2, 0.45, 4, 10)), canvas);
  bundle.rotation.z = Math.PI / 2;
  bundle.position.set(0, 0.55, -0.3);
  for (const part of [first, second, bundle]) {
    part.castShadow = true;
    sled.add(part);
  }
}

/** A pair of skis and their poles stuck upright in the snow. */
function plantedSkis(colours: SeatColours, own: Own, keep: Keep): Group {
  const group = new Group();
  const ski = own(new MeshStandardMaterial({ color: colours.deep, roughness: 0.45 }));
  const metal = own(
    new MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.35, metalness: 0.7 }),
  );
  const board = keep(new RoundedBoxGeometry(0.16, 2.2, 0.05, 2, 0.02));
  ([-0.12, 0.12] as const).forEach((offset, index) => {
    const part = new Mesh(board, ski);
    part.position.set(offset, 1.0, 0);
    part.rotation.z = index === 0 ? 0.12 : -0.08;
    part.castShadow = true;
    group.add(part);
  });
  const pole = keep(new CylinderGeometry(0.025, 0.025, 1.7, 5));
  ([0.45, 0.62] as const).forEach((offset, index) => {
    const part = new Mesh(pole, metal);
    part.position.set(offset, 0.8, 0.1);
    part.rotation.z = index === 0 ? -0.18 : -0.3;
    part.castShadow = true;
    group.add(part);
  });
  return group;
}

/** A post with a hanging lantern; after dark it lights the camp's snow. */
function lanternPost(
  night: boolean,
  own: Own,
  keep: Keep,
): { root: Group; flicker(time: number): void } {
  const root = new Group();
  const wood = own(new MeshStandardMaterial({ color: '#7d5634', roughness: 0.75 }));
  const iron = own(new MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.5, metalness: 0.6 }));
  const glass = own(
    new MeshStandardMaterial({
      color: night ? '#ffe2a8' : '#c9b48a',
      emissive: new Color('#ffb54d'),
      emissiveIntensity: night ? 4 : 0,
      roughness: 0.2,
    }),
  );
  const post = new Mesh(keep(new CylinderGeometry(0.07, 0.09, 2.6, 7)), wood);
  post.position.y = 1.3;
  post.castShadow = true;
  const arm = new Mesh(keep(new CylinderGeometry(0.04, 0.04, 0.7, 5)), wood);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.3, 2.45, 0);
  const cage = new Mesh(keep(new CylinderGeometry(0.15, 0.17, 0.32, 8, 1, true)), iron);
  cage.position.set(0.58, 2.12, 0);
  const flame = new Mesh(keep(new SphereGeometry(0.12, 12, 8)), glass);
  flame.position.set(0.58, 2.1, 0);
  root.add(post, arm, cage, flame);
  const light = night ? new PointLight('#ffb15e', 7, 11, 1.6) : null;
  if (light) {
    light.position.set(0.58, 2.0, 0.2);
    root.add(light);
  }
  return {
    root,
    flicker(time) {
      if (light) light.intensity = 7 * (0.9 + 0.1 * Math.sin(time * 7.3) * Math.sin(time * 2.9));
    },
  };
}
