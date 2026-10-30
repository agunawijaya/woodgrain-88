/**
 * Headless match runner for Kid-versus-Kid Gravity Duel simulations: steps
 * the real engine, feeds it the real Kid pilot (or the perfect docker, or an
 * idle stick) tick by tick, and counts up what happened. Nothing here
 * animates or draws; it is the same match a player would fly, replayed at
 * full speed for tuning and for the locked balance tests.
 */
import {
  hashSeed,
  type AimProfile,
  type KidId,
  type MemoryMode,
  type ReflexProfile,
  type Seed,
  type SwitchPosition,
} from '@woodgrain-88/kit';
import { createKidPilot } from '../ai/pilot.ts';
import type { PilotStyle } from '../ai/styles.ts';
import { createMatch, stepMatch } from '../engine/match.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  CARTRIDGE_TARGET,
  IDLE,
  type Controls,
  type Match,
  type MatchSetup,
  type Seat,
} from '../engine/types.ts';
import { variation } from '../engine/variations.ts';
import { createPerfectDocker } from './perfect-docker.ts';

/** Who flies a seat in a simulated match. */
export type Contender =
  | {
      readonly kind: 'kid';
      readonly kid: KidId;
      readonly mode?: MemoryMode;
      readonly reflex?: ReflexProfile;
      readonly aim?: AimProfile;
      readonly style?: PilotStyle;
    }
  | { readonly kind: 'perfect-docker' }
  | { readonly kind: 'idle' };

export interface SimOptions {
  readonly variation: number;
  readonly seats: readonly [Contender, Contender];
  readonly seed: Seed;
  readonly target?: number;
  readonly clockTicks?: number;
  readonly switches?: readonly [SwitchPosition, SwitchPosition];
}

export interface SimResult {
  readonly winner: Seat | null;
  readonly scores: readonly [number, number];
  readonly ticks: number;
  readonly reason: 'target' | 'clock';
  /** Per seat: how often each thing happened to that seat's ship. */
  readonly starCrashes: readonly [number, number];
  readonly hits: readonly [number, number];
  readonly selfHits: readonly [number, number];
  readonly cloakBurnouts: readonly [number, number];
  readonly shotsFired: readonly [number, number];
  readonly docks: readonly [number, number];
}

/** What a seat's hands do each tick; the perfect docker has no ears, a Kid does. */
interface Pilot {
  hear?(events: Match['events'], match: Readonly<Match>): void;
  controls(match: Readonly<Match>): Controls;
}

function createPilot(contender: Contender, seat: Seat, seed: Seed): Pilot | null {
  if (contender.kind === 'idle') return null;
  if (contender.kind === 'perfect-docker') return createPerfectDocker(seat);
  return createKidPilot({
    kid: contender.kid,
    seat,
    mode: contender.mode ?? 'human',
    // The two seats must not share a stream, or they would fly as mirror images.
    seed: `${seed}-${seat}`,
    ...(contender.reflex ? { reflex: contender.reflex } : {}),
    ...(contender.aim ? { aim: contender.aim } : {}),
    ...(contender.style ? { style: contender.style } : {}),
  });
}

/** A mutable version of SimResult's per-seat counters, filled in as events come in. */
interface Tally {
  starCrashes: [number, number];
  hits: [number, number];
  selfHits: [number, number];
  cloakBurnouts: [number, number];
  shotsFired: [number, number];
  docks: [number, number];
}

function emptyTally(): Tally {
  return {
    starCrashes: [0, 0],
    hits: [0, 0],
    selfHits: [0, 0],
    cloakBurnouts: [0, 0],
    shotsFired: [0, 0],
    docks: [0, 0],
  };
}

function count(tally: Tally, events: Match['events']): void {
  for (const event of events) {
    switch (event.kind) {
      case 'star-crash':
        tally.starCrashes[event.seat] += 1;
        break;
      case 'hit':
        tally.hits[event.shooter] += 1;
        break;
      case 'self-hit':
        tally.selfHits[event.seat] += 1;
        break;
      case 'cloak-burnout':
        tally.cloakBurnouts[event.seat] += 1;
        break;
      case 'fired':
        tally.shotsFired[event.seat] += 1;
        break;
      case 'docked':
        tally.docks[event.seat] += 1;
        break;
      default:
        break;
    }
  }
}

/** Plays one full match headless, at the engine's own 50 ticks a second, until it is over. */
export function simulate(options: SimOptions): SimResult {
  const setup: MatchSetup = {
    rules: variation(options.variation),
    switches: options.switches ?? ['B', 'B'],
    target: options.target ?? CARTRIDGE_TARGET,
    clockTicks: options.clockTicks ?? CARTRIDGE_MATCH_TICKS,
    seed: hashSeed(options.seed),
  };
  const match = createMatch(setup);

  const pilots: readonly [Pilot | null, Pilot | null] = [
    createPilot(options.seats[0], 0, options.seed),
    createPilot(options.seats[1], 1, options.seed),
  ];

  const tally = emptyTally();

  while (match.phase === 'playing') {
    for (const pilot of pilots) pilot?.hear?.(match.events, match);
    const controls: [Controls, Controls] = [
      pilots[0] ? pilots[0].controls(match) : IDLE,
      pilots[1] ? pilots[1].controls(match) : IDLE,
    ];
    stepMatch(match, controls);
    count(tally, match.events);
  }

  // The engine only ever ends a match by reaching the target or by the clock
  // running out; the clock reaching exactly zero tells the two apart.
  const reason: 'target' | 'clock' = match.clockLeft === 0 ? 'clock' : 'target';

  return {
    winner: match.winner,
    scores: [match.ships[0].score, match.ships[1].score],
    ticks: match.tick,
    reason,
    ...tally,
  };
}
