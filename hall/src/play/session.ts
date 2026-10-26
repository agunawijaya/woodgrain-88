/**
 * A game, running: loads its module, builds the GameContext the contract
 * promises (seeded run, two-seat input, loops the chrome can pause, events,
 * records, patches, sharing) and wraps the game in the Hall's chrome:
 *
 * - on the game menu, "← Back to the Hall" top left (Escape does the same);
 * - during play, a pause button with an "Esc" hint, and the pause menu
 *   (Resume · game items · How to play · Settings · Game menu · Back to the Hall);
 * - results, when the game asks the Hall to present them
 *   (Play again (R) · Game menu · Back to the Hall (H));
 * - a confirmation before leaving only when progress would be lost.
 */
import {
  createInput,
  createLoop,
  createPatchTracker,
  createRng,
  DEFAULT_BINDINGS,
  emptyGameProgress,
  encodeChallenge,
  renderShareCard,
  copyText,
  downloadText,
  type GameContext,
  type GameEntry,
  type GameInstance,
  type GameLoop,
  type GameModule,
  type GameResult,
  type GameView,
  type PatchEarned,
  type PauseItem,
  type ProSwitchPosition,
  type ResultReceipt,
  type RunInfo,
  type Seat,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { confirmDialog, openDialog, toast, type Dialog } from '../chrome/dialog.ts';
import { showHowToPlay } from '../chrome/how-to-play.ts';
import { escapeXml } from '../den/svg.ts';

export interface PlaySessionOptions {
  services: Services;
  entry: GameEntry;
  run: RunInfo;
  onBackToHall(): void;
  onOpenSettings(): void;
}

export interface PlaySession {
  readonly element: HTMLElement;
  /** Resolves true when it is fine to leave (asking the player first if needed). */
  confirmLeave(): Promise<boolean>;
  dispose(): void;
}

const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/></svg>';

/** A copy of a per-game map without one game's entry. */
function withoutGame<T>(games: Record<string, T>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(games).filter(([key]) => key !== id));
}

export async function startPlaySession(options: PlaySessionOptions): Promise<PlaySession> {
  const { services, entry, run } = options;
  const { manifest } = entry;
  if (!entry.load) throw new Error(`${manifest.id} has no module yet`);
  const module: GameModule = await entry.load();

  const element = document.createElement('section');
  element.className = 'play-view';
  element.setAttribute('aria-label', manifest.title);
  element.style.setProperty('--game-accent-day', manifest.accent.day);
  element.style.setProperty('--game-accent-night', manifest.accent.night);
  element.innerHTML =
    `<div class="game-host" tabindex="-1"></div>` +
    `<div class="play-chrome">` +
    `<button type="button" class="button play-back" data-action="hall">← Back to the Hall</button>` +
    `<button type="button" class="play-pause" data-action="pause" aria-label="Pause (Esc)" hidden>${ICON_PAUSE}<span class="kbd">Esc</span></button>` +
    `<p class="play-hint" hidden>Esc — pause and menu</p>` +
    (run.challenge
      ? `<p class="play-challenge" role="status">A challenge: beat <strong>${run.challenge.score.toLocaleString('en-GB')}</strong> on ${escapeXml(manifest.channels.find((c) => c.id === run.challenge?.channel)?.title ?? 'this channel')}</p>`
      : '') +
    `</div>`;
  const host = element.querySelector<HTMLDivElement>('.game-host');
  const backButton = element.querySelector<HTMLButtonElement>('.play-back');
  const pauseButton = element.querySelector<HTMLButtonElement>('.play-pause');
  const hint = element.querySelector<HTMLParagraphElement>('.play-hint');
  if (!host || !backButton || !pauseButton || !hint) throw new Error('Play view markup is missing parts');

  let view: GameView = 'menu';
  let pauseItems: readonly PauseItem[] = [];
  let paused = false;
  let overlay: Dialog | null = null;
  let instance: GameInstance | null = null;
  let disposed = false;
  const loops = new Set<GameLoop>();
  const earnedThisRun: PatchEarned[] = [];

  // ——— Progress hooks for this game ———
  const tracker = createPatchTracker({
    games: [{ id: manifest.id, patches: module.patches }],
    progress: services.repos.progress,
    isPro: () => false,
  });
  const stopTracker = tracker.connect(services.bus);
  const stopEarned = tracker.onEarned((earned) => {
    earnedThisRun.push(earned);
    toast(`Patch earned: ${earned.patch.title}${earned.gold ? ' (gold thread)' : ''}`, { tone: 'celebrate' });
  });
  services.bus.beginSession({ game: manifest.id, mode: run.mode, channel: run.channel });

  // ——— Input ———
  const controls = services.settings.get().controls;
  const input = createInput({
    pointerTarget: host,
    layout: controls.layout,
    bindings: controls.bindings ?? DEFAULT_BINDINGS,
    padSeats: controls.padSeats,
  });

  const showChromeFor = (next: GameView) => {
    backButton.hidden = next !== 'menu';
    pauseButton.hidden = next !== 'play';
    if (next === 'play') maybeShowEscHint();
  };

  const maybeShowEscHint = () => {
    if (services.settings.get().hintsSeen['esc-pause']) return;
    hint.hidden = false;
    services.settings.update((draft) => {
      draft.hintsSeen['esc-pause'] = true;
    });
    setTimeout(() => (hint.hidden = true), 4500);
  };

  // ——— Leaving ———
  const confirmLeave = async (): Promise<boolean> => {
    if (!instance || instance.leaveCheck() === 'safe') return true;
    return confirmDialog({
      title: 'Leave this game?',
      message: 'This run is still going and will not be saved.',
      confirm: 'Leave',
      cancel: 'Keep playing',
    });
  };

  const backToHall = () => {
    void confirmLeave().then((ok) => {
      if (ok) options.onBackToHall();
    });
  };

  // ——— Pause ———
  const pauseGame = (reason: 'menu' | 'hidden') => {
    if (paused) return;
    paused = true;
    for (const loop of loops) loop.pause();
    instance?.pause(reason);
    services.audio.silence();
  };
  const resumeGame = () => {
    if (!paused) return;
    paused = false;
    input.reset();
    for (const loop of loops) loop.resume();
    instance?.resume();
    host.focus();
  };

  const openPauseMenu = (reason: 'menu' | 'hidden' = 'menu') => {
    if (overlay || view !== 'play') return;
    pauseGame(reason);
    overlay = openDialog({
      title: 'Paused',
      className: 'dialog--pause',
      onClose: () => {
        overlay = null;
        resumeGame();
      },
    });
    const items = [
      ['resume', 'Resume'],
      ...pauseItems.map((item) => [`game:${item.id}`, item.label] as const),
      ['how', 'How to play'],
      ['settings', 'Settings'],
      ['menu', 'Game menu'],
      ['hall', 'Back to the Hall'],
    ] as const;
    overlay.body.innerHTML =
      `<p class="dialog-kicker">${escapeXml(manifest.title)}</p>` +
      `<div class="menu-list">` +
      items
        .map(([id, label], i) => `<button type="button" class="button${i === 0 ? ' button--primary' : ''}" data-item="${escapeXml(id)}">${escapeXml(label)}</button>`)
        .join('') +
      `</div>`;
    const pauseDialog = overlay;
    pauseDialog.body.addEventListener('click', (event) => {
      const id = (event.target as Element).closest<HTMLButtonElement>('[data-item]')?.dataset.item;
      if (!id) return;
      if (id === 'resume') pauseDialog.close();
      else if (id === 'how') showHowToPlay(module);
      else if (id === 'settings') options.onOpenSettings();
      else if (id === 'menu') {
        void confirmLeave().then((ok) => {
          if (!ok) return;
          pauseDialog.close();
          instance?.gameMenu();
        });
      } else if (id === 'hall') {
        void confirmLeave().then((ok) => {
          if (!ok) return;
          pauseDialog.close();
          options.onBackToHall();
        });
      } else if (id.startsWith('game:')) {
        pauseItems.find((item) => `game:${item.id}` === id)?.onSelect();
      }
    });
  };

  input.onPause(() => {
    if (overlay) return;
    if (view === 'menu') backToHall();
    else if (view === 'play') openPauseMenu();
  });
  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && view === 'play' && !overlay) openPauseMenu('hidden');
  };
  document.addEventListener('visibilitychange', onVisibility);
  element.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'hall') backToHall();
    if (action === 'pause') openPauseMenu();
  });

  // ——— Results the Hall presents ———
  const showResults = (result: GameResult, receipt: ResultReceipt) => {
    if (overlay) overlay.close();
    const versus = result.winnerSeat !== undefined;
    const headline = versus
      ? result.winnerSeat === null
        ? "It's a draw"
        : `Seat ${result.winnerSeat} wins!`
      : result.won === false
        ? 'Nice try'
        : 'Well played';
    overlay = openDialog({ title: headline, className: 'dialog--results', onClose: () => (overlay = null) });
    const dialog = overlay;
    const challenge = context.share.challengeLink(result.score);
    dialog.body.innerHTML =
      (receipt.newBest ? `<p class="results-ribbon">New best!</p>` : '') +
      `<p class="results-score">${escapeXml(result.scoreLabel)}</p>` +
      (result.details?.length
        ? `<dl class="results-details">${result.details
            .slice(0, 4)
            .map((d) => `<div><dt>${escapeXml(d.label)}</dt><dd>${escapeXml(d.value)}</dd></div>`)
            .join('')}</dl>`
        : '') +
      (receipt.patchesEarned.length
        ? `<p class="results-patches">Patches: ${receipt.patchesEarned.map((p) => escapeXml(p.patch.title)).join(', ')}</p>`
        : '') +
      `<div class="results-share">` +
      (manifest.supports.challengeLinks ? `<button type="button" class="button button--quiet" data-result="challenge">Challenge a friend</button>` : '') +
      `<button type="button" class="button button--quiet" data-result="card">Share card</button>` +
      `</div>` +
      `<div class="menu-list menu-list--row">` +
      `<button type="button" class="button button--primary" data-result="again">${versus ? 'Rematch' : 'Play again'} <span class="kbd">R</span></button>` +
      `<button type="button" class="button" data-result="menu">Game menu</button>` +
      `<button type="button" class="button" data-result="hall">Back to the Hall <span class="kbd">H</span></button>` +
      `</div>`;
    if (receipt.newBest) services.audio.play('soft-tap', { pitch: 1.5 });
    const act = (what: string) => {
      if (what === 'again') {
        dialog.close();
        instance?.playAgain();
      } else if (what === 'menu') {
        dialog.close();
        instance?.gameMenu();
      } else if (what === 'hall') {
        dialog.close();
        options.onBackToHall();
      } else if (what === 'challenge') {
        const link = `${location.origin}${location.pathname}${challenge}`;
        void copyText(link).then((ok) => toast(ok ? 'Challenge link copied' : link));
      } else if (what === 'card') {
        const card = context.share.card({ subtitle: headline, lines: [result.scoreLabel] });
        downloadText(`${manifest.id}-card.svg`, card, 'image/svg+xml');
      }
    };
    dialog.body.addEventListener('click', (event) => {
      const what = (event.target as Element).closest<HTMLButtonElement>('[data-result]')?.dataset.result;
      if (what) act(what);
    });
    dialog.element.addEventListener('keydown', (event) => {
      if (event.key === 'r' || event.key === 'R') act('again');
      if (event.key === 'h' || event.key === 'H') act('hall');
    });
  };

  // The first finished run with a cartridge version lights its Counter lamp.
  const markVersionFinished = () => {
    const { version } = run;
    if (version === undefined) return;
    services.repos.progress.update((draft) => {
      const game = (draft.games[manifest.id] ??= emptyGameProgress());
      game.versionsFinished[version] ??= new Date().toISOString();
    });
  };

  // ——— The context the contract promises ———
  const proSwitchListeners = new Set<(seat: Seat, position: ProSwitchPosition) => void>();
  const settings = services.settings;
  const context: GameContext = {
    manifest,
    run,
    rng: createRng(run.seed),
    seats: [
      { seat: 1, kind: 'human', name: services.profile.get().displayName },
      { seat: 2, kind: manifest.versus === 'none' ? 'bot' : 'human', name: 'Player 2' },
    ],
    input,
    audio: services.audio,
    settings: {
      appearance: () => settings.appearance(),
      onAppearance: (listener) => settings.onAppearance(listener),
      reducedMotion: () => settings.reducedMotion(),
      onReducedMotion: (listener) => settings.onReducedMotion(listener),
      screenShake: () => settings.get().screenShake && !settings.reducedMotion(),
      crtEnabled: () => settings.crtEnabled(),
      colorBlindHints: () => settings.get().colorBlindHints,
      game: settings.game(manifest.id),
    },
    proSwitch: {
      position: () => 'amateur',
      onChange(listener) {
        proSwitchListeners.add(listener);
        return () => proSwitchListeners.delete(listener);
      },
    },
    save: {
      load(version) {
        const slot = services.repos.saves.get().games[manifest.id];
        return slot?.v === version ? slot.state : null;
      },
      store(version, state) {
        services.repos.saves.update((draft) => {
          draft.games[manifest.id] = { v: version, savedAt: new Date().toISOString(), state };
        });
      },
      clear() {
        services.repos.saves.update((draft) => {
          draft.games = withoutGame(draft.games, manifest.id);
        });
      },
    },
    patches: { status: () => tracker.status(manifest.id) },
    records: {
      best: (channel, mode) => services.records.best(manifest.id, channel, mode),
      top: (channel, mode) => services.records.top(manifest.id, channel, mode),
    },
    createLoop(loopOptions) {
      // The chrome pauses these with the game; the game never needs its own visibility handling.
      const loop = createLoop({ ...loopOptions, autoPause: false });
      loops.add(loop);
      return loop;
    },
    emit: (event) => services.bus.emit(event),
    reportResult(result) {
      const durationMs = result.durationMs;
      const submitted = Number.isFinite(result.score)
        ? services.records.submit(
            manifest.id,
            { score: result.score, at: new Date().toISOString(), seed: run.seed, durationMs, channel: run.channel, mode: run.mode },
            manifest.scoreOrder,
          )
        : { rank: null, newBest: false };
      services.stats.recordPlay(manifest.id, {
        durationMs,
        score: result.score,
        order: manifest.scoreOrder,
        ...(result.winnerSeat ? { versusWinner: result.winnerSeat } : {}),
      });
      markVersionFinished();
      services.bus.emit({ type: 'result', data: { score: result.score, won: result.won ?? false, newBest: submitted.newBest } });
      const receipt: ResultReceipt = {
        newBest: submitted.newBest,
        rank: submitted.rank,
        patchesEarned: earnedThisRun.splice(0),
        micro: null,
      };
      if (result.presentation === 'hall') {
        // The bus delivers the result event (and any patch it earns) on a
        // microtask queued before this one, so the screen sees those patches too.
        queueMicrotask(() =>
          showResults(result, { ...receipt, patchesEarned: [...receipt.patchesEarned, ...earnedThisRun.splice(0)] }),
        );
      }
      return receipt;
    },
    share: {
      challengeLink: (score) =>
        encodeChallenge({
          game: manifest.id,
          channel: run.channel,
          seed: run.seed,
          score,
          ...(run.version === undefined ? {} : { version: run.version }),
        }),
      card: (input) =>
        renderShareCard({
          title: manifest.title,
          subtitle: input.subtitle,
          lines: input.lines,
          accent: settings.appearance() === 'dark' ? manifest.accent.night : manifest.accent.day,
          appearance: settings.appearance(),
          emblem: manifest.emblem,
        }),
      copy: (text) => copyText(text),
    },
    setView(next) {
      view = next;
      showChromeFor(next);
    },
    setPauseItems(items) {
      pauseItems = items;
    },
    requestPause: () => openPauseMenu(),
    openSettings: () => options.onOpenSettings(),
    openHowToPlay: () => showHowToPlay(module),
    backToHall,
    forgetGameData() {
      void confirmDialog({
        title: `Forget ${manifest.title}?`,
        message: 'Your records, stats, save and patches for this game will be cleared. Other games are not touched.',
        confirm: 'Forget it',
        cancel: 'Keep it',
      }).then((ok) => {
        if (!ok) return;
        context.save.clear();
        services.records.forget(manifest.id);
        services.stats.forget(manifest.id);
        services.repos.progress.update((draft) => {
          draft.games = withoutGame(draft.games, manifest.id);
        });
        toast(`${manifest.title}: data forgotten`);
      });
    },
  };

  showChromeFor(view);
  instance = module.mount(host, context);
  host.focus();

  return {
    element,
    confirmLeave,
    dispose() {
      if (disposed) return;
      disposed = true;
      overlay?.close();
      document.removeEventListener('visibilitychange', onVisibility);
      instance.dispose();
      for (const loop of loops) loop.stop();
      input.dispose();
      services.audio.silence();
      stopEarned();
      stopTracker();
      services.bus.endSession();
      element.remove();
    },
  };
}
