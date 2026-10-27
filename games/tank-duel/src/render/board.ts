/**
 * The terrain board for tank channels: a sand-covered slab in a wooden frame
 * on the den's table, with the arena's walls built as crafted terrain pieces.
 * Concrete is cast in separate chamfered blocks, sandbags are stacked bag by
 * bag, ruins are broken brick walls with rubble at their feet, and bumpers
 * are steel posts with hazard bands. Every wall stands taller than a shell
 * flies, so what blocks a shot always looks like it would.
 */
import {
  bakeSurface,
  brickRecipe,
  burlapRecipe,
  concreteRecipe,
  createGradientNoise,
  createGroundPaint,
  projectBoxUvs,
  repeatSurface,
  sandRecipe,
  smoothstep,
  tableWoodRecipe,
  weatherMaterial,
  type GroundPaint,
  type SurfaceMaps,
} from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Euler,
  Vector3,
  ConeGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Arena, ArenaBlock, ArenaBumper } from '../arenas/format.ts';
import { lampMaterial, planSolid } from './models/parts.ts';

export interface Board {
  readonly root: Group;
  readonly groundPaint: GroundPaint;
  /** Turns the bumper lamps and other night details on or off. */
  setNight(night: boolean): void;
  update(dt: number): void;
  dispose(): void;
}

/** Game coordinates (x right, y down the screen) to the table's (x right, z towards the viewer). */
export function toTable(x: number, y: number, height = 0): Vector3 {
  return new Vector3(x - 32, height, y - 20);
}

const WALL_HEIGHT = { concrete: 1.75, ruin: 1.7, sandbag: 1.28, bumper: 1.35 } as const;
const GROUND_WIDTH = 66;
const GROUND_DEPTH = 42;

interface Owned {
  readonly geometries: BufferGeometry[];
  readonly materials: Material[];
  readonly surfaces: SurfaceMaps[];
}

export function createBoard(arena: Arena, rng: Rng): Board {
  const root = new Group();
  root.name = 'board';
  const owned: Owned = { geometries: [], materials: [], surfaces: [] };
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    owned.geometries.push(geometry);
    return geometry;
  };
  const keepMaterial = <T extends Material>(material: T): T => {
    owned.materials.push(material);
    return material;
  };
  const surface = (maps: SurfaceMaps): SurfaceMaps => {
    owned.surfaces.push(maps);
    return maps;
  };

  const groundPaint = createGroundPaint({
    width: GROUND_WIDTH,
    depth: GROUND_DEPTH,
    resolution: 16,
  });

  root.add(createTable(keep, keepMaterial, surface));
  root.add(createGround(keep, keepMaterial, surface, groundPaint));
  root.add(createFrame(keep, keepMaterial, surface));

  const concreteMaps = surface(bakeSurface(concreteRecipe(rng.int(1, 1e6))));
  const concrete = keepMaterial(surfaceMaterial(concreteMaps, 0.9));
  // The perimeter is a shade darker so the walls inside the field stand out from the board's edge.
  const perimeter = keepMaterial(surfaceMaterial(concreteMaps, 0.92));
  perimeter.color = new Color('#c2bdb5');
  weatherMaterial(concrete, { grimeHeight: 0.7, edgeLight: 0.35, variation: 0.1 });
  weatherMaterial(perimeter, { grimeHeight: 0.7, edgeLight: 0.35, variation: 0.08 });
  const brick = keepMaterial(
    surfaceMaterial(surface(bakeSurface(brickRecipe(rng.int(1, 1e6)))), 0.92),
  );
  brick.color = new Color('#cdb9ae');
  weatherMaterial(brick, { grimeHeight: 0.8, edgeLight: 0.2, variation: 0.06 });
  const burlap = keepMaterial(
    surfaceMaterial(surface(bakeSurface(burlapRecipe(rng.int(1, 1e6)))), 1),
  );
  weatherMaterial(burlap, { grimeHeight: 0.4, edgeLight: 0.15, variation: 0 });

  for (const block of arena.blocks) {
    if (block.material === 'concrete')
      root.add(concreteBlocks(block, onPerimeter(block) ? perimeter : concrete, keep, rng));
    else if (block.material === 'ruin') root.add(ruinWall(block, brick, keep, rng));
    else root.add(sandbagWall(block, burlap, keep, rng));
    stampContactShadow(groundPaint, block);
  }

  const bumperLamps: MeshStandardMaterial[] = [];
  for (const bumper of arena.bumpers) {
    const { group, lamp } = bumperPost(bumper, keep, keepMaterial, surface);
    root.add(group);
    bumperLamps.push(lamp);
    groundPaint.stamp({
      kind: 'contact',
      x: bumper.center.x - 32,
      z: bumper.center.y - 20,
      width: 5.6,
      length: 5.6,
      angle: Math.PI / 4,
      margin: 1,
      strength: 0.8,
    });
  }

  root.add(scatterDecor(arena, keep, keepMaterial, rng));
  root.add(wallFeet(arena, concrete, keep, keepMaterial, rng));
  stampOldBattles(groundPaint, arena, rng);

  let night = false;
  let clock = 0;

  return {
    root,
    groundPaint,
    setNight(next) {
      night = next;
    },
    update(dt) {
      clock += dt;
      // Bumper lamps blink slowly at night so the posts are found in the dark.
      const blink = night ? 0.5 + 0.5 * Math.sin(clock * 3.2) : 0;
      for (const lamp of bumperLamps) lamp.emissiveIntensity = night ? 1.5 + blink * 6 : 0.4;
      groundPaint.age(dt);
    },
    dispose() {
      for (const geometry of owned.geometries) geometry.dispose();
      for (const material of owned.materials) material.dispose();
      for (const maps of owned.surfaces) {
        maps.map.dispose();
        maps.normalMap.dispose();
        maps.roughnessMap.dispose();
      }
      groundPaint.dispose();
      root.removeFromParent();
    },
  };
}

function onPerimeter(block: ArenaBlock): boolean {
  return (
    block.x === 0 || block.y === 0 || block.x + block.width >= 64 || block.y + block.height >= 40
  );
}

type Keep = <T extends BufferGeometry>(geometry: T) => T;
type KeepMaterial = <T extends Material>(material: T) => T;
type KeepSurface = (maps: SurfaceMaps) => SurfaceMaps;

function surfaceMaterial(maps: SurfaceMaps, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    roughness,
    metalness: 0,
  });
}

function createTable(keep: Keep, keepMaterial: KeepMaterial, surface: KeepSurface): Mesh {
  const wood = repeatSurface(surface(bakeSurface(tableWoodRecipe(7))), 6, 4);
  const table = new Mesh(keep(new PlaneGeometry(240, 160)), keepMaterial(surfaceMaterial(wood, 1)));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.42;
  table.receiveShadow = true;
  return table;
}

/** Large-scale variation in world space, so the tiled sand never shows a repeat. */
function addMacroVariation(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vGroundWorld;',
          'float groundHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
          'float groundNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
          '  return mix(mix(groundHash(i), groundHash(i + vec2(1, 0)), u.x), mix(groundHash(i + vec2(0, 1)), groundHash(i + vec2(1, 1)), u.x), u.y); }',
        ].join('\n'),
      )
      .replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          'float macro = groundNoise(vGroundWorld.xz * 0.06) * 0.6 + groundNoise(vGroundWorld.xz * 0.17 + 3.1) * 0.4;',
          'diffuseColor.rgb *= 0.86 + macro * 0.26;',
          // Patches of packed, greyer earth where the sand has been driven flat.
          'float packed = smoothstep(0.56, 0.78, groundNoise(vGroundWorld.xz * 0.09 + 17.0) * 0.7 + groundNoise(vGroundWorld.xz * 0.4) * 0.3);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.76, 0.72), packed * 0.75);',
        ].join('\n'),
      );
  };
}

function createGround(
  keep: Keep,
  keepMaterial: KeepMaterial,
  surface: KeepSurface,
  paint: GroundPaint,
): Mesh {
  const sand = repeatSurface(
    surface(bakeSurface(sandRecipe(19))),
    GROUND_WIDTH / 7,
    GROUND_DEPTH / 7,
  );
  const material = keepMaterial(surfaceMaterial(sand, 1));
  material.normalScale.set(1, 1);
  addMacroVariation(material);
  paint.applyTo(material);
  const ground = new Mesh(keep(new PlaneGeometry(GROUND_WIDTH, GROUND_DEPTH)), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  return ground;
}

/** The board's wooden frame: four chamfered rails standing just proud of the sand. */
function createFrame(keep: Keep, keepMaterial: KeepMaterial, surface: KeepSurface): Group {
  const group = new Group();
  const wood = surface(bakeSurface(tableWoodRecipe(31, 256)));
  const material = keepMaterial(surfaceMaterial(wood, 1));
  material.color = new Color('#7d6a5c');
  const rail = 1.3;
  const height = 0.75;
  const sides: [number, number, number, number][] = [
    [0, -(GROUND_DEPTH / 2 + rail / 2), GROUND_WIDTH + rail * 2, rail],
    [0, GROUND_DEPTH / 2 + rail / 2, GROUND_WIDTH + rail * 2, rail],
    [-(GROUND_WIDTH / 2 + rail / 2), 0, rail, GROUND_DEPTH],
    [GROUND_WIDTH / 2 + rail / 2, 0, rail, GROUND_DEPTH],
  ];
  for (const [x, z, width, depth] of sides) {
    const geometry = keep(new RoundedBoxGeometry(width, height, depth, 3, 0.18));
    projectBoxUvs(geometry, 9);
    const piece = new Mesh(geometry, material);
    piece.position.set(x, -0.42 + height / 2, z);
    piece.castShadow = true;
    piece.receiveShadow = true;
    group.add(piece);
  }
  return group;
}

function stampContactShadow(paint: GroundPaint, block: ArenaBlock): void {
  const margin = block.material === 'sandbag' ? 0.8 : 1.1;
  paint.stamp({
    kind: 'contact',
    x: block.x + block.width / 2 - 32,
    z: block.y + block.height / 2 - 20,
    width: block.height + margin * 2,
    length: block.width + margin * 2,
    margin,
    strength: 0.85,
  });
}

/** Precast concrete: a run of separate blocks, each a little off true, like pieces set by hand. */
function concreteBlocks(block: ArenaBlock, material: Material, keep: Keep, rng: Rng): Group {
  const group = new Group();
  const alongX = block.width >= block.height;
  const long = alongX ? block.width : block.height;
  const short = alongX ? block.height : block.width;
  const count = Math.max(1, Math.round(long / 2));
  const piece = long / count;
  const textureOffset = rng.float(0, 10);
  const chips = createGradientNoise(rng.int(1, 1e6));
  for (let index = 0; index < count; index++) {
    const height = WALL_HEIGHT.concrete + rng.float(-0.06, 0.06);
    const geometry = keep(new RoundedBoxGeometry(piece - 0.1, height, short - 0.14, 3, 0.11));
    chip(geometry, chips, index * 7.3);
    projectBoxUvs(geometry, 2.6, textureOffset + index * 1.7);
    const mesh = new Mesh(geometry, material);
    const along = -long / 2 + piece * (index + 0.5);
    const centre = toTable(block.x + block.width / 2, block.y + block.height / 2, height / 2);
    mesh.position.copy(centre).add(alongX ? new Vector3(along, 0, 0) : new Vector3(0, 0, along));
    mesh.rotation.y = (alongX ? 0 : Math.PI / 2) + rng.float(-0.012, 0.012);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** Dents the corners and edges of a cast block, so no two pieces have the same silhouette. */
function chip(
  geometry: BufferGeometry,
  noise: ReturnType<typeof createGradientNoise>,
  seed: number,
): void {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const dent = Math.min(0, noise.sample(x * 2.2 + seed, y * 2.2 + z * 1.7)) * 0.07;
    positions.setXYZ(
      index,
      x + normals.getX(index) * dent,
      y + normals.getY(index) * dent,
      z + normals.getZ(index) * dent,
    );
  }
  geometry.computeVertexNormals();
}

/** A broken brick wall: its top knocked into a ragged line, with rubble at its feet. */
function ruinWall(block: ArenaBlock, material: Material, keep: Keep, rng: Rng): Group {
  const group = new Group();
  const alongX = block.width >= block.height;
  const long = (alongX ? block.width : block.height) - 0.12;
  const thick = (alongX ? block.height : block.width) - 0.5;
  const height = WALL_HEIGHT.ruin;
  const geometry = keep(new BoxGeometry(long, height, thick, Math.ceil(long * 4), 6, 1));
  const noise = createGradientNoise(rng.int(1, 1e6));
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const up = (y + height / 2) / height;
    // Knock the top down unevenly, more towards the ends, never below a shell's flight height.
    const end = smoothstep(long / 2 - 1.2, long / 2, Math.abs(x));
    const bite = (noise.sample(x * 0.9, 0.5) * 0.5 + 0.5) * 0.55 + end * 0.35;
    const lowered = y - up * up * bite * 0.75;
    const crumble = noise.sample(x * 3.1, y * 3.1 + z) * 0.03 * up;
    positions.setXYZ(index, x, Math.max(lowered, -height / 2 + 1.15 * up), z + crumble);
  }
  geometry.computeVertexNormals();
  geometry.translate(0, height / 2, 0);
  projectBoxUvs(geometry, 2.2, rng.float(0, 10));
  const wall = new Mesh(geometry, material);
  wall.position.copy(toTable(block.x + block.width / 2, block.y + block.height / 2));
  wall.rotation.y = alongX ? 0 : Math.PI / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const rubbleGeometry = keep(new RoundedBoxGeometry(0.24, 0.12, 0.12, 1, 0.025));
  projectBoxUvs(rubbleGeometry, 2.2);
  const pieces = Math.ceil(long * 3);
  const rubble = new InstancedMesh(rubbleGeometry, material, pieces);
  const matrix = new Matrix4();
  for (let index = 0; index < pieces; index++) {
    const along = rng.float(-long / 2, long / 2);
    const side = (rng.chance(0.5) ? 1 : -1) * rng.float(thick / 2, thick / 2 + 0.35);
    const local = new Vector3(along, rng.float(0.05, 0.12), side);
    if (!alongX) local.set(side, local.y, along);
    const position = toTable(block.x + block.width / 2, block.y + block.height / 2).add(local);
    const rotation = new Quaternion().setFromEuler(
      new Euler(rng.float(-0.4, 0.4), rng.float(0, Math.PI), rng.float(-0.4, 0.4)),
    );
    matrix.compose(position, rotation, new Vector3(1, 1, 1).multiplyScalar(rng.float(0.7, 1.3)));
    rubble.setMatrixAt(index, matrix);
  }
  rubble.castShadow = true;
  rubble.receiveShadow = true;
  group.add(rubble);
  return group;
}

/** A plump burlap bag: a rounded block squeezed thinner towards its ends and edges. */
function sandbagGeometry(keep: Keep): BufferGeometry {
  const geometry = keep(new RoundedBoxGeometry(0.98, 0.36, 0.86, 4, 0.16));
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index) / 0.49;
    const y = positions.getY(index);
    const z = positions.getZ(index) / 0.43;
    const edge = Math.min(1, Math.max(Math.abs(x), Math.abs(z)));
    const squeeze = y > 0 ? 1 - 0.55 * edge * edge * edge : 1 - 0.25 * edge * edge;
    positions.setY(index, y * squeeze);
  }
  geometry.computeVertexNormals();
  projectBoxUvs(geometry, 0.9);
  return geometry;
}

/** Sandbags laid in staggered courses, two bags deep. */
function sandbagWall(block: ArenaBlock, material: Material, keep: Keep, rng: Rng): InstancedMesh {
  const alongX = block.width >= block.height;
  const long = alongX ? block.width : block.height;
  const deep = alongX ? block.height : block.width;
  const courses = 4;
  const bagsAlong = Math.round(long / 1);
  const rows = Math.max(1, Math.round(deep / 0.95));
  const total = courses * rows * (bagsAlong + 1);
  const bags = new InstancedMesh(sandbagGeometry(keep), material, total);
  const matrix = new Matrix4();
  const colour = new Color();
  let count = 0;
  for (let course = 0; course < courses; course++) {
    const stagger = course % 2 === 1 ? 0.5 : 0;
    const slots = bagsAlong + (stagger > 0 ? -1 : 0);
    for (let row = 0; row < rows; row++) {
      for (let slot = 0; slot < slots; slot++) {
        const along = -long / 2 + (slot + 0.5 + stagger) * (long / bagsAlong);
        const across = -deep / 2 + (row + 0.5) * (deep / rows);
        const inset = course === courses - 1 ? 0.06 : 0;
        const local = alongX
          ? new Vector3(along, 0, across * (1 - inset))
          : new Vector3(across * (1 - inset), 0, along);
        const position = toTable(
          block.x + block.width / 2,
          block.y + block.height / 2,
          0.17 + course * 0.3,
        ).add(local);
        const yaw = (alongX ? 0 : Math.PI / 2) + rng.float(-0.1, 0.1);
        const rotation = new Quaternion().setFromEuler(
          new Euler(rng.float(-0.05, 0.05), yaw, rng.float(-0.05, 0.05)),
        );
        matrix.compose(
          position,
          rotation,
          new Vector3(rng.float(0.94, 1.04), rng.float(0.9, 1.06), rng.float(0.94, 1.04)),
        );
        bags.setMatrixAt(count, matrix);
        bags.setColorAt(
          count,
          colour.setHSL(0.1 + rng.float(-0.012, 0.012), 0.12, 0.82 + rng.float(-0.09, 0.06)),
        );
        count++;
      }
    }
  }
  bags.count = count;
  bags.castShadow = true;
  bags.receiveShadow = true;
  return bags;
}

/** A steel bumper post: a diamond with a black-and-yellow hazard band and a lamp on top. */
function bumperPost(
  bumper: ArenaBumper,
  keep: Keep,
  keepMaterial: KeepMaterial,
  surface: KeepSurface,
) {
  const group = new Group();
  group.position.copy(toTable(bumper.center.x, bumper.center.y));
  const r = bumper.radius - 0.08;
  const diamond: [number, number][] = [
    [r, 0],
    [0, r],
    [-r, 0],
    [0, -r],
  ];
  const steel = keepMaterial(
    new MeshStandardMaterial({ color: '#7d8287', roughness: 0.38, metalness: 0.85 }),
  );
  const body = new Mesh(keep(planSolid(diamond, WALL_HEIGHT.bumper, 0.1)), steel);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const stripes = surface(
    bakeSurface({
      size: 64,
      normalStrength: 0.5,
      height: (u, v) => ((u + v) % 0.5 < 0.25 ? 1 : 0),
      colour: (height) => (height > 0.5 ? [232, 182, 30] : [28, 26, 24]),
      roughness: () => 0.5,
    }),
  );
  const bandMaterial = keepMaterial(
    new MeshStandardMaterial({ map: stripes.map, roughness: 0.55, metalness: 0.2 }),
  );
  const bandGeometry = keep(planSolid(diamond, 0.32, 0.03));
  projectBoxUvs(bandGeometry, 0.9);
  const band = new Mesh(bandGeometry, bandMaterial);
  band.scale.set(1.04, 1, 1.04);
  band.position.y = 0.55;
  band.castShadow = true;
  group.add(band);

  const lamp = keepMaterial(lampMaterial('#ff8c1a'));
  lamp.color.set('#ffb35c');
  const cap = new Mesh(keep(new CylinderGeometry(0.16, 0.2, 0.18, 12)), lamp);
  cap.position.y = WALL_HEIGHT.bumper + 0.08;
  cap.castShadow = true;
  group.add(cap);
  return { group, lamp };
}

/** Pebbles and dry grass on open floor, kept clear of walls and spawns so nothing looks like cover. */
function scatterDecor(arena: Arena, keep: Keep, keepMaterial: KeepMaterial, rng: Rng): Group {
  const group = new Group();
  const clearOf = (x: number, y: number, room: number): boolean => {
    for (const block of arena.blocks) {
      if (
        x > block.x - room &&
        x < block.x + block.width + room &&
        y > block.y - room &&
        y < block.y + block.height + room
      )
        return false;
    }
    for (const bumper of arena.bumpers) {
      if (Math.abs(x - bumper.center.x) + Math.abs(y - bumper.center.y) < bumper.radius + room)
        return false;
    }
    return arena.spawns.every(
      (spawn) => Math.hypot(spawn.position.x - x, spawn.position.y - y) > 3.5,
    );
  };
  const spot = (room: number): Vector3 | null => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rng.float(2.5, 61.5);
      const y = rng.float(2.5, 37.5);
      if (clearOf(x, y, room)) return toTable(x, y);
    }
    return null;
  };

  const rockGeometry = keep(new DodecahedronGeometry(0.16, 0));
  const rockMaterial = keepMaterial(new MeshStandardMaterial({ color: '#8f8270', roughness: 0.9 }));
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, 70);
  const matrix = new Matrix4();
  const colour = new Color();
  let rockCount = 0;
  for (let index = 0; index < 70; index++) {
    const at = spot(0.5);
    if (!at) continue;
    const size = rng.float(0.5, 1.6);
    matrix.compose(
      at.setY(0.04 * size),
      new Quaternion().setFromEuler(new Euler(rng.float(0, 3), rng.float(0, 3), rng.float(0, 3))),
      new Vector3(size, size * rng.float(0.45, 0.8), size * rng.float(0.8, 1.2)),
    );
    rocks.setMatrixAt(rockCount, matrix);
    rocks.setColorAt(rockCount, colour.setHSL(0.08, 0.1, rng.float(0.42, 0.62)));
    rockCount++;
  }
  rocks.count = rockCount;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  const grass = keepMaterial(new MeshStandardMaterial({ color: '#8d8a4a', roughness: 0.85 }));
  const tufts = new InstancedMesh(keep(tuftGeometry(rng)), grass, 60);
  let tuftCount = 0;
  for (let index = 0; index < 60; index++) {
    const at = spot(0.8);
    if (!at) continue;
    const size = rng.float(0.7, 1.3);
    matrix.compose(
      at,
      new Quaternion().setFromEuler(new Euler(0, rng.float(0, 6.3), 0)),
      new Vector3(size, size, size),
    );
    tufts.setMatrixAt(tuftCount, matrix);
    tufts.setColorAt(
      tuftCount,
      colour.setHSL(0.15 + rng.float(-0.03, 0.03), 0.35, rng.float(0.42, 0.6)),
    );
    tuftCount++;
  }
  tufts.count = tuftCount;
  tufts.castShadow = true;
  group.add(tufts);
  return group;
}

/** A tuft of dry grass: a handful of thin blades leaning outwards. */
function tuftGeometry(rng: Rng): BufferGeometry {
  const blades: BufferGeometry[] = [];
  for (let blade = 0; blade < 7; blade++) {
    const cone = new ConeGeometry(0.035, rng.float(0.3, 0.5), 3);
    cone.translate(0, 0.2, 0);
    cone.rotateZ(rng.float(-0.5, 0.5));
    cone.rotateY((blade / 7) * Math.PI * 2);
    cone.translate(rng.float(-0.06, 0.06), 0, rng.float(-0.06, 0.06));
    blades.push(cone);
  }
  const merged = mergeGeometries(blades);
  for (const blade of blades) blade.dispose();
  return merged;
}

/**
 * The feet of the walls: grass that grows where tanks cannot drive, and chips knocked off the
 * concrete. Only along walls, so it never stands in open ground looking like cover.
 */
function wallFeet(
  arena: Arena,
  concrete: Material,
  keep: Keep,
  keepMaterial: KeepMaterial,
  rng: Rng,
): Group {
  const group = new Group();
  const spots: { at: Vector3; kind: 'grass' | 'chip' }[] = [];
  for (const block of arena.blocks) {
    const perimeter = 2 * (block.width + block.height);
    for (let along = 0; along < perimeter; along += 0.55) {
      if (!rng.chance(0.42)) continue;
      const out = rng.float(0.12, 0.55);
      const [x, y] = perimeterPoint(block, along, out);
      if (arena.isSolid(Math.floor(x / 2), Math.floor(y / 2))) continue;
      spots.push({ at: toTable(x, y), kind: rng.chance(0.55) ? 'grass' : 'chip' });
    }
  }
  const matrix = new Matrix4();
  const colour = new Color();
  const grassSpots = spots.filter((spot) => spot.kind === 'grass');
  const chipSpots = spots.filter((spot) => spot.kind === 'chip');

  const grass = keepMaterial(new MeshStandardMaterial({ color: '#a29a56', roughness: 0.85 }));
  const tufts = new InstancedMesh(keep(tuftGeometry(rng)), grass, Math.max(1, grassSpots.length));
  grassSpots.forEach((spot, index) => {
    const size = rng.float(0.6, 1.15);
    matrix.compose(
      spot.at,
      new Quaternion().setFromEuler(new Euler(0, rng.float(0, 6.3), 0)),
      new Vector3(size, size, size),
    );
    tufts.setMatrixAt(index, matrix);
    tufts.setColorAt(
      index,
      colour.setHSL(0.14 + rng.float(-0.03, 0.04), 0.32, rng.float(0.38, 0.56)),
    );
  });
  tufts.count = grassSpots.length;
  tufts.castShadow = true;
  group.add(tufts);

  const chipGeometry = keep(new RoundedBoxGeometry(0.26, 0.16, 0.2, 1, 0.04));
  projectBoxUvs(chipGeometry, 2.6);
  const chips = new InstancedMesh(chipGeometry, concrete, Math.max(1, chipSpots.length));
  chipSpots.forEach((spot, index) => {
    const size = rng.float(0.5, 1.3);
    matrix.compose(
      spot.at.setY(0.05 * size),
      new Quaternion().setFromEuler(
        new Euler(rng.float(-0.5, 0.5), rng.float(0, 6.3), rng.float(-0.5, 0.5)),
      ),
      new Vector3(size, size * rng.float(0.6, 1), size),
    );
    chips.setMatrixAt(index, matrix);
  });
  chips.count = chipSpots.length;
  chips.castShadow = true;
  chips.receiveShadow = true;
  group.add(chips);
  return group;
}

/** A point `out` units outside a block's edge, `along` units round its perimeter from the top-left corner. */
function perimeterPoint(block: ArenaBlock, along: number, out: number): [number, number] {
  const { x, y, width, height } = block;
  if (along < width) return [x + along, y - out];
  if (along < width + height) return [x + width + out, y + along - width];
  if (along < 2 * width + height) return [x + width - (along - width - height), y + height + out];
  return [x - out, y + height - (along - 2 * width - height)];
}

/** Faint scorches and old tread marks, so the board looks fought over before the first shot. */
function stampOldBattles(paint: GroundPaint, arena: Arena, rng: Rng): void {
  for (let index = 0; index < 7; index++) {
    paint.stamp({
      kind: 'scorch',
      x: rng.float(-28, 28),
      z: rng.float(-16, 16),
      width: rng.float(2.5, 4.5),
      length: rng.float(2.5, 4.5),
      angle: rng.float(0, 3),
      strength: rng.float(0.15, 0.3),
    });
  }
  for (let path = 0; path < 6; path++) {
    let x = rng.float(4, 60);
    let y = rng.float(4, 36);
    let heading = rng.float(0, Math.PI * 2);
    for (let step = 0; step < 90; step++) {
      heading += rng.float(-0.12, 0.12);
      const nextX = x + Math.cos(heading) * 0.3;
      const nextY = y + Math.sin(heading) * 0.3;
      const blocked = arena.isSolid(Math.floor(nextX / 2), Math.floor(nextY / 2));
      if (blocked) {
        heading += Math.PI / 2;
        continue;
      }
      x = nextX;
      y = nextY;
      paint.stamp({
        kind: 'track',
        x: x - 32,
        z: y - 20,
        width: 2.2,
        length: 0.5,
        angle: heading,
        strength: 0.32,
      });
    }
  }
}
