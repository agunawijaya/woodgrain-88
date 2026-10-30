/**
 * Paper Sky's view: a child's drawing on graph paper that has come alive. The
 * sun smiles and its lines boil, the crayon rockets lift off the page a little
 * (their shadows show they are cut out and laid on it), their flames are
 * scribbles, missiles are pencil dashes that leave a fading line, and a hit is
 * a zigzag starburst with doodled stars flying off it. By night a desk torch
 * lights the middle of the page and the glow-in-the-dark crayon shines.
 */
import { createRibbon } from '@woodgrain-88/arena';
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SpotLight,
  Vector3,
  type CanvasTexture,
  type Material,
} from 'three';
import type {
  MissilePose,
  PodPose,
  RemixPose,
  Seat,
  SeatColours,
  ShipPose,
  SpaceView,
  ViewMoment,
  ViewOptions,
} from '../../look/look.ts';
import {
  createSpaceView,
  type LookParts,
  type MissileFigure,
  type MissileTrail,
  type PodFigure,
  type ShipFigure,
} from '../../look/space-rig.ts';
import { padTexture } from './crayon.ts';
import {
  drawDash,
  drawDoodleStar,
  drawComet,
  drawFlame,
  drawMagnet,
  drawMoon,
  drawPlane,
  drawRock,
  drawRocket,
  drawSheet,
  drawStarburst,
  drawSun,
  ROCKETS,
  SHEET_DEPTH,
  SHEET_WIDTH,
} from './drawings.ts';

/** The star's radius in units: what a ship must not touch. */
const SUN_RADIUS = 1.05;
/** Drawings boil at a cartoon's eight frames a second. */
const BOIL_FPS = 8;
const STICKER_HEIGHT = 0.18;
/** The rockets are drawn about 2.3 long; this brings them to the size that reads from overhead. */
const ROCKET_SCALE = 1.25;
const BOILS = 3;

const flat = (width: number, depth: number) =>
  new PlaneGeometry(width, depth).rotateX(-Math.PI / 2);

/** Which of the three versions shows at `clock` frames; never negative, whatever the clock. */
function boilFrame(clock: number, offset = 0): number {
  return (((Math.floor(clock) + offset) % BOILS) + BOILS) % BOILS;
}

/** Three versions of a drawing, to swap between as it boils. */
function boiling(draw: (seed: number) => CanvasTexture): CanvasTexture[] {
  return Array.from({ length: BOILS }, (_, seed) => draw(seed));
}

interface Spark {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  readonly velocity: Vector3;
  readonly spin: number;
  age: number;
  readonly life: number;
}

export function createPaperView(options: ViewOptions): SpaceView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('paper');
  const root = new Group();
  root.name = 'paper';
  const textures: CanvasTexture[] = [];
  const materials: Material[] = [];
  const geometries: PlaneGeometry[] = [];
  const keep = (texture: CanvasTexture) => {
    textures.push(texture);
    return texture;
  };
  const own = <T extends Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const shape = (width: number, depth: number) => {
    const geometry = flat(width, depth);
    geometries.push(geometry);
    return geometry;
  };
  const glowAmount = night ? 1.1 : 0;

  const sheet = keep(
    padTexture(
      drawSheet(rng.fork('sheet'), {
        spiral: options.centre === 'star' || options.centre === 'beacon',
        solidEdges: options.edges === 'bounce',
        night,
      }),
    ),
  );
  const paper = new Mesh(
    shape(SHEET_WIDTH, SHEET_DEPTH),
    own(new MeshStandardMaterial({ map: sheet, roughness: 0.95, metalness: 0 })),
  );
  paper.receiveShadow = true;
  root.add(paper);

  // The desk torch: a warm pool on the middle of the page that falls off into the dark, so the
  // glow-in-the-dark crayon has somewhere to shine.
  if (night) {
    const torch = new SpotLight('#ffe7bd', 650, 0, 0.5, 0.7, 2);
    torch.position.set(5, 17, 9);
    torch.target.position.set(-1.5, 0, 0.5);
    torch.castShadow = true;
    torch.shadow.mapSize.set(2048, 2048);
    root.add(torch, torch.target);
  }

  const sunFrames = boiling((seed) =>
    keep(padTexture(drawSun(rng.fork(`sun-${seed}`), SUN_RADIUS))),
  );
  const sunSize = SUN_RADIUS * 4.2;
  const sunMaterial = own(
    new MeshStandardMaterial({
      map: sunFrames[0] ?? null,
      transparent: true,
      roughness: 0.9,
      emissive: '#ffffff',
      emissiveMap: sunFrames[0] ?? null,
      emissiveIntensity: night ? 0.55 : 0,
    }),
  );
  const sun = new Mesh(shape(sunSize, sunSize), sunMaterial);
  sun.position.y = 0.02;
  // Binary Stars draws two small suns of its own in place of the one in the middle.
  sun.visible = options.centre === 'star' && options.remix !== 'binary-stars';
  root.add(sun);

  // The starbase is a drawn moon with a door, the docking beacon a magnet; both boil too.
  const middleFrames =
    options.centre === 'starbase'
      ? boiling((seed) => keep(padTexture(drawMoon(rng.fork(`moon-${seed}`), SUN_RADIUS))))
      : options.centre === 'beacon'
        ? boiling((seed) => keep(padTexture(drawMagnet(rng.fork(`magnet-${seed}`), SUN_RADIUS))))
        : [];
  const middleSize = SUN_RADIUS * (options.centre === 'beacon' ? 3.6 : 2.8);
  const middleMaterial = own(
    new MeshStandardMaterial({
      map: middleFrames[0] ?? null,
      transparent: true,
      roughness: 0.9,
      emissive: '#ffffff',
      emissiveMap: middleFrames[0] ?? null,
      emissiveIntensity: night ? 0.35 : 0,
    }),
  );
  const middle = new Mesh(shape(middleSize, middleSize), middleMaterial);
  middle.position.y = 0.03;
  middle.visible = middleFrames.length > 0;
  root.add(middle);
  let middlePulse = 0;
  let sunPulse = 0;

  const remix = paperRemix();

  /**
   * The Remix bodies as drawings on the page: two small suns for Binary Stars, a doodled comet
   * pointing the way it flies, grey crayon rocks for the belt. Each boils like the rest.
   */
  function paperRemix(): {
    show(pose: RemixPose | undefined): void;
    boil(frame: number): void;
  } | null {
    const kind = options.remix;
    if (kind !== 'binary-stars' && kind !== 'comet' && kind !== 'asteroid-belt') return null;
    const draw = (seed: number, index: number) =>
      kind === 'binary-stars'
        ? drawSun(rng.fork(`twin-${index}-${seed}`), 0.8)
        : kind === 'comet'
          ? drawComet(rng.fork(`comet-${seed}`))
          : drawRock(rng.fork(`rock-${index}-${seed}`));
    const count = kind === 'binary-stars' ? 2 : kind === 'comet' ? 1 : 10;
    const size =
      kind === 'binary-stars' ? [0.8 * 4.2, 0.8 * 4.2] : kind === 'comet' ? [3.2, 1.4] : [1.2, 1.2];
    const stickers = Array.from({ length: count }, (_, index) => {
      const frames = boiling((seed) => keep(padTexture(draw(seed, index))));
      const material = own(
        new MeshStandardMaterial({
          map: frames[0] ?? null,
          transparent: true,
          alphaTest: 0.05,
          roughness: 0.9,
          emissive: '#ffffff',
          emissiveMap: frames[0] ?? null,
          emissiveIntensity: night && kind !== 'asteroid-belt' ? 0.55 : 0,
        }),
      );
      const mesh = new Mesh(shape(size[0] ?? 1, size[1] ?? 1), material);
      mesh.position.y = STICKER_HEIGHT;
      mesh.visible = false;
      root.add(mesh);
      return { mesh, material, frames };
    });
    return {
      show(pose) {
        const placed =
          kind === 'binary-stars'
            ? (pose?.stars ?? [])
            : kind === 'comet'
              ? pose?.comet
                ? [pose.comet]
                : []
              : (pose?.rocks ?? []);
        stickers.forEach((sticker, index) => {
          const at = placed[index];
          sticker.mesh.visible = at !== undefined;
          if (!at) return;
          sticker.mesh.position.set(at.x, STICKER_HEIGHT, at.z);
          if ('heading' in at) sticker.mesh.rotation.y = at.heading;
          if (kind === 'asteroid-belt' && 'radius' in at)
            sticker.mesh.scale.setScalar(at.radius * 1.6);
        });
      },
      boil(frame) {
        for (const sticker of stickers) {
          const map = sticker.frames[boilFrame(frame)] ?? null;
          sticker.material.map = map;
          sticker.material.emissiveMap = map;
        }
      },
    };
  }

  const pods: PodFigure[] =
    options.pods === 'none'
      ? []
      : options.seats.map((colours, index) =>
          plane(options.pods === 'shared' && index === 0 ? '#2e2a33' : colours.main, index),
        );

  function plane(colour: string, index: number): PodFigure {
    const frames = boiling((seed) =>
      keep(padTexture(drawPlane(rng.fork(`plane-${index}-${seed}`), colour))),
    );
    const figure = new Group();
    // Larger than its touching circle, so a folded plane reads from across the room.
    figure.scale.setScalar(1.6);
    const material = own(
      new MeshStandardMaterial({ map: frames[0] ?? null, transparent: true, alphaTest: 0.05 }),
    );
    const body = new Mesh(shape(1.4, 1), material);
    body.position.y = STICKER_HEIGHT + 0.1;
    figure.add(body);
    const shadowMaterial = own(
      new MeshBasicMaterial({
        map: frames[0] ?? null,
        color: '#000000',
        transparent: true,
        opacity: night ? 0.3 : 0.2,
        depthWrite: false,
      }),
    );
    const shadow = new Mesh(shape(1.4, 1), shadowMaterial);
    shadow.position.set(0.14, 0.01, 0.16);
    figure.add(shadow);
    let boil = 0;
    return {
      root: figure,
      place(pose: PodPose, dt: number) {
        figure.position.set(pose.x, 0, pose.z);
        // A paper plane does not tumble: it glides, turning slowly and rocking on its wings.
        figure.rotation.y = pose.tumble * 0.6;
        body.rotation.x = Math.sin(pose.tumble * 2.3) * 0.25;
        boil += dt * BOIL_FPS;
        const frame = frames[boilFrame(boil)] ?? null;
        material.map = frame;
        shadowMaterial.map = frame;
      },
      dispose() {
        // Owned by the view's lists.
      },
    };
  }

  const ships = options.seats.map((colours, seat) => rocket(seat as Seat, colours));

  function rocket(seat: Seat, colours: SeatColours): ShipFigure {
    const design = ROCKETS[seat];
    const frames = boiling((seed) =>
      keep(padTexture(drawRocket(rng.fork(`rocket-${seat}-${seed}`), seat, colours, false))),
    );
    const glowFrames = boiling((seed) =>
      keep(padTexture(drawRocket(rng.fork(`rocket-${seat}-${seed}`), seat, colours, true))),
    );
    const flames = boiling((seed) =>
      keep(padTexture(drawFlame(rng.fork(`flame-${seat}-${seed}`)))),
    );
    const figure = new Group();
    const sticker = new Group();
    sticker.scale.setScalar(ROCKET_SCALE);
    figure.add(sticker);
    const material = own(
      new MeshStandardMaterial({
        map: frames[0] ?? null,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.85,
        emissive: '#ffffff',
        emissiveMap: glowFrames[0] ?? null,
        emissiveIntensity: glowAmount,
      }),
    );
    const body = new Mesh(shape(2.8, 1.8), material);
    body.position.y = STICKER_HEIGHT;
    sticker.add(body);
    // The cut-out's shadow on the page, a little down and to the right of it.
    const shadowMaterial = own(
      new MeshBasicMaterial({
        map: frames[0] ?? null,
        color: '#000000',
        transparent: true,
        opacity: night ? 0.35 : 0.22,
        depthWrite: false,
      }),
    );
    const shadow = new Mesh(shape(2.8, 1.8), shadowMaterial);
    shadow.position.set(0.1, 0.01, 0.12);
    sticker.add(shadow);
    const flameMaterial = own(
      new MeshStandardMaterial({
        map: flames[0] ?? null,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.9,
        emissive: '#ffffff',
        emissiveMap: flames[0] ?? null,
        emissiveIntensity: night ? 0.9 : 0.15,
      }),
    );
    const flame = new Mesh(shape(1.8, 1), flameMaterial);
    flame.position.set(design.tail, STICKER_HEIGHT - 0.01, 0);
    sticker.add(flame);
    let boil = 0;
    return {
      root: figure,
      pose(pose: ShipPose, dt: number) {
        figure.position.set(pose.x, 0, pose.z);
        figure.rotation.y = pose.heading;
        boil += dt * BOIL_FPS;
        const frame = boilFrame(boil);
        material.map = frames[frame] ?? null;
        material.emissiveMap = glowFrames[frame] ?? null;
        shadowMaterial.map = frames[frame] ?? null;
        flameMaterial.map = flames[boilFrame(frame, 1)] ?? null;
        flameMaterial.emissiveMap = flameMaterial.map;
        flame.visible = pose.thrusting;
        figure.visible = pose.cloak < 1;
      },
      spin(progress) {
        // Hit, the cut-out flashes pale every four frames, the cartridge's blink in crayon.
        const flashed = progress !== null && Math.floor(progress * 16) % 2 === 0;
        material.color.set(flashed ? '#fff7c2' : '#ffffff');
        material.emissiveIntensity = flashed ? 0.6 : glowAmount;
      },
      dispose() {
        // Owned by the view's lists.
      },
    };
  }

  const missiles: MissileFigure[] = options.seats.map((colours, seat) => {
    const texture = keep(padTexture(drawDash(rng.fork(`dash-${seat}`), colours)));
    const material = own(
      new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    const mesh = new Mesh(shape(0.8, 0.3), material);
    mesh.position.y = STICKER_HEIGHT;
    mesh.scale.setScalar(1.4);
    const figure = new Group();
    figure.add(mesh);
    return {
      root: figure,
      place(pose: MissilePose) {
        figure.position.set(pose.x, 0, pose.z);
        figure.rotation.y = pose.heading;
      },
      dispose() {
        // Owned by the view's lists.
      },
    };
  });

  const trails: MissileTrail[] = options.seats.map((colours) => {
    // By day a pencil line; by night the same line in glow-in-the-dark crayon, tinted the seat's way.
    const pencil = new Color('#34343c').lerp(new Color(colours.deep), 0.45);
    const glowing = new Color('#9dffc8').lerp(new Color(colours.main), 0.35).multiplyScalar(1.2);
    const ribbon = createRibbon(
      night
        ? {
            look: 'glow',
            width: 0.12,
            widthEnd: 0.04,
            colour: glowing,
            colourEnd: glowing.clone().multiplyScalar(0.5),
            alpha: 0.9,
            fade: 2.4,
            maxPoints: 240,
          }
        : {
            look: 'smoke',
            width: 0.12,
            widthEnd: 0.04,
            colour: pencil,
            colourEnd: pencil,
            alpha: 0.9,
            fade: 2.4,
            maxPoints: 240,
          },
    );
    root.add(ribbon.mesh);
    const at = new Vector3();
    return {
      push(point) {
        ribbon.push(at.copy(point).setY(0.03));
      },
      release() {
        // Each point fades by its own age; nothing more to do when the dash is gone.
      },
      update(dt, camera) {
        ribbon.update(dt, camera);
      },
      dispose() {
        ribbon.mesh.removeFromParent();
      },
    };
  });

  const burstTexture = keep(padTexture(drawStarburst(rng.fork('burst'))));
  const starTextures = ['#ffd93d', '#ff8c1f', '#ffffff'].map((colour, index) =>
    keep(padTexture(drawDoodleStar(rng.fork(`star-${index}`), colour))),
  );
  const pops: { mesh: Mesh; material: MeshBasicMaterial; age: number }[] = [];
  const sparks: Spark[] = [];

  function burst(seat: Seat, at: Vector3): void {
    const material = new MeshBasicMaterial({
      map: burstTexture,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new Mesh(shape(2.4, 2.4), material);
    mesh.position.copy(at).setY(STICKER_HEIGHT + 0.05);
    mesh.rotation.y = rng.float(0, Math.PI * 2);
    root.add(mesh);
    pops.push({ mesh, material, age: 0 });
    doodles(at, new Color(options.seats[seat === 0 ? 1 : 0]?.main ?? '#ffffff'), 9, 2.5, 5);
  }

  /** Doodled stars flying off a spot, every third one in `tint`. */
  function doodles(at: Vector3, tint: Color, count: number, slow: number, fast: number): void {
    if (options.reducedEffects) return;
    for (let index = 0; index < count; index++) {
      const texture = starTextures[index % starTextures.length] ?? null;
      const starMaterial = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        color: index % 3 === 2 ? tint : new Color('#ffffff'),
      });
      const star = new Mesh(shape(0.6, 0.6), starMaterial);
      star.position.copy(at).setY(STICKER_HEIGHT + 0.1);
      root.add(star);
      const angle = (index / count) * Math.PI * 2 + rng.float(-0.2, 0.2);
      const speed = rng.float(slow, fast);
      sparks.push({
        mesh: star,
        material: starMaterial,
        velocity: new Vector3(Math.cos(angle) * speed, 0, Math.sin(angle) * speed),
        spin: rng.float(-6, 6),
        age: 0,
        life: rng.float(0.5, 0.8),
      });
    }
  }

  function moment(event: ViewMoment): void {
    const own = new Color(options.seats[event.seat]?.main ?? '#ffffff');
    switch (event.kind) {
      case 'fired':
        doodles(event.at, own, 2, 1, 2);
        break;
      case 'swallowed':
        sunPulse = 1;
        doodles(event.at, new Color('#ffd33d'), 4, 1.5, 3);
        break;
      case 'refuelled':
        middlePulse = 1;
        doodles(event.at, new Color('#ffd33d'), 7, 2, 4);
        break;
      case 'docked':
        doodles(event.at, own, 9, 2.5, 4.5);
        break;
      default:
        break;
    }
  }

  let boilClock = 0;
  const parts: LookParts = {
    root,
    ships,
    missiles,
    trails,
    pods,
    burst,
    moment,
    remix: (pose) => remix?.show(pose),
    update(dt) {
      boilClock += dt * BOIL_FPS;
      remix?.boil(boilFrame(boilClock, 2));
      const sunFrame = sunFrames[boilFrame(boilClock)] ?? null;
      sunMaterial.map = sunFrame;
      sunMaterial.emissiveMap = sunFrame;
      const middleFrame = middleFrames[boilFrame(boilClock, 1)] ?? null;
      middleMaterial.map = middleFrame;
      middleMaterial.emissiveMap = middleFrame;
      // A gulp or a welcome: the drawing swells for a moment and settles.
      sunPulse = Math.max(0, sunPulse - dt * 3);
      middlePulse = Math.max(0, middlePulse - dt * 3);
      sun.scale.setScalar(1 + Math.sin(sunPulse * Math.PI) * 0.12);
      middle.scale.setScalar(1 + Math.sin(middlePulse * Math.PI) * 0.12);
      for (const pop of [...pops]) {
        pop.age += dt;
        const grow = Math.min(1, pop.age / 0.12);
        pop.mesh.scale.setScalar(0.35 + grow * 0.75);
        pop.material.opacity = pop.age < 0.35 ? 1 : Math.max(0, 1 - (pop.age - 0.35) / 0.3);
        if (pop.age > 0.65) {
          pop.mesh.removeFromParent();
          pop.material.dispose();
          pops.splice(pops.indexOf(pop), 1);
        }
      }
      for (const spark of [...sparks]) {
        spark.age += dt;
        spark.velocity.multiplyScalar(Math.exp(-dt * 2.5));
        spark.mesh.position.addScaledVector(spark.velocity, dt);
        spark.mesh.rotation.y += spark.spin * dt;
        spark.material.opacity = Math.max(0, 1 - spark.age / spark.life);
        if (spark.age >= spark.life) {
          spark.mesh.removeFromParent();
          spark.material.dispose();
          sparks.splice(sparks.indexOf(spark), 1);
        }
      }
    },
    dispose() {
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const pop of pops) pop.material.dispose();
      for (const spark of sparks) spark.material.dispose();
    },
  };
  return createSpaceView(options.stage.camera, parts, options.seats);
}
