/**
 * Ice Trail's skaters, our own characters: round little figures in warm
 * winter suits, gliding with one arm swept back and frost trailing from the
 * other hand. Seat 1's Juniper wears an orange suit and a bobble hat; seat
 * 2's Sorrel wears a blue suit, a hood and big earmuffs. From above, the
 * bobble and the earmuffs tell them apart.
 *
 * Touching ice freezes a skater solid: frost creeps up from the skates to
 * the hat, the ice cracks with a burst of crystals, and the frozen figure
 * slides back off the wall to a stop, still in its skating pose.
 */
import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Crash, Seat } from '../../engine/types.ts';
import type { SeatColours } from '../../look/look.ts';
import { createRiderHalo } from '../../look/rider-halo.ts';
import type { RiderFigure } from '../../look/trail-rig.ts';
import { ICE_TOP } from './ice-wall.ts';

/** How long the frost takes to climb from the skates to the hat; the ice cracks when it gets there. */
export const FROST_SECONDS = 0.6;
/** How far the frozen figure slides back off the wall, in cells. */
const SLIDE_DISTANCE = 0.7;
/** Built to a cell and drawn larger, so each skater reads from the overhead camera. */
const SKATER_SCALE = 3.8;
/** Lowers the scaled figure so its skates stay on the ice. */
const STAND = -ICE_TOP * (SKATER_SCALE - 1);
const FROST = new Color('#bfe4ff');

export interface Skater extends RiderFigure {
  /** The trailing hand, where frost streams from, in world space. */
  handPosition(target: Vector3): Vector3;
  /** The mouth, for frosty breath. */
  breathPosition(target: Vector3): Vector3;
}

export function createSkater(options: {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}): Skater {
  const { seat } = options;
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
  const suit = own(new MeshStandardMaterial({ color: options.colours.main, roughness: 0.7 }));
  const trim = own(new MeshStandardMaterial({ color: '#f5f1ea', roughness: 0.85 }));
  const skin = own(new MeshStandardMaterial({ color: '#f0c9a6', roughness: 0.7 }));
  const dark = own(new MeshStandardMaterial({ color: '#2b2a33', roughness: 0.5 }));
  const blade = own(new MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.2, metalness: 0.9 }));
  const root = new Group();
  root.name = `skater-${seat}`;
  const figure = new Group();
  figure.scale.setScalar(SKATER_SCALE);
  figure.position.y = STAND;
  root.add(figure);
  const halo = createRiderHalo({
    colours: options.colours,
    length: 0.42 * SKATER_SCALE,
    width: 0.36 * SKATER_SCALE,
    floor: ICE_TOP,
    night: options.night,
  });
  root.add(halo.root);
  // The frost climbs in three bands: skates and legs, then the suit, then the face and hat.
  const frostBands = [[blade, dark], [suit], [trim, skin]].map((band) =>
    band.map((material) => ({
      material,
      colour: material.color.clone(),
      roughness: material.roughness,
    })),
  );
  const lean = new Group();
  figure.add(lean);
  const add = (geometry: BufferGeometry, material: Material, x: number, y: number, z = 0) => {
    const mesh = new Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    lean.add(mesh);
    return mesh;
  };

  const legs = [-1, 1].map((side) => {
    const leg = new Group();
    leg.position.set(0, ICE_TOP + 0.24, side * 0.07);
    const thigh = new Mesh(keep(new CapsuleGeometry(0.05, 0.14, 4, 8)), dark);
    thigh.position.y = -0.1;
    const boot = new Mesh(keep(new CapsuleGeometry(0.045, 0.06, 4, 8)), trim);
    boot.rotation.z = Math.PI / 2;
    boot.position.set(0.02, -0.2, 0);
    const skate = new Mesh(keep(new CylinderGeometry(0.008, 0.008, 0.18, 6)), blade);
    skate.rotation.z = Math.PI / 2;
    skate.position.set(0.02, -0.24, 0);
    leg.add(thigh, boot, skate);
    leg.traverse((child) => {
      if (child instanceof Mesh) child.castShadow = true;
    });
    lean.add(leg);
    return leg;
  });
  add(new CapsuleGeometry(0.13, 0.12, 6, 14), suit, 0, ICE_TOP + 0.42);
  const collar = add(new TorusGeometry(0.1, 0.035, 8, 18), trim, 0, ICE_TOP + 0.54);
  collar.rotation.x = Math.PI / 2;
  add(new SphereGeometry(0.11, 18, 14), skin, 0.01, ICE_TOP + 0.64);
  for (const z of [-0.04, 0.04])
    add(new SphereGeometry(0.014, 8, 6), dark, 0.11, ICE_TOP + 0.66, z);

  if (seat === 0) {
    const hat = add(
      new SphereGeometry(0.115, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      suit,
      0,
      ICE_TOP + 0.66,
    );
    hat.scale.set(1, 0.9, 1);
    add(new TorusGeometry(0.108, 0.025, 8, 20), trim, 0, ICE_TOP + 0.67).rotation.x = Math.PI / 2;
    add(new SphereGeometry(0.055, 12, 10), trim, -0.02, ICE_TOP + 0.8);
  } else {
    const hood = add(
      new SphereGeometry(0.13, 18, 12, Math.PI * 0.5, Math.PI, 0, Math.PI * 0.62),
      suit,
      -0.01,
      ICE_TOP + 0.65,
    );
    hood.rotation.y = Math.PI;
    for (const z of [-0.12, 0.12])
      add(new SphereGeometry(0.055, 12, 10), trim, 0, ICE_TOP + 0.64, z);
    add(new TorusGeometry(0.12, 0.016, 6, 20, Math.PI), dark, 0, ICE_TOP + 0.64).rotation.y =
      Math.PI / 2;
  }

  // One arm swept back for balance, the other reaching out to the side, frost streaming from it.
  const back = add(new CapsuleGeometry(0.04, 0.2, 4, 8), suit, -0.12, ICE_TOP + 0.48, -0.08);
  back.rotation.z = -1.1;
  const reach = add(new CapsuleGeometry(0.04, 0.2, 4, 8), suit, -0.02, ICE_TOP + 0.5, 0.17);
  reach.rotation.x = 1.15;
  const hand = new Vector3(-0.04, ICE_TOP + 0.47, 0.3);
  add(new SphereGeometry(0.045, 10, 8), trim, hand.x, hand.y, hand.z);

  let phase = 0;
  let fallen: { age: number } | null = null;
  const handLocal = hand.clone();
  const mouthLocal = new Vector3(0.13, ICE_TOP + 0.62, 0);

  return {
    root,
    ride(position, yaw, dt, speedStage) {
      root.position.copy(position);
      root.rotation.y = yaw;
      if (dt <= 0 || fallen) return;
      phase += dt * (5 + speedStage * 2.2);
      lean.rotation.z = -0.32 - speedStage * 0.04;
      lean.rotation.x = Math.sin(phase) * 0.12;
      legs.forEach((leg, index) => {
        leg.rotation.z = Math.max(0, Math.sin(phase + index * Math.PI)) * 0.5;
      });
    },
    crash(_crash: Crash) {
      fallen = { age: 0 };
    },
    reset() {
      fallen = null;
      figure.position.set(0, STAND, 0);
      figure.rotation.set(0, 0, 0);
      for (const leg of legs) leg.rotation.set(0, 0, 0);
      for (const band of frostBands) {
        for (const part of band) {
          part.material.color.copy(part.colour);
          part.material.emissive.setRGB(0, 0, 0);
          part.material.roughness = part.roughness;
        }
      }
    },
    update(dt) {
      if (!fallen) return;
      fallen.age += dt;
      const climbed = Math.min(1, fallen.age / FROST_SECONDS);
      frostBands.forEach((band, index) => {
        const frozen = Math.min(1, Math.max(0, climbed * frostBands.length - index));
        for (const part of band) {
          part.material.color.copy(part.colour).lerp(FROST, frozen * 0.85);
          part.material.emissive.copy(FROST).multiplyScalar(frozen * (options.night ? 0.35 : 0.08));
          // Frozen glassy and smooth, whatever the part was made of.
          part.material.roughness = part.roughness + (0.15 - part.roughness) * frozen;
        }
      });
      const sliding = Math.max(0, fallen.age - FROST_SECONDS);
      const slid = 1 - Math.exp(-sliding * 3);
      figure.position.x = -SLIDE_DISTANCE * slid;
      figure.rotation.y = 0.5 * slid;
    },
    handPosition(target) {
      return lean.localToWorld(target.copy(handLocal));
    },
    breathPosition(target) {
      return lean.localToWorld(target.copy(mouthLocal));
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      halo.dispose();
    },
  };
}
