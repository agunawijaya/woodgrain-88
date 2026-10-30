/**
 * Deep Space's two starfighters, our own designs, told apart by outline from
 * overhead before colour: seat 1's Lance is a long dart with swept delta wings
 * and one engine; seat 2's Crescent is a wide crescent wing round a short pod,
 * with two engines. Each wears its seat's colour on the wings and in its
 * engine light, flies a little above the backdrop over a soft shadow by day or
 * a pool of its own light by night, and burns a flame you can read at a glance.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Seat, SeatColours, ShipPose } from '../../look/look.ts';
import type { ShipFigure } from '../../look/space-rig.ts';

/** How high the ships fly over the backdrop, so they read as above it. */
const FLIGHT_HEIGHT = 0.55;
/** The designs are drawn about 2.2 long; this brings them to the size that reads from overhead. */
const DRAWN_SCALE = 1.15;
const HULL_THICKNESS = 0.14;

type Keep = <T extends BufferGeometry>(geometry: T) => T;

interface Design {
  /** The top-view outline, nose along +x, as points down one side; mirrored for the other. */
  readonly side: readonly (readonly [number, number])[];
  /** Panels in the seat's colour, as outlines down one side. */
  readonly panels: readonly (readonly (readonly [number, number])[])[];
  readonly canopy: { readonly x: number; readonly length: number; readonly width: number };
  /** Engines along the stern: across offsets and the stern's x. */
  readonly engines: readonly number[];
  readonly stern: number;
}

const LANCE: Design = {
  side: [
    [1.15, 0],
    [0.7, 0.12],
    [0.2, 0.19],
    [-0.38, 0.64],
    [-0.62, 0.68],
    [-0.6, 0.3],
    [-0.88, 0.22],
    [-1.02, 0.12],
  ],
  panels: [
    [
      [-0.05, 0.24],
      [-0.4, 0.58],
      [-0.55, 0.6],
      [-0.52, 0.3],
    ],
  ],
  canopy: { x: 0.42, length: 0.5, width: 0.2 },
  engines: [0],
  stern: -1.02,
};

const CRESCENT: Design = {
  side: [
    [0.78, 0],
    [0.62, 0.22],
    [0.3, 0.58],
    [-0.1, 0.86],
    [-0.62, 1.02],
    [-0.42, 0.7],
    [-0.3, 0.4],
    [-0.42, 0.22],
    [-0.72, 0.18],
  ],
  panels: [
    [
      [0.12, 0.62],
      [-0.12, 0.82],
      [-0.5, 0.94],
      [-0.36, 0.7],
      [-0.2, 0.48],
    ],
  ],
  canopy: { x: 0.28, length: 0.42, width: 0.26 },
  engines: [-0.17, 0.17],
  stern: -0.72,
};

const DESIGNS: readonly [Design, Design] = [LANCE, CRESCENT];

function outlineShape(side: readonly (readonly [number, number])[], closedAcross: boolean): Shape {
  const shape = new Shape();
  const [first, ...rest] = side;
  if (!first) return shape;
  shape.moveTo(first[0], first[1]);
  for (const [x, z] of rest) shape.lineTo(x, z);
  if (closedAcross) {
    for (const [x, z] of [...side].reverse()) shape.lineTo(x, -z);
  }
  shape.closePath();
  return shape;
}

/** A flat outline given thickness, lying on the table with its top up. */
function slab(shape: Shape, thickness: number, bevel: number, keep: Keep): BufferGeometry {
  const geometry = keep(
    new ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 6,
    }),
  );
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** The engine flame's colour along its length: white at the nozzle, the seat's colour, then nothing. */
function flameTexture(colour: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the flame');
  const gradient = context.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, colour);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 8, 64);
  return new CanvasTexture(canvas);
}

/** A soft round spot: the shadow by day, the ship's own light under it by night. */
function spotTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the spot');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

export function createDeepShip(options: {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}): ShipFigure {
  const { seat, colours, night } = options;
  const design = DESIGNS[seat];
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep: Keep = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const accent = new Color(colours.main);

  // By night a metal hull catching the star with its panels lit in the seat's colour; by day the
  // hull itself is painted in that colour with white panels, crisp against the pale dome.
  const hull = own(
    new MeshPhysicalMaterial({
      color: night ? '#a8b1c4' : colours.main,
      emissive: night ? '#1a2030' : '#000000',
      metalness: night ? 0.55 : 0.05,
      roughness: night ? 0.32 : 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
    }),
  );
  const paint = own(
    new MeshStandardMaterial({
      color: night ? colours.main : '#f7f8fb',
      emissive: night ? accent.clone().multiplyScalar(0.45) : new Color('#000000'),
      roughness: 0.45,
    }),
  );
  const outline = own(new MeshBasicMaterial({ color: '#16203a' }));
  const trim = own(
    new MeshStandardMaterial({ color: night ? '#151924' : '#2b3142', roughness: 0.5 }),
  );
  const glass = own(
    new MeshPhysicalMaterial({
      color: '#0d1626',
      roughness: 0.05,
      metalness: 0.2,
      clearcoat: 1,
    }),
  );
  const nozzleGlow = own(
    new MeshBasicMaterial({ color: accent.clone().multiplyScalar(night ? 2.2 : 1.3) }),
  );

  const root = new Group();
  root.name = `deep-ship-${seat}`;
  const body = new Group();
  body.position.y = FLIGHT_HEIGHT;
  body.scale.setScalar(DRAWN_SCALE);
  root.add(body);

  const spot = spotTexture();
  const spotMaterial = own(
    new MeshBasicMaterial({
      map: spot,
      color: night ? accent.clone().multiplyScalar(0.9) : new Color('#1d2a48'),
      transparent: true,
      opacity: night ? 0.32 : 0.3,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const pool = new Mesh(keep(new PlaneGeometry(2.4, 1.8).rotateX(-Math.PI / 2)), spotMaterial);
  pool.position.y = 0.01;
  root.add(pool);

  const hullGeometry = slab(outlineShape(design.side, true), HULL_THICKNESS, 0.04, keep);
  const hullMesh = new Mesh(hullGeometry, hull);
  hullMesh.castShadow = true;
  body.add(hullMesh);
  if (!night) {
    // A slightly larger dark copy under the hull draws its outline, the way an ink line would.
    const rim = new Mesh(hullGeometry, outline);
    rim.scale.set(1.06, 0.6, 1.1);
    rim.position.y = -0.02;
    body.add(rim);
  }
  for (const panel of design.panels) {
    for (const mirror of [1, -1]) {
      const shape = outlineShape(
        panel.map(([x, z]) => [x, z * mirror] as const),
        false,
      );
      const mesh = new Mesh(slab(shape, 0.02, 0.0, keep), paint);
      mesh.position.y = HULL_THICKNESS + 0.04;
      body.add(mesh);
    }
  }
  // A spine down the middle so the hull has a back, not only a silhouette.
  const spine = new Mesh(keep(new CylinderGeometry(0.1, 0.13, 1, 12).rotateZ(Math.PI / 2)), hull);
  spine.scale.set(Math.abs(design.stern) + design.canopy.x, 1, 1);
  spine.position.set((design.canopy.x + design.stern) / 2, HULL_THICKNESS + 0.05, 0);
  body.add(spine);

  const canopy = new Mesh(
    keep(new SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
    glass,
  );
  canopy.scale.set(design.canopy.length / 2, 0.16, design.canopy.width / 2);
  canopy.position.set(design.canopy.x, HULL_THICKNESS + 0.08, 0);
  body.add(canopy);

  const flameMap = flameTexture(colours.main);
  // By night the flame is light added to the dark; by day added light vanishes on the pale dome,
  // so it is painted, a solid hot colour fading out.
  const flameMaterial = own(
    new MeshBasicMaterial({
      map: flameMap,
      color: night ? new Color(1, 1, 1).multiplyScalar(2.4) : new Color('#ffffff'),
      transparent: true,
      depthWrite: false,
      blending: night ? AdditiveBlending : NormalBlending,
    }),
  );
  const flameGeometry = keep(
    new ConeGeometry(night ? 0.13 : 0.16, 1, 14, 1, true).rotateZ(Math.PI / 2),
  );
  flameGeometry.translate(-0.5, 0, 0);
  const flames: Mesh[] = [];
  for (const across of design.engines) {
    const nozzle = new Mesh(
      keep(new CylinderGeometry(0.09, 0.11, 0.16, 14).rotateZ(Math.PI / 2)),
      trim,
    );
    nozzle.position.set(design.stern - 0.02, HULL_THICKNESS / 2, across);
    body.add(nozzle);
    const ring = new Mesh(
      keep(new CylinderGeometry(0.07, 0.07, 0.02, 14).rotateZ(Math.PI / 2)),
      nozzleGlow,
    );
    ring.position.set(design.stern - 0.11, HULL_THICKNESS / 2, across);
    body.add(ring);
    const flame = new Mesh(flameGeometry, flameMaterial);
    flame.position.set(design.stern - 0.1, HULL_THICKNESS / 2, across);
    flame.visible = false;
    body.add(flame);
    flames.push(flame);
  }

  let flicker = 0;
  const flashColour = new Color('#ffffff');
  const restingEmissive = hull.emissive.clone();

  return {
    root,
    pose(pose: ShipPose, dt: number) {
      root.position.set(pose.x, 0, pose.z);
      root.rotation.y = pose.heading;
      flicker += dt * 30;
      const length = 0.75 + Math.sin(flicker) * 0.08 + Math.sin(flicker * 2.7) * 0.06;
      for (const flame of flames) {
        flame.visible = pose.thrusting;
        flame.scale.set(length, 1, 1);
      }
      root.visible = pose.cloak < 1;
    },
    spin(progress) {
      // The cartridge inverts a hit ship's picture every four frames while it spins.
      const flashed = progress !== null && Math.floor(progress * 16) % 2 === 0;
      hull.emissive.copy(flashed ? flashColour : restingEmissive);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      flameMap.dispose();
      spot.dispose();
    },
  };
}
