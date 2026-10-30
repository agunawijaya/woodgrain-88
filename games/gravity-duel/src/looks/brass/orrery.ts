/**
 * The Brass Orrery's world: a dark walnut desk, and set into it a board of
 * deep blue enamel ringed by a brass rail (or, where ships wrap round, a line
 * of brass studs). In the middle the star is a filament bulb in a brass
 * socket, and round it the orrery's rings turn slowly on their arms, each with
 * its bead of a planet: the pull everything feels, shown the way a
 * clockmaker would.
 */
import type { Rng } from '@woodgrain-88/kit';
import {
  CircleGeometry,
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TorusKnotGeometry,
  type BufferGeometry,
  type Camera,
  type Material,
} from 'three';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/field.ts';

/** The bulb's radius in units: what a ship must not touch. */
export const BULB_RADIUS = 1.05;
const BULB_HEIGHT = 0.75;

export interface Orrery {
  readonly root: Group;
  update(dt: number, clock: number, camera: Camera): void;
  dispose(): void;
}

/** Walnut: dark wood with long wavering grain, drawn once on a canvas. */
function walnutTexture(rng: Rng): CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the desk');
  context.fillStyle = '#3a2416';
  context.fillRect(0, 0, width, height);
  for (let line = 0; line < 260; line++) {
    const y = rng.float(0, height);
    const tone = rng.float(0, 1);
    context.strokeStyle =
      tone > 0.6
        ? 'rgba(90, 58, 34, 0.5)'
        : tone > 0.25
          ? 'rgba(28, 16, 9, 0.45)'
          : 'rgba(120, 78, 44, 0.3)';
    context.lineWidth = rng.float(0.6, 3.5);
    context.beginPath();
    const phase = rng.float(0, Math.PI * 2);
    const sway = rng.float(2, 9);
    for (let x = 0; x <= width; x += 16) {
      const wave =
        Math.sin(x * 0.006 + phase) * sway + Math.sin(x * 0.021 + phase * 2) * sway * 0.3;
      if (x === 0) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
}

/** The enamel board, with faint engraved circles of the orrery's scale round the middle. */
function enamelTexture(): CanvasTexture {
  const width = 1600;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the board');
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    40,
    width / 2,
    height / 2,
    width * 0.6,
  );
  gradient.addColorStop(0, '#24345a');
  gradient.addColorStop(1, '#121a2e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const unit = width / (HALF_WIDTH * 2);
  context.strokeStyle = 'rgba(214, 170, 92, 0.32)';
  for (const radius of [2.4, 4.2, 6.4, 8.6, 11]) {
    context.lineWidth = radius === 11 ? 1.5 : 2;
    context.beginPath();
    context.arc(width / 2, height / 2, radius * unit, 0, Math.PI * 2);
    context.stroke();
  }
  // Hour marks round the outer ring, as on a clock face.
  for (let mark = 0; mark < 24; mark++) {
    const angle = (mark / 24) * Math.PI * 2;
    const inner = (mark % 2 === 0 ? 10.4 : 10.7) * unit;
    const outer = 11 * unit;
    context.lineWidth = mark % 2 === 0 ? 3 : 1.5;
    context.beginPath();
    context.moveTo(width / 2 + Math.cos(angle) * inner, height / 2 + Math.sin(angle) * inner);
    context.lineTo(width / 2 + Math.cos(angle) * outer, height / 2 + Math.sin(angle) * outer);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createOrrery(options: {
  readonly night: boolean;
  readonly rng: Rng;
  readonly bulb: boolean;
  readonly rings: boolean;
  readonly solidEdges: boolean;
}): Orrery {
  const { night, rng } = options;
  const root = new Group();
  root.name = 'orrery';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };

  const walnut = walnutTexture(rng.fork('walnut'));
  const desk = new Mesh(
    keep(new PlaneGeometry(70, 44).rotateX(-Math.PI / 2)),
    own(
      new MeshPhysicalMaterial({
        map: walnut,
        roughness: 0.5,
        clearcoat: 0.6,
        clearcoatRoughness: 0.35,
      }),
    ),
  );
  desk.position.y = -0.06;
  desk.receiveShadow = true;
  root.add(desk);

  const enamel = enamelTexture();
  const board = new Mesh(
    keep(new BoxGeometry(HALF_WIDTH * 2, 0.06, HALF_DEPTH * 2)),
    // Satin by night: a glossy board would throw the desk lamp straight back at the camera.
    own(
      new MeshPhysicalMaterial({
        map: enamel,
        roughness: night ? 0.55 : 0.25,
        clearcoat: night ? 0.35 : 1,
        clearcoatRoughness: night ? 0.45 : 0.08,
      }),
    ),
  );
  board.position.y = -0.03;
  board.receiveShadow = true;
  root.add(board);

  const brass = own(
    new MeshStandardMaterial({ color: '#c99a45', metalness: 1, roughness: night ? 0.32 : 0.26 }),
  );
  const darkBrass = own(
    new MeshStandardMaterial({ color: '#7a5a28', metalness: 1, roughness: 0.4 }),
  );

  // The rail round the board where ships bounce; a row of studs where they wrap round.
  if (options.solidEdges) {
    const rail = keep(new CylinderGeometry(0.09, 0.09, 1, 10).rotateZ(Math.PI / 2));
    for (const [x, z, length, turned] of [
      [0, -HALF_DEPTH, HALF_WIDTH * 2, false],
      [0, HALF_DEPTH, HALF_WIDTH * 2, false],
      [-HALF_WIDTH, 0, HALF_DEPTH * 2, true],
      [HALF_WIDTH, 0, HALF_DEPTH * 2, true],
    ] as const) {
      const bar = new Mesh(rail, brass);
      bar.scale.set(length + 0.18, 1, 1);
      bar.position.set(x, 0.09, z);
      if (turned) bar.rotation.y = Math.PI / 2;
      bar.castShadow = true;
      root.add(bar);
    }
  } else {
    const stud = keep(new SphereGeometry(0.07, 10, 8));
    for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 1) {
      for (const z of [-HALF_DEPTH, HALF_DEPTH]) {
        const bead = new Mesh(stud, brass);
        bead.position.set(x, 0.04, z);
        root.add(bead);
      }
    }
  }

  const spinning: { group: Group; rate: number }[] = [];
  if (options.rings) {
    // The orrery's rings on their arms, each carrying a bead of a planet round the bulb.
    for (const [radius, rate, bead] of [
      [2.4, 0.35, 0.14],
      [4.2, -0.22, 0.18],
      [6.4, 0.14, 0.12],
    ] as const) {
      const group = new Group();
      const ring = new Mesh(
        keep(new TorusGeometry(radius, 0.035, 8, 120).rotateX(Math.PI / 2)),
        brass,
      );
      ring.position.y = 0.12;
      group.add(ring);
      const arm = new Mesh(keep(new BoxGeometry(radius, 0.03, 0.05)), darkBrass);
      arm.position.set(radius / 2, 0.1, 0);
      group.add(arm);
      const planet = new Mesh(
        keep(new SphereGeometry(bead, 16, 12)),
        own(
          new MeshStandardMaterial({
            color: rng.float(0, 1) > 0.5 ? '#6b8fb8' : '#b8705a',
            metalness: 0.3,
            roughness: 0.4,
          }),
        ),
      );
      planet.position.set(radius, 0.12 + bead, 0);
      planet.castShadow = true;
      group.add(planet);
      group.rotation.y = rng.float(0, Math.PI * 2);
      root.add(group);
      spinning.push({ group, rate });
    }
  }

  const glowMap = glowTexture();
  const glowPoint = new PointLight('#ffb35a', night ? 40 : 10, 22, 1.6);
  glowPoint.position.y = BULB_HEIGHT + 0.6;
  let halo: Mesh | null = null;
  let filamentMaterial: MeshBasicMaterial | null = null;
  if (options.bulb) {
    const socket = new Mesh(keep(new CylinderGeometry(0.5, 0.6, 0.5, 24)), brass);
    socket.position.y = 0.2;
    socket.castShadow = true;
    root.add(socket);
    for (let thread = 0; thread < 3; thread++) {
      const ridge = new Mesh(
        keep(new TorusGeometry(0.52, 0.04, 8, 32).rotateX(Math.PI / 2)),
        darkBrass,
      );
      ridge.position.y = 0.12 + thread * 0.13;
      root.add(ridge);
    }
    const glass = new Mesh(
      keep(new SphereGeometry(BULB_RADIUS, 40, 28)),
      own(
        new MeshPhysicalMaterial({
          color: '#fff4dc',
          roughness: 0.04,
          metalness: 0,
          clearcoat: 1,
          transparent: true,
          opacity: night ? 0.18 : 0.28,
          depthWrite: false,
        }),
      ),
    );
    glass.position.y = BULB_HEIGHT;
    root.add(glass);
    filamentMaterial = own(
      new MeshBasicMaterial({ color: new Color('#ffb35a').multiplyScalar(night ? 6 : 2.4) }),
    );
    const filament = new Mesh(
      keep(new TorusKnotGeometry(0.32, 0.045, 120, 8, 2, 7)),
      filamentMaterial,
    );
    filament.position.y = BULB_HEIGHT;
    root.add(filament);
    const haloMaterial = own(
      new MeshBasicMaterial({
        map: glowMap,
        color: new Color('#ffbe73').multiplyScalar(night ? 1.6 : 0.6),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    halo = new Mesh(keep(new PlaneGeometry(1, 1)), haloMaterial);
    halo.position.y = BULB_HEIGHT;
    halo.scale.setScalar(BULB_RADIUS * (night ? 2.7 : 2));
    root.add(halo);
    // From overhead a glass ball reads by its outline and a window's glint, not by its glow.
    const rim = new Mesh(
      keep(new TorusGeometry(BULB_RADIUS, 0.035, 8, 64).rotateX(Math.PI / 2)),
      own(
        new MeshBasicMaterial({
          color: night ? '#ffe2a8' : '#8a6a32',
          transparent: true,
          opacity: 0.8,
        }),
      ),
    );
    rim.position.y = BULB_HEIGHT;
    root.add(rim);
    const glint = new Mesh(
      keep(new CircleGeometry(0.16, 20).rotateX(-Math.PI / 2)),
      own(
        new MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: night ? 0.55 : 0.85,
        }),
      ),
    );
    glint.position.set(-BULB_RADIUS * 0.42, BULB_HEIGHT + BULB_RADIUS * 0.9, -BULB_RADIUS * 0.38);
    glint.scale.set(1.4, 1, 0.8);
    root.add(glint);
    root.add(glowPoint);
  }

  return {
    root,
    update(dt, clock, camera) {
      for (const { group, rate } of spinning) group.rotation.y += rate * dt;
      if (halo) halo.quaternion.copy(camera.quaternion);
      // A filament flickers a little, as old bulbs do.
      if (filamentMaterial) {
        const flicker = 1 + Math.sin(clock * 23) * 0.03 + Math.sin(clock * 7.3) * 0.04;
        filamentMaterial.color.set('#ffb35a').multiplyScalar((night ? 6 : 2.4) * flicker);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      walnut.dispose();
      enamel.dispose();
      glowMap.dispose();
    },
  };
}

function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the glow');
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
