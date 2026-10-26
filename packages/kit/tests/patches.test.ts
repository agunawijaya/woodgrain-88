/**
 * Unit tests for patch progression tracking, gold upgrades, and patch validation.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus, type GameEventSchema, type StampedEvent } from '../src/events.ts';
import {
  createPatchTracker,
  type PatchDef,
  type PatchEarned,
  validatePatches,
} from '../src/patches.ts';
import type { EventLogData, ProgressData } from '../src/store/types.ts';
import { fakeRepo } from './helpers/fake-repo.ts';

const EVENT_SCHEMAS: readonly GameEventSchema[] = [
  { type: 'hit', description: 'Opponent hit.', fields: { points: 'number', tag: 'string' } },
  { type: 'combo', description: 'Multi-hit chain.', fields: { chain: 'number' } },
  { type: 'bank-shot', description: 'Ricochet hit.' },
];

const PATCHES: readonly PatchDef[] = [
  {
    id: 'first-hits',
    tier: 'club',
    title: 'Paint Starter',
    description: 'Hit 2 tanks across any mode.',
    goal: {
      metric: { kind: 'count', event: 'hit' },
      target: 2,
    },
  },
  {
    id: 'point-collector',
    tier: 'pro',
    title: 'Paint Bucket',
    description: 'Accumulate 100 hit points.',
    goal: {
      metric: { kind: 'sum', event: 'hit', field: 'points' },
      target: 100,
    },
  },
  {
    id: 'daily-billiard-ace',
    tier: 'legend',
    title: 'Daily Cushion Master',
    description: 'Reach a combo chain of 5 in billiard-walls daily mode.',
    goal: {
      metric: { kind: 'max', event: 'combo', field: 'chain' },
      target: 5,
      channel: 'billiard-walls',
      mode: 'daily',
    },
  },
  {
    id: 'triple-angle',
    tier: 'secret',
    title: 'Geometry Lesson',
    description: 'Land 2 bank shots.',
    hint: 'The walls are on your side.',
    goal: {
      metric: { kind: 'count', event: 'bank-shot' },
      target: 2,
    },
  },
];

function stamp(partial: Partial<StampedEvent> & { type: string }, seq = 1): StampedEvent {
  return {
    game: partial.game ?? 'tank-duel',
    mode: partial.mode ?? 'normal',
    channel: partial.channel ?? 'open-field',
    at: partial.at ?? '2026-10-25T20:00:00.000Z',
    seq,
    type: partial.type,
    ...(partial.data !== undefined ? { data: partial.data } : {}),
  };
}

describe('createPatchTracker', () => {
  it('ignores unknown games and earns a sum patch exactly when crossing the target', () => {
    const progress = fakeRepo<ProgressData>({ games: {} });
    const earnedLog: PatchEarned[] = [];
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: PATCHES }],
      progress,
      isPro: () => false,
      now: () => new Date('2026-10-25T20:00:00.000Z'),
    });

    tracker.onEarned((earned) => {
      earnedLog.push(earned);
    });

    expect(tracker.handle(stamp({ game: 'unknown-game', type: 'hit' }))).toEqual([]);
    expect(tracker.status('unknown-game')).toEqual([]);

    // Missing or non-numeric fields leave sum unchanged.
    tracker.handle(stamp({ type: 'hit' }, 1));
    tracker.handle(stamp({ type: 'hit', data: { tag: 'no-points' } }, 2));
    const sumBefore = tracker.status('tank-duel').find((s) => s.def.id === 'point-collector');
    expect(sumBefore?.value).toBe(0);
    expect(sumBefore?.earned).toBe(false);

    // 40 + 50 = 90 (below 100); next +15 = 105 crosses 100 and earns the sum patch.
    const step1 = tracker.handle(stamp({ type: 'hit', data: { points: 40 } }, 3));
    const step2 = tracker.handle(stamp({ type: 'hit', data: { points: 50 } }, 4));
    expect(step1).toEqual([]);
    expect(step2).toEqual([]);

    const crossed = tracker.handle(stamp({ type: 'hit', data: { points: 15 } }, 5));
    expect(crossed).toEqual([
      {
        game: 'tank-duel',
        patch: PATCHES[1],
        gold: false,
        at: '2026-10-25T20:00:00.000Z',
        upgradedToGold: false,
      },
    ]);

    const sumAfter = tracker.status('tank-duel').find((s) => s.def.id === 'point-collector');
    expect(sumAfter?.value).toBe(105);
    expect(sumAfter?.progress).toBe(1);
    expect(sumAfter?.earned).toBe(true);
    expect(earnedLog.some((e) => e.patch.id === 'point-collector')).toBe(true);
  });

  it('filters max patches by channel and mode and ignores non-matching events', () => {
    const progress = fakeRepo<ProgressData>({ games: {} });
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: PATCHES }],
      progress,
      isPro: () => true,
      now: () => new Date('2026-10-25T20:00:00.000Z'),
    });

    // Wrong channel or wrong mode should not update the max patch.
    tracker.handle(
      stamp({ type: 'combo', channel: 'open-field', mode: 'daily', data: { chain: 8 } }, 1),
    );
    tracker.handle(
      stamp({ type: 'combo', channel: 'billiard-walls', mode: 'normal', data: { chain: 8 } }, 2),
    );

    const before = tracker.status('tank-duel').find((s) => s.def.id === 'daily-billiard-ace');
    expect(before?.value).toBe(0);
    expect(before?.earned).toBe(false);

    // Matching channel and mode with chain 3 updates value to 3 (progress 0.6).
    tracker.handle(
      stamp({ type: 'combo', channel: 'billiard-walls', mode: 'daily', data: { chain: 3 } }, 3),
    );
    // Missing field leaves max unchanged at 3.
    tracker.handle(stamp({ type: 'combo', channel: 'billiard-walls', mode: 'daily' }, 4));
    const mid = tracker.status('tank-duel').find((s) => s.def.id === 'daily-billiard-ace');
    expect(mid?.value).toBe(3);
    expect(mid?.progress).toBeCloseTo(0.6);

    // Reaching chain 6 in matching channel and mode earns the patch in gold.
    const earned = tracker.handle(
      stamp({ type: 'combo', channel: 'billiard-walls', mode: 'daily', data: { chain: 6 } }, 5),
    );
    expect(earned).toEqual([
      {
        game: 'tank-duel',
        patch: PATCHES[2],
        gold: true,
        at: '2026-10-25T20:00:00.000Z',
        upgradedToGold: false,
      },
    ]);
  });

  it('upgrades an amateur-earned patch to gold when reached again on Pro and metric changes', () => {
    const progress = fakeRepo<ProgressData>({ games: {} });
    let proMode = false;
    let clockIso = '2026-10-25T20:00:00.000Z';
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: PATCHES }],
      progress,
      isPro: () => proMode,
      now: () => new Date(clockIso),
    });

    // Earn point-collector on Amateur.
    const firstEarn = tracker.handle(stamp({ type: 'hit', data: { points: 100 } }, 1));
    expect(firstEarn).toHaveLength(1);
    expect(firstEarn[0]?.gold).toBe(false);
    expect(firstEarn[0]?.upgradedToGold).toBe(false);

    // Turn Pro on. An event that does not change the sum metric must not upgrade it
    // (it does complete the separate count patch, which is not under test here).
    proMode = true;
    clockIso = '2026-10-25T20:05:00.000Z';
    const unchanged = tracker.handle(stamp({ type: 'hit' }, 2));
    expect(unchanged.filter((e) => e.patch.id === 'point-collector')).toEqual([]);

    // Now an event that changes the sum metric while at/above target upgrades it to gold.
    const upgraded = tracker.handle(stamp({ type: 'hit', data: { points: 10 } }, 3));
    expect(upgraded.find((e) => e.patch.id === 'point-collector')).toEqual({
      game: 'tank-duel',
      patch: PATCHES[1],
      gold: true,
      at: '2026-10-25T20:05:00.000Z',
      upgradedToGold: true,
    });

    // Further events do not re-trigger gold.
    expect(tracker.handle(stamp({ type: 'hit', data: { points: 20 } }, 4))).toEqual([]);
  });

  it('shows a secret patch hint before earning and its description after earning', () => {
    const progress = fakeRepo<ProgressData>({ games: {} });
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: PATCHES }],
      progress,
      isPro: () => false,
      now: () => new Date('2026-10-25T20:00:00.000Z'),
    });

    const before = tracker.status('tank-duel').find((s) => s.def.id === 'triple-angle');
    expect(before?.earned).toBe(false);
    expect(before?.visibleDescription).toBe('The walls are on your side.');

    tracker.handle(stamp({ type: 'bank-shot' }, 1));
    tracker.handle(stamp({ type: 'bank-shot' }, 2));

    const after = tracker.status('tank-duel').find((s) => s.def.id === 'triple-angle');
    expect(after?.earned).toBe(true);
    expect(after?.visibleDescription).toBe('Land 2 bank shots.');
  });

  it('connects to an EventBus and unsubscribes cleanly', () => {
    const progress = fakeRepo<ProgressData>({ games: {} });
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const bus = createEventBus({
      eventLog,
      now: () => new Date('2026-10-25T20:00:00.000Z'),
      schedule: (task) => {
        task();
      },
    });
    const tracker = createPatchTracker({
      games: [{ id: 'tank-duel', patches: PATCHES }],
      progress,
      isPro: () => false,
      now: () => new Date('2026-10-25T20:00:00.000Z'),
    });

    const disconnect = tracker.connect(bus);
    bus.beginSession({ game: 'tank-duel', mode: 'normal', channel: 'open-field' });
    bus.emit({ type: 'hit' });
    expect(tracker.status('tank-duel')[0]?.value).toBe(1);

    disconnect();
    bus.emit({ type: 'hit' });
    expect(tracker.status('tank-duel')[0]?.value).toBe(1);
  });
});

describe('validatePatches', () => {
  it('accepts valid patches and flags tier, id, title, hint, event, field, and target issues', () => {
    expect(validatePatches(PATCHES, EVENT_SCHEMAS)).toEqual([]);

    // Missing required tiers and too many secret patches.
    const badTiers: readonly PatchDef[] = [
      {
        id: 'sec-1',
        tier: 'secret',
        title: 'Secret One',
        description: 'Desc',
        hint: 'Hint 1',
        goal: { metric: { kind: 'count', event: 'hit' }, target: 1 },
      },
      {
        id: 'sec-2',
        tier: 'secret',
        title: 'Secret Two',
        description: 'Desc',
        goal: { metric: { kind: 'count', event: 'hit' }, target: 1 },
      },
    ];
    expect(validatePatches(badTiers, EVENT_SCHEMAS).length).toBeGreaterThanOrEqual(4);

    // Invalid id, duplicate id, long title, undeclared event, non-numeric field, non-positive target.
    const badDefs: readonly PatchDef[] = [
      {
        id: 'Bad_Id',
        tier: 'club',
        title: 'Club Patch',
        description: 'Desc',
        goal: { metric: { kind: 'count', event: 'hit' }, target: 1 },
      },
      {
        id: 'dup-patch',
        tier: 'pro',
        title: 'This Patch Title Exceeds Twenty Eight Characters',
        description: 'Desc',
        goal: { metric: { kind: 'max', event: 'hit', field: 'tag' }, target: 0 },
      },
      {
        id: 'dup-patch',
        tier: 'legend',
        title: 'Legend Patch',
        description: 'Desc',
        goal: { metric: { kind: 'sum', event: 'missing-event', field: 'points' }, target: 10 },
      },
    ];
    expect(validatePatches(badDefs, EVENT_SCHEMAS).length).toBeGreaterThanOrEqual(5);
  });
});
