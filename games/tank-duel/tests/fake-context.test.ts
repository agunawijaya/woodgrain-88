// @vitest-environment happy-dom
/**
 * Tests for the dev fake GameContext: seat derivation, in-memory settings,
 * versioned saves, score ranking, loop pausing, appearance and switch notifications,
 * and event recording.
 */
import { describe, expect, it, vi } from 'vitest';
import type { DifficultySwitches, GameEvent, GameResult, RunInfo } from '@woodgrain-88/kit';
import { manifest } from '../src/manifest.ts';
import { createFakeContext, type FakeContextOptions } from '../src/dev/fake-context.ts';

function createTestOptions(overrides: Partial<FakeContextOptions> = {}): FakeContextOptions {
  const host = document.createElement('div');
  const run: RunInfo = {
    mode: 'normal',
    seed: 12345,
    channel: 'game-1',
  };
  const switches: DifficultySwitches = { left: 'B', right: 'B' };

  return {
    manifest,
    host,
    run,
    kid: 'lou',
    appearance: 'light',
    reducedMotion: false,
    switches,
    chrome: {
      openPause: vi.fn(),
      openSettings: vi.fn(),
      openHowToPlay: vi.fn(),
      backToHall: vi.fn(),
      viewChanged: vi.fn(),
    },
    ...overrides,
  };
}

describe('fake context', () => {
  it('seats from kid and from person', () => {
    const botOptions = createTestOptions({ kid: 'lou' });
    const botFake = createFakeContext(botOptions);
    expect(botFake.context.seats).toEqual([
      { seat: 1, kind: 'human', name: 'Player 1' },
      { seat: 2, kind: 'bot', kid: 'lou', name: 'Grandpa Lou' },
    ]);
    botFake.dispose();

    const personOptions = createTestOptions({ kid: null });
    const personFake = createFakeContext(personOptions);
    expect(personFake.context.seats).toEqual([
      { seat: 1, kind: 'human', name: 'Player 1' },
      { seat: 2, kind: 'human', name: 'Player 2' },
    ]);
    personFake.dispose();
  });

  it('the settings store round trip', () => {
    const fake = createFakeContext(createTestOptions());
    const store = fake.context.settings.game;

    expect(store.get('volume', 100)).toBe(100);

    store.set('volume', 42);
    expect(store.get('volume', 100)).toBe(42);

    store.set('wiring', true);
    expect(store.get('wiring', false)).toBe(true);

    fake.context.forgetGameData();
    expect(store.get('volume', 100)).toBe(100);
    expect(store.get('wiring', false)).toBe(false);

    fake.dispose();
  });

  it('the save slot honours versions', () => {
    const fake = createFakeContext(createTestOptions());
    const save = fake.context.save;

    expect(save.load(1)).toBeNull();

    save.store(1, { progress: 'level-3' });
    expect(save.load(1)).toEqual({ progress: 'level-3' });
    expect(save.load(2)).toBeNull();

    save.clear();
    expect(save.load(1)).toBeNull();

    fake.dispose();
  });

  it('reportResult ranks a better score first and sets newBest', () => {
    const fake = createFakeContext(createTestOptions());

    const result1: GameResult = {
      score: 10,
      scoreLabel: '10 hits',
      durationMs: 30000,
      presentation: 'game',
    };
    const receipt1 = fake.context.reportResult(result1);
    expect(receipt1.newBest).toBe(true);
    expect(receipt1.rank).toBe(1);
    expect(fake.context.records.best('game-1', 'normal')?.score).toBe(10);
    expect(fake.context.records.top('game-1', 'normal').map((r) => r.score)).toEqual([10]);

    const result2: GameResult = {
      score: 25,
      scoreLabel: '25 hits',
      durationMs: 45000,
      presentation: 'game',
    };
    const receipt2 = fake.context.reportResult(result2);
    expect(receipt2.newBest).toBe(true);
    expect(receipt2.rank).toBe(1);
    expect(fake.context.records.best('game-1', 'normal')?.score).toBe(25);
    expect(fake.context.records.top('game-1', 'normal').map((r) => r.score)).toEqual([25, 10]);

    const result3: GameResult = {
      score: 15,
      scoreLabel: '15 hits',
      durationMs: 40000,
      presentation: 'game',
    };
    const receipt3 = fake.context.reportResult(result3);
    expect(receipt3.newBest).toBe(false);
    expect(receipt3.rank).toBe(2);
    expect(fake.context.records.best('game-1', 'normal')?.score).toBe(25);
    expect(fake.context.records.top('game-1', 'normal').map((r) => r.score)).toEqual([25, 15, 10]);

    expect(fake.log.results).toEqual([result1, result2, result3]);

    fake.context.forgetGameData();
    expect(fake.context.records.best('game-1', 'normal')).toBeNull();
    expect(fake.context.records.top('game-1', 'normal')).toEqual([]);

    fake.dispose();
  });

  it('setPaused pauses the loops it made', () => {
    const fake = createFakeContext(createTestOptions());
    const loop = fake.context.createLoop({
      mode: 'turns',
      render: vi.fn(),
    });

    loop.start();
    expect(loop.running).toBe(true);
    expect(loop.paused).toBe(false);

    fake.setPaused(true);
    expect(loop.paused).toBe(true);

    fake.setPaused(false);
    expect(loop.paused).toBe(false);

    fake.dispose();
    expect(loop.running).toBe(false);
  });

  it('setAppearance notifies', () => {
    const fake = createFakeContext(createTestOptions({ appearance: 'light' }));
    const onAppearanceListener = vi.fn();

    const unsub = fake.context.settings.onAppearance(onAppearanceListener);
    expect(fake.context.settings.appearance()).toBe('light');

    fake.setAppearance('dark');
    expect(onAppearanceListener).toHaveBeenCalledWith('dark');
    expect(fake.context.settings.appearance()).toBe('dark');

    unsub();
    fake.setAppearance('light');
    expect(onAppearanceListener).toHaveBeenCalledTimes(1);

    fake.dispose();
  });

  it('setSwitches notifies', () => {
    const fake = createFakeContext(createTestOptions({ switches: { left: 'B', right: 'B' } }));
    const onChangeListener = vi.fn();

    const unsub = fake.context.difficulty.onChange(onChangeListener);
    expect(fake.context.difficulty.get()).toEqual({ left: 'B', right: 'B' });

    fake.setSwitches({ left: 'A', right: 'B' });
    expect(onChangeListener).toHaveBeenCalledWith({ left: 'A', right: 'B' });
    expect(fake.context.difficulty.get()).toEqual({ left: 'A', right: 'B' });

    unsub();
    fake.setSwitches({ left: 'A', right: 'A' });
    expect(onChangeListener).toHaveBeenCalledTimes(1);

    fake.dispose();
  });

  it('emit records events', () => {
    const fake = createFakeContext(createTestOptions());
    const event: GameEvent = {
      type: 'hit',
      data: { bounces: 1 },
    };

    fake.context.emit(event);
    expect(fake.log.events).toEqual([event]);

    fake.dispose();
  });
});
