/**
 * The tank miniature. Low-poly but properly built: a hull with a sloped
 * glacis and an engine deck, two track runs whose treads really scroll as it
 * drives, road wheels that turn, a tapered turret with a mantlet, a long
 * barrel with a muzzle brake that kicks back when it fires, a whip antenna
 * that sways, headlights for night and a bright band of team colour round the
 * turret so each side reads at a glance from across the table.
 *
 * Local frame: +x is forward, +y up, +z the tank's right; one unit is half a
 * floor cell. The tank stands about 1.25 units tall and fits a 1.4 radius.
 */
import { bakeSurface, smoothstep, type SurfaceMaps } from '@woodgrain-88/arena';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type IUniform,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  lampMaterial,
  paintMaterial,
  planSolid,
  profileSolid,
  rubberMaterial,
  steelMaterial,
  taperTop,
  type Outline,
} from './parts.ts';

export interface TankLook {
  /** Base paint of the miniature. */
  readonly paint: string;
  /** The bright team colour: turret band, roof chevron, antenna pennant. */
  readonly trim: string;
}

export interface TankModel {
  readonly root: Group;
  /** Rolls the treads and wheels by the distance each side travelled (turning in place moves them opposite ways). */
  roll(leftDistance: number, rightDistance: number): void;
  /** Kicks the barrel back and shakes the antenna, for a shot. */
  recoil(): void;
  /** A jolt that sets the antenna swinging (bumps and hits). */
  jolt(strength: number): void;
  setHeadlights(strength: number): void;
  /** The muzzle's position in world space. */
  muzzle(target: Vector3): Vector3;
  update(dt: number): void;
  dispose(): void;
}

const TRACK_CENTRE = 0.8;
const TRACK_WIDTH = 0.52;
const BELT_THICKNESS = 0.075;
const LINK_PITCH = 0.15;
const WHEEL_RADIUS = 0.2;
const BARREL_LENGTH = 1.38;
const BARREL_HEIGHT = 1.0;

let sharedTread: SurfaceMaps | null = null;

/** Cast steel track links: a raised grouser bar per link, worn bright where it meets the ground. */
function treadSurface(): SurfaceMaps {
  sharedTread ??= bakeSurface({
    size: 64,
    normalStrength: 4,
    height(u, v) {
      const bar = smoothstep(0.08, 0.16, u) * (1 - smoothstep(0.5, 0.58, u));
      const guide = smoothstep(0.44, 0.47, v) * (1 - smoothstep(0.53, 0.56, v));
      const pin = Math.abs(u - 0.78) < 0.05 ? 0.35 : 0;
      return 0.3 + bar * 0.6 + guide * 0.3 - pin * 0.3;
    },
    colour(height) {
      const worn = smoothstep(0.7, 0.9, height);
      const dark = [58, 54, 50] as const;
      const bright = [128, 121, 110] as const;
      return [
        dark[0] + (bright[0] - dark[0]) * worn,
        dark[1] + (bright[1] - dark[1]) * worn,
        dark[2] + (bright[2] - dark[2]) * worn,
      ];
    },
    roughness(height) {
      return 0.82 - smoothstep(0.7, 0.9, height) * 0.35;
    },
  });
  return sharedTread;
}

/** The loop a track belt follows in side view: two wheels joined by tangent runs, front slightly raised. */
function beltPath(): { points: Vector3[]; normals: Vector3[]; lengths: number[] } {
  const front = { x: 1.18, y: 0.34, r: 0.29 };
  const rear = { x: -1.22, y: 0.31, r: 0.29 };
  const points: Vector3[] = [];
  const normals: Vector3[] = [];
  const steps = 28;
  const along = new Vector3(front.x - rear.x, front.y - rear.y, 0).normalize();
  const up = new Vector3(-along.y, along.x, 0);
  const baseAngle = Math.atan2(up.y, up.x);
  const arc = (centre: { x: number; y: number; r: number }, start: number) => {
    for (let step = 0; step <= steps; step++) {
      const angle = start - (step / steps) * Math.PI;
      const normal = new Vector3(Math.cos(angle), Math.sin(angle), 0);
      points.push(new Vector3(centre.x, centre.y, 0).addScaledVector(normal, centre.r));
      normals.push(normal);
    }
  };
  // Clockwise in side view: over the top towards the front, round the front wheel, back along the ground.
  arc(front, baseAngle);
  arc(rear, baseAngle + Math.PI);
  points.push(points[0]?.clone() ?? new Vector3());
  normals.push(normals[0]?.clone() ?? new Vector3(0, 1, 0));
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1] ?? new Vector3();
    lengths.push((lengths[index - 1] ?? 0) + (points[index] ?? previous).distanceTo(previous));
  }
  return { points, normals, lengths };
}

/** A closed belt: tread face outside, plain steel edges, u measured in links so the texture repeats per link. */
function beltGeometry(): BufferGeometry {
  const { points, normals, lengths } = beltPath();
  const positions: number[] = [];
  const surfaceNormals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const half = TRACK_WIDTH / 2;
  const addStrip = (
    offsetOut: number,
    zFrom: number,
    zTo: number,
    facing: (normal: Vector3) => Vector3,
  ) => {
    const start = positions.length / 3;
    points.forEach((point, index) => {
      const normal = normals[index] ?? new Vector3(0, 1, 0);
      const u = (lengths[index] ?? 0) / LINK_PITCH;
      for (const [z, v] of [
        [zFrom, 0],
        [zTo, 1],
      ] as const) {
        const position = point.clone().addScaledVector(normal, offsetOut);
        positions.push(position.x, position.y, z);
        const shading = facing(normal);
        surfaceNormals.push(shading.x, shading.y, shading.z);
        uvs.push(u, v);
      }
    });
    for (let index = 0; index < points.length - 1; index++) {
      const a = start + index * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  addStrip(0, -half, half, (normal) => normal);
  addStrip(-BELT_THICKNESS, half, -half, (normal) => normal.clone().negate());
  for (const side of [-1, 1]) {
    const start = positions.length / 3;
    points.forEach((point, index) => {
      const normal = normals[index] ?? new Vector3(0, 1, 0);
      const outer = point;
      const inner = point.clone().addScaledVector(normal, -BELT_THICKNESS);
      for (const position of [outer, inner]) {
        positions.push(position.x, position.y, half * side);
        surfaceNormals.push(0, 0, side);
        uvs.push((lengths[index] ?? 0) / LINK_PITCH, 0.5);
      }
    });
    for (let index = 0; index < points.length - 1; index++) {
      const a = start + index * 2;
      if (side > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(surfaceNormals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
}

const HULL_SIDE: Outline = [
  [-1.34, 0.26],
  [1.22, 0.26],
  [1.44, 0.52],
  [0.58, 0.8],
  [-1.3, 0.8],
  [-1.38, 0.7],
];

const TURRET_PLAN: Outline = [
  [0.66, 0],
  [0.52, 0.42],
  [0.12, 0.56],
  [-0.5, 0.54],
  [-0.78, 0.32],
  [-0.78, -0.32],
  [-0.5, -0.54],
  [0.12, -0.56],
  [0.52, -0.42],
];

const CHEVRON_PLAN: Outline = [
  [0.22, 0],
  [-0.12, 0.3],
  [-0.24, 0.24],
  [0.02, 0],
  [-0.24, -0.24],
  [-0.12, -0.3],
];

const FENDER_SIDE: Outline = [
  [-1.36, 0.64],
  [1.3, 0.64],
  [1.5, 0.5],
  [1.53, 0.54],
  [1.34, 0.7],
  [-1.36, 0.7],
];

interface Spring {
  angle: number;
  velocity: number;
}

export function createTankModel(look: TankLook): TankModel {
  const root = new Group();
  root.name = 'tank';
  const owned: { geometries: BufferGeometry[]; materials: Material[]; textures: Texture[] } = {
    geometries: [],
    materials: [],
    textures: [],
  };
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    owned.geometries.push(geometry);
    return geometry;
  };
  const keepMaterial = <T extends Material>(material: T): T => {
    owned.materials.push(material);
    return material;
  };
  const mesh = (geometry: BufferGeometry, material: Material, parent: Object3D = root): Mesh => {
    const part = new Mesh(geometry, material);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  };

  const paint = keepMaterial(paintMaterial(look.paint, { dustHeight: 0.6 }));
  const darkPaint = keepMaterial(
    paintMaterial(new Color(look.paint).multiplyScalar(0.72), { dustHeight: 0.7 }),
  );
  const trim = keepMaterial(
    new MeshStandardMaterial({
      color: look.trim,
      roughness: 0.45,
      metalness: 0.05,
      emissive: look.trim,
      emissiveIntensity: 0.08,
    }),
  );
  const steel = keepMaterial(steelMaterial());
  const rubber = keepMaterial(rubberMaterial());
  const lamp = keepMaterial(lampMaterial('#ffd9a0'));

  // Hull and engine deck.
  mesh(keep(profileSolid(HULL_SIDE, 1.24, 0.04)), paint);
  const deck = mesh(keep(new RoundedBoxGeometry(0.62, 0.05, 0.86, 2, 0.02)), darkPaint);
  deck.position.set(-0.95, 0.82, 0);
  for (let slat = 0; slat < 5; slat++) {
    const grille = mesh(keep(new RoundedBoxGeometry(0.07, 0.03, 0.74, 1, 0.01)), steel);
    grille.position.set(-1.18 + slat * 0.11, 0.86, 0);
  }

  // Fenders over each track, with a stowage box on the right.
  for (const side of [-1, 1]) {
    const fender = mesh(keep(profileSolid(FENDER_SIDE, 0.6, 0.015)), paint);
    fender.position.z = side * TRACK_CENTRE;
    const box = mesh(keep(new RoundedBoxGeometry(0.5, 0.16, 0.3, 2, 0.03)), darkPaint);
    box.position.set(side > 0 ? -0.55 : 0.2, 0.78, side * 0.86);
    // A team stripe along each fender's outer edge: the side's colour, readable from across the table.
    const stripe = mesh(keep(new RoundedBoxGeometry(2.5, 0.03, 0.12, 1, 0.01)), trim);
    stripe.position.set(-0.05, 0.71, side * (TRACK_CENTRE + 0.22));
  }

  // Tracks: belts, road wheels, drive sprocket and idler.
  const tread = treadSurface();
  const treadMaps: Texture[] = [];
  const wheelGroups: Group[][] = [[], []];
  for (const [sideIndex, side] of [-1, 1].entries()) {
    const map = tread.map.clone();
    const normalMap = tread.normalMap.clone();
    const roughnessMap = tread.roughnessMap.clone();
    treadMaps.push(map, normalMap, roughnessMap);
    owned.textures.push(map, normalMap, roughnessMap);
    const beltMaterial = keepMaterial(
      new MeshStandardMaterial({ map, normalMap, roughnessMap, metalness: 0.55, roughness: 1 }),
    );
    const belt = mesh(keep(beltGeometry()), beltMaterial);
    belt.position.z = side * TRACK_CENTRE;

    const wheelGeometry = keep(
      new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, TRACK_WIDTH * 0.8, 18),
    );
    wheelGeometry.rotateX(Math.PI / 2);
    const hubGeometry = keep(new CylinderGeometry(0.08, 0.1, TRACK_WIDTH * 0.86, 10));
    hubGeometry.rotateX(Math.PI / 2);
    const wheelPositions: [number, number, number][] = [
      [1.18, 0.34, 0.26],
      [-1.22, 0.31, 0.26],
      ...[-0.8, -0.4, 0, 0.4, 0.8].map((x): [number, number, number] => [
        x,
        WHEEL_RADIUS + 0.05,
        WHEEL_RADIUS,
      ]),
    ];
    for (const [x, y, radius] of wheelPositions) {
      const wheel = new Group();
      wheel.position.set(x, y, side * TRACK_CENTRE);
      wheel.scale.set(radius / WHEEL_RADIUS, radius / WHEEL_RADIUS, 1);
      mesh(wheelGeometry, rubber, wheel);
      mesh(hubGeometry, steel, wheel);
      // A spoke so the wheel's turning is visible.
      const spoke = mesh(
        keep(new RoundedBoxGeometry(0.28, 0.04, TRACK_WIDTH * 0.88, 1, 0.01)),
        steel,
        wheel,
      );
      spoke.rotation.z = 0.4;
      root.add(wheel);
      wheelGroups[sideIndex]?.push(wheel);
    }
  }

  // Headlights and their pools of light on the ground (night only).
  for (const side of [-1, 1]) {
    const housing = mesh(keep(new CylinderGeometry(0.08, 0.09, 0.12, 12)), steel);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(1.05, 0.86, side * 0.42);
    const lens = mesh(keep(new CylinderGeometry(0.065, 0.065, 0.02, 12)), lamp);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(1.12, 0.86, side * 0.42);
    lens.castShadow = false;
  }
  const poolMaterial = keepMaterial(headlightPoolMaterial());
  const pool = new Mesh(keep(new PlaneGeometry(4.2, 2.6)), poolMaterial);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(3.2, 0.03, 0);
  pool.renderOrder = 7;
  pool.visible = false;
  root.add(pool);

  // A soft contact shadow, so the tank sits on the sand rather than floating over it.
  const contact = new Mesh(
    keep(new PlaneGeometry(3.6, 2.9)),
    keepMaterial(contactShadowMaterial()),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.025;
  contact.renderOrder = 6;
  root.add(contact);

  // Exhausts at the back.
  for (const side of [-1, 1]) {
    const exhaust = mesh(keep(new CylinderGeometry(0.06, 0.07, 0.22, 10)), steel);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-1.42, 0.62, side * 0.34);
  }

  // Turret: tapered body, team band, roof chevron, mantlet, barrel, cupola, antenna.
  const turret = new Group();
  turret.position.set(-0.12, 0.8, 0);
  root.add(turret);
  const turretBody = keep(planSolid(TURRET_PLAN, 0.38, 0.05));
  taperTop(turretBody, 0, 0.38, 0.86);
  mesh(turretBody, paint, turret);
  const band = mesh(keep(planSolid(TURRET_PLAN, 0.08, 0.012)), trim, turret);
  band.scale.set(1.035, 1, 1.035);
  band.position.y = 0.1;
  const chevron = mesh(keep(planSolid(CHEVRON_PLAN, 0.02, 0.004)), trim, turret);
  chevron.position.set(-0.22, 0.37, 0);
  chevron.scale.set(1.9, 1, 1.9);

  const mantlet = mesh(keep(new RoundedBoxGeometry(0.22, 0.22, 0.44, 3, 0.06)), darkPaint, turret);
  mantlet.position.set(0.66, 0.2, 0);
  const barrel = new Group();
  barrel.position.set(0.7, BARREL_HEIGHT - 0.8, 0);
  barrel.rotation.z = 0.03;
  turret.add(barrel);
  const tube = mesh(keep(new CylinderGeometry(0.066, 0.078, BARREL_LENGTH, 14)), darkPaint, barrel);
  tube.rotation.z = -Math.PI / 2;
  tube.position.x = BARREL_LENGTH / 2;
  const extractor = mesh(keep(new CylinderGeometry(0.1, 0.1, 0.26, 14)), darkPaint, barrel);
  extractor.rotation.z = -Math.PI / 2;
  extractor.position.x = BARREL_LENGTH * 0.5;
  const brake = mesh(keep(new CylinderGeometry(0.11, 0.105, 0.17, 14)), steel, barrel);
  brake.rotation.z = -Math.PI / 2;
  brake.position.x = BARREL_LENGTH - 0.06;

  const cupola = mesh(keep(new CylinderGeometry(0.17, 0.19, 0.12, 16)), darkPaint, turret);
  cupola.position.set(-0.28, 0.42, -0.22);
  const hatch = mesh(keep(new CylinderGeometry(0.14, 0.14, 0.03, 16)), paint, turret);
  hatch.position.set(-0.28, 0.5, -0.22);
  const periscope = mesh(keep(new RoundedBoxGeometry(0.1, 0.07, 0.16, 1, 0.015)), steel, turret);
  periscope.position.set(0.2, 0.41, 0.24);

  const antenna = new Group();
  antenna.position.set(-0.56, 0.38, 0.3);
  turret.add(antenna);
  const whip = mesh(keep(new CylinderGeometry(0.008, 0.014, 1.15, 5)), steel, antenna);
  whip.position.y = 0.575;
  whip.castShadow = true;
  const tip = mesh(keep(new SphereGeometry(0.035, 8, 6)), trim, antenna);
  tip.position.y = 1.16;
  const pennant = mesh(keep(new RoundedBoxGeometry(0.2, 0.1, 0.012, 1, 0.004)), trim, antenna);
  pennant.position.set(-0.11, 1.06, 0);

  const recoilSpring = { offset: 0, velocity: 0 };
  const sway: Spring = { angle: 0, velocity: 0 };
  const swaySide: Spring = { angle: 0, velocity: 0 };
  const muzzleLocal = new Vector3(BARREL_LENGTH + 0.05, 0, 0);

  function stepSpring(spring: Spring, dt: number, stiffness: number, damping: number): void {
    spring.velocity += (-spring.angle * stiffness - spring.velocity * damping) * dt;
    spring.angle += spring.velocity * dt;
  }

  return {
    root,
    roll(leftDistance, rightDistance) {
      for (const [sideIndex, distance] of [leftDistance, rightDistance].entries()) {
        for (const map of treadMaps.slice(sideIndex * 3, sideIndex * 3 + 3))
          map.offset.x -= distance / LINK_PITCH;
        for (const wheel of wheelGroups[sideIndex] ?? [])
          wheel.rotation.z -= distance / (WHEEL_RADIUS * wheel.scale.x);
      }
    },
    recoil() {
      recoilSpring.velocity = -5.5;
      sway.velocity -= 6;
    },
    jolt(strength) {
      sway.velocity += strength * 5;
      swaySide.velocity += strength * 3;
    },
    setHeadlights(strength) {
      lamp.emissiveIntensity = 0.4 + strength * 7;
      pool.visible = strength > 0.01;
      poolMaterial.uniforms.strength.value = strength;
    },
    muzzle(target) {
      barrel.updateWorldMatrix(true, false);
      return target.copy(muzzleLocal).applyMatrix4(barrel.matrixWorld);
    },
    update(dt) {
      recoilSpring.velocity += (-recoilSpring.offset * 160 - recoilSpring.velocity * 14) * dt;
      recoilSpring.offset += recoilSpring.velocity * dt;
      barrel.position.x = 0.7 + recoilSpring.offset * 0.35;
      stepSpring(sway, dt, 70, 3.2);
      stepSpring(swaySide, dt, 60, 3.0);
      antenna.rotation.z = sway.angle * 0.25;
      antenna.rotation.x = swaySide.angle * 0.25;
    },
    dispose() {
      for (const geometry of owned.geometries) geometry.dispose();
      for (const material of owned.materials) material.dispose();
      for (const texture of owned.textures) texture.dispose();
      root.removeFromParent();
    },
  };
}

function contactShadowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float d = length(vUv * vec2(1.0, 1.05));
        gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.35, 1.0, d)) * 0.55);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/** Two soft cones of light on the ground ahead of the tank, added on top of the board. */
function headlightPoolMaterial(): ShaderMaterial & { uniforms: { strength: IUniform<number> } } {
  const material = new ShaderMaterial({
    uniforms: { strength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float strength;
      varying vec2 vUv;
      float cone(vec2 uv, float centre) {
        float ahead = uv.x;
        float across = (uv.y - centre) / (0.06 + ahead * 0.22);
        return exp(-across * across * 5.0) * smoothstep(0.0, 0.12, ahead) * (1.0 - smoothstep(0.55, 1.0, ahead));
      }
      void main() {
        float light = cone(vUv, 0.38) + cone(vUv, 0.62);
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.4) * light * strength * 0.16, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return material as ShaderMaterial & { uniforms: { strength: IUniform<number> } };
}
