/**
 * Tests for Gravity Duel progress tracker: translating engine match events
 * and observed match states into Den Life events.
 */
import { createRng, type SwitchPosition } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { channelById } from '../../src/channels.ts';
import {
  CENTRE_X,
  CENTRE_Y,
  TICKS_PER_SECOND,
  type Match,
  type MatchEvent,
  type Ship,
} from '../../src/engine/types.ts';
import { createProgressTracker, type MatchCircumstances } from '../../src/progress/tracker.ts';

function createFakeShip(overrides?: Partial<Ship>): Ship {
  return {
    present: true,
    heading: 0,
    turnWait: 0,
    fuel: 8,
    burnsLeft: 256,
    ammo: 8,
    cloaked: false,
    cloakHeld: false,
    spin: 0,
    thrusting: false,
    dockCooldown: 0,
    score: 0,
    x: CENTRE_X,
    y: CENTRE_Y,
    vx: 0,
    vy: 0,
    prevX: CENTRE_X,
    prevY: CENTRE_Y,
    wrapped: false,
    ...overrides,
  };
}

function createFakeMatch(overrides?: {
  tick?: number;
  phase?: Match['phase'];
  ships?: [Ship, Ship];
  channelId?: string;
  switches?: readonly [SwitchPosition, SwitchPosition];
}): Match {
  const channel = channelById(overrides?.channelId ?? 'game-1') ?? channelById('game-1');
  if (!channel) throw new Error('game-1 missing');

  return {
    setup: {
      rules: channel.rules,
      switches: overrides?.switches ?? ['B', 'B'],
      target: 10,
      clockTicks: 35_840,
      seed: 12345,
    },
    ships: overrides?.ships ?? [createFakeShip(), createFakeShip()],
    shots: [
      {
        live: false,
        life: 0,
        age: 0,
        turned: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        prevX: 0,
        prevY: 0,
        wrapped: false,
      },
      {
        live: false,
        life: 0,
        age: 0,
        turned: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        prevX: 0,
        prevY: 0,
        wrapped: false,
      },
    ],
    random: createRng(12345),
    tick: overrides?.tick ?? 0,
    clockLeft: 35_840,
    phase: overrides?.phase ?? 'playing',
    winner: null,
    events: [],
  };
}

function defaultCircumstances(overrides?: Partial<MatchCircumstances>): MatchCircumstances {
  const channel = channelById(overrides?.channel?.def.id ?? 'game-1');
  if (!channel) throw new Error('game-1 missing');
  return {
    channel,
    playerSeat: 0,
    rival: { kind: 'person' },
    switches: ['B', 'B'],
    ...overrides,
  };
}

describe('Gravity Duel progress tracker', () => {
  it('translates a player point and a rival point', () => {
    const tracker = createProgressTracker(defaultCircumstances());
    const match = createFakeMatch({ tick: 10 });

    // Player scores a point
    tracker.hear({ kind: 'scored', seat: 0, score: 1 }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'point-won',
        data: {
          bend: 0,
          afterCloak: 0,
          frugal: 1,
        },
      },
    ]);

    // Rival scores a point
    tracker.hear({ kind: 'scored', seat: 1, score: 1 }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([{ type: 'point-lost' }]);
  });

  it('computes bend from a hit in the same tick, whichever order the events came in', () => {
    const tracker = createProgressTracker(defaultCircumstances());
    const match = createFakeMatch({ tick: 20 });
    const hitEvent: MatchEvent = {
      kind: 'hit',
      shooter: 0,
      victim: 1,
      turned: Math.PI / 2, // 90 degrees
    };
    const scoredEvent: MatchEvent = {
      kind: 'scored',
      seat: 0,
      score: 1,
    };

    // Order 1: hit arrives before scored
    tracker.hear(hitEvent, match);
    tracker.hear(scoredEvent, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'point-won',
        data: {
          bend: 90,
          afterCloak: 0,
          frugal: 1,
        },
      },
    ]);

    // Order 2: scored arrives before hit
    tracker.hear(scoredEvent, match);
    tracker.hear(hitEvent, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'point-won',
        data: {
          bend: 90,
          afterCloak: 0,
          frugal: 1,
        },
      },
    ]);
  });

  it('detects scoring within and beyond 50 ticks of dropping cloak', () => {
    const tracker = createProgressTracker(defaultCircumstances());

    // Drop cloak at tick 100
    const matchDrop = createFakeMatch({ tick: 100 });
    tracker.hear({ kind: 'cloak', seat: 0, on: false }, matchDrop);
    tracker.observe(matchDrop);
    expect(tracker.drain()).toEqual([]);

    // Score at tick 150 (exactly 50 ticks later -> afterCloak = 1)
    const matchAt50 = createFakeMatch({ tick: 150 });
    tracker.hear({ kind: 'scored', seat: 0, score: 1 }, matchAt50);
    tracker.observe(matchAt50);

    const events50 = tracker.drain();
    expect(events50).toHaveLength(1);
    expect(events50[0]?.data?.afterCloak).toBe(1);

    // Score at tick 151 (51 ticks later -> afterCloak = 0)
    const matchAt51 = createFakeMatch({ tick: 151 });
    tracker.hear({ kind: 'scored', seat: 0, score: 2 }, matchAt51);
    tracker.observe(matchAt51);

    const events51 = tracker.drain();
    expect(events51).toHaveLength(1);
    expect(events51[0]?.data?.afterCloak).toBe(0);
  });

  it('evaluates frugal at 250 and at 251 thrust ticks', () => {
    const tracker = createProgressTracker(defaultCircumstances());
    const thrustingShip = createFakeShip({ thrusting: true });
    const idleShip = createFakeShip({ thrusting: false });

    // Step through 250 thrust ticks
    for (let tick = 1; tick <= 250; tick++) {
      const match = createFakeMatch({
        tick,
        ships: [thrustingShip, idleShip],
      });
      tracker.observe(match);
    }

    // Score a point at 250 thrust ticks -> frugal = 1
    const match250 = createFakeMatch({
      tick: 250,
      ships: [idleShip, idleShip],
    });
    tracker.hear({ kind: 'scored', seat: 0, score: 1 }, match250);
    tracker.observe(match250);

    const events250 = tracker.drain();
    expect(events250).toHaveLength(1);
    expect(events250[0]?.data?.frugal).toBe(1);

    // One more thrust tick makes 251 thrust ticks
    const match251 = createFakeMatch({
      tick: 251,
      ships: [thrustingShip, idleShip],
    });
    tracker.hear({ kind: 'scored', seat: 0, score: 2 }, match251);
    tracker.observe(match251);

    const events251 = tracker.drain();
    expect(events251).toHaveLength(1);
    expect(events251[0]?.data?.frugal).toBe(0);
  });

  it('tracks dock counting and difficulty switch A', () => {
    const channel14 = channelById('game-14');
    if (!channel14) throw new Error('game-14 missing');

    const tracker = createProgressTracker(
      defaultCircumstances({
        channel: channel14,
        switches: ['A', 'B'],
      }),
    );
    const match = createFakeMatch({ channelId: 'game-14', switches: ['A', 'B'] });

    tracker.hear({ kind: 'docked', seat: 0, pod: 0 }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'dock',
        data: {
          inMatch: 1,
          switchA: 1,
        },
      },
    ]);

    tracker.hear({ kind: 'docked', seat: 0, pod: 0 }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'dock',
        data: {
          inMatch: 2,
          switchA: 1,
        },
      },
    ]);

    // Rival dock does not emit dock event for player
    tracker.hear({ kind: 'docked', seat: 1, pod: 1 }, match);
    tracker.observe(match);
    expect(tracker.drain()).toEqual([]);
  });

  it('ends a near-star stretch by moving away', () => {
    const channel4 = channelById('game-4'); // The Star
    if (!channel4) throw new Error('game-4 missing');

    const tracker = createProgressTracker(defaultCircumstances({ channel: channel4 }));

    // Fly close to the star for 50 ticks (1 second)
    const nearShip = createFakeShip({ x: CENTRE_X, y: CENTRE_Y });
    const awayShip = createFakeShip({ x: 0, y: 0 }); // > 20 steps away

    for (let tick = 1; tick <= TICKS_PER_SECOND; tick++) {
      const match = createFakeMatch({
        tick,
        channelId: 'game-4',
        ships: [nearShip, awayShip],
      });
      tracker.observe(match);
    }
    expect(tracker.drain()).toEqual([]);

    // Move away on the next tick
    const matchMoved = createFakeMatch({
      tick: TICKS_PER_SECOND + 1,
      channelId: 'game-4',
      ships: [awayShip, awayShip],
    });
    tracker.observe(matchMoved);

    expect(tracker.drain()).toEqual([
      {
        type: 'near-star',
        data: { seconds: 1 },
      },
    ]);
  });

  it('ends a near-star stretch by a star crash', () => {
    const channel4 = channelById('game-4');
    if (!channel4) throw new Error('game-4 missing');

    const tracker = createProgressTracker(defaultCircumstances({ channel: channel4 }));
    const nearShip = createFakeShip({ x: CENTRE_X, y: CENTRE_Y });

    for (let tick = 1; tick <= TICKS_PER_SECOND; tick++) {
      const match = createFakeMatch({
        tick,
        channelId: 'game-4',
        ships: [nearShip, nearShip],
      });
      tracker.observe(match);
    }

    // Ship touches the star
    const matchCrash = createFakeMatch({
      tick: TICKS_PER_SECOND + 1,
      channelId: 'game-4',
      ships: [nearShip, nearShip],
    });
    tracker.hear({ kind: 'star-crash', seat: 0 }, matchCrash);
    tracker.observe(matchCrash);

    expect(tracker.drain()).toEqual([
      {
        type: 'near-star',
        data: { seconds: 1 },
      },
    ]);
  });

  it('ends a near-star stretch by the match ending', () => {
    const channel4 = channelById('game-4');
    if (!channel4) throw new Error('game-4 missing');

    const tracker = createProgressTracker(defaultCircumstances({ channel: channel4 }));
    const nearShip = createFakeShip({ x: CENTRE_X, y: CENTRE_Y });

    for (let tick = 1; tick <= TICKS_PER_SECOND; tick++) {
      const match = createFakeMatch({
        tick,
        channelId: 'game-4',
        ships: [nearShip, nearShip],
      });
      tracker.observe(match);
    }

    // Match ends on tick 50 (or next tick)
    const matchOver = createFakeMatch({
      tick: TICKS_PER_SECOND + 1,
      channelId: 'game-4',
      phase: 'over',
      ships: [nearShip, nearShip],
    });
    tracker.hear({ kind: 'over', winner: 0, reason: 'target' }, matchOver);
    tracker.observe(matchOver);

    const events = tracker.drain();
    expect(events.some((e) => e.type === 'near-star' && e.data?.seconds === 1)).toBe(true);
    expect(events.some((e) => e.type === 'match-won')).toBe(true);
  });

  it('records refuel speed when player refuels', () => {
    const channel6 = channelById('game-6'); // Starbase
    if (!channel6) throw new Error('game-6 missing');

    const tracker = createProgressTracker(defaultCircumstances({ channel: channel6 }));
    const match = createFakeMatch({ channelId: 'game-6' });

    tracker.hear({ kind: 'refuelled', seat: 0, speed: 56 }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'refuel',
        data: { speed: 56 },
      },
    ]);

    // Rival refuel is ignored
    tracker.hear({ kind: 'refuelled', seat: 1, speed: 20 }, match);
    tracker.observe(match);
    expect(tracker.drain()).toEqual([]);
  });

  it('emits match won with Lou Orbit flag when beating Lou on game-5 on switch A', () => {
    const channel5 = channelById('game-5');
    if (!channel5) throw new Error('game-5 missing');

    const tracker = createProgressTracker(
      defaultCircumstances({
        channel: channel5,
        rival: { kind: 'kid', kid: 'lou' },
        switches: ['A', 'B'],
      }),
    );
    const shipWithFuel = createFakeShip({ fuel: 7 });
    const match = createFakeMatch({
      channelId: 'game-5',
      switches: ['A', 'B'],
      phase: 'over',
      ships: [shipWithFuel, createFakeShip()],
    });

    tracker.hear({ kind: 'over', winner: 0, reason: 'target' }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'match-won',
        data: {
          duel: 1,
          vsKid: 1,
          fuelLeft: 7,
          louOrbit: 1,
          kid: 'lou',
        },
      },
    ]);
  });

  it('emits match lost when the rival wins', () => {
    const tracker = createProgressTracker(
      defaultCircumstances({
        rival: { kind: 'kid', kid: 'rosa' },
      }),
    );
    const match = createFakeMatch({ phase: 'over' });

    tracker.hear({ kind: 'over', winner: 1, reason: 'target' }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([
      {
        type: 'match-lost',
        data: { kid: 'rosa' },
      },
    ]);
  });

  it('produces nothing at all for a Kids-only demo', () => {
    const tracker = createProgressTracker(
      defaultCircumstances({
        playerSeat: null,
        rival: { kind: 'nobody' },
      }),
    );
    const match = createFakeMatch();

    tracker.hear({ kind: 'scored', seat: 0, score: 1 }, match);
    tracker.hear({ kind: 'docked', seat: 0, pod: 0 }, match);
    tracker.hear({ kind: 'refuelled', seat: 0, speed: 50 }, match);
    tracker.hear({ kind: 'over', winner: 0, reason: 'target' }, match);
    tracker.observe(match);

    expect(tracker.drain()).toEqual([]);
  });
});
