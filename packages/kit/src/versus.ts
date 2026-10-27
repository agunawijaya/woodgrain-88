/**
 * Versus Night: series state machine and data-folding helpers.
 *
 * Runs a best-of-3 or best-of-5 competition between two seats on one machine,
 * drawing games like a raffle from a pool using the kit's seeded RNG. Missing
 * human seats are filled by Neighbourhood Kids. Series are fully reproducible
 * from their seeds and fold into stored VersusData.
 */
import type { Seat } from './input.ts';
import { KIDS, type KidId } from './kids.ts';
import { validateDisplayName } from './profile.ts';
import { createRng } from './rng.ts';
import {
  VERSUS_RECENT_LIMIT,
  type RivalryData,
  type VersusData,
  type VersusSeriesRecord,
} from './store/types.ts';
import type { IsoTime } from './types.ts';

export type VersusSeat = { kind: 'human'; name: string } | { kind: 'kid'; kid: KidId };

export interface VersusSetup {
  seats: [VersusSeat, VersusSeat];
  bestOf: 3 | 5;
  /** Game ids to draw from; at least one. */
  pool: readonly string[];
  seed: number;
}

export type VersusPhase = 'drawing' | 'playing' | 'between' | 'finished';

export interface VersusGameResult {
  game: string;
  /** Null for a drawn game, which counts for nobody and is played again from a new draw. */
  winner: Seat | null;
}

export interface VersusSeries {
  readonly setup: VersusSetup;
  readonly phase: VersusPhase;
  readonly games: readonly VersusGameResult[];
  /** The game drawn for the current or next match; null before the first draw. */
  readonly current: string | null;
  readonly wins: readonly [number, number];
  readonly winner: Seat | null;
  /** How many draws have been made, so the raffle stays reproducible. */
  readonly draws: number;
}

/** Problems with a setup; empty when it can start. */
export function validateVersusSetup(setup: VersusSetup): string[] {
  const problems: string[] = [];

  setup.seats.forEach((seat, index) => {
    if (seat.kind !== 'human') return;
    const check = validateDisplayName(seat.name);
    if (!check.ok) problems.push(`Seat ${index + 1} human name is invalid: ${check.reason}`);
  });

  if (setup.seats[0].kind === 'kid' && setup.seats[1].kind === 'kid') {
    problems.push('At least one seat must be human (cannot have two kids).');
    if (setup.seats[0].kid === setup.seats[1].kid) {
      problems.push('Cannot pick the same kid for both seats.');
    }
  }

  // Setups can come from stored or typed data, so the type alone is not trusted.
  if (![3, 5].includes(setup.bestOf)) {
    problems.push('Series length bestOf must be 3 or 5.');
  }

  if (setup.pool.length === 0) {
    problems.push('Game pool must contain at least one game.');
  } else if (new Set(setup.pool).size !== setup.pool.length) {
    problems.push('Game pool cannot contain duplicate game ids.');
  }

  return problems;
}

/** Games a seat needs to win the series: 2 of 3, 3 of 5. */
export function winsNeeded(bestOf: 3 | 5): number {
  return bestOf === 3 ? 2 : 3;
}

/** What the chalkboard writes for a seat: the typed name or the kid's name. */
export function seatName(seat: VersusSeat): string {
  if (seat.kind === 'human') {
    return seat.name;
  }
  const kid = KIDS.find((k) => k.id === seat.kid);
  return kid !== undefined ? kid.name : seat.kid;
}

/** A new series in phase 'drawing'. Throws if the setup is invalid. */
export function startSeries(setup: VersusSetup): VersusSeries {
  const problems = validateVersusSetup(setup);
  if (problems.length > 0) {
    throw new Error(`Invalid versus setup: ${problems.join('; ')}`);
  }
  return {
    setup,
    phase: 'drawing',
    games: [],
    current: null,
    wins: [0, 0],
    winner: null,
    draws: 0,
  };
}

/** Replays raffle draws from the seed so results are deterministic. */
function computeDraws(seed: number, pool: readonly string[], count: number): string[] {
  const rng = createRng(seed);
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    const lastPlayed = drawn.length > 0 ? (drawn[drawn.length - 1] ?? null) : null;
    const candidates =
      pool.length > 1 && lastPlayed !== null ? pool.filter((id) => id !== lastPlayed) : pool;
    drawn.push(rng.pick(candidates));
  }
  return drawn;
}

/** Draws the next game ('drawing' or 'between' → 'playing'). */
export function drawNextGame(series: VersusSeries): VersusSeries {
  if (series.phase !== 'drawing' && series.phase !== 'between') {
    throw new Error(
      `Cannot draw next game while in phase '${series.phase}'; must be in 'drawing' or 'between'.`,
    );
  }

  const nextDrawCount = series.draws + 1;
  const allDraws = computeDraws(series.setup.seed, series.setup.pool, nextDrawCount);
  const nextGame = allDraws[allDraws.length - 1];
  if (nextGame === undefined) {
    throw new Error('Failed to draw game from pool.');
  }

  return {
    setup: series.setup,
    phase: 'playing',
    games: series.games,
    current: nextGame,
    wins: series.wins,
    winner: series.winner,
    draws: nextDrawCount,
  };
}

/** Records the current game ('playing' → 'between' or 'finished'). */
export function recordGame(series: VersusSeries, winner: Seat | null): VersusSeries {
  if (series.phase !== 'playing') {
    throw new Error(`Cannot record game while in phase '${series.phase}'; must be in 'playing'.`);
  }
  if (series.current === null) {
    throw new Error('Cannot record game: no game is currently drawn.');
  }

  const gameResult: VersusGameResult = {
    game: series.current,
    winner,
  };
  const games = [...series.games, gameResult];

  const wins: [number, number] = [
    series.wins[0] + (winner === 1 ? 1 : 0),
    series.wins[1] + (winner === 2 ? 1 : 0),
  ];

  const needed = winsNeeded(series.setup.bestOf);
  const seat1Won = wins[0] >= needed;
  const seat2Won = wins[1] >= needed;

  const isFinished = seat1Won || seat2Won;
  const seriesWinner: Seat | null = seat1Won ? 1 : seat2Won ? 2 : null;
  const phase: VersusPhase = isFinished ? 'finished' : 'between';

  return {
    setup: series.setup,
    phase,
    games,
    current: series.current,
    wins,
    winner: seriesWinner,
    draws: series.draws,
  };
}

/** The same seats, length and pool with a new seed; a fresh series in phase 'drawing'. */
export function rematch(series: VersusSeries, seed: number): VersusSeries {
  return {
    setup: {
      seats: series.setup.seats,
      bestOf: series.setup.bestOf,
      pool: series.setup.pool,
      seed,
    },
    phase: 'drawing',
    games: [],
    current: null,
    wins: [0, 0],
    winner: null,
    draws: 0,
  };
}

/** The same pair of names, whichever seat each took: lowercase, trimmed, sorted, joined by "|". */
export function rivalryKey(names: readonly [string, string]): string {
  const first = names[0].trim().toLowerCase();
  const second = names[1].trim().toLowerCase();
  return first <= second ? `${first}|${second}` : `${second}|${first}`;
}

/** Folds a finished series into the stored Versus data; throws if the series is not finished. */
export function recordSeries(data: VersusData, series: VersusSeries, at: IsoTime): VersusData {
  if (series.phase !== 'finished' || series.winner === null) {
    throw new Error('Cannot record series: series is not finished.');
  }

  const name1 = seatName(series.setup.seats[0]);
  const name2 = seatName(series.setup.seats[1]);
  const key = rivalryKey([name1, name2]);

  const newRecord: VersusSeriesRecord = {
    at,
    names: [name1, name2],
    kids: [
      series.setup.seats[0].kind === 'kid' ? series.setup.seats[0].kid : null,
      series.setup.seats[1].kind === 'kid' ? series.setup.seats[1].kid : null,
    ],
    bestOf: series.setup.bestOf,
    games: series.games.map((g) => ({ game: g.game, winner: g.winner })),
    winner: series.winner,
  };

  const recent = [...data.recent, newRecord].slice(-VERSUS_RECENT_LIMIT);

  const n1Norm = name1.trim().toLowerCase();
  const n2Norm = name2.trim().toLowerCase();
  const seat1Index: 0 | 1 = n1Norm <= n2Norm ? 0 : 1;

  const existing = data.rivalries[key];
  const prevSeries: [number, number] = existing !== undefined ? existing.series : [0, 0];
  const prevGames: [number, number] = existing !== undefined ? existing.games : [0, 0];

  let seat1GameWins = 0;
  let seat2GameWins = 0;
  for (const g of series.games) {
    if (g.winner === 1) {
      seat1GameWins++;
    } else if (g.winner === 2) {
      seat2GameWins++;
    }
  }

  const seriesWins: [number, number] = [
    prevSeries[0] + (series.winner === (seat1Index === 0 ? 1 : 2) ? 1 : 0),
    prevSeries[1] + (series.winner === (seat1Index === 1 ? 1 : 2) ? 1 : 0),
  ];

  const gameWins: [number, number] = [
    prevGames[0] + (seat1Index === 0 ? seat1GameWins : seat2GameWins),
    prevGames[1] + (seat1Index === 1 ? seat1GameWins : seat2GameWins),
  ];

  const rivalryNames: [string, string] =
    existing !== undefined ? existing.names : seat1Index === 0 ? [name1, name2] : [name2, name1];

  const updatedRivalry: RivalryData = {
    names: rivalryNames,
    series: seriesWins,
    games: gameWins,
    lastAt: at,
  };

  return {
    seriesPlayed: data.seriesPlayed + 1,
    recent,
    rivalries: {
      ...data.rivalries,
      [key]: updatedRivalry,
    },
  };
}
