/**
 * The Brass Orrery's view: clockwork craft over a walnut desk, the filament
 * bulb burning in the middle of the orrery's rings, missiles as brass pellets
 * that leave a thin bright wire behind them, and a hit as a burst of gold
 * sparks, a puff of steam and little cogs flying loose.
 */
import { createParticleField, createRibbon } from '@woodgrain-88/arena';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SpotLight,
  Vector3,
} from 'three';
import type { MissilePose, Seat, SpaceView, ViewMoment, ViewOptions } from '../../look/look.ts';
import {
  createSpaceView,
  type LookParts,
  type MissileFigure,
  type MissileTrail,
} from '../../look/space-rig.ts';
import { createOrrery } from './orrery.ts';
import { createBrassRemix } from './remix.ts';
import { createBrassShip } from './ships.ts';
import { createBrassHub, createBrassLodestone, createBrassPods } from './stations.ts';

const PELLET_HEIGHT = 0.55;
const COGS = 24;
const COG_LIFE = 1.1;

interface Cog {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly spin: number;
  turn: number;
  readonly size: number;
  age: number;
}

export function createBrassView(options: ViewOptions): SpaceView {
  const night = options.appearance === 'dark';
  const rng = options.rng.fork('brass');
  const root = new Group();
  root.name = 'brass';

  const orrery = createOrrery({
    night,
    rng: rng.fork('orrery'),
    // Binary Stars puts two bulbs of its own in place of the one in the middle.
    bulb: options.centre === 'star' && options.remix !== 'binary-stars',
    rings: options.centre === 'star' || options.centre === 'beacon',
    solidEdges: options.edges === 'bounce',
  });
  root.add(orrery.root);
  const middle =
    options.centre === 'starbase'
      ? createBrassHub(night)
      : options.centre === 'beacon'
        ? createBrassLodestone(night)
        : null;
  if (middle) root.add(middle.root);
  const remix = createBrassRemix(options, rng.fork('remix'));
  if (remix) root.add(remix.root);
  const pods =
    options.pods === 'none'
      ? []
      : createBrassPods(
          options.seats.map((colours) => colours.main),
          options.pods === 'shared',
          night,
        );

  if (!night) root.add(windowLight());

  if (night) {
    // The desk lamp: a warm pool on the board, falling off to the wood's dark grain at the edges.
    const lamp = new SpotLight('#ffd49a', 900, 0, 0.62, 0.8, 2);
    lamp.position.set(-15, 14, -12);
    lamp.target.position.set(1, 0, 1);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    root.add(lamp, lamp.target);
  }

  const glow = createParticleField('glow', 900, options.stage.lights.palette);
  const steam = createParticleField('smoke', 400, options.stage.lights.palette);
  root.add(glow.mesh, steam.mesh);

  const ships = options.seats.map((colours, seat) =>
    createBrassShip({ seat: seat as Seat, colours, night }),
  );

  const pelletGeometry = new SphereGeometry(0.13, 16, 12);
  const pelletMaterial = new MeshStandardMaterial({
    color: '#e0b25a',
    metalness: 1,
    roughness: 0.2,
    emissive: night ? '#4a3210' : '#000000',
  });
  const missiles: MissileFigure[] = options.seats.map(() => {
    const figure = new Group();
    const pellet = new Mesh(pelletGeometry, pelletMaterial);
    pellet.position.y = PELLET_HEIGHT;
    pellet.castShadow = true;
    figure.add(pellet);
    return {
      root: figure,
      place(pose: MissilePose) {
        figure.position.set(pose.x, 0, pose.z);
      },
      dispose() {
        // Shared geometry and material, disposed with the view.
      },
    };
  });

  // The wire a pellet leaves: thin brass, catching the light, tinted toward its owner's colour.
  const trails: MissileTrail[] = options.seats.map((colours) => {
    const wire = new Color('#c99a45').lerp(new Color(colours.main), 0.3);
    const ribbon = createRibbon(
      night
        ? {
            look: 'glow',
            width: 0.1,
            widthEnd: 0.04,
            colour: wire.clone().multiplyScalar(1.8),
            colourEnd: wire.clone().multiplyScalar(0.6),
            alpha: 0.9,
            fade: 2.4,
            maxPoints: 240,
          }
        : {
            look: 'smoke',
            width: 0.08,
            widthEnd: 0.035,
            colour: wire,
            colourEnd: new Color('#8a6a30'),
            alpha: 0.95,
            fade: 2.4,
            maxPoints: 240,
          },
    );
    root.add(ribbon.mesh);
    const at = new Vector3();
    return {
      push(point) {
        ribbon.push(at.copy(point).setY(PELLET_HEIGHT));
      },
      release() {
        // Each point of the wire fades by its own age.
      },
      update(dt, camera) {
        ribbon.update(dt, camera);
      },
      dispose() {
        ribbon.mesh.removeFromParent();
      },
    };
  });

  const cogGeometry = new CylinderGeometry(1, 1, 0.3, 10);
  const cogMaterial = new MeshStandardMaterial({ color: '#c99a45', metalness: 1, roughness: 0.3 });
  const cogMesh = new InstancedMesh(cogGeometry, cogMaterial, COGS * 2);
  cogMesh.count = 0;
  cogMesh.frustumCulled = false;
  root.add(cogMesh);
  const cogs: Cog[] = [];
  const scratch = new Object3D();

  function burst(seat: Seat, at: Vector3): void {
    const shooter = new Color(options.seats[seat === 0 ? 1 : 0]?.main ?? '#ffffff');
    const lifted = at.clone().setY(PELLET_HEIGHT);
    const gold = new Color('#ffcc66').multiplyScalar(night ? 3.2 : 1.8);
    const tinted = shooter
      .clone()
      .lerp(new Color('#ffcc66'), 0.4)
      .multiplyScalar(night ? 2.6 : 1.4);
    options.stage.lights.flash(lifted, '#ffc06a', night ? 26 : 10, 0.35);
    if (options.reducedEffects) return;
    for (let index = 0; index < 56; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(2.5, 8);
      glow.emit({
        x: lifted.x,
        y: lifted.y,
        z: lifted.z,
        vx: Math.cos(angle) * speed,
        vy: rng.float(0.5, 3),
        vz: Math.sin(angle) * speed,
        lift: -6,
        drag: 2,
        life: rng.float(0.35, 0.75),
        size: rng.float(0.06, 0.12),
        sizeEnd: 0.02,
        colour: index % 3 === 0 ? tinted : gold,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.04,
        bounce: 0.4,
        fadeIn: 0,
      });
    }
    for (let puff = 0; puff < 10; puff++) {
      steam.emit({
        x: lifted.x + rng.float(-0.2, 0.2),
        y: lifted.y,
        z: lifted.z + rng.float(-0.2, 0.2),
        vx: rng.float(-0.8, 0.8),
        vy: rng.float(0.6, 1.4),
        vz: rng.float(-0.8, 0.8),
        drag: 1.2,
        life: rng.float(0.8, 1.4),
        size: rng.float(0.5, 0.8),
        sizeEnd: 1.6,
        colour: new Color('#e8e2d6'),
        alpha: night ? 0.35 : 0.5,
        alphaEnd: 0,
        seed: rng.float(0, 100),
      });
    }
    for (let index = 0; index < COGS; index++) {
      if (cogs.length >= COGS * 2) cogs.shift();
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(1.5, 4.5);
      cogs.push({
        position: lifted.clone(),
        velocity: new Vector3(Math.cos(angle) * speed, rng.float(1, 3), Math.sin(angle) * speed),
        spin: rng.float(-14, 14),
        turn: rng.float(0, 6),
        size: rng.float(0.05, 0.11),
        age: 0,
      });
    }
  }

  function updateCogs(dt: number): void {
    let live = 0;
    for (const cog of cogs) {
      cog.age += dt;
      if (cog.age >= COG_LIFE) continue;
      cog.velocity.y -= 9 * dt;
      cog.position.addScaledVector(cog.velocity, dt);
      if (cog.position.y < 0.04) {
        cog.position.y = 0.04;
        cog.velocity.multiplyScalar(0.4);
        cog.velocity.y = Math.abs(cog.velocity.y) * 0.4;
      }
      cog.turn += cog.spin * dt;
      scratch.position.copy(cog.position);
      scratch.rotation.set(cog.turn, cog.turn * 0.7, 0);
      scratch.scale.setScalar(cog.size * Math.min(1, (COG_LIFE - cog.age) * 3));
      scratch.updateMatrix();
      cogMesh.setMatrixAt(live, scratch.matrix);
      live++;
    }
    cogMesh.count = live;
    cogMesh.instanceMatrix.needsUpdate = true;
  }

  /** A shower of gold sparks: the muzzle, a homecoming, a dock. */
  function sparks(at: Vector3, count: number, speed: number, tint?: Color): void {
    if (options.reducedEffects) return;
    const gold = new Color('#ffd27a').multiplyScalar(night ? 2.2 : 1.2);
    for (let index = 0; index < count; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const out = rng.float(0.4, 1) * speed;
      glow.emit({
        x: at.x,
        y: PELLET_HEIGHT,
        z: at.z,
        vx: Math.cos(angle) * out,
        vy: rng.float(0.5, 2),
        vz: Math.sin(angle) * out,
        lift: -6,
        drag: 2,
        life: rng.float(0.3, 0.6),
        size: rng.float(0.05, 0.09),
        sizeEnd: 0.02,
        colour: tint && index % 3 === 0 ? tint : gold,
        alpha: 1,
        alphaEnd: 0,
        stretch: 0.03,
        bounce: 0.4,
        fadeIn: 0,
      });
    }
  }

  function moment(event: ViewMoment): void {
    const own = new Color(options.seats[event.seat]?.main ?? '#ffffff');
    switch (event.kind) {
      case 'fired':
        sparks(event.at, 5, 1);
        break;
      case 'swallowed':
        sparks(event.at, 10, 1.4);
        break;
      case 'refuelled':
        middle?.welcome();
        sparks(event.at, 18, 2);
        break;
      case 'docked':
        sparks(event.at, 24, 2.4, own);
        options.stage.lights.flash(event.at.clone().setY(PELLET_HEIGHT), own, night ? 14 : 5, 0.3);
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
    update(dt, clock, camera) {
      orrery.update(dt, clock, camera);
      middle?.update(dt, clock);
      remix?.update(dt, clock, camera);
      updateCogs(dt);
      glow.update(dt, camera);
      steam.update(dt, camera);
    },
    dispose() {
      orrery.dispose();
      middle?.dispose();
      remix?.dispose();
      glow.dispose();
      steam.dispose();
      pelletGeometry.dispose();
      pelletMaterial.dispose();
      cogGeometry.dispose();
      cogMaterial.dispose();
      cogMesh.dispose();
    },
  };
  return createSpaceView(options.stage.camera, parts, options.seats);
}

/**
 * Sunlight through the study window, laid across the desk at a slant: a warm pane of light with
 * the glazing bars' shadows in it, soft at its edges. Drawn, not cast, so it sits exactly where
 * the composition wants it and costs nothing.
 */
function windowLight(): Mesh {
  const width = 512;
  const height = 320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2D canvas for the window light');
  context.filter = 'blur(10px)';
  context.fillStyle = 'rgba(255, 214, 150, 0.2)';
  const panes = 3;
  const rows = 2;
  const gap = 14;
  const paneWidth = (width - 80 - gap * (panes - 1)) / panes;
  const paneHeight = (height - 80 - gap * (rows - 1)) / rows;
  for (let column = 0; column < panes; column++) {
    for (let row = 0; row < rows; row++) {
      context.fillRect(
        40 + column * (paneWidth + gap),
        40 + row * (paneHeight + gap),
        paneWidth,
        paneHeight,
      );
    }
  }
  const texture = new CanvasTexture(canvas);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(26, 15).rotateX(-Math.PI / 2), material);
  mesh.position.set(-5, 0.03, -1.5);
  // A low sun stretches the window into a slanted parallelogram across the desk.
  mesh.geometry.applyMatrix4(new Matrix4().makeShear(0, 0, 0, 0, 0.45, 0));
  mesh.rotation.y = 0.18;
  mesh.renderOrder = 1;
  return mesh;
}
