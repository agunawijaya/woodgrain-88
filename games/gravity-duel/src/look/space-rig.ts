/**
 * What every look does the same way: ships and missiles go where the match
 * says, each missile draws its trail behind it, and a hit ship spins for the
 * cartridge's 64 frames (four whole turns) while play goes on around it. A
 * look supplies the art: its world, its two ships, its missiles and trails,
 * and its burst.
 */
import {
  CircleGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
  type Camera,
  type Material,
} from 'three';
import {
  EXPLOSIONS,
  type GuidePose,
  type MissilePose,
  type PodPose,
  type RemixPose,
  type Seat,
  type SeatColours,
  type SceneFrame,
  type ShipPose,
  type SpaceView,
  type ViewMoment,
} from './look.ts';

/** The cartridge spins a hit ship one step a frame for 64 frames: four turns in 1.28 s. */
export const SPIN_SECONDS = 64 / 50;
const SPIN_TURNS = 4;

export interface ShipFigure {
  readonly root: Group;
  /** Every frame it is on the field: where it is, which way it faces, its engine and cloak. */
  pose(pose: ShipPose, dt: number): void;
  /** The hit spin, 0 at the hit to 1 when it ends; null when the ship is not spinning. */
  spin(progress: number | null): void;
  dispose(): void;
}

export interface MissileFigure {
  readonly root: Group;
  place(pose: MissilePose, dt: number): void;
  dispose(): void;
}

/** A docking pod: drifts where the match says and tumbles as it goes. */
export interface PodFigure {
  readonly root: Group;
  place(pose: PodPose, dt: number): void;
  dispose(): void;
}

/** What sits in the middle when it is not the star: the starbase or the beacon. */
export interface MiddleFigure {
  readonly root: Group;
  update(dt: number, clock: number): void;
  /** A ship came home (the starbase), or the pull was felt: a moment's flare. */
  welcome(): void;
  dispose(): void;
}

/** The line a missile leaves behind it: laid as it flies, fading once it is gone. */
export interface MissileTrail {
  push(point: Vector3): void;
  /** The missile is gone (it hit, expired or was swallowed): the trail fades from here. */
  release(): void;
  update(dt: number, camera: Camera): void;
  dispose(): void;
}

export interface LookParts {
  /** The world: backdrop, field, edges, the object in the middle and the look's own effects. */
  readonly root: Group;
  /** One per seat, in seat order. */
  readonly ships: readonly ShipFigure[];
  readonly missiles: readonly MissileFigure[];
  readonly trails: readonly MissileTrail[];
  /** Docking pods, pod 0 then pod 1; a look without pods yet leaves them out. */
  readonly pods?: readonly PodFigure[];
  /** The look's burst where a ship blew up (a hit, the star, its own missile, the cloak). */
  burst(seat: Seat, at: Vector3): void;
  /** Everything else the match calls out, in the look's own way (a dock, a refuel, a swallow). */
  moment?(moment: ViewMoment): void;
  /** Where the Remix channel's own bodies are now (binary stars, the comet, the belt's rocks). */
  remix?(pose: RemixPose | undefined): void;
  update(dt: number, clock: number, camera: Camera): void;
  dispose(): void;
}

interface SeatState {
  spinAge: number | null;
  missileLive: boolean;
}

interface Resting {
  readonly opacity: number;
  readonly transparent: boolean;
}

/**
 * Fades a ship as its cloak comes on or off: every material grows see-through, and the hull
 * shivers while it is between seen and gone. Fully cloaked the look hides it outright, as the
 * cartridge did; nobody sees where it is, its pilot included.
 */
function createCloakFade(root: Group): (cloak: number, clock: number) => void {
  const resting = new Map<Material, Resting>();
  let faded = false;
  const eachMaterial = (visit: (material: Material) => void) =>
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const found = object.material as Material | Material[];
      (Array.isArray(found) ? found : [found]).forEach(visit);
    });
  return (cloak, clock) => {
    if (cloak <= 0 && !faded) return;
    eachMaterial((material) => {
      let rest = resting.get(material);
      if (!rest) {
        rest = { opacity: material.opacity, transparent: material.transparent };
        resting.set(material, rest);
      }
      const transparent = cloak > 0 || rest.transparent;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = rest.opacity * (1 - cloak);
    });
    faded = cloak > 0;
    const shiver = Math.sin(clock * 70) * 0.08 * Math.sin(Math.PI * Math.min(1, cloak));
    root.scale.set(1 + shiver, 1, 1 - shiver);
  };
}

const GUIDE_DOTS = 48;
const GUIDE_HEIGHT = 0.07;

interface GuideDots {
  readonly root: Group;
  show(guide: GuidePose | null): void;
  dispose(): void;
}

/**
 * One seat's trajectory guide as two dotted lines in its colour: larger dots where the ship will
 * drift, smaller ones where a missile would fly. Both fade toward their far end, as a forecast
 * should.
 */
function createGuideDots(colour: string): GuideDots {
  const root = new Group();
  root.name = 'trajectory-guide';
  const scratch = new Object3D();
  const lines = [0.09, 0.05].map((radius) => {
    const geometry = new CircleGeometry(radius, 12).rotateX(-Math.PI / 2);
    const material = new MeshBasicMaterial({
      color: new Color(colour),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const dots = new InstancedMesh(geometry, material, GUIDE_DOTS);
    dots.count = 0;
    dots.frustumCulled = false;
    root.add(dots);
    return { geometry, material, dots };
  });

  function place(dots: InstancedMesh, points: readonly { x: number; z: number }[]): void {
    const count = Math.min(GUIDE_DOTS, points.length);
    for (let index = 0; index < count; index++) {
      const point = points[index];
      if (!point) continue;
      scratch.position.set(point.x, GUIDE_HEIGHT, point.z);
      scratch.scale.setScalar(1 - (index / Math.max(1, count)) * 0.6);
      scratch.updateMatrix();
      dots.setMatrixAt(index, scratch.matrix);
    }
    dots.count = count;
    dots.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    show(guide) {
      const [ship, missile] = lines;
      if (ship) place(ship.dots, guide?.ship ?? []);
      if (missile) place(missile.dots, guide?.missile ?? []);
    },
    dispose() {
      for (const line of lines) {
        line.geometry.dispose();
        line.material.dispose();
        line.dots.dispose();
      }
    },
  };
}

export function createSpaceView(
  camera: Camera,
  parts: LookParts,
  seatColours: readonly SeatColours[],
): SpaceView {
  const root = new Group();
  root.name = 'space-view';
  root.add(parts.root);
  for (const ship of parts.ships) root.add(ship.root);
  for (const missile of parts.missiles) root.add(missile.root);
  for (const pod of parts.pods ?? []) root.add(pod.root);
  const guides = seatColours.map((colours) => createGuideDots(colours.main));
  for (const guide of guides) root.add(guide.root);
  const seats: SeatState[] = parts.ships.map(() => ({ spinAge: null, missileLive: false }));
  const cloakFades = parts.ships.map((ship) => createCloakFade(ship.root));
  const head = new Vector3();
  let lastDt = 0;
  let lastClock = 0;

  function showShip(seat: number, pose: ShipPose | null): void {
    const ship = parts.ships[seat];
    const state = seats[seat];
    if (!ship || !state) return;
    ship.root.visible = pose !== null;
    if (!pose) return;
    const progress = state.spinAge === null ? null : Math.min(1, state.spinAge / SPIN_SECONDS);
    const turned = progress === null ? 0 : progress * SPIN_TURNS * Math.PI * 2;
    ship.pose(
      { ...pose, heading: pose.heading + turned, thrusting: pose.thrusting && progress === null },
      lastDt,
    );
    ship.spin(progress);
    cloakFades[seat]?.(pose.cloak, lastClock);
  }

  function showMissile(seat: number, pose: MissilePose | null): void {
    const missile = parts.missiles[seat];
    const trail = parts.trails[seat];
    const state = seats[seat];
    if (!missile || !trail || !state) return;
    missile.root.visible = pose !== null;
    if (pose) {
      missile.place(pose, lastDt);
      trail.push(head.set(pose.x, 0, pose.z));
    } else if (state.missileLive) {
      trail.release();
    }
    state.missileLive = pose !== null;
  }

  function showPod(index: number, pose: PodPose | null): void {
    const pod = parts.pods?.[index];
    if (!pod) return;
    pod.root.visible = pose !== null;
    if (pose) pod.place(pose, lastDt);
  }

  return {
    root,
    show(frame: SceneFrame) {
      frame.ships.forEach((pose, seat) => showShip(seat, pose));
      frame.missiles.forEach((pose, seat) => showMissile(seat, pose));
      frame.pods.forEach((pose, index) => showPod(index, pose));
      guides.forEach((guide, seat) => guide.show(frame.guides?.[seat] ?? null));
      parts.remix?.(frame.remix);
    },
    moment(moment) {
      if (EXPLOSIONS.has(moment.kind)) {
        const state = seats[moment.seat];
        if (state) state.spinAge = 0;
        parts.burst(moment.seat, moment.at);
      }
      parts.moment?.(moment);
    },
    update(dt, clock) {
      lastDt = dt;
      lastClock = clock;
      for (const state of seats) {
        if (state.spinAge === null) continue;
        state.spinAge += dt;
        if (state.spinAge >= SPIN_SECONDS) state.spinAge = null;
      }
      for (const trail of parts.trails) trail.update(dt, camera);
      parts.update(dt, clock, camera);
    },
    dispose() {
      for (const ship of parts.ships) ship.dispose();
      for (const missile of parts.missiles) missile.dispose();
      for (const trail of parts.trails) trail.dispose();
      for (const pod of parts.pods ?? []) pod.dispose();
      for (const guide of guides) guide.dispose();
      parts.dispose();
    },
  };
}
