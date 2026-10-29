/**
 * Toy Trains' world: a quilted play mat on a planked floor. The mat is
 * printed with a little town of our own (roads, a pond, a park, rooftops)
 * in soft colours that stay behind the bright track, and a faint quilting
 * stitch marks every cell. A bordered arena is walled in by a row of
 * wooden building blocks; a wraparound arena has tunnel mouths painted at
 * its open edges instead.
 *
 * By day sunlight falls across the floor from a window; by night the room
 * is dark but for a night light by the wall and the trains' own headlamps.
 */
import { bakeSurface, repeatSurface, tableWoodRecipe, type SurfaceMaps } from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLUMNS, ROWS } from '../../engine/types.ts';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/board-space.ts';
import { MAT_TOP } from './track.ts';

const TEXELS_PER_CELL = 48;
const BLOCK_HEIGHT = 0.5;
/** Natural woods and soft enamel for the blocks: never the seats' orange or blue. */
const BLOCK_COLOURS = [
  '#e9cf9f',
  '#d8b47c',
  '#f3e5c6',
  '#9fbf8f',
  '#e6d3a8',
  '#c9a46c',
  '#efdcae',
  '#b9cfa0',
];

export interface Playroom {
  readonly root: Group;
  setEdges(edges: 'bordered' | 'wraparound'): void;
  dispose(): void;
}

export function createPlayroom(options: { readonly night: boolean; readonly rng: Rng }): Playroom {
  const { night } = options;
  const root = new Group();
  root.name = 'playroom';
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

  const wood: SurfaceMaps = repeatSurface(bakeSurface(tableWoodRecipe(17)), 6, 6);
  textures.push(wood.map, wood.normalMap, wood.roughnessMap);
  const floor = new Mesh(
    keep(new PlaneGeometry(90, 60)),
    own(
      new MeshStandardMaterial({
        map: wood.map,
        normalMap: wood.normalMap,
        roughnessMap: wood.roughnessMap,
        color: night ? '#8c7a6a' : '#e7cfb3',
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const print = matTexture(options.rng);
  textures.push(print);
  const mat = new Mesh(
    keep(new BoxGeometry(COLUMNS + 0.6, MAT_TOP, ROWS + 0.6)),
    own(new MeshStandardMaterial({ color: '#8fae84', roughness: 0.95 })),
  );
  const top = new Mesh(
    keep(new PlaneGeometry(COLUMNS, ROWS)),
    own(new MeshStandardMaterial({ map: print, roughness: 0.92 })),
  );
  mat.position.y = MAT_TOP / 2;
  mat.receiveShadow = true;
  top.rotation.x = -Math.PI / 2;
  top.position.y = MAT_TOP + 0.001;
  top.receiveShadow = true;
  root.add(mat, top);

  const blocks = createBlocks(keep, own, options.rng);
  root.add(blocks);
  const tunnels = createTunnels(keep, own);
  root.add(tunnels);

  if (night) root.add(createNightLight(keep, own));

  return {
    root,
    setEdges(edges) {
      blocks.visible = edges === 'bordered';
      tunnels.visible = edges === 'wraparound';
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

type Keep = <T extends BufferGeometry>(geometry: T) => T;
type Own = <T extends Material>(material: T) => T;

/** One wooden block on every border cell, each a little off true, like a child lined them up. */
function createBlocks(keep: Keep, own: Own, rng: Rng): Group {
  const group = new Group();
  group.name = 'blocks';
  const cells: [number, number][] = [];
  for (let column = 0; column < COLUMNS; column++) cells.push([column, 0], [column, ROWS - 1]);
  for (let row = 1; row < ROWS - 1; row++) cells.push([0, row], [COLUMNS - 1, row]);
  const geometry = keep(new RoundedBoxGeometry(0.9, BLOCK_HEIGHT, 0.9, 3, 0.07));
  const material = own(new MeshStandardMaterial({ roughness: 0.62 }));
  const mesh = new InstancedMesh(geometry, material, cells.length);
  const placer = new Object3D();
  cells.forEach(([column, row], index) => {
    placer.position.set(
      column - HALF_WIDTH + 0.5 + rng.float(-0.03, 0.03),
      MAT_TOP + BLOCK_HEIGHT / 2,
      row - HALF_DEPTH + 0.5 + rng.float(-0.03, 0.03),
    );
    placer.rotation.y = rng.float(-0.08, 0.08);
    placer.updateMatrix();
    mesh.setMatrixAt(index, placer.matrix);
    mesh.setColorAt(index, new Color(BLOCK_COLOURS[index % BLOCK_COLOURS.length]));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** Tunnel mouths along the open edges of a wraparound mat, each facing in towards the board. */
function createTunnels(keep: Keep, own: Own): Group {
  const group = new Group();
  group.name = 'tunnels';
  const arch = keep(new RoundedBoxGeometry(0.9, 0.34, 0.24, 2, 0.08));
  const stone = own(new MeshStandardMaterial({ color: '#b9ab95', roughness: 0.8 }));
  const mouth = keep(new PlaneGeometry(0.6, 0.24));
  const dark = own(new MeshBasicMaterial({ color: '#1d1a17' }));
  const place = (x: number, z: number, yaw: number) => {
    const piece = new Group();
    const body = new Mesh(arch, stone);
    body.position.y = MAT_TOP + 0.17;
    body.castShadow = true;
    const hole = new Mesh(mouth, dark);
    hole.position.set(0, MAT_TOP + 0.12, 0.121);
    piece.add(body, hole);
    piece.position.set(x, 0, z);
    piece.rotation.y = yaw;
    group.add(piece);
  };
  for (let column = 2; column < COLUMNS; column += 4) {
    place(column - HALF_WIDTH + 0.5, -HALF_DEPTH - 0.12, 0);
    place(column - HALF_WIDTH + 0.5, HALF_DEPTH + 0.12, Math.PI);
  }
  for (let row = 2; row < ROWS; row += 4) {
    place(-HALF_WIDTH - 0.12, row - HALF_DEPTH + 0.5, Math.PI / 2);
    place(HALF_WIDTH + 0.12, row - HALF_DEPTH + 0.5, -Math.PI / 2);
  }
  return group;
}

/** A crescent-moon night light standing on the floor beyond the mat's far left corner. */
function createNightLight(keep: Keep, own: Own): Group {
  const group = new Group();
  group.name = 'night-light';
  const shade = new Mesh(
    keep(new SphereGeometry(0.9, 24, 18)),
    own(new MeshBasicMaterial({ color: new Color('#ffd9a0').multiplyScalar(2.2) })),
  );
  shade.scale.set(1, 1, 0.5);
  shade.position.set(0, 1.1, 0);
  const base = new Mesh(
    keep(new BoxGeometry(1.2, 0.3, 0.8)),
    own(new MeshStandardMaterial({ color: '#d9cbb3', roughness: 0.6 })),
  );
  base.position.y = 0.15;
  const glow = new PointLight('#ffc98a', 60, 26, 1.6);
  glow.position.set(0, 1.4, 0.6);
  group.add(shade, base, glow);
  group.position.set(-HALF_WIDTH - 3.2, 0, -HALF_DEPTH - 1.2);
  return group;
}

/**
 * The play mat's print: a soft green town with roads, a pond and a park, and a quilting stitch
 * round every cell. Kept pale and low in contrast so the painted track always stands out.
 */
function matTexture(rng: Rng): CanvasTexture {
  const canvas = document.createElement('canvas');
  const cell = TEXELS_PER_CELL;
  canvas.width = COLUMNS * cell;
  canvas.height = ROWS * cell;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the play mat');
  context.fillStyle = '#c9dcb4';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Patches of meadow in slightly different greens, like a printed quilt.
  for (let index = 0; index < 26; index++) {
    context.fillStyle = rng.pick(['#c2d8aa', '#d1e2bd', '#bfd4a8', '#cfdfb6']);
    const x = rng.int(0, COLUMNS - 6) * cell;
    const y = rng.int(0, ROWS - 4) * cell;
    context.fillRect(x, y, rng.int(3, 7) * cell, rng.int(2, 4) * cell);
  }

  // Roads: a loop and two crossings, grey with a dashed centre line.
  context.lineCap = 'round';
  const road = (points: readonly (readonly [number, number])[]) => {
    context.strokeStyle = '#b9b4ab';
    context.lineWidth = cell * 1.1;
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x * cell, y * cell);
      else context.lineTo(x * cell, y * cell);
    });
    context.stroke();
    context.strokeStyle = '#f4efe2';
    context.lineWidth = 3;
    context.setLineDash([cell * 0.4, cell * 0.35]);
    context.stroke();
    context.setLineDash([]);
  };
  road([
    [3, 3],
    [37, 3],
    [37, 17],
    [3, 17],
    [3, 3],
  ]);
  road([
    [20, 3],
    [20, 17],
  ]);
  road([
    [3, 10],
    [14, 10],
  ]);
  road([
    [26, 10],
    [37, 10],
  ]);

  // A pond and a park, and a scatter of rooftops seen from above.
  context.fillStyle = '#a9cfe0';
  context.beginPath();
  context.ellipse(10 * cell, 6.5 * cell, 3.2 * cell, 1.6 * cell, 0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b3d29a';
  context.fillRect(24 * cell, 12 * cell, 8 * cell, 3.4 * cell);
  for (let index = 0; index < 18; index++) {
    const x = rng.float(4.5, 35) * cell;
    const y = rng.float(4.5, 15.5) * cell;
    if (Math.abs(x / cell - 20) < 1.4 || Math.abs(y / cell - 10) < 1.2) continue;
    context.fillStyle = rng.pick(['#e2b3a0', '#d9c39b', '#c9b6cf', '#e7cfa3']);
    context.fillRect(x, y, cell * 0.9, cell * 0.7);
    context.fillStyle = 'rgba(0,0,0,0.08)';
    context.fillRect(x, y + cell * 0.35, cell * 0.9, cell * 0.35);
  }
  for (let index = 0; index < 40; index++) {
    context.fillStyle = rng.pick(['#9fc287', '#93b87c', '#a8c992']);
    context.beginPath();
    context.arc(
      rng.float(1, 39) * cell,
      rng.float(1, 19) * cell,
      cell * rng.float(0.18, 0.3),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  // The quilting: a stitched line round every cell, so the grid can always be read.
  context.strokeStyle = 'rgba(70, 80, 60, 0.22)';
  context.lineWidth = 2;
  context.setLineDash([6, 5]);
  context.beginPath();
  for (let column = 0; column <= COLUMNS; column++) {
    context.moveTo(column * cell, 0);
    context.lineTo(column * cell, canvas.height);
  }
  for (let row = 0; row <= ROWS; row++) {
    context.moveTo(0, row * cell);
    context.lineTo(canvas.width, row * cell);
  }
  context.stroke();
  context.setLineDash([]);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
