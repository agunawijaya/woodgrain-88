/**
 * The giant bomber: one big twin-engined biplane against three small ones
 * (channel 20). A long boxy fuselage with a glazed nose, two engines slung
 * under the lower wing with their own propeller discs, a broad upper wing in
 * the side's colour, and twin fins. It is drawn about twice a biplane's size
 * so the odd match-up reads at once: a large target with a long reach.
 *
 * Local frame: +x forward, +y up, +z right wing; wingspan about 6.6.
 */
import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type IUniform,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { AircraftLook, AircraftModel } from './biplane.ts';
import { paintMaterial, planSolid, steelMaterial, type Outline } from './parts.ts';

/** A long, straight wing with squared-off rounded tips (plan view, x forward, y left). */
function broadWing(span: number, chord: number): Outline {
  const half = span / 2;
  const round = chord * 0.35;
  const points: [number, number][] = [];
  for (const side of [1, -1]) {
    for (let step = 0; step <= 6; step++) {
      const angle = (step / 6) * Math.PI;
      const x = Math.cos(angle) * (chord / 2);
      const y = side * (half - round + Math.sin(angle) * round);
      points.push(side > 0 ? [x, y] : [-x, y]);
    }
  }
  return points;
}

const FIN: Outline = [
  [-2.2, 0.1],
  [-2.45, 0.85],
  [-2.85, 0.9],
  [-2.9, 0.1],
];

interface DiscUniforms {
  [name: string]: IUniform;
  opacity: IUniform<number>;
}

export function createBomberModel(look: AircraftLook): AircraftModel {
  const root = new Group();
  root.name = 'bomber';
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
    paintMaterial(look.trim, { dustHeight: 0, mottle: 0.25, roughness: 0.88 }),
  );
  const metal = keepMaterial(steelMaterial('#5e5b56'));
  const wood = keepMaterial(new MeshStandardMaterial({ color: '#6b4428', roughness: 0.55 }));
  const glazing = keepMaterial(
    new MeshStandardMaterial({
      color: '#b9d6e6',
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.6,
    }),
  );

  const body = keep(new RoundedBoxGeometry(4.6, 0.7, 0.72, 3, 0.2));
  mesh(body, fabric);
  const tailCone = keep(
    new LatheGeometry(
      [
        [0.34, 0],
        [0.24, 0.5],
        [0.1, 1.1],
      ].map(([radius, along]) => new Vector2(radius, along)),
      14,
    ),
  );
  tailCone.rotateZ(Math.PI / 2);
  const tail = mesh(tailCone, fabric);
  tail.position.x = -2.25;
  const nose = mesh(
    keep(new SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
    glazing,
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 2.3;

  for (const [span, chord, forward, height] of [
    [6.6, 1.05, 0.3, 0.95],
    [6.0, 0.95, 0.15, -0.3],
  ] as const) {
    const wing = mesh(keep(planSolid(broadWing(span, chord), 0.08, 0.025)), team);
    wing.position.set(forward, height, 0);
  }
  const strutGeometry = keep(new RoundedBoxGeometry(0.07, 1.2, 0.05, 1, 0.015));
  for (const side of [-1, 1]) {
    for (const reach of [1.3, 2.6]) {
      for (const along of [0.62, -0.18]) {
        const strut = mesh(strutGeometry, wood);
        strut.position.set(along, 0.33, side * reach);
      }
    }
  }

  const stabiliser = mesh(keep(planSolid(broadWing(2.4, 0.6), 0.05, 0.015)), team);
  stabiliser.position.set(-2.75, 0.15, 0);
  for (const side of [-1, 1]) {
    const fin = mesh(keep(planSolid(FIN, 0.04, 0.012)), team);
    fin.rotation.x = Math.PI / 2;
    fin.position.set(0, 0.1, side * 1.1 - 0.02);
  }

  // Engines under the lower wing, each with its own propeller disc.
  const discUniforms: DiscUniforms = { opacity: { value: 0.3 } };
  const discMaterial = keepMaterial(
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
          float ring = smoothstep(0.2, 0.4, radius) * (1.0 - smoothstep(0.85, 1.0, radius));
          gl_FragColor = vec4(vec3(0.42, 0.33, 0.25), opacity * ring);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  const discGeometry = keep(new CircleGeometry(0.62, 28));
  for (const side of [-1, 1]) {
    const nacelle = mesh(keep(new CylinderGeometry(0.22, 0.18, 1.3, 14)), metal);
    nacelle.rotation.z = Math.PI / 2;
    nacelle.position.set(0.55, -0.45, side * 1.55);
    const disc = new Mesh(discGeometry, discMaterial);
    disc.rotation.y = Math.PI / 2;
    disc.position.set(1.24, -0.45, side * 1.55);
    airframe.add(disc);
  }

  const navMaterials: MeshStandardMaterial[] = [];
  for (const [side, colour] of [
    [-1, '#ff3b30'],
    [1, '#3dff7a'],
  ] as const) {
    const material = keepMaterial(
      new MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.2 }),
    );
    navMaterials.push(material);
    const light = mesh(keep(new SphereGeometry(0.06, 8, 6)), material);
    light.position.set(0.3, 1.0, side * 3.28);
  }

  const muzzleLocal = new Vector3(2.7, 0, 0);

  return {
    root,
    setAttitude(bank, pitch) {
      airframe.rotation.set(bank * 0.6, 0, pitch, 'XZY');
    },
    update(_dt, throttle) {
      discUniforms.opacity.value = 0.18 + throttle * 0.2;
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
