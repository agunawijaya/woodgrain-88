/**
 * Play statistics per game and for the whole collection: plays, best score,
 * time played, when last played and local versus wins per seat. The Records
 * page and The Counter read them; nothing here is ever a reason to nag.
 */
import type { Seat } from './input.ts';
import type { Repository } from './store/repos.ts';
import type { GameStatsData, StatsData } from './store/types.ts';
import type { IsoTime, ScoreOrder } from './types.ts';

export interface PlayReport {
  durationMs: number;
  /** Omitted for runs without a score. */
  score?: number;
  order: ScoreOrder;
  /** The winning seat of a local versus match. */
  versusWinner?: Seat;
}

export interface CollectionTotals {
  plays: number;
  timePlayedMs: number;
  /** Games played at least once. */
  gamesPlayed: number;
  lastPlayedAt: IsoTime | null;
  versusMatches: number;
}

export interface StatsBook {
  /** A game's stats; zeros (and best null) for a game never played. */
  game(gameId: string): GameStatsData;
  /** Adds one play and returns the updated stats. */
  recordPlay(gameId: string, report: PlayReport): GameStatsData;
  totals(): CollectionTotals;
  forget(gameId: string): void;
}

function emptyGameStats(): GameStatsData {
  return {
    plays: 0,
    best: null,
    timePlayedMs: 0,
    lastPlayedAt: null,
    versusWins: { 1: 0, 2: 0 },
  };
}

function cloneGameStats(stats: GameStatsData): GameStatsData {
  return {
    plays: stats.plays,
    best: stats.best,
    timePlayedMs: stats.timePlayedMs,
    lastPlayedAt: stats.lastPlayedAt,
    versusWins: { 1: stats.versusWins[1], 2: stats.versusWins[2] },
  };
}

export function createStatsBook(
  repo: Repository<StatsData>,
  now: () => Date = () => new Date(),
): StatsBook {
  return {
    game(gameId) {
      const existing = repo.get().games[gameId];
      return existing ? cloneGameStats(existing) : emptyGameStats();
    },
    recordPlay(gameId, report) {
      let updated = emptyGameStats();
      repo.update((draft) => {
        const current = draft.games[gameId] ?? emptyGameStats();
        const addedDuration =
          Number.isFinite(report.durationMs) && report.durationMs > 0 ? report.durationMs : 0;

        let best = current.best;
        if (report.score !== undefined && Number.isFinite(report.score)) {
          if (best === null) {
            best = report.score;
          } else if (report.order === 'higher') {
            best = Math.max(best, report.score);
          } else {
            best = Math.min(best, report.score);
          }
        }

        updated = {
          plays: current.plays + 1,
          best,
          timePlayedMs: current.timePlayedMs + addedDuration,
          lastPlayedAt: now().toISOString(),
          versusWins: {
            1: current.versusWins[1] + (report.versusWinner === 1 ? 1 : 0),
            2: current.versusWins[2] + (report.versusWinner === 2 ? 1 : 0),
          },
        };
        draft.games[gameId] = updated;
      });
      return cloneGameStats(updated);
    },
    totals() {
      let plays = 0;
      let timePlayedMs = 0;
      let gamesPlayed = 0;
      let lastPlayedAt: IsoTime | null = null;
      let versusMatches = 0;

      for (const entry of Object.values(repo.get().games)) {
        plays += entry.plays;
        timePlayedMs += entry.timePlayedMs;
        if (entry.plays > 0) gamesPlayed += 1;
        versusMatches += entry.versusWins[1] + entry.versusWins[2];
        if (entry.lastPlayedAt !== null) {
          const isNewer =
            lastPlayedAt === null || Date.parse(entry.lastPlayedAt) > Date.parse(lastPlayedAt);
          if (isNewer) lastPlayedAt = entry.lastPlayedAt;
        }
      }

      return {
        plays,
        timePlayedMs,
        gamesPlayed,
        lastPlayedAt,
        versusMatches,
      };
    },
    forget(gameId) {
      repo.update((draft) => {
        const games: Record<string, GameStatsData> = {};
        for (const [key, value] of Object.entries(draft.games)) {
          if (key !== gameId) {
            games[key] = value;
          }
        }
        draft.games = games;
      });
    },
  };
}
