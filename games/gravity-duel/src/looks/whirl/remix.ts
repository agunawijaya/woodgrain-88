/**
 * The Whirlpool's Remix bodies: the binary pair as two small whirlpools, dark
 * eyes in turning rings of foam; the comet as a whale gliding across the
 * harbour, dragging the water with it and leaving a broad wake; and the belt
 * as rocks breaking the surface, each in its own collar of foam.
 */
import { createRibbon, type Ribbon } from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Vector3,
  type Camera,
} from 'three';
import { createKeeper } from '../../look/keeper.ts';
import type { RemixPose, ViewOptions } from '../../look/look.ts';

const ROCKS = 10;

export interface WhirlRemix {
  readonly root: Group;
  show(pose: RemixPose | undefined): void;
  update(dt: number, clock: number, camera: Camera): void;
  dispose(): void;
}

export function createWhirlRemix(options: ViewOptions, rng: Rng): WhirlRemix | null {
  const night = options.appearance === 'dark';
  if (options.remix === 'binary-stars') return eddies(night);
  if (options.remix === 'comet') return whale(night);
  if (options.remix === 'asteroid-belt') return rocks(night, rng);
  return null;
}

/** A whirlpool seen from above: a dark eye, then streaks of foam spiralling in, on a canvas. */
function eddyTexture(night: boolean): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the eddy');
  const centre = size / 2;
  const eye = context.createRadialGradient(centre, centre, 0, centre, centre, centre);
  eye.addColorStop(0, night ? 'rgba(0,0,0,1)' : 'rgba(0,30,45,1)');
  eye.addColorStop(0.32, night ? 'rgba(0,10,16,0.9)' : 'rgba(10,70,90,0.85)');
  eye.addColorStop(1, 'rgba(0,40,60,0)');
  context.fillStyle = eye;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = night ? 'rgba(130,240,225,0.75)' : 'rgba(255,255,255,0.85)';
  context.lineCap = 'round';
  for (let arm = 0; arm < 3; arm++) {
    context.lineWidth = 5 - arm;
    context.beginPath();
    for (let step = 0; step < 60; step++) {
      const turn = step / 60;
      const angle = arm * ((Math.PI * 2) / 3) + turn * Math.PI * 2.4;
      const radius = centre * (0.95 - turn * 0.62);
      const x = centre + Math.cos(angle) * radius;
      const y = centre + Math.sin(angle) * radius;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  return new CanvasTexture(canvas);
}

function eddies(night: boolean): WhirlRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'whirl-binary-eddies';
  const texture = eddyTexture(night);
  const material = keep.material(
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  const discs = [0, 1].map(() => {
    const disc = new Mesh(keep.geometry(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), material);
    disc.position.y = 0.03;
    root.add(disc);
    return disc;
  });
  return {
    root,
    show(pose) {
      pose?.stars?.forEach((at, index) => {
        const disc = discs[index];
        if (!disc) return;
        disc.position.set(at.x, 0.03, at.z);
        disc.scale.setScalar(at.radius * 4.5);
      });
    },
    update(_dt, clock) {
      for (const disc of discs) disc.rotation.y = -clock * 1.6;
    },
    dispose() {
      keep.dispose();
      texture.dispose();
    },
  };
}

function whale(night: boolean): WhirlRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'whirl-whale';
  const body = new Group();
  root.add(body);
  const skin = keep.material(
    new MeshStandardMaterial({ color: night ? '#1b3550' : '#2e4f73', roughness: 0.5 }),
  );
  const belly = keep.material(
    new MeshStandardMaterial({ color: night ? '#5f7f9a' : '#9fb8cc', roughness: 0.6 }),
  );
  const hull = new Mesh(
    keep.geometry(new CapsuleGeometry(0.55, 2.6, 8, 16).rotateZ(Math.PI / 2)),
    skin,
  );
  hull.scale.set(1, 0.45, 1);
  hull.position.y = 0.08;
  body.add(hull);
  const pale = new Mesh(
    keep.geometry(new CapsuleGeometry(0.4, 1.8, 6, 12).rotateZ(Math.PI / 2)),
    belly,
  );
  pale.scale.set(1, 0.3, 0.6);
  pale.position.set(0.3, 0.12, 0);
  body.add(pale);
  for (const side of [-1, 1]) {
    const fluke = new Mesh(keep.geometry(new ConeGeometry(0.35, 0.9, 3)), skin);
    fluke.rotation.set(Math.PI / 2, 0, side * 0.9 + Math.PI / 2);
    fluke.scale.set(1, 1, 0.3);
    fluke.position.set(-2.0, 0.1, side * 0.35);
    body.add(fluke);
  }
  const wake: Ribbon = createRibbon({
    look: night ? 'glow' : 'smoke',
    width: 1.6,
    widthEnd: 3,
    colour: new Color(night ? '#2fd6c4' : '#ffffff').multiplyScalar(night ? 0.8 : 1),
    alpha: night ? 0.45 : 0.6,
    fade: 2.4,
    maxPoints: 200,
  });
  root.add(wake.mesh);
  const at = new Vector3();
  let surfacing = 0;
  return {
    root,
    show(pose) {
      const comet = pose?.comet ?? null;
      body.visible = comet !== null;
      if (!comet) return;
      body.position.set(comet.x, 0, comet.z);
      body.rotation.y = comet.heading;
      wake.push(at.set(comet.x, 0.03, comet.z));
    },
    update(dt, clock, camera) {
      surfacing += dt;
      // The whale rolls gently as it swims, its tail beating slowly.
      body.rotation.x = Math.sin(clock * 1.2) * 0.08;
      hull.position.y = 0.08 + Math.sin(surfacing * 0.9) * 0.04;
      wake.update(dt, camera);
    },
    dispose() {
      keep.dispose();
      wake.mesh.removeFromParent();
    },
  };
}

function rocks(night: boolean, rng: Rng): WhirlRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'whirl-rocks';
  const stone = keep.material(
    new MeshStandardMaterial({
      color: night ? '#4f5156' : '#7a756c',
      roughness: 0.95,
      flatShading: true,
    }),
  );
  const foam = keep.material(
    new MeshBasicMaterial({
      color: night ? '#9ff2e8' : '#ffffff',
      transparent: true,
      opacity: night ? 0.5 : 0.75,
      depthWrite: false,
    }),
  );
  const figures = Array.from({ length: ROCKS }, () => {
    const holder = new Group();
    const boulder = new Mesh(keep.geometry(new DodecahedronGeometry(1, 0)), stone);
    boulder.scale.set(rng.float(0.85, 1.15), rng.float(0.4, 0.6), rng.float(0.85, 1.15));
    boulder.rotation.y = rng.float(0, 6);
    const collar = new Mesh(
      keep.geometry(new RingGeometry(1.05, 1.5, 28).rotateX(-Math.PI / 2)),
      foam,
    );
    collar.position.y = 0.02;
    holder.add(boulder, collar);
    root.add(holder);
    return holder;
  });
  return {
    root,
    show(pose) {
      pose?.rocks?.forEach((rock, index) => {
        const holder = figures[index];
        if (!holder) return;
        holder.position.set(rock.x, 0, rock.z);
        holder.scale.setScalar(rock.radius);
      });
    },
    update(_dt, clock) {
      foam.opacity = (night ? 0.45 : 0.7) + Math.sin(clock * 2.2) * 0.08;
    },
    dispose: keep.dispose,
  };
}
