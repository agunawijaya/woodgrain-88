/**
 * The Tabletop Board: a handsome game in an oak tray on a honey-oak table.
 * A green felt inlay holds the 63 wooden tiles face down (teal backs with
 * gold rings); brass caps guard the tray's corners, and each home corner
 * has an enamel disc in its team's colour. Around the tray lie the things a
 * family keeps with a board game: a spiral notepad and pencil, a brass
 * hourglass and a pegboard for the score.
 */
import {
  bakeSurface,
  createGradientNoise,
  disposeSurface,
  fbm,
  hexToRgb,
  mixRgb,
  repeatSurface,
  smoothstep,
  type SurfaceMaps,
  type SurfaceRecipe,
} from '@woodgrain-88/arena';
import type { Rng } from '@woodgrain-88/kit';
import {
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SQUARE_COUNT, spotOf, type Square } from '../../engine/grid.ts';
import { FIELD_DEPTH, FIELD_WIDTH, squareX, squareZ } from '../../look/field-space.ts';
import type { SeatColours } from '../../look/look.ts';
import type { TileFaces } from './faces.ts';

/** Height of the felt the tiles lie on. */
export const FELT_TOP = 1.0;
export const TILE_SIZE = 3.5;
export const TILE_THICKNESS = 0.42;
/** Height of a face-down tile's top. */
export const TILE_TOP = FELT_TOP + TILE_THICKNESS;

const TRAY_MARGIN = 2.2;
const RIM_WIDTH = 1.5;
const RIM_HEIGHT = 0.55;

export interface TabletopBoard {
  readonly root: Group;
  readonly tileBody: BufferGeometry;
  readonly tileDecal: BufferGeometry;
  readonly woodMaterial: Material;
  /** Lifts a square's face-down tile off the felt (it is drawn by the view while it flips). */
  takeTile(square: Square): void;
  /** Puts a face-down tile back on its square. */
  returnTile(square: Square): void;
  /** The possibility fog: face-down tiles that cannot hide the flag darken; null clears it. */
  setFog(possible: readonly boolean[] | null): void;
  /** Makes a face-down tile jump, after `delay` seconds, as if the table had been thumped. */
  jostle(square: Square, delay: number, height: number): void;
  update(dt: number): void;
  dispose(): void;
}

export interface BoardOptions {
  readonly rng: Rng;
  readonly faces: TileFaces;
  readonly seats: readonly [SeatColours, SeatColours];
}

export function createTabletopBoard(options: BoardOptions): TabletopBoard {
  const { rng } = options;
  const root = new Group();
  root.name = 'tabletop-board';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const surfaces: SurfaceMaps[] = [];
  const textures: CanvasTexture[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };

  const oak = repeatSurface(
    bakeSurface(woodRecipe(rng.int(1, 1e6), '#c8996a', '#93633a', 6)),
    3,
    2,
  );
  const walnut = repeatSurface(
    bakeSurface(woodRecipe(rng.int(1, 1e6), '#6e4126', '#45261a', 0)),
    2,
    2,
  );
  const felt = repeatSurface(bakeSurface(feltRecipe(rng.int(1, 1e6))), 6, 5);
  surfaces.push(oak, walnut, felt);

  const table = new Mesh(
    keep(new PlaneGeometry(150, 110).rotateX(-Math.PI / 2)),
    own(
      new MeshStandardMaterial({
        map: oak.map,
        normalMap: oak.normalMap,
        roughnessMap: oak.roughnessMap,
        roughness: 1,
      }),
    ),
  );
  table.receiveShadow = true;
  root.add(table);

  const walnutMaterial = own(
    new MeshStandardMaterial({
      map: walnut.map,
      normalMap: walnut.normalMap,
      roughnessMap: walnut.roughnessMap,
      roughness: 0.8,
    }),
  );
  const innerWidth = FIELD_WIDTH + TRAY_MARGIN * 2;
  const innerDepth = FIELD_DEPTH + TRAY_MARGIN * 2;
  const outerWidth = innerWidth + RIM_WIDTH * 2;
  const outerDepth = innerDepth + RIM_WIDTH * 2;
  const base = new Mesh(
    keep(new RoundedBoxGeometry(outerWidth, FELT_TOP, outerDepth, 3, 0.25)),
    walnutMaterial,
  );
  base.position.y = FELT_TOP / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // The rim: four rails standing proud of the felt, with rounded tops.
  const rails: [number, number, number, number][] = [
    [0, -(innerDepth + RIM_WIDTH) / 2, outerWidth, RIM_WIDTH],
    [0, (innerDepth + RIM_WIDTH) / 2, outerWidth, RIM_WIDTH],
    [-(innerWidth + RIM_WIDTH) / 2, 0, RIM_WIDTH, innerDepth],
    [(innerWidth + RIM_WIDTH) / 2, 0, RIM_WIDTH, innerDepth],
  ];
  for (const [x, z, width, depth] of rails) {
    const rail = new Mesh(
      keep(new RoundedBoxGeometry(width, RIM_HEIGHT * 2, depth, 3, 0.22)),
      walnutMaterial,
    );
    rail.position.set(x, FELT_TOP, z);
    rail.castShadow = true;
    rail.receiveShadow = true;
    root.add(rail);
  }

  const feltMaterial = own(
    new MeshStandardMaterial({
      color: '#ffffff',
      map: felt.map,
      normalMap: felt.normalMap,
      roughnessMap: felt.roughnessMap,
      roughness: 1,
    }),
  );
  const inlay = new Mesh(
    keep(new PlaneGeometry(innerWidth, innerDepth).rotateX(-Math.PI / 2)),
    feltMaterial,
  );
  inlay.position.y = FELT_TOP + 0.005;
  inlay.receiveShadow = true;
  root.add(inlay);

  const brass = own(new MeshStandardMaterial({ color: '#d4a53c', metalness: 1, roughness: 0.32 }));
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const cap = new Group();
    const long = new Mesh(keep(new RoundedBoxGeometry(3.2, 0.2, 0.9, 2, 0.08)), brass);
    long.position.set(-sx * 1.2, 0, 0);
    const short = new Mesh(keep(new RoundedBoxGeometry(0.9, 0.2, 3.2, 2, 0.08)), brass);
    short.position.set(0, 0, -sz * 1.2);
    for (const part of [long, short]) {
      part.castShadow = true;
      cap.add(part);
    }
    for (const [rx, rz] of [
      [-sx * 2.3, 0],
      [0, -sz * 2.3],
      [0, 0],
    ] as const) {
      const rivet = new Mesh(keep(new CylinderGeometry(0.12, 0.12, 0.08, 10)), brass);
      rivet.position.set(rx, 0.12, rz);
      cap.add(rivet);
    }
    cap.position.set(
      sx * (outerWidth / 2 - 0.5),
      FELT_TOP + RIM_HEIGHT + 0.06,
      sz * (outerDepth / 2 - 0.5),
    );
    root.add(cap);
  }

  // Each team's home corner is marked with an enamel disc set in the rim beside it.
  ([0, 1] as const).forEach((seat) => {
    const disc = new Mesh(
      keep(new CylinderGeometry(0.55, 0.55, 0.12, 24)),
      own(new MeshStandardMaterial({ color: options.seats[seat].main, roughness: 0.25 })),
    );
    const ring = new Mesh(keep(new TorusGeometry(0.58, 0.07, 8, 28)), brass);
    ring.rotation.x = Math.PI / 2;
    const side = seat === 0 ? -1 : 1;
    const x = side * (innerWidth / 2 + RIM_WIDTH / 2);
    const z = squareZ(seat === 0 ? 0 : 6);
    disc.position.set(x, FELT_TOP + RIM_HEIGHT + 0.03, z);
    ring.position.copy(disc.position).setY(disc.position.y + 0.05);
    root.add(disc, ring);
  });

  // The tiles lying face down: one instanced body and one instanced painted back.
  const woodMaterial = own(
    new MeshStandardMaterial({
      map: oak.map,
      normalMap: oak.normalMap,
      color: '#f2dcc0',
      roughness: 0.55,
    }),
  );
  const tileBody = keep(new RoundedBoxGeometry(TILE_SIZE, TILE_THICKNESS, TILE_SIZE, 3, 0.12));
  const tileDecal = keep(new PlaneGeometry(TILE_SIZE - 0.2, TILE_SIZE - 0.2).rotateX(-Math.PI / 2));
  const backMaterial = own(
    new MeshPhysicalMaterial({
      map: options.faces.back,
      roughness: 0.5,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
    }),
  );
  const bodies = new InstancedMesh(tileBody, woodMaterial, SQUARE_COUNT);
  const backs = new InstancedMesh(tileDecal, backMaterial, SQUARE_COUNT);
  bodies.castShadow = true;
  bodies.receiveShadow = true;
  backs.receiveShadow = true;
  const bright = new Color('#ffffff');
  const dimmed = new Color('#5c5a55');
  for (let square = 0; square < SQUARE_COUNT; square++) backs.setColorAt(square, bright);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const lying = new Map<Square, number>();
  const taken = new Set<Square>();
  const jumps = new Map<Square, { wait: number; age: number; height: number }>();
  const place = (square: Square, visible: boolean, lift = 0) => {
    const { column, row } = spotOf(square);
    const wobble = lying.get(square) ?? 0;
    turn.setFromAxisAngle(up, wobble + lift * 0.12);
    const scale = visible ? 1 : 0;
    const centre = new Vector3(squareX(column), FELT_TOP + TILE_THICKNESS / 2 + lift, squareZ(row));
    matrix.compose(centre, turn, new Vector3(scale, scale, scale));
    bodies.setMatrixAt(square, matrix);
    matrix.compose(
      centre.clone().setY(TILE_TOP + 0.004 + lift),
      turn,
      new Vector3(scale, scale, scale),
    );
    backs.setMatrixAt(square, matrix);
    bodies.instanceMatrix.needsUpdate = true;
    backs.instanceMatrix.needsUpdate = true;
  };
  for (let square = 0; square < SQUARE_COUNT; square++) {
    // Tiles laid by hand never sit perfectly square.
    lying.set(square, rng.float(-0.025, 0.025));
    place(square, true);
  }
  root.add(bodies, backs);

  root.add(notepad(own, keep, textures));
  root.add(hourglass(own, keep));
  root.add(pegboard(options.seats, own, keep, walnutMaterial));

  return {
    root,
    tileBody,
    tileDecal,
    woodMaterial,
    takeTile(square) {
      taken.add(square);
      jumps.delete(square);
      place(square, false);
    },
    returnTile(square) {
      taken.delete(square);
      place(square, true);
    },
    setFog(possible) {
      for (let square = 0; square < SQUARE_COUNT; square++) {
        backs.setColorAt(square, possible !== null && possible[square] === false ? dimmed : bright);
      }
      if (backs.instanceColor) backs.instanceColor.needsUpdate = true;
    },
    jostle(square, delay, height) {
      if (!taken.has(square)) jumps.set(square, { wait: delay, age: 0, height });
    },
    update(dt) {
      for (const [square, jump] of jumps) {
        if (jump.wait > 0) {
          jump.wait -= dt;
          continue;
        }
        jump.age += dt;
        const t = Math.min(1, jump.age / 0.32);
        place(square, true, 4 * t * (1 - t) * jump.height);
        if (t >= 1) jumps.delete(square);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const surface of surfaces) disposeSurface(surface);
      for (const texture of textures) texture.dispose();
    },
  };
}

type Own = <T extends Material>(material: T) => T;
type Keep = <T extends BufferGeometry>(geometry: T) => T;

/**
 * Straight-grained wood: fine grain lines running along the boards, gently wandering, with darker
 * figure here and there; with `planks` the tile is cut into that many boards with dark seams.
 */
function woodRecipe(seed: number, light: string, dark: string, planks: number): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const warp = createGradientNoise(seed + 5);
  const lightRgb = hexToRgb(light);
  const darkRgb = hexToRgb(dark);
  const grainAt = (u: number, v: number) => {
    const wander = fbm(warp, u, v, { frequency: 2, octaves: 3 }) * 0.22;
    const fine = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * 48 + wander * 6));
    const broad = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * 7 + wander * 2));
    return fine * 0.55 + broad * 0.45;
  };
  const seamAt = (v: number) => {
    if (planks === 0) return 0;
    const across = (v * planks) % 1;
    return 1 - smoothstep(0, 0.012, Math.min(across, 1 - across));
  };
  return {
    size: 512,
    normalStrength: 1.4,
    height(u, v) {
      const pores = fbm(noise, u, v, { frequency: 64, octaves: 2 }) * 0.5 + 0.5;
      return grainAt(u, v) * 0.4 + pores * 0.15 + 0.4 - seamAt(v) * 0.4;
    },
    colour(height, u, v) {
      const figure = smoothstep(
        0.5,
        0.85,
        fbm(noise, u + 0.2, v, { frequency: 5, octaves: 3 }) * 0.5 + 0.5,
      );
      const grain = mixRgb(lightRgb, darkRgb, grainAt(u, v) * 0.45 + figure * 0.3);
      return mixRgb(grain, [40, 24, 14], seamAt(v) * 0.8 + (1 - height) * 0.08);
    },
    roughness(height) {
      return 0.5 + (1 - height) * 0.25;
    },
  };
}

/** Billiard-green felt: fine fibres, a faint nap and a little mottling. */
function feltRecipe(seed: number): SurfaceRecipe {
  const noise = createGradientNoise(seed);
  const light = hexToRgb('#3d7a5a');
  const dark = hexToRgb('#24563f');
  return {
    size: 256,
    normalStrength: 0.8,
    height(u, v) {
      return fbm(noise, u, v, { frequency: 96, octaves: 2 }) * 0.5 + 0.5;
    },
    colour(height, u, v) {
      const mottle = fbm(noise, u + 0.5, v, { frequency: 4, octaves: 3 }) * 0.5 + 0.5;
      return mixRgb(dark, light, height * 0.4 + mottle * 0.6);
    },
    roughness() {
      return 1;
    },
  };
}

/** A spiral notepad with ruled pages and the hunt's notes pencilled in, and a pencil beside it. */
function notepad(own: Own, keep: Keep, textures: CanvasTexture[]): Group {
  const group = new Group();
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#ece4cf';
    context.fillRect(0, 0, 384, 512);
    context.strokeStyle = '#9ec3e0';
    context.lineWidth = 2;
    for (let line = 70; line < 512; line += 30) {
      context.beginPath();
      context.moveTo(0, line);
      context.lineTo(384, line);
      context.stroke();
    }
    context.strokeStyle = '#e59a9a';
    context.beginPath();
    context.moveTo(48, 0);
    context.lineTo(48, 512);
    context.stroke();
    // A little pencilled sketch of the field with a few clues jotted in.
    context.strokeStyle = '#555a66';
    context.lineWidth = 2;
    for (let column = 0; column <= 9; column++) {
      context.beginPath();
      context.moveTo(80 + column * 28, 120);
      context.lineTo(80 + column * 28, 316);
      context.stroke();
    }
    for (let row = 0; row <= 7; row++) {
      context.beginPath();
      context.moveTo(80, 120 + row * 28);
      context.lineTo(332, 120 + row * 28);
      context.stroke();
    }
    context.fillStyle = '#4a4f5c';
    context.font = '600 22px "Fraunces Variable", Georgia, serif';
    context.fillText('3', 138, 172);
    context.fillText('5', 110, 200);
    context.fillText('2', 222, 228);
    context.beginPath();
    context.arc(262, 246, 13, 0, Math.PI * 2);
    context.stroke();
    context.fillText('?', 256, 254);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textures.push(texture);
  const pad = new Mesh(
    keep(new RoundedBoxGeometry(6, 0.3, 8, 2, 0.06)),
    own(new MeshStandardMaterial({ color: '#efe6d0', roughness: 0.9 })),
  );
  pad.position.y = 0.15;
  pad.castShadow = true;
  pad.receiveShadow = true;
  const page = new Mesh(
    keep(new PlaneGeometry(5.8, 7.6).rotateX(-Math.PI / 2)),
    own(new MeshStandardMaterial({ map: texture, roughness: 0.95 })),
  );
  page.position.y = 0.31;
  page.receiveShadow = true;
  group.add(pad, page);
  const wire = own(new MeshStandardMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.3 }));
  for (let loop = 0; loop < 10; loop++) {
    const coil = new Mesh(keep(new TorusGeometry(0.22, 0.04, 6, 14)), wire);
    coil.rotation.y = Math.PI / 2;
    coil.position.set(-2.5 + loop * 0.56, 0.32, -3.9);
    group.add(coil);
  }
  const pencil = new Group();
  const body = new Mesh(
    keep(new CylinderGeometry(0.17, 0.17, 5, 6)),
    own(new MeshStandardMaterial({ color: '#f2c230', roughness: 0.45 })),
  );
  const tip = new Mesh(
    keep(new ConeGeometry(0.17, 0.6, 6)),
    own(new MeshStandardMaterial({ color: '#e6c79c', roughness: 0.8 })),
  );
  tip.position.y = 2.8;
  const eraser = new Mesh(
    keep(new CylinderGeometry(0.17, 0.17, 0.45, 12)),
    own(new MeshStandardMaterial({ color: '#e88a9a', roughness: 0.9 })),
  );
  eraser.position.y = -2.7;
  for (const part of [body, tip, eraser]) {
    part.castShadow = true;
    pencil.add(part);
  }
  pencil.rotation.set(Math.PI / 2, 0, 0.4);
  pencil.position.set(3.9, 0.18, 1.2);
  group.add(pencil);
  group.position.set(FIELD_WIDTH / 2 + 9.2, 0, 4);
  group.rotation.y = -0.18;
  return group;
}

/** A brass hourglass, the timer for the timed hunts. */
function hourglass(own: Own, keep: Keep): Group {
  const group = new Group();
  const brass = own(new MeshStandardMaterial({ color: '#c9973a', metalness: 1, roughness: 0.3 }));
  const glass = own(
    new MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.05,
      transmission: 0.9,
      thickness: 0.4,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
    }),
  );
  const sand = own(new MeshStandardMaterial({ color: '#e0b46a', roughness: 0.9 }));
  for (const y of [0.15, 4.25]) {
    const plate = new Mesh(keep(new CylinderGeometry(1.3, 1.3, 0.3, 28)), brass);
    plate.position.y = y;
    plate.castShadow = true;
    group.add(plate);
  }
  for (let post = 0; post < 3; post++) {
    const angle = (post / 3) * Math.PI * 2;
    const pillar = new Mesh(keep(new CylinderGeometry(0.09, 0.09, 4, 8)), brass);
    pillar.position.set(Math.cos(angle) * 1.05, 2.2, Math.sin(angle) * 1.05);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const bulb = keep(
    new LatheGeometry(
      [
        new Vector2(0.02, 0.3),
        new Vector2(0.75, 0.6),
        new Vector2(0.85, 1.2),
        new Vector2(0.5, 1.9),
        new Vector2(0.08, 2.2),
        new Vector2(0.5, 2.5),
        new Vector2(0.85, 3.2),
        new Vector2(0.75, 3.8),
        new Vector2(0.02, 4.1),
      ],
      28,
    ),
  );
  group.add(new Mesh(bulb, glass));
  const pile = new Mesh(keep(new ConeGeometry(0.72, 0.7, 24)), sand);
  pile.position.y = 0.75;
  group.add(pile);
  const top = new Mesh(keep(new ConeGeometry(0.5, 0.5, 24).rotateX(Math.PI)), sand);
  top.position.y = 2.75;
  group.add(top);
  group.position.set(-FIELD_WIDTH / 2 - 8.6, 0, -9);
  return group;
}

/** The score pegboard: two rows of holes and a peg in each team's colour. */
function pegboard(
  seats: readonly [SeatColours, SeatColours],
  own: Own,
  keep: Keep,
  wood: Material,
): Group {
  const group = new Group();
  const board = new Mesh(keep(new RoundedBoxGeometry(2.4, 0.5, 13, 2, 0.15)), wood);
  board.position.y = 0.25;
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);
  const hole = own(new MeshStandardMaterial({ color: '#1e120a', roughness: 1 }));
  const holeGeometry = keep(new CylinderGeometry(0.09, 0.09, 0.02, 8));
  const holes = new InstancedMesh(holeGeometry, hole, 2 * 15);
  const matrix = new Matrix4();
  for (let lane = 0; lane < 2; lane++) {
    for (let step = 0; step < 15; step++) {
      matrix.makeTranslation(-0.5 + lane, 0.51, -5.6 + step * 0.8);
      holes.setMatrixAt(lane * 15 + step, matrix);
    }
  }
  group.add(holes);
  seats.forEach((colours, lane) => {
    const peg = new Mesh(
      keep(new CylinderGeometry(0.1, 0.1, 0.7, 10)),
      own(new MeshStandardMaterial({ color: colours.main, roughness: 0.35 })),
    );
    const knob = new Mesh(keep(new CylinderGeometry(0.18, 0.18, 0.2, 14)), peg.material);
    const step = lane === 0 ? 4 : 2;
    peg.position.set(-0.5 + lane, 0.8, -5.6 + step * 0.8);
    knob.position.set(-0.5 + lane, 1.15, -5.6 + step * 0.8);
    peg.castShadow = true;
    knob.castShadow = true;
    group.add(peg, knob);
  });
  group.position.set(-FIELD_WIDTH / 2 - 8.4, 0, 6);
  group.rotation.y = 0.08;
  return group;
}
