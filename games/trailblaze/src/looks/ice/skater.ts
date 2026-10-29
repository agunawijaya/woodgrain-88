/**
 * Ice Trail's skaters, our own characters: round little figures in warm
 * winter suits, gliding with one arm swept back and frost trailing from the
 * other hand. Seat 1's Juniper wears an orange suit and a bobble hat; seat
 * 2's Sorrel wears a blue suit, a hood and big earmuffs. From above, the
 * bobble and the earmuffs tell them apart.
 *
 * Touching ice sends a skater's feet out from under them: they go over
 * backwards, land flat on the ice with their skates in the air, and slide on
 * a little before they stop.
 */
import {
  CapsuleGeometry,
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
import type { RiderFigure } from '../../look/trail-rig.ts';
import { ICE_TOP } from './ice-wall.ts';

const FALL_SECONDS = 0.35;
const SLIDE_DISTANCE = 0.5;
/** Built to a cell and drawn larger, so a skater reads on a full board. */
const SKATER_SCALE = 1.45;

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
  root.add(figure);
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
      figure.position.set(0, 0, 0);
      figure.rotation.set(0, 0, 0);
      for (const leg of legs) leg.rotation.set(0, 0, 0);
    },
    update(dt) {
      if (!fallen) return;
      fallen.age += dt;
      const fall = Math.min(1, fallen.age / FALL_SECONDS);
      // Over backwards, pivoting on the skates, with a small bounce as the back meets the ice.
      const bounce =
        fall >= 1
          ? Math.abs(Math.sin((fallen.age - FALL_SECONDS) * 12)) *
            Math.exp(-(fallen.age - FALL_SECONDS) * 6) *
            0.06
          : 0;
      figure.rotation.z = fall * fall * (Math.PI / 2 - 0.12);
      figure.position.y = bounce + fall * 0.12;
      figure.position.x = SLIDE_DISTANCE * (1 - Math.exp(-fallen.age * 2.5));
      for (const leg of legs) leg.rotation.z = -fall * 0.9;
      lean.rotation.x *= 0.9;
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
    },
  };
}
