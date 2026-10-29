/**
 * The Neon Grid's arena: a raised platform of glass with the 40 × 20 grid
 * etched into it. By day it is white acrylic under soft studio light; by
 * night it is black glass whose etched lines glow faintly and mirror the
 * walls. A bordered arena gets a curb of light round the outer ring of
 * cells, which crashes a rider exactly like a trail; a wraparound arena gets
 * dashed gate lines at its edges instead, so the open sides read as open.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { COLUMNS, ROWS } from '../../engine/types.ts';
import { cellCentre, HALF_DEPTH, HALF_WIDTH } from '../../look/board-space.ts';
import type { SeatColours } from '../../look/look.ts';
import { START } from '../../engine/grid.ts';
import { headingYaw } from '../../look/board-space.ts';
import { WALL_HEIGHT } from './walls.ts';

/** Pixels per cell in the etched grid texture; enough for crisp lines at 1080p. */
const TEXELS_PER_CELL = 48;
const PLATFORM_MARGIN = 2.4;
const PLATFORM_THICKNESS = 0.5;
const CURB_HEIGHT = WALL_HEIGHT;

export interface NeonArena {
  readonly root: Group;
  setEdges(edges: 'bordered' | 'wraparound'): void;
  dispose(): void;
}

export function createNeonArena(options: {
  readonly night: boolean;
  readonly seats: readonly SeatColours[];
}): NeonArena {
  const { night } = options;
  const root = new Group();
  root.name = 'neon-arena';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };

  const grid = gridTexture(night, options.seats);
  textures.push(grid);
  const floor = new Mesh(
    keep(new PlaneGeometry(COLUMNS, ROWS)),
    own(
      new MeshPhysicalMaterial({
        color: night ? '#06080f' : '#c9ced8',
        map: grid,
        emissive: night ? '#ffffff' : '#000000',
        emissiveMap: night ? grid : null,
        emissiveIntensity: night ? 0.55 : 0,
        roughness: night ? 0.16 : 0.32,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: night ? 0.04 : 0.18,
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // The platform the grid is set into: a slab with a lit lip, standing on the studio floor.
  const slabMaterial = own(
    new MeshPhysicalMaterial({
      color: night ? '#0c0f18' : '#bfc5d0',
      roughness: 0.4,
      clearcoat: 0.6,
    }),
  );
  const slab = new Mesh(
    keep(
      new BoxGeometry(
        COLUMNS + PLATFORM_MARGIN * 2,
        PLATFORM_THICKNESS,
        ROWS + PLATFORM_MARGIN * 2,
      ),
    ),
    slabMaterial,
  );
  slab.position.y = -PLATFORM_THICKNESS / 2 - 0.002;
  slab.receiveShadow = true;
  root.add(slab);
  const lipColour = night ? new Color('#9aa8ff').multiplyScalar(1.1) : new Color('#c9d2e4');
  const lip = own(new MeshBasicMaterial({ color: lipColour }));
  for (const [width, depth, x, z] of [
    [COLUMNS + PLATFORM_MARGIN * 2, 0.06, 0, HALF_DEPTH + PLATFORM_MARGIN],
    [COLUMNS + PLATFORM_MARGIN * 2, 0.06, 0, -HALF_DEPTH - PLATFORM_MARGIN],
    [0.06, ROWS + PLATFORM_MARGIN * 2, HALF_WIDTH + PLATFORM_MARGIN, 0],
    [0.06, ROWS + PLATFORM_MARGIN * 2, -HALF_WIDTH - PLATFORM_MARGIN, 0],
  ] as const) {
    const strip = new Mesh(keep(new BoxGeometry(width, 0.05, depth)), lip);
    strip.position.set(x, 0.0, z);
    root.add(strip);
  }

  const studio = new Mesh(
    keep(new PlaneGeometry(400, 400)),
    own(new MeshStandardMaterial({ color: night ? '#020309' : '#b4bac6', roughness: 0.9 })),
  );
  studio.rotation.x = -Math.PI / 2;
  studio.position.y = -PLATFORM_THICKNESS;
  studio.receiveShadow = true;
  root.add(studio);

  root.add(createPylons(night, keep, own));
  const curb = createCurb(night, keep, own);
  root.add(curb);
  const gates = createGates(night, keep, own);
  root.add(gates);

  return {
    root,
    setEdges(edges) {
      curb.visible = edges === 'bordered';
      gates.visible = edges === 'wraparound';
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

/**
 * The bordered arena's wall: the outer ring of cells as a block of smoked glass, with a line of
 * light along its inner top edge, the edge a rider would hit.
 */
function createCurb(
  night: boolean,
  keep: <T extends BufferGeometry>(geometry: T) => T,
  own: <T extends Material>(material: T) => T,
): Group {
  const group = new Group();
  group.name = 'curb';
  const body = own(
    new MeshPhysicalMaterial({
      color: night ? '#0d1020' : '#9fabc2',
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: night ? '#1a1f4a' : '#000000',
      emissiveIntensity: night ? 0.5 : 0,
    }),
  );
  const edge = own(
    new MeshBasicMaterial({
      color: night
        ? new Color('#c9ceff').multiplyScalar(1.6)
        : new Color('#ffffff').multiplyScalar(1.3),
    }),
  );
  // Width, depth, centre x, centre z, and which way the inner edge lies (x, z).
  const sides: readonly (readonly [number, number, number, number, number, number])[] = [
    [COLUMNS, 1, 0, -HALF_DEPTH + 0.5, 0, 1],
    [COLUMNS, 1, 0, HALF_DEPTH - 0.5, 0, -1],
    [1, ROWS - 2, -HALF_WIDTH + 0.5, 0, 1, 0],
    [1, ROWS - 2, HALF_WIDTH - 0.5, 0, -1, 0],
  ];
  for (const [width, depth, x, z, inX, inZ] of sides) {
    const block = new Mesh(keep(new BoxGeometry(width - 0.06, CURB_HEIGHT, depth - 0.06)), body);
    block.position.set(x, CURB_HEIGHT / 2, z);
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
    const lineWidth = inX === 0 ? width - 2 : 0.07;
    const lineDepth = inZ === 0 ? depth : 0.07;
    const line = new Mesh(keep(new BoxGeometry(lineWidth, 0.04, lineDepth)), edge);
    line.position.set(x + inX * (0.5 - 0.06), CURB_HEIGHT + 0.01, z + inZ * (0.5 - 0.06));
    group.add(line);
  }
  return group;
}

/**
 * A row of light pylons standing behind the arena's far side, like the lighting rig of a studio
 * set: white columns with a strip of light down their face, lit by night.
 */
function createPylons(
  night: boolean,
  keep: <T extends BufferGeometry>(geometry: T) => T,
  own: <T extends Material>(material: T) => T,
): Group {
  const group = new Group();
  group.name = 'pylons';
  const height = 3.2;
  const column = keep(new BoxGeometry(0.7, height, 0.7));
  column.translate(0, height / 2, 0);
  const strip = keep(new BoxGeometry(0.16, height - 0.6, 0.04));
  strip.translate(0, height / 2, 0.36);
  const cap = keep(new BoxGeometry(1.1, 0.12, 1.1));
  cap.translate(0, height + 0.06, 0);
  const shell = own(
    new MeshPhysicalMaterial({
      color: night ? '#151a2c' : '#e3e7ef',
      roughness: 0.3,
      clearcoat: 0.8,
    }),
  );
  const light = own(
    new MeshBasicMaterial({
      color: night
        ? new Color('#d6d9ff').multiplyScalar(1.8)
        : new Color('#ffffff').multiplyScalar(1.15),
    }),
  );
  const z = -HALF_DEPTH - PLATFORM_MARGIN - 1.2;
  for (let x = -HALF_WIDTH; x <= HALF_WIDTH + 0.01; x += 5) {
    const pylon = new Group();
    const body = new Mesh(column, shell);
    body.castShadow = true;
    pylon.add(body, new Mesh(strip, light), new Mesh(cap, shell));
    pylon.position.set(x, -PLATFORM_THICKNESS, z);
    group.add(pylon);
  }
  return group;
}

/** Wraparound edges: dashed gate lines on the floor where a rider leaves and comes back. */
function createGates(
  night: boolean,
  keep: <T extends BufferGeometry>(geometry: T) => T,
  own: <T extends Material>(material: T) => T,
): Group {
  const group = new Group();
  group.name = 'gates';
  const material = own(
    new MeshBasicMaterial({
      color: night ? new Color('#c8ccff').multiplyScalar(1.8) : new Color('#8d9ab5'),
    }),
  );
  const dash = keep(new PlaneGeometry(0.5, 0.08));
  dash.rotateX(-Math.PI / 2);
  for (let column = 0; column < COLUMNS; column++) {
    for (const z of [-HALF_DEPTH, HALF_DEPTH]) {
      const piece = new Mesh(dash, material);
      piece.position.set(column - HALF_WIDTH + 0.5, 0.006, z);
      group.add(piece);
    }
  }
  for (let row = 0; row < ROWS; row++) {
    for (const x of [-HALF_WIDTH, HALF_WIDTH]) {
      const piece = new Mesh(dash, material);
      piece.rotation.y = Math.PI / 2;
      piece.position.set(x, 0.006, row - HALF_DEPTH + 0.5);
      group.add(piece);
    }
  }
  return group;
}

/**
 * The etched grid, with the two start cells marked by a chevron in their seat's colour. By night
 * the lines are what glows; by day they are a pale engraving in white acrylic.
 */
function gridTexture(night: boolean, seats: readonly SeatColours[]): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = COLUMNS * TEXELS_PER_CELL;
  canvas.height = ROWS * TEXELS_PER_CELL;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the grid');
  context.fillStyle = night ? '#000000' : '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = night ? '#2a3f78' : '#d3d9e6';
  context.lineWidth = 2;
  context.beginPath();
  for (let column = 0; column <= COLUMNS; column++) {
    context.moveTo(column * TEXELS_PER_CELL, 0);
    context.lineTo(column * TEXELS_PER_CELL, canvas.height);
  }
  for (let row = 0; row <= ROWS; row++) {
    context.moveTo(0, row * TEXELS_PER_CELL);
    context.lineTo(canvas.width, row * TEXELS_PER_CELL);
  }
  context.stroke();
  // Every fifth line a touch stronger, so distances can be judged at a glance.
  context.strokeStyle = night ? '#3b5aa6' : '#bfc8da';
  context.lineWidth = 3;
  context.beginPath();
  for (let column = 0; column <= COLUMNS; column += 5) {
    context.moveTo(column * TEXELS_PER_CELL, 0);
    context.lineTo(column * TEXELS_PER_CELL, canvas.height);
  }
  for (let row = 0; row <= ROWS; row += 5) {
    context.moveTo(0, row * TEXELS_PER_CELL);
    context.lineTo(canvas.width, row * TEXELS_PER_CELL);
  }
  context.stroke();
  START.forEach((start, seat) => {
    const centre = cellCentre(start.cell);
    const x = (centre.x + HALF_WIDTH) * TEXELS_PER_CELL;
    const y = (centre.z + HALF_DEPTH) * TEXELS_PER_CELL;
    const colour = seats[seat]?.main ?? '#ffffff';
    context.save();
    context.translate(x, y);
    context.rotate(-headingYaw(start.heading));
    context.strokeStyle = colour;
    context.globalAlpha = night ? 0.9 : 0.75;
    context.lineWidth = 5;
    for (const offset of [-14, 0]) {
      context.beginPath();
      context.moveTo(offset - 6, -12);
      context.lineTo(offset + 6, 0);
      context.lineTo(offset - 6, 12);
      context.stroke();
    }
    context.restore();
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = RepeatWrapping;
  return texture;
}
