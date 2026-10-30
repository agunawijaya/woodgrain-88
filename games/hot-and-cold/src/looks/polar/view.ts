/**
 * The Polar Expedition's field view: turns what happens in a round into the
 * snowfield's moments. Explorers walk from square to square leaving boot
 * prints (and walk off one edge to come back in at the other), dig a square's
 * snow away to show its clue, are thrown by a bomb and ride a sled home along
 * their own runner tracks, and pull the flag up out of the snow. Everything
 * moves by `update(dt)`, so a hero frame or a test can replay a moment.
 */
import { createCameraShake, createEffects, type Effects } from '@woodgrain-88/arena';
import { Color, Group, PointLight, Vector3, type BufferGeometry, type Material } from 'three';
import type { Clue } from '../../engine/board.ts';
import { stepBetween, type Square } from '../../engine/grid.ts';
import { createConfetti } from '../../look/confetti.ts';
import { SQUARE_SIZE, squareCentre } from '../../look/field-space.ts';
import type { FieldView, Seat, ViewOptions } from '../../look/look.ts';
import { createCluePieces, type PolarFlag } from './clue-pieces.ts';
import { createExplorer, type Explorer } from './explorer.ts';
import { buildSled } from './camp.ts';
import { createSnowfield } from './snowfield.ts';

/** Explorers stand at the back left of their square, so the clue in front of them stays in view. */
const STANCE = new Vector3(-1.0, 0, -1.25);
const STRIDE = 0.42;
/** Boots sink a little into fresh snow. */
const SINK = 0.05;
/** A bomb in snow throws up a pale plume that clears in a moment, not a column of soot. */
const SNOW_PLUME = {
  colour: new Color(0.78, 0.83, 0.9),
  thin: new Color(0.92, 0.95, 1),
  amount: 0.3,
};
/**
 * By day a pale plume and a full-size fireball bloom into one white blur on the white snow, hiding
 * the explorer it threw: the day's blast is smaller and its snow shadowed blue-grey, so the burst
 * reads as snow flying against snow.
 */
const DAY_SNOW_PLUME = {
  colour: new Color(0.6, 0.67, 0.78),
  thin: new Color(0.8, 0.85, 0.92),
  amount: 0.3,
};
const BLAST_SCALE = { day: 0.55, night: 0.85 };

/**
 * A held direction's next step starts the moment the last one lands, give or take a frame: the
 * explorer keeps its stride that long instead of snapping to a stand and starting over.
 */
const STAND_GRACE_SECONDS = 0.15;

/** Short enough to be home before the explorer may step again. */
const SLED_RIDE_SECONDS = 0.6;

/** A walk is a list of legs; a wrap's middle leg is a jump from one edge to the other. */
interface Leg {
  readonly from: Vector3;
  readonly to: Vector3;
  readonly jump: boolean;
}

interface Walker {
  readonly explorer: Explorer;
  readonly sled: Group;
  square: Square;
  readonly position: Vector3;
  sinceStep: number;
  leftFoot: boolean;
  legs: Leg[];
  walked: number;
  length: number;
  speed: number;
  ridingUntil: number;
  /** When the last walk arrived; the explorer stands only if no new step follows soon after. */
  arrivedAt: number;
  /** A blocked step's bump: the way it leaned, and how far through it is (1 done). */
  readonly bump: Vector3;
  bumpAge: number;
}

interface Timed {
  readonly at: number;
  readonly run: () => void;
}

/** The turn that faces an explorer along a direction on the table (it is built facing north). */
function yawTowards(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

export function createPolarView(options: ViewOptions): FieldView {
  const night = options.appearance === 'dark';
  const { stage } = options;
  const root = new Group();
  root.name = 'polar-view';
  const rng = options.rng.fork('polar');
  const extras: { geometries: BufferGeometry[]; materials: Material[] } = {
    geometries: [],
    materials: [],
  };

  // A low winter sun from the back left for long blue shadows; by night a high moon from the back
  // right (the rig keeps the moon opposite the sun).
  if (night) stage.lights.aimSun(130, 50);
  else stage.lights.aimSun(58, 26);

  const snowfield = createSnowfield({ rng: rng.fork('field'), night, seats: options.seats });
  root.add(snowfield.root);
  const pieces = createCluePieces(night, options.cluePalette);
  const shake = createCameraShake({
    maxOffset: 0.5,
    maxRoll: 0.01,
    recovery: 1.8,
    enabled: !options.reducedEffects,
  });
  const effects: Effects = createEffects({
    parent: root,
    lights: stage.lights,
    rng: rng.fork('effects'),
    intensity: options.reducedEffects ? 'reduced' : 'full',
    groundPaint: snowfield.groundPaint,
    shake,
  });

  const confetti = createConfetti();
  root.add(confetti.mesh);
  // A red hand flare burns at the flag's foot after a capture at night. The light exists from the
  // start, dark, so the scene's shaders never recompile mid-round.
  const flareLight = new PointLight('#ff4a3a', 0, 11, 1.4);
  root.add(flareLight);
  let flareBurning = -1;

  const shown = new Map<Square, Group>();
  const rising: { piece: Group; age: number }[] = [];
  const timeline: Timed[] = [];
  let clock = 0;
  let raisedFlag: { flag: PolarFlag; age: number } | null = null;

  const walkers = ([0, 1] as const).map((seat): Walker => {
    const explorer = createExplorer(options.seats[seat], seat * 17 + 3);
    explorer.setLantern(night);
    explorer.root.visible = seat < options.players;
    root.add(explorer.root);
    const sled = buildSled(
      (material) => {
        extras.materials.push(material);
        return material;
      },
      (geometry) => {
        extras.geometries.push(geometry);
        return geometry;
      },
      options.seats[seat],
    );
    sled.visible = false;
    root.add(sled);
    return {
      explorer,
      sled,
      square: seat === 0 ? 0 : 62,
      position: new Vector3(),
      sinceStep: 0,
      leftFoot: true,
      legs: [],
      walked: 0,
      length: 0,
      speed: 1,
      ridingUntil: -1,
      arrivedAt: 0,
      bump: new Vector3(),
      bumpAge: 1,
    };
  }) as [Walker, Walker];

  const standPoint = (square: Square): Vector3 => squareCentre(square).add(STANCE);

  function at(delay: number, run: () => void): void {
    timeline.push({ at: clock + delay, run });
  }

  function setWalk(walker: Walker, legs: Leg[], seconds: number): void {
    walker.legs = legs;
    walker.walked = 0;
    walker.length = legs.reduce(
      (sum, leg) => sum + (leg.jump ? 0 : leg.from.distanceTo(leg.to)),
      0,
    );
    walker.speed = walker.length / Math.max(0.05, seconds);
  }

  function snowPuff(where: Vector3, amount: number, upward = 1): void {
    if (options.reducedEffects) return;
    for (let index = 0; index < amount; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(0.6, 2.4);
      effects.smoke.emit({
        x: where.x + Math.cos(angle) * 0.4,
        y: where.y + 0.2,
        z: where.z + Math.sin(angle) * 0.4,
        vx: Math.cos(angle) * speed,
        vy: rng.float(1, 3.2) * upward,
        vz: Math.sin(angle) * speed,
        life: rng.float(0.6, 1.2),
        size: rng.float(0.35, 0.7),
        sizeEnd: rng.float(0.9, 1.5),
        colour: new Color(night ? '#c7d6ee' : '#ffffff'),
        alpha: 0.9,
        alphaEnd: 0,
        drag: 2.2,
        lift: -5,
        seed: rng.next(),
      });
    }
  }

  function glitter(where: Vector3, amount: number, colour: Color): void {
    if (options.reducedEffects) return;
    for (let index = 0; index < amount; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(1.5, 5.5);
      effects.glow.emit({
        x: where.x,
        y: where.y + 0.6,
        z: where.z,
        vx: Math.cos(angle) * speed,
        vy: rng.float(2, 7),
        vz: Math.sin(angle) * speed,
        life: rng.float(0.8, 1.6),
        size: rng.float(0.08, 0.18),
        colour,
        alpha: 1,
        alphaEnd: 0,
        drag: 1.4,
        lift: -6,
        stretch: 0.03,
        bounce: 0.3,
      });
    }
  }

  function bootPrint(walker: Walker, heading: Vector3): void {
    const angle = Math.atan2(heading.z, heading.x);
    const side = walker.leftFoot ? 1 : -1;
    walker.leftFoot = !walker.leftFoot;
    snowfield.groundPaint.stamp({
      kind: 'print',
      x: walker.position.x - Math.sin(angle) * 0.17 * side,
      z: walker.position.z + Math.cos(angle) * 0.17 * side,
      width: 0.24,
      length: 0.46,
      angle,
      strength: 0.85,
    });
  }

  function walkAlong(walker: Walker, dt: number): void {
    if (walker.legs.length === 0) return;
    walker.walked = Math.min(walker.length, walker.walked + walker.speed * dt);
    let remaining = walker.walked;
    const before = walker.position.clone();
    for (const leg of walker.legs) {
      if (leg.jump) continue;
      const legLength = leg.from.distanceTo(leg.to);
      if (remaining <= legLength) {
        walker.position.lerpVectors(leg.from, leg.to, legLength > 0 ? remaining / legLength : 1);
        break;
      }
      remaining -= legLength;
      walker.position.copy(leg.to);
    }
    const moved = walker.position.clone().sub(before).setY(0);
    // A wrap's jump moves the explorer a whole field at once; that is not a stride.
    if (moved.length() < SQUARE_SIZE) {
      walker.sinceStep += moved.length();
      if (walker.sinceStep >= STRIDE && moved.lengthSq() > 0 && walker.ridingUntil < 0) {
        walker.sinceStep -= STRIDE;
        bootPrint(walker, moved.normalize());
      }
    }
    if (walker.walked >= walker.length) {
      walker.legs = [];
      walker.arrivedAt = clock;
    }
  }

  function step(seat: Seat, from: Square, to: Square, seconds: number): void {
    const walker = walkers[seat];
    const move = stepBetween(from, to);
    const start = standPoint(from);
    const end = standPoint(to);
    walker.square = to;
    walker.explorer.setPose('walk');
    const crossesEdge = end.distanceTo(start) > SQUARE_SIZE * 1.6;
    if (move && crossesEdge) {
      // A wrap: walk off the edge, come back in at the opposite edge.
      const out = new Vector3(move.east, 0, move.south).multiplyScalar(SQUARE_SIZE / 2);
      const offEdge = start.clone().add(out);
      const onEdge = end.clone().sub(out);
      setWalk(
        walker,
        [
          { from: start, to: offEdge, jump: false },
          { from: offEdge, to: onEdge, jump: true },
          { from: onEdge, to: end, jump: false },
        ],
        seconds,
      );
    } else {
      setWalk(walker, [{ from: start, to: end, jump: false }], seconds);
    }
    const heading = move ? new Vector3(move.east, 0, move.south) : end.clone().sub(start);
    walker.explorer.face(yawTowards(heading.x, heading.z));
  }

  function showPiece(square: Square, piece: Group, riseFromSnow: boolean): void {
    hidePiece(square);
    piece.position.copy(squareCentre(square));
    if (riseFromSnow) {
      piece.position.y = -0.5;
      rising.push({ piece, age: 0 });
    }
    root.add(piece);
    shown.set(square, piece);
  }

  function hidePiece(square: Square): void {
    const piece = shown.get(square);
    if (!piece) return;
    piece.removeFromParent();
    shown.delete(square);
  }

  function pieceFor(clue: Clue): Group | null {
    if (clue.kind === 'distance') return pieces.numeral(clue.distance);
    if (clue.kind === 'arrow') return pieces.arrow(clue.bearing);
    return null;
  }

  /** Probing faces the explorer towards the middle of its square, and so towards the viewer. */
  const faceSquare = (walker: Walker) => walker.explorer.face(yawTowards(-STANCE.x, -STANCE.z));

  function rideHome(walker: Walker, home: Square): void {
    const start = walker.position.clone();
    const end = standPoint(home);
    walker.square = home;
    walker.ridingUntil = clock + SLED_RIDE_SECONDS;
    walker.sled.visible = true;
    walker.sled.rotation.y = yawTowards(end.x - start.x, end.z - start.z);
    setWalk(walker, [{ from: start, to: end, jump: false }], SLED_RIDE_SECONDS);
  }

  /** The hand flare at the flag's foot: a sputtering red light and sparks for a few seconds. */
  function burnHandFlare(dt: number): void {
    flareBurning += dt;
    const remaining = Math.max(0, 1 - flareBurning / 7);
    const flicker = 0.85 + 0.15 * Math.sin(flareBurning * 31) * Math.sin(flareBurning * 7);
    flareLight.intensity = 22 * remaining * flicker;
    if (remaining === 0) {
      flareBurning = -1;
      return;
    }
    const at = flareLight.position;
    effects.glow.emit({
      x: at.x + rng.float(-0.05, 0.05),
      y: at.y,
      z: at.z + rng.float(-0.05, 0.05),
      vx: rng.float(-0.4, 0.4),
      vy: rng.float(1.2, 2.4),
      vz: rng.float(-0.4, 0.4),
      life: rng.float(0.3, 0.6),
      size: rng.float(0.12, 0.3),
      sizeEnd: 0.05,
      colour: new Color(7, 1.3, 0.9),
      alpha: 1,
      alphaEnd: 0,
      fadeIn: 0,
    });
  }

  /** A celebration flare: a red star climbing from the flag and bursting high over the field. */
  function launchFlare(from: Vector3): void {
    const climb = 1.1;
    const top = from.clone().add(new Vector3(-1.5, 15, -3));
    for (let index = 0; index < 18; index++) {
      const t = index / 18;
      effects.glow.emit({
        x: from.x + (top.x - from.x) * t,
        y: 3 + (top.y - 3) * t,
        z: from.z + (top.z - from.z) * t,
        life: 0.25 + (1 - t) * 0.6,
        size: 0.22,
        sizeEnd: 0.05,
        colour: new Color(6, 1.6, 1.2),
        alpha: 1,
        alphaEnd: 0,
        fadeIn: t * climb,
      });
    }
    at(climb, () => {
      for (let index = 0; index < 60; index++) {
        const angle = rng.float(0, Math.PI * 2);
        const rise = rng.float(-1, 1);
        const flat = Math.sqrt(1 - rise * rise);
        const speed = rng.float(4, 7.5);
        effects.glow.emit({
          x: top.x,
          y: top.y,
          z: top.z,
          vx: Math.cos(angle) * speed * flat,
          vy: rise * speed,
          vz: Math.sin(angle) * speed * flat,
          life: rng.float(1.2, 2),
          size: 0.2,
          sizeEnd: 0.05,
          colour: index % 3 === 0 ? new Color(7, 4.5, 1.2) : new Color(7, 1.4, 1.1),
          alpha: 1,
          alphaEnd: 0,
          drag: 1.1,
          lift: -3,
          stretch: 0.05,
        });
      }
    });
  }

  return {
    root,
    reset() {
      for (const square of [...shown.keys()]) hidePiece(square);
      rising.length = 0;
      timeline.length = 0;
      raisedFlag?.flag.root.removeFromParent();
      raisedFlag = null;
      flareBurning = -1;
      flareLight.intensity = 0;
      snowfield.refillAll();
      snowfield.setFog(null);
      snowfield.groundPaint.wipeMarks();
      for (const walker of walkers) {
        walker.legs = [];
        walker.ridingUntil = -1;
        walker.sled.visible = false;
        walker.explorer.setPose('stand');
      }
    },
    setPlaying(seats) {
      walkers.forEach((walker, seat) => {
        walker.explorer.root.visible = seats.includes(seat === 0 ? 0 : 1);
      });
    },
    placeExplorer(seat, square) {
      const walker = walkers[seat];
      walker.square = square;
      walker.legs = [];
      walker.position.copy(standPoint(square));
    },
    walk(seat, from, to, seconds) {
      step(seat, from, to, seconds);
    },
    nudge(seat, toward) {
      const walker = walkers[seat];
      const direction = squareCentre(toward).sub(squareCentre(walker.square)).setY(0).normalize();
      walker.bump.copy(direction);
      walker.bumpAge = 0;
      walker.explorer.face(yawTowards(direction.x, direction.z));
    },
    reveal(seat, square, clue) {
      const walker = walkers[seat];
      walker.explorer.setPose('probe');
      faceSquare(walker);
      const centre = squareCentre(square, snowfield.standingHeight(square));
      snowfield.dig(square, 0.22);
      snowPuff(centre, 10, 0.8);
      const piece = pieceFor(clue);
      if (piece) showPiece(square, piece, true);
      if (clue.kind === 'distance' && clue.distance <= 2) {
        glitter(centre, 10, new Color(5, 2.6, 0.8));
      }
    },
    conceal(square) {
      hidePiece(square);
      snowfield.refill(square);
      snowPuff(squareCentre(square, 0.3), 6, 0.5);
      for (const walker of walkers) {
        if (walker.square === square && walker.explorer.pose === 'probe') {
          walker.explorer.setPose('stand');
        }
      }
    },
    blast(seat, square) {
      const walker = walkers[seat];
      const centre = squareCentre(square);
      snowfield.dig(square, 0);
      effects.explosion(centre.clone().setY(0.5), {
        scale: night ? BLAST_SCALE.night : BLAST_SCALE.day,
        smoke: night ? SNOW_PLUME : DAY_SNOW_PLUME,
      });
      snowPuff(centre, 36, 2.2);
      showPiece(square, pieces.crater(rng.fork(`crater/${square}`)), false);
      walker.explorer.setPose('tumble');
    },
    sendHome(seat, to) {
      const walker = walkers[seat];
      // The blast has settled: the team's sled scoops the explorer up and runs it home.
      if (to === null) walker.explorer.setPose('stand');
      else rideHome(walker, to);
    },
    setFog(possible) {
      snowfield.setFog(possible);
    },
    showFlag(square) {
      const centre = squareCentre(square);
      snowfield.dig(square, 0.18);
      hidePiece(square);
      raisedFlag?.flag.root.removeFromParent();
      const flag = pieces.flag();
      flag.root.position.copy(centre);
      root.add(flag.root);
      raisedFlag = { flag, age: 0 };
      snowPuff(centre, 14, 1.1);
    },
    capture(seat, square) {
      const walker = walkers[seat];
      const centre = squareCentre(square);
      snowfield.dig(square, 0.18);
      hidePiece(square);
      const flag = pieces.flag();
      flag.root.position.copy(centre);
      root.add(flag.root);
      raisedFlag = { flag, age: 0 };
      snowPuff(centre, 40, 2.6);
      glitter(centre, 46, night ? new Color(2.4, 4.2, 6) : new Color(6, 5.6, 4.4));
      stage.lights.flash(
        centre.clone().setY(2.5),
        night ? '#ffd9a0' : '#ffffff',
        night ? 60 : 30,
        1.2,
      );
      faceSquare(walker);
      at(0.5, () => walker.explorer.setPose('cheer'));
      if (!options.reducedEffects) {
        const team = options.seats[seat];
        at(0.35, () =>
          confetti.burst(centre, [team.main, team.main, '#ffffff', '#ffd23f', '#d3203a'], rng),
        );
      }
      if (night && !options.reducedEffects) {
        at(0.25, () => launchFlare(centre));
        flareLight.position.copy(centre).add(new Vector3(0.9, 0.6, 0.8));
        flareBurning = 0;
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
      for (const walker of walkers) {
        walkAlong(walker, dt);
        const resting = walker.legs.length === 0 && clock - walker.arrivedAt >= STAND_GRACE_SECONDS;
        if (resting && walker.explorer.pose === 'walk') walker.explorer.setPose('stand');
        const riding = walker.ridingUntil >= 0;
        const ground = snowfield.surfaceHeight(walker.position.x, walker.position.z);
        walker.bumpAge = Math.min(1, walker.bumpAge + dt / 0.25);
        const lean = Math.sin(Math.PI * walker.bumpAge) * 0.35;
        walker.explorer.root.position.set(
          walker.position.x + walker.bump.x * lean,
          riding ? 0.32 : Math.max(0, ground - SINK),
          walker.position.z + walker.bump.z * lean,
        );
        if (riding) {
          walker.sled.position.set(walker.position.x, 0.02, walker.position.z);
          snowfield.groundPaint.stamp({
            kind: 'track',
            x: walker.position.x,
            z: walker.position.z,
            width: 0.85,
            length: 0.4,
            angle: -walker.sled.rotation.y - Math.PI / 2,
            strength: 0.6,
          });
          if (clock >= walker.ridingUntil) {
            walker.ridingUntil = -1;
            walker.sled.visible = false;
            walker.explorer.setPose('stand');
          }
        }
        walker.explorer.update(dt);
      }
      for (let index = rising.length - 1; index >= 0; index--) {
        const entry = rising[index];
        if (!entry) continue;
        entry.age = Math.min(0.3, entry.age + dt);
        const t = entry.age / 0.3;
        entry.piece.position.y = -0.5 * (1 - t) * (1 - t);
        if (entry.age >= 0.3) rising.splice(index, 1);
      }
      if (raisedFlag) {
        raisedFlag.age += dt;
        raisedFlag.flag.setRise(raisedFlag.age / 1.1);
      }
      if (flareBurning >= 0) burnHandFlare(dt);
      confetti.update(dt);
      pieces.update(dt);
      snowfield.update(dt);
      snowfield.groundPaint.age(dt);
      effects.update(dt, stage.camera);
      stage.setShake(shake.update(dt));
    },
    flush() {
      snowfield.groundPaint.flush(stage.renderer);
    },
    dispose() {
      for (const walker of walkers) walker.explorer.dispose();
      for (const geometry of extras.geometries) geometry.dispose();
      for (const material of extras.materials) material.dispose();
      confetti.dispose();
      pieces.dispose();
      snowfield.dispose();
      effects.dispose();
      root.removeFromParent();
    },
  };
}
