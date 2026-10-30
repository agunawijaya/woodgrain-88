/**
 * What a Kid pilot takes in from the field, as a player would: every visible
 * body where it is, the rival only while it can be seen (a cloaked ship is
 * remembered where it vanished), the rival's missile only if the Kid noticed
 * it leave or it comes close, and the bars (its own fuel and ammo, the
 * rival's missiles) only as well as it can keep count. Counts live in the
 * kit's Kid memory, so a Kid can lose track of its fuel and cloak on an empty
 * tank, just as a person does.
 */
import {
  createKidMemory,
  salienceOf,
  type FactAdapter,
  type KidMemory,
  type MemoryProfile,
  type Rng,
} from '@woodgrain-88/kit';
import {
  AMMO_SEGMENTS,
  FUEL_SEGMENTS,
  TICKS_PER_SECOND,
  type Match,
  type MatchEvent,
  type Seat,
} from '../engine/types.ts';
import { distanceSteps, type Motion } from './forecast.ts';

/** A count the Kid keeps in its head: a bar, as it last read it. */
export interface CountFact {
  readonly kind: 'fuel' | 'ammo';
  readonly seat: Seat;
  readonly value: number;
}

const COUNTS: FactAdapter<CountFact> = {
  key: (fact) => `${fact.kind}-${fact.seat}`,
  // Misremembering a bar means reading it one segment off.
  distort: (fact, rng) => ({
    ...fact,
    value: Math.min(8, Math.max(0, fact.value + (rng.chance(0.5) ? 1 : -1))),
  }),
};

export interface Beliefs {
  readonly fuel: number;
  readonly ammo: number;
  readonly rivalAmmo: number;
}

export interface Sighting extends Motion {
  /** The tick it was last actually seen; earlier than now when it is being guessed. */
  readonly seenAt: number;
}

export interface Watcher {
  readonly memory: KidMemory<CountFact>;
  /** Takes in this tick's moments and what can be seen. */
  hear(events: readonly MatchEvent[], match: Readonly<Match>, noticed: () => boolean): void;
  /** What the Kid believes of the bars now; a count it cannot call to mind keeps its last value. */
  beliefs(match: Readonly<Match>): Beliefs;
  /** Where the Kid thinks the rival is: seen, or guessed on from where it vanished. */
  rival(match: Readonly<Match>): Sighting | null;
  /** The rival's missile, if the Kid knows about it. */
  rivalMissile(match: Readonly<Match>): Motion | null;
}

export function createWatcher(
  seat: Seat,
  profile: MemoryProfile,
  awarenessSteps: number,
  rng: Rng,
): Watcher {
  const rivalSeat: Seat = seat === 0 ? 1 : 0;
  const memory = createKidMemory(profile, COUNTS);
  let believed: Beliefs = { fuel: FUEL_SEGMENTS, ammo: AMMO_SEGMENTS, rivalAmmo: AMMO_SEGMENTS };
  let lastFuel = FUEL_SEGMENTS;
  let lastSeen: Sighting | null = null;
  let missileNoticed = false;
  let started = false;

  const seconds = (match: Readonly<Match>) => match.tick / TICKS_PER_SECOND;

  function learnOwn(
    kind: 'fuel' | 'ammo',
    value: number,
    match: Readonly<Match>,
    striking = false,
  ) {
    memory.observe({ kind, seat, value }, salienceOf(profile, 'own', striking), seconds(match));
  }

  function watchRivalAmmo(value: number, match: Readonly<Match>) {
    const fact: CountFact = { kind: 'ammo', seat: rivalSeat, value };
    memory.witness(fact, salienceOf(profile, 'theirs', false), seconds(match), rng);
  }

  function hear(events: readonly MatchEvent[], match: Readonly<Match>, noticed: () => boolean) {
    const ship = match.ships[seat];
    if (!started) {
      started = true;
      learnOwn('fuel', ship.fuel, match);
      learnOwn('ammo', ship.ammo, match);
      watchRivalAmmo(match.ships[rivalSeat].ammo, match);
    }
    for (const event of events) hearOne(event, match, noticed);
    if (ship.fuel !== lastFuel) {
      // A segment going is something a pilot glances at; the last ones stick.
      learnOwn('fuel', ship.fuel, match, ship.fuel <= 2);
      lastFuel = ship.fuel;
    }
    if (!match.shots[rivalSeat].live) missileNoticed = false;
  }

  function hearOne(event: MatchEvent, match: Readonly<Match>, noticed: () => boolean) {
    switch (event.kind) {
      case 'fired':
        if (event.seat === seat) learnOwn('ammo', match.ships[seat].ammo, match);
        else {
          missileNoticed = noticed();
          watchRivalAmmo(match.ships[rivalSeat].ammo, match);
        }
        break;
      case 'reload':
        learnOwn('ammo', AMMO_SEGMENTS, match, true);
        watchRivalAmmo(AMMO_SEGMENTS, match);
        break;
      case 'refuelled':
        if (event.seat === seat) {
          learnOwn('fuel', FUEL_SEGMENTS, match, true);
          learnOwn('ammo', AMMO_SEGMENTS, match, true);
        } else watchRivalAmmo(AMMO_SEGMENTS, match);
        break;
      default:
        break;
    }
  }

  function beliefs(match: Readonly<Match>): Beliefs {
    let { fuel, ammo, rivalAmmo } = believed;
    for (const fact of memory.recall(seconds(match), rng)) {
      if (fact.kind === 'fuel' && fact.seat === seat) fuel = fact.value;
      else if (fact.kind === 'ammo' && fact.seat === seat) ammo = fact.value;
      else if (fact.kind === 'ammo') rivalAmmo = fact.value;
    }
    believed = { fuel, ammo, rivalAmmo };
    return believed;
  }

  function rival(match: Readonly<Match>): Sighting | null {
    const ship = match.ships[rivalSeat];
    if (!ship.present) return null;
    if (!ship.cloaked) {
      lastSeen = { x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy, seenAt: match.tick };
      return lastSeen;
    }
    if (!lastSeen) return null;
    // A vanished ship is guessed on along the line it was flying.
    const gone = match.tick - lastSeen.seenAt;
    return {
      ...lastSeen,
      x: lastSeen.x + (lastSeen.vx >> 4) * gone,
      y: lastSeen.y + (lastSeen.vy >> 4) * gone,
    };
  }

  function rivalMissile(match: Readonly<Match>): Motion | null {
    const shot = match.shots[rivalSeat];
    if (!shot.live || match.setup.rules.mode !== 'duel') return null;
    const own = match.ships[seat];
    const close = distanceSteps(own.x, own.y, shot.x, shot.y, match.setup.rules) <= awarenessSteps;
    // Once a missile has come close the Kid keeps an eye on it.
    if (close) missileNoticed = true;
    if (!missileNoticed) return null;
    return { x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy };
  }

  return { memory, hear, beliefs, rival, rivalMissile };
}
