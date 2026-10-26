/**
 * What a game session does differently when it is part of a Den Life mode.
 *
 * - A **Power Cycle Run round** plays one micro-challenge: the goal and a
 *   45-second clock sit at the top of the screen, the clock stops while the
 *   game is paused, and the round ends the moment the goal is met or time is
 *   up (or the game ends first), whatever the game is doing. The result goes
 *   into the run and the player is taken back to the Den for the next flip.
 * - A **Versus Night game** seats the series' two players (a Kid in seat 2
 *   when one was picked), records the winner on the chalkboard and, when the
 *   series is decided, stores it with the pair's rivalry.
 *
 * The session asks this module for its seats and run and tells it what
 * happens; everything mode-specific stays here.
 */
import {
  briefFor,
  finishRound,
  kidById,
  recordGame,
  recordRun,
  recordSeries,
  runResult,
  startMicro,
  utcDateKey,
  type GameModule,
  type GameResult,
  type MicroChallengeDef,
  type MicroResult,
  type MicroRun,
  type RunInfo,
  type SeatInfo,
  type StampedEvent,
  type VersusSeat,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { escapeXml } from '../den/svg.ts';

const CLOCK_TICK_MS = 200;
/** How long "Done!" or "Time!" stays up before the room takes over again. */
const ROUND_END_HOLD_MS = 1400;

export interface RunRound {
  readonly run: RunInfo;
  readonly hud: HTMLElement;
  /** The game is playing (first call starts the clock). */
  playing(): void;
  setPaused(paused: boolean): void;
  /** The game ended on its own; the round ends with it. */
  gameEnded(): void;
  dispose(): void;
}

/** Folds a finished round into the run; the fifth also files the run under the player's records. */
function settleRound(services: Services, result: MicroResult): void {
  const current = services.powerRun.state();
  if (current?.phase !== 'round') return;
  const next = finishRound(current, result);
  services.powerRun.set(next);
  if (next.phase !== 'results') return;
  const now = new Date();
  const kind = services.powerRun.kind();
  services.repos.progress.update((draft) => {
    draft.den.runs = recordRun(draft.den.runs, runResult(next, now.toISOString()), kind, kind === 'daily' ? utcDateKey(now) : undefined);
  });
}

/** The micro-challenge a run round asked for, or the game's first one. */
function challengeFor(module: GameModule, id: string | null): MicroChallengeDef | undefined {
  const challenges = module.microChallenges ?? [];
  return challenges.find((challenge) => challenge.id === id) ?? challenges[0];
}

function clockText(seconds: number): string {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** A run round, or null when this session is not one (or the game has no such challenge). */
export function createRunRound(options: {
  services: Services;
  module: GameModule;
  run: RunInfo;
  challengeId: string | null;
  onRoundOver(): void;
}): RunRound | null {
  const { services, module, run } = options;
  const state = services.powerRun.state();
  if (run.mode !== 'power-cycle-run' || state?.phase !== 'round') return null;
  const def = challengeFor(module, options.challengeId);
  if (!def) return null;
  services.denLife.registerMicro(module.manifest.id, module.microChallenges ?? []);

  // The clock leaves out time spent paused.
  let pausedTotal = 0;
  let pausedAt: number | null = null;
  const clock = () => performance.now() - pausedTotal - (pausedAt === null ? 0 : performance.now() - pausedAt);

  let micro: MicroRun | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let over = false;
  const missed = (): MicroResult => ({ game: module.manifest.id, challenge: def.id, passed: false, score: 0, seconds: 0 });
  const stopEvents = services.bus.on((event: StampedEvent) => micro?.handle(event));

  const hud = document.createElement('div');
  hud.className = 'run-round-hud';
  hud.setAttribute('role', 'status');
  const roundNumber = state.roundIndex + 1;
  const render = () => {
    const seconds = micro?.remainingSeconds() ?? briefFor(def).seconds;
    hud.innerHTML =
      `<span class="run-round-number">Round ${roundNumber}/5</span>` +
      `<span class="run-round-goal">${escapeXml(def.goal)}</span>` +
      `<span class="run-round-progress">${micro?.value ?? 0}/${def.pass.target}</span>` +
      `<span class="run-round-clock${seconds <= 10 ? ' is-short' : ''}">${clockText(seconds)}</span>`;
  };
  render();

  const end = (result: MicroResult) => {
    if (over) return;
    over = true;
    if (timer !== null) clearInterval(timer);
    hud.classList.add(result.passed ? 'is-passed' : 'is-missed');
    hud.innerHTML = `<span class="run-round-verdict">${result.passed ? 'Done!' : 'Time!'}</span><span class="run-round-goal">${escapeXml(def.goal)}</span>`;
    services.audio.play(result.passed ? 'flip-tick' : 'reset-rasp');
    setTimeout(() => {
      settleRound(services, result);
      options.onRoundOver();
    }, ROUND_END_HOLD_MS);
  };

  const check = () => {
    if (!micro || over) return;
    if (micro.check() !== 'running') end(micro.finish());
    else render();
  };

  return {
    run: { ...run, channel: def.channel, micro: briefFor(def) },
    hud,
    playing() {
      if (micro) return;
      micro = startMicro(module.manifest.id, def, clock);
      timer = setInterval(check, CLOCK_TICK_MS);
    },
    setPaused(paused) {
      if (paused && pausedAt === null) pausedAt = performance.now();
      if (!paused && pausedAt !== null) {
        pausedTotal += performance.now() - pausedAt;
        pausedAt = null;
      }
    },
    gameEnded() {
      if (!over) end(micro ? micro.finish() : missed());
    },
    dispose() {
      if (timer !== null) clearInterval(timer);
      stopEvents();
      // Leaving in the middle counts as a missed round, so the run goes on from the next flip.
      if (over) return;
      over = true;
      settleRound(services, micro ? micro.finish() : missed());
    },
  };
}

function seatInfo(seat: VersusSeat, number: 1 | 2): SeatInfo {
  return seat.kind === 'human'
    ? { seat: number, kind: 'human', name: seat.name }
    : { seat: number, kind: 'bot', kid: seat.kid, name: kidById(seat.kid).name };
}

export interface VersusGame {
  readonly seats: SeatInfo[];
  /** Records the game on the chalkboard; returns the line the results screen leads with. */
  recordResult(result: GameResult): string;
}

/** A Versus Night game, or null when this session is not one. */
export function createVersusGame(services: Services, gameId: string, run: RunInfo): VersusGame | null {
  const series = services.versusNight.series();
  if (run.mode !== 'versus-night' || series?.phase !== 'playing' || series.current !== gameId) return null;
  const [first, second] = series.setup.seats;
  const seats = [seatInfo(first, 1), seatInfo(second, 2)];
  return {
    seats,
    recordResult(result) {
      const current = services.versusNight.series();
      if (current?.phase !== 'playing') return '';
      // A game against a Kid may only say whether seat 1 won; that decides it too.
      const winner = result.winnerSeat !== undefined ? result.winnerSeat : result.won === undefined ? null : result.won ? 1 : 2;
      const next = recordGame(current, winner);
      services.versusNight.set(next);
      if (next.phase === 'finished') {
        services.repos.progress.update((draft) => {
          draft.den.versus = recordSeries(draft.den.versus, next, new Date().toISOString());
        });
      }
      const name = (seat: 1 | 2) => seats[seat - 1]?.name ?? `Seat ${seat}`;
      if (winner === null) return 'A draw: this game is played again';
      return next.phase === 'finished' ? `${name(winner)} takes the night!` : `${name(winner)} wins game ${next.games.length}`;
    },
  };
}
