/**
 * The Whirlpool's view: two subs circling a whirlpool, seen from above. The
 * current is the pull, the vortex's eye the deadly middle, harbour walls the
 * edges where subs bounce (open sea where they wrap round). Torpedoes run
 * half awash with a stream of bubbles behind them, and a hit throws up a
 * white plume of spray and a ring of foam.
 */
import { createParticleField, createRibbon } from '@woodgrain-88/arena';
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/field.ts';
import { createKeeper } from '../../look/keeper.ts';
import type { MissilePose, Seat, SpaceView, ViewMoment, ViewOptions } from '../../look/look.ts';
import {
  createSpaceView,
  type LookParts,
  type MissileFigure,
  type MissileTrail,
} from '../../look/space-rig.ts';
import { createWhirlRemix } from './remix.ts';
import { createLighthouseRock, createMarkerBuoys, createSupplyBuoy } from './stations.ts';
import { createSub } from './subs.ts';
import { createWater } from './water.ts';

const QUAY_BLOCK = 1.4;

interface FoamRing {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  age: number;
}

export function createWhirlView(options: ViewOptions): SpaceView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('whirl');
  const root = new Group();
  root.name = 'whirl';
  const vortex = options.centre === 'star' || options.centre === 'beacon';

  // Binary Stars draws two small whirlpools of its own instead of the eye in the middle.
  const water = createWater({
    night,
    vortex,
    eye: options.centre === 'star' && options.remix !== 'binary-stars',
  });
  root.add(water.mesh);
  const middle =
    options.centre === 'starbase'
      ? createSupplyBuoy(night)
      : options.centre === 'beacon'
        ? createLighthouseRock(night)
        : null;
  if (middle) root.add(middle.root);
  const remix = createWhirlRemix(options, rng.fork('remix'));
  if (remix) root.add(remix.root);
  const pods =
    options.pods === 'none'
      ? []
      : createMarkerBuoys(
          options.seats.map((colours) => colours.main),
          options.pods === 'shared',
        );

  const quay = harbourWalls(night, options.edges === 'bounce', rng);
  root.add(quay.root);

  const spray = createParticleField('smoke', 900, options.stage.lights.palette);
  const glow = createParticleField('glow', 600, options.stage.lights.palette);
  root.add(spray.mesh, glow.mesh);

  const ships = options.seats.map((colours, seat) =>
    createSub({ seat: seat as Seat, colours, night }),
  );

  const torpedoGeometry = new CapsuleGeometry(0.09, 0.45, 6, 10).rotateZ(Math.PI / 2);
  const torpedoMaterial = new MeshStandardMaterial({
    color: '#3a434e',
    roughness: 0.4,
    metalness: 0.5,
  });
  const missiles: MissileFigure[] = options.seats.map((colours) => {
    const figure = new Group();
    const body = new Mesh(torpedoGeometry, torpedoMaterial);
    body.position.y = 0.04;
    figure.add(body);
    const nose = new Mesh(
      torpedoGeometry,
      new MeshBasicMaterial({ color: new Color(colours.main).multiplyScalar(night ? 2 : 1) }),
    );
    nose.scale.set(0.3, 1.05, 1.05);
    nose.position.set(0.26, 0.04, 0);
    figure.add(nose);
    let since = 0;
    return {
      root: figure,
      place(pose: MissilePose, dt: number) {
        figure.position.set(pose.x, 0, pose.z);
        figure.rotation.y = pose.heading;
        since += dt;
        // A torpedo leaves bubbles behind it, a few every frame, rising and popping.
        while (since > 0.02) {
          since -= 0.02;
          spray.emit({
            x: pose.x + rng.float(-0.08, 0.08),
            y: 0.06,
            z: pose.z + rng.float(-0.08, 0.08),
            vy: rng.float(0.05, 0.2),
            life: rng.float(0.8, 1.6),
            size: rng.float(0.08, 0.16),
            sizeEnd: 0.03,
            colour: new Color(night ? '#7fd8d0' : '#f4fbfb'),
            alpha: night ? 0.5 : 0.85,
            alphaEnd: 0,
            seed: rng.float(0, 100),
          });
        }
      },
      dispose() {
        nose.material.dispose();
      },
    };
  });

  // The wake: a pale line of churned water that fades behind each torpedo.
  const trails: MissileTrail[] = options.seats.map((colours) => {
    const wake = new Color(night ? '#2fd6c4' : '#ffffff').lerp(new Color(colours.main), 0.2);
    const ribbon = createRibbon(
      night
        ? {
            look: 'glow',
            width: 0.16,
            widthEnd: 0.05,
            colour: wake.clone().multiplyScalar(0.9),
            alpha: 0.7,
            fade: 2.2,
            maxPoints: 240,
          }
        : {
            look: 'smoke',
            width: 0.18,
            widthEnd: 0.06,
            colour: wake,
            alpha: 0.75,
            fade: 2.2,
            maxPoints: 240,
          },
    );
    root.add(ribbon.mesh);
    const at = new Vector3();
    return {
      push(point) {
        ribbon.push(at.copy(point).setY(0.03));
      },
      release() {
        // The wake fades point by point on its own.
      },
      update(dt, camera) {
        ribbon.update(dt, camera);
      },
      dispose() {
        ribbon.mesh.removeFromParent();
      },
    };
  });

  const ringGeometry = new RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2);
  const rings: FoamRing[] = [];

  function burst(seat: Seat, at: Vector3): void {
    const shooter = new Color(options.seats[seat === 0 ? 1 : 0]?.main ?? '#ffffff');
    const material = new MeshBasicMaterial({
      color: night ? '#9ff2e8' : '#ffffff',
      transparent: true,
      depthWrite: false,
    });
    const ring = new Mesh(ringGeometry, material);
    ring.position.copy(at).setY(0.04);
    root.add(ring);
    rings.push({ mesh: ring, material, age: 0 });
    options.stage.lights.flash(at.clone().setY(0.8), shooter, night ? 20 : 8, 0.35);
    if (options.reducedEffects) return;
    for (let index = 0; index < 40; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const out = rng.float(0.5, 3);
      spray.emit({
        x: at.x,
        y: 0.1,
        z: at.z,
        vx: Math.cos(angle) * out,
        vy: rng.float(3, 7),
        vz: Math.sin(angle) * out,
        lift: -9,
        drag: 1.4,
        life: rng.float(0.6, 1.1),
        size: rng.float(0.25, 0.55),
        sizeEnd: 0.9,
        colour: new Color(night ? '#bff6ef' : '#ffffff'),
        alpha: night ? 0.55 : 0.9,
        alphaEnd: 0,
        seed: rng.float(0, 100),
      });
    }
    const hot = shooter
      .clone()
      .lerp(new Color('#ffffff'), 0.5)
      .multiplyScalar(night ? 2.5 : 1.3);
    for (let index = 0; index < 24; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(2, 6);
      glow.emit({
        x: at.x,
        y: 0.4,
        z: at.z,
        vx: Math.cos(angle) * speed,
        vy: rng.float(1, 4),
        vz: Math.sin(angle) * speed,
        lift: -8,
        drag: 1.5,
        life: rng.float(0.3, 0.6),
        size: rng.float(0.06, 0.12),
        sizeEnd: 0.02,
        colour: hot,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.03,
        fadeIn: 0,
      });
    }
  }

  /** A splash of white water: a launch, a gulp, a mooring, a catch. */
  function splash(at: Vector3, count: number, height: number, tint?: Color): void {
    const ring = new MeshBasicMaterial({
      color: tint ?? new Color(night ? '#9ff2e8' : '#ffffff'),
      transparent: true,
      depthWrite: false,
    });
    const mesh = new Mesh(ringGeometry, ring);
    mesh.position.copy(at).setY(0.04);
    root.add(mesh);
    rings.push({ mesh, material: ring, age: 0 });
    if (options.reducedEffects) return;
    for (let index = 0; index < count; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const out = rng.float(0.3, 1.5);
      spray.emit({
        x: at.x,
        y: 0.1,
        z: at.z,
        vx: Math.cos(angle) * out,
        vy: rng.float(1, height),
        vz: Math.sin(angle) * out,
        lift: -9,
        drag: 1.4,
        life: rng.float(0.4, 0.8),
        size: rng.float(0.15, 0.3),
        sizeEnd: 0.5,
        colour: new Color(night ? '#bff6ef' : '#ffffff'),
        alpha: night ? 0.5 : 0.85,
        alphaEnd: 0,
        seed: rng.float(0, 100),
      });
    }
  }

  function moment(event: ViewMoment): void {
    const own = new Color(options.seats[event.seat]?.main ?? '#ffffff');
    switch (event.kind) {
      case 'fired':
        splash(event.at, 4, 2);
        break;
      case 'swallowed':
        splash(event.at, 10, 3);
        break;
      case 'refuelled':
        middle?.welcome();
        splash(event.at, 14, 3.5);
        break;
      case 'docked':
        splash(event.at, 16, 4, own);
        options.stage.lights.flash(event.at.clone().setY(0.6), own, night ? 12 : 5, 0.3);
        break;
      default:
        break;
    }
  }

  const parts: LookParts = {
    root,
    ships,
    missiles,
    trails,
    pods,
    burst,
    moment,
    remix: (pose) => remix?.show(pose),
    update(dt, clock, camera) {
      water.update(clock);
      middle?.update(dt, clock);
      remix?.update(dt, clock, camera);
      for (const ring of [...rings]) {
        ring.age += dt;
        const t = ring.age / 1.1;
        ring.mesh.scale.setScalar(0.4 + Math.sqrt(t) * 2.6);
        ring.material.opacity = Math.max(0, 1 - t) * 0.9;
        if (t >= 1) {
          ring.mesh.removeFromParent();
          ring.material.dispose();
          rings.splice(rings.indexOf(ring), 1);
        }
      }
      spray.update(dt, camera);
      glow.update(dt, camera);
    },
    dispose() {
      water.dispose();
      middle?.dispose();
      remix?.dispose();
      quay.dispose();
      spray.dispose();
      glow.dispose();
      torpedoGeometry.dispose();
      torpedoMaterial.dispose();
      ringGeometry.dispose();
      for (const ring of rings) ring.material.dispose();
    },
  };
  return createSpaceView(options.stage.camera, parts, options.seats);
}

/**
 * Stone quays round the harbour where subs bounce: dressed blocks, each a touch different in tone
 * and height, with iron bollards along the top and a dark wet band where the water laps, edged
 * in foam. Where subs wrap round instead there are no quays: it is open sea.
 */
function harbourWalls(
  night: boolean,
  solid: boolean,
  rng: { float(min: number, max: number): number },
) {
  const root = new Group();
  const keep = createKeeper();
  if (!solid) return { root, dispose: keep.dispose };
  const block = keep.geometry(new BoxGeometry(QUAY_BLOCK, 0.6, 0.9));
  const stone = keep.material(
    new MeshStandardMaterial({ color: night ? '#646a72' : '#c4bdae', roughness: 0.9 }),
  );
  const spots: { x: number; z: number; turned: boolean; inward: number }[] = [];
  for (let x = -HALF_WIDTH - 0.7; x <= HALF_WIDTH + 0.7; x += QUAY_BLOCK) {
    spots.push(
      { x, z: -HALF_DEPTH - 0.45, turned: false, inward: 1 },
      { x, z: HALF_DEPTH + 0.45, turned: false, inward: -1 },
    );
  }
  for (let z = -HALF_DEPTH; z <= HALF_DEPTH; z += QUAY_BLOCK) {
    spots.push(
      { x: -HALF_WIDTH - 0.45, z, turned: true, inward: 1 },
      { x: HALF_WIDTH + 0.45, z, turned: true, inward: -1 },
    );
  }
  const blocks = new InstancedMesh(block, stone, spots.length);
  const scratch = new Object3D();
  const tone = new Color();
  spots.forEach((spot, index) => {
    scratch.position.set(spot.x, 0.2 + rng.float(-0.04, 0.04), spot.z);
    scratch.rotation.set(0, spot.turned ? Math.PI / 2 : 0, 0);
    scratch.scale.set(rng.float(0.9, 0.98), rng.float(0.95, 1.05), 1);
    scratch.updateMatrix();
    blocks.setMatrixAt(index, scratch.matrix);
    blocks.setColorAt(index, tone.setScalar(rng.float(0.86, 1.06)));
  });
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  root.add(blocks);

  // The wet band: a dark strip down the water side of every quay, and a line of foam along it.
  const wet = keep.material(
    new MeshStandardMaterial({ color: night ? '#262b31' : '#6f6a5f', roughness: 0.35 }),
  );
  const foam = keep.material(
    new MeshBasicMaterial({
      color: night ? '#8fe9dd' : '#ffffff',
      transparent: true,
      opacity: night ? 0.45 : 0.8,
      depthWrite: false,
    }),
  );
  const long = HALF_WIDTH * 2 + 1.8;
  const short = HALF_DEPTH * 2 + 0.2;
  for (const [x, z, length, turned] of [
    [0, -HALF_DEPTH + 0.02, long, false],
    [0, HALF_DEPTH - 0.02, long, false],
    [-HALF_WIDTH + 0.02, 0, short, true],
    [HALF_WIDTH - 0.02, 0, short, true],
  ] as const) {
    const band = new Mesh(keep.geometry(new BoxGeometry(length, 0.26, 0.05)), wet);
    band.position.set(x, 0.12, z);
    band.rotation.y = turned ? Math.PI / 2 : 0;
    root.add(band);
    const froth = new Mesh(
      keep.geometry(new PlaneGeometry(length, 0.22).rotateX(-Math.PI / 2)),
      foam,
    );
    froth.position.set(x, 0.035, z);
    froth.rotation.y = turned ? Math.PI / 2 : 0;
    root.add(froth);
  }

  // Bollards every few blocks along the top of the quay.
  const iron = keep.material(
    new MeshStandardMaterial({
      color: night ? '#2b2f36' : '#3a3f47',
      metalness: 0.6,
      roughness: 0.4,
    }),
  );
  const post = keep.geometry(new CylinderGeometry(0.11, 0.13, 0.26, 12));
  const cap = keep.geometry(new SphereGeometry(0.13, 12, 8));
  spots.forEach((spot, index) => {
    if (index % 6 !== 0) return;
    const across = spot.turned
      ? { x: -0.15 * spot.inward, z: 0 }
      : { x: 0, z: -0.15 * spot.inward };
    const bollard = new Mesh(post, iron);
    bollard.position.set(spot.x + across.x, 0.63, spot.z + across.z);
    const top = new Mesh(cap, iron);
    top.position.set(spot.x + across.x, 0.78, spot.z + across.z);
    top.scale.y = 0.6;
    root.add(bollard, top);
  });
  return {
    root,
    dispose() {
      keep.dispose();
      blocks.dispose();
    },
  };
}
