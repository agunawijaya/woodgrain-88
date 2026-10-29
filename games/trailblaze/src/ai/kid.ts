/**
 * A Neighbourhood Kid as a Trailblaze rider.
 *
 * The Kid sees the board through human perception (perception.ts) and drives
 * its joystick through the kit's human reflexes (kids/reflex.ts). It takes
 * time to react, reads only so far ahead, misses the rival's turns, panics
 * under speed and tight spots, and slips now and then.
 */
import {
  createKidReflex,
  createRng,
  memoryProfile,
  reflexProfile,
  type KidId,
  type KidReflex,
  type MemoryMode,
  type Pressure,
  type ReflexProfile,
  type Rng,
  type Seed,
} from '@woodgrain-88/kit';
import { FOUR_WAY_START, START, startOf, stepFrom } from '../engine/grid.ts';
import { HEADINGS, vectorOf } from '../engine/headings.ts';
import {
  CELL_COUNT,
  EMPTY,
  FOUR_WAY_SEATS,
  IDLE,
  SEATS,
  TICKS_PER_SECOND,
  type Cell,
  type Heading,
  type Match,
  type MatchEvent,
  type Seat,
  type Stick,
} from '../engine/types.ts';
import {
  believedSpace,
  chebyshevDistance,
  perceive,
  rayLength,
  type Perception,
} from './perception.ts';
import { createGhostMemory, type GhostMemory } from './ghost-memory.ts';

export interface KidRiderOptions {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly mode: MemoryMode;
  readonly seed: Seed;
  /** A profile other than the Kid's own, for simulations and tuning. */
  readonly profile?: ReflexProfile;
}

export interface KidRider {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly reflex: KidReflex<Heading>;
  readonly ghostMemory?: GhostMemory | null;
  readonly perceptionMask?: Uint8Array;
  /** Everything the match said this tick: the Kid takes in what a player would see. */
  hear(events: readonly MatchEvent[], match: Readonly<Match>): void;
  /** What the Kid holds on its stick this tick. */
  stick(match: Readonly<Match>): Stick;
}

/**
 * A person rides straight until there is a reason to turn: the course they are on gets this much
 * extra, enough to outweigh a whim when every way looks as open as the next.
 */
const KEEP_GOING = 0.15;
/** How far a passing whim can tip a choice either way. */
const WHIM = 0.03;
/**
 * What riding at a wall closer than one reaction away costs a course. A person wants at least that
 * much open road ahead, and a careful one wants more: at speed a slow, careful Kid keeps turning
 * away and gives up room, while a quick one can ride close.
 */
const DANGER = 1;
/** How many cells ahead of the other bike a Kid aims to cut across. */
const CUT_LEAD = 3;
/** A candidate's score when its next cell is believed blocked. */
const CERTAIN_CRASH = -1000;

const HEADINGS_COMPASS: readonly Heading[] = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
];

/**
 * Returns candidate headings at most 90° away from `current`. Reversals are never
 * candidates, and under 4-way steering only cardinal directions are considered.
 */
export function candidateHeadings(current: Heading, steering: 4 | 8): readonly Heading[] {
  if (steering === 4) {
    switch (current) {
      case 'up':
        return ['up', 'left', 'right'];
      case 'down':
        return ['down', 'right', 'left'];
      case 'left':
        return ['left', 'down', 'up'];
      case 'right':
        return ['right', 'up', 'down'];
      default:
        return ['up', 'down', 'left', 'right'];
    }
  }

  const idx = HEADINGS_COMPASS.indexOf(current);
  if (idx === -1) {
    return ['up', 'down', 'left', 'right'];
  }

  return [
    current,
    HEADINGS_COMPASS[(idx + 7) % 8] as Heading, // 45° CCW (left)
    HEADINGS_COMPASS[(idx + 6) % 8] as Heading, // 90° CCW (left)
    HEADINGS_COMPASS[(idx + 1) % 8] as Heading, // 45° CW (right)
    HEADINGS_COMPASS[(idx + 2) % 8] as Heading, // 90° CW (right)
  ];
}

/**
 * Determines whether turning from `from` to `to` is a left (counter-clockwise) or
 * right (clockwise) turn relative to the rider's heading.
 */
function turnDirection(from: Heading, to: Heading): 'straight' | 'left' | 'right' {
  if (from === to) return 'straight';
  const fromIdx = HEADINGS_COMPASS.indexOf(from);
  const toIdx = HEADINGS_COMPASS.indexOf(to);
  const diff = (toIdx - fromIdx + 8) % 8;
  if (diff > 0 && diff < 4) return 'right';
  if (diff > 4 && diff < 8) return 'left';
  return 'straight';
}

export function createKidRider(options: KidRiderOptions): KidRider {
  const { kid, seat } = options;
  const profile = options.profile ?? reflexProfile(kid, options.mode);
  const rng = createRng(options.seed);
  const reflexRng = rng.fork('reflex');
  const reflex = createKidReflex<Heading>(profile, reflexRng);

  let ghostMemory: GhostMemory | null = null;
  let ghostRng: Rng | null = null;

  function ensureGhostMemory(match: Readonly<Match>): GhostMemory | null {
    if (match.setup.rules.remix?.ghostAfter === undefined) {
      return null;
    }
    if (ghostMemory === null) {
      ghostRng = rng.fork('ghost');
      ghostMemory = createGhostMemory(memoryProfile(kid, options.mode), seat);
    }
    return ghostMemory;
  }

  const believedHeadings: Record<Seat, Heading> = {
    0: START[0].heading,
    1: START[1].heading,
    2: FOUR_WAY_START[2].heading,
    3: FOUR_WAY_START[3].heading,
  };
  let lastNoticedRivalTurn: { direction: 'left' | 'right'; step: number } | null = null;

  // Pre-allocated buffers kept per Kid to avoid GC pressure during live matches.
  const perceptionMask = new Uint8Array(CELL_COUNT);
  const queue = new Int32Array(CELL_COUNT);
  const visitedAt = new Int32Array(CELL_COUNT);

  const currentPerception: Perception = {
    blocked(cell: Cell): boolean {
      return perceptionMask[cell] === 1;
    },
  };

  function resetBelievedHeadings(match: Readonly<Match>): void {
    const seats = match.setup.players === 4 ? FOUR_WAY_SEATS : SEATS;
    for (const s of seats) {
      believedHeadings[s] = startOf(match.setup, s).heading;
    }
  }

  function findNearestRival(match: Readonly<Match>, head: Cell): Seat | null {
    if (match.setup.players === 1) return null;
    const wraparound = match.setup.rules.edges === 'wraparound';
    const opponentSeats: readonly Seat[] = match.setup.players === 4 ? FOUR_WAY_SEATS : SEATS;
    let bestSeat: Seat | null = null;
    let bestDist = Infinity;

    for (const s of opponentSeats) {
      if (s === seat) continue;
      const opponent = match.riders[s];
      if (!opponent || opponent.crashed) continue;
      const dist = chebyshevDistance(head, opponent.cell, wraparound);
      if (dist < bestDist) {
        bestDist = dist;
        bestSeat = s;
      }
    }
    return bestSeat;
  }

  function currentPressure(match: Readonly<Match>): Pressure {
    const speed = Math.max(0, Math.min(1, (15 - match.stepPeriod) / 12));
    const rider = match.riders[seat];
    const head = rider ? rider.cell : 0;
    const space = believedSpace(match, currentPerception, head, 60, queue, visitedAt);
    const cramp = Math.max(0, Math.min(1, 1 - Math.min(1, space / 60)));
    return { speed, cramp };
  }

  /**
   * Nobody rides into another bike or across its nose: its head is trail the moment it moves on,
   * and the cells it will cover while the Kid's own hands react are as good as trail already.
   */
  function keepClearOfRival(
    match: Readonly<Match>,
    head: Cell,
    awareness: number,
    pressure: Pressure,
  ): void {
    if (match.setup.players === 1) return;
    const wraparound = match.setup.rules.edges === 'wraparound';
    const opponentSeats: readonly Seat[] = match.setup.players === 4 ? FOUR_WAY_SEATS : SEATS;

    for (const s of opponentSeats) {
      if (s === seat) continue;
      const opponent = match.riders[s];
      if (!opponent || opponent.crashed) continue;
      if (chebyshevDistance(head, opponent.cell, wraparound) > awareness) continue;

      perceptionMask[opponent.cell] = 1;
      const reactionCells = Math.ceil(reflex.expectedDelay(pressure) / (match.stepPeriod * 20));
      let cell = opponent.cell;
      const oppHeading = believedHeadings[s];
      for (let step = 0; step < reactionCells; step++) {
        const ahead = stepFrom(cell, oppHeading);
        if (ahead.wrapped && !wraparound) break;
        cell = ahead.cell;
        perceptionMask[cell] = 1;
      }
    }
  }

  /**
   * Whether the first thing in the Kid's way is new: the other bike, or trail the rival laid
   * within the Kid's own reaction time. A wall it has been riding towards is foreseen, and its
   * hands only have to time the turn; something that has just appeared needs a full reaction.
   */
  function threatIsNew(
    match: Readonly<Match>,
    head: Cell,
    heading: Heading,
    reach: number,
    rivalSeat: Seat | null,
  ): boolean {
    const wraparound = match.setup.rules.edges === 'wraparound';
    const fresh = profile.reactionMs.mean / 20;
    let cell = head;
    for (let step = 0; step < reach; step++) {
      const next = stepFrom(cell, heading);
      if (next.wrapped && !wraparound) return false;
      cell = next.cell;
      if (!currentPerception.blocked(cell)) continue;
      if (match.cells[cell] === EMPTY) return true;
      return (
        rivalSeat !== null &&
        match.cells[cell] === rivalSeat &&
        match.tick - (match.laidAt[cell] ?? 0) <= fresh
      );
    }
    return false;
  }

  /**
   * Where the turn the Kid decides now will actually happen. The hands take the delay the Kid
   * expects, and every step that passes meanwhile carries it on along its heading, so a Kid plans
   * for the cell it will be in, as a person learns to steer ahead of their own lag. If the way on
   * is blocked before then, it can only turn from where it is.
   */
  function turningCell(
    match: Readonly<Match>,
    head: Cell,
    heading: Heading,
    delayMs: number,
  ): Cell {
    const stepsMeanwhile = Math.floor(delayMs / (match.stepPeriod * 20));
    let cell = head;
    for (let step = 0; step < stepsMeanwhile; step++) {
      const next = stepFrom(cell, heading);
      const offArena = next.wrapped && match.setup.rules.edges !== 'wraparound';
      if (offArena || currentPerception.blocked(next.cell)) break;
      cell = next.cell;
    }
    return cell;
  }

  /** Where the Kid aims to cross the rival's path: a few cells ahead of the other bike. */
  function cutAcross(match: Readonly<Match>, rivalSeat: Seat): Cell {
    const rival = match.riders[rivalSeat];
    let cell = rival ? rival.cell : 0;
    const oppHeading = believedHeadings[rivalSeat];
    for (let step = 0; step < CUT_LEAD; step++) {
      cell = stepFrom(cell, oppHeading).cell;
    }
    return cell;
  }

  /**
   * The cells the Kid rides through before its turn are trail by the time it has turned, its head
   * included; without them, space would seem to leak out of a dead end the way the Kid came in.
   */
  function markOwnPath(head: Cell, origin: Cell, heading: Heading): void {
    let cell = head;
    perceptionMask[cell] = 1;
    while (cell !== origin) {
      cell = stepFrom(cell, heading).cell;
      perceptionMask[cell] = 1;
    }
  }

  /**
   * Whether turning onto `turn` is safe wherever between `from` and `to` the hands happen to land:
   * a person who cannot be sure of their timing does not aim for a one-cell gap.
   */
  function openAllAlong(
    match: Readonly<Match>,
    from: Cell,
    to: Cell,
    heading: Heading,
    turn: Heading,
  ): boolean {
    const wraparound = match.setup.rules.edges === 'wraparound';
    let cell = from;
    for (;;) {
      const side = stepFrom(cell, turn);
      if ((side.wrapped && !wraparound) || currentPerception.blocked(side.cell)) return false;
      if (cell === to) return true;
      cell = stepFrom(cell, heading).cell;
    }
  }

  function decideAction(match: Readonly<Match>): void {
    if (match.phase === 'crash' || match.phase === 'over') {
      return;
    }

    const headRider = match.riders[seat];
    if (!headRider) return;

    const now = match.tick * 20;
    const pressure = currentPressure(match);
    const { awareness, lookahead: reach } = profile;
    const head = headRider.cell;
    const currentHeading = headRider.heading;

    perceive(match, head, awareness, perceptionMask);

    const ghostAfter = match.setup.rules.remix?.ghostAfter;
    if (ghostAfter !== undefined) {
      const ghost = ensureGhostMemory(match);
      if (ghost !== null && ghostRng !== null) {
        // Trail laid longer ago than the rule allows is out of sight; only memory brings it back.
        for (let cell = 0; cell < CELL_COUNT; cell++) {
          const laidAt = match.laidAt[cell] ?? -1;
          const isTrail = (match.cells[cell] ?? EMPTY) >= 0;
          if (perceptionMask[cell] === 1 && isTrail && laidAt >= 0) {
            if (match.tick - laidAt >= ghostAfter) perceptionMask[cell] = 0;
          }
        }
        const nowSeconds = match.tick / TICKS_PER_SECOND;
        ghost.recallInto(perceptionMask, match, nowSeconds, ghostRng);
      }
    }

    keepClearOfRival(match, head, awareness, pressure);

    const rivalSeat = findNearestRival(match, head);
    const foreseen = !threatIsNew(match, head, currentHeading, reach, rivalSeat);
    const delay = reflex.expectedDelay(pressure, foreseen);
    const origin = turningCell(match, head, currentHeading, delay);
    const unsure = (profile.reactionMs.spread * delay) / profile.reactionMs.mean;
    const earliest = turningCell(match, head, currentHeading, delay - unsure);
    const latest = turningCell(match, head, currentHeading, delay + unsure);
    markOwnPath(head, origin, currentHeading);
    const roadNeeded =
      (reflex.expectedDelay(pressure) * (1 + profile.style.safety)) / (match.stepPeriod * 20);
    const cutPoint = rivalSeat !== null ? cutAcross(match, rivalSeat) : null;
    const candidates = candidateHeadings(currentHeading, match.setup.rules.steering);
    const open: Heading[] = [];
    let bestCandidate: Heading = currentHeading;
    let bestScore = -Infinity;

    for (const h of candidates) {
      const step = stepFrom(origin, h);
      const offArena = step.wrapped && match.setup.rules.edges !== 'wraparound';
      const n = step.cell;

      if (offArena || currentPerception.blocked(n)) {
        if (CERTAIN_CRASH > bestScore) {
          bestScore = CERTAIN_CRASH;
          bestCandidate = h;
        }
        continue;
      }
      open.push(h);
      const risky =
        h !== currentHeading && !openAllAlong(match, earliest, latest, currentHeading, h);

      const runLength = rayLength(match, currentPerception, n, h, reach);
      const run = reach > 0 ? runLength / reach : 0;
      const road = 1 + rayLength(match, currentPerception, n, h, Math.ceil(roadNeeded));
      const danger = Math.max(0, 1 - road / roadNeeded);

      const spaceLimit = 6 * awareness * awareness;
      const spaceCount = believedSpace(match, currentPerception, n, spaceLimit, queue, visitedAt);
      const space = spaceLimit > 0 ? spaceCount / spaceLimit : 0;

      let blockedNeighbours = 0;
      for (const dir of HEADINGS) {
        const nStep = stepFrom(n, dir);
        if (nStep.wrapped && match.setup.rules.edges !== 'wraparound') {
          blockedNeighbours += 1;
        } else if (currentPerception.blocked(nStep.cell)) {
          blockedNeighbours += 1;
        }
      }
      const safety = 1 - blockedNeighbours / 8;

      let cutOff = 0;
      if (cutPoint !== null) {
        const wraparound = match.setup.rules.edges === 'wraparound';
        const d0 = chebyshevDistance(origin, cutPoint, wraparound);
        const d1 = chebyshevDistance(n, cutPoint, wraparound);
        cutOff = Math.max(-1, Math.min(1, d0 - d1));
      }

      let mirror = 0;
      if (lastNoticedRivalTurn !== null && match.steps - lastNoticedRivalTurn.step <= 2) {
        const turn = turnDirection(currentHeading, h);
        if (turn !== 'straight' && turn === lastNoticedRivalTurn.direction) {
          mirror = 1;
        }
      }

      const noise = rng.float(-WHIM, WHIM);
      let score =
        profile.style.space * space +
        (profile.style.safety * (safety + run)) / 2 +
        profile.style.cutOff * cutOff +
        profile.style.mirror * mirror -
        DANGER * (risky ? 1 : danger) +
        noise;

      if (h === currentHeading) score += KEEP_GOING;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = h;
      }
    }

    if (bestCandidate !== reflex.planned()) {
      const others = open.filter((c) => c !== bestCandidate);
      reflex.decide(bestCandidate, now, pressure, others, foreseen);
    }
  }

  return {
    kid,
    seat,
    reflex,
    get ghostMemory(): GhostMemory | null {
      return ghostMemory;
    },
    perceptionMask,
    hear(events: readonly MatchEvent[], match: Readonly<Match>): void {
      const ghost = ensureGhostMemory(match);
      for (const event of events) {
        if (event.type === 'round') {
          reflex.reset();
          resetBelievedHeadings(match);
          lastNoticedRivalTurn = null;
          ghost?.reset();
          decideAction(match);
        } else if (event.type === 'turn') {
          if (event.seat !== seat) {
            const now = match.tick * 20;
            const pressure = currentPressure(match);
            const noticed = reflex.notices(now, pressure);
            if (noticed) {
              believedHeadings[event.seat] = event.to;
              const head = match.riders[seat]?.cell ?? 0;
              const currentRival = findNearestRival(match, head);
              if (event.seat === currentRival) {
                const dir = turnDirection(event.from, event.to);
                if (dir !== 'straight') {
                  lastNoticedRivalTurn = { direction: dir, step: match.steps };
                }
              }
              decideAction(match);
            }
          }
        } else if (event.type === 'step') {
          if (ghost !== null && ghostRng !== null) {
            const nowSeconds = match.tick / TICKS_PER_SECOND;
            ghost.hear(event.laid, match, nowSeconds, ghostRng);
          }
          decideAction(match);
        }
      }
    },
    stick(match: Readonly<Match>): Stick {
      const now = match.tick * 20;
      const action = reflex.act(now);
      if (action === null) {
        return IDLE;
      }
      const vec = vectorOf(action);
      return { east: vec.east, south: vec.south, fire: false };
    },
  };
}
