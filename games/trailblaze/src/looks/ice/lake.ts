/**
 * Ice Trail's world: a frozen lake, its ice clear and glossy with frosted
 * patches, fine cracks and skate scratches, a faint frost line round every
 * cell. A bordered arena is ringed by snowbanks heaped on the outer cells;
 * a wraparound lake runs on under a dusting of snow at its edges. Beyond the
 * shore stand pines heavy with snow.
 *
 * By day the sky is pale and the shadows cold blue; by night the moon and
 * the stars light it, and the walls of ice glow from inside.
 */
import type { Rng } from '@woodgrain-88/kit';
import {
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { COLUMNS, ROWS } from '../../engine/types.ts';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/board-space.ts';

const TEXELS_PER_CELL = 48;

export interface Lake {
  readonly root: Group;
  setEdges(edges: 'bordered' | 'wraparound'): void;
  dispose(): void;
}

export function createLake(options: { readonly night: boolean; readonly rng: Rng }): Lake {
  const { night, rng } = options;
  const root = new Group();
  root.name = 'lake';
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

  const surface = iceTexture(rng.fork('ice'), night);
  textures.push(surface);
  const ice = new Mesh(
    keep(new PlaneGeometry(COLUMNS, ROWS)),
    own(
      new MeshPhysicalMaterial({
        map: surface,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        color: night ? '#9fb6d9' : '#ffffff',
      }),
    ),
  );
  ice.rotation.x = -Math.PI / 2;
  ice.receiveShadow = true;
  root.add(ice);

  const snowMaterial = own(
    new MeshStandardMaterial({ color: night ? '#5f6b8c' : '#bcc6d4', roughness: 0.9 }),
  );
  const shore = new Mesh(keep(new PlaneGeometry(140, 90)), snowMaterial);
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = -0.02;
  shore.receiveShadow = true;
  root.add(shore);

  const banks = createSnowbanks(keep, snowMaterial, rng.fork('banks'));
  root.add(banks);
  const dusting = createDusting(keep, snowMaterial, rng.fork('dust'));
  root.add(dusting);
  root.add(createPines(keep, own, rng.fork('pines'), night));

  return {
    root,
    setEdges(edges) {
      banks.visible = edges === 'bordered';
      dusting.visible = edges === 'wraparound';
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

function borderCells(): [number, number][] {
  const cells: [number, number][] = [];
  for (let column = 0; column < COLUMNS; column++) cells.push([column, 0], [column, ROWS - 1]);
  for (let row = 1; row < ROWS - 1; row++) cells.push([0, row], [COLUMNS - 1, row]);
  return cells;
}

/** A snowbank heaped on every border cell: two lumps a cell, of uneven size. */
function createSnowbanks(keep: Keep, material: Material, rng: Rng): Group {
  const group = new Group();
  group.name = 'snowbanks';
  const cells = borderCells();
  const lump = keep(new SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
  const mesh = new InstancedMesh(lump, material, cells.length * 2);
  const placer = new Object3D();
  cells.forEach(([column, row], index) => {
    for (const offset of [0, 1]) {
      placer.position.set(
        column - HALF_WIDTH + 0.5 + rng.float(-0.18, 0.18),
        0,
        row - HALF_DEPTH + 0.5 + rng.float(-0.18, 0.18),
      );
      placer.scale.set(rng.float(0.95, 1.2), rng.float(0.9, 1.25), rng.float(0.95, 1.2));
      placer.updateMatrix();
      mesh.setMatrixAt(index * 2 + offset, placer.matrix);
    }
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** A low dusting of snow just outside a wraparound lake, so its edges read as open. */
function createDusting(keep: Keep, material: Material, rng: Rng): Group {
  const group = new Group();
  group.name = 'dusting';
  const lump = keep(new SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const spots: [number, number][] = [];
  for (let column = 0; column < COLUMNS; column += 2)
    spots.push(
      [column - HALF_WIDTH + 1, -HALF_DEPTH - 0.6],
      [column - HALF_WIDTH + 1, HALF_DEPTH + 0.6],
    );
  for (let row = 0; row < ROWS; row += 2)
    spots.push([-HALF_WIDTH - 0.6, row - HALF_DEPTH + 1], [HALF_WIDTH + 0.6, row - HALF_DEPTH + 1]);
  const mesh = new InstancedMesh(lump, material, spots.length);
  const placer = new Object3D();
  spots.forEach(([x, z], index) => {
    placer.position.set(x, 0, z);
    placer.scale.set(rng.float(0.9, 1.3), rng.float(0.3, 0.5), rng.float(0.9, 1.3));
    placer.updateMatrix();
    mesh.setMatrixAt(index, placer.matrix);
  });
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** Snowy pines standing round the shore, in two rows of uneven height. */
function createPines(keep: Keep, own: Own, rng: Rng, night: boolean): Group {
  const group = new Group();
  group.name = 'pines';
  const tiers = [0, 1, 2].map((tier) => {
    const cone = keep(new ConeGeometry(1.1 - tier * 0.28, 1.3, 9));
    cone.translate(0, 1.2 + tier * 0.75, 0);
    return cone;
  });
  const trunk = keep(new CylinderGeometry(0.14, 0.18, 1, 8));
  trunk.translate(0, 0.5, 0);
  const needles = own(
    new MeshStandardMaterial({
      color: night ? '#1d3a36' : '#2a5446',
      roughness: 0.85,
      flatShading: true,
    }),
  );
  const bark = own(new MeshStandardMaterial({ color: '#5a4030', roughness: 0.9 }));
  const spots: [number, number][] = [];
  for (let x = -HALF_WIDTH - 1; x <= HALF_WIDTH + 1; x += rng.float(2.2, 3.4)) {
    // The middle of the far bank is kept clear for the snowman.
    if (Math.abs(x) > 4) spots.push([x, -HALF_DEPTH - rng.float(2.2, 4.2)]);
  }
  for (let z = -HALF_DEPTH; z <= HALF_DEPTH; z += rng.float(2.4, 3.6)) {
    spots.push([-HALF_WIDTH - rng.float(2.2, 4), z], [HALF_WIDTH + rng.float(2.2, 4), z]);
  }
  const placer = new Object3D();
  const meshes = [
    ...tiers.map((tier) => new InstancedMesh(tier, needles, spots.length)),
    new InstancedMesh(trunk, bark, spots.length),
  ];
  spots.forEach(([x, z], index) => {
    placer.position.set(x, 0, z);
    placer.scale.setScalar(rng.float(0.75, 1.25));
    placer.rotation.y = rng.float(0, Math.PI * 2);
    placer.updateMatrix();
    for (const mesh of meshes) mesh.setMatrixAt(index, placer.matrix);
  });
  for (const mesh of meshes) {
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/**
 * The ice: deep blue-grey with frosted white patches, fine cracks and long curving skate
 * scratches, and a faint frost line round every cell so the grid reads without shouting.
 */
function iceTexture(rng: Rng, night: boolean): CanvasTexture {
  const cell = TEXELS_PER_CELL;
  const canvas = document.createElement('canvas');
  canvas.width = COLUMNS * cell;
  canvas.height = ROWS * cell;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the ice');
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, night ? '#4f6c94' : '#4f82b3');
  gradient.addColorStop(0.5, night ? '#5d7ba3' : '#6296c4');
  gradient.addColorStop(1, night ? '#476489' : '#4a7cab');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 18; index++) {
    const x = rng.float(0, canvas.width);
    const y = rng.float(0, canvas.height);
    const radius = rng.float(1.5, 4.5) * cell;
    const frost = context.createRadialGradient(x, y, 0, x, y, radius);
    frost.addColorStop(0, 'rgba(255,255,255,0.24)');
    frost.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = frost;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  context.strokeStyle = 'rgba(255,255,255,0.32)';
  context.lineWidth = 1.5;
  for (let index = 0; index < 22; index++) {
    let x = rng.float(0, canvas.width);
    let y = rng.float(0, canvas.height);
    context.beginPath();
    context.moveTo(x, y);
    for (let step = 0; step < 6; step++) {
      x += rng.float(-1, 1) * cell;
      y += rng.float(-1, 1) * cell;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.lineWidth = 2;
  for (let index = 0; index < 16; index++) {
    context.beginPath();
    const x = rng.float(0, canvas.width);
    const y = rng.float(0, canvas.height);
    context.ellipse(
      x,
      y,
      rng.float(3, 9) * cell,
      rng.float(1, 3) * cell,
      rng.float(0, Math.PI),
      0,
      rng.float(0.6, 1.4),
    );
    context.stroke();
  }

  context.strokeStyle = night ? 'rgba(200,225,255,0.2)' : 'rgba(255,255,255,0.5)';
  context.lineWidth = 2;
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

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
