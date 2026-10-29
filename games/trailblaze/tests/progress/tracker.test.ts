/**
 * Tests for the Trailblaze ProgressTracker: mapping match session events to
 * Den Life kit events (point wins, trap detection, ghost passes, ride durations,
 * match outcomes, solo play, and player-seat filtering).
 */
import type { KidId } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { channelById, type TrailblazeChannel } from '../../src/channels.ts';
import type { Match, Move } from '../../src/engine/types.ts';
import { createProgressTracker, type MatchCircumstances } from '../../src/progress/tracker.ts';

function createMockMatch(overrides?: Partial<Match>): Match {
  return {
    setup: {
      rules: (channelById('game-1') as TrailblazeChannel).rules,
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    },
    cells: new Int8Array(800),
    laidAt: new Int32Array(800),
    riders: [
      { cell: 410, heading: 'right', latched: null, fire: false, crashed: false, score: 0 },
      { cell: 430, heading: 'left', latched: null, fire: false, crashed: false, score: 0 },
    ],
    phase: 'running',
    shrunk: 0,
    round: 1,
    tick: 100,
    roundTick: 100,
    steps: 6,
    stepPeriod: 15,
    untilStep: 15,
    pauseTicks: 0,
    winner: null,
    ...overrides,
  };
}

function baseCircumstances(overrides?: Partial<MatchCircumstances>): MatchCircumstances {
  return {
    channel: channelById('game-1') as TrailblazeChannel,
    playerSeat: 1,
    rival: { kind: 'kid', kid: 'moss' as KidId },
    switches: ['B', 'B'],
    ...overrides,
  };
}

describe('tracker', () => {
  it('produces nothing when playerSeat is null', () => {
    const tracker = createProgressTracker(baseCircumstances({ playerSeat: null }));
    const match = createMockMatch();

    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 100, into: -2 }],
      },
      match,
    );
    tracker.hear({ type: 'over', winner: 1, scores: [0, 10] }, match);

    expect(tracker.drain()).toEqual([]);
  });

  it('produces a point won with boxedIn for a trap of 9 cells', () => {
    const circumstances = baseCircumstances({
      playerSeat: 1,
      rival: { kind: 'kid', kid: 'moss' },
    });
    const tracker = createProgressTracker(circumstances);
    const match = createMockMatch({ roundTick: 150, tick: 150 });

    // Rival (seat 0) trapped in a pocket of 9 cells
    tracker.hear(
      {
        type: 'trap',
        seat: 0,
        pocket: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        seal: 10,
      },
      match,
    );

    // Rival crashes alone; player wins the point
    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 100, into: 1 }],
      },
      match,
    );

    const events = tracker.drain();
    expect(events).toContainEqual({
      type: 'point-won',
      data: {
        pocket: 9,
        boxedIn: 1,
        trappedDee: 0,
        ghostPass: 0,
        wraparound: 0,
      },
    });
    expect(events.some((e) => e.type === 'ride')).toBe(true);
  });

  it('sets trappedDee to 1 when trapping Dee with any pocket size', () => {
    const circumstances = baseCircumstances({
      playerSeat: 1,
      rival: { kind: 'kid', kid: 'dee' },
    });
    const tracker = createProgressTracker(circumstances);
    const match = createMockMatch({ roundTick: 100 });

    tracker.hear(
      {
        type: 'trap',
        seat: 0,
        pocket: Array.from({ length: 25 }, (_, i) => i),
        seal: 26,
      },
      match,
    );

    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 50, into: 1 }],
      },
      match,
    );

    const events = tracker.drain();
    const pointWon = events.find((e) => e.type === 'point-won');
    expect(pointWon?.data?.trappedDee).toBe(1);
    expect(pointWon?.data?.boxedIn).toBe(0);
    expect(pointWon?.data?.pocket).toBe(25);
  });

  it('produces point-lost and ride when the player crashes alone', () => {
    const tracker = createProgressTracker(baseCircumstances({ playerSeat: 1 }));
    const match = createMockMatch({ roundTick: 200 });

    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 1, cell: 200, into: -2 }],
      },
      match,
    );

    const events = tracker.drain();
    expect(events).toContainEqual({ type: 'point-lost' });
    expect(events).toContainEqual({
      type: 'ride',
      data: {
        seconds: 4,
        speedUpSeconds: 0,
        topSpeedSeconds: 0,
      },
    });
  });

  it('produces no events on a shared crash', () => {
    const tracker = createProgressTracker(baseCircumstances({ playerSeat: 1 }));
    const match = createMockMatch({ roundTick: 100 });

    tracker.hear(
      {
        type: 'crash',
        crashes: [
          { seat: 0, cell: 100, into: 1 },
          { seat: 1, cell: 100, into: 0 },
        ],
      },
      match,
    );

    expect(tracker.drain()).toEqual([]);
  });

  it('awards ghostPass when a point is won 30 ticks after a cell swap and not 80 ticks after', () => {
    const tracker = createProgressTracker(baseCircumstances({ playerSeat: 1 }));
    const swapMoves: readonly Move[] = [
      { seat: 0, from: 100, to: 101, heading: 'right', wrapped: false, ticks: 15 },
      { seat: 1, from: 101, to: 100, heading: 'left', wrapped: false, ticks: 15 },
    ];

    // Case A: Swap at tick 100, point won at tick 130 (delta 30 <= 50)
    const matchA = createMockMatch({ tick: 100, roundTick: 100 });
    tracker.hear(
      {
        type: 'step',
        laid: [],
        erased: [],
        moves: swapMoves,
        period: 15,
      },
      matchA,
    );

    matchA.tick = 130;
    matchA.roundTick = 130;
    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 150, into: 1 }],
      },
      matchA,
    );

    const eventsA = tracker.drain();
    const pointWonA = eventsA.find((e) => e.type === 'point-won');
    expect(pointWonA?.data?.ghostPass).toBe(1);

    // Case B: Reset for next round; swap at tick 200, point won at tick 280 (delta 80 > 50)
    tracker.hear({ type: 'round', round: 2 }, createMockMatch({ tick: 190, roundTick: 0 }));

    const matchB = createMockMatch({ tick: 200, roundTick: 10 });
    tracker.hear(
      {
        type: 'step',
        laid: [],
        erased: [],
        moves: swapMoves,
        period: 15,
      },
      matchB,
    );

    matchB.tick = 280;
    matchB.roundTick = 90;
    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 180, into: 1 }],
      },
      matchB,
    );

    const eventsB = tracker.drain();
    const pointWonB = eventsB.find((e) => e.type === 'point-won');
    expect(pointWonB?.data?.ghostPass).toBe(0);
  });

  it('measures ride seconds, speedUpSeconds and topSpeedSeconds accurately', () => {
    const speedChannel = channelById('game-3') as TrailblazeChannel; // speedUp: true
    const tracker = createProgressTracker(
      baseCircumstances({ channel: speedChannel, playerSeat: 1 }),
    );

    const match = createMockMatch({ roundTick: 1024, stepPeriod: 3 });
    // Speed stage 4 arrives at tick 1024
    tracker.hear({ type: 'speed', stage: 4, period: 3 }, match);

    // Round runs for another 1500 ticks at top speed, ending at roundTick 2524
    match.roundTick = 2524;
    match.tick = 2524;
    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 300, into: 1 }],
      },
      match,
    );

    const events = tracker.drain();
    const ride = events.find((e) => e.type === 'ride');
    expect(ride).toBeDefined();
    // 2524 ticks = 50.48 seconds
    expect(ride?.data?.seconds).toBeCloseTo(50.48);
    expect(ride?.data?.speedUpSeconds).toBeCloseTo(50.48);
    // 1500 top-speed ticks = 30 seconds
    expect(ride?.data?.topSpeedSeconds).toBeCloseTo(30);
  });

  it('emits match-won with all flag variations on over event', () => {
    // Flag: shutout against a Kid (10–0)
    const kidTracker = createProgressTracker(
      baseCircumstances({
        playerSeat: 1,
        rival: { kind: 'kid', kid: 'dee' },
      }),
    );
    const matchShutout = createMockMatch({
      winner: 1,
      riders: [
        { cell: 0, heading: 'right', latched: null, fire: false, crashed: false, score: 0 },
        { cell: 0, heading: 'left', latched: null, fire: false, crashed: false, score: 10 },
      ],
    });
    kidTracker.hear({ type: 'over', winner: 1, scores: [0, 10] }, matchShutout);
    expect(kidTracker.drain()).toContainEqual({
      type: 'match-won',
      data: {
        vsKid: 1,
        shutout: 1,
        computerOnA: 0,
        louEightSpeedOnPlayerA: 0,
        kid: 'dee',
      },
    });

    // Flag: computer on switch A beaten
    const computerTracker = createProgressTracker(
      baseCircumstances({
        playerSeat: 1,
        rival: { kind: 'computer' },
        switches: ['A', 'B'], // seat 0 (computer) on A
      }),
    );
    const matchComputer = createMockMatch({ winner: 1 });
    computerTracker.hear({ type: 'over', winner: 1, scores: [4, 10] }, matchComputer);
    expect(computerTracker.drain()).toContainEqual({
      type: 'match-won',
      data: {
        vsKid: 0,
        shutout: 0,
        computerOnA: 1,
        louEightSpeedOnPlayerA: 0,
        kid: '',
      },
    });

    // Flag: Lou beaten in 8-way speed-up with player on switch A
    const eightSpeedChannel = channelById('game-6') as TrailblazeChannel; // 8-way, speed-up
    const louTracker = createProgressTracker(
      baseCircumstances({
        channel: eightSpeedChannel,
        playerSeat: 1,
        rival: { kind: 'kid', kid: 'lou' },
        switches: ['B', 'A'], // player (seat 1) on A
      }),
    );
    const matchLou = createMockMatch({ winner: 1 });
    louTracker.hear({ type: 'over', winner: 1, scores: [3, 10] }, matchLou);
    expect(louTracker.drain()).toContainEqual({
      type: 'match-won',
      data: {
        vsKid: 1,
        shutout: 0,
        computerOnA: 0,
        louEightSpeedOnPlayerA: 1,
        kid: 'lou',
      },
    });
  });

  it('emits match-lost with the opponent kid id when player loses', () => {
    const tracker = createProgressTracker(
      baseCircumstances({
        playerSeat: 1,
        rival: { kind: 'kid', kid: 'pip' },
      }),
    );
    const match = createMockMatch({ winner: 0 });
    tracker.hear({ type: 'over', winner: 0, scores: [10, 6] }, match);

    expect(tracker.drain()).toEqual([{ type: 'match-lost', data: { kid: 'pip' } }]);
  });

  it('emits solo-cells and ride when riding alone', () => {
    const tracker = createProgressTracker(
      baseCircumstances({
        playerSeat: 0,
        rival: { kind: 'nobody' },
      }),
    );
    const match = createMockMatch({ roundTick: 150 });

    tracker.hear(
      {
        type: 'step',
        laid: [
          { cell: 10, seat: 0, entered: 'right', left: 'right' },
          { cell: 11, seat: 0, entered: 'right', left: 'right' },
        ],
        erased: [],
        moves: [],
        period: 15,
      },
      match,
    );

    tracker.hear(
      {
        type: 'crash',
        crashes: [{ seat: 0, cell: 12, into: -2 }],
      },
      match,
    );

    const events = tracker.drain();
    expect(events).toContainEqual({
      type: 'solo-cells',
      data: { cells: 2 },
    });
    expect(events).toContainEqual({
      type: 'ride',
      data: {
        seconds: 3,
        speedUpSeconds: 0,
        topSpeedSeconds: 0,
      },
    });
  });

  describe('Four Way tracking', () => {
    it('emits point-won and ride on point event for playerSeat in Four Way', () => {
      const tracker = createProgressTracker(
        baseCircumstances({
          channel: channelById('four-way') as TrailblazeChannel,
          playerSeat: 0,
          switches: ['B', 'B', 'B', 'B'],
        }),
      );
      const match = createMockMatch({
        setup: {
          rules: (channelById('game-1') as TrailblazeChannel).rules,
          players: 4,
          switches: ['B', 'B', 'B', 'B'],
          target: 10,
        },
        roundTick: 200,
      });

      tracker.hear({ type: 'point', seat: 0, score: 1 }, match);
      const events = tracker.drain();

      expect(events.some((e) => e.type === 'point-won')).toBe(true);
      expect(events.some((e) => e.type === 'ride')).toBe(true);
    });

    it('emits point-lost and ride on point event for another seat in Four Way', () => {
      const tracker = createProgressTracker(
        baseCircumstances({
          channel: channelById('four-way') as TrailblazeChannel,
          playerSeat: 0,
          switches: ['B', 'B', 'B', 'B'],
        }),
      );
      const match = createMockMatch({
        setup: {
          rules: (channelById('game-1') as TrailblazeChannel).rules,
          players: 4,
          switches: ['B', 'B', 'B', 'B'],
          target: 10,
        },
        roundTick: 200,
      });

      tracker.hear({ type: 'point', seat: 2, score: 1 }, match);
      const events = tracker.drain();

      expect(events.some((e) => e.type === 'point-lost')).toBe(true);
      expect(events.some((e) => e.type === 'ride')).toBe(true);
    });
  });
});
