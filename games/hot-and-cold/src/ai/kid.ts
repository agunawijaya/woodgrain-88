/**
 * A Neighbourhood Kid playing Hot & Cold from a seat, by the same rules and
 * at the same pace as a person: it holds directions and the reveal button,
 * one tick at a time, and only knows what a player could know.
 *
 * - Its own checks it always sees. The rival's it sees on the field in
 *   Notebook; in Classic Memory only if it was watching (the memory model's
 *   attention) while the rival held the button.
 * - In Classic Memory, everything it knows goes through its human memory: it
 *   fades, gets pushed out, sometimes comes back wrong. In Notebook every
 *   clue stays on the field, so instead it takes in only as many as it can
 *   hold in mind (its reading budget).
 * - It decides with the shared solver and its own hunting style, thinks for a
 *   moment before setting off, walks (Lou with a pause between steps), holds
 *   a check long enough to read it, and lets go.
 */
import {
  createKidMemory,
  createRng,
  memoryProfile,
  salienceOf,
  type KidId,
  type KidMemory,
  type MemoryMode,
  type Rng,
  type Seed,
} from '@woodgrain-88/kit';
import type { SquareKind } from '../engine/board.ts';
import type { Square } from '../engine/grid.ts';
import {
  IDLE,
  type Check,
  type Match,
  type MatchEvent,
  type Seat,
  type SeatInput,
} from '../engine/match.ts';
import { TICK_SECONDS } from '../engine/rules.ts';
import { believe, type Fact } from '../engine/solver.ts';
import { FACT_ADAPTER, isStriking } from './facts.ts';
import { nextMove } from './path.ts';
import { chooseTarget } from './plan.ts';
import { HUNT_STYLES, type HuntStyle } from './styles.ts';

/** Notebook keeps every clue on the field; Classic Memory shows one only while reveal is held. */
export type ClueMode = 'notebook' | 'classic';

export interface KidPlayerOptions {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly memory: MemoryMode;
  readonly clues: ClueMode;
  readonly seed: Seed;
  /** A hunting style other than the Kid's own (the simulations' perfect solver). */
  readonly style?: HuntStyle;
  /** Notebook clues melt off the field after this long (Thin Ice); the Kid reads only what is left. */
  readonly clueFadeSeconds?: number;
}

export interface KidPlayer {
  readonly kid: KidId;
  readonly seat: Seat;
  readonly memory: KidMemory<Fact>;
  /** Everything the match said this tick; the Kid takes in what a player would see. */
  hear(events: readonly MatchEvent[], match: Match): void;
  /** What the Kid holds this tick. */
  input(match: Match): SeatInput;
}

type Phase =
  | { readonly name: 'waiting' }
  | { readonly name: 'thinking'; readonly until: number }
  | { readonly name: 'walking'; readonly target: Square; pauseUntil: number; since: number }
  | { readonly name: 'checking'; readUntil: number | null };

const WAITING: Phase = { name: 'waiting' };
/** A walk that has not arrived in this long is rethought (the rival blocked the way, say). */
const STUCK_SECONDS = 3;

export function createKidPlayer(options: KidPlayerOptions): KidPlayer {
  const { kid, seat, clues } = options;
  const style = options.style ?? HUNT_STYLES[kid];
  const profile = memoryProfile(kid, options.memory);
  const memory = createKidMemory(profile, FACT_ADAPTER);
  const rng: Rng = createRng(options.seed);
  const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
  let phase: Phase = WAITING;
  let knownMoves = 0;
  let rivalLastCheck: Square | null = null;
  const seenAt = new Map<Check, number>();

  const now = (match: Match) => match.tick * TICK_SECONDS;

  function think(match: Match, extraSeconds = 0): void {
    phase = { name: 'thinking', until: match.tick + ticks(style.think + extraSeconds) };
  }

  function movesAfter(check: Check, match: Match): number {
    return check.flagMoves + (check.clue.kind === 'flag' ? 0 : match.rules.flagSteps);
  }

  function hearCheck(check: Check, match: Match): void {
    seenAt.set(check, match.tick);
    const fact: Fact = { square: check.square, clue: check.clue, flagMoves: check.flagMoves };
    const striking = isStriking(check.clue);
    if (check.seat === seat) {
      knownMoves = movesAfter(check, match);
      if (clues === 'classic')
        memory.observe(fact, salienceOf(profile, 'own', striking), now(match));
      if (phase.name === 'checking') phase.readUntil = match.tick + ticks(style.read);
      return;
    }
    rivalLastCheck = check.square;
    if (clues === 'notebook') {
      knownMoves = match.flagMoves;
    } else {
      const seen = memory.witness(fact, salienceOf(profile, 'theirs', striking), now(match), rng);
      if (seen) knownMoves = Math.max(knownMoves, movesAfter(check, match));
    }
    // New information in a race: rethink rather than walk on to a square that may be stale.
    if (phase.name === 'walking' && match.rules.style === 'race') think(match, -style.think / 2);
  }

  /** In Notebook, the clues on the field this Kid takes in: its own first, newest first. */
  function readField(match: Match): Fact[] {
    const fade = options.clueFadeSeconds;
    const onField = (check: Check) =>
      fade === undefined || match.tick - (seenAt.get(check) ?? match.tick) <= ticks(fade);
    const ordered = match.checks.filter(onField).reverse();
    const mine = ordered.filter((check) => check.seat === seat);
    const theirs = ordered.filter((check) => check.seat !== seat);
    const preferTheirs = style.contest >= 0.8;
    const reading = preferTheirs ? [...theirs, ...mine] : [...mine, ...theirs];
    return reading.slice(0, profile.capacity).map((check) => ({
      square: check.square,
      clue: check.clue,
      flagMoves: check.flagMoves,
    }));
  }

  function plan(match: Match): void {
    const facts = clues === 'classic' ? memory.recall(now(match), rng) : readField(match);
    const belief = believe(match.rules.motion, facts, knownMoves);
    const knownKinds = new Map<Square, SquareKind>();
    const settled = new Set<Square>();
    for (const fact of facts) {
      if (fact.clue.kind !== 'flag') knownKinds.set(fact.square, fact.clue.kind);
      if (match.rules.motion === 'still') settled.add(fact.square);
    }
    const rival = match.seats[seat === 0 ? 1 : 0];
    const target = chooseTarget({
      belief,
      here: match.seats[seat].square,
      rival: rival.playing ? rival.square : null,
      rivalLastCheck,
      knownKinds,
      settled,
      style,
      play: match.rules.style,
      rng,
    });
    phase = { name: 'walking', target, pauseUntil: 0, since: match.tick };
  }

  return {
    kid,
    seat,
    memory,
    hear(events, match) {
      for (const event of events) {
        if (event.type === 'round') {
          memory.forgetAll();
          seenAt.clear();
          knownMoves = 0;
          rivalLastCheck = null;
          phase = WAITING;
          if (event.playing.includes(seat) && match.rules.style !== 'turns') think(match);
        } else if (event.type === 'turn') {
          if (event.seat === seat) think(match);
          else phase = WAITING;
        } else if (event.type === 'check') {
          hearCheck(event.check, match);
        } else if (event.type === 'step' && event.seat === seat) {
          if (phase.name === 'walking') {
            phase.pauseUntil = match.tick + ticks(style.stepPause);
            const there = event.to === phase.target;
            if (!there && style.checkOnTheWay > 0 && rng.chance(style.checkOnTheWay)) {
              phase = { name: 'checking', readUntil: null };
            }
          }
        } else if ((event.type === 'release' || event.type === 'home') && event.seat === seat) {
          if (match.rules.style !== 'turns') think(match);
        } else if (event.type === 'capture' || event.type === 'over') {
          phase = WAITING;
        }
      }
    },
    input(match) {
      const me = match.seats[seat];
      if (match.result || match.celebration || !me.playing) return IDLE;
      if (me.holding || phase.name === 'checking') return holdCheck(match);
      if (!me.active || me.blast > 0) return IDLE;
      if (phase.name === 'waiting') {
        // A Kid whose turn it is, or who has nothing planned, gets thinking.
        think(match);
        return IDLE;
      }
      if (phase.name === 'thinking') {
        if (match.tick >= phase.until) plan(match);
        return IDLE;
      }
      return walk(match, phase);
    },
  };

  function holdCheck(match: Match): SeatInput {
    // Done with this check (a bomb sent it home, say): let go so the check completes.
    if (phase.name !== 'checking') return IDLE;
    const reading = phase.readUntil === null || match.tick < phase.readUntil;
    return { ...IDLE, reveal: reading };
  }

  function walk(match: Match, walking: Extract<Phase, { name: 'walking' }>): SeatInput {
    const me = match.seats[seat];
    if (me.square === walking.target) {
      phase = { name: 'checking', readUntil: null };
      return { ...IDLE, reveal: true };
    }
    if (match.tick - walking.since > ticks(STUCK_SECONDS)) {
      think(match, -style.think / 2);
      return IDLE;
    }
    if (match.tick < walking.pauseUntil) return IDLE;
    const rival = match.seats[seat === 0 ? 1 : 0];
    const move = nextMove(me.square, walking.target, rival.playing ? rival.square : null);
    if (!move) return IDLE;
    if (rng.chance(style.fumble)) {
      return {
        east: rng.pick([-1, 0, 1] as const),
        south: rng.pick([-1, 0, 1] as const),
        reveal: false,
      };
    }
    return { ...move, reveal: false };
  }
}
