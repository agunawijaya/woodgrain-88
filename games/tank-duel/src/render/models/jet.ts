/**
 * The jet miniature: a pointed fuselage with a tinted canopy, side intakes,
 * swept wings and tailplanes, a single fin, and a nozzle whose afterburner
 * flame grows and flickers with the throttle. The side's colour covers the
 * wings' upper surfaces and the fin, so a jet reads from above at a glance.
 *
 * Local frame: +x forward (nose), +y up, +z right wing; length about 3.3.
 */
import type { BufferGeometry } from 'three';
import {
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type IUniform,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { AircraftLook, AircraftModel } from './biplane.ts';
import { paintMaterial, planSolid, steelMaterial, type Outline } from './parts.ts';

/** A swept wing pair in plan view (x forward, y to the left), one piece through the fuselage. */
const WING: Outline = [
  [0.55, 0],
  [0.4, 0.35],
  [-0.45, 1.3],
  [-0.75, 1.32],
  [-0.62, 0.3],
  [-0.62, -0.3],
  [-0.75, -1.32],
  [-0.45, -1.3],
  [0.4, -0.35],
];

const TAILPLANE: Outline = [
  [0.1, 0],
  [0, 0.2],
  [-0.38, 0.68],
  [-0.55, 0.68],
  [-0.48, 0.15],
  [-0.48, -0.15],
  [-0.55, -0.68],
  [-0.38, -0.68],
  [0, -0.2],
];

/** The fin in side view (x forward, y up). */
const FIN: Outline = [
  [-0.95, 0.12],
  [-1.42, 0.82],
  [-1.62, 0.84],
  [-1.6, 0.1],
];

interface FlameUniforms {
  [name: string]: IUniform;
  throttle: IUniform<number>;
  time: IUniform<number>;
}

export function createJetModel(look: AircraftLook): AircraftModel {
  const root = new Group();
  root.name = 'jet';
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

  const body = keepMaterial(
    paintMaterial(look.body, { dustHeight: 0, mottle: 0.2, roughness: 0.45, metalness: 0.15 }),
  );
  const team = keepMaterial(
    paintMaterial(look.trim, { dustHeight: 0, mottle: 0.15, roughness: 0.7, metalness: 0.05 }),
  );
  const metal = keepMaterial(steelMaterial('#4d4b48'));
  const glass = keepMaterial(
    new MeshStandardMaterial({ color: '#1d2a38', roughness: 0.08, metalness: 0.6 }),
  );

  // Fuselage: a lathe from the nozzle to the needle nose, laid along +x and slimmed side to side.
  const profile = [
    [0.18, -1.62],
    [0.24, -1.45],
    [0.27, -0.9],
    [0.28, 0.0],
    [0.25, 0.7],
    [0.17, 1.2],
    [0.07, 1.55],
    [0.01, 1.68],
  ].map(([radius, along]) => new Vector2(radius, along));
  const fuselage = keep(new LatheGeometry(profile, 18));
  fuselage.rotateZ(-Math.PI / 2);
  fuselage.scale(1, 0.85, 0.9);
  mesh(fuselage, body);

  const canopy = mesh(keep(new SphereGeometry(0.2, 16, 10)), glass);
  canopy.scale.set(2.1, 0.9, 0.9);
  canopy.position.set(0.72, 0.18, 0);
  for (const side of [-1, 1]) {
    const intake = mesh(keep(new RoundedBoxGeometry(0.62, 0.22, 0.16, 2, 0.05)), body);
    intake.position.set(0.15, -0.02, side * 0.28);
    const mouth = mesh(keep(new RoundedBoxGeometry(0.04, 0.17, 0.12, 1, 0.02)), metal);
    mouth.position.set(0.46, -0.02, side * 0.28);
  }

  const wings = mesh(keep(planSolid(WING, 0.06, 0.02)), team);
  wings.position.set(-0.15, -0.05, 0);
  const underside = mesh(keep(planSolid(WING, 0.025, 0.008)), body);
  underside.position.set(-0.15, -0.065, 0);
  const tail = mesh(keep(planSolid(TAILPLANE, 0.04, 0.012)), team);
  tail.position.set(-1.12, 0.02, 0);
  const fin = mesh(keep(planSolid(FIN, 0.04, 0.012)), team);
  fin.rotation.x = Math.PI / 2;
  fin.position.set(0, 0.08, -0.02);
  // A nose stripe in the side's colour.
  const stripe = mesh(keep(new CylinderGeometry(0.245, 0.255, 0.12, 18)), team);
  stripe.rotation.z = Math.PI / 2;
  stripe.position.x = 0.62;
  stripe.scale.set(1, 0.85, 0.92);

  const nozzle = mesh(keep(new CylinderGeometry(0.17, 0.2, 0.22, 16, 1, true)), metal);
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.x = -1.68;

  // Afterburner: an additive cone behind the nozzle, longer and hotter with throttle.
  const flameUniforms: FlameUniforms = { throttle: { value: 0.5 }, time: { value: 0 } };
  const flameGeometry = keep(new ConeGeometry(0.16, 1, 14, 1, true));
  flameGeometry.rotateZ(Math.PI / 2);
  flameGeometry.translate(-0.5, 0, 0);
  const flame = new Mesh(
    flameGeometry,
    keepMaterial(
      new ShaderMaterial({
        uniforms: flameUniforms,
        vertexShader: /* glsl */ `
          varying float vAlong;
          void main() {
            vAlong = clamp(-position.x, 0.0, 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float throttle;
          uniform float time;
          varying float vAlong;
          void main() {
            float flicker = 0.85 + 0.15 * sin(time * 63.0 + vAlong * 17.0);
            float body = (1.0 - vAlong) * flicker;
            vec3 hot = mix(vec3(2.4, 1.6, 1.0), vec3(0.6, 0.35, 1.4), vAlong);
            gl_FragColor = vec4(hot * body * (0.35 + throttle * 1.1), 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
  );
  flame.position.x = -1.78;
  airframe.add(flame);

  const navMaterials: MeshStandardMaterial[] = [];
  for (const [side, colour] of [
    [-1, '#ff3b30'],
    [1, '#3dff7a'],
  ] as const) {
    const material = keepMaterial(
      new MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.2 }),
    );
    navMaterials.push(material);
    const light = mesh(keep(new SphereGeometry(0.04, 8, 6)), material);
    light.position.set(-0.78, -0.03, side * 1.47);
  }

  const muzzleLocal = new Vector3(1.6, 0, 0);
  let clock = 0;

  return {
    root,
    setAttitude(bank, pitch) {
      airframe.rotation.set(bank, 0, pitch, 'XZY');
    },
    update(dt, throttle) {
      clock += dt;
      flameUniforms.time.value = clock;
      flameUniforms.throttle.value = throttle;
      flame.scale.set(0.6 + throttle * 1.1, 1 + throttle * 0.3, 1 + throttle * 0.3);
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
