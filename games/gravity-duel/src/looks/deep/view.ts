/**
 * Deep Space's view: the planetarium sky or black space, the living star, the
 * two starfighters, missiles as bright tracers with long fading trails (the
 * bank shot's whole curve stays in sight for a moment), and a hit as a white
 * flash, a ring of light and a spray of sparks in the shooter's colour.
 */
import { createParticleField, createRibbon, type Ribbon } from '@woodgrain-88/arena';
import {
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { HALF_DEPTH, HALF_WIDTH } from '../../look/field.ts';
import type {
  MissilePose,
  Seat,
  SeatColours,
  SpaceView,
  ViewMoment,
  ViewOptions,
} from '../../look/look.ts';
import {
  createSpaceView,
  type LookParts,
  type MissileFigure,
  type MissileTrail,
} from '../../look/space-rig.ts';
import { createDeepBursts } from './burst.ts';
import { createDeepRemix } from './remix.ts';
import { createDeepShip } from './ships.ts';
import { createDeepSky } from './sky.ts';
import { createDeepStar } from './star.ts';
import { createDeepBeacon, createDeepPods, createDeepStarbase } from './stations.ts';

const MISSILE_HEIGHT = 0.55;
/** Long enough that a bank shot's whole curve is still there when it lands. */
const TRAIL_FADE = 2.2;

export function createDeepView(options: ViewOptions): SpaceView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('deep');
  const root = new Group();
  root.name = 'deep';
  const camera = options.stage.camera;
  const seatColour = options.seats.map((colours) => new Color(colours.main));

  const sky = createDeepSky({
    night,
    well: options.centre === 'star' || options.centre === 'beacon',
  });
  root.add(sky.mesh);

  const glow = createParticleField('glow', 1200, options.stage.lights.palette);
  root.add(glow.mesh);

  // Binary Stars replaces the one star in the middle with a pair of its own.
  const star =
    options.centre === 'star' && options.remix !== 'binary-stars'
      ? createDeepStar({ night, glow, rng })
      : null;
  if (star) root.add(star.root);
  const station =
    options.centre === 'starbase'
      ? createDeepStarbase(night)
      : options.centre === 'beacon'
        ? createDeepBeacon(night)
        : null;
  if (station) root.add(station.root);
  const remix = createDeepRemix(options, glow, rng.fork('remix'));
  if (remix) root.add(remix.root);
  const pods =
    options.pods === 'none'
      ? []
      : createDeepPods(
          options.seats.map((colours) => colours.main),
          options.pods === 'shared',
          night,
        );

  const border = fieldBorder(night, options.edges === 'bounce');
  root.add(border.line);

  const ships = options.seats.map((colours, seat) =>
    createDeepShip({ seat: seat as Seat, colours, night }),
  );

  const tracerGeometry = new SphereGeometry(0.12, 12, 8);
  const missiles: MissileFigure[] = seatColour.map((colour) => {
    const material = new MeshBasicMaterial({
      color: colour
        .clone()
        .lerp(new Color('#ffffff'), 0.5)
        .multiplyScalar(night ? 3 : 1.6),
    });
    const mesh = new Mesh(tracerGeometry, material);
    const figure = new Group();
    figure.add(mesh);
    mesh.position.y = MISSILE_HEIGHT;
    return {
      root: figure,
      place(pose: MissilePose) {
        figure.position.set(pose.x, 0, pose.z);
      },
      dispose() {
        material.dispose();
      },
    };
  });

  const trails: MissileTrail[] = options.seats.map((colours) => tracerTrail(root, colours, night));

  const bursts = createDeepBursts({ night, glow, rng: rng.fork('bursts') });
  root.add(bursts.root);

  function burst(seat: Seat, at: Vector3): void {
    const shooter = seatColour[seat === 0 ? 1 : 0] ?? new Color('#ffffff');
    const victim = seatColour[seat] ?? new Color('#ffffff');
    const lifted = at.clone().setY(MISSILE_HEIGHT);
    bursts.burst(lifted, shooter, victim, !options.reducedEffects);
    options.stage.lights.flash(lifted, shooter, night ? 30 : 12, 0.4);
  }

  /** A little spray of light: the muzzle, a homecoming, a dock. */
  function sparkle(at: Vector3, colour: Color, count: number, speed: number): void {
    if (options.reducedEffects) return;
    const hot = colour
      .clone()
      .lerp(new Color('#ffffff'), 0.4)
      .multiplyScalar(night ? 2.6 : 1.2);
    for (let index = 0; index < count; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const out = rng.float(0.4, 1) * speed;
      glow.emit({
        x: at.x,
        y: MISSILE_HEIGHT,
        z: at.z,
        vx: Math.cos(angle) * out,
        vy: rng.float(0.2, 1),
        vz: Math.sin(angle) * out,
        drag: 3,
        life: rng.float(0.3, 0.7),
        size: rng.float(0.05, 0.1),
        sizeEnd: 0.01,
        colour: hot,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.03,
        fadeIn: 0,
      });
    }
  }

  function moment(event: ViewMoment): void {
    const own = seatColour[event.seat] ?? new Color('#ffffff');
    switch (event.kind) {
      case 'fired':
        sparkle(event.at, own, 6, 1.2);
        break;
      case 'swallowed':
        star?.swallow();
        sparkle(event.at, new Color('#ffb36b'), 12, 1.6);
        break;
      case 'refuelled':
        station?.welcome();
        sparkle(event.at, new Color(night ? '#5cf2d6' : '#0f8f7c'), 20, 2.2);
        break;
      case 'docked':
        sparkle(event.at, own, 26, 2.6);
        options.stage.lights.flash(event.at.clone().setY(MISSILE_HEIGHT), own, night ? 16 : 6, 0.3);
        break;
      default:
        break;
    }
  }

  const parts: LookParts = {
    root,
    ships,
    missiles,
    trails,
    pods,
    burst,
    moment,
    remix: (pose) => remix?.show(pose),
    update(dt, clock, viewCamera) {
      sky.update(clock);
      star?.update(dt, clock, viewCamera);
      station?.update(dt, clock);
      remix?.update(dt, clock, viewCamera);
      border.update(clock);
      bursts.update(dt, viewCamera);
      glow.update(dt, viewCamera);
    },
    dispose() {
      sky.dispose();
      star?.dispose();
      station?.dispose();
      remix?.dispose();
      border.dispose();
      glow.dispose();
      tracerGeometry.dispose();
      bursts.dispose();
    },
  };
  return createSpaceView(camera, parts, options.seats);
}

/**
 * A missile's trail, laid at the tracer's height: by night a ribbon of light in the seat's colour;
 * by day a drawn line in its deeper shade, because light added to the dome's blue only washes out.
 */
function tracerTrail(parent: Group, colours: SeatColours, night: boolean): MissileTrail {
  const main = new Color(colours.main);
  const ribbon: Ribbon = createRibbon(
    night
      ? {
          look: 'glow',
          width: 0.24,
          widthEnd: 0.05,
          colour: main.clone().multiplyScalar(2.4),
          colourEnd: main.clone().multiplyScalar(0.8),
          alpha: 0.95,
          fade: TRAIL_FADE,
          maxPoints: 240,
        }
      : {
          look: 'smoke',
          width: 0.2,
          widthEnd: 0.05,
          colour: new Color(colours.deep),
          colourEnd: main,
          alpha: 1,
          fade: TRAIL_FADE,
          maxPoints: 240,
        },
  );
  parent.add(ribbon.mesh);
  const lifted = new Vector3();
  return {
    push(point) {
      ribbon.push(lifted.copy(point).setY(MISSILE_HEIGHT));
    },
    release() {
      // The ribbon fades each point by its own age, so letting it be is the fade.
    },
    update(dt, camera) {
      ribbon.update(dt, camera);
    },
    dispose() {
      ribbon.mesh.removeFromParent();
    },
  };
}

/** The ricochet edges as a thin line of light by night, a crisp drawn line by day; wraparound edges barely show. */
function fieldBorder(night: boolean, solid: boolean) {
  const corners = [
    [-HALF_WIDTH, -HALF_DEPTH],
    [HALF_WIDTH, -HALF_DEPTH],
    [HALF_WIDTH, HALF_DEPTH],
    [-HALF_WIDTH, HALF_DEPTH],
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      corners.flatMap(([x = 0, z = 0]) => [x, 0.02, z]),
      3,
    ),
  );
  const material = new LineBasicMaterial({
    color: night
      ? new Color('#7fa8ff').multiplyScalar(solid ? 1.6 : 0.5)
      : new Color(solid ? '#5a6d92' : '#a7b4cc'),
    transparent: true,
    opacity: solid ? 0.9 : 0.35,
  });
  const line = new LineLoop(geometry, material);
  return {
    line,
    update(clock: number) {
      if (night && solid) material.opacity = 0.75 + Math.sin(clock * 2) * 0.12;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
