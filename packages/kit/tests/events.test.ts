/**
 * Unit tests for the game event bus and event schema validators.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createEventBus,
  type GameEventSchema,
  type StampedEvent,
  validateEvent,
  validateEventSchemas,
} from '../src/events.ts';
import { EVENT_LOG_LIMIT, type EventLogData } from '../src/store/types.ts';
import { fakeRepo } from './helpers/fake-repo.ts';

function makeClock(startIso = '2026-10-25T18:00:00.000Z') {
  let ms = Date.parse(startIso);
  return {
    now: () => new Date(ms),
    advance: (deltaMs: number) => {
      ms += deltaMs;
    },
  };
}

describe('createEventBus', () => {
  it('starts a session, stamps events in order, and summarizes on endSession', () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const received: StampedEvent[] = [];
    const bus = createEventBus({
      eventLog,
      now: clock.now,
      schedule: (task) => {
        task();
      },
    });

    bus.on((event) => {
      received.push(event);
    });

    bus.beginSession({ game: 'paint-tanks', mode: 'normal', channel: 'open-field' });
    expect(bus.session).toEqual({
      game: 'paint-tanks',
      mode: 'normal',
      channel: 'open-field',
      startedAt: '2026-10-25T18:00:00.000Z',
    });

    clock.advance(1500);
    bus.emit({ type: 'splat', data: { distance: 40, label: 'far' } });

    clock.advance(2000);
    bus.emit({ type: 'splat', data: { distance: 95, label: 'direct' } });

    clock.advance(1500);
    const summary = bus.endSession();

    expect(bus.session).toBeNull();
    expect(bus.endSession()).toBeNull();

    expect(received.map((e) => ({ type: e.type, seq: e.seq }))).toEqual([
      { type: 'session-start', seq: 1 },
      { type: 'splat', seq: 2 },
      { type: 'splat', seq: 3 },
      { type: 'session-end', seq: 4 },
    ]);

    expect(received[1]).toEqual({
      type: 'splat',
      data: { distance: 40, label: 'far' },
      game: 'paint-tanks',
      mode: 'normal',
      channel: 'open-field',
      at: '2026-10-25T18:00:01.500Z',
      seq: 2,
    });

    expect(summary).toEqual({
      game: 'paint-tanks',
      mode: 'normal',
      channel: 'open-field',
      startedAt: '2026-10-25T18:00:00.000Z',
      endedAt: '2026-10-25T18:00:05.000Z',
      durationMs: 5000,
      counts: {
        'session-start': 1,
        splat: 2,
        'session-end': 1,
      },
      maxima: {
        'splat.distance': 95,
        'session-end.durationMs': 5000,
      },
    });
    expect(eventLog.get().sessions).toEqual([summary]);
  });

  it('ends an already-open session before beginning a new one', () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const received: StampedEvent[] = [];
    const bus = createEventBus({
      eventLog,
      now: clock.now,
      schedule: (task) => {
        task();
      },
    });

    bus.on((event) => {
      received.push(event);
    });

    bus.beginSession({ game: 'game-one', mode: 'normal', channel: 'ch-1' });
    clock.advance(3000);
    bus.beginSession({ game: 'game-two', mode: 'daily', channel: 'ch-2' });

    expect(eventLog.get().sessions).toHaveLength(1);
    expect(eventLog.get().sessions[0]?.game).toBe('game-one');
    expect(eventLog.get().sessions[0]?.durationMs).toBe(3000);
    expect(bus.session?.game).toBe('game-two');
    expect(received.map((e) => `${e.game}:${e.type}:${e.seq}`)).toEqual([
      'game-one:session-start:1',
      'game-one:session-end:2',
      'game-two:session-start:1',
    ]);
  });

  it('caps the event log at EVENT_LOG_LIMIT keeping the newest sessions', () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const bus = createEventBus({
      eventLog,
      now: clock.now,
      schedule: (task) => {
        task();
      },
    });

    for (let i = 0; i < EVENT_LOG_LIMIT + 5; i += 1) {
      bus.beginSession({ game: `game-${i}`, mode: 'normal', channel: 'main' });
      clock.advance(100);
      bus.endSession();
    }

    const sessions = eventLog.get().sessions;
    expect(sessions).toHaveLength(EVENT_LOG_LIMIT);
    expect(sessions[0]?.game).toBe('game-5');
    expect(sessions[EVENT_LOG_LIMIT - 1]?.game).toBe(`game-${EVENT_LOG_LIMIT + 4}`);
  });

  it('warns once per call and drops events emitted without an open session', () => {
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const received: StampedEvent[] = [];
    const bus = createEventBus({
      eventLog,
      schedule: (task) => {
        task();
      },
    });

    bus.on((event) => {
      received.push(event);
    });

    bus.emit({ type: 'splat' });
    bus.emit({ type: 'splat' });

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(received).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('delivers one task per event and preserves order across synchronous schedule calls', () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const tasks: (() => void)[] = [];
    const bus = createEventBus({
      eventLog,
      now: clock.now,
      schedule: (task) => {
        tasks.push(task);
      },
    });

    const types: string[] = [];
    bus.on((event) => {
      types.push(event.type);
    });

    bus.beginSession({ game: 'sky-ace', mode: 'normal', channel: 'day' });
    bus.emit({ type: 'takeoff' });
    bus.emit({ type: 'cloud-pass' });
    bus.emit({ type: 'landing' });

    expect(tasks).toHaveLength(4);
    expect(types).toEqual([]);

    for (const task of tasks) {
      task();
    }
    expect(types).toEqual(['session-start', 'takeoff', 'cloud-pass', 'landing']);
  });

  it('does not deliver the current event to a listener added during delivery', () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const bus = createEventBus({
      eventLog,
      now: clock.now,
      schedule: (task) => {
        task();
      },
    });

    bus.beginSession({ game: 'sky-ace', mode: 'normal', channel: 'day' });

    const lateSeen: string[] = [];
    let addedLate = false;
    bus.on(() => {
      if (!addedLate) {
        addedLate = true;
        bus.on((event) => {
          lateSeen.push(event.type);
        });
      }
    });

    bus.emit({ type: 'first-wave' });
    bus.emit({ type: 'second-wave' });

    expect(lateSeen).toEqual(['second-wave']);
  });

  it('catches and reports a throwing listener with console.error without stopping others', () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createEventBus({
      eventLog,
      now: clock.now,
      schedule: (task) => {
        task();
      },
    });

    const afterThrow: string[] = [];
    bus.on(() => {
      throw new Error('listener failure');
    });
    bus.on((event) => {
      afterThrow.push(event.type);
    });

    bus.beginSession({ game: 'sky-ace', mode: 'normal', channel: 'day' });
    bus.emit({ type: 'boost' });

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(afterThrow).toEqual(['session-start', 'boost']);
    errorSpy.mockRestore();
  });

  it('uses queueMicrotask by default for asynchronous delivery', async () => {
    const clock = makeClock();
    const eventLog = fakeRepo<EventLogData>({ sessions: [] });
    const bus = createEventBus({ eventLog, now: clock.now });
    const seen: string[] = [];

    bus.on((event) => {
      seen.push(event.type);
    });

    bus.beginSession({ game: 'sky-ace', mode: 'normal', channel: 'day' });
    bus.emit({ type: 'ring' });
    expect(seen).toEqual([]);

    await Promise.resolve();
    expect(seen).toEqual(['session-start', 'ring']);
  });
});

describe('validateEvent and validateEventSchemas', () => {
  const schemas: readonly GameEventSchema[] = [
    {
      type: 'splat',
      description: 'A paint shell hit an opponent tank.',
      fields: { distance: 'number', ricochet: 'boolean', tag: 'string' },
    },
    {
      type: 'round-won',
      description: 'The player won the round.',
    },
  ];

  it('accepts valid events and flags unknown, kit-reserved, extra-field, and wrong-type events', () => {
    const valid = { type: 'splat', data: { distance: 25, ricochet: true, tag: 'bank' } };
    expect(validateEvent(valid, schemas)).toEqual([]);
    expect(validateEvent({ type: 'round-won' }, schemas)).toEqual([]);

    expect(validateEvent({ type: 'unknown-event' }, schemas).length).toBeGreaterThan(0);
    expect(validateEvent({ type: 'session-start' }, schemas).length).toBeGreaterThan(0);
    expect(validateEvent({ type: 'result' }, schemas).length).toBeGreaterThan(0);

    const extraField = validateEvent({ type: 'splat', data: { undeclared: 1 } }, schemas);
    const wrongType = validateEvent({ type: 'splat', data: { distance: 'far' } }, schemas);
    const nanNumber = validateEvent({ type: 'splat', data: { distance: Number.NaN } }, schemas);
    expect(extraField.length).toBeGreaterThan(0);
    expect(wrongType.length).toBeGreaterThan(0);
    expect(nanNumber.length).toBeGreaterThan(0);
  });

  it('validates event schema lists for duplicates, kit types, kebab-case, and descriptions', () => {
    expect(validateEventSchemas(schemas)).toEqual([]);

    const badSchemas: readonly GameEventSchema[] = [
      { type: 'splat', description: 'First declaration.' },
      { type: 'splat', description: 'Duplicate declaration.' },
      { type: 'session-end', description: 'Reserved kit type.' },
      { type: 'Bad_Type', description: 'Not kebab-case.' },
      { type: 'empty-desc', description: '   ' },
    ];

    const problems = validateEventSchemas(badSchemas);
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });
});
