/**
 * The Neon Grid's light walls, in the style everyone knows from light-cycle
 * duels: a tall, sheer ribbon of coloured light standing on its edge, its top
 * edge burning brightest, a fine bright line along its foot, and the body in
 * between a glowing translucent pane. The ribbon follows the bike's own line,
 * so it sweeps round every turn in a smooth curve. By night the walls are
 * pure light, adding up where they cross and pooling on the black glass; by
 * day they are panes of deep coloured light standing on white.
 *
 * The newest stretch, still being drawn behind the bike, burns hotter than
 * the rest. After a crash the crashed rider's walls flicker.
 *
 * The bike is drawn about three cells long over its own wall, which stays
 * inside its body. The pool of light on the floor waits until the bike has
 * passed, so the newest cells do not light up a box of floor round the bike;
 * it comes out under the tail with the wall, and shows in full when the bike
 * breaks up.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  NormalBlending,
  SRGBColorSpace,
  Vector2,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import type { Cell, Seat } from '../../engine/types.ts';
import type { Crossing } from '../../look/crossing.ts';
import type { SeatColours } from '../../look/look.ts';
import { sweepSection } from '../../look/sweep.ts';
import { createSweptTrail, type SweptLayer } from '../../look/swept-trail.ts';
import type { TrailPieces } from '../../look/trail-rig.ts';

export const WALL_HEIGHT = 0.82;
const WALL_THICKNESS = 0.07;
const SPILL_WIDTH = 1.3;
/** Laid cells whose pool of light waits under the bike: it covers the cell it is crossing and two more. */
const POOLS_UNDER_BIKE = 2;

/** The ribbon's section: up one face, across the top, down the other; v runs foot (0) to top (1). */
const RIBBON = [
  new Vector2(-WALL_THICKNESS / 2, 0),
  new Vector2(-WALL_THICKNESS / 2, WALL_HEIGHT),
  new Vector2(WALL_THICKNESS / 2, WALL_HEIGHT),
  new Vector2(WALL_THICKNESS / 2, 0),
];
const RIBBON_V = [0, 0.985, 0.985, 0];
/** The pool of light on the floor: a flat band across the wall's line. */
const SPILL = [new Vector2(-SPILL_WIDTH / 2, 0.004), new Vector2(SPILL_WIDTH / 2, 0.004)];

export interface NeonWallsOptions {
  readonly seats: readonly SeatColours[];
  readonly night: boolean;
}

export interface NeonWalls extends TrailPieces {
  readonly meshes: readonly Object3D[];
  /** How brightly a seat's walls burn: 1 steady, lower and flickering after its crash. */
  setFlicker(seat: Seat, strength: number): void;
  /** The bike is gone: the light it was riding over pools on the floor at once. */
  uncover(seat: Seat): void;
}

export function createNeonWalls(options: NeonWallsOptions): NeonWalls {
  const { night } = options;
  const materials: Material[] = [];
  const textures: Texture[] = [ribbonTexture(night), acrossTexture()];
  const [ribbon, across] = textures as [Texture, Texture];
  const brightness = night ? 1.8 : 1;
  const blending = night ? AdditiveBlending : NormalBlending;

  const seatWalls = options.seats.map((colours) => {
    // By day the deep shade holds its own on white; by night the bright one is pure light.
    const base = new Color(night ? colours.main : colours.deep);
    const wall = new MeshBasicMaterial({
      color: base.clone().multiplyScalar(brightness),
      map: ribbon,
      transparent: true,
      side: DoubleSide,
      depthWrite: !night,
      blending,
    });
    const hot = wall.clone();
    hot.color = base
      .clone()
      .lerp(new Color('#ffffff'), 0.35)
      .multiplyScalar(night ? 3 : 1.15);
    const spill = new MeshBasicMaterial({
      color: base,
      alphaMap: across,
      transparent: true,
      opacity: night ? 0.3 : 0.28,
      depthWrite: false,
      side: DoubleSide,
      blending,
    });
    materials.push(wall, hot, spill);
    const poolLayer: SweptLayer = {
      build: (path) => sweepSection(path, SPILL, { closed: false }),
      material: spill,
      onTail: false,
    };
    const wallLayer: SweptLayer = {
      build: (path) => sweepSection(path, RIBBON, { sectionV: RIBBON_V }),
      material: wall,
      tailMaterial: hot,
      castShadow: !night,
    };
    return { poolLayer, wallLayer, wall, base };
  });
  // The floor pools first, so the walls stand on their light.
  const pools = createSweptTrail({ seats: seatWalls.map((walls) => [walls.poolLayer]) });
  const ribbons = createSweptTrail({ seats: seatWalls.map((walls) => [walls.wallLayer]) });
  const underBike = new Map<Seat, Crossing[]>();
  const waiting = (seat: Seat): Crossing[] => {
    const list = underBike.get(seat) ?? [];
    underBike.set(seat, list);
    return list;
  };

  return {
    meshes: [...pools.meshes, ...ribbons.meshes],
    addCell(seat, crossing, laidAt) {
      ribbons.addCell(seat, crossing, laidAt);
      const list = waiting(seat);
      list.push(crossing);
      while (list.length > POOLS_UNDER_BIKE) {
        const passed = list.shift();
        if (passed) pools.addCell(seat, passed, laidAt);
      }
    },
    removeCell(cell: Cell) {
      ribbons.removeCell(cell);
      pools.removeCell(cell);
      for (const list of underBike.values()) {
        const index = list.findIndex((crossing) => crossing.cell === cell);
        if (index >= 0) list.splice(index, 1);
      }
    },
    setTail(seat, crossing, progress) {
      ribbons.setTail(seat, crossing, progress);
    },
    clear() {
      ribbons.clear();
      pools.clear();
      underBike.clear();
    },
    uncover(seat) {
      for (const crossing of waiting(seat)) pools.addCell(seat, crossing, 0);
      underBike.delete(seat);
    },
    setFlicker(seat, strength) {
      const walls = seatWalls[seat];
      walls?.wall.color.copy(walls.base).multiplyScalar(brightness * strength);
    },
    dispose() {
      ribbons.dispose();
      pools.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

/** The ribbon from foot (v = 0) to top edge (v = 1): a bright foot line, a glowing body, a hot edge. */
function ribbonTexture(night: boolean): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the light wall');
  const gradient = context.createLinearGradient(0, 128, 0, 0);
  const body = night ? 0.42 : 0.72;
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.04, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.07, `rgba(200,200,200,${body})`);
  gradient.addColorStop(0.6, `rgba(170,170,170,${body})`);
  gradient.addColorStop(0.9, `rgba(230,230,230,${body + 0.15})`);
  gradient.addColorStop(0.94, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,1)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A band of light across the wall's line: bright along it and gone at both sides. */
function acrossTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the floor glow');
  const gradient = context.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(0.5, '#ffffff');
  gradient.addColorStop(1, '#000000');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 64);
  return new CanvasTexture(canvas);
}
