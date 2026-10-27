/**
 * The Radar Room's field view. Explorers are blips (a diamond for seat 1, a
 * triangle for seat 2) that leave a fading track history behind them. A
 * checked square shows its clue in vector strokes: a seven-segment range
 * with a square range ring pulsing out to exactly that distance, a bearing
 * arrow, a burst of static for a bomb (and the blip snapping home), and for
 * the flag a closing target lock with pings rolling across the scope. By
 * night everything glows and brightens as the sweep passes over it.
 */
import { createEffects, type Effects } from '@woodgrain-88/arena';
import {
  CanvasTexture,
  Color,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Plane,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Clue } from '../../engine/board.ts';
import { bearingDegrees, type Bearing, type Square } from '../../engine/grid.ts';
import { SQUARE_SIZE, squareCentre } from '../../look/field-space.ts';
import { DISPLAY_FONT } from '../../look/glyphs.ts';
import { heatColour, heatInk } from '../../look/heat.ts';
import type { FieldView, Seat, ViewOptions } from '../../look/look.ts';
import { createConsole } from './console.ts';
import { afterglow, createScopeFace, SCREEN_DEPTH, SCREEN_WIDTH } from './scope-face.ts';
import { sevenSegment, strokeGeometry, strokesGeometry, type Point } from './strokes.ts';

const LAYER = 0.06;
/** Blips sit at the top left of their square, so the clue in the middle stays clear. */
const STANCE = new Vector3(-1.15, 0, -1.15);
const TRACK_DOTS = 7;

interface Glowing {
  readonly material: MeshBasicMaterial;
  readonly base: Color;
  readonly angle: number;
}

interface Pulse {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  readonly from: number;
  readonly to: number;
  readonly seconds: number;
  readonly hold: number;
  age: number;
}

interface Blip {
  readonly group: Group;
  readonly material: MeshBasicMaterial;
  readonly position: Vector3;
  from: Vector3;
  to: Vector3;
  glide: number;
  gliding: number;
  readonly track: { mesh: Mesh; material: MeshBasicMaterial; age: number }[];
  nextDot: number;
  square: Square;
  /** A blocked step flashes the blip big for a moment; 0 at rest. */
  flash: number;
}

export function createRadarView(options: ViewOptions): FieldView {
  const night = options.appearance === 'dark';
  const { stage } = options;
  const root = new Group();
  root.name = 'radar-view';
  const rng = options.rng.fork('radar');
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: CanvasTexture[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const console_ = createConsole(night, options.seats);
  root.add(console_.root);
  const face = createScopeFace(night);
  face.mesh.position.y = 0.02;
  root.add(face.mesh);
  const effects: Effects = createEffects({
    parent: root,
    lights: stage.lights,
    rng: rng.fork('effects'),
    intensity: options.reducedEffects ? 'reduced' : 'full',
  });

  // Symbols never spill past the display's edge.
  const screenEdges = [
    new Plane(new Vector3(1, 0, 0), SCREEN_WIDTH / 2),
    new Plane(new Vector3(-1, 0, 0), SCREEN_WIDTH / 2),
    new Plane(new Vector3(0, 0, 1), SCREEN_DEPTH / 2),
    new Plane(new Vector3(0, 0, -1), SCREEN_DEPTH / 2),
  ];
  stage.renderer.localClippingEnabled = true;

  const glowing: Glowing[] = [];
  const ink = (colour: string, angle: number, strength = 1): MeshBasicMaterial => {
    const base = new Color(colour).multiplyScalar(night ? 2.2 * strength : 1);
    const material = new MeshBasicMaterial({
      color: base.clone(),
      transparent: true,
      depthWrite: false,
      clippingPlanes: screenEdges,
    });
    materials.push(material);
    glowing.push({ material, base, angle });
    return material;
  };
  const angleOf = (point: Vector3) => Math.atan2(point.z, point.x);
  const lineColour = night ? '#3dff8c' : '#1b3324';
  const seatColour = (seat: Seat) => (night ? options.seats[seat].main : options.seats[seat].deep);

  const symbols = new Map<Square, Group>();
  const pulses: Pulse[] = [];
  let clock = 0;
  const timeline: { at: number; run: () => void }[] = [];
  const at = (delay: number, run: () => void) => timeline.push({ at: clock + delay, run });
  let lock: { group: Group; brackets: Mesh; age: number } | null = null;

  const blips = ([0, 1] as const).map((seat): Blip => {
    const group = new Group();
    const colour = seatColour(seat);
    const material = ink(colour, 0, 1.3);
    const outline = seat === 0 ? diamond(0.95) : triangle(1.05);
    const mark = new Mesh(keep(strokeGeometry(outline, 0.24, true)), material);
    const dot = new Mesh(keep(new CircleGeometry(0.28, 16).rotateX(-Math.PI / 2)), material);
    group.add(mark, dot);
    group.position.y = LAYER + 0.02;
    group.visible = seat < options.players;
    root.add(group);
    const track = Array.from({ length: TRACK_DOTS }, () => {
      const dotMaterial = ink(colour, 0, 0.8);
      dotMaterial.opacity = 0;
      const trail = new Mesh(keep(new CircleGeometry(0.16, 10).rotateX(-Math.PI / 2)), dotMaterial);
      trail.position.y = LAYER;
      trail.visible = seat < options.players;
      root.add(trail);
      return { mesh: trail, material: dotMaterial, age: 99 };
    });
    return {
      group,
      material,
      position: new Vector3(),
      from: new Vector3(),
      to: new Vector3(),
      glide: 0,
      gliding: 0,
      track,
      nextDot: 0,
      square: seat === 0 ? 0 : 62,
      flash: 0,
    };
  }) as [Blip, Blip];

  const standPoint = (square: Square) => squareCentre(square, LAYER).add(STANCE);

  function dropTrackDot(blip: Blip): void {
    const dot = blip.track[blip.nextDot % TRACK_DOTS];
    blip.nextDot++;
    if (!dot) return;
    dot.mesh.position.set(blip.position.x, LAYER, blip.position.z);
    dot.age = 0;
  }

  function addSymbol(square: Square, group: Group): void {
    removeSymbol(square);
    group.position.copy(squareCentre(square, LAYER));
    root.add(group);
    symbols.set(square, group);
  }

  function removeSymbol(square: Square): void {
    symbols.get(square)?.removeFromParent();
    symbols.delete(square);
  }

  function rangeSymbol(square: Square, distance: number): Group {
    const group = new Group();
    const angle = angleOf(squareCentre(square));
    const colour = night
      ? heatColour(distance, options.cluePalette)
      : heatInk(distance, options.cluePalette);
    group.add(new Mesh(keep(sevenSegment(distance, 2.2, 0.32)), ink(colour, angle, 1.1)));
    // A square ring pulses out to exactly the distance: every square it crosses could hold the flag.
    const reach = (distance + 0.5) * SQUARE_SIZE;
    const material = ink(colour, angle, 0.8);
    const mesh = new Mesh(
      keep(strokeGeometry(squareRing(1), (night ? 0.12 : 0.09) / reach, true)),
      material,
    );
    mesh.position.copy(squareCentre(square, LAYER - 0.01));
    root.add(mesh);
    pulses.push({
      mesh,
      material,
      from: SQUARE_SIZE / 2,
      to: reach,
      seconds: 0.5,
      hold: 0.5,
      age: 0,
    });
    return group;
  }

  function bearingSymbol(square: Square, bearing: Bearing): Group {
    const group = new Group();
    const angle = angleOf(squareCentre(square));
    const arrow = strokesGeometry(
      [
        {
          points: [
            [0, 1.2],
            [0, -1.1],
          ],
        },
        {
          points: [
            [-0.75, -0.3],
            [0, -1.25],
            [0.75, -0.3],
          ],
        },
      ],
      0.26,
    );
    const mesh = new Mesh(keep(arrow), ink(lineColour, angle, night ? 0.75 : 1));
    mesh.rotation.y = -(bearingDegrees(bearing) * Math.PI) / 180;
    // A small bearing ring marks it as a reading, not a blip.
    const ring = new Mesh(
      keep(strokeGeometry(circle(1.55, 28), 0.06, true)),
      ink(lineColour, angle, night ? 0.22 : 0.6),
    );
    group.add(mesh, ring);
    return group;
  }

  function staticSymbol(square: Square): Group {
    const group = new Group();
    const angle = angleOf(squareCentre(square));
    const burst: Point[] = [];
    for (let point = 0; point < 16; point++) {
      const turn = (point / 16) * Math.PI * 2;
      const reach = point % 2 === 0 ? 1.55 : 0.7 + rng.float(-0.1, 0.15);
      burst.push([Math.cos(turn) * reach, Math.sin(turn) * reach]);
    }
    const colour = night ? '#ff5a4a' : '#a3241a';
    group.add(new Mesh(keep(strokeGeometry(burst, 0.2, true)), ink(colour, angle, 1.3)));
    const cross = strokesGeometry(
      [
        {
          points: [
            [-0.5, -0.5],
            [0.5, 0.5],
          ],
        },
        {
          points: [
            [-0.5, 0.5],
            [0.5, -0.5],
          ],
        },
      ],
      0.22,
    );
    group.add(new Mesh(keep(cross), ink(colour, angle, 1.3)));
    return group;
  }

  /** A burst of static over a square: a flickering patch of noise that dies away. */
  function staticBurst(square: Square): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      for (let y = 0; y < 64; y += 2) {
        for (let x = 0; x < 64; x += 2) {
          const value = Math.round(rng.next() * 255);
          context.fillStyle = `rgb(${value}, ${value}, ${value})`;
          context.fillRect(x, y, 2, 2);
        }
      }
    }
    const texture = new CanvasTexture(canvas);
    textures.push(texture);
    const material = ink(night ? '#9bffc2' : '#3c5c48', 0, 1);
    material.map = texture;
    material.opacity = 0.9;
    const patch = new Mesh(
      keep(new PlaneGeometry(SQUARE_SIZE * 1.6, SQUARE_SIZE * 1.6).rotateX(-Math.PI / 2)),
      material,
    );
    patch.position.copy(squareCentre(square, LAYER + 0.03));
    root.add(patch);
    pulses.push({ mesh: patch, material, from: 1, to: 1, seconds: 0.01, hold: 0.45, age: 0 });
  }

  /** Brackets round the flag's square; `triumph` adds the pings and the flash of a capture. */
  function lockOn(square: Square, label: string, triumph: boolean): void {
    const centre = squareCentre(square, LAYER + 0.02);
    const group = new Group();
    group.position.copy(centre);
    group.scale.setScalar(1.3);
    const angle = angleOf(centre);
    const colour = night ? '#ff5468' : '#b0182f';
    const corners: { points: Point[] }[] = [];
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      corners.push({
        points: [
          [sx * 1.7, sz * 0.9],
          [sx * 1.7, sz * 1.7],
          [sx * 0.9, sz * 1.7],
        ],
      });
    }
    const brackets = new Mesh(keep(strokesGeometry(corners, 0.26)), ink(colour, angle, 1.4));
    const target = new Mesh(
      keep(strokeGeometry(circle(0.95, 24), 0.2, true)),
      ink(colour, angle, 1.4),
    );
    const pip = new Mesh(
      keep(new CircleGeometry(0.34, 16).rotateX(-Math.PI / 2)),
      ink(colour, angle, 1.6),
    );
    group.add(brackets, target, pip, lockLabel(label));
    root.add(group);
    lock = { group, brackets, age: 0 };
    if (!triumph) return;
    const pingColour = new Color(colour).multiplyScalar(night ? 1.6 : 1);
    for (const delay of [0, 0.35, 0.7]) at(delay, () => face.ping(centre.x, centre.z, pingColour));
    stage.lights.flash(centre.clone().setY(4), night ? '#ff8a96' : '#ffffff', night ? 30 : 10, 0.6);
  }

  function lockLabel(text: string): Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    textures.push(texture);
    const draw = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, 256, 64);
      context.fillStyle = '#ffffff';
      context.font = `800 48px ${DISPLAY_FONT}`;
      context.textBaseline = 'middle';
      context.fillText(text, 4, 34);
      texture.needsUpdate = true;
    };
    draw();
    void document.fonts.load(`800 48px ${DISPLAY_FONT}`).then(draw, () => undefined);
    const material = ink(night ? '#ff5468' : '#b0182f', 0, 1.2);
    material.map = texture;
    const label = new Mesh(keep(new PlaneGeometry(4, 1).rotateX(-Math.PI / 2)), material);
    label.position.set(3.9, 0, -1.4);
    return label;
  }

  return {
    root,
    reset() {
      for (const square of [...symbols.keys()]) removeSymbol(square);
      for (const pulse of pulses) pulse.mesh.removeFromParent();
      pulses.length = 0;
      timeline.length = 0;
      lock?.group.removeFromParent();
      lock = null;
      face.setFog(null);
      for (const blip of blips) {
        blip.gliding = 0;
        for (const dot of blip.track) dot.age = 99;
      }
    },
    setPlaying(seats) {
      blips.forEach((blip, seat) => {
        const shown = seats.includes(seat === 0 ? 0 : 1);
        blip.group.visible = shown;
        for (const dot of blip.track) dot.mesh.visible = shown;
      });
    },
    nudge(seat) {
      blips[seat].flash = 1;
    },
    setFog(possible) {
      face.setFog(possible);
    },
    placeExplorer(seat, square) {
      const blip = blips[seat];
      blip.square = square;
      blip.position.copy(standPoint(square));
      blip.gliding = 0;
    },
    walk(seat, from, to, seconds) {
      const blip = blips[seat];
      dropTrackDot(blip);
      blip.square = to;
      blip.from.copy(standPoint(from));
      blip.to.copy(standPoint(to));
      // A wrap jumps straight across: blips do not crawl over the whole plot.
      blip.glide =
        blip.from.distanceTo(blip.to) > SQUARE_SIZE * 1.6 ? 0.0001 : Math.max(0.05, seconds * 0.8);
      blip.gliding = 0.0001;
    },
    reveal(_seat, square, clue) {
      const symbol = symbolFor(square, clue);
      if (symbol) addSymbol(square, symbol);
    },
    conceal(square) {
      removeSymbol(square);
    },
    blast(_seat, square) {
      addSymbol(square, staticSymbol(square));
      staticBurst(square);
      const centre = squareCentre(square, LAYER + 0.04);
      stage.lights.flash(
        centre.clone().setY(3),
        night ? '#ff6a5a' : '#ffffff',
        night ? 24 : 8,
        0.35,
      );
    },
    sendHome(seat, home) {
      const blip = blips[seat];
      if (home === null) return;
      {
        // The blip snaps home, leaving a streak along the way it was thrown.
        const start = blip.position.clone();
        const end = standPoint(home);
        const material = ink(seatColour(seat), 0, 1.2);
        const streak = new Mesh(
          keep(
            strokeGeometry(
              [
                [start.x, start.z],
                [end.x, end.z],
              ],
              0.16,
            ),
          ),
          material,
        );
        streak.position.y = LAYER - 0.004;
        root.add(streak);
        pulses.push({ mesh: streak, material, from: 1, to: 1, seconds: 0.01, hold: 0.6, age: 0 });
        blip.square = home;
        blip.position.copy(end);
        blip.gliding = 0;
      }
    },
    showFlag(square) {
      removeSymbol(square);
      lock?.group.removeFromParent();
      lockOn(square, 'TARGET', false);
    },
    capture(seat, square) {
      removeSymbol(square);
      lockOn(square, `LOCK · ${seat === 0 ? 'S1' : 'S2'}`, true);
      if (!options.reducedEffects) {
        const centre = squareCentre(square, LAYER + 0.1);
        for (let index = 0; index < 36; index++) {
          const turn = (index / 36) * Math.PI * 2;
          effects.glow.emit({
            x: centre.x,
            y: centre.y,
            z: centre.z,
            vx: Math.cos(turn) * 9,
            vz: Math.sin(turn) * 9,
            life: 0.5,
            size: 0.22,
            sizeEnd: 0.05,
            colour: night ? new Color(6, 1.4, 1.8) : new Color(0.7, 0.1, 0.15),
            alpha: 1,
            alphaEnd: 0,
            drag: 2.5,
            stretch: 0.03,
          });
        }
      }
    },
    update(dt) {
      clock += dt;
      for (let index = timeline.length - 1; index >= 0; index--) {
        const event = timeline[index];
        if (event && event.at <= clock) {
          timeline.splice(index, 1);
          event.run();
        }
      }
      face.update(dt);
      console_.update(clock);
      for (const blip of blips) {
        if (blip.gliding > 0) {
          blip.gliding = Math.min(blip.glide, blip.gliding + dt);
          const t = blip.gliding / blip.glide;
          blip.position.lerpVectors(blip.from, blip.to, t * t * (3 - 2 * t));
          if (t >= 1) blip.gliding = 0;
        }
        blip.group.position.set(blip.position.x, LAYER + 0.02, blip.position.z);
        blip.flash = Math.max(0, blip.flash - dt * 4);
        blip.group.scale.setScalar(1 + blip.flash * 0.6);
        for (const dot of blip.track) {
          dot.age += dt;
          dot.material.opacity = Math.max(0, 1 - dot.age / 9) * 0.9;
        }
      }
      for (let index = pulses.length - 1; index >= 0; index--) {
        const pulse = pulses[index];
        if (!pulse) continue;
        pulse.age += dt;
        const grow = Math.min(1, pulse.age / pulse.seconds);
        const eased = 1 - Math.pow(1 - grow, 3);
        pulse.mesh.scale.setScalar(pulse.from + (pulse.to - pulse.from) * eased);
        const fading = Math.max(0, pulse.age - pulse.seconds - pulse.hold);
        pulse.material.opacity = Math.max(0, 1 - fading / 0.8);
        if (pulse.material.opacity <= 0) {
          pulse.mesh.removeFromParent();
          pulses.splice(index, 1);
        }
      }
      if (lock) {
        lock.age += dt;
        const close = Math.min(1, lock.age / 0.4);
        lock.brackets.scale.setScalar(
          1.6 - 0.6 * (1 - Math.pow(1 - close, 3)) + Math.sin(clock * 6) * 0.03,
        );
      }
      // Everything brightens as the sweep passes over it and fades into afterglow.
      if (night) {
        for (const entry of glowing) {
          const lift = 0.7 + 0.6 * afterglow(face.sweep, entry.angle);
          entry.material.color.copy(entry.base).multiplyScalar(lift);
        }
      }
      effects.update(dt, stage.camera);
    },
    flush() {
      // The scope keeps no ground paint.
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      face.dispose();
      console_.dispose();
      effects.dispose();
      root.removeFromParent();
    },
  };

  function symbolFor(square: Square, clue: Clue): Group | null {
    if (clue.kind === 'distance') return rangeSymbol(square, clue.distance);
    if (clue.kind === 'arrow') return bearingSymbol(square, clue.bearing);
    return null;
  }
}

function diamond(size: number): Point[] {
  return [
    [0, -size],
    [size, 0],
    [0, size],
    [-size, 0],
  ];
}

function triangle(size: number): Point[] {
  return [
    [0, -size],
    [size * 0.9, size * 0.6],
    [-size * 0.9, size * 0.6],
  ];
}

/** A square outline of half-size `half`, for scaling into a range ring. */
function squareRing(half: number): Point[] {
  return [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
}

function circle(radius: number, segments: number): Point[] {
  return Array.from({ length: segments }, (_, index) => {
    const turn = (index / segments) * Math.PI * 2;
    return [Math.cos(turn) * radius, Math.sin(turn) * radius] as const;
  });
}
