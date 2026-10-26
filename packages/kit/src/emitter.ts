/**
 * The smallest possible typed event emitter. Settings, the event bus, input
 * and the store all need "tell me when this changes"; one shared shape keeps
 * every subscription returning the same kind of `Unsubscribe`.
 */

export type Unsubscribe = () => void;

export interface Emitter<T> {
  on(listener: (value: T) => void): Unsubscribe;
  emit(value: T): void;
  clear(): void;
  readonly size: number;
}

export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(value) {
      // A listener may unsubscribe itself while we iterate; copy first.
      for (const listener of [...listeners]) listener(value);
    },
    clear() {
      listeners.clear();
    },
    get size() {
      return listeners.size;
    },
  };
}
