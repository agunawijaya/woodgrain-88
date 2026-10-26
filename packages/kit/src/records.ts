/**
 * Personal records per game, channel and run mode: the best run and the top
 * ten, each with its date, seed and duration so a run can be replayed or
 * shared as a challenge. Players are never asked for initials; every record
 * is theirs.
 */
import type { Repository } from './store/repos.ts';
import { RECORDS_PER_BOARD, type RecordsData, type RunRecord } from './store/types.ts';
import type { RunMode, ScoreOrder } from './types.ts';

export interface SubmitOutcome {
  /** 1-based place on the board, or null when the run did not make the top ten. */
  rank: number | null;
  /** Better than every earlier run on this board (true for the first run too). */
  newBest: boolean;
}

export interface RecordsBook {
  /** Best first; at most RECORDS_PER_BOARD. */
  top(gameId: string, channel: string, mode: RunMode): RunRecord[];
  /** The best run on one board. */
  best(gameId: string, channel: string, mode: RunMode): RunRecord | null;
  /** The best run across every board of a game (for cards and the game details). */
  bestOverall(gameId: string, order: ScoreOrder): RunRecord | null;
  /** Inserts a run in order (ties keep the earlier run first) and trims the board. */
  submit(gameId: string, run: RunRecord, order: ScoreOrder): SubmitOutcome;
  /** Removes every board of a game. */
  forget(gameId: string): void;
}

/** `${gameId}/${channel}/${mode}` */
export function boardKey(gameId: string, channel: string, mode: RunMode): string {
  return `${gameId}/${channel}/${mode}`;
}

/** Negative when `a` is the better run under `order`. */
export function compareRuns(a: RunRecord, b: RunRecord, order: ScoreOrder): number {
  if (a.score === b.score) return 0;
  return order === 'higher' ? b.score - a.score : a.score - b.score;
}

export function createRecordsBook(repo: Repository<RecordsData>): RecordsBook {
  return {
    top(gameId, channel, mode) {
      const board = repo.get().boards[boardKey(gameId, channel, mode)] ?? [];
      return board.slice(0, RECORDS_PER_BOARD).map((run) => ({ ...run }));
    },
    best(gameId, channel, mode) {
      const first = repo.get().boards[boardKey(gameId, channel, mode)]?.[0];
      return first ? { ...first } : null;
    },
    bestOverall(gameId, order) {
      const prefix = `${gameId}/`;
      let bestRun: RunRecord | null = null;
      for (const [key, board] of Object.entries(repo.get().boards)) {
        if (!key.startsWith(prefix)) continue;
        for (const run of board) {
          if (bestRun === null || compareRuns(run, bestRun, order) < 0) {
            bestRun = run;
          }
        }
      }
      return bestRun ? { ...bestRun } : null;
    },
    submit(gameId, run, order) {
      const key = boardKey(gameId, run.channel, run.mode);
      let outcome: SubmitOutcome = { rank: null, newBest: false };

      repo.update((draft) => {
        const existing = draft.boards[key] ?? [];
        let insertIndex = existing.length;
        for (let i = 0; i < existing.length; i++) {
          const candidate = existing[i];
          if (candidate !== undefined && compareRuns(run, candidate, order) < 0) {
            insertIndex = i;
            break;
          }
        }

        const next = [...existing];
        next.splice(insertIndex, 0, { ...run });
        draft.boards[key] = next.slice(0, RECORDS_PER_BOARD);

        const rank = insertIndex < RECORDS_PER_BOARD ? insertIndex + 1 : null;
        outcome = { rank, newBest: rank === 1 };
      });

      return outcome;
    },
    forget(gameId) {
      const prefix = `${gameId}/`;
      repo.update((draft) => {
        const boards: Record<string, RunRecord[]> = {};
        for (const [key, value] of Object.entries(draft.boards)) {
          if (!key.startsWith(prefix)) {
            boards[key] = value;
          }
        }
        draft.boards = boards;
      });
    },
  };
}
