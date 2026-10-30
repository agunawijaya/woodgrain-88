/**
 * Mummy's Wrap's riders: two cartoon mummies, more sleepy than scary, built
 * the way everyone draws one: wound from head to foot in strips of linen,
 * two round eyes peeping out of a gap in the wrappings, arms held stiffly
 * out in front, a loose end trailing. The bandage they leave behind comes
 * off their back and runs down to the floor.
 *
 * Seat 1's Wick is tall and thin with an orange sash; seat 2's Bun is short
 * and round with a blue sash. Their wrappings are dyed in their colours. Both
 * shuffle stiff-legged; at top speed the shuffle becomes a frantic waddle.
 *
 * A crash winds the mummy up in its own bandage: the linen spirals up from
 * its feet to its head, the arms fold in, and the finished cocoon wobbles and
 * topples over.
 */
import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type Material,
  type Texture,
} from 'three';
import type { Crash, Seat } from '../../engine/types.ts';
import type { SeatColours } from '../../look/look.ts';
import { createRiderHalo } from '../../look/rider-halo.ts';
import type { RiderFigure } from '../../look/trail-rig.ts';
import { clothTexture, FLOOR_TOP, motifFor } from './bandage.ts';

/** The winding from feet to head, slow enough to follow from the overhead camera. */
const WIND_SECONDS = 0.9;
const WOBBLE_SECONDS = 0.6;
const TOPPLE_SECONDS = 0.45;
/** The arms fold in during the first part of the winding, so the linen can pass them. */
const FOLD_SECONDS = 0.2;
/** Built to a cell and drawn larger, so each mummy reads from the overhead camera. */
const MUMMY_SCALE = 3.4;
/**
 * The shuffling mummy's forward stoop, head ahead of its feet. From the overhead camera it shows the
 * body and the reaching arms, where an upright figure would show only the top of its head.
 */
const STOOP = 0.28;
/** Lowers the scaled figure so its feet stay on the floor rather than three floors up. */
const STAND = -FLOOR_TOP * (MUMMY_SCALE - 1);

interface Build {
  readonly height: number;
  readonly radius: number;
  readonly headRadius: number;
}

/** A tall thin mummy on the left and a short stout one on the right; Four Way's corners reuse them. */
const BUILDS: readonly [Build, Build] = [
  { height: 0.6, radius: 0.15, headRadius: 0.16 },
  { height: 0.44, radius: 0.2, headRadius: 0.18 },
];

export function createMummy(options: {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}): RiderFigure {
  const { seat } = options;
  const build = BUILDS[seat % 2] ?? BUILDS[0];
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
  // Body, limbs and head are wound in strips: a texture of overlapping wraps, with the odd raised
  // strip on top so the outline is lumpy the way a wrapped mummy is.
  const wrapsTexture = wrappedTexture();
  textures.push(wrapsTexture);
  const under = own(new MeshStandardMaterial({ map: wrapsTexture, roughness: 0.95 }));
  // The strips wound over the body are dyed, so a mummy's colour shows from above as well as its sash.
  const strip = own(
    new MeshStandardMaterial({
      color: new Color('#f1e8d2').lerp(new Color(options.colours.main), 0.7),
      roughness: 0.9,
      side: DoubleSide,
    }),
  );
  const sash = own(new MeshStandardMaterial({ color: options.colours.main, roughness: 0.7 }));
  const gap = own(new MeshBasicMaterial({ color: '#1b130c' }));
  const eyeWhite = own(
    new MeshBasicMaterial({
      color: new Color('#fffbea').multiplyScalar(options.night ? 1.5 : 1),
    }),
  );
  const pupil = own(new MeshBasicMaterial({ color: '#16110d' }));
  const motif = motifFor(seat);
  const trainTexture = clothTexture(options.colours, motif);
  textures.push(trainTexture);
  const train = own(
    new MeshStandardMaterial({ map: trainTexture, roughness: 0.9, side: DoubleSide }),
  );

  const root = new Group();
  root.name = `mummy-${seat}`;
  const figure = new Group();
  figure.scale.setScalar(MUMMY_SCALE);
  figure.position.y = STAND;
  root.add(figure);
  const halo = createRiderHalo({
    colours: options.colours,
    length: build.radius * 2.6 * MUMMY_SCALE,
    width: build.radius * 2.6 * MUMMY_SCALE,
    floor: FLOOR_TOP,
    night: options.night,
  });
  root.add(halo.root);
  const shuffle = new Group();
  figure.add(shuffle);
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ): Mesh => {
    const mesh = new Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  /** A strip of linen wound once round a part, tipped a little so the wrapping looks hand-done. */
  const wrap = (parent: Group, radius: number, y: number, tilt: number): Mesh => {
    const band = add(parent, new TorusGeometry(radius, 0.032, 6, 28), strip, 0, y);
    band.rotation.set(Math.PI / 2 + tilt, 0, tilt * 0.6);
    band.scale.z = 0.55;
    return band;
  };

  const legs = [-1, 1].map((side) => {
    const leg = new Group();
    leg.position.set(0, FLOOR_TOP + build.height * 0.3, side * build.radius * 0.5);
    shuffle.add(leg);
    add(
      leg,
      new CapsuleGeometry(build.radius * 0.42, build.height * 0.22, 4, 10),
      under,
      0,
      -build.height * 0.12,
    );
    wrap(leg, build.radius * 0.44, -build.height * 0.06, 0.2);
    wrap(leg, build.radius * 0.44, -build.height * 0.18, -0.2);
    return leg;
  });

  const torsoLength = build.height - build.radius * 2;
  const bodyY = FLOOR_TOP + build.height * 0.32 + build.height / 2;
  add(shuffle, new CapsuleGeometry(build.radius, torsoLength, 6, 16), under, 0, bodyY);
  const bands = 3;
  for (let index = 0; index < bands; index++) {
    const y = bodyY - build.height * 0.42 + (index / (bands - 1)) * build.height * 0.84;
    const taper = 1 - (Math.abs(index - (bands - 1) / 2) / bands) * 0.35;
    wrap(shuffle, build.radius * taper * 1.02, y, index % 2 === 0 ? 0.18 : -0.18);
  }
  const belt = add(
    shuffle,
    new TorusGeometry(build.radius * 1.06, 0.03, 6, 28),
    sash,
    0,
    bodyY - build.height * 0.08,
  );
  belt.rotation.x = Math.PI / 2;

  const head = new Group();
  head.position.y = bodyY + build.height * 0.5 + build.headRadius * 0.75;
  shuffle.add(head);
  add(head, new SphereGeometry(build.headRadius, 22, 16), under);
  // Wrappings above and below the gap the eyes look out of.
  for (const [y, tilt] of [
    [0.45, 0.15],
    [-0.4, -0.12],
  ] as const) {
    wrap(head, build.headRadius * Math.sqrt(1 - y * y) * 1.04, y * build.headRadius, tilt);
  }
  // The dark gap in the wrappings, round the front of the face.
  const slit = add(
    head,
    new SphereGeometry(build.headRadius * 1.0, 22, 8, -1.0, 2.0, Math.PI * 0.36, Math.PI * 0.2),
    gap,
  );
  slit.rotation.y = Math.PI;
  for (const side of [-1, 1]) {
    const eye = add(
      head,
      new SphereGeometry(build.headRadius * 0.3, 14, 10),
      eyeWhite,
      build.headRadius * 0.8,
      build.headRadius * 0.08,
      side * build.headRadius * 0.33,
    );
    eye.scale.set(0.6, 1, 1);
    add(
      head,
      new SphereGeometry(build.headRadius * 0.13, 10, 8),
      pupil,
      build.headRadius * 0.98,
      build.headRadius * 0.1,
      side * build.headRadius * 0.3,
    );
  }

  // The classic stiff-armed reach, straight out in front.
  const arms = [-1, 1].map((side) => {
    const shoulder = new Group();
    shoulder.position.set(
      build.radius * 0.3,
      bodyY + build.height * 0.24,
      side * build.radius * 0.95,
    );
    shuffle.add(shoulder);
    const arm = add(
      shoulder,
      new CapsuleGeometry(build.radius * 0.3, build.height * 0.38, 4, 10),
      under,
      build.height * 0.24,
    );
    arm.rotation.z = -Math.PI / 2;
    for (const along of [0.1, 0.24, 0.38]) {
      const band = add(
        shoulder,
        new TorusGeometry(build.radius * 0.32, 0.026, 6, 20),
        strip,
        build.height * along,
      );
      band.rotation.y = Math.PI / 2;
      band.rotation.x = side * 0.25;
      band.scale.z = 0.6;
    }
    return shoulder;
  });

  // A loose end flapping from the head, and the bandage running off the back down to the floor.
  const looseEnd = add(
    head,
    new PlaneGeometry(0.06, 0.32),
    strip,
    -build.headRadius * 0.6,
    build.headRadius * 0.3,
    -build.headRadius * 0.5,
  );
  const trailing = new Mesh(keep(trainGeometry(bodyY)), train);
  trailing.castShadow = true;
  shuffle.add(trailing);

  const cocoonHeight = build.height * 1.32 + build.headRadius * 2;
  const cocoonRadius = build.radius * 1.4;
  const winding = windingGeometry(cocoonHeight, cocoonRadius);
  keep(winding.geometry);
  const cocoonTexture = clothTexture(options.colours, motif);
  textures.push(cocoonTexture);
  const cocoonCloth = own(
    new MeshStandardMaterial({ map: cocoonTexture, roughness: 0.9, side: DoubleSide }),
  );
  const cocoon = new Mesh(winding.geometry, cocoonCloth);
  cocoon.position.y = FLOOR_TOP;
  cocoon.castShadow = true;
  cocoon.visible = false;
  figure.add(cocoon);
  // The knot that closes the top once the last turn is wound.
  const knot = add(
    figure,
    new SphereGeometry(cocoonRadius * 0.62, 16, 10),
    cocoonCloth,
    0,
    FLOOR_TOP + cocoonHeight - cocoonRadius * 0.2,
  );
  knot.visible = false;

  let phase = 0;
  let wound: { age: number; side: number } | null = null;

  return {
    root,
    ride(position, yaw, dt, speedStage) {
      root.position.copy(position);
      root.rotation.y = yaw;
      if (dt <= 0 || wound) return;
      phase += dt * (8 + speedStage * 4);
      const swing = 0.08 + speedStage * 0.035;
      shuffle.rotation.x = Math.sin(phase) * swing;
      shuffle.rotation.z = -STOOP;
      shuffle.position.y = Math.abs(Math.sin(phase)) * 0.025;
      legs.forEach((leg, index) => {
        leg.rotation.z = Math.sin(phase + index * Math.PI) * 0.35;
      });
      arms.forEach((arm, index) => {
        arm.rotation.y = Math.sin(phase + index * Math.PI) * 0.08;
      });
      looseEnd.rotation.x = Math.sin(phase * 1.6) * (0.5 + speedStage * 0.2);
    },
    crash(_crash: Crash, direction) {
      wound = { age: 0, side: direction.x - direction.z >= 0 ? 1 : -1 };
      cocoon.visible = true;
      shuffle.rotation.z = 0;
      winding.geometry.setDrawRange(0, 0);
      trailing.visible = false;
    },
    reset() {
      wound = null;
      cocoon.visible = false;
      knot.visible = false;
      shuffle.visible = true;
      trailing.visible = true;
      looseEnd.visible = true;
      for (const arm of arms) arm.rotation.z = 0;
      figure.rotation.set(0, 0, 0);
      figure.position.set(0, STAND, 0);
    },
    update(dt) {
      if (!wound) return;
      wound.age += dt;
      const { age, side } = wound;
      const wrapped = Math.min(1, age / WIND_SECONDS);
      winding.geometry.setDrawRange(0, winding.indicesUpTo(wrapped));
      const fold = Math.min(1, age / FOLD_SECONDS);
      for (const arm of arms) arm.rotation.z = -(Math.PI / 2 - 0.15) * fold;
      if (wrapped > 0.85) looseEnd.visible = false;
      if (wrapped >= 1) {
        shuffle.visible = false;
        knot.visible = true;
      }
      figure.rotation.z = side * tilt(age - WIND_SECONDS);
      const topple = Math.min(
        1,
        Math.max(0, (age - WIND_SECONDS - WOBBLE_SECONDS) / TOPPLE_SECONDS),
      );
      figure.position.y = STAND + topple * cocoonRadius * MUMMY_SCALE;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      halo.dispose();
    },
  };
}

/**
 * How far the cocoon leans, `seconds` after the winding ends: a wobble that grows, as if the
 * mummy were trying to keep its balance, then the fall, then a little bounce where it lands.
 */
function tilt(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < WOBBLE_SECONDS) {
    const share = seconds / WOBBLE_SECONDS;
    return Math.sin(share * Math.PI * 3) * 0.22 * share;
  }
  const falling = (seconds - WOBBLE_SECONDS) / TOPPLE_SECONDS;
  if (falling < 1) return falling * falling * (Math.PI / 2 - 0.1);
  const landed = (falling - 1) * TOPPLE_SECONDS;
  return Math.PI / 2 - 0.1 + Math.sin(landed * 16) * Math.exp(-landed * 5) * 0.08;
}

/**
 * The cocoon's bandage: one long band spiralling up round the mummy from its feet to its head, each
 * turn lapping over the one below. Revealed a little at a time, it winds the mummy up.
 */
function windingGeometry(
  height: number,
  radius: number,
): { geometry: BufferGeometry; indicesUpTo(share: number): number } {
  const pitch = height / 9;
  const band = pitch * 1.35;
  const turns = (height - band / 2) / pitch;
  const perTurn = 28;
  const steps = Math.ceil(turns * perTurn);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let along = 0;
  for (let step = 0; step <= steps; step++) {
    const share = step / steps;
    const angle = share * turns * Math.PI * 2;
    const centre = band / 2 + share * (height - band);
    // Narrower at the feet and the head, full at the middle, like a wrapped body.
    const girth = radius * (0.72 + 0.28 * Math.sin(share * Math.PI));
    // Each turn's lower edge stands a little proud of the turn below, the way wrapping laps.
    const lower = girth * 1.02;
    const upper = girth * 0.97;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * lower, centre - band / 2, sin * lower);
    positions.push(cos * upper, centre + band / 2, sin * upper);
    if (step > 0) along += (girth * Math.PI * 2) / perTurn;
    const u = along / (band * 0.75);
    uvs.push(u, 0, u, 1);
    if (step < steps) {
      const at = step * 2;
      indices.push(at, at + 1, at + 2, at + 1, at + 3, at + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return {
    geometry,
    indicesUpTo: (share) => Math.floor(share * steps) * 6,
  };
}

/** The bandage leaving the mummy's back: a strip curving from the waist down to the floor behind. */
function trainGeometry(waist: number): BufferGeometry {
  const geometry = new PlaneGeometry(1, 0.2, 8, 1);
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index++) {
    const t = position.getX(index) + 0.5;
    const across = position.getY(index);
    // From the small of the back (t = 0) down and back to the floor (t = 1).
    position.setXYZ(index, -0.08 - t * 0.42, waist * (1 - t) ** 1.6 + FLOOR_TOP + 0.01, across);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Linen wound round and round: overlapping strips running slightly aslant, each with a shadow
 * along its lower edge where it laps over the one below, and a few loose fibres.
 */
function wrappedTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the wrappings');
  context.fillStyle = '#efe5cc';
  context.fillRect(0, 0, size, size);
  const strip = 16;
  for (let row = -2; row < size / strip + 2; row++) {
    const y = row * strip;
    const tone = 228 + ((row * 37) % 5) * 4;
    context.fillStyle = `rgb(${tone}, ${tone - 10}, ${tone - 34})`;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y + 10);
    context.lineTo(size, y + 10 + strip);
    context.lineTo(0, y + strip);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(110, 86, 52, 0.45)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, y + strip);
    context.lineTo(size, y + 10 + strip);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
