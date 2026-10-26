/**
 * Undo and redo history manager for jacket layout changes.
 *
 * Keeps a bounded ring of past states and a redo stack that clears whenever
 * the player makes a fresh edit.
 */

export interface History<T> {
  readonly current: T;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Record a new state; clears redo. Keeps at most `limit` past states (default 50). */
  push(next: T): void;
  undo(): T;
  redo(): T;
}

export function createHistory<T>(initial: T, limit = 50): History<T> {
  let current: T = initial;
  const past: T[] = [];
  const future: T[] = [];
  const maxLimit = Math.max(1, limit);

  return {
    get current(): T {
      return current;
    },
    get canUndo(): boolean {
      return past.length > 0;
    },
    get canRedo(): boolean {
      return future.length > 0;
    },
    push(next: T): void {
      past.push(current);
      if (past.length > maxLimit) {
        past.shift();
      }
      current = next;
      future.length = 0;
    },
    undo(): T {
      if (past.length === 0) {
        return current;
      }
      const prev = past.pop();
      if (prev !== undefined) {
        future.push(current);
        current = prev;
      }
      return current;
    },
    redo(): T {
      if (future.length === 0) {
        return current;
      }
      const next = future.pop();
      if (next !== undefined) {
        past.push(current);
        if (past.length > maxLimit) {
          past.shift();
        }
        current = next;
      }
      return current;
    },
  };
}
