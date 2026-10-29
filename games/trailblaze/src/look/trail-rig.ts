/**
 * What every look does the same way: riders ride, and the trail grows behind
 * them. A look supplies the art (its trail pieces, its two riders, its world
 * and its moments), and this rig turns the match's steps into poses and
 * pieces.
 *
 * Riders cross each cell along a smooth curve from the edge they came in by
 * to the edge they leave by (crossing.ts), so a turn is a curve, the way a
 * bike leans through a bend or a walker rounds a corner. The engine moves a
 * rider to its next cell at the instant of a step; on screen the rider
 * crosses the cell it has just left during the step that follows, so the
 * picture runs a little behind the rules and every move is smooth. The cell
 * being crossed is drawn as a growing tail up to the rider, and becomes
 * trail when the rider leaves it.
 */
import { Group, Vector3 } from 'three';
import {
  TICKS_PER_SECOND,
  type Cell,
  type Crash,
  type Heading,
  type Laid,
  type Move,
  type Seat,
} from '../engine/types.ts';
import { headingStep, wrapOntoBoard } from './board-space.ts';
import {
  crossingPoint,
  crossingTangent,
  entryPoint,
  exitPoint,
  type Crossing,
} from './crossing.ts';
import type { TrailView, ViewOptions } from './look.ts';
import { createRemixPieces, type RemixStyle } from './remix-pieces.ts';

export interface TrailPieces {
  /** A whole cell crossed: the trail across it, from where the rider came in to where it left. */
  addCell(seat: Seat, crossing: Crossing, laidAt: number): void;
  removeCell(cell: Cell): void;
  /** The cell the rider is crossing now, drawn up to `progress` (0 to 1); null hides it. */
  setTail(seat: Seat, crossing: Crossing | null, progress: number): void;
  clear(): void;
  /** Animates laid pieces; pieces that never change leave it out. */
  update?(dt: number, clock: number): void;
  dispose(): void;
}

export interface RiderFigure {
  readonly root: Group;
  /** Every frame while it rides: where it is, the way it faces, and how far into the speed-up. */
  ride(position: Vector3, yaw: number, dt: number, speedStage: number): void;
  /** The look's crash, played on the figure where it stopped. */
  crash(crash: Crash, direction: Vector3): void;
  /** Back to a fresh figure for a new round. */
  reset(): void;
  /** Runs the figure's own animations (a crash playing out); figures without any leave it out. */
  update?(dt: number): void;
  dispose(): void;
}

export interface LookParts {
  /** The world: floor, border, surroundings and the look's own effects. */
  readonly root: Group;
  readonly pieces: TrailPieces;
  /** One figure per seat in the view's colours, in seat order. */
  readonly riders: readonly RiderFigure[];
  /** The colours the Remix walls and lanes take in this look. */
  readonly remixStyle: RemixStyle;
  reset(edges: 'bordered' | 'wraparound'): void;
  /** The moment around the figure: sparks, steam, linen or frost, a flash, a shake. */
  crash(crash: Crash, at: Vector3, direction: Vector3): void;
  trap(seat: Seat, pocket: readonly Cell[], seal: Cell): void;
  /** World effects of the speed-up; looks whose world does not change with speed leave it out. */
  setSpeedStage?(stage: number): void;
  update(dt: number, clock: number): void;
  dispose(): void;
}

/** How far past the cell's edge a crashing rider gets: up to the face of what it hit. */
const CRASH_OVERSHOOT = 0.3;

interface Ride {
  readonly crossing: Crossing;
  /** False while a gap is held open: the rider crosses, but lays nothing. */
  readonly laid: boolean;
  readonly seconds: number;
  progress: number;
  /** Where the ride stops: 1 at the far edge, a little beyond when the rider crashes. */
  reach: number;
}

interface RiderState {
  readonly figure: RiderFigure;
  readonly position: Vector3;
  yaw: number;
  ride: Ride | null;
  /** The heading the rider arrived on, for the next crossing when no trail says it. */
  heading: Heading;
  /** A crash the rules have called, played when the rider reaches what it hit. */
  pendingCrash: Crash | null;
  crashed: boolean;
}

export function createTrailView(options: ViewOptions, parts: LookParts): TrailView {
  const root = new Group();
  root.name = 'trail-view';
  root.add(parts.root);
  const remix = createRemixPieces(parts.remixStyle);
  root.add(remix.root);
  let clock = 0;
  let speedStage = 0;
  let frozen = false;
  /** Ghost Trails: seconds a trail stays in sight, and when each cell in sight was drawn. */
  let ghostSeconds: number | null = null;
  const inSight = new Map<Cell, number>();

  function drawCell(seat: Seat, crossing: Crossing): void {
    parts.pieces.removeCell(crossing.cell);
    parts.pieces.addCell(seat, crossing, clock);
    inSight.set(crossing.cell, clock);
  }

  function eraseCell(cell: Cell): void {
    parts.pieces.removeCell(cell);
    inSight.delete(cell);
  }

  /** Ghost Trails: trail older than the limit leaves the picture but stays solid in the rules. */
  function hideGhosts(): void {
    if (ghostSeconds === null) return;
    for (const [cell, drawnAt] of inSight) {
      if (clock - drawnAt < ghostSeconds) continue;
      parts.pieces.removeCell(cell);
      inSight.delete(cell);
    }
  }
  const riders = parts.riders.map((figure, seat): RiderState => {
    figure.root.visible = seat < options.players;
    root.add(figure.root);
    return {
      figure,
      position: new Vector3(),
      yaw: 0,
      ride: null,
      heading: 'right',
      pendingCrash: null,
      crashed: false,
    };
  });
  const riderOf = (seat: Seat): RiderState => {
    const rider = riders[seat];
    if (!rider) throw new Error(`no rider for seat ${seat}`);
    return rider;
  };
  const tangent = new Vector3();

  /** The rider leaves the cell it was crossing; a laid cell becomes trail. */
  function finishRide(seat: Seat, rider: RiderState): void {
    const ride = rider.ride;
    if (ride?.laid) drawCell(seat, ride.crossing);
    rider.ride = null;
    parts.pieces.setTail(seat, null, 0);
  }

  function startRide(seat: Seat, move: Move, laid: Laid | undefined, seconds: number): void {
    const rider = riderOf(seat);
    finishRide(seat, rider);
    const crossing: Crossing = laid
      ? { cell: laid.cell, entered: laid.entered, left: laid.left }
      : { cell: move.from, entered: rider.heading, left: move.heading };
    rider.ride = {
      crossing,
      laid: laid !== undefined,
      seconds: Math.max(seconds, 1e-3),
      progress: 0,
      reach: 1,
    };
    rider.heading = move.heading;
  }

  /** Where a ride puts the rider at its progress, running on past the far edge into a crash. */
  function placeOnRide(ride: Ride, target: Vector3): void {
    if (ride.progress <= 1) {
      crossingPoint(ride.crossing, ride.progress, target);
      crossingTangent(ride.crossing, Math.min(ride.progress, 0.999), tangent);
      return;
    }
    exitPoint(ride.crossing.cell, ride.crossing.left, target);
    headingStep(ride.crossing.left, tangent).normalize();
    target.addScaledVector(tangent, ride.progress - 1);
  }

  function updateRider(seat: Seat, rider: RiderState, dt: number): void {
    const ride = rider.ride;
    if (ride && !frozen && !rider.crashed) {
      ride.progress = Math.min(ride.reach, ride.progress + dt / ride.seconds);
      placeOnRide(ride, rider.position);
      wrapOntoBoard(rider.position);
      if (tangent.lengthSq() > 1e-6) rider.yaw = Math.atan2(-tangent.z, tangent.x);
      parts.pieces.setTail(seat, ride.laid ? ride.crossing : null, Math.min(1, ride.progress));
    }
    if (!rider.crashed) rider.figure.ride(rider.position, rider.yaw, frozen ? 0 : dt, speedStage);
    if (rider.pendingCrash && (!ride || ride.progress >= ride.reach)) {
      playCrash(seat, rider, rider.pendingCrash);
    }
    rider.figure.update?.(frozen ? 0 : dt);
  }

  function playCrash(seat: Seat, rider: RiderState, crash: Crash): void {
    rider.pendingCrash = null;
    rider.crashed = true;
    const direction = headingStep(rider.ride?.crossing.left ?? rider.heading).normalize();
    finishRide(seat, rider);
    rider.figure.crash(crash, direction);
    parts.crash(crash, rider.position.clone(), direction);
  }

  return {
    root,
    reset(edges) {
      parts.pieces.clear();
      inSight.clear();
      remix.reset();
      parts.reset(edges);
      riders.forEach((rider, seat) => {
        rider.ride = null;
        rider.pendingCrash = null;
        rider.crashed = false;
        rider.figure.reset();
        parts.pieces.setTail(seat as Seat, null, 0);
      });
      speedStage = 0;
      frozen = false;
      parts.setSpeedStage?.(0);
    },
    placeRider(seat, cell, heading) {
      const rider = riderOf(seat);
      entryPoint(cell, heading, rider.position);
      headingStep(heading, tangent);
      rider.yaw = Math.atan2(-tangent.z, tangent.x);
      rider.heading = heading;
      rider.ride = null;
      rider.figure.ride(rider.position, rider.yaw, 0, speedStage);
    },
    step(laid, erased, moves, seconds) {
      for (const cell of erased) eraseCell(cell);
      const laidBySeat = new Map(laid.map((entry) => [entry.seat, entry]));
      const moving = new Set(moves.map((move) => move.seat));
      // A doodle cursor standing still writes its cell again; it is redrawn at once.
      for (const entry of laid) {
        if (moving.has(entry.seat)) continue;
        drawCell(entry.seat, entry);
      }
      for (const move of moves) startRide(move.seat, move, laidBySeat.get(move.seat), seconds);
    },
    setSpeedStage(stage) {
      speedStage = stage;
      parts.setSpeedStage?.(stage);
    },
    crash(crash) {
      const rider = riderOf(crash.seat);
      if (rider.ride) rider.ride.reach = 1 + CRASH_OVERSHOOT;
      rider.pendingCrash = crash;
    },
    trap(seat, pocket, seal) {
      parts.trap(seat, pocket, seal);
    },
    setRemix(rules) {
      ghostSeconds = rules?.ghostAfter === undefined ? null : rules.ghostAfter / TICKS_PER_SECOND;
      remix.showLanes(rules?.boostLanes ?? []);
    },
    riderPosition(seat, target) {
      return target.copy(riderOf(seat).position);
    },
    shrink(cells) {
      for (const cell of cells) eraseCell(cell);
      remix.raiseWalls(cells);
    },
    freeze() {
      frozen = true;
    },
    update(dt) {
      clock += dt;
      riders.forEach((rider, seat) => updateRider(seat as Seat, rider, dt));
      hideGhosts();
      parts.pieces.update?.(frozen ? 0 : dt, clock);
      parts.update(frozen ? 0 : dt, clock);
      remix.update(frozen ? 0 : dt, clock);
    },
    dispose() {
      remix.dispose();
      parts.dispose();
      for (const rider of riders) rider.figure.dispose();
    },
  };
}
