/**
 * The Tabletop Board's field view. Pawns hop from tile to tile like a hand
 * moving them; checking a square turns its tile over like a card, landing
 * with a click; a bomb tile goes off in a cartoon puff and the pawn is
 * bounced home; the flag tile shows a gold star and a pennant on a pin
 * springs up out of it while confetti flies.
 */
import { createEffects, type Effects } from '@woodgrain-88/arena';
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  BackSide,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Vector3,
  type CanvasTexture,
  type Material,
} from 'three';
import type { Clue } from '../../engine/board.ts';
import { kingDistance, SQUARE_COUNT, stepBetween, type Square } from '../../engine/grid.ts';
import { createConfetti } from '../../look/confetti.ts';
import { SQUARE_SIZE, squareCentre } from '../../look/field-space.ts';
import type { FieldView, ViewOptions } from '../../look/look.ts';
import { createTabletopBoard, FELT_TOP, TILE_THICKNESS, TILE_TOP } from './board.ts';
import { createTileFaces } from './faces.ts';
import { createPawn, type Pawn } from './pawn.ts';

/** Pawns stand at the back left of their tile, so its face stays in view. */
const STANCE = new Vector3(-0.95, 0, -1.05);
const FLIP_SECONDS = 0.42;

interface Hop {
  readonly from: Vector3;
  readonly to: Vector3;
  readonly height: number;
  readonly seconds: number;
  age: number;
  /** A wrap: the pawn is lifted off one edge and set down at the other. */
  readonly lifted: boolean;
}

interface Player {
  readonly pawn: Pawn;
  square: Square;
  readonly position: Vector3;
  hops: Hop[];
  spin: number;
}

interface Turned {
  readonly tile: Group;
  /** 0 face down, 1 face up; the view eases between them. */
  target: number;
  shown: number;
  readonly centre: Vector3;
}

interface Puff {
  readonly mesh: Mesh;
  readonly outline: Mesh;
  readonly velocity: Vector3;
  age: number;
  readonly size: number;
}

export function createTabletopView(options: ViewOptions): FieldView {
  const night = options.appearance === 'dark';
  const { stage } = options;
  const root = new Group();
  root.name = 'tabletop-view';
  const rng = options.rng.fork('tabletop');
  const owned: { geometries: BufferGeometry[]; materials: Material[] } = {
    geometries: [],
    materials: [],
  };
  const own = <T extends Material>(material: T): T => {
    owned.materials.push(material);
    return material;
  };

  const faces = createTileFaces(options.cluePalette);
  const board = createTabletopBoard({ rng: rng.fork('board'), faces, seats: options.seats });
  root.add(board.root);
  const effects: Effects = createEffects({
    parent: root,
    lights: stage.lights,
    rng: rng.fork('effects'),
    intensity: options.reducedEffects ? 'reduced' : 'full',
  });
  const confetti = createConfetti(0.26);
  root.add(confetti.mesh);

  const faceMaterials = new Map<CanvasTexture, Material>();
  const faceMaterial = (texture: CanvasTexture): Material => {
    let material = faceMaterials.get(texture);
    if (!material) {
      material = own(
        new MeshPhysicalMaterial({
          map: texture,
          roughness: 0.42,
          clearcoat: 0.7,
          clearcoatRoughness: 0.25,
        }),
      );
      faceMaterials.set(texture, material);
    }
    return material;
  };
  const backMaterial = faceMaterial(faces.back);
  const starMaterial = own(
    new MeshPhysicalMaterial({
      map: faces.star,
      roughness: 0.35,
      clearcoat: 0.7,
      emissive: new Color('#ffb52e'),
      emissiveMap: faces.star,
      emissiveIntensity: night ? 0.16 : 0.06,
    }),
  );

  const players = ([0, 1] as const).map((seat): Player => {
    const pawn = createPawn(options.seats[seat]);
    pawn.root.visible = seat < options.players;
    root.add(pawn.root);
    return { pawn, square: seat === 0 ? 0 : 62, position: new Vector3(), hops: [], spin: 0 };
  }) as [Player, Player];

  const turned = new Map<Square, Turned>();
  const puffs: Puff[] = [];
  const puffGeometry = new SphereGeometry(1, 20, 14);
  owned.geometries.push(puffGeometry);
  const puffWhite = own(new MeshStandardMaterial({ color: '#fbf7ee', roughness: 0.9 }));
  const puffLine = own(new MeshBasicMaterial({ color: '#2b2622', side: BackSide }));
  let pennant: { root: Group; age: number } | null = null;
  let clock = 0;
  const timeline: { at: number; run: () => void }[] = [];
  const at = (delay: number, run: () => void) => timeline.push({ at: clock + delay, run });

  const standPoint = (square: Square): Vector3 => squareCentre(square, TILE_TOP).add(STANCE);

  function hop(
    player: Player,
    from: Vector3,
    to: Vector3,
    seconds: number,
    height: number,
    lifted = false,
  ): void {
    player.hops.push({ from: from.clone(), to: to.clone(), height, seconds, age: 0, lifted });
  }

  function turnTile(square: Square, texture: CanvasTexture): void {
    const existing = turned.get(square);
    if (existing) existing.tile.removeFromParent();
    board.takeTile(square);
    const tile = new Group();
    const body = new Mesh(board.tileBody, board.woodMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    const back = new Mesh(board.tileDecal, backMaterial);
    back.position.y = TILE_THICKNESS / 2 + 0.004;
    const face = new Mesh(
      board.tileDecal,
      texture === faces.star ? starMaterial : faceMaterial(texture),
    );
    // Prepared face down, so a half turn about the depth axis brings it up the right way round.
    face.rotation.z = Math.PI;
    face.position.y = -TILE_THICKNESS / 2 - 0.004;
    tile.add(body, back, face);
    const centre = squareCentre(square, FELT_TOP + TILE_THICKNESS / 2);
    tile.position.copy(centre);
    root.add(tile);
    turned.set(square, { tile, target: 1, shown: 0, centre });
  }

  function textureFor(clue: Clue): CanvasTexture {
    if (clue.kind === 'distance') return faces.numeral(clue.distance);
    if (clue.kind === 'arrow') return faces.arrow(clue.bearing);
    if (clue.kind === 'bomb') return faces.bomb;
    return faces.star;
  }

  function hopInPlace(player: Player, height: number, seconds: number): void {
    hop(player, player.position, player.position, seconds, height);
  }

  function cartoonPuff(centre: Vector3): void {
    const count = options.reducedEffects ? 4 : 11;
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + rng.float(-0.3, 0.3);
      const mesh = new Mesh(puffGeometry, puffWhite);
      const outline = new Mesh(puffGeometry, puffLine);
      outline.scale.setScalar(1.09);
      mesh.add(outline);
      mesh.position
        .copy(centre)
        .add(new Vector3(Math.cos(angle) * 0.6, 0.6 + rng.float(0, 0.6), Math.sin(angle) * 0.6));
      mesh.castShadow = true;
      root.add(mesh);
      puffs.push({
        mesh,
        outline,
        velocity: new Vector3(
          Math.cos(angle) * rng.float(1.6, 3),
          rng.float(1, 2.6),
          Math.sin(angle) * rng.float(1.6, 3),
        ),
        age: 0,
        size: rng.float(0.7, 1.2),
      });
    }
    if (options.reducedEffects) return;
    for (let index = 0; index < 18; index++) {
      const angle = rng.float(0, Math.PI * 2);
      const speed = rng.float(5, 9);
      effects.glow.emit({
        x: centre.x,
        y: centre.y + 0.8,
        z: centre.z,
        vx: Math.cos(angle) * speed,
        vy: rng.float(2, 6),
        vz: Math.sin(angle) * speed,
        life: rng.float(0.25, 0.45),
        size: 0.18,
        colour: new Color(6, 4.4, 1.2),
        alpha: 1,
        alphaEnd: 0,
        drag: 3,
        stretch: 0.04,
      });
    }
    stage.lights.flash(centre.clone().setY(centre.y + 2), '#ffcf8a', 40, 0.4);
  }

  function goldSparkles(centre: Vector3): void {
    for (let index = 0; index < 40; index++) {
      const angle = (index / 40) * Math.PI * 2;
      const speed = rng.float(3, 6);
      effects.glow.emit({
        x: centre.x,
        y: centre.y + 0.4,
        z: centre.z,
        vx: Math.cos(angle) * speed,
        vy: rng.float(3, 7),
        vz: Math.sin(angle) * speed,
        life: rng.float(0.7, 1.3),
        size: rng.float(0.12, 0.22),
        colour: new Color(3.6, 2.5, 0.8),
        alpha: 1,
        alphaEnd: 0,
        drag: 1.8,
        lift: -7,
        stretch: 0.03,
      });
    }
  }

  function raisePennant(centre: Vector3, colour: string): void {
    const group = new Group();
    const brass = own(
      new MeshStandardMaterial({ color: '#d4a53c', metalness: 1, roughness: 0.28 }),
    );
    const pin = new Mesh(new CylinderGeometry(0.08, 0.08, 5, 10), brass);
    pin.position.y = 2.5;
    const ball = new Mesh(new SphereGeometry(0.26, 14, 10), brass);
    ball.position.y = 5.1;
    const cloth = new Mesh(
      pennantGeometry(),
      own(
        new MeshStandardMaterial({
          color: colour,
          roughness: 0.55,
          side: DoubleSide,
          emissive: new Color(colour),
          emissiveIntensity: night ? 0.25 : 0,
        }),
      ),
    );
    cloth.position.set(0.06, 4.4, 0);
    cloth.scale.setScalar(1.45);
    for (const part of [pin, ball, cloth]) {
      owned.geometries.push(part.geometry);
      part.castShadow = true;
      group.add(part);
    }
    group.position.copy(centre).setY(TILE_TOP);
    group.scale.setScalar(0.001);
    root.add(group);
    pennant = { root: group, age: 0 };
  }

  function updateHops(player: Player, dt: number): void {
    const current = player.hops[0];
    if (!current) {
      player.pawn.root.position.copy(player.position);
      return;
    }
    current.age = Math.min(current.seconds, current.age + dt);
    const t = current.age / current.seconds;
    if (current.lifted) {
      // Lifted straight up, carried across, set down: a hand moving a pawn round the edge.
      const rise = Math.sin(Math.PI * t);
      player.position.lerpVectors(current.from, current.to, smootherStep(t));
      player.position.y += rise * current.height;
    } else {
      player.position.lerpVectors(current.from, current.to, t);
      player.position.y += 4 * t * (1 - t) * current.height;
    }
    player.pawn.root.position.copy(player.position);
    player.pawn.root.rotation.y += player.spin * dt;
    if (current.age >= current.seconds) {
      player.hops.shift();
      player.position.copy(current.to);
      player.pawn.land(current.height > 1.5 ? 1 : 0.6);
      if (player.hops.length === 0) {
        player.spin = 0;
        player.pawn.root.rotation.y = 0;
      }
    }
  }

  return {
    root,
    reset() {
      for (const entry of turned.values()) entry.target = 0;
      timeline.length = 0;
      pennant?.root.removeFromParent();
      pennant = null;
      board.setFog(null);
      for (const player of players) {
        player.hops = [];
        player.spin = 0;
        player.pawn.root.rotation.y = 0;
      }
    },
    setPlaying(seats) {
      players.forEach((player, seat) => {
        player.pawn.root.visible = seats.includes(seat === 0 ? 0 : 1);
      });
    },
    placeExplorer(seat, square) {
      const player = players[seat];
      player.square = square;
      player.hops = [];
      player.position.copy(standPoint(square));
      player.pawn.root.position.copy(player.position);
    },
    walk(seat, from, to, seconds) {
      const player = players[seat];
      const start = standPoint(from);
      const end = standPoint(to);
      const move = stepBetween(from, to);
      player.square = to;
      const wraps = end.distanceTo(start) > SQUARE_SIZE * 1.6;
      if (move && wraps) hop(player, start, end, seconds, 3, true);
      else hop(player, start, end, seconds * 0.85, 1.1);
    },
    reveal(seat, square, clue) {
      const player = players[seat];
      hopInPlace(player, 2.2, FLIP_SECONDS + 0.05);
      turnTile(square, textureFor(clue));
    },
    conceal(square) {
      const entry = turned.get(square);
      if (entry) entry.target = 0;
    },
    nudge(seat) {
      const player = players[seat];
      player.pawn.land(0.5);
    },
    blast(seat, square) {
      const player = players[seat];
      turnTile(square, faces.bomb);
      at(FLIP_SECONDS * 0.7, () => {
        cartoonPuff(squareCentre(square, TILE_TOP));
        player.spin = 14;
        hopInPlace(player, 2.5, 0.3);
      });
    },
    sendHome(seat, to) {
      const player = players[seat];
      if (to === null) return;
      // Bounced home the way a hand would sweep a pawn back to its corner.
      player.square = to;
      player.spin = 14;
      hop(player, player.position, standPoint(to), 0.6, 7);
    },
    setFog(possible) {
      board.setFog(possible);
    },
    showFlag(square) {
      turnTile(square, faces.star);
      at(FLIP_SECONDS, () => raisePennant(squareCentre(square, TILE_TOP), '#d3203a'));
    },
    capture(seat, square) {
      const player = players[seat];
      turnTile(square, faces.star);
      const centre = squareCentre(square, TILE_TOP);
      at(FLIP_SECONDS, () => {
        raisePennant(centre, '#d3203a');
        stage.lights.flash(centre.clone().setY(centre.y + 3), '#fff2c8', night ? 14 : 10, 0.9);
        if (options.reducedEffects) return;
        goldSparkles(centre);
        // The whole table jumps for joy: a ripple of tiles hopping outward from the flag.
        for (let other = 0; other < SQUARE_COUNT; other++) {
          const ring = kingDistance(square, other);
          if (ring > 0 && ring <= 3) board.jostle(other, ring * 0.07, 0.75 / ring);
        }
      });
      at(FLIP_SECONDS + 0.15, () => {
        if (!options.reducedEffects) {
          const team = options.seats[seat];
          confetti.burst(
            centre,
            [team.main, team.main, '#ffffff', '#ffd23f', '#d3203a', '#13808f'],
            rng,
          );
        }
        hopInPlace(player, 1.6, 0.4);
        hopInPlace(player, 1.2, 0.34);
      });
      hopInPlace(player, 2.2, FLIP_SECONDS + 0.05);
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
      for (const player of players) {
        updateHops(player, dt);
        player.pawn.update(dt);
      }
      for (const [square, entry] of turned) {
        const step = dt / FLIP_SECONDS;
        entry.shown =
          entry.target > entry.shown
            ? Math.min(1, entry.shown + step)
            : Math.max(0, entry.shown - step);
        const t = entry.shown;
        // Up, over and down with a little settle, hinged about the tile's middle.
        entry.tile.position.copy(entry.centre);
        entry.tile.position.y += Math.sin(Math.PI * t) * 1.6;
        entry.tile.rotation.z = -Math.PI * smootherStep(t);
        if (entry.target === 0 && entry.shown === 0) {
          entry.tile.removeFromParent();
          turned.delete(square);
          board.returnTile(square);
        }
      }
      for (let index = puffs.length - 1; index >= 0; index--) {
        const puff = puffs[index];
        if (!puff) continue;
        puff.age += dt;
        const grow = Math.min(1, puff.age / 0.18);
        const shrink = Math.max(0, 1 - Math.max(0, puff.age - 0.3) / 0.6);
        puff.mesh.scale.setScalar(Math.max(0.001, puff.size * grow * shrink));
        puff.mesh.position.addScaledVector(puff.velocity, dt);
        puff.velocity.multiplyScalar(1 - Math.min(1, dt * 4));
        if (shrink <= 0) {
          puff.mesh.removeFromParent();
          puffs.splice(index, 1);
        }
      }
      if (pennant) {
        pennant.age += dt;
        const t = Math.min(1, pennant.age / 0.5);
        const spring = 1 - Math.pow(1 - t, 3) * Math.cos(t * 9);
        pennant.root.scale.setScalar(Math.max(0.001, spring * 1.25));
        pennant.root.rotation.y = Math.sin(clock * 3) * 0.08;
      }
      board.update(dt);
      confetti.update(dt);
      effects.update(dt, stage.camera);
    },
    flush() {
      // The tabletop keeps no ground paint: nothing marks a felt game.
    },
    dispose() {
      for (const player of players) player.pawn.dispose();
      for (const geometry of owned.geometries) geometry.dispose();
      for (const material of owned.materials) material.dispose();
      confetti.dispose();
      effects.dispose();
      board.dispose();
      faces.dispose();
      root.removeFromParent();
    },
  };
}

function smootherStep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** A swallow-tailed pennant flying from the pin towards +x. */
function pennantGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertices = [
    0, 0.45, 0, 1.5, 0.3, 0, 1.05, 0, 0, 0, 0.45, 0, 1.05, 0, 0, 0, -0.45, 0, 0, -0.45, 0, 1.05, 0,
    0, 1.5, -0.3, 0,
  ];
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
