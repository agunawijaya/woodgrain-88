/**
 * The Brass Orrery's Remix bodies: the binary pair as two small filament
 * bulbs in brass sockets, the comet as a polished brass ball drawing a bright
 * wire behind it, and the asteroid belt as cast-iron weights banded in brass.
 */
import { createRibbon, type Ribbon } from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Camera,
} from 'three';
import { createKeeper } from '../../look/keeper.ts';
import type { RemixPose, ViewOptions } from '../../look/look.ts';

const BODY_HEIGHT = 0.6;
const ROCKS = 10;

export interface BrassRemix {
  readonly root: Group;
  show(pose: RemixPose | undefined): void;
  update(dt: number, clock: number, camera: Camera): void;
  dispose(): void;
}

export function createBrassRemix(options: ViewOptions, rng: Rng): BrassRemix | null {
  const night = options.appearance === 'dark';
  if (options.remix === 'binary-stars') return bulbs(night);
  if (options.remix === 'comet') return comet(night);
  if (options.remix === 'asteroid-belt') return weights(night, rng);
  return null;
}

function bulbs(night: boolean): BrassRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'brass-binary-bulbs';
  const brass = keep.material(
    new MeshStandardMaterial({ color: '#d1a04b', metalness: 1, roughness: 0.28 }),
  );
  const glassMaterial = keep.material(
    new MeshStandardMaterial({
      color: '#fff3d0',
      emissive: new Color('#ffcf6a').multiplyScalar(night ? 2.2 : 1.1),
      roughness: 0.2,
    }),
  );
  const haloMaterial = keep.material(
    new MeshBasicMaterial({
      color: new Color('#ffcf6a'),
      transparent: true,
      opacity: night ? 0.35 : 0.2,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const figures = [0, 1].map(() => {
    const figure = new Group();
    const socket = new Mesh(keep.geometry(new CylinderGeometry(0.35, 0.42, 0.3, 24)), brass);
    socket.position.y = 0.15;
    const glass = new Mesh(keep.geometry(new SphereGeometry(0.62, 28, 20)), glassMaterial);
    glass.position.y = BODY_HEIGHT + 0.1;
    const halo = new Mesh(keep.geometry(new SphereGeometry(1.2, 24, 16)), haloMaterial);
    halo.position.y = BODY_HEIGHT + 0.1;
    const light = new PointLight('#ffcf6a', night ? 22 : 6, 10, 1.6);
    light.position.y = 1.4;
    figure.add(socket, glass, halo, light);
    root.add(figure);
    return { figure, halo };
  });
  return {
    root,
    show(pose) {
      pose?.stars?.forEach((at, index) => {
        const bulb = figures[index];
        if (!bulb) return;
        bulb.figure.position.set(at.x, 0, at.z);
        bulb.figure.scale.setScalar(at.radius / 0.8);
      });
    },
    update(_dt, clock) {
      // Two filaments on one circuit flicker together.
      const flicker = 1 + Math.sin(clock * 37) * 0.03 + Math.sin(clock * 11) * 0.04;
      for (const bulb of figures) bulb.halo.scale.setScalar(flicker);
    },
    dispose: keep.dispose,
  };
}

function comet(night: boolean): BrassRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'brass-comet';
  const ball = new Mesh(
    keep.geometry(new SphereGeometry(0.32, 24, 16)),
    keep.material(
      new MeshStandardMaterial({
        color: '#e6b85c',
        metalness: 1,
        roughness: 0.15,
        emissive: night ? '#4a3210' : '#000000',
      }),
    ),
  );
  ball.position.y = BODY_HEIGHT;
  root.add(ball);
  const wire: Ribbon = createRibbon({
    look: night ? 'glow' : 'smoke',
    width: 0.16,
    widthEnd: 0.03,
    colour: new Color('#ffd27a').multiplyScalar(night ? 2 : 1),
    colourEnd: new Color('#b8860b'),
    alpha: 0.9,
    fade: 1.8,
    maxPoints: 160,
  });
  root.add(wire.mesh);
  const at = new Vector3();
  return {
    root,
    show(pose) {
      const comet = pose?.comet ?? null;
      ball.visible = comet !== null;
      if (!comet) return;
      ball.position.set(comet.x, BODY_HEIGHT, comet.z);
      wire.push(at.set(comet.x, BODY_HEIGHT, comet.z));
    },
    update(dt, _clock, camera) {
      wire.update(dt, camera);
    },
    dispose() {
      keep.dispose();
      wire.mesh.removeFromParent();
    },
  };
}

function weights(night: boolean, rng: Rng): BrassRemix {
  const keep = createKeeper();
  const root = new Group();
  root.name = 'brass-weights';
  const iron = keep.material(
    new MeshStandardMaterial({
      color: '#3b3a3d',
      metalness: 0.7,
      roughness: 0.45,
      flatShading: true,
      emissive: night ? '#100c08' : '#000000',
    }),
  );
  const band = keep.material(
    new MeshStandardMaterial({ color: '#d1a04b', metalness: 1, roughness: 0.3 }),
  );
  const rocks = Array.from({ length: ROCKS }, () => {
    const holder = new Group();
    const body = new Mesh(keep.geometry(new DodecahedronGeometry(1, 0)), iron);
    body.scale.set(rng.float(0.85, 1.1), rng.float(0.6, 0.8), rng.float(0.85, 1.1));
    const ring = new Mesh(
      keep.geometry(new TorusGeometry(1, 0.12, 6, 20).rotateX(Math.PI / 2)),
      band,
    );
    holder.add(body, ring);
    root.add(holder);
    return { holder, spin: rng.float(-0.6, 0.6) };
  });
  return {
    root,
    show(pose) {
      pose?.rocks?.forEach((rock, index) => {
        const figure = rocks[index];
        if (!figure) return;
        figure.holder.position.set(rock.x, BODY_HEIGHT * 0.5, rock.z);
        figure.holder.scale.setScalar(rock.radius);
      });
    },
    update(dt) {
      for (const rock of rocks) rock.holder.rotation.y += rock.spin * dt;
    },
    dispose: keep.dispose,
  };
}
