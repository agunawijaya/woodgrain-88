/**
 * The Versus Night series in progress. It lives here, in memory, rather than
 * in a view, because a series outlasts every screen it passes through: the
 * chalkboard, each game in turn, the results, and the Den, whose little
 * chalkboard shows the same score. Only finished series reach the store
 * (`recordSeries`); closing the tab mid-series simply ends the night.
 */
import { createEmitter, seatName, type Unsubscribe, type VersusSeries } from '@woodgrain-88/kit';
import type { ChalkboardScore } from '../den/chalkboard.ts';
import type { Registry } from '../data/registry.ts';

export interface VersusNight {
  series(): VersusSeries | null;
  set(series: VersusSeries | null): void;
  /** The series as the chalkboards write it; null when no series is running. */
  current(): ChalkboardScore | null;
  onChange(listener: () => void): Unsubscribe;
}

export function createVersusNight(registry: Pick<Registry, 'manifests'>): VersusNight {
  let series: VersusSeries | null = null;
  const changes = createEmitter<undefined>();

  const current = (): ChalkboardScore | null => {
    if (!series) return null;
    const [first, second] = series.setup.seats;
    const playing = series.phase === 'playing' || series.phase === 'between' ? series.current : null;
    const title = playing ? registry.manifests.find((manifest) => manifest.id === playing)?.title : undefined;
    return {
      names: [seatName(first), seatName(second)],
      wins: series.wins,
      bestOf: series.setup.bestOf,
      winner: series.winner,
      ...(title === undefined ? {} : { nowPlaying: title }),
    };
  };

  return {
    series: () => series,
    set(next) {
      series = next;
      changes.emit(undefined);
    },
    current,
    onChange: (listener) => changes.on(listener),
  };
}
