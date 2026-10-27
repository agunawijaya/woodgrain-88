/**
 * The biplane miniature: a doped-fabric fuselage behind a round engine
 * cowling, two staggered wings joined by struts and crossed rigging wires, a
 * tail with fin and rudder, fixed wheels, and a propeller that blurs into a
 * disc when it spins. The wings carry the side's colour on top, where it
 * reads from above, with a pale chevron near each tip.
 *
 * Local frame: +x forward (nose), +y up, +z right wing; wingspan about 3.8.
 */
import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { paintMaterial, planSolid, steelMaterial, type Outline } from './parts.ts';

export interface AircraftLook {
  /** Fuselage and lower surfaces. */
  readonly body: string;
  /** The side's colour, on the wings' upper surfaces and the tail. */
  readonly trim: string;
}

export interface AircraftModel {
  readonly root: Group;
  /** Banks the airframe (radians, positive rolls right) and pitches it (positive nose up). */
  setAttitude(bank: number, pitch: number): void;
  /** Turns the propeller or engine by elapsed time and throttle (0 idle to 1 full). */
  update(dt: number, throttle: number): void;
  /** Where its guns fire from, in world space. */
  muzzle(target: Vector3): Vector3;
  setNavigationLights(strength: number): void;
  dispose(): void;
}

/** A wing in plan view (x forward, y towards the left tip), rounded at the tips. */
function wingOutline(span: number, chord: number): Outline {
  const half = span / 2;
  const tip = chord * 0.5;
  const points: [number, number][] = [];
  for (let step = 0; step <= 8; step++) {
    const angle = -Math.PI / 2 + (step / 8) * Math.PI;
    points.push([Math.sin(angle) * (chord / 2), half - tip + Math.cos(angle) * tip]);
  }
  for (let step = 0; step <= 8; step++) {
    const angle = Math.PI / 2 + (step / 8) * Math.PI;
    points.push([Math.sin(angle) * (chord / 2), -half + tip + Math.cos(angle) * tip]);
  }
  return points;
}

const CHEVRON: Outline = [
  [0.16, 0],
  [-0.08, 0.2],
  [-0.16, 0.15],
  [0.02, 0],
  [-0.16, -0.15],
  [-0.08, -0.2],
];

export function createBiplaneModel(look: AircraftLook): AircraftModel {
  const root = new Group();
  root.name = 'biplane';
  const airframe = new Group();
  root.add(airframe);
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
  const mesh = (
    geometry: BufferGeometry,
    material: Material,
    parent: Object3D = airframe,
  ): Mesh => {
    const part = new Mesh(geometry, material);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  };

  const fabric = keepMaterial(
    paintMaterial(look.body, { dustHeight: 0, mottle: 0.3, roughness: 0.85 }),
  );
  const team = keepMaterial(
    // Matt dope, so the table's reflections never wash the team colour out when seen from above.
    paintMaterial(look.trim, { dustHeight: 0, mottle: 0.25, roughness: 0.88 }),
  );
  const pale = keepMaterial(paintMaterial('#f1ead8', { dustHeight: 0, mottle: 0.2 }));
  const metal = keepMaterial(steelMaterial('#6b6863'));
  const wood = keepMaterial(new MeshStandardMaterial({ color: '#6b4428', roughness: 0.55 }));
  const tyre = keepMaterial(new MeshStandardMaterial({ color: '#25221f', roughness: 0.9 }));

  // Fuselage: a lathe profile from the cowling back to the tail post, turned to lie along +x.
  const profile = [
    [0.02, -1.48],
    [0.08, -1.4],
    [0.16, -1.0],
    [0.25, -0.4],
    [0.31, 0.2],
    [0.33, 0.7],
    [0.34, 1.0],
    [0.3, 1.18],
    [0.2, 1.26],
    [0.02, 1.28],
  ].map(([radius, along]) => new Vector2(radius, along));
  const body = keep(new LatheGeometry(profile, 18));
  body.rotateZ(-Math.PI / 2);
  body.scale(1, 0.95, 0.82);
  mesh(body, fabric);
  const cowling = mesh(keep(new TorusGeometry(0.3, 0.07, 10, 22)), metal);
  cowling.rotation.y = Math.PI / 2;
  cowling.position.x = 1.08;
  const coaming = mesh(keep(new TorusGeometry(0.17, 0.035, 8, 18)), wood);
  coaming.rotation.x = Math.PI / 2;
  coaming.scale.set(1.3, 1, 1);
  coaming.position.set(-0.15, 0.27, 0);
  const screen = mesh(
    keep(new RoundedBoxGeometry(0.02, 0.14, 0.26, 1, 0.01)),
    keepMaterial(
      new MeshStandardMaterial({
        color: '#cfe6f2',
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.45,
      }),
    ),
  );
  screen.position.set(0.1, 0.36, 0);
  screen.rotation.z = -0.35;

  // Wings: the upper one staggered forward, both with the team colour on top.
  const wings: [number, number, number, number][] = [
    [3.8, 0.72, 0.18, 0.66],
    [3.4, 0.66, 0.02, -0.2],
  ];
  for (const [span, chord, forward, height] of wings) {
    const wing = mesh(keep(planSolid(wingOutline(span, chord), 0.07, 0.025)), team);
    wing.position.set(forward, height, 0);
    const underside = mesh(
      keep(planSolid(wingOutline(span * 0.995, chord * 0.98), 0.03, 0.01)),
      fabric,
    );
    underside.position.set(forward, height - 0.005, 0);
    for (const side of [-1, 1]) {
      const chevron = mesh(keep(planSolid(CHEVRON, 0.012, 0.003)), pale);
      chevron.position.set(forward, height + 0.07, side * (span / 2 - 0.55));
      chevron.scale.setScalar(1.4);
    }
  }

  // Struts between the wings and from the fuselage up to the top wing.
  const strutGeometry = keep(new RoundedBoxGeometry(0.06, 0.88, 0.035, 1, 0.012));
  for (const side of [-1, 1]) {
    for (const along of [0.32, -0.12]) {
      const strut = mesh(strutGeometry, wood);
      strut.position.set(along, 0.23, side * 1.3);
      strut.rotation.z = -0.12;
    }
    for (const along of [0.32, -0.1]) {
      const cabane = mesh(keep(new CylinderGeometry(0.018, 0.018, 0.42, 6)), metal);
      cabane.position.set(along, 0.45, side * 0.24);
      cabane.rotation.x = side * 0.28;
    }
  }

  // Rigging: crossed wires in each wing bay, drawn as fine lines.
  const wirePoints: number[] = [];
  for (const side of [-1, 1]) {
    const outer = side * 1.3;
    const inner = side * 0.3;
    wirePoints.push(0.1, 0.62, outer, 0.1, -0.16, inner, 0.1, 0.62, inner, 0.1, -0.16, outer);
  }
  const wireGeometry = keep(new BufferGeometry());
  wireGeometry.setAttribute('position', new Float32BufferAttribute(wirePoints, 3));
  const wires = new LineSegments(
    wireGeometry,
    keepMaterial(new LineBasicMaterial({ color: '#3a332c' })),
  );
  airframe.add(wires);

  // Tail: stabiliser, fin and rudder in the team colour.
  const stabiliser = mesh(keep(planSolid(wingOutline(1.4, 0.46), 0.04, 0.012)), team);
  stabiliser.position.set(-1.25, 0.05, 0);
  const fin = mesh(keep(planSolid(finOutline(), 0.035, 0.01)), team);
  fin.rotation.x = Math.PI / 2;
  fin.position.set(0, 0.06, -0.0175);

  // Undercarriage.
  for (const side of [-1, 1]) {
    const leg = mesh(keep(new CylinderGeometry(0.022, 0.022, 0.52, 6)), metal);
    leg.position.set(0.5, -0.45, side * 0.24);
    leg.rotation.x = side * -0.3;
    const wheel = mesh(keep(new TorusGeometry(0.15, 0.055, 8, 16)), tyre);
    wheel.position.set(0.5, -0.68, side * 0.36);
    const hub = mesh(keep(new CylinderGeometry(0.06, 0.06, 0.08, 10)), metal);
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(wheel.position);
  }
  const skid = mesh(keep(new CylinderGeometry(0.015, 0.015, 0.3, 5)), metal);
  skid.position.set(-1.32, -0.12, 0);
  skid.rotation.z = 0.7;

  // Propeller: blades and a blur disc that takes over as it speeds up.
  const propeller = new Group();
  propeller.position.x = 1.32;
  airframe.add(propeller);
  const spinner = mesh(keep(new SphereGeometry(0.09, 12, 8)), metal, propeller);
  spinner.scale.set(1.4, 1, 1);
  const bladeGeometry = keep(new RoundedBoxGeometry(0.04, 1.4, 0.11, 1, 0.015));
  const blades = mesh(bladeGeometry, wood, propeller);
  blades.rotation.x = 0.2;
  const discUniforms = { opacity: { value: 0.3 } };
  const disc = new Mesh(
    keep(new CircleGeometry(0.72, 32)),
    keepMaterial(
      new ShaderMaterial({
        uniforms: discUniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv * 2.0 - 1.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float opacity;
          varying vec2 vUv;
          void main() {
            float radius = length(vUv);
            float streak = 0.6 + 0.4 * sin(atan(vUv.y, vUv.x) * 2.0);
            float ring = smoothstep(0.15, 0.4, radius) * (1.0 - smoothstep(0.85, 1.0, radius));
            gl_FragColor = vec4(vec3(0.42, 0.33, 0.25), opacity * ring * streak);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    ),
  );
  disc.rotation.y = Math.PI / 2;
  propeller.add(disc);

  // Navigation lights: red on the left tip, green on the right, for night flying.
  const navMaterials: MeshStandardMaterial[] = [];
  for (const [side, colour] of [
    [-1, '#ff3b30'],
    [1, '#3dff7a'],
  ] as const) {
    const material = keepMaterial(
      new MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.2 }),
    );
    navMaterials.push(material);
    const light = mesh(keep(new SphereGeometry(0.045, 8, 6)), material);
    light.position.set(0.15, 0.7, side * 1.88);
  }

  const muzzleLocal = new Vector3(1.0, 0.5, 0);
  let propellerAngle = 0;

  return {
    root,
    setAttitude(bank, pitch) {
      airframe.rotation.set(bank, 0, pitch, 'XZY');
    },
    update(dt, throttle) {
      const speed = 40 + throttle * 50;
      propellerAngle += speed * dt;
      propeller.rotation.x = propellerAngle;
      // At speed the blades vanish into the disc, as they do on a camera.
      blades.visible = throttle < 0.05;
      discUniforms.opacity.value = 0.18 + throttle * 0.22;
    },
    muzzle(target) {
      airframe.updateWorldMatrix(true, false);
      return target.copy(muzzleLocal).applyMatrix4(airframe.matrixWorld);
    },
    setNavigationLights(strength) {
      for (const material of navMaterials) material.emissiveIntensity = 0.2 + strength * 6;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.removeFromParent();
    },
  };
}

/** Fin and rudder in side view (x forward, y up), at the tail. */
function finOutline(): Outline {
  return [
    [-1.06, 0.06],
    [-1.3, 0.5],
    [-1.46, 0.52],
    [-1.52, 0.3],
    [-1.5, 0.02],
  ];
}
