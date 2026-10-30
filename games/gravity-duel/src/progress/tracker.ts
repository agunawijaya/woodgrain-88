/**
 * Gravity Duel's progress tracker: it listens to a match from the player's
 * seat and turns what happens into the Den Life events the patches and
 * micro-challenges count. A tick's events are gathered first and judged in
 * `observe`, because a hit and the point it scores arrive in the same tick but
 * not always in the same order.
 */
import type { GameEvent, KidId, SwitchPosition } from '@woodgrain-88/kit';
import type { GravityChannel } from '../channels.ts';
import {
  CENTRE_X,
  CENTRE_Y,
  SUBPIXELS,
  TICKS_PER_SECOND,
  type Match,
  type MatchEvent,
  type Seat,
} from '../engine/types.ts';
import {
  dockEvent,
  matchLostEvent,
  matchWonEvent,
  nearStarEvent,
  pointLostEvent,
  pointWonEvent,
  refuelEvent,
} from './events.ts';

export interface MatchCircumstances {
  readonly channel: GravityChannel;
  /** The player's seat; null when nobody is a person (a Kids-only demo). */
  readonly playerSeat: Seat | null;
  readonly rival:
    | { readonly kind: 'kid'; readonly kid: KidId }
    | { readonly kind: 'person' }
    | { readonly kind: 'nobody' };
  readonly switches: readonly [SwitchPosition, SwitchPosition];
}

export interface ProgressTracker {
  /** Every engine event, in order, with the match as it stands after the tick. */
  hear(event: MatchEvent, match: Readonly<Match>): void;
  /** Called once after every engine tick, after its events were heard. */
  observe(match: Readonly<Match>): void;
  /** Den Life events produced since the last call, oldest first. */
  drain(): GameEvent[];
}

const NEAR_STAR_RADIUS_STEPS = 20;
const CLOAK_COOLDOWN_TICKS = 50;
const FRUGAL_MAX_THRUST_TICKS = 250;

export function createProgressTracker(circumstances: MatchCircumstances): ProgressTracker {
  const rawSeat = circumstances.playerSeat;
  if (rawSeat === null) {
    return {
      hear: () => undefined,
      observe: () => undefined,
      drain: () => [],
    };
  }
  const playerSeat: Seat = rawSeat;

  const queued: GameEvent[] = [];
  let thrustTicks = 0;
  let playerDocks = 0;
  let lastCloakOffTick: number | null = null;
  let nearStarTicks = 0;
  let matchEnded = false;

  let hitBendThisTick: number | null = null;
  let scoredThisTick: { readonly seat: Seat }[] = [];
  let dockedThisTick = 0;
  let refuelledThisTick: number[] = [];
  let starCrashThisTick = false;
  let overThisTick: { readonly winner: Seat | null } | null = null;

  function hear(event: MatchEvent, match: Readonly<Match>): void {
    switch (event.kind) {
      case 'hit': {
        if (event.shooter === playerSeat) {
          hitBendThisTick = event.turned;
        }
        break;
      }

      case 'cloak': {
        if (event.seat === playerSeat && !event.on) {
          lastCloakOffTick = match.tick;
        }
        break;
      }

      case 'scored': {
        scoredThisTick.push(event);
        break;
      }

      case 'docked': {
        if (event.seat === playerSeat) {
          dockedThisTick += 1;
        }
        break;
      }

      case 'refuelled': {
        if (event.seat === playerSeat) {
          refuelledThisTick.push(event.speed);
        }
        break;
      }

      case 'star-crash': {
        if (event.seat === playerSeat) {
          starCrashThisTick = true;
        }
        break;
      }

      case 'over': {
        overThisTick = event;
        break;
      }

      default:
        break;
    }
  }

  function observe(match: Readonly<Match>): void {
    const ship = match.ships[playerSeat];

    if (ship.thrusting) {
      thrustTicks += 1;
    }

    for (const scored of scoredThisTick) {
      if (scored.seat === playerSeat) {
        const bend = hitBendThisTick ?? 0;
        const afterCloak =
          lastCloakOffTick !== null && match.tick - lastCloakOffTick <= CLOAK_COOLDOWN_TICKS;
        const frugal = thrustTicks <= FRUGAL_MAX_THRUST_TICKS;
        queued.push(pointWonEvent({ bend, afterCloak, frugal }));
      } else {
        queued.push(pointLostEvent());
      }
    }

    while (dockedThisTick > 0) {
      dockedThisTick -= 1;
      playerDocks += 1;
      const switchA = circumstances.switches[playerSeat] === 'A';
      queued.push(dockEvent({ inMatch: playerDocks, switchA }));
    }

    for (const speed of refuelledThisTick) {
      queued.push(refuelEvent(speed));
    }

    // A stretch close to the star ends when the ship moves out, hides, crashes or the match ends.
    if (circumstances.channel.rules.centre === 'star') {
      const dx = (ship.x - CENTRE_X) / SUBPIXELS;
      const dy = (ship.y - CENTRE_Y) / SUBPIXELS;
      const inDistance = Math.hypot(dx, dy) <= NEAR_STAR_RADIUS_STEPS;
      const matchEnding = overThisTick !== null || match.phase === 'over';
      const stillNear =
        ship.present && !ship.cloaked && inDistance && !starCrashThisTick && !matchEnding;

      if (stillNear) {
        nearStarTicks += 1;
      } else if (nearStarTicks > 0) {
        const seconds = Math.floor(nearStarTicks / TICKS_PER_SECOND);
        if (seconds >= 1) {
          queued.push(nearStarEvent(seconds));
        }
        nearStarTicks = 0;
      }
    }

    if (!matchEnded && (overThisTick !== null || match.phase === 'over')) {
      const winner = overThisTick !== null ? overThisTick.winner : match.winner;
      const duel = circumstances.channel.rules.mode === 'duel';
      const vsKid = circumstances.rival.kind === 'kid';
      const kid = vsKid ? circumstances.rival.kid : '';

      if (winner === playerSeat) {
        const fuelLeft = duel ? ship.fuel : 0;
        const louOrbit =
          vsKid &&
          kid === 'lou' &&
          circumstances.channel.def.id === 'game-5' &&
          circumstances.switches[playerSeat] === 'A';

        queued.push(matchWonEvent({ duel, vsKid, fuelLeft, louOrbit, kid }));
        matchEnded = true;
      } else if (winner !== null) {
        queued.push(matchLostEvent(kid));
        matchEnded = true;
      } else {
        matchEnded = true;
      }
    }

    hitBendThisTick = null;
    scoredThisTick = [];
    dockedThisTick = 0;
    refuelledThisTick = [];
    starCrashThisTick = false;
    overThisTick = null;
  }

  function drain(): GameEvent[] {
    const events = [...queued];
    queued.length = 0;
    return events;
  }

  return {
    hear,
    observe,
    drain,
  };
}
