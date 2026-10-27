/**
 * Tests for Tank Duel progression data: event schemas, patches,
 * micro-challenges, and the pure conversion from match events to kit events.
 */
import { describe, expect, it } from 'vitest';
import {
  EASY_SWITCHES,
  createPatchTracker,
  emptyDenLife,
  startMicro,
  validateMicroChallenges,
  validatePatches,
  type GameEvent,
  type ProgressData,
  type Repository,
  type StampedEvent,
} from '@woodgrain-88/kit';
import { channelById, CHANNELS } from '../src/engine/channels.ts';
import type { ChannelRules, MatchEvent, MatchState, Side } from '../src/engine/types.ts';
import {
  matchEndEvents,
  progressEvents,
  SURVIVED_EVENT,
  TANK_EVENTS,
  type MatchCircumstances,
} from '../src/progress/events.ts';
import { TANK_MICRO_CHALLENGES } from '../src/progress/micro.ts';
import { TANK_PATCHES } from '../src/progress/patches.ts';

function createFakeProgressRepo(): Repository<ProgressData> {
  let current: ProgressData = { games: {}, den: emptyDenLife() };
  return {
    get: () => current,
    set: (value) => {
      current = structuredClone(value);
    },
    update: (change) => {
      const draft = structuredClone(current);
      const replaced = change(draft) as ProgressData | undefined;
      current = replaced ?? draft;
      return current;
    },
    reset: () => {
      current = { games: {}, den: emptyDenLife() };
    },
    onChange: () => () => undefined,
  };
}

function stamp(event: GameEvent, channel = 'game-1', onA = false, seq = 1): StampedEvent {
  return {
    game: 'tank-duel',
    mode: 'normal',
    channel,
    at: '2026-10-25T20:00:00.000Z',
    seq,
    difficulty: onA ? { left: 'A', right: 'B' } : EASY_SWITCHES,
    type: event.type,
    ...(event.data !== undefined ? { data: event.data } : {}),
  };
}

function createMatchState(
  over: boolean,
  winner: Side | null,
  channel: ChannelRules = channelById('game-1'),
): MatchState {
  return {
    channel,
    options: {
      scoring: 'first-to-10',
      handicap: [false, false],
      wiring: false,
    },
    time: 10,
    clock: 100,
    scores: [5, 3],
    vehicles: [],
    shells: [null, null],
    reload: [0, 0],
    fireHeld: [false, false],
    freeze: null,
    fuel: [3, 3],
    radar: { next: 5, showing: 0 },
    round: 1,
    over,
    winner,
  };
}

describe('progress metadata validation', () => {
  it('passes validatePatches with declared events and positive targets', () => {
    const problems = validatePatches(TANK_PATCHES, TANK_EVENTS);
    expect(problems).toEqual([]);
  });

  it('declares exactly 7 patches spanning club, pro, legend, and secret tiers', () => {
    expect(TANK_PATCHES).toHaveLength(7);
    const tiers = TANK_PATCHES.map((patch) => patch.tier);
    expect(tiers.filter((tier) => tier === 'club').length).toBeGreaterThanOrEqual(1);
    expect(tiers.filter((tier) => tier === 'pro').length).toBeGreaterThanOrEqual(1);
    expect(tiers.filter((tier) => tier === 'legend').length).toBeGreaterThanOrEqual(1);
    expect(tiers.filter((tier) => tier === 'secret').length).toBe(1);
  });

  it('keeps patch titles at or under 28 characters and includes required hints', () => {
    for (const patch of TANK_PATCHES) {
      expect(patch.title.length).toBeLessThanOrEqual(28);
      expect(patch.title.length).toBeGreaterThan(0);
      if (patch.tier === 'secret') {
        expect(patch.hint).toBeDefined();
        expect(patch.hint?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('includes channel unlock notes on the four remix opener patches', () => {
    const bankManager = TANK_PATCHES.find((p) => p.id === 'bank-manager');
    const ghost = TANK_PATCHES.find((p) => p.id === 'ghost');
    const topGun = TANK_PATCHES.find((p) => p.id === 'top-gun');
    const grandpasRespect = TANK_PATCHES.find((p) => p.id === 'grandpas-respect');

    expect(bankManager?.description).toContain('Opens Ricochet Royale.');
    expect(ghost?.description).toContain('Opens Blackout.');
    expect(topGun?.description).toContain('Opens Ace Duel.');
    expect(grandpasRespect?.description).toContain('Opens Last Tank.');
  });

  it('passes validateMicroChallenges with existing channels and 45-second timers', () => {
    const channelIds = CHANNELS.map((channel) => channel.id);
    const problems = validateMicroChallenges(TANK_MICRO_CHALLENGES, channelIds);
    expect(problems).toEqual([]);

    for (const challenge of TANK_MICRO_CHALLENGES) {
      expect(challenge.title.length).toBeLessThanOrEqual(32);
      expect(challenge.seconds).toBe(45);
      expect(channelIds).toContain(challenge.channel);
    }
  });
});

describe('progressEvents', () => {
  const billiardChannel = channelById('game-8');
  const normalChannel = channelById('game-1');

  it('emits a banked billiard hit when seat 1 scores with bounces on a billiard channel', () => {
    const circumstances: MatchCircumstances = {
      channel: billiardChannel,
      kid: 'dee',
      playerOnA: false,
    };
    const events: MatchEvent[] = [
      {
        kind: 'hit',
        shooter: 0,
        victim: 1,
        vehicle: 1,
        at: { x: 10, y: 12 },
        direction: { x: 1, y: 0 },
        bounces: 3,
        points: 1,
        path: [
          { x: 2, y: 3 },
          { x: 10, y: 12 },
        ],
      },
    ];

    const kitEvents = progressEvents(events, circumstances);
    expect(kitEvents).toEqual([
      {
        type: 'hit',
        data: {
          bounces: 3,
          banked: 1,
          billiard: 1,
          points: 1,
        },
      },
    ]);
  });

  it('marks unbanked shots on standard channels as non-banked and non-billiard', () => {
    const circumstances: MatchCircumstances = {
      channel: normalChannel,
      kid: null,
      playerOnA: false,
    };
    const events: MatchEvent[] = [
      {
        kind: 'hit',
        shooter: 0,
        victim: 1,
        vehicle: 1,
        at: { x: 5, y: 8 },
        direction: { x: 0, y: 1 },
        bounces: 0,
        points: 1,
        path: [
          { x: 5, y: 0 },
          { x: 5, y: 8 },
        ],
      },
    ];

    const kitEvents = progressEvents(events, circumstances);
    expect(kitEvents).toEqual([
      {
        type: 'hit',
        data: {
          bounces: 0,
          banked: 0,
          billiard: 0,
          points: 1,
        },
      },
    ]);
  });

  it('emits hit-taken without fields when seat 1 is the victim', () => {
    const circumstances: MatchCircumstances = {
      channel: normalChannel,
      kid: 'moss',
      playerOnA: true,
    };
    const events: MatchEvent[] = [
      {
        kind: 'hit',
        shooter: 1,
        victim: 0,
        vehicle: 0,
        at: { x: 2, y: 4 },
        direction: { x: -1, y: 0 },
        bounces: 1,
        points: 1,
        path: [
          { x: 8, y: 4 },
          { x: 2, y: 4 },
        ],
      },
    ];

    const kitEvents = progressEvents(events, circumstances);
    expect(kitEvents).toEqual([{ type: 'hit-taken' }]);
  });

  it('ignores non-hit engine events completely', () => {
    const circumstances: MatchCircumstances = {
      channel: normalChannel,
      kid: 'pip',
      playerOnA: false,
    };
    const events: MatchEvent[] = [
      {
        kind: 'fired',
        side: 0,
        at: { x: 1, y: 1 },
        direction: { x: 1, y: 0 },
        shot: 'straight',
      },
      {
        kind: 'bounced',
        side: 0,
        at: { x: 10, y: 1 },
        normal: { x: -1, y: 0 },
        bounces: 1,
        corner: false,
      },
      { kind: 'turned', vehicle: 0, heading: 4 },
      { kind: 'spin-over', victim: 1 },
    ];

    const kitEvents = progressEvents(events, circumstances);
    expect(kitEvents).toEqual([]);
  });
});

describe('matchEndEvents', () => {
  it('returns empty array when match is not over', () => {
    const state = createMatchState(false, null);
    const circumstances: MatchCircumstances = {
      channel: channelById('game-1'),
      kid: 'dee',
      playerOnA: false,
    };

    expect(matchEndEvents(state, circumstances)).toEqual([]);
  });

  it('returns empty array on a draw', () => {
    const state = createMatchState(true, null);
    const circumstances: MatchCircumstances = {
      channel: channelById('game-1'),
      kid: 'dee',
      playerOnA: false,
    };

    expect(matchEndEvents(state, circumstances)).toEqual([]);
  });

  it('sets louInvisibleMazeOnA to 1 when beating Lou in an invisible maze on switch A', () => {
    const mazeChannel = channelById('game-11'); // Ghost guided · Quarter (old-quarter arena, invisible)
    const state = createMatchState(true, 0, mazeChannel);
    const circumstances: MatchCircumstances = {
      channel: mazeChannel,
      kid: 'lou',
      playerOnA: true,
    };

    const events = matchEndEvents(state, circumstances);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'match-won',
      data: {
        vsKid: 1,
        invisible: 1,
        jet: 0,
        louInvisibleMazeOnA: 1,
        loneJet: 0,
        kid: 'lou',
      },
    });
  });

  it('sets louInvisibleMazeOnA to 0 when player is on switch B', () => {
    const mazeChannel = channelById('game-11');
    const state = createMatchState(true, 0, mazeChannel);
    const circumstances: MatchCircumstances = {
      channel: mazeChannel,
      kid: 'lou',
      playerOnA: false,
    };

    const events = matchEndEvents(state, circumstances);
    expect(events[0]?.data?.louInvisibleMazeOnA).toBe(0);
  });

  it('sets loneJet to 1 when winning on game-26', () => {
    const jetChannel = channelById('game-26');
    const state = createMatchState(true, 0, jetChannel);
    const circumstances: MatchCircumstances = {
      channel: jetChannel,
      kid: 'rosa',
      playerOnA: false,
    };

    const events = matchEndEvents(state, circumstances);
    expect(events[0]?.data?.loneJet).toBe(1);
    expect(events[0]?.data?.jet).toBe(1);
  });

  it('sets vsKid and kid flags to 0 and empty string when playing against a human in seat 2', () => {
    const mazeChannel = channelById('game-11');
    const state = createMatchState(true, 0, mazeChannel);
    const circumstances: MatchCircumstances = {
      channel: mazeChannel,
      kid: null,
      playerOnA: true,
    };

    const events = matchEndEvents(state, circumstances);
    expect(events[0]).toEqual({
      type: 'match-won',
      data: {
        vsKid: 0,
        invisible: 0,
        jet: 0,
        louInvisibleMazeOnA: 0,
        loneJet: 0,
        kid: '',
      },
    });
  });

  it('retains loneJet on game-26 even against a human player in seat 2', () => {
    const jetChannel = channelById('game-26');
    const state = createMatchState(true, 0, jetChannel);
    const circumstances: MatchCircumstances = {
      channel: jetChannel,
      kid: null,
      playerOnA: false,
    };

    const events = matchEndEvents(state, circumstances);
    expect(events[0]?.data?.loneJet).toBe(1);
    expect(events[0]?.data?.vsKid).toBe(0);
    expect(events[0]?.data?.kid).toBe('');
  });

  it('emits match-lost with opponent kid id when seat 1 loses', () => {
    const state = createMatchState(true, 1);
    const circumstances: MatchCircumstances = {
      channel: channelById('game-1'),
      kid: 'benny',
      playerOnA: false,
    };

    const events = matchEndEvents(state, circumstances);
    expect(events).toEqual([
      {
        type: 'match-lost',
        data: {
          kid: 'benny',
        },
      },
    ]);
  });
});

describe('patch progression and earning', () => {
  it('earns Rookie Commander on the first win against any Neighbourhood Kid', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    const humanWin = stamp({
      type: 'match-won',
      data: { vsKid: 0, invisible: 0, jet: 0, louInvisibleMazeOnA: 0, loneJet: 0, kid: '' },
    });
    expect(tracker.handle(humanWin)).toEqual([]);
    expect(tracker.status('tank-duel').find((s) => s.def.id === 'rookie-commander')?.earned).toBe(
      false,
    );

    const botWin = stamp({
      type: 'match-won',
      data: { vsKid: 1, invisible: 0, jet: 0, louInvisibleMazeOnA: 0, loneJet: 0, kid: 'dee' },
    });
    const earned = tracker.handle(botWin);
    expect(earned.some((e) => e.patch.id === 'rookie-commander')).toBe(true);
    expect(tracker.status('tank-duel').find((s) => s.def.id === 'rookie-commander')?.earned).toBe(
      true,
    );
  });

  it('earns Ricochet on exactly the 10th banked hit', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    for (let i = 0; i < 9; i++) {
      tracker.handle(
        stamp({
          type: 'hit',
          data: { bounces: 1, banked: 1, billiard: 0, points: 1 },
        }),
      );
    }
    const beforeTenth = tracker.status('tank-duel').find((s) => s.def.id === 'ricochet');
    expect(beforeTenth?.value).toBe(9);
    expect(beforeTenth?.earned).toBe(false);

    // Unbanked hits do not increase count towards Ricochet
    tracker.handle(
      stamp({
        type: 'hit',
        data: { bounces: 0, banked: 0, billiard: 0, points: 1 },
      }),
    );
    expect(tracker.status('tank-duel').find((s) => s.def.id === 'ricochet')?.value).toBe(9);

    const tenthEarned = tracker.handle(
      stamp({
        type: 'hit',
        data: { bounces: 2, banked: 1, billiard: 0, points: 1 },
      }),
    );
    expect(tenthEarned.some((e) => e.patch.id === 'ricochet')).toBe(true);
    expect(tracker.status('tank-duel').find((s) => s.def.id === 'ricochet')?.earned).toBe(true);
  });

  it('earns Bank Manager on the 10th billiard hit', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    for (let i = 0; i < 9; i++) {
      tracker.handle(
        stamp({
          type: 'hit',
          data: { bounces: 1, banked: 1, billiard: 1, points: 1 },
        }),
      );
    }
    expect(tracker.status('tank-duel').find((s) => s.def.id === 'bank-manager')?.earned).toBe(
      false,
    );

    const tenthEarned = tracker.handle(
      stamp({
        type: 'hit',
        data: { bounces: 1, banked: 1, billiard: 1, points: 1 },
      }),
    );
    expect(tenthEarned.some((e) => e.patch.id === 'bank-manager')).toBe(true);
  });

  it('earns Ghost on winning an invisible channel against a Kid', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    const earned = tracker.handle(
      stamp({
        type: 'match-won',
        data: { vsKid: 1, invisible: 1, jet: 0, louInvisibleMazeOnA: 0, loneJet: 0, kid: 'pip' },
      }),
    );
    expect(earned.some((e) => e.patch.id === 'ghost')).toBe(true);
  });

  it('earns Top Gun on 3 jet wins against a Kid', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    const jetWin = stamp({
      type: 'match-won',
      data: { vsKid: 1, invisible: 0, jet: 1, louInvisibleMazeOnA: 0, loneJet: 0, kid: 'rosa' },
    });

    tracker.handle(jetWin);
    tracker.handle(jetWin);
    expect(tracker.status('tank-duel').find((s) => s.def.id === 'top-gun')?.earned).toBe(false);

    const earned = tracker.handle(jetWin);
    expect(earned.some((e) => e.patch.id === 'top-gun')).toBe(true);
  });

  it('earns Grandpa Respect in gold thread when beaten on switch A', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    const earned = tracker.handle(
      stamp(
        {
          type: 'match-won',
          data: { vsKid: 1, invisible: 1, jet: 0, louInvisibleMazeOnA: 1, loneJet: 0, kid: 'lou' },
        },
        'game-11',
        true, // left on A
      ),
    );

    // The same win also earns Rookie Commander and Ghost.
    const respect = earned.find((award) => award.patch.id === 'grandpas-respect');
    expect(earned).toHaveLength(3);
    expect(respect?.gold).toBe(true);
  });

  it('reveals secret Lone Wolf description only after earning', () => {
    const progress = createFakeProgressRepo();
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: TANK_PATCHES }],
      progress,
    });

    const before = tracker.status('tank-duel').find((s) => s.def.id === 'lone-wolf');
    expect(before?.earned).toBe(false);
    expect(before?.visibleDescription).toBe(before?.def.hint);

    tracker.handle(
      stamp({
        type: 'match-won',
        data: { vsKid: 1, invisible: 0, jet: 1, louInvisibleMazeOnA: 0, loneJet: 1, kid: 'dee' },
      }),
    );

    const after = tracker.status('tank-duel').find((s) => s.def.id === 'lone-wolf');
    expect(after?.earned).toBe(true);
    expect(after?.visibleDescription).toBe(after?.def.description);
  });
});

describe('micro-challenges execution', () => {
  it('passes hit-three after 3 hits on game-4', () => {
    const def = TANK_MICRO_CHALLENGES.find((m) => m.id === 'hit-three');
    expect(def).toBeDefined();
    if (!def) return;

    const run = startMicro('tank-duel', def);
    expect(run.state).toBe('running');

    run.handle(stamp({ type: 'hit' }, 'game-4'));
    run.handle(stamp({ type: 'hit' }, 'game-4'));
    expect(run.state).toBe('running');

    run.handle(stamp({ type: 'hit' }, 'game-4'));
    expect(run.state).toBe('passed');
  });

  it('passes land-a-bank on game-7 with a single banked hit', () => {
    const def = TANK_MICRO_CHALLENGES.find((m) => m.id === 'land-a-bank');
    expect(def).toBeDefined();
    if (!def) return;

    const run = startMicro('tank-duel', def);
    run.handle(stamp({ type: 'hit', data: { banked: 0 } }, 'game-7'));
    expect(run.state).toBe('running');

    run.handle(stamp({ type: 'hit', data: { banked: 1 } }, 'game-7'));
    expect(run.state).toBe('passed');
  });

  it('passes survive-invisible on game-11 with SURVIVED_EVENT', () => {
    const def = TANK_MICRO_CHALLENGES.find((m) => m.id === 'survive-invisible');
    expect(def).toBeDefined();
    if (!def) return;

    const run = startMicro('tank-duel', def);
    expect(run.state).toBe('running');

    run.handle(stamp(SURVIVED_EVENT, 'game-11'));
    expect(run.state).toBe('passed');
  });

  it('passes down-a-biplane on game-15 with 1 hit', () => {
    const def = TANK_MICRO_CHALLENGES.find((m) => m.id === 'down-a-biplane');
    expect(def).toBeDefined();
    if (!def) return;

    const run = startMicro('tank-duel', def);
    run.handle(stamp({ type: 'hit' }, 'game-15'));
    expect(run.state).toBe('passed');
  });

  it('passes jet-duel on game-23 with 2 hits', () => {
    const def = TANK_MICRO_CHALLENGES.find((m) => m.id === 'jet-duel');
    expect(def).toBeDefined();
    if (!def) return;

    const run = startMicro('tank-duel', def);
    run.handle(stamp({ type: 'hit' }, 'game-23'));
    expect(run.state).toBe('running');

    run.handle(stamp({ type: 'hit' }, 'game-23'));
    expect(run.state).toBe('passed');
  });
});
