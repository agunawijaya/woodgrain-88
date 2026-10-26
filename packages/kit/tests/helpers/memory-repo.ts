/**
 * An in-memory `Repository<T>` for unit tests that exercise modules built on
 * top of repositories without touching `localStorage` or schema migrations.
 */
import { createEmitter } from '../../src/emitter.ts';
import type { Repository } from '../../src/store/repos.ts';

export function memoryRepo<T>(initial: T): Repository<T> {
  let current = structuredClone(initial);
  const changes = createEmitter<T>();

  return {
    get() {
      return current;
    },
    set(value) {
      current = structuredClone(value);
      changes.emit(current);
    },
    update(change) {
      const draft = structuredClone(current);
      const result = change(draft);
      current = result ?? draft;
      changes.emit(current);
      return current;
    },
    reset() {
      current = structuredClone(initial);
      changes.emit(current);
    },
    onChange(listener) {
      return changes.on(listener);
    },
  };
}
