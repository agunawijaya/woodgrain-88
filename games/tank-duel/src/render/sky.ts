/**
 * The board for aircraft channels: a model-railway countryside laid over the
 * whole table, far below the planes. Patchwork fields with plough furrows
 * and crop rows, hedgerows between them, a winding river, a lane, a few
 * farmsteads and copses of trees; all of it generated from a seed, none of it
 * a real place. Above it float the channel's cloud banks, built from soft lit
 * puffs at the planes' own height so a plane can hide inside one, each
 * casting a soft shadow on the fields below.
 */
import {
  createGroundPaint,
  createGradientNoise,
  createParticleField,
  fbm,
  hexToRgb,
  mixRgb,
  paintRgba,
  smoothstep,
  type GroundPaint,
  type LightPalette,
  type ParticleField,
  type Rgb,
} from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SkyDef } from '../arenas/format.ts';
import { toTable } from './board.ts';

export interface SkyScene {
  readonly root: Group;
  readonly clouds: ParticleField;
  readonly groundPaint: GroundPaint;
  /** The flying height of every aircraft, in world units above the fields. */
  readonly altitude: number;
  update(dt: number, camera: Camera): void;
  dispose(): void;
}

export const FLYING_HEIGHT = 11;
const LAND_WIDTH = 120;
const LAND_DEPTH = 84;
const TEXELS_PER_UNIT = 10;

interface Field {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly crop: Crop;
  /** Direction of the furrows or crop rows, radians. */
  readonly rows: number;
}

type Crop = 'meadow' | 'wheat' | 'ploughed' | 'pasture' | 'barley';

const CROPS: Record<Crop, { light: Rgb; dark: Rgb; rows: number }> = {
  meadow: { light: hexToRgb('#8ea64f'), dark: hexToRgb('#6d8a3c'), rows: 0 },
  pasture: { light: hexToRgb('#a2b35e'), dark: hexToRgb('#7f9447'), rows: 0 },
  wheat: { light: hexToRgb('#dcc36a'), dark: hexToRgb('#bc9f4c'), rows: 5 },
  barley: { light: hexToRgb('#c9c27a'), dark: hexToRgb('#a69f5c'), rows: 4 },
  ploughed: { light: hexToRgb('#94704c'), dark: hexToRgb('#6b4d32'), rows: 3 },
};

export function createSkyScene(
  sky: SkyDef,
  palette: LightPalette,
  night: boolean,
  rng: Rng,
): SkyScene {
  const root = new Group();
  root.name = 'sky-board';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const keepMaterial = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };

  const fields = splitFields(rng.fork('fields'));
  const river = winding(rng.fork('river'), LAND_DEPTH * 0.62, 7);
  const lane = winding(rng.fork('lane'), LAND_DEPTH * 0.3, 4);
  const groundPaint = createGroundPaint({ width: LAND_WIDTH, depth: LAND_DEPTH, resolution: 6 });

  const land = paintLand(fields, river, lane, rng.int(1, 1e6));
  const groundMaterial = keepMaterial(
    new MeshStandardMaterial({ map: land, roughness: 0.95, metalness: 0 }),
  );
  groundPaint.applyTo(groundMaterial);
  const ground = new Mesh(keep(new PlaneGeometry(LAND_WIDTH, LAND_DEPTH)), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  root.add(plantTrees(fields, river, lane, rng.fork('trees'), keep, keepMaterial));
  root.add(buildFarmsteads(lane, rng.fork('farms'), keep, keepMaterial));

  const clouds = createParticleField('smoke', 900, palette);
  clouds.mesh.renderOrder = 14;
  root.add(clouds.mesh);
  layClouds(sky, clouds, groundPaint, palette, night, rng.fork('clouds'));

  return {
    root,
    clouds,
    groundPaint,
    altitude: FLYING_HEIGHT,
    update(dt, camera) {
      clouds.update(dt, camera);
    },
    dispose() {
      land.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      clouds.dispose();
      groundPaint.dispose();
      root.removeFromParent();
    },
  };
}

/** Patchwork: split the land into rectangles again and again, then give each a crop. */
function splitFields(rng: Rng): Field[] {
  const crops: Crop[] = [
    'meadow',
    'meadow',
    'pasture',
    'wheat',
    'barley',
    'ploughed',
    'ploughed',
    'wheat',
  ];
  const done: Field[] = [];
  const queue: { x: number; y: number; width: number; height: number }[] = [
    { x: -LAND_WIDTH / 2, y: -LAND_DEPTH / 2, width: LAND_WIDTH, height: LAND_DEPTH },
  ];
  while (queue.length > 0) {
    const piece = queue.pop();
    if (!piece) break;
    const big = piece.width * piece.height > 46 || Math.max(piece.width, piece.height) > 11;
    if (big && (piece.width > 5 || piece.height > 5)) {
      const across = piece.width > piece.height * (0.8 + rng.next() * 0.4);
      const cut = rng.float(0.35, 0.65);
      if (across) {
        const left = piece.width * cut;
        queue.push(
          { ...piece, width: left },
          { ...piece, x: piece.x + left, width: piece.width - left },
        );
      } else {
        const top = piece.height * cut;
        queue.push(
          { ...piece, height: top },
          { ...piece, y: piece.y + top, height: piece.height - top },
        );
      }
      continue;
    }
    done.push({
      ...piece,
      crop: rng.pick(crops),
      rows: rng.chance(0.5) ? 0 : Math.PI / 2 + rng.float(-0.2, 0.2),
    });
  }
  return done;
}

/** A gently winding line across the land, as a function from x to y (table coordinates). */
function winding(rng: Rng, offset: number, sway: number): (x: number) => number {
  const phase = rng.float(0, Math.PI * 2);
  const second = rng.float(0, Math.PI * 2);
  const base = offset - LAND_DEPTH / 2;
  return (x) =>
    base + Math.sin(x * 0.07 + phase) * sway + Math.sin(x * 0.17 + second) * sway * 0.35;
}

function paintLand(
  fields: readonly Field[],
  river: (x: number) => number,
  lane: (x: number) => number,
  seed: number,
): DataTexture {
  const width = LAND_WIDTH * TEXELS_PER_UNIT;
  const height = LAND_DEPTH * TEXELS_PER_UNIT;
  const owner = new Int16Array(width * height).fill(-1);
  fields.forEach((field, index) => {
    const x0 = Math.round((field.x + LAND_WIDTH / 2) * TEXELS_PER_UNIT);
    const y0 = Math.round((field.y + LAND_DEPTH / 2) * TEXELS_PER_UNIT);
    const x1 = Math.round((field.x + field.width + LAND_WIDTH / 2) * TEXELS_PER_UNIT);
    const y1 = Math.round((field.y + field.height + LAND_DEPTH / 2) * TEXELS_PER_UNIT);
    for (let y = y0; y < y1; y++) owner.fill(index, y * width + x0, y * width + x1);
  });
  const noise = createGradientNoise(seed);
  const hedge = hexToRgb('#3e5a2c');
  const water = hexToRgb('#4d7c96');
  const shallows = hexToRgb('#7fa6a8');
  const bank = hexToRgb('#a89a6c');
  const road = hexToRgb('#b8a27c');
  const bytes = paintRgba(width, height, (x, y) => {
    const worldX = x / TEXELS_PER_UNIT - LAND_WIDTH / 2;
    // Texture row 0 is the near edge of the table (v = 0), the last row the far edge.
    const worldY = LAND_DEPTH / 2 - y / TEXELS_PER_UNIT;
    // Field boundaries are looked up through a gentle warp, so hedges wander like real ones.
    const warpX = noise.sample(worldX * 0.22, worldY * 0.22) * 0.55;
    const warpY = noise.sample(worldX * 0.22 + 31.7, worldY * 0.22) * 0.55;
    const lookX = Math.min(width - 1, Math.max(0, Math.round(x + warpX * TEXELS_PER_UNIT)));
    const lookRow = Math.min(
      height - 1,
      Math.max(0, Math.round(height - 1 - y - warpY * TEXELS_PER_UNIT)),
    );
    const field = fields[owner[lookRow * width + lookX] ?? 0];
    if (!field) return hedge;
    const crop = CROPS[field.crop];
    const grain = fbm(noise, x / 256, y / 256, { frequency: 8, octaves: 3 }) * 0.5 + 0.5;
    let colour = mixRgb(crop.dark, crop.light, grain);
    if (crop.rows > 0) {
      const along = worldX * Math.cos(field.rows) + worldY * Math.sin(field.rows);
      colour = mixRgb(
        colour,
        crop.dark,
        (0.5 + 0.5 * Math.sin(along * crop.rows * Math.PI)) * 0.45,
      );
    }
    // Hedgerows along every field edge, ragged so they read as bushes.
    const hereX = worldX + warpX;
    const hereY = worldY - warpY;
    const edge = Math.min(
      hereX - field.x,
      field.x + field.width - hereX,
      hereY - field.y,
      field.y + field.height - hereY,
    );
    const ragged = 0.12 + (noise.sample(worldX * 2.6, worldY * 2.6) * 0.5 + 0.5) * 0.12;
    if (edge < ragged) colour = mixRgb(hedge, colour, smoothstep(ragged * 0.4, ragged, edge));
    const toLane = Math.abs(worldY - lane(worldX));
    if (toLane < 0.4) colour = mixRgb(road, colour, smoothstep(0.22, 0.4, toLane));
    const toRiver = Math.abs(worldY - river(worldX));
    if (toRiver < 1.2) {
      const wet = 1 - smoothstep(0.5, 0.8, toRiver);
      colour = mixRgb(colour, bank, 1 - smoothstep(0.8, 1.2, toRiver));
      colour = mixRgb(colour, mixRgb(water, shallows, smoothstep(0.2, 0.7, toRiver)), wet);
    }
    return colour;
  });
  const texture = new DataTexture(bytes, width, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

type Keep = <T extends BufferGeometry>(geometry: T) => T;
type KeepMaterial = <T extends Material>(material: T) => T;

/** Trees along the hedgerows and in small copses, kept off the river and the lane. */
function plantTrees(
  fields: readonly Field[],
  river: (x: number) => number,
  lane: (x: number) => number,
  rng: Rng,
  keep: Keep,
  keepMaterial: KeepMaterial,
): Group {
  const group = new Group();
  const spots: Vector3[] = [];
  const clear = (x: number, y: number) =>
    Math.abs(y - river(x)) > 1.5 && Math.abs(y - lane(x)) > 0.8;
  for (const field of fields) {
    const perimeter = 2 * (field.width + field.height);
    for (let along = 0; along < perimeter; along += 1.1) {
      if (!rng.chance(0.22)) continue;
      const point = edgePoint(field, along);
      if (clear(point.x, point.y)) spots.push(new Vector3(point.x, 0, point.y));
    }
    if (field.crop === 'meadow' && rng.chance(0.25)) {
      const cx = field.x + field.width / 2;
      const cy = field.y + field.height / 2;
      for (let tree = 0; tree < 12; tree++) {
        const x = cx + rng.float(-1.2, 1.2);
        const y = cy + rng.float(-0.9, 0.9);
        if (clear(x, y)) spots.push(new Vector3(x, 0, y));
      }
    }
  }
  const crownGeometry = keep(new IcosahedronGeometry(0.34, 1));
  const trunkGeometry = keep(new CylinderGeometry(0.04, 0.055, 0.3, 5));
  trunkGeometry.translate(0, 0.15, 0);
  const crowns = new InstancedMesh(
    crownGeometry,
    keepMaterial(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })),
    spots.length,
  );
  const trunks = new InstancedMesh(
    trunkGeometry,
    keepMaterial(new MeshStandardMaterial({ color: '#5a3f2a', roughness: 0.9 })),
    spots.length,
  );
  const matrix = new Matrix4();
  const colour = new Color();
  spots.forEach((spot, index) => {
    const size = rng.float(0.7, 1.25);
    matrix.compose(spot, new Quaternion(), new Vector3(size, size, size));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(
      spot.clone().setY(0.3 * size + 0.26 * size),
      new Quaternion().setFromEuler(new Euler(rng.float(0, 3), rng.float(0, 3), 0)),
      new Vector3(size, size * rng.float(0.85, 1.15), size),
    );
    crowns.setMatrixAt(index, matrix);
    crowns.setColorAt(
      index,
      colour.setHSL(0.24 + rng.float(-0.04, 0.03), 0.42, rng.float(0.24, 0.34)),
    );
  });
  for (const mesh of [crowns, trunks]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function edgePoint(field: Field, along: number): { x: number; y: number } {
  const { x, y, width, height } = field;
  if (along < width) return { x: x + along, y };
  if (along < width + height) return { x: x + width, y: y + along - width };
  if (along < 2 * width + height) return { x: x + width - (along - width - height), y: y + height };
  return { x, y: y + height - (along - 2 * width - height) };
}

/** A few farmsteads along the lane: a house and a barn, each with a pitched roof. */
function buildFarmsteads(
  lane: (x: number) => number,
  rng: Rng,
  keep: Keep,
  keepMaterial: KeepMaterial,
): Group {
  const group = new Group();
  const wall = keepMaterial(new MeshStandardMaterial({ color: '#e8dfcc', roughness: 0.8 }));
  const roof = keepMaterial(new MeshStandardMaterial({ color: '#a3492f', roughness: 0.7 }));
  const roofGeometry = keep(new ConeGeometry(1, 0.7, 4, 1));
  roofGeometry.rotateY(Math.PI / 4);
  for (const x of [-38, -12, 17, 41]) {
    const y = lane(x + 2) + (rng.chance(0.5) ? 2.4 : -2.4);
    for (const [dx, dy, scale] of [
      [0, 0, 0.42],
      [0.9, 0.26, 0.34],
    ] as const) {
      const house = new Mesh(keep(new RoundedBoxGeometry(1.6, 0.9, 1.1, 1, 0.05)), wall);
      house.scale.setScalar(scale);
      house.position.set(x + dx, 0.45 * scale, y + dy);
      const cap = new Mesh(roofGeometry, roof);
      cap.scale.set(1.25 * scale, scale, 0.85 * scale);
      cap.position.set(x + dx, 0.9 * scale + 0.35 * scale, y + dy);
      for (const part of [house, cap]) {
        part.castShadow = true;
        part.receiveShadow = true;
        part.rotation.y = rng.float(-0.1, 0.1);
        group.add(part);
      }
    }
  }
  return group;
}

/** Each bank is a dome of soft puffs, densest and tallest in the middle; its shadow lands on the fields. */
function layClouds(
  sky: SkyDef,
  clouds: ParticleField,
  paint: GroundPaint,
  palette: LightPalette,
  night: boolean,
  rng: Rng,
): void {
  // By night the banks are dark, cool shapes against the fields, picked out at their edges by the moon.
  const white = night ? new Color(0.36, 0.4, 0.52) : new Color(0.84, 0.85, 0.87);
  const shade = palette.keyDirection.y > 0.05 ? palette.keyDirection : new Vector3(0, 1, 0);
  for (const bank of sky.clouds) {
    const puffs = Math.round(bank.radiusX * bank.radiusY * 1.1) + 6;
    for (let puff = 0; puff < puffs; puff++) {
      const angle = rng.float(0, Math.PI * 2);
      const reach = Math.sqrt(rng.next());
      const centre = toTable(
        bank.x + Math.cos(angle) * bank.radiusX * reach,
        bank.y + Math.sin(angle) * bank.radiusY * reach,
      );
      const dome = 1 - reach * reach;
      const size = rng.float(2.4, 3.6) + dome * 2.4;
      clouds.emit({
        x: centre.x,
        y: FLYING_HEIGHT - 0.8 + dome * 2.6 + rng.float(-0.4, 0.4),
        z: centre.z,
        life: 1e9,
        size,
        colour: white,
        alpha: 0.96,
        alphaEnd: 0.96,
        rotation: rng.float(0, Math.PI * 2),
        seed: rng.next(),
      });
    }
    // The shadow falls away from the sun, as far as the cloud is high.
    const reachOut = FLYING_HEIGHT / shade.y;
    paint.stamp({
      kind: 'contact',
      x: bank.x - 32 - shade.x * reachOut,
      z: bank.y - 20 - shade.z * reachOut,
      width: bank.radiusY * 2.4,
      length: bank.radiusX * 2.4,
      margin: Math.min(bank.radiusX, bank.radiusY) * 1.1,
      strength: 0.75,
    });
  }
}
