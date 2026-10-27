/**
 * The Polar Expedition's ground: a surveyed snowfield. The 63 squares are
 * pillows of fresh snow between tramped grooves, with a survey stake at
 * every corner and a rope round the edge. Checking a square digs its pillow
 * away. Around the field the snow drifts up into banks, each team's tent
 * stands by its home corner, and behind it all hangs a painted sky: distant
 * ice ridges, a pale sun by day, and stars and the aurora by night. The
 * camera is orthographic, so "distance" behind the field is painted rather
 * than modelled, like the backdrop of a diorama.
 */
import {
  bakeSurface,
  createGradientNoise,
  createGroundPaint,
  disposeSurface,
  fbm,
  hexToRgb,
  mixRgb,
  repeatSurface,
  smoothstep,
  type GroundPaint,
  type SurfaceRecipe,
} from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type IUniform,
  type Material,
} from 'three';
import { COLUMNS, ROWS, SQUARE_COUNT, spotOf, type Square } from '../../engine/grid.ts';
import { FIELD_DEPTH, FIELD_WIDTH, SQUARE_SIZE, squareX, squareZ } from '../../look/field-space.ts';
import type { SeatColours } from '../../look/look.ts';
import { buildCamp, type Keep, type Own } from './camp.ts';

/** Boot prints and runner tracks press well into fresh snow. */
const SNOW_RESPONSE = { trackShade: 0.42 };

/** How high an untouched pillow of snow stands in the middle. */
export const PILLOW_HEIGHT = 0.55;
const PILLOW_SIZE = SQUARE_SIZE - 0.34;
/** Where the painted sky stands, just behind the far snow bank. */
const BACKDROP_Z = -17.6;
const GROUND_WIDTH = 96;
const GROUND_NEAR = 34;
const GROUND_FAR = BACKDROP_Z - 0.4;

export interface Snowfield {
  readonly root: Group;
  readonly groundPaint: GroundPaint;
  /** Height of the snow in the middle of a square: the pillow until it is dug away. */
  standingHeight(square: Square): number;
  /** Height of the snow surface under a point of the field, pillows included. */
  surfaceHeight(x: number, z: number): number;
  /** Digs a square's pillow away over `seconds` (0 for at once). */
  dig(square: Square, seconds: number): void;
  /** Puts a pillow back: a Classic Memory clue covered again. */
  refill(square: Square): void;
  /** A new field: every dug square fills with fresh snow, rippling out from the middle. */
  refillAll(): void;
  /** The possibility fog: pillows that cannot hide the flag go grey-blue; null clears it. */
  setFog(possible: readonly boolean[] | null): void;
  update(dt: number): void;
  dispose(): void;
}

export interface SnowfieldOptions {
  readonly rng: Rng;
  readonly night: boolean;
  readonly seats: readonly [SeatColours, SeatColours];
}

interface Sparkle {
  readonly time: IUniform<number>;
  readonly colour: IUniform<Color>;
  readonly strength: IUniform<number>;
}

export function createSnowfield(options: SnowfieldOptions): Snowfield {
  const { rng, night } = options;
  const root = new Group();
  root.name = 'snowfield';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep: Keep = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };
  const own: Own = (material) => {
    materials.push(material);
    return material;
  };

  const groundPaint = createGroundPaint({ width: 64, depth: 44, resolution: 16 });
  const sparkle: Sparkle = {
    time: { value: 0 },
    colour: { value: new Color(night ? '#8cbcff' : '#fffaf0') },
    strength: { value: night ? 1.4 : 2.6 },
  };
  let elapsed = 0;

  const snow = repeatSurface(bakeSurface(snowRecipe(rng.int(1, 1e6))), 12, 7);
  const snowMaterial = own(snowMaterialFrom(snow, night ? '#dfe8f6' : '#f7fbff', sparkle));
  groundPaint.applyTo(snowMaterial, SNOW_RESPONSE);
  const ground = new Mesh(keep(groundGeometry(rng)), snowMaterial);
  ground.receiveShadow = true;
  root.add(ground);

  // The pillows share one geometry; each gets its own quarter turn so no two look alike.
  const pillowSurface = bakeSurface(snowRecipe(rng.int(1, 1e6), 256));
  const pillowMaterial = own(
    snowMaterialFrom(pillowSurface, night ? '#e4ecf8' : '#ffffff', sparkle),
  );
  groundPaint.applyTo(pillowMaterial, SNOW_RESPONSE);
  const pillows = new InstancedMesh(keep(pillowGeometry()), pillowMaterial, SQUARE_COUNT);
  pillows.castShadow = true;
  pillows.receiveShadow = true;
  const turns = Array.from({ length: SQUARE_COUNT }, () => rng.int(0, 3));
  const pillowScale = new Float32Array(SQUARE_COUNT).fill(1);
  const digs = new Map<Square, { from: number; age: number; seconds: number }>();
  const fills = new Map<Square, { wait: number; age: number }>();
  const clearSnow = new Color('#ffffff');
  const foggedSnow = new Color(night ? '#5d6f8c' : '#9db0c9');
  for (let square = 0; square < SQUARE_COUNT; square++) pillows.setColorAt(square, clearSnow);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const placePillow = (square: Square) => {
    const { column, row } = spotOf(square);
    const scale = pillowScale[square] ?? 1;
    turn.setFromAxisAngle(up, ((turns[square] ?? 0) * Math.PI) / 2);
    // A pillow dug right away disappears, so the ground and its marks show through.
    const size = scale < 0.01 ? 0 : 1;
    matrix.compose(
      new Vector3(squareX(column), 0, squareZ(row)),
      turn,
      new Vector3(size, scale * size, size),
    );
    pillows.setMatrixAt(square, matrix);
    pillows.instanceMatrix.needsUpdate = true;
  };
  for (let square = 0; square < SQUARE_COUNT; square++) placePillow(square);
  root.add(pillows);

  for (let column = 0; column <= COLUMNS; column++) {
    groundPaint.stamp({
      kind: 'contact',
      x: squareX(column) - SQUARE_SIZE / 2,
      z: 0,
      width: 0.34 + 0.6,
      length: FIELD_DEPTH,
      angle: Math.PI / 2,
      margin: 0.3,
      strength: 0.5,
    });
  }
  for (let row = 0; row <= ROWS; row++) {
    groundPaint.stamp({
      kind: 'contact',
      x: 0,
      z: squareZ(row) - SQUARE_SIZE / 2,
      width: 0.34 + 0.6,
      length: FIELD_WIDTH,
      margin: 0.3,
      strength: 0.5,
    });
  }

  root.add(buildSurvey(rng, own, keep, night));
  root.add(buildBackdrop(night, keep, own, sparkle.time));
  const camps = buildCamps(options, own, keep);
  root.add(camps.root);
  root.add(scatterRocks(rng, own, keep));

  return {
    root,
    groundPaint,
    standingHeight(square) {
      return PILLOW_HEIGHT * (pillowScale[square] ?? 1);
    },
    surfaceHeight(x, z) {
      const column = Math.floor(x / SQUARE_SIZE + COLUMNS / 2);
      const row = Math.floor(z / SQUARE_SIZE + ROWS / 2);
      if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return 0;
      const square = row * COLUMNS + column;
      const half = PILLOW_SIZE / 2;
      const across = Math.max(Math.abs(x - squareX(column)), Math.abs(z - squareZ(row))) / half;
      if (across >= 1) return 0;
      return PILLOW_HEIGHT * (pillowScale[square] ?? 1) * pillowProfile(across);
    },
    dig(square, seconds) {
      if (seconds <= 0) {
        digs.delete(square);
        pillowScale[square] = 0;
        placePillow(square);
        return;
      }
      digs.set(square, { from: pillowScale[square] ?? 1, age: 0, seconds });
    },
    refill(square) {
      digs.delete(square);
      pillowScale[square] = 1;
      placePillow(square);
    },
    refillAll() {
      digs.clear();
      for (let square = 0; square < SQUARE_COUNT; square++) {
        if ((pillowScale[square] ?? 1) >= 1) continue;
        const { column, row } = spotOf(square);
        const fromMiddle = Math.hypot(column - (COLUMNS - 1) / 2, row - (ROWS - 1) / 2);
        fills.set(square, { wait: fromMiddle * 0.04, age: 0 });
      }
    },
    setFog(possible) {
      for (let square = 0; square < SQUARE_COUNT; square++) {
        const fogged = possible !== null && possible[square] === false;
        pillows.setColorAt(square, fogged ? foggedSnow : clearSnow);
      }
      if (pillows.instanceColor) pillows.instanceColor.needsUpdate = true;
    },
    update(dt) {
      elapsed += dt;
      sparkle.time.value = elapsed;
      camps.update(elapsed);
      for (const [square, fill] of fills) {
        if (fill.wait > 0) {
          fill.wait -= dt;
          continue;
        }
        fill.age = Math.min(0.45, fill.age + dt);
        const t = fill.age / 0.45;
        pillowScale[square] = Math.max(pillowScale[square] ?? 0, 1 - (1 - t) * (1 - t));
        placePillow(square);
        if (fill.age >= 0.45) fills.delete(square);
      }
      for (const [square, dig] of digs) {
        dig.age = Math.min(dig.seconds, dig.age + dt);
        const t = dig.age / dig.seconds;
        pillowScale[square] = dig.from * (1 - t) * (1 - t);
        placePillow(square);
        if (dig.age >= dig.seconds) digs.delete(square);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      disposeSurface(snow);
      disposeSurface(pillowSurface);
      groundPaint.dispose();
    },
  };
}

function snowMaterialFrom(
  surface: ReturnType<typeof bakeSurface>,
  colour: string,
  sparkle: Sparkle,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: colour,
    map: surface.map,
    normalMap: surface.normalMap,
    roughnessMap: surface.roughnessMap,
    roughness: 1,
    envMapIntensity: 0.15,
  });
  addSparkle(material, sparkle);
  return material;
}

/** Wind-packed snow: long soft sastrugi ridges, a fine crust and the odd hollow in blue shade. */
export function snowRecipe(seed: number, size = 512): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const warp = createGradientNoise(seed + 13);
  const white = hexToRgb('#fbfdff');
  const shade = hexToRgb('#d6e3f2');
  return {
    size,
    normalStrength: 1.5,
    height(u, v) {
      const bend = fbm(warp, u, v, { frequency: 2, octaves: 3 }) * 1.6;
      const ridge = Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * (u * 5 + v + bend)), 3);
      const crust = fbm(noise, u, v, { frequency: 40, octaves: 3 }) * 0.5 + 0.5;
      const swell = fbm(noise, u + 0.3, v, { frequency: 3, octaves: 4 }) * 0.5 + 0.5;
      return ridge * 0.07 + crust * 0.12 + swell * 0.5;
    },
    colour(height) {
      return mixRgb(shade, white, smoothstep(0.18, 0.62, height));
    },
    roughness(height) {
      return 0.86 - height * 0.08;
    },
  };
}

/**
 * Glints: tiny crystals that flash as the light catches them. They sit on a world-space lattice,
 * so the pillows and the open snow glitter together, and they twinkle slowly.
 */
function addSparkle(material: MeshStandardMaterial, sparkle: Sparkle): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sparkleTime = sparkle.time;
    shader.uniforms.sparkleColour = sparkle.colour;
    shader.uniforms.sparkleStrength = sparkle.strength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSparkleWorld;')
      .replace(
        '#include <worldpos_vertex>',
        [
          '#include <worldpos_vertex>',
          'vec4 sparkleLocal = vec4(transformed, 1.0);',
          '#ifdef USE_INSTANCING',
          'sparkleLocal = instanceMatrix * sparkleLocal;',
          '#endif',
          'vSparkleWorld = (modelMatrix * sparkleLocal).xyz;',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vSparkleWorld;',
          'uniform float sparkleTime;',
          'uniform vec3 sparkleColour;',
          'uniform float sparkleStrength;',
          'float sparkleHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }',
        ].join('\n'),
      )
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          'vec2 sparkleCell = floor(vSparkleWorld.xz * 7.0);',
          'float sparkleSeed = sparkleHash(sparkleCell);',
          'vec2 sparkleOffset = vec2(sparkleHash(sparkleCell + 3.1), sparkleHash(sparkleCell + 7.7)) * 0.6 + 0.2;',
          'float sparkleDot = 1.0 - smoothstep(0.0, 0.07, length(fract(vSparkleWorld.xz * 7.0) - sparkleOffset));',
          'float sparkleTwinkle = pow(0.5 + 0.5 * sin(sparkleTime * (1.5 + sparkleSeed * 3.0) + sparkleSeed * 40.0), 6.0);',
          'totalEmissiveRadiance += sparkleColour * sparkleDot * step(0.93, sparkleSeed) * sparkleTwinkle * sparkleStrength;',
        ].join('\n'),
      );
  };
}

/**
 * The open snow: flat inside the survey, drifting into banks outside it, and climbing into a bank
 * behind the far edge that hides the foot of the painted sky.
 */
function groundGeometry(rng: Rng): BufferGeometry {
  const depth = GROUND_NEAR - GROUND_FAR;
  const geometry = new PlaneGeometry(GROUND_WIDTH, depth, 192, 110);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, (GROUND_NEAR + GROUND_FAR) / 2);
  const drifts = createGradientNoise(rng.int(1, 1e6));
  const position = geometry.getAttribute('position');
  const halfWidth = FIELD_WIDTH / 2 + 1.2;
  const halfDepth = FIELD_DEPTH / 2 + 1.2;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const outside = Math.max(Math.abs(x) - halfWidth, z - halfDepth, 0);
    const swell = drifts.sample(x * 0.07, z * 0.07) * 0.5 + 0.5;
    const ripple = drifts.sample(x * 0.21 + 9, z * 0.21) * 0.5 + 0.5;
    let height = smoothstep(0, 7, outside) * (0.6 + swell * 2.4 + ripple * 0.6);
    // A low lip of snow along the far side hides the foot of the painted sky.
    height += smoothstep(-halfDepth - 0.8, BACKDROP_Z + 0.4, z) * (0.5 + swell * 0.7);
    position.setY(index, height);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A pillow's height from its middle (0) to its edge (1): a soft dome with rounded shoulders. */
function pillowProfile(across: number): number {
  return 1 - Math.pow(Math.min(1, across), 3.2);
}

/** One pillow: a soft square cushion with rounded shoulders, a little lopsided. */
function pillowGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(PILLOW_SIZE, PILLOW_SIZE, 28, 28);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  const half = PILLOW_SIZE / 2;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index) / half;
    const z = position.getZ(index) / half;
    const shoulder = pillowProfile(Math.max(Math.abs(x), Math.abs(z)));
    const lean = 1 + 0.08 * x - 0.05 * z;
    const lumps = 0.04 * Math.sin(x * 5.1 + z * 2.3) * Math.cos(z * 4.7 - x);
    // The skirt tucks in a little, so each pillow meets the groove with a soft shoulder.
    const tuck = 1 - 0.03 * (1 - shoulder);
    position.setX(index, position.getX(index) * tuck);
    position.setZ(index, position.getZ(index) * tuck);
    position.setY(index, Math.max(0, PILLOW_HEIGHT * shoulder * (lean + lumps)) - 0.02);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A bamboo stake at every corner of every square, flagged in surveyor's red; a rope round the edge. */
function buildSurvey(rng: Rng, own: Own, keep: Keep, night: boolean): Group {
  const group = new Group();
  group.name = 'survey';
  const stakeMaterial = own(new MeshStandardMaterial({ color: '#c9a36a', roughness: 0.7 }));
  const tapeMaterial = own(
    new MeshStandardMaterial({
      color: '#e2432f',
      roughness: 0.55,
      side: DoubleSide,
      emissive: new Color('#ff5a3a'),
      emissiveIntensity: night ? 0.35 : 0,
    }),
  );
  const corners = (COLUMNS + 1) * (ROWS + 1);
  const stakes = new InstancedMesh(
    keep(new CylinderGeometry(0.06, 0.08, 1.2, 6)),
    stakeMaterial,
    corners,
  );
  const tapes = new InstancedMesh(keep(tapeGeometry()), tapeMaterial, corners);
  stakes.castShadow = true;
  tapes.castShadow = true;
  const matrix = new Matrix4();
  const lean = new Quaternion();
  const flutter = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const unit = new Vector3(1, 1, 1);
  let index = 0;
  for (let row = 0; row <= ROWS; row++) {
    for (let column = 0; column <= COLUMNS; column++) {
      const x = squareX(column) - SQUARE_SIZE / 2;
      const z = squareZ(row) - SQUARE_SIZE / 2;
      const tiltX = rng.float(-0.06, 0.06);
      const tiltZ = rng.float(-0.06, 0.06);
      lean.setFromEuler(new Euler(tiltX, 0, tiltZ));
      matrix.compose(new Vector3(x, 0.5, z), lean, unit);
      stakes.setMatrixAt(index, matrix);
      flutter.setFromAxisAngle(up, rng.float(-0.8, 0.8) + Math.PI * 0.25);
      matrix.compose(
        new Vector3(x - tiltZ * 1.1, 1.02, z + tiltX * 1.1),
        lean.clone().multiply(flutter),
        unit,
      );
      tapes.setMatrixAt(index, matrix);
      index++;
    }
  }
  group.add(stakes, tapes);

  const rope = new Mesh(
    keep(new TubeGeometry(perimeterRope(), 480, 0.035, 5, true)),
    own(new MeshStandardMaterial({ color: '#d8b98a', roughness: 0.9 })),
  );
  rope.castShadow = true;
  group.add(rope);
  return group;
}

/** The rope round the survey, tied to each perimeter stake and sagging a little between them. */
function perimeterRope(): CatmullRomCurve3 {
  const left = -FIELD_WIDTH / 2;
  const far = -FIELD_DEPTH / 2;
  const corners: [number, number][] = [];
  for (let column = 0; column <= COLUMNS; column++) corners.push([column, 0]);
  for (let row = 1; row <= ROWS; row++) corners.push([COLUMNS, row]);
  for (let column = COLUMNS - 1; column >= 0; column--) corners.push([column, ROWS]);
  for (let row = ROWS - 1; row >= 1; row--) corners.push([0, row]);
  const points: Vector3[] = [];
  corners.forEach(([column, row], index) => {
    const [nextColumn, nextRow] = corners[(index + 1) % corners.length] ?? [0, 0];
    const x = left + column * SQUARE_SIZE;
    const z = far + row * SQUARE_SIZE;
    const nextX = left + nextColumn * SQUARE_SIZE;
    const nextZ = far + nextRow * SQUARE_SIZE;
    points.push(new Vector3(x, 0.84, z), new Vector3((x + nextX) / 2, 0.66, (z + nextZ) / 2));
  });
  return new CatmullRomCurve3(points, true, 'catmullrom', 0.1);
}

/** A strip of surveyor's tape tied round the stake's top, its tail lifting in the wind. */
function tapeGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(0.42, 0.11, 6, 1);
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index) + 0.21;
    position.setX(index, x);
    position.setZ(index, Math.sin(x * 9) * 0.05);
    position.setY(index, position.getY(index) - x * 0.25);
  }
  geometry.computeVertexNormals();
  return geometry;
}

interface Camps {
  readonly root: Group;
  update(time: number): void;
}

/** Both teams' camps, each beside its home corner and turned to face the field. */
function buildCamps(options: SnowfieldOptions, own: Own, keep: Keep): Camps {
  const root = new Group();
  root.name = 'camps';
  const places = [
    { x: -FIELD_WIDTH / 2 - 4.1, z: -FIELD_DEPTH / 2 + 3.4, turn: 0.9 },
    { x: FIELD_WIDTH / 2 + 4.1, z: FIELD_DEPTH / 2 - 3.6, turn: Math.PI + 0.9 },
  ];
  const camps = places.map((place, seat) => {
    const camp = buildCamp(options.seats[seat] ?? options.seats[0], options.night, own, keep);
    camp.root.position.set(place.x, 0, place.z);
    camp.root.rotation.y = place.turn;
    root.add(camp.root);
    return camp;
  });
  return {
    root,
    update(time) {
      for (const camp of camps) camp.update(time);
    },
  };
}

/** A few dark rocks breaking through the snow outside the survey, to give the white some scale. */
function scatterRocks(rng: Rng, own: Own, keep: Keep): Group {
  const group = new Group();
  const count = 12;
  const rocks = new InstancedMesh(
    keep(new DodecahedronGeometry(1, 1)),
    own(new MeshStandardMaterial({ color: '#5b6573', roughness: 0.85, flatShading: true })),
    count,
  );
  const caps = new InstancedMesh(
    keep(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.2)),
    own(new MeshStandardMaterial({ color: '#f4f8ff', roughness: 0.9 })),
    count,
  );
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  caps.receiveShadow = true;
  const matrix = new Matrix4();
  const spin = new Quaternion();
  const spots: [number, number][] = [];
  while (spots.length < count) {
    const x = rng.float(-40, 40);
    const z = rng.float(-15.5, 22);
    const clearOfField = Math.abs(x) > FIELD_WIDTH / 2 + 3.5 || z > FIELD_DEPTH / 2 + 3.5;
    const clearOfCamps =
      Math.hypot(Math.abs(x) - FIELD_WIDTH / 2 - 4.6, Math.abs(z) - FIELD_DEPTH / 2 + 2.6) > 5.5;
    if (clearOfField && clearOfCamps) spots.push([x, z]);
  }
  spots.forEach(([x, z], index) => {
    const size = rng.float(0.5, 1.4);
    spin.setFromAxisAngle(
      new Vector3(rng.float(-1, 1), 1, rng.float(-1, 1)).normalize(),
      rng.float(0, 6),
    );
    matrix.compose(new Vector3(x, size * 0.15, z), spin, new Vector3(size * 1.3, size * 0.7, size));
    rocks.setMatrixAt(index, matrix);
    matrix.compose(
      new Vector3(x, size * 0.42, z),
      new Quaternion(),
      new Vector3(size * 1.1, size * 0.3, size * 0.85),
    );
    caps.setMatrixAt(index, matrix);
  });
  group.add(rocks, caps);
  return group;
}

/**
 * The painted sky: a gradient with two ranges of distant ice ridges, a soft sun glow by day, and
 * by night stars and the aurora's moving curtains. It is unlit and never casts a shadow.
 */
function buildBackdrop(night: boolean, keep: Keep, own: Own, time: IUniform<number>): Mesh {
  const geometry = keep(new PlaneGeometry(220, 40, 1, 1));
  geometry.translate(0, 19, 0);
  const material = own(
    new ShaderMaterial({
      uniforms: { time, night: { value: night ? 1 : 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vSky;
        void main() {
          vSky = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: SKY_FRAGMENT,
    }),
  );
  const sky = new Mesh(geometry, material);
  sky.position.z = BACKDROP_Z;
  return sky;
}

const SKY_FRAGMENT = /* glsl */ `
  uniform float time;
  uniform float night;
  varying vec2 vSky;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), f * f * (3.0 - 2.0 * f));
  }
  float ridge(float x, float seed) {
    float h = 0.0;
    float amplitude = 1.0;
    float frequency = 0.05;
    for (int octave = 0; octave < 5; octave++) {
      h += (1.0 - abs(noise(x * frequency + seed) * 2.0 - 1.0)) * amplitude;
      amplitude *= 0.5;
      frequency *= 2.1;
    }
    return h;
  }

  void main() {
    float altitude = vSky.y;
    // Day colours sit low because the day look is exposed up; they land pale blue on screen.
    vec3 dayLow = vec3(0.42, 0.52, 0.66);
    vec3 dayHigh = vec3(0.1, 0.24, 0.55);
    vec3 nightLow = vec3(0.035, 0.08, 0.13);
    vec3 nightHigh = vec3(0.004, 0.012, 0.035);
    float lift = smoothstep(1.0, 12.0, altitude);
    vec3 sky = mix(mix(dayLow, dayHigh, lift), mix(nightLow, nightHigh, lift), night);

    // By day, the low sun glows behind the back left.
    float sunGlow = exp(-length(vec2((vSky.x + 34.0) * 0.5, altitude - 6.0)) * 0.14);
    sky += vec3(1.0, 0.93, 0.8) * sunGlow * 0.3 * (1.0 - night);

    // By night, stars, and the aurora's curtains hanging over the far ridges.
    if (night > 0.5) {
      vec2 starCell = floor(vSky * 1.4);
      float star = step(0.985, hash(starCell))
        * (1.0 - smoothstep(0.0, 0.18, length(fract(vSky * 1.4) - 0.5)));
      sky += vec3(0.8, 0.88, 1.0) * star * smoothstep(2.5, 6.0, altitude)
        * (0.6 + 0.4 * sin(time * 2.0 + hash(starCell) * 30.0));
      float x = vSky.x;
      float drift = time * 0.06;
      float curtainBase = 4.2 + 1.5 * sin(x * 0.075 + drift * 3.0) + 0.7 * sin(x * 0.19 - drift * 5.0);
      float above = altitude - curtainBase;
      float rays = 0.45 + 0.55 * noise(x * 2.3 + drift * 20.0) * noise(x * 0.61 - drift * 7.0);
      float fold = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(x * 0.11 + 1.6 * sin(x * 0.037 + drift * 4.0)), 1.5);
      float curtain = smoothstep(-0.4, 0.3, above) * exp(-max(above, 0.0) * 0.32) * rays * fold;
      vec3 green = vec3(0.18, 1.0, 0.62);
      vec3 violet = vec3(0.55, 0.32, 1.0);
      sky += mix(green, violet, smoothstep(1.0, 6.0, above)) * curtain * 1.5;
      float second = 7.6 + 0.8 * sin(x * 0.03 - drift * 2.0);
      float upper = altitude - second;
      sky += vec3(0.25, 0.9, 0.75) * smoothstep(-0.5, 0.5, upper) * exp(-max(upper, 0.0) * 0.25)
        * rays * 0.35 * (1.0 - fold * 0.5);
    }

    // Two ranges of distant ice ridges, the nearer one darker and sharper.
    float farRange = 1.4 + ridge(vSky.x * 2.2 + 300.0, 3.7) * 1.7;
    float nearRange = 0.5 + ridge(vSky.x * 1.6, 11.3) * 1.2;
    vec3 farIce = mix(vec3(0.3, 0.38, 0.52), vec3(0.06, 0.12, 0.2), night);
    vec3 nearIce = mix(vec3(0.5, 0.56, 0.66), vec3(0.04, 0.08, 0.13), night);
    float farMask = smoothstep(farRange + 0.05, farRange - 0.05, altitude);
    float nearMask = smoothstep(nearRange + 0.05, nearRange - 0.05, altitude);
    vec3 farLit = farIce + vec3(0.08, 0.07, 0.04) * (1.0 - night) * smoothstep(farRange - 0.6, farRange, altitude);
    vec3 nearRim = mix(vec3(0.1, 0.09, 0.06), vec3(0.02, 0.07, 0.06), night);
    vec3 nearLit = nearIce + nearRim * smoothstep(nearRange - 0.4, nearRange, altitude);
    sky = mix(sky, farLit, farMask);
    sky = mix(sky, nearLit, nearMask);
    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
