/**
 * Progress tracker for Trailblaze: observes session events and translates
 * them into Den Life events for achievements, stats, and micro-challenges.
 * Tracks point wins/losses, shut-in traps, ghost passes, ride durations,
 * and match conclusions from the player's perspective.
 */
import type { GameEvent, KidId, SwitchPosition } from '@woodgrain-88/kit';
import type { TrailblazeChannel } from '../channels.ts';
import { FASTEST_STEP_PERIOD } from '../engine/match.ts';
import { TICKS_PER_SECOND, type Match, type Seat } from '../engine/types.ts';
import type { SessionEvent } from '../session/match-session.ts';
import {
  matchLostEvent,
  matchWonEvent,
  pointLostEvent,
  pointWonEvent,
  rideEvent,
  soloCellsEvent,
} from './events.ts';

export interface MatchCircumstances {
  readonly channel: TrailblazeChannel;
  /** The player's rider; null when nobody is a person (a Kids-only demo). */
  readonly playerSeat: Seat | null;
  /** Who rides against the player. */
  readonly rival:
    | { readonly kind: 'kid'; readonly kid: KidId }
    | { readonly kind: 'computer' }
    | { readonly kind: 'person' }
    | { readonly kind: 'nobody' };
  readonly switches: readonly SwitchPosition[];
}

export interface ProgressTracker {
  /** Every session event, in order, with the match as it stands after it. */
  hear(event: SessionEvent, match: Readonly<Match>): void;
  /** Events produced since the last call, oldest first. */
  drain(): GameEvent[];
}

export function createProgressTracker(circumstances: MatchCircumstances): ProgressTracker {
  const playerSeat = circumstances.playerSeat;
  if (playerSeat === null) {
    return {
      hear: () => undefined,
      drain: () => [],
    };
  }

  const isFourWay = circumstances.channel.riders === 4;
  const isSolo = circumstances.rival.kind === 'nobody';
  const rivalSeat: Seat = (1 - playerSeat) as Seat;

  const queued: GameEvent[] = [];
  let roundCells = 0;
  let latestRivalTrapPocket = 0;
  let lastGhostPassTick: number | null = null;
  let topSpeedStartTick: number | null = null;

  function hear(event: SessionEvent, match: Readonly<Match>): void {
    switch (event.type) {
      case 'round': {
        roundCells = 0;
        latestRivalTrapPocket = 0;
        lastGhostPassTick = null;
        topSpeedStartTick = null;
        break;
      }

      case 'speed': {
        if (event.period === FASTEST_STEP_PERIOD) topSpeedStartTick = match.roundTick;
        break;
      }

      case 'step': {
        for (const laid of event.laid) {
          if (laid.seat === playerSeat) {
            roundCells += 1;
          }
        }

        const playerMove = event.moves.find((m) => m.seat === playerSeat);
        if (playerMove) {
          for (const move of event.moves) {
            if (move.seat === playerSeat) continue;
            const swapped = playerMove.from === move.to && move.from === playerMove.to;
            const metInCell = playerMove.to === move.to;
            if (swapped || metInCell) {
              lastGhostPassTick = match.tick;
            }
          }
        }
        break;
      }

      case 'trap': {
        if (event.seat !== playerSeat) {
          latestRivalTrapPocket = event.pocket.length;
        }
        break;
      }

      case 'crash': {
        if (isFourWay) {
          break;
        }

        const crashedPlayer = event.crashes.some((c) => c.seat === playerSeat);
        const crashedRival = !isSolo && event.crashes.some((c) => c.seat === rivalSeat);

        const seconds = match.roundTick / TICKS_PER_SECOND;
        const speedUpSeconds = circumstances.channel.rules.speedUp ? seconds : 0;
        const topSpeedSeconds =
          topSpeedStartTick === null ? 0 : (match.roundTick - topSpeedStartTick) / TICKS_PER_SECOND;
        const ride = rideEvent({ seconds, speedUpSeconds, topSpeedSeconds });

        if (isSolo) {
          queued.push(soloCellsEvent(roundCells), ride);
        } else if (crashedRival && !crashedPlayer) {
          const pocket = latestRivalTrapPocket;
          const boxedIn = pocket >= 1 && pocket <= 10;
          const trappedDee =
            pocket > 0 && circumstances.rival.kind === 'kid' && circumstances.rival.kid === 'dee';
          const ghostPass = lastGhostPassTick !== null && match.tick - lastGhostPassTick <= 50;
          const wraparound = circumstances.channel.rules.edges === 'wraparound';

          queued.push(
            pointWonEvent({
              pocket,
              boxedIn,
              trappedDee,
              ghostPass,
              wraparound,
            }),
          );
          queued.push(ride);
        } else if (crashedPlayer && !crashedRival) {
          queued.push(pointLostEvent(), ride);
        }
        break;
      }

      case 'point': {
        if (!isFourWay) {
          break;
        }

        const seconds = match.roundTick / TICKS_PER_SECOND;
        const speedUpSeconds = circumstances.channel.rules.speedUp ? seconds : 0;
        const topSpeedSeconds =
          topSpeedStartTick === null ? 0 : (match.roundTick - topSpeedStartTick) / TICKS_PER_SECOND;
        const ride = rideEvent({ seconds, speedUpSeconds, topSpeedSeconds });

        if (event.seat === playerSeat) {
          const pocket = latestRivalTrapPocket;
          const boxedIn = pocket >= 1 && pocket <= 10;
          const trappedDee =
            pocket > 0 && circumstances.rival.kind === 'kid' && circumstances.rival.kid === 'dee';
          const ghostPass = lastGhostPassTick !== null && match.tick - lastGhostPassTick <= 50;
          const wraparound = circumstances.channel.rules.edges === 'wraparound';

          queued.push(
            pointWonEvent({
              pocket,
              boxedIn,
              trappedDee,
              ghostPass,
              wraparound,
            }),
          );
          queued.push(ride);
        } else {
          queued.push(pointLostEvent(), ride);
        }
        break;
      }

      case 'over': {
        if (isSolo || event.winner === null) {
          break;
        }

        const vsKid = circumstances.rival.kind === 'kid';
        const kid = vsKid ? circumstances.rival.kid : '';

        if (event.winner === playerSeat) {
          const shutout =
            vsKid &&
            (isFourWay
              ? event.scores.every((score, s) => s === playerSeat || score === 0)
              : (event.scores[rivalSeat] ?? 0) === 0);
          const computerOnA =
            !isFourWay &&
            circumstances.rival.kind === 'computer' &&
            circumstances.switches[rivalSeat] === 'A';
          const louEightSpeedOnPlayerA =
            vsKid &&
            kid === 'lou' &&
            circumstances.channel.rules.steering === 8 &&
            circumstances.channel.rules.speedUp &&
            circumstances.switches[playerSeat] === 'A';

          queued.push(
            matchWonEvent({
              vsKid,
              shutout,
              computerOnA,
              louEightSpeedOnPlayerA,
              kid,
            }),
          );
        } else {
          queued.push(matchLostEvent(kid));
        }
        break;
      }

      default:
        break;
    }
  }

  function drain(): GameEvent[] {
    const events = [...queued];
    queued.length = 0;
    return events;
  }

  return {
    hear,
    drain,
  };
}
