/**
 * The Brass Orrery's two clockwork craft, our own designs. Seat 1's Clipper is
 * a long brass hull with a pointed prow, an enamel deck in the seat's colour
 * and a mast topped by a turning gear; seat 2's Beetle is a round brass dome
 * whose two enamel wing cases part over a pair of turning gears. Each is
 * pushed along by a candle flame at its stern that flares when it thrusts.
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
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Seat, SeatColours, ShipPose } from '../../look/look.ts';
import type { ShipFigure } from '../../look/space-rig.ts';

const FLIGHT_HEIGHT = 0.5;
/** The craft are built about 2.3 long; this brings them to the size that reads from overhead. */
const DRAWN_SCALE = 1.2;
const GEAR_TEETH = 12;

type Keep = <T extends BufferGeometry>(geometry: T) => T;

/** A flat gear: a toothed disc with a hole, extruded thin. */
export function gearGeometry(radius: number, keep: Keep): BufferGeometry {
  const shape = new Shape();
  const steps = GEAR_TEETH * 4;
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const tooth = step % 4 < 2 ? 1 : 0.8;
    const x = Math.cos(angle) * radius * tooth;
    const y = Math.sin(angle) * radius * tooth;
    if (step === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Shape();
  hole.absarc(0, 0, radius * 0.3, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = keep(new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }));
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function prowShape(points: readonly (readonly [number, number])[]): Shape {
  const shape = new Shape();
  const [first, ...rest] = points;
  if (!first) return shape;
  shape.moveTo(first[0], first[1]);
  for (const [x, z] of rest) shape.lineTo(x, z);
  for (const [x, z] of [...points].reverse()) shape.lineTo(x, -z);
  shape.closePath();
  return shape;
}

function slab(shape: Shape, depth: number, keep: Keep): BufferGeometry {
  const geometry = keep(
    new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    }),
  );
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the candle glow');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

export function createBrassShip(options: {
  readonly seat: Seat;
  readonly colours: SeatColours;
  readonly night: boolean;
}): ShipFigure {
  const { seat, colours, night } = options;
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
  const brass = own(new MeshStandardMaterial({ color: '#d1a04b', metalness: 1, roughness: 0.28 }));
  const darkBrass = own(
    new MeshStandardMaterial({ color: '#80602c', metalness: 1, roughness: 0.38 }),
  );
  const enamel = own(
    new MeshStandardMaterial({
      color: colours.main,
      roughness: 0.25,
      metalness: 0.1,
      emissive: new Color(colours.main).multiplyScalar(night ? 0.18 : 0),
    }),
  );

  const root = new Group();
  root.name = `brass-ship-${seat}`;
  const body = new Group();
  body.position.y = FLIGHT_HEIGHT;
  body.scale.setScalar(DRAWN_SCALE);
  root.add(body);
  const gears: Mesh[] = [];
  let sternX: number;

  if (seat === 0) {
    const hull = new Mesh(
      slab(
        prowShape([
          [1.25, 0],
          [0.7, 0.32],
          [-0.2, 0.42],
          [-1.05, 0.38],
          [-1.12, 0.3],
        ]),
        0.16,
        keep,
      ),
      brass,
    );
    hull.castShadow = true;
    body.add(hull);
    const deck = new Mesh(
      slab(
        prowShape([
          [0.85, 0],
          [0.5, 0.2],
          [-0.2, 0.28],
          [-0.9, 0.25],
          [-0.95, 0.18],
        ]),
        0.04,
        keep,
      ),
      enamel,
    );
    deck.position.y = 0.2;
    body.add(deck);
    const mast = new Mesh(keep(new CylinderGeometry(0.035, 0.045, 0.6, 8)), darkBrass);
    mast.position.set(0.05, 0.5, 0);
    body.add(mast);
    const gear = new Mesh(gearGeometry(0.36, keep), brass);
    gear.position.set(0.05, 0.8, 0);
    body.add(gear);
    gears.push(gear);
    sternX = -1.12;
  } else {
    const dome = new Mesh(
      keep(new SphereGeometry(0.72, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2)),
      brass,
    );
    dome.scale.set(1.25, 0.55, 1);
    dome.castShadow = true;
    body.add(dome);
    for (const side of [-1, 1]) {
      const wing = new Mesh(
        keep(new SphereGeometry(0.74, 24, 14, 0, Math.PI, 0, Math.PI / 2)),
        enamel,
      );
      wing.scale.set(1.15, 0.58, 0.95);
      wing.rotation.y = side > 0 ? 0.15 : Math.PI - 0.15;
      wing.position.set(-0.1, 0.01, side * 0.07);
      body.add(wing);
      const gear = new Mesh(gearGeometry(0.28, keep), darkBrass);
      gear.position.set(0.35, 0.36, side * 0.34);
      body.add(gear);
      gears.push(gear);
    }
    const head = new Mesh(keep(new SphereGeometry(0.26, 18, 12)), darkBrass);
    head.scale.set(1, 0.7, 1.1);
    head.position.set(0.9, 0.05, 0);
    body.add(head);
    sternX = -0.92;
  }

  // The candle at the stern: a stub of wax and a flame that flares back when the craft thrusts.
  const wax = new Mesh(
    keep(new CylinderGeometry(0.1, 0.1, 0.24, 12)),
    own(new MeshStandardMaterial({ color: '#f1e6cf', roughness: 0.7 })),
  );
  wax.position.set(sternX - 0.02, 0.22, 0);
  body.add(wax);
  const flameMaterial = own(
    new MeshBasicMaterial({ color: new Color('#ffb340').multiplyScalar(night ? 3 : 1.8) }),
  );
  const coreMaterial = own(
    new MeshBasicMaterial({ color: new Color('#fff4c8').multiplyScalar(night ? 3 : 1.6) }),
  );
  const flame = new Group();
  flame.position.set(sternX - 0.02, 0.36, 0);
  const tongue = new Mesh(keep(new ConeGeometry(0.09, 0.32, 12)), flameMaterial);
  tongue.position.y = 0.12;
  flame.add(tongue);
  const bead = new Mesh(keep(new SphereGeometry(0.09, 12, 8)), flameMaterial);
  flame.add(bead);
  const core = new Mesh(keep(new SphereGeometry(0.05, 10, 8)), coreMaterial);
  core.position.y = 0.02;
  flame.add(core);
  body.add(flame);
  const glowMap = glowTexture();
  const glowMaterial = own(
    new MeshBasicMaterial({
      map: glowMap,
      color: new Color('#ffae4a').multiplyScalar(night ? 1.4 : 0.6),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const glow = new Mesh(keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), glowMaterial);
  glow.position.set(sternX - 0.1, 0.3, 0);
  body.add(glow);

  let flicker = 0;
  const restingEmissive = enamel.emissive.clone();
  return {
    root,
    pose(pose: ShipPose, dt: number) {
      root.position.set(pose.x, 0, pose.z);
      root.rotation.y = pose.heading;
      flicker += dt;
      for (const [index, gear] of gears.entries()) {
        gear.rotation.y += dt * (pose.thrusting ? 6 : 1.5) * (index % 2 === 0 ? 1 : -1);
      }
      // Thrusting, the flame stretches back along the hull and burns brighter.
      const lean = pose.thrusting ? 1 : 0;
      flame.rotation.z = lean * 1.2 + Math.sin(flicker * 17) * 0.06;
      const size = (pose.thrusting ? 1.6 : 0.9) * (1 + Math.sin(flicker * 23) * 0.06);
      flame.scale.setScalar(size);
      glow.scale.setScalar(pose.thrusting ? 1.6 : 0.9);
      root.visible = pose.cloak < 1;
    },
    spin(progress) {
      const flashed = progress !== null && Math.floor(progress * 16) % 2 === 0;
      enamel.emissive.copy(flashed ? new Color('#ffffff') : restingEmissive);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      glowMap.dispose();
    },
  };
}
