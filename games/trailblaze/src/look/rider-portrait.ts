/**
 * Close-ups of a look's riders, for the pre-match cards and the game menu,
 * where the whole-board camera is too far away to show who is riding: the
 * bike and its rider, the engine, the mummy, the skater. Each portrait is the
 * look's own figure, riding slowly on the spot in a three-quarter view, its
 * wheels turning, its feet shuffling or pushing, lit by a key light and a rim
 * in its own colour.
 *
 * One small renderer of its own draws every portrait in turn and copies each
 * into its seat's canvas, so the cards cost one extra GL context, not one each.
 */
import type { Appearance } from '@woodgrain-88/kit';
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Seat } from '../engine/types.ts';
import { createSkater } from '../looks/ice/skater.ts';
import { createMummy } from '../looks/mummy/mummy.ts';
import { createBike } from '../looks/neon/bike.ts';
import { createLoco } from '../looks/trains/loco.ts';
import type { LookId, SeatColours } from './look.ts';
import type { RiderFigure } from './trail-rig.ts';

/** How fast each rider idles along, in cells a second: enough for wheels and feet to move. */
const IDLE_PACE: Readonly<Record<LookId, number>> = { neon: 2, trains: 1.4, mummy: 0.7, ice: 1.2 };
/** Where the camera looks from, relative to a rider facing +x: ahead of it, to its side, above. */
const VIEW_FROM = new Vector3(0.7, 0.32, 1).normalize();
/** How much of the frame the rider fills, edge to edge, at its widest or tallest. */
const FILL = 0.84;
/** Anything thinner than this is lying on the floor. */
const FLAT = 0.03;
const FIELD_OF_VIEW = 30;

export interface RiderPortraitOptions {
  readonly look: LookId;
  readonly appearance: Appearance;
  /** One portrait per seat, in these colours. */
  readonly seats: readonly SeatColours[];
  /** Each portrait's size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** False with reduced motion: each rider is drawn once, standing still. */
  readonly animate: boolean;
}

export interface RiderPortraits {
  /** One canvas per seat, in seat order, to place in the cards. */
  readonly canvases: readonly HTMLCanvasElement[];
  dispose(): void;
}

interface Sitter {
  readonly figure: RiderFigure;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Slides the other way as the rider rides, so it stays in frame. */
  readonly track: Group;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D | null;
  travelled: number;
}

function createFigure(look: LookId, seat: Seat, colours: SeatColours, night: boolean): RiderFigure {
  const options = { seat, colours, night };
  if (look === 'trains') return createLoco({ ...options, onPuff: () => undefined });
  if (look === 'mummy') return createMummy(options);
  if (look === 'ice') return createSkater(options);
  return createBike(options);
}

export function createRiderPortraits(options: RiderPortraitOptions): RiderPortraits {
  const night = options.appearance === 'dark';
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.round(options.width * pixelRatio);
  const height = Math.round(options.height * pixelRatio);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = night ? 1.35 : 1.25;
  renderer.setClearColor(0x000000, 0);

  const sitters = options.seats.map((colours, seat): Sitter => {
    const scene = new Scene();
    const track = new Group();
    scene.add(track);
    const figure = createFigure(options.look, seat as Seat, colours, night);
    track.add(figure.root);
    figure.ride(new Vector3(), 0, 0, 0);
    light(scene, colours, night);
    const camera = new PerspectiveCamera(FIELD_OF_VIEW, width / height, 0.05, 50);
    frame(camera, figure.root);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute('aria-hidden', 'true');
    return { figure, scene, camera, track, canvas, context: canvas.getContext('2d'), travelled: 0 };
  });

  const position = new Vector3();
  function draw(dt: number): void {
    for (const sitter of sitters) {
      sitter.travelled += dt * IDLE_PACE[options.look];
      sitter.figure.ride(position.set(sitter.travelled, 0, 0), 0, dt, 0);
      sitter.figure.update?.(dt);
      sitter.track.position.x = -sitter.travelled;
      renderer.render(sitter.scene, sitter.camera);
      sitter.context?.clearRect(0, 0, width, height);
      sitter.context?.drawImage(renderer.domElement, 0, 0);
    }
  }

  let frameId = 0;
  let last = 0;
  function loop(now: number): void {
    const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(dt);
    frameId = requestAnimationFrame(loop);
  }
  if (options.animate) frameId = requestAnimationFrame(loop);
  else draw(0);

  return {
    canvases: sitters.map((sitter) => sitter.canvas),
    dispose() {
      cancelAnimationFrame(frameId);
      for (const sitter of sitters) sitter.figure.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/** A soft sky, a warm key from the front, and a rim in the rider's own colour from behind. */
function light(scene: Scene, colours: SeatColours, night: boolean): void {
  scene.add(
    new HemisphereLight(
      night ? '#9fb0ff' : '#ffffff',
      night ? '#10131c' : '#c9cfdc',
      night ? 0.9 : 1.4,
    ),
  );
  const key = new DirectionalLight(night ? '#dfe6ff' : '#fff6ea', 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new DirectionalLight(new Color(colours.main), night ? 2.4 : 1.2);
  rim.position.set(-4, 2.5, -3);
  scene.add(rim);
}

/**
 * Points the camera at the rider from the three-quarter view and walks it in or out until the
 * rider's box fills the frame: a long bike and a tall mummy each fill it their own way.
 */
function frame(camera: PerspectiveCamera, subject: Group): void {
  const bounds = standingBounds(subject);
  const centre = bounds.getCenter(new Vector3());
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (index) =>
      new Vector3(
        index & 1 ? bounds.max.x : bounds.min.x,
        index & 2 ? bounds.max.y : bounds.min.y,
        index & 4 ? bounds.max.z : bounds.min.z,
      ),
  );
  let distance = bounds.getSize(new Vector3()).length() * 1.5;
  const onScreen = new Vector3();
  for (let pass = 0; pass < 4; pass++) {
    camera.position.copy(centre).addScaledVector(VIEW_FROM, distance);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    let reach = 0;
    for (const corner of corners) {
      onScreen.copy(corner).project(camera);
      reach = Math.max(reach, Math.abs(onScreen.x), Math.abs(onScreen.y));
    }
    distance *= reach / FILL;
  }
  camera.position.copy(centre).addScaledVector(VIEW_FROM, distance);
  camera.lookAt(centre);
}

/** The rider's own shape, leaving out what lies flat on the floor: its shadow and its ring. */
function standingBounds(subject: Group): Box3 {
  subject.updateMatrixWorld(true);
  const bounds = new Box3();
  const part = new Box3();
  subject.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    part.setFromObject(object);
    if (part.max.y - part.min.y > FLAT) bounds.union(part);
  });
  return bounds.isEmpty() ? new Box3().setFromObject(subject) : bounds;
}
