/**
 * Ice Trail's watcher: a snowman on the bank beyond the far side, with coal
 * eyes, a carrot nose, a top hat, a scarf, stick arms and a broom at his
 * side. He follows the skaters with his eyes. Every time a skater goes down,
 * he melts into a puddle on the spot, and what does not melt (the carrot,
 * the coal, the hat, the scarf, the sticks and the broom) drops onto the
 * snow. Then a child trudges in, rolls him up again ball by ball, puts his
 * things back, and he blinks and waves, alive again.
 *
 * All of it runs on its own clock: the duel never waits for the snowman, and
 * a crash in the middle of the rebuilding melts whatever is built so far.
 */
import {
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { Rng } from '@woodgrain-88/kit';
import { WATCHER_SPOT, type Watcher } from '../../look/watcher.ts';

const SCALE = 1.25;
const PHASE_SECONDS = {
  melting: 1.1,
  puddle: 0.5,
  kidComing: 1.3,
  building: 1.8,
  dressing: 0.9,
  waking: 1.0,
  kidLeaving: 1.3,
} as const;
type Phase = 'standing' | keyof typeof PHASE_SECONDS;

const BALLS = [
  { radius: 0.75, y: 0.7 },
  { radius: 0.55, y: 1.78 },
  { radius: 0.4, y: 2.6 },
] as const;
/** Where the child stands to work, and where it waits out of the way. */
const KID_AT_WORK = -1.45;
const KID_AWAY = -4.4;

interface Item {
  readonly object: Object3D;
  readonly home: Vector3;
  readonly homeTurn: Euler;
  readonly fallen: Vector3;
  readonly fallenTurn: Euler;
  readonly from: Vector3;
  readonly fromTurn: Euler;
}

interface Ball {
  readonly mesh: Mesh;
  readonly radius: number;
  readonly y: number;
  /** How built the ball is: 1 standing, 0 not rolled yet; and how melted: 1 a slush. */
  built: number;
  melt: number;
  fromBuilt: number;
  fromMelt: number;
}

export function createSnowman(options: { readonly night: boolean; readonly rng: Rng }): Watcher {
  const { rng } = options;
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const keep = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const paint = (colour: string, roughness = 0.6) => {
    const material = new MeshStandardMaterial({ color: colour, roughness });
    materials.push(material);
    return material;
  };
  const snow = paint(options.night ? '#dfe8ff' : '#fbfdff', 0.95);
  const coal = paint('#1d1d22', 0.5);
  const carrotPaint = paint('#ef7d22', 0.55);
  const stick = paint('#6a4a2e', 0.8);
  const scarfPaint = paint('#3c8f5c', 0.85);
  const hatPaint = paint('#232227', 0.4);
  const straw = paint('#d8b45c', 0.8);
  const puddlePaint = new MeshStandardMaterial({
    color: new Color('#bcd8ff'),
    roughness: 0.05,
    transparent: true,
    opacity: 0.7,
  });
  materials.push(puddlePaint);

  const root = new Group();
  root.name = 'snowman';
  root.position.copy(WATCHER_SPOT);
  const snowman = new Group();
  snowman.scale.setScalar(SCALE);
  root.add(snowman);
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const mesh = new Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const puddle = add(snowman, new CylinderGeometry(1, 1, 0.03, 40), puddlePaint, 0, 0.015);
  puddle.castShadow = false;
  puddle.scale.setScalar(0.01);
  const balls: Ball[] = BALLS.map(({ radius, y }) => ({
    mesh: add(snowman, new SphereGeometry(radius, 28, 20), snow, 0, y),
    radius,
    y,
    built: 1,
    melt: 0,
    fromBuilt: 1,
    fromMelt: 0,
  }));
  const headY = BALLS[2].y;
  const middleY = BALLS[1].y;

  const items: Item[] = [];
  const item = (object: Object3D, fallenTurn = new Euler(Math.PI / 2, rng.float(0, 6), 0)) => {
    const angle = rng.float(0, Math.PI * 2);
    const distance = rng.float(0.5, 1.3);
    const fallen = new Vector3(
      Math.cos(angle) * distance,
      0.06,
      Math.sin(angle) * distance * 0.7 + 0.3,
    );
    items.push({
      object,
      home: object.position.clone(),
      homeTurn: object.rotation.clone(),
      fallen,
      fallenTurn,
      from: object.position.clone(),
      fromTurn: object.rotation.clone(),
    });
  };
  const eyes = [-1, 1].map((side) => {
    const eye = add(snowman, new SphereGeometry(0.06, 10, 8), coal, side * 0.14, headY + 0.1, 0.35);
    item(eye);
    return eye;
  });
  const carrot = add(snowman, new ConeGeometry(0.07, 0.42, 12), carrotPaint, 0, headY - 0.02, 0.55);
  carrot.rotation.x = Math.PI / 2;
  item(carrot);
  for (let index = 0; index < 5; index++) {
    const angle = Math.PI * (0.35 + index * 0.075);
    item(
      add(
        snowman,
        new SphereGeometry(0.035, 8, 6),
        coal,
        Math.cos(angle) * 0.2,
        headY - 0.18 - Math.sin(angle) * 0.04,
        0.34,
      ),
    );
  }
  for (const y of [-0.15, 0.05, 0.25])
    item(
      add(
        snowman,
        new SphereGeometry(0.06, 10, 8),
        coal,
        0,
        middleY + y,
        0.53 - Math.abs(y) * 0.12,
      ),
    );
  const hat = new Group();
  hat.position.set(0, headY + 0.34, 0);
  snowman.add(hat);
  add(hat, new CylinderGeometry(0.42, 0.42, 0.04, 24), hatPaint);
  add(hat, new CylinderGeometry(0.27, 0.29, 0.42, 24), hatPaint, 0, 0.22);
  item(hat, new Euler(0.3, 0, 0.2));
  const scarf = add(snowman, new TorusGeometry(0.38, 0.08, 10, 28), scarfPaint, 0, headY - 0.36);
  scarf.rotation.x = Math.PI / 2;
  item(scarf, new Euler(Math.PI / 2, 0, 0.1));
  const arms = [-1, 1].map((side) => {
    const arm = new Group();
    arm.position.set(side * 0.5, middleY + 0.15, 0);
    arm.rotation.z = side * -0.55;
    snowman.add(arm);
    add(arm, new CylinderGeometry(0.025, 0.035, 0.9, 6), stick, side * 0.4, 0, 0).rotation.z =
      side * (Math.PI / 2);
    add(arm, new CylinderGeometry(0.015, 0.02, 0.25, 5), stick, side * 0.75, 0.1, 0).rotation.z =
      side * 0.9;
    item(arm, new Euler(0, rng.float(0, 6), Math.PI / 2));
    return arm;
  });
  const broom = new Group();
  broom.position.set(1.0, 0.95, 0.25);
  broom.rotation.z = -0.18;
  snowman.add(broom);
  add(broom, new CylinderGeometry(0.03, 0.03, 1.9, 8), stick);
  add(broom, new ConeGeometry(0.22, 0.45, 12), straw, 0, -0.95);
  item(broom, new Euler(0, 0.4, Math.PI / 2 - 0.1));

  const kid = createKid(keep, paint);
  kid.root.position.set(KID_AWAY, 0, 0.4);
  kid.root.visible = false;
  root.add(kid.root);

  let phase: Phase = 'standing';
  let age = 0;
  let target: Vector3 | null = null;
  let kidNear = false;
  let kidStart = KID_AWAY;

  function snapshot(): void {
    for (const entry of items) {
      entry.from.copy(entry.object.position);
      entry.fromTurn.copy(entry.object.rotation);
    }
    for (const ball of balls) {
      ball.fromBuilt = ball.built;
      ball.fromMelt = ball.melt;
    }
  }

  function enter(next: Phase): void {
    phase = next;
    age = 0;
    // A child caught halfway by a fresh melt sets off again from where it stood.
    if (next === 'kidComing') kidStart = kid.root.visible ? kid.root.position.x : KID_AWAY;
    snapshot();
  }

  function placeBalls(): void {
    for (const ball of balls) {
      const melt = ball.melt;
      const built = ball.built;
      ball.mesh.visible = built > 0.01;
      ball.mesh.scale.set(
        built * (1 + melt * 0.35),
        built * (1 - melt * 0.88),
        built * (1 + melt * 0.35),
      );
      ball.mesh.position.y = ball.y * (1 - melt) + ball.radius * 0.1 * melt;
    }
  }

  function moveItems(progress: (index: number) => number, toHome: boolean): void {
    items.forEach((entry, index) => {
      const t = ease(progress(index));
      const goal = toHome ? entry.home : entry.fallen;
      const goalTurn = toHome ? entry.homeTurn : entry.fallenTurn;
      entry.object.position.lerpVectors(entry.from, goal, t);
      // Things dropping off arc a little as they fall; things put back are lifted into place.
      entry.object.position.y += Math.sin(t * Math.PI) * (toHome ? 0.3 : 0.15);
      entry.object.rotation.set(
        lerp(entry.fromTurn.x, goalTurn.x, t),
        lerp(entry.fromTurn.y, goalTurn.y, t),
        lerp(entry.fromTurn.z, goalTurn.z, t),
      );
    });
  }

  function walkKid(from: number, to: number, t: number, clock: number): void {
    kid.root.visible = true;
    kid.root.position.x = lerp(from, to, ease(t));
    kid.root.rotation.y = to > from ? Math.PI / 2 : -Math.PI / 2;
    kid.walk(clock, t < 1);
  }

  return {
    root,
    follow(point) {
      target = point;
    },
    react() {
      enter('melting');
    },
    update(dt, clock) {
      age += dt;
      const t = phase === 'standing' ? 1 : Math.min(1, age / PHASE_SECONDS[phase]);
      if (phase === 'standing') {
        // The coal eyes glance along the far side towards the action.
        const look = target ? Math.max(-0.4, Math.min(0.4, target.x / 25)) : 0;
        for (const [index, eye] of eyes.entries())
          eye.position.x = (index === 0 ? -0.14 : 0.14) + look * 0.12;
      } else if (phase === 'melting') {
        if (kid.root.visible) kid.walk(clock, false);
        for (const ball of balls) ball.melt = lerp(ball.fromMelt, 1, ease(t));
        puddle.scale.set(0.3 + t * 1.2, 1, 0.3 + t * 1.2);
        moveItems(
          (index) => Math.max(0, Math.min(1, (t - 0.15 - (index % 4) * 0.05) / 0.6)),
          false,
        );
        if (t >= 1) enter('puddle');
      } else if (phase === 'puddle') {
        if (t >= 1) enter(kidNear ? 'building' : 'kidComing');
      } else if (phase === 'kidComing') {
        walkKid(kidStart, KID_AT_WORK, t, clock);
        if (t >= 1) {
          kidNear = true;
          enter('building');
        }
      } else if (phase === 'building') {
        kid.pat(clock);
        balls.forEach((ball, index) => {
          const own = Math.max(0, Math.min(1, (t - index * 0.3) / 0.4));
          ball.melt = 0;
          ball.built = Math.max(ball.fromMelt > 0.5 ? 0 : ball.fromBuilt, ease(own));
        });
        puddle.scale.set(Math.max(0.01, 1.5 * (1 - t)), 1, Math.max(0.01, 1.5 * (1 - t)));
        if (t >= 1) enter('dressing');
      } else if (phase === 'dressing') {
        kid.pat(clock);
        moveItems(
          (index) => Math.max(0, Math.min(1, (t - (index / items.length) * 0.5) / 0.5)),
          true,
        );
        if (t >= 1) enter('waking');
      } else if (phase === 'waking') {
        kid.cheer(clock);
        const blink = Math.abs(Math.sin(t * Math.PI * 2));
        for (const eye of eyes) eye.scale.y = 0.15 + blink * 0.85;
        const wave = arms[1];
        if (wave) wave.rotation.z = 0.55 + Math.sin(t * Math.PI * 4) * 0.35 * (1 - t);
        if (t >= 1) {
          for (const eye of eyes) eye.scale.y = 1;
          if (wave) wave.rotation.z = 0.55;
          enter('kidLeaving');
        }
      } else {
        // The child heads off; the snowman stands on his own again.
        walkKid(KID_AT_WORK, KID_AWAY, t, clock);
        if (t >= 1) {
          kidNear = false;
          kid.root.visible = false;
          phase = 'standing';
        }
      }
      placeBalls();
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

interface Kid {
  readonly root: Group;
  /** Trudging: legs swinging while `moving`, standing still otherwise. */
  walk(clock: number, moving: boolean): void;
  /** Packing snow: both arms working up and down. */
  pat(clock: number): void;
  /** Both arms up for joy. */
  cheer(clock: number): void;
}

/** The child who rebuilds the snowman: a small figure in a purple coat and a yellow bobble hat. */
function createKid(
  keep: <T extends BufferGeometry>(geometry: T) => T,
  paint: (colour: string, roughness?: number) => MeshStandardMaterial,
): Kid {
  const coat = paint('#7b5cb8', 0.8);
  const jeans = paint('#334a7a', 0.8);
  const boots = paint('#3a2b22', 0.6);
  const skin = paint('#f2c9a5', 0.6);
  const hatWool = paint('#f2c14e', 0.9);
  const mitten = paint('#c8423a', 0.8);
  const root = new Group();
  root.name = 'kid';
  const body = new Group();
  body.scale.setScalar(1.25);
  root.add(body);
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const mesh = new Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const legs = [-1, 1].map((side) => {
    const leg = new Group();
    leg.position.set(0, 0.42, side * 0.09);
    body.add(leg);
    add(leg, new CapsuleGeometry(0.07, 0.24, 4, 8), jeans, 0, -0.18);
    add(leg, new SphereGeometry(0.08, 10, 8), boots, 0.03, -0.36).scale.set(1.3, 0.7, 1);
    return leg;
  });
  add(body, new CapsuleGeometry(0.19, 0.3, 6, 14), coat, 0, 0.72);
  add(body, new SphereGeometry(0.16, 16, 12), skin, 0, 1.12);
  add(body, new SphereGeometry(0.165, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatWool, 0, 1.15);
  add(body, new SphereGeometry(0.06, 10, 8), hatWool, 0, 1.33);
  const arms = [-1, 1].map((side) => {
    const arm = new Group();
    arm.position.set(0, 0.88, side * 0.21);
    body.add(arm);
    add(arm, new CapsuleGeometry(0.055, 0.22, 4, 8), coat, 0, -0.15);
    add(arm, new SphereGeometry(0.06, 10, 8), mitten, 0, -0.3);
    return arm;
  });
  return {
    root,
    walk(clock, moving) {
      for (const arm of arms) arm.rotation.x = 0;
      legs.forEach((leg, index) => {
        leg.rotation.z = moving ? Math.sin(clock * 9 + index * Math.PI) * 0.45 : 0;
      });
      arms.forEach((arm, index) => {
        arm.rotation.z = moving ? Math.sin(clock * 9 + index * Math.PI + Math.PI) * 0.35 : 0;
      });
      body.position.y = moving ? Math.abs(Math.sin(clock * 9)) * 0.04 : 0;
    },
    pat(clock) {
      for (const leg of legs) leg.rotation.z = 0;
      for (const arm of arms) arm.rotation.x = 0;
      for (const arm of arms) arm.rotation.z = 1.2 + Math.sin(clock * 12) * 0.35;
      body.position.y = 0;
    },
    cheer(clock) {
      arms.forEach((arm, index) => {
        arm.rotation.z = 0;
        arm.rotation.x = (index === 0 ? -1 : 1) * (2.6 + Math.sin(clock * 10) * 0.2);
      });
      body.position.y = Math.abs(Math.sin(clock * 8)) * 0.08;
    },
  };
}
