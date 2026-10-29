/**
 * Mummy's Wrap's tomb: a floor of sandstone flags, one flag a cell, worn and
 * a little uneven in colour, a few carved with patterns of our own (rings,
 * waves, zigzags, a sun disc; never real script). A bordered arena is walled
 * by blocks of the same stone with a carved band; a wraparound arena opens
 * into dark doorways at its edges.
 *
 * By day a shaft of sunlight falls through a gap in the roof onto the gold
 * floor; by night torches burn on stands round the walls, their light
 * flickering, and the carvings glow faintly.
 */
import {
  bakeSurface,
  concreteRecipe,
  repeatSurface,
  sandRecipe,
  type SurfaceMaps,
} from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLUMNS, ROWS } from '../../engine/types.ts';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/board-space.ts';
import { FLOOR_TOP } from './bandage.ts';

const TEXELS_PER_CELL = 48;
const WALL_HEIGHT = 0.62;

export interface Torch {
  readonly flame: Vector3;
}

export interface Tomb {
  readonly root: Group;
  /** Where the torches' flames burn, for the view's sparks; empty by day. */
  readonly torches: readonly Torch[];
  setEdges(edges: 'bordered' | 'wraparound'): void;
  update(dt: number, clock: number): void;
  dispose(): void;
}

export function createTomb(options: { readonly night: boolean; readonly rng: Rng }): Tomb {
  const { night, rng } = options;
  const root = new Group();
  root.name = 'tomb';
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

  const grit: SurfaceMaps = repeatSurface(bakeSurface(sandRecipe(29, 256)), 4, 2);
  textures.push(grit.map, grit.normalMap, grit.roughnessMap);
  const flags = flagstoneTexture(rng.fork('flags'), night);
  textures.push(flags.colour, flags.glow);
  const floor = new Mesh(
    keep(new PlaneGeometry(COLUMNS, ROWS)),
    own(
      new MeshStandardMaterial({
        map: flags.colour,
        normalMap: grit.normalMap,
        roughness: 0.88,
        emissive: night ? '#ff9a3a' : '#000000',
        emissiveMap: flags.glow,
        emissiveIntensity: night ? 0.22 : 0,
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_TOP;
  floor.receiveShadow = true;
  root.add(floor);

  // Beyond the arena the chamber floor is plainer, older stone, so the eye stays on the flags.
  const stone: SurfaceMaps = repeatSurface(bakeSurface(concreteRecipe(41)), 12, 8);
  textures.push(stone.map, stone.normalMap, stone.roughnessMap);
  const surround = new Mesh(
    keep(new PlaneGeometry(120, 80)),
    own(
      new MeshStandardMaterial({
        map: stone.map,
        normalMap: stone.normalMap,
        color: night ? '#4a3a2b' : '#9c7a52',
        roughness: 0.95,
      }),
    ),
  );
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.01;
  surround.receiveShadow = true;
  root.add(surround);

  const walls = createWalls(keep, own, rng.fork('walls'), night);
  root.add(walls);
  const doorways = createDoorways(keep, own);
  root.add(doorways);

  const torches: Torch[] = [];
  const flickering: { light: PointLight; flame: Mesh; seed: number }[] = [];
  if (night) {
    const spots = [
      [-HALF_WIDTH - 1.4, -HALF_DEPTH - 1.4],
      [HALF_WIDTH + 1.4, -HALF_DEPTH - 1.4],
      [-HALF_WIDTH - 1.4, HALF_DEPTH + 1.4],
      [HALF_WIDTH + 1.4, HALF_DEPTH + 1.4],
      [-HALF_WIDTH - 1.6, 0],
      [HALF_WIDTH + 1.6, 0],
    ] as const;
    const pole = keep(new CylinderGeometry(0.08, 0.12, 1.6, 10));
    pole.translate(0, 0.8, 0);
    const bowl = keep(new CylinderGeometry(0.26, 0.14, 0.2, 14));
    bowl.translate(0, 1.7, 0);
    const flameGeometry = keep(new ConeGeometry(0.2, 0.62, 12, 1, true));
    flameGeometry.translate(0, 2.06, 0);
    const bronze = own(
      new MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.5, metalness: 0.6 }),
    );
    const fire = own(
      new MeshBasicMaterial({
        color: new Color('#ffb04a').multiplyScalar(3),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    spots.forEach(([x, z], index) => {
      const stand = new Group();
      stand.position.set(x, 0, z);
      const poleMesh = new Mesh(pole, bronze);
      poleMesh.castShadow = true;
      const flame = new Mesh(flameGeometry, fire);
      stand.add(poleMesh, new Mesh(bowl, bronze), flame);
      // Four lights are enough to light the floor; the other flames only glow.
      if (index < 4) {
        const light = new PointLight('#ff9b45', 46, 30, 1.5);
        light.position.set(0, 2.2, 0);
        stand.add(light);
        flickering.push({ light, flame, seed: index * 1.7 });
      }
      root.add(stand);
      torches.push({ flame: new Vector3(x, 2.25, z) });
    });
  } else {
    root.add(createSunShaft(keep, own));
  }

  return {
    root,
    torches,
    setEdges(edges) {
      walls.visible = edges === 'bordered';
      doorways.visible = edges === 'wraparound';
    },
    update(_dt, clock) {
      for (const { light, flame, seed } of flickering) {
        const flicker =
          0.82 + 0.12 * Math.sin(clock * 13 + seed) + 0.06 * Math.sin(clock * 31 + seed * 3);
        light.intensity = 46 * flicker;
        flame.scale.set(1, flicker * 1.1, 1);
      }
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

/** Stone blocks on every border cell, each a slightly different tone, with a carved groove. */
function createWalls(keep: Keep, own: Own, rng: Rng, night: boolean): Group {
  const group = new Group();
  group.name = 'tomb-walls';
  const cells: [number, number][] = [];
  for (let column = 0; column < COLUMNS; column++) cells.push([column, 0], [column, ROWS - 1]);
  for (let row = 1; row < ROWS - 1; row++) cells.push([0, row], [COLUMNS - 1, row]);
  const block = keep(new RoundedBoxGeometry(0.98, WALL_HEIGHT, 0.98, 2, 0.05));
  block.translate(0, FLOOR_TOP + WALL_HEIGHT / 2, 0);
  const capstone = keep(new RoundedBoxGeometry(1.0, 0.1, 1.0, 2, 0.03));
  capstone.translate(0, FLOOR_TOP + WALL_HEIGHT + 0.05, 0);
  const stone = own(new MeshStandardMaterial({ roughness: 0.85 }));
  const cap = own(
    new MeshStandardMaterial({ color: night ? '#9a7a52' : '#e2c08c', roughness: 0.8 }),
  );
  const blocks = new InstancedMesh(block, stone, cells.length);
  const caps = new InstancedMesh(capstone, cap, cells.length);
  const placer = new Object3D();
  cells.forEach(([column, row], index) => {
    placer.position.set(column - HALF_WIDTH + 0.5, 0, row - HALF_DEPTH + 0.5);
    placer.updateMatrix();
    blocks.setMatrixAt(index, placer.matrix);
    caps.setMatrixAt(index, placer.matrix);
    const tone = rng.float(-0.06, 0.06);
    blocks.setColorAt(index, new Color('#d4ad74').offsetHSL(0, 0, tone));
  });
  for (const mesh of [blocks, caps]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** Dark doorways along the open edges of a wraparound tomb. */
function createDoorways(keep: Keep, own: Own): Group {
  const group = new Group();
  group.name = 'doorways';
  const lintel = keep(new RoundedBoxGeometry(1.0, 0.18, 0.3, 2, 0.04));
  const post = keep(new RoundedBoxGeometry(0.2, 0.55, 0.3, 2, 0.04));
  const hole = keep(new PlaneGeometry(0.6, 0.5));
  const stone = own(new MeshStandardMaterial({ color: '#c9a36c', roughness: 0.85 }));
  const dark = own(new MeshBasicMaterial({ color: '#120d08' }));
  const place = (x: number, z: number, yaw: number) => {
    const door = new Group();
    const top = new Mesh(lintel, stone);
    top.position.y = 0.64;
    const left = new Mesh(post, stone);
    left.position.set(-0.4, 0.28, 0);
    const right = new Mesh(post, stone);
    right.position.set(0.4, 0.28, 0);
    const shadow = new Mesh(hole, dark);
    shadow.position.set(0, 0.27, -0.02);
    door.add(top, left, right, shadow);
    door.traverse((child) => {
      if (child instanceof Mesh) child.castShadow = true;
    });
    door.position.set(x, FLOOR_TOP, z);
    door.rotation.y = yaw;
    group.add(door);
  };
  for (let column = 2; column < COLUMNS; column += 4) {
    place(column - HALF_WIDTH + 0.5, -HALF_DEPTH - 0.2, 0);
    place(column - HALF_WIDTH + 0.5, HALF_DEPTH + 0.2, Math.PI);
  }
  for (let row = 2; row < ROWS; row += 4) {
    place(-HALF_WIDTH - 0.2, row - HALF_DEPTH + 0.5, Math.PI / 2);
    place(HALF_WIDTH + 0.2, row - HALF_DEPTH + 0.5, -Math.PI / 2);
  }
  return group;
}

/** The day's shaft of sunlight: a slanting beam of dusty light and the bright pool it makes. */
function createSunShaft(keep: Keep, own: Own): Group {
  const group = new Group();
  group.name = 'sun-shaft';
  const beam = keep(new CylinderGeometry(3.2, 4.2, 26, 32, 1, true));
  beam.translate(0, 13, 0);
  const light = own(
    new MeshBasicMaterial({
      color: new Color('#ffe2a6').multiplyScalar(0.3),
      alphaMap: fadeUpTexture(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const shaft = new Mesh(beam, light);
  shaft.rotation.z = 0.32;
  shaft.position.set(6, 0, -1.5);
  const pool = keep(new PlaneGeometry(10, 8));
  pool.rotateX(-Math.PI / 2);
  const poolTexture = radialTexture();
  const poolMaterial = own(
    new MeshBasicMaterial({
      color: new Color('#ffdc9a').multiplyScalar(0.55),
      alphaMap: poolTexture,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const spot = new Mesh(pool, poolMaterial);
  spot.position.set(6, FLOOR_TOP + 0.005, -1.5);
  group.add(shaft, spot);
  return group;
}

/** Bright at the foot of the shaft and gone towards the roof, so the beam reads as dusty air. */
function fadeUpTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the sun shaft');
  const gradient = context.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(0.7, '#555555');
  gradient.addColorStop(1, '#ffffff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 64);
  return new CanvasTexture(canvas);
}

function radialTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the sun pool');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.6, '#777777');
  gradient.addColorStop(1, '#000000');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/**
 * The flagstones: one per cell, each its own shade of sand with darker joints and worn corners,
 * and one in nine carved with a pattern of our own. The glow map holds just the carvings, for
 * their faint light at night.
 */
function flagstoneTexture(
  rng: Rng,
  night: boolean,
): { colour: CanvasTexture; glow: CanvasTexture } {
  const cell = TEXELS_PER_CELL;
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = COLUMNS * cell;
    canvas.height = ROWS * cell;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2D canvas for the flagstones');
    return { canvas, context };
  };
  const colour = make();
  const glow = make();
  glow.context.fillStyle = '#000000';
  glow.context.fillRect(0, 0, glow.canvas.width, glow.canvas.height);
  colour.context.fillStyle = night ? '#6f5233' : '#b08a58';
  colour.context.fillRect(0, 0, colour.canvas.width, colour.canvas.height);
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const x = column * cell;
      const y = row * cell;
      const light = 62 + rng.float(-5, 5);
      colour.context.fillStyle = `hsl(${36 + rng.float(-3, 3)}, ${42 + rng.float(-6, 6)}%, ${light}%)`;
      colour.context.beginPath();
      colour.context.roundRect(x + 2, y + 2, cell - 4, cell - 4, 5);
      colour.context.fill();
      if (rng.chance(0.06)) {
        const motif = rng.int(0, 3);
        for (const target of [colour.context, glow.context]) {
          target.strokeStyle = target === glow.context ? '#ffffff' : 'rgba(110, 76, 38, 0.55)';
          target.lineWidth = 3;
          drawMotif(target, motif, x + cell / 2, y + cell / 2, cell * 0.3);
        }
      }
    }
  }
  const finish = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const texture = new CanvasTexture(canvas);
    if (srgb) texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };
  return { colour: finish(colour.canvas, true), glow: finish(glow.canvas, false) };
}

/** Our own carvings: a ringed dot, a wave, a zigzag and a rayed sun disc. */
function drawMotif(
  context: CanvasRenderingContext2D,
  motif: number,
  x: number,
  y: number,
  size: number,
): void {
  context.beginPath();
  if (motif === 0) {
    context.arc(x, y, size, 0, Math.PI * 2);
    context.moveTo(x + size * 0.3, y);
    context.arc(x, y, size * 0.3, 0, Math.PI * 2);
  } else if (motif === 1) {
    for (const offset of [-size * 0.4, size * 0.4]) {
      context.moveTo(x - size, y + offset);
      context.bezierCurveTo(
        x - size * 0.4,
        y + offset - size * 0.5,
        x + size * 0.4,
        y + offset + size * 0.5,
        x + size,
        y + offset,
      );
    }
  } else if (motif === 2) {
    context.moveTo(x - size, y + size * 0.4);
    for (let step = 1; step <= 4; step++) {
      context.lineTo(x - size + (step * size) / 2, y + (step % 2 === 0 ? size * 0.4 : -size * 0.4));
    }
  } else {
    context.arc(x, y, size * 0.45, 0, Math.PI * 2);
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray / 8) * Math.PI * 2;
      context.moveTo(x + Math.cos(angle) * size * 0.65, y + Math.sin(angle) * size * 0.65);
      context.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    }
  }
  context.stroke();
}
