/**
 * The Radar Room's console: an enamelled steel desk with the display set in
 * a heavy bezel under glass, and an instrument cluster either side of it.
 * Each seat has its own: a lamp in the seat's colour, a dial, knobs and
 * toggle switches, with engraved label plates in our own words. By day the
 * enamel is a pale grey-green in sunlight; by night it is gunmetal, lit by
 * the screen's glow and its own small lamps.
 */
import {
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DISPLAY_FONT } from '../../look/glyphs.ts';
import type { SeatColours } from '../../look/look.ts';
import { SCREEN_DEPTH, SCREEN_WIDTH } from './scope-face.ts';

const BEZEL = 1.8;
const BEZEL_HEIGHT = 0.7;

export interface RadarConsole {
  readonly root: Group;
  update(time: number): void;
  dispose(): void;
}

type Own = <T extends Material>(material: T) => T;
type Keep = <T extends BufferGeometry>(geometry: T) => T;

export function createConsole(
  night: boolean,
  seats: readonly [SeatColours, SeatColours],
): RadarConsole {
  const root = new Group();
  root.name = 'radar-console';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: CanvasTexture[] = [];
  const keep: Keep = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };
  const own: Own = (material) => {
    materials.push(material);
    return material;
  };

  const enamel = own(
    new MeshStandardMaterial({
      color: night ? '#262e31' : '#aeb9a8',
      roughness: 0.55,
      metalness: 0.15,
    }),
  );
  const bezelPaint = own(
    new MeshStandardMaterial({
      color: night ? '#15191b' : '#8d998a',
      roughness: 0.45,
      metalness: 0.25,
    }),
  );
  const chrome = own(new MeshStandardMaterial({ color: '#d9dde2', roughness: 0.18, metalness: 1 }));
  const bakelite = own(new MeshStandardMaterial({ color: '#17191b', roughness: 0.35 }));

  const desk = new Mesh(keep(new RoundedBoxGeometry(84, 2, 52, 4, 0.6)), enamel);
  desk.position.y = -1;
  desk.receiveShadow = true;
  root.add(desk);

  // The bezel: four heavy rails round the display, with a screw at each corner.
  const halfWidth = SCREEN_WIDTH / 2;
  const halfDepth = SCREEN_DEPTH / 2;
  const rails: [number, number, number, number][] = [
    [0, -halfDepth - BEZEL / 2, SCREEN_WIDTH + BEZEL * 2, BEZEL],
    [0, halfDepth + BEZEL / 2, SCREEN_WIDTH + BEZEL * 2, BEZEL],
    [-halfWidth - BEZEL / 2, 0, BEZEL, SCREEN_DEPTH],
    [halfWidth + BEZEL / 2, 0, BEZEL, SCREEN_DEPTH],
  ];
  for (const [x, z, width, depth] of rails) {
    const rail = new Mesh(
      keep(new RoundedBoxGeometry(width, BEZEL_HEIGHT, depth, 3, 0.25)),
      bezelPaint,
    );
    rail.position.set(x, BEZEL_HEIGHT / 2, z);
    rail.castShadow = true;
    rail.receiveShadow = true;
    root.add(rail);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const screw = new Mesh(keep(new CylinderGeometry(0.28, 0.28, 0.12, 16)), chrome);
      screw.position.set(
        sx * (halfWidth + BEZEL / 2),
        BEZEL_HEIGHT + 0.04,
        sz * (halfDepth + BEZEL / 2),
      );
      const slot = new Mesh(keep(new PlaneGeometry(0.42, 0.06).rotateX(-Math.PI / 2)), bakelite);
      slot.position.copy(screw.position).setY(screw.position.y + 0.07);
      slot.rotation.y = 0.6 + sx * 0.3;
      root.add(screw, slot);
    }
  }

  // Glass over the display: almost invisible, but it catches the room's light.
  const glass = new Mesh(
    keep(new PlaneGeometry(SCREEN_WIDTH, SCREEN_DEPTH).rotateX(-Math.PI / 2)),
    own(
      new MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: night ? 0.04 : 0.035,
        roughness: 0.06,
        depthWrite: false,
      }),
    ),
  );
  glass.position.y = BEZEL_HEIGHT * 0.6;
  root.add(glass);

  const lamps: { mesh: Mesh; material: MeshStandardMaterial; phase: number; steady: boolean }[] =
    [];
  ([0, 1] as const).forEach((seat) => {
    const side = seat === 0 ? -1 : 1;
    const cluster = new Group();
    cluster.position.set(side * (halfWidth + BEZEL + 4.6), 0, 0);
    root.add(cluster);

    cluster.add(
      plate(seat === 0 ? 'SEAT 1' : 'SEAT 2', 5.2, 1.3, night, own, keep, textures, -13.2),
    );
    const seatLamp = lamp(seats[seat].main, true, own, keep, chrome);
    seatLamp.group.position.set(0, 0, -11);
    cluster.add(seatLamp.group);
    lamps.push({
      mesh: seatLamp.mesh,
      material: seatLamp.material,
      phase: seat * 1.3,
      steady: true,
    });

    const gauge = dial(
      seat === 0 ? 'RANGE' : 'BEARING',
      night,
      own,
      keep,
      textures,
      chrome,
      bakelite,
    );
    gauge.position.set(0, 0, -5.4);
    cluster.add(gauge);

    for (const [index, label] of (seat === 0 ? ['GAIN', 'SWEEP'] : ['TRACK', 'TUNE']).entries()) {
      const knobGroup = knob(bakelite, chrome, own, keep);
      knobGroup.position.set(-1.6 + index * 3.2, 0, 1.6);
      knobGroup.rotation.y = 0.7 - index * 1.4 + side * 0.3;
      cluster.add(knobGroup);
      cluster.add(plate(label, 2.6, 0.8, night, own, keep, textures, 3.9, -1.6 + index * 3.2));
    }

    for (let index = 0; index < 3; index++) {
      const toggle = toggleSwitch(chrome, bakelite, keep, (index + seat) % 2 === 0);
      toggle.position.set(-2.2 + index * 2.2, 0, 7.4);
      cluster.add(toggle);
    }
    for (let index = 0; index < 4; index++) {
      const colour = index % 2 === 0 ? '#5dff9a' : '#ffb23e';
      const light = lamp(colour, (index + seat) % 3 !== 0, own, keep, chrome, 0.32);
      light.group.position.set(-2.4 + index * 1.6, 0, 10.6);
      cluster.add(light.group);
      lamps.push({
        mesh: light.mesh,
        material: light.material,
        phase: index * 0.9 + seat,
        steady: false,
      });
    }
  });

  // By night the display's own glow lights the desk in front of it.
  const screenGlow = night ? new PointLight('#3dff88', 18, 46, 1.4) : null;
  if (screenGlow) {
    screenGlow.position.set(0, 9, 4);
    root.add(screenGlow);
  }

  return {
    root,
    update(time) {
      for (const entry of lamps) {
        if (entry.steady || entry.material.emissiveIntensity === 0) continue;
        const blink = Math.sin(time * 2.2 + entry.phase * 3.1) > 0.6 ? 0.35 : 1;
        entry.material.emissiveIntensity = (night ? 3 : 1.2) * blink;
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };

  function lamp(
    colour: string,
    lit: boolean,
    ownMaterial: Own,
    keepGeometry: Keep,
    rim: Material,
    radius = 0.55,
  ): { group: Group; mesh: Mesh; material: MeshStandardMaterial } {
    const group = new Group();
    const ring = new Mesh(keepGeometry(new TorusGeometry(radius, radius * 0.22, 8, 24)), rim);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    const material = ownMaterial(
      new MeshStandardMaterial({
        color: lit ? colour : '#3a3d40',
        emissive: new Color(colour),
        emissiveIntensity: lit ? (night ? 3 : 1.2) : 0,
        roughness: 0.25,
      }),
    );
    const dome = new Mesh(
      keepGeometry(new SphereGeometry(radius, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
      material,
    );
    dome.scale.y = 0.6;
    dome.position.y = 0.05;
    group.add(ring, dome);
    return { group, mesh: dome, material };
  }
}

/** An engraved label plate: light letters cut into a dark plate. */
function plate(
  text: string,
  width: number,
  depth: number,
  night: boolean,
  own: Own,
  keep: Keep,
  textures: CanvasTexture[],
  z: number,
  x = 0,
): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * 64);
  canvas.height = Math.round(depth * 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textures.push(texture);
  const draw = () => {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = night ? '#0d1012' : '#2e3631';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = night ? '#4a5257' : '#6f7b72';
    context.lineWidth = 4;
    context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    context.fillStyle = night ? '#a9b9b0' : '#e6ece2';
    context.font = `700 ${canvas.height * 0.62}px ${DISPLAY_FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      text.split('').join(String.fromCharCode(8202)),
      canvas.width / 2,
      canvas.height / 2 + 2,
    );
    texture.needsUpdate = true;
  };
  draw();
  void document.fonts.load(`700 32px ${DISPLAY_FONT}`).then(draw, () => undefined);
  const mesh = new Mesh(
    keep(new RoundedBoxGeometry(width, 0.12, depth, 2, 0.05)),
    own(new MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.3 })),
  );
  mesh.position.set(x, 0.06, z);
  mesh.receiveShadow = true;
  return mesh;
}

/** A round dial under a glass dome: ticks 0 to 8 and a needle. */
function dial(
  label: string,
  night: boolean,
  own: Own,
  keep: Keep,
  textures: CanvasTexture[],
  chrome: Material,
  bakelite: Material,
): Group {
  const group = new Group();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textures.push(texture);
  const draw = () => {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = night ? '#0f1712' : '#eef1e6';
    context.fillRect(0, 0, 256, 256);
    context.translate(128, 128);
    context.strokeStyle = night ? '#4be38a' : '#26332b';
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 4;
    for (let tick = 0; tick <= 16; tick++) {
      const angle = Math.PI * 0.75 + (tick / 16) * Math.PI * 1.5;
      const inner = tick % 2 === 0 ? 86 : 96;
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      context.lineTo(Math.cos(angle) * 108, Math.sin(angle) * 108);
      context.stroke();
      if (tick % 2 === 0) {
        context.font = `700 26px ${DISPLAY_FONT}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(tick / 2), Math.cos(angle) * 66, Math.sin(angle) * 66);
      }
    }
    context.font = `700 22px ${DISPLAY_FONT}`;
    context.fillText(label, 0, 46);
    context.setTransform(1, 0, 0, 1, 0, 0);
    texture.needsUpdate = true;
  };
  draw();
  void document.fonts.load(`700 32px ${DISPLAY_FONT}`).then(draw, () => undefined);
  const face = new Mesh(
    keep(new CircleGeometry(2.4, 40).rotateX(-Math.PI / 2)),
    own(
      new MeshStandardMaterial({
        map: texture,
        roughness: 0.6,
        emissive: new Color(night ? '#2dff7a' : '#000000'),
        emissiveMap: texture,
        emissiveIntensity: night ? 0.35 : 0,
      }),
    ),
  );
  face.position.y = 0.08;
  const ring = new Mesh(keep(new TorusGeometry(2.5, 0.22, 10, 40)), chrome);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  const needle = new Mesh(keep(new RoundedBoxGeometry(0.12, 0.06, 2.0, 1, 0.03)), bakelite);
  needle.position.set(0, 0.2, -0.75);
  const pivot = new Group();
  pivot.add(needle);
  pivot.rotation.y = -0.6;
  const cap = new Mesh(keep(new CylinderGeometry(0.22, 0.22, 0.12, 14)), chrome);
  cap.position.y = 0.22;
  const dome = new Mesh(
    keep(new SphereGeometry(2.45, 28, 10, 0, Math.PI * 2, 0, Math.PI / 5)),
    own(
      new MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.12,
        roughness: 0.04,
        clearcoat: 1,
        depthWrite: false,
      }),
    ),
  );
  dome.position.y = -1.85;
  group.add(face, ring, pivot, cap, dome);
  return group;
}

/** A ridged bakelite knob with a white pointer line. */
function knob(bakelite: Material, chrome: Material, own: Own, keep: Keep): Group {
  const group = new Group();
  const skirt = new Mesh(keep(new CylinderGeometry(0.95, 1.0, 0.18, 32)), chrome);
  skirt.position.y = 0.09;
  const body = new Mesh(
    keep(
      new LatheGeometry(
        [
          new Vector2(0, 0.16),
          new Vector2(0.78, 0.16),
          new Vector2(0.72, 0.62),
          new Vector2(0.6, 0.78),
          new Vector2(0, 0.8),
        ],
        28,
      ),
    ),
    bakelite,
  );
  body.castShadow = true;
  const pointer = new Mesh(
    keep(new RoundedBoxGeometry(0.1, 0.04, 0.6, 1, 0.02)),
    own(new MeshStandardMaterial({ color: '#f2f2ea', roughness: 0.4 })),
  );
  pointer.position.set(0, 0.81, -0.3);
  group.add(skirt, body, pointer);
  return group;
}

/** A toggle switch on a chrome plate, thrown up or down. */
function toggleSwitch(chrome: Material, bakelite: Material, keep: Keep, up: boolean): Group {
  const group = new Group();
  const plateMesh = new Mesh(keep(new RoundedBoxGeometry(1.1, 0.1, 1.6, 2, 0.05)), chrome);
  plateMesh.position.y = 0.05;
  const nut = new Mesh(keep(new CylinderGeometry(0.28, 0.28, 0.2, 6)), chrome);
  nut.position.y = 0.2;
  const lever = new Mesh(keep(new CylinderGeometry(0.07, 0.1, 1.0, 10)), chrome);
  lever.position.set(0, 0.55, up ? -0.25 : 0.25);
  lever.rotation.x = up ? -0.55 : 0.55;
  lever.castShadow = true;
  const tip = new Mesh(keep(new SphereGeometry(0.14, 12, 8)), bakelite);
  tip.position.set(0, 1.0, up ? -0.5 : 0.5);
  group.add(plateMesh, nut, lever, tip);
  return group;
}
