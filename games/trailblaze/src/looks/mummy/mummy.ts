/**
 * Mummy's Wrap's riders: two cartoon mummies, more sleepy than scary, built
 * the way everyone draws one: wound from head to foot in strips of linen,
 * two round eyes peeping out of a gap in the wrappings, arms held stiffly
 * out in front, a loose end trailing. The bandage they leave behind comes
 * off their back and runs down to the floor.
 *
 * Seat 1's Wick is tall and thin with an orange sash; seat 2's Bun is short
 * and round with a blue sash. Both shuffle stiff-legged; at top speed the
 * shuffle becomes a frantic waddle. A crash winds the mummy up in its own
 * bandage in a blink, and it topples over.
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
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import type { Crash, Seat } from '../../engine/types.ts';
import type { SeatColours } from '../../look/look.ts';
import type { RiderFigure } from '../../look/trail-rig.ts';
import { clothTexture, FLOOR_TOP } from './bandage.ts';

const WIND_SECONDS = 0.35;
const TOPPLE_SECONDS = 0.4;
/** Built to a cell and drawn larger, so a small mummy still reads on a full board. */
const MUMMY_SCALE = 1.5;

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
  const strip = own(
    new MeshStandardMaterial({ color: '#f1e8d2', roughness: 0.9, side: DoubleSide }),
  );
  const sash = own(new MeshStandardMaterial({ color: options.colours.main, roughness: 0.7 }));
  const gap = own(new MeshBasicMaterial({ color: '#1b130c' }));
  const eyeWhite = own(
    new MeshBasicMaterial({
      color: new Color('#fffbea').multiplyScalar(options.night ? 1.5 : 1),
    }),
  );
  const pupil = own(new MeshBasicMaterial({ color: '#16110d' }));
  const trainTexture = clothTexture(options.colours.main);
  textures.push(trainTexture);
  const train = own(
    new MeshStandardMaterial({ map: trainTexture, roughness: 0.9, side: DoubleSide }),
  );

  const root = new Group();
  root.name = `mummy-${seat}`;
  const figure = new Group();
  figure.scale.setScalar(MUMMY_SCALE);
  root.add(figure);
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
  const cocoonGeometry = keep(
    new CapsuleGeometry(build.radius * 1.4, cocoonHeight - build.radius * 2.8, 6, 18),
  );
  cocoonGeometry.translate(0, cocoonHeight / 2, 0);
  const cocoonTexture = clothTexture(options.colours.main, 3);
  textures.push(cocoonTexture);
  const cocoon = new Mesh(
    cocoonGeometry,
    own(new MeshStandardMaterial({ map: cocoonTexture, roughness: 0.9 })),
  );
  cocoon.position.y = FLOOR_TOP;
  cocoon.castShadow = true;
  cocoon.visible = false;
  figure.add(cocoon);

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
      cocoon.scale.set(1, 0.01, 1);
    },
    reset() {
      wound = null;
      cocoon.visible = false;
      shuffle.visible = true;
      figure.rotation.set(0, 0, 0);
      figure.position.set(0, 0, 0);
    },
    update(dt) {
      if (!wound) return;
      wound.age += dt;
      const winding = Math.min(1, wound.age / WIND_SECONDS);
      cocoon.scale.set(1, Math.max(0.01, winding), 1);
      cocoon.rotation.y = winding * 8;
      if (winding >= 0.8) shuffle.visible = false;
      const fallen = wound.age - WIND_SECONDS;
      const topple = Math.min(1, Math.max(0, fallen / TOPPLE_SECONDS));
      const landed = fallen - TOPPLE_SECONDS;
      const settle = landed > 0 ? Math.sin(landed * 16) * Math.exp(-landed * 5) * 0.08 : 0;
      figure.rotation.z = wound.side * (topple * topple * (Math.PI / 2 - 0.1) + settle);
      figure.position.y = topple * build.radius * 1.3;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
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
