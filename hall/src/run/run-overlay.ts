/**
 * The Power Cycle Run, played in the Den itself. Five games, a 45-second
 * goal in each; between them the power switch flips by itself (the Den
 * view's runFlip: the room dims, the picture collapses, the next cartridge
 * drops into the slot, the Counter flips, snow) and the goal card for the
 * next game drops into the corner where the game card usually sits. Each
 * flip is a little faster than the last; round five is frantic.
 *
 * The overlay only shows the run and asks for what comes next: the run's
 * state lives in services.powerRun, and the boot code takes the player into
 * each game and back.
 */
import {
  beginRound,
  beginTransition,
  canPlanRun,
  dailyNumber,
  dailyRunSeed,
  MICRO_DEFAULT_SECONDS,
  planRun,
  randomSeed,
  RUN_ROUNDS,
  runPasses,
  runScore,
  runShareLine,
  startRun,
  copyText,
  transitionTiming,
  type RunRound,
  type RunState,
} from '@woodgrain-88/kit';
import type { RunKind } from '../app/power-run.ts';
import type { Services } from '../app/services.ts';
import { toast } from '../chrome/dialog.ts';
import type { DenView } from '../den/den-view.ts';
import { labelDocument } from '../den/label.ts';
import { escapeXml } from '../den/svg.ts';

export interface RunOverlay {
  dispose(): void;
}

export interface RunOverlayOptions {
  services: Services;
  den: DenView;
  onPlayRound(round: RunRound): void;
  onExit(): void;
}

/** The five rounds as pips: passed, missed, this one, still to come. */
function pips(state: RunState): string {
  return Array.from({ length: RUN_ROUNDS }, (_, index) => {
    const result = state.results[index];
    const kind = result
      ? result.passed
        ? 'passed'
        : 'missed'
      : index === state.roundIndex
        ? 'current'
        : 'ahead';
    const label = result
      ? result.passed
        ? 'passed'
        : 'missed'
      : index === state.roundIndex
        ? 'this round'
        : 'to come';
    return `<li class="run-pip run-pip--${kind}"><span class="sr-only">Round ${index + 1}: ${label}</span></li>`;
  }).join('');
}

export function createRunOverlay(options: RunOverlayOptions): RunOverlay {
  const { services, den } = options;
  const { powerRun, denLife, registry } = services;
  const titleOf = (id: string) =>
    registry.manifests.find((manifest) => manifest.id === id)?.title ?? id;

  const hud = document.createElement('div');
  hud.className = 'run-hud';
  hud.setAttribute('role', 'status');
  const card = document.createElement('section');
  card.className = 'run-card';
  card.setAttribute('aria-live', 'polite');
  den.stage.append(hud, card);
  const releaseCard = den.placeAtCard(card);
  den.setRunning(true);
  let disposed = false;

  const showHud = (state: RunState | null) => {
    hud.hidden = state === null;
    if (!state) return;
    const kind =
      powerRun.kind() === 'daily' ? `Daily run #${dailyNumber(new Date())}` : 'Power Cycle Run';
    hud.innerHTML = `<span class="run-hud-title">${kind}</span><ol class="run-pips" aria-label="Rounds">${pips(state)}</ol><span class="run-hud-score">${runScore(state).toLocaleString('en-GB')} pts</span>`;
  };

  const showIntro = () => {
    const ready = canPlanRun(denLife.runCandidates());
    card.dataset.phase = 'intro';
    card.innerHTML =
      `<p class="run-card-kicker">Power Cycle Run</p>` +
      `<h2 class="run-card-title">Five games, 45 seconds each</h2>` +
      `<p class="run-card-text">One goal per game. Between games the power switch flips by itself, a little faster every time.</p>` +
      (ready
        ? `<div class="run-card-actions"><button type="button" class="button button--primary" data-do="free">Start a run</button><button type="button" class="button" data-do="daily">Daily run #${dailyNumber(new Date())}</button></div>`
        : `<p class="run-card-note">Opens when five games are on the shelf.</p>`) +
      `<div class="run-card-actions"><button type="button" class="button button--quiet" data-do="exit">Back to the Hall</button></div>`;
    showHud(null);
  };

  const showGoal = (state: RunState) => {
    const round = state.plan.rounds[state.roundIndex];
    if (!round) return;
    const seconds = round.challenge.seconds ?? MICRO_DEFAULT_SECONDS;
    card.dataset.phase = 'goal';
    card.style.setProperty('--card-ms', `${transitionTiming(state.roundIndex).cardMs}ms`);
    card.innerHTML =
      `<p class="run-card-kicker">Round ${state.roundIndex + 1} of ${RUN_ROUNDS}</p>` +
      `<h2 class="run-card-title">${escapeXml(titleOf(round.game))}</h2>` +
      `<p class="run-card-goal">${escapeXml(round.challenge.goal)}</p>` +
      `<p class="run-card-meta"><span class="run-clock" aria-hidden="true"></span>${seconds} seconds</p>` +
      `<div class="run-card-actions"><button type="button" class="button button--primary" data-do="go">Go <span class="kbd">Enter</span></button><button type="button" class="button button--quiet" data-do="end">End the run</button></div>`;
    // Restart the drop each round; the last one comes in spinning, as frantic as the flip before it.
    card.classList.remove('is-dropping', 'is-frantic');
    void card.getBoundingClientRect();
    card.classList.add('is-dropping');
    card.classList.toggle('is-frantic', state.roundIndex === RUN_ROUNDS - 1);
  };

  /** The run as a shareable line; the daily run carries its number, a free run none. */
  const shareLine = (state: RunState) =>
    runShareLine(state, powerRun.kind() === 'daily' ? dailyNumber(new Date()) : undefined);

  const showResults = (state: RunState) => {
    card.dataset.phase = 'results';
    card.classList.remove('is-dropping');
    // Five mini-slates: each round's cartridge with a stamp for how it went.
    const slates = state.results
      .map((result, index) => {
        const manifest = registry.manifests.find((candidate) => candidate.id === result.game);
        const label = manifest ? labelDocument(manifest, `run-slate-${index}`) : '';
        const verdict = result.passed ? 'Done' : 'Missed';
        return `<li class="run-slate ${result.passed ? 'is-passed' : 'is-missed'}" aria-label="Round ${index + 1}, ${escapeXml(titleOf(result.game))}: ${verdict}"><span class="run-slate-label" aria-hidden="true">${label}</span><span class="run-slate-stamp" aria-hidden="true">${verdict}</span></li>`;
      })
      .join('');
    const runs = services.repos.progress.get().den.runs;
    const best = runs.free[0]?.score ?? 0;
    const score = runScore(state);
    card.innerHTML =
      `<p class="run-card-kicker">${powerRun.kind() === 'daily' ? `Daily run #${dailyNumber(new Date())}` : 'Run complete'}</p>` +
      `<h2 class="run-card-title">${runPasses(state)} of ${RUN_ROUNDS}</h2>` +
      `<ol class="run-slates">${slates}</ol>` +
      `<p class="run-card-meta">${score.toLocaleString('en-GB')} points${powerRun.kind() === 'free' && best > 0 ? (score >= best ? ' · your best run' : ` · best ${best.toLocaleString('en-GB')}`) : ''}</p>` +
      `<p class="run-share"><span>${escapeXml(shareLine(state))}</span><button type="button" class="button button--quiet" data-do="share">Copy</button></p>` +
      `<div class="run-card-actions"><button type="button" class="button button--primary" data-do="free">Run again</button><button type="button" class="button button--quiet" data-do="exit">Back to the Hall</button></div>`;
  };

  /** The automatic flip into the round, with the goal card dropping in as the snow starts. */
  const transition = async (state: RunState) => {
    const round = state.plan.rounds[state.roundIndex];
    if (!round) return;
    card.dataset.phase = 'flipping';
    card.innerHTML = '';
    showHud(state);
    await den.runFlip(round.game, transitionTiming(state.roundIndex), () => {
      if (!disposed) showGoal(state);
    });
    if (!disposed) card.querySelector<HTMLButtonElement>('[data-do="go"]')?.focus();
  };

  const start = (kind: RunKind) => {
    const seed = kind === 'daily' ? dailyRunSeed(new Date()) : randomSeed();
    const state = beginTransition(startRun(planRun(denLife.runCandidates(), seed)));
    powerRun.set(state, kind);
    void transition(state);
  };

  const show = () => {
    const state = powerRun.state();
    if (!state || state.phase === 'intro') return showIntro();
    if (state.phase === 'results') {
      showHud(state);
      return showResults(state);
    }
    void transition(state);
  };

  card.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-do]')?.dataset.do;
    const state = powerRun.state();
    if (action === 'free' || action === 'daily') start(action);
    if (action === 'go' && state?.phase === 'transition') {
      const round = state.plan.rounds[state.roundIndex];
      powerRun.set(beginRound(state));
      if (round) options.onPlayRound(round);
    }
    if (action === 'end') {
      powerRun.set(null);
      showIntro();
    }
    if (action === 'exit') options.onExit();
    if (action === 'share' && state)
      void copyText(shareLine(state)).then((copied) =>
        toast(copied ? 'Run copied' : shareLine(state)),
      );
  });

  // The run needs every playable game's challenges; they arrive with the modules.
  card.dataset.phase = 'intro';
  card.innerHTML = `<p class="run-card-kicker">Power Cycle Run</p><p class="run-card-text">Checking the shelf…</p>`;
  void denLife.loadGameData().then(() => {
    if (!disposed) show();
  });

  return {
    dispose() {
      disposed = true;
      releaseCard();
      den.setRunning(false);
      hud.remove();
      card.remove();
    },
  };
}
