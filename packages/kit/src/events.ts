/**
 * Game events: the one stream that patches, micro-challenges, stats and the
 * Den Life layer (prompt 01) all listen to, so a game reports what happened
 * once and never needs to know who is counting.
 *
 * A game emits plain `{ type, data }` events. The bus stamps each one with the
 * game, run mode, channel, time and a sequence number, delivers it to
 * listeners on a microtask (a slow listener can never stall the game loop,
 * and a throwing one is caught and reported), and folds the session into a
 * summary for the event log when the session ends.
 */
import type { Unsubscribe } from './emitter.ts';
import type { Repository } from './store/repos.ts';
import { EVENT_LOG_LIMIT, type EventLogData, type SessionSummary } from './store/types.ts';
import type { IsoTime, RunMode } from './types.ts';

export type EventFieldType = 'number' | 'string' | 'boolean';
export type EventValue = number | string | boolean;

/** What a game declares in its manifest for each event type it emits. */
export interface GameEventSchema {
  /** kebab-case, e.g. "splat", "round-won". */
  type: string;
  /** One line for prompt authors: when it fires and what it means. */
  description: string;
  fields?: Readonly<Record<string, EventFieldType>>;
}

export interface GameEvent {
  type: string;
  data?: Readonly<Record<string, EventValue>>;
}

export interface StampedEvent extends GameEvent {
  game: string;
  mode: RunMode;
  channel: string;
  at: IsoTime;
  /** 1, 2, 3 ... within the session. */
  seq: number;
}

/**
 * Events the kit itself emits around every session. Games must not emit
 * these types; they declare their own.
 */
export const KIT_EVENTS: readonly GameEventSchema[] = [
  { type: 'session-start', description: 'A game was mounted for play.' },
  {
    type: 'session-end',
    description: 'The player left the game or it was disposed.',
    fields: { durationMs: 'number' },
  },
  {
    type: 'result',
    description: 'A run finished and was reported through reportResult.',
    fields: { score: 'number', won: 'boolean', newBest: 'boolean' },
  },
  {
    type: 'patch-earned',
    description: 'A patch threshold was reached.',
    fields: { patch: 'string', gold: 'boolean' },
  },
];

export interface SessionInfo {
  game: string;
  mode: RunMode;
  channel: string;
}

export interface EventBus {
  /** Starts a session (ending any open one) and emits session-start. */
  beginSession(info: SessionInfo): void;
  /**
   * Stamps and queues an event for the open session. Without an open session
   * the event is dropped with a console warning. Never throws.
   */
  emit(event: GameEvent): void;
  /** Emits session-end, appends the summary to the event log and returns it; null if none was open. */
  endSession(): SessionSummary | null;
  /** Every stamped event, delivered asynchronously in emit order. */
  on(listener: (event: StampedEvent) => void): Unsubscribe;
  readonly session: (SessionInfo & { startedAt: IsoTime }) | null;
}

export interface EventBusOptions {
  eventLog: Repository<EventLogData>;
  now?: () => Date;
  /** How deliveries are deferred; tests pass a synchronous function. Default queueMicrotask. */
  schedule?: (task: () => void) => void;
}

interface ActiveSession extends SessionInfo {
  startedAt: IsoTime;
  startedAtMs: number;
  seq: number;
  counts: Record<string, number>;
  maxima: Record<string, number>;
}

const KEBAB_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KIT_EVENT_TYPES = new Set(KIT_EVENTS.map((schema) => schema.type));

export function createEventBus(options: EventBusOptions): EventBus {
  const now = options.now ?? (() => new Date());
  const schedule =
    options.schedule ??
    ((task: () => void) => {
      queueMicrotask(task);
    });
  const listeners = new Set<(event: StampedEvent) => void>();
  const pendingDeliveries: StampedEvent[] = [];
  let delivering = false;
  let active: ActiveSession | null = null;

  function deliverEvent(stamped: StampedEvent): void {
    // If a listener emits synchronously during a synchronous schedule, queue
    // the nested event so every listener finishes the current event first.
    if (delivering) {
      pendingDeliveries.push(stamped);
      return;
    }

    delivering = true;
    try {
      let current: StampedEvent | undefined = stamped;
      while (current !== undefined) {
        const snapshot = [...listeners];
        for (const listener of snapshot) {
          try {
            listener(current);
          } catch (error) {
            console.error(error);
          }
        }
        current = pendingDeliveries.shift();
      }
    } finally {
      delivering = false;
    }
  }

  function stampAndQueue(event: GameEvent, session: ActiveSession, timestamp: Date): void {
    session.seq += 1;
    const stamped: StampedEvent = {
      ...(event.data !== undefined ? { data: event.data } : {}),
      type: event.type,
      game: session.game,
      mode: session.mode,
      channel: session.channel,
      at: timestamp.toISOString(),
      seq: session.seq,
    };

    session.counts[event.type] = (session.counts[event.type] ?? 0) + 1;
    if (event.data !== undefined) {
      for (const [field, value] of Object.entries(event.data)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          const key = `${event.type}.${field}`;
          const prev = session.maxima[key];
          if (prev === undefined || value > prev) {
            session.maxima[key] = value;
          }
        }
      }
    }

    schedule(() => {
      deliverEvent(stamped);
    });
  }

  function endSession(): SessionSummary | null {
    if (active === null) {
      return null;
    }
    const closing = active;
    const endedDate = now();
    const endedAt = endedDate.toISOString();
    const durationMs = Math.max(0, endedDate.getTime() - closing.startedAtMs);

    stampAndQueue({ type: 'session-end', data: { durationMs } }, closing, endedDate);

    const summary: SessionSummary = {
      game: closing.game,
      mode: closing.mode,
      channel: closing.channel,
      startedAt: closing.startedAt,
      endedAt,
      durationMs,
      counts: { ...closing.counts },
      maxima: { ...closing.maxima },
    };

    options.eventLog.update((draft) => {
      draft.sessions.push(summary);
      if (draft.sessions.length > EVENT_LOG_LIMIT) {
        draft.sessions.splice(0, draft.sessions.length - EVENT_LOG_LIMIT);
      }
    });

    active = null;
    return summary;
  }

  function beginSession(info: SessionInfo): void {
    if (active !== null) {
      endSession();
    }
    const startedDate = now();
    active = {
      game: info.game,
      mode: info.mode,
      channel: info.channel,
      startedAt: startedDate.toISOString(),
      startedAtMs: startedDate.getTime(),
      seq: 0,
      counts: {},
      maxima: {},
    };
    stampAndQueue({ type: 'session-start' }, active, startedDate);
  }

  function emit(event: GameEvent): void {
    if (active === null) {
      console.warn(`Dropped event "${event.type}" because no session is open.`);
      return;
    }
    stampAndQueue(event, active, now());
  }

  return {
    beginSession,
    emit,
    endSession,
    on(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get session() {
      if (active === null) {
        return null;
      }
      return {
        game: active.game,
        mode: active.mode,
        channel: active.channel,
        startedAt: active.startedAt,
      };
    },
  };
}

/**
 * Problems with an emitted event against the declared schemas: unknown type,
 * a kit-reserved type, unknown fields, or fields of the wrong type. Used by
 * the dev build and tests; production never blocks an event over it.
 */
export function validateEvent(event: GameEvent, schemas: readonly GameEventSchema[]): string[] {
  const problems: string[] = [];

  if (KIT_EVENT_TYPES.has(event.type)) {
    problems.push(`Event type "${event.type}" is reserved by the kit.`);
    return problems;
  }

  const schema = schemas.find((item) => item.type === event.type);
  if (schema === undefined) {
    problems.push(`Unknown event type "${event.type}".`);
    return problems;
  }

  if (event.data !== undefined) {
    const declaredFields = schema.fields ?? {};
    for (const [field, value] of Object.entries(event.data)) {
      const expectedType = declaredFields[field];
      if (expectedType === undefined) {
        problems.push(`Unknown field "${field}" on event "${event.type}".`);
      } else if (expectedType === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          problems.push(`Field "${field}" on event "${event.type}" must be a finite number.`);
        }
      } else if (typeof value !== expectedType) {
        problems.push(`Field "${field}" on event "${event.type}" must be a ${expectedType}.`);
      }
    }
  }

  return problems;
}

/** Problems with a manifest's event list: duplicate or reserved types, non-kebab names. */
export function validateEventSchemas(schemas: readonly GameEventSchema[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const schema of schemas) {
    if (!KEBAB_ID_RE.test(schema.type)) {
      problems.push(`Event type "${schema.type}" must be kebab-case.`);
    }
    if (KIT_EVENT_TYPES.has(schema.type)) {
      problems.push(`Event type "${schema.type}" is reserved by the kit.`);
    }
    if (seen.has(schema.type)) {
      problems.push(`Duplicate event type "${schema.type}".`);
    } else {
      seen.add(schema.type);
    }
    if (schema.description.trim().length === 0) {
      problems.push(`Event "${schema.type}" must have a non-empty description.`);
    }
  }

  return problems;
}
