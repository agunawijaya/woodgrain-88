/**
 * In-memory Repository implementation for unit tests so progression modules
 * can be tested in isolation from the persistent store.
 */
import { createEmitter } from '../../src/emitter.ts';
import type { Repository } from '../../src/store/repos.ts';

export function fakeRepo<T>(initial: T): Repository<T> {
  let current = structuredClone(initial);
  const emitter = createEmitter<T>();

  return {
    get() {
      return current;
    },
    set(value) {
      current = structuredClone(value);
      emitter.emit(current);
    },
    update(change) {
      const draft = structuredClone(current);
      const replaced = change(draft) as T | undefined;
      current = replaced ?? draft;
      emitter.emit(current);
      return current;
    },
    reset() {
      current = structuredClone(initial);
      emitter.emit(current);
    },
    onChange(listener) {
      return emitter.on(listener);
    },
  };
}
