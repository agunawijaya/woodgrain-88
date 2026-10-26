/**
 * Tests for the typed event emitter: listener notification, unsubscription,
 * re-entrant unsubscription during emit, clear, and size tracking.
 */
import { describe, expect, it } from 'vitest';
import { createEmitter } from '../src/emitter.ts';

describe('emitter', () => {
  it('delivers emitted values to all registered listeners', () => {
    const emitter = createEmitter<string>();
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    emitter.on((val) => {
      receivedA.push(val);
    });
    emitter.on((val) => {
      receivedB.push(val);
    });

    emitter.emit('first');
    emitter.emit('second');

    expect(receivedA).toEqual(['first', 'second']);
    expect(receivedB).toEqual(['first', 'second']);
  });

  it('stops delivering values after unsubscribe is invoked', () => {
    const emitter = createEmitter<number>();
    const received: number[] = [];
    const unsubscribe = emitter.on((val) => {
      received.push(val);
    });

    emitter.emit(10);
    unsubscribe();
    // Subsequent calls to unsubscribe must be idempotent and safe
    unsubscribe();
    emitter.emit(20);

    expect(received).toEqual([10]);
  });

  it('allows a listener to unsubscribe during emit without skipping other listeners', () => {
    const emitter = createEmitter<string>();
    const order: string[] = [];

    const unsubscribeFirst = emitter.on((val) => {
      order.push(`first:${val}`);
      unsubscribeFirst();
    });

    emitter.on((val) => {
      order.push(`second:${val}`);
    });

    emitter.emit('call-1');
    expect(order).toEqual(['first:call-1', 'second:call-1']);

    emitter.emit('call-2');
    expect(order).toEqual(['first:call-1', 'second:call-1', 'second:call-2']);
  });

  it('tracks listener counts with size and clears all listeners with clear', () => {
    const emitter = createEmitter<number>();
    expect(emitter.size).toBe(0);

    let calls1 = 0;
    let calls2 = 0;
    const unsub1 = emitter.on(() => {
      calls1++;
    });
    expect(emitter.size).toBe(1);

    const unsub2 = emitter.on(() => {
      calls2++;
    });
    expect(emitter.size).toBe(2);

    unsub1();
    expect(emitter.size).toBe(1);

    emitter.clear();
    expect(emitter.size).toBe(0);

    unsub2();
    expect(emitter.size).toBe(0);
    expect(calls1).toBe(0);
    expect(calls2).toBe(0);
  });
});
