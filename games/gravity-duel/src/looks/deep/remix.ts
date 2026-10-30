/**
 * Deep Space's Remix bodies: the binary pair as two smaller living stars, the
 * comet as an icy nucleus trailing a long tail that points away from where it
 * came, and the asteroid belt as tumbling grey-brown rocks.
 */
import { createRibbon, type ParticleField, type Ribbon } from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  AdditiveBlending,
  Color,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  SphereGeometry,
  Vector3,
  type Camera,
} from 'three';
import { createKeeper } from '../../look/keeper.ts';
import type { RemixPose, ViewOptions } from '../../look/look.ts';
import { createDeepStar, STAR_RADIUS, type DeepStar } from './star.ts';

const ROCKS = 10;
const BODY_HEIGHT = 0.6;

export interface DeepRemix {
  readonly root: Group;
  show(pose: RemixPose | undefined): void;
  update(dt: number, clock: number, camera: Camera): void;
  dispose(): void;
}

export function createDeepRemix(
  options: ViewOptions,
  glow: ParticleField,
  rng: Rng,
): DeepRemix | null {
  const remix = options.remix;
  if (remix === 'binary-stars') return binaryStars(options.appearance === 'dark', glow, rng);
  if (remix === 'comet') return comet(options.appearance === 'dark');
  if (remix === 'asteroid-belt') return belt(options.appearance === 'dark', rng);
  return null;
}

function binaryStars(night: boolean, glow: ParticleField, rng: Rng): DeepRemix {
  const root = new Group();
  root.name = 'deep-binary-stars';
  const stars: DeepStar[] = [0, 1].map((index) =>
    createDeepStar({ night, glow, rng: rng.fork(`binary-${index}`) }),
  );
  for (const star of stars) root.add(star.root);
  return {
    root,
    show(pose) {
      pose?.stars?.forEach((at, index) => {
        const star = stars[index];
        if (!star) return;
        star.root.position.set(at.x, 0, at.z);
        star.root.scale.setScalar(at.radius / STAR_RADIUS);
      });
    },
    update(dt, clock, camera) {
      for (const star of stars) star.update(dt, clock, camera);
    },
    dispose() {
      for (const star of stars) star.dispose();
    },
  };
}

function comet(night: boolean): DeepRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'deep-comet';
  const head = new Group();
  root.add(head);
  const nucleus = new Mesh(
    keep.geometry(new IcosahedronGeometry(0.28, 1)),
    keep.material(
      new MeshStandardMaterial({
        color: night ? '#d8f2ff' : '#eaf6ff',
        emissive: night ? '#7fd4ff' : '#000000',
        roughness: 0.6,
        flatShading: true,
      }),
    ),
  );
  nucleus.position.y = BODY_HEIGHT;
  head.add(nucleus);
  const coma = new Mesh(
    keep.geometry(new SphereGeometry(0.7, 20, 14)),
    keep.material(
      new MeshBasicMaterial({
        color: new Color(night ? '#7fd4ff' : '#4d8fd6'),
        transparent: true,
        opacity: night ? 0.35 : 0.18,
        depthWrite: false,
        blending: night ? AdditiveBlending : NormalBlending,
      }),
    ),
  );
  coma.position.y = BODY_HEIGHT;
  head.add(coma);
  // The tail is laid behind the nucleus as it travels and fades, so it always streams back
  // along the comet's path.
  const tail: Ribbon = createRibbon(
    night
      ? {
          look: 'glow',
          width: 1.1,
          widthEnd: 0.1,
          colour: new Color('#9fe3ff').multiplyScalar(1.6),
          colourEnd: new Color('#3a6dff').multiplyScalar(0.6),
          alpha: 0.8,
          fade: 1.6,
          maxPoints: 160,
        }
      : {
          look: 'smoke',
          width: 1.1,
          widthEnd: 0.1,
          colour: new Color('#6fa8e6'),
          colourEnd: new Color('#c9dcf2'),
          alpha: 0.7,
          fade: 1.6,
          maxPoints: 160,
        },
  );
  root.add(tail.mesh);
  const at = new Vector3();
  return {
    root,
    show(pose) {
      const comet = pose?.comet ?? null;
      head.visible = comet !== null;
      if (comet) {
        head.position.set(comet.x, 0, comet.z);
        tail.push(at.set(comet.x, BODY_HEIGHT, comet.z));
      }
    },
    update(dt, clock, camera) {
      nucleus.rotation.y = clock * 0.8;
      coma.scale.setScalar(1 + Math.sin(clock * 3) * 0.06);
      tail.update(dt, camera);
    },
    dispose() {
      keep.dispose();
      tail.mesh.removeFromParent();
    },
  };
}

function belt(night: boolean, rng: Rng): DeepRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'deep-asteroid-belt';
  const stone = keep.material(
    new MeshStandardMaterial({
      color: night ? '#8a7d70' : '#7c6f62',
      roughness: 0.95,
      flatShading: true,
      emissive: night ? '#16120e' : '#000000',
    }),
  );
  const rocks = Array.from({ length: ROCKS }, (_, index) => {
    const mesh = new Mesh(keep.geometry(new DodecahedronGeometry(1, 0)), stone);
    // Each rock is squashed its own way, so the belt does not look stamped from one mould.
    mesh.scale.set(rng.float(0.8, 1.2), rng.float(0.6, 0.9), rng.float(0.8, 1.2));
    mesh.rotation.set(rng.float(0, 6), rng.float(0, 6), 0);
    const holder = new Group();
    holder.add(mesh);
    holder.position.y = BODY_HEIGHT * 0.6;
    root.add(holder);
    return { holder, mesh, spin: rng.float(0.2, 0.7) * (index % 2 === 0 ? 1 : -1) };
  });
  return {
    root,
    show(pose) {
      pose?.rocks?.forEach((rock, index) => {
        const figure = rocks[index];
        if (!figure) return;
        figure.holder.position.set(rock.x, BODY_HEIGHT * 0.6, rock.z);
        figure.holder.scale.setScalar(rock.radius);
      });
    },
    update(dt) {
      for (const rock of rocks) rock.mesh.rotation.y += rock.spin * dt;
    },
    dispose: keep.dispose,
  };
}
