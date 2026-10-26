/**
 * The Power Cycle Run in progress. Like a Versus Night series it outlives
 * the screens it passes through (the Den's automatic power flips, each
 * game's 45 seconds, the way back), so it lives here in memory. Finished
 * runs go to the store as records; an abandoned one is simply dropped.
 */
import { createEmitter, type RunState, type Unsubscribe } from '@woodgrain-88/kit';

export type RunKind = 'free' | 'daily';

export interface PowerRun {
  state(): RunState | null;
  kind(): RunKind;
  set(state: RunState | null, kind?: RunKind): void;
  onChange(listener: () => void): Unsubscribe;
}

export function createPowerRun(): PowerRun {
  let current: RunState | null = null;
  let kind: RunKind = 'free';
  const changes = createEmitter<undefined>();
  return {
    state: () => current,
    kind: () => kind,
    set(state, nextKind) {
      current = state;
      if (nextKind) kind = nextKind;
      changes.emit(undefined);
    },
    onChange: (listener) => changes.on(listener),
  };
}
