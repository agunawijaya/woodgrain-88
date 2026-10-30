/**
 * What makes a rider easy to find from the overhead camera, in every look: a soft shadow right
 * under it, so it stands on the floor rather than floating over it, and a ring in its colour round
 * it, so the eye finds both riders at once on a busy board. Both lie flat on the floor and turn
 * with the rider, never with its lean.
 */
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import type { SeatColours } from './look.ts';

export interface RiderHalo {
  readonly root: Group;
  dispose(): void;
}

export interface RiderHaloOptions {
  readonly colours: SeatColours;
  /** The rider's size on the floor, in cells: along the way it faces, and across. */
  readonly length: number;
  readonly width: number;
  /** Where the floor is, below the figure's root. */
  readonly floor: number;
  /** How far the halo's centre sits behind the root, for a vehicle drawn back from its nose. */
  readonly back?: number;
  readonly night: boolean;
  /** False for a figure that carries its colour well enough itself: the shadow alone. */
  readonly ring?: boolean;
}

const RING_THICKNESS = 0.07;
const RING_SEGMENTS = 48;

export function createRiderHalo(options: RiderHaloOptions): RiderHalo {
  const root = new Group();
  root.position.set(-(options.back ?? 0), options.floor, 0);

  const shadowTexture = softShadowTexture();
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture,
    color: '#000000',
    transparent: true,
    opacity: options.night ? 0.6 : 0.45,
    depthWrite: false,
  });
  const shadowGeometry = new PlaneGeometry(options.length * 1.15, options.width * 1.3).rotateX(
    -Math.PI / 2,
  );
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.position.y = 0.006;
  shadow.renderOrder = 1;
  root.add(shadow);

  // By night the ring glows in the seat's colour; by day it is a crisp line in its deeper shade,
  // which holds on pale floors where the bright one fades.
  const ringMaterial = new MeshBasicMaterial({
    color: options.night
      ? new Color(options.colours.main).multiplyScalar(2.4)
      : new Color(options.colours.deep),
    transparent: true,
    opacity: options.night ? 0.95 : 0.85,
    depthWrite: false,
  });
  const ringGeometry = ellipseRing(options.length / 2, options.width / 2);
  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.position.y = 0.012;
  ring.renderOrder = 2;
  ring.visible = options.ring ?? true;
  root.add(ring);

  return {
    root,
    dispose() {
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
  };
}

/** A flat ring round an ellipse, the same thickness all the way round. */
function ellipseRing(halfLength: number, halfWidth: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let step = 0; step <= RING_SEGMENTS; step++) {
    const angle = (step / RING_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * halfLength, 0, sin * halfWidth);
    positions.push(cos * (halfLength + RING_THICKNESS), 0, sin * (halfWidth + RING_THICKNESS));
    if (step < RING_SEGMENTS) {
      const at = step * 2;
      indices.push(at, at + 2, at + 1, at + 1, at + 2, at + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Dark at the middle, fading to nothing at the rim. */
function softShadowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}
