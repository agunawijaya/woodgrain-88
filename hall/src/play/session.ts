/**
 * A game, running: loads its module, builds the GameContext the contract
 * promises (seeded run, two-seat input, loops the chrome can pause, events,
 * records, patches, sharing) and wraps the game in the Hall's chrome:
 *
 * - on the game menu, "← Back to the Hall" top left (Escape does the same);
 * - during play, a pause button with an "Esc" hint, and the pause menu
 *   (Resume · game items · How to play · Settings · Game menu · Back to the Hall);
 * - results, when the game asks the Hall to present them
 *   (Play again (R) · Game menu · Back to the Hall (H)), with each patch
 *   earned being stitched, the Counter lamps it lit, and the daily share line;
 * - a confirmation before leaving only when progress would be lost.
 *
 * As a Power Cycle Run round or a Versus Night game it also does what
 * den-modes.ts describes.
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
  channelNumber,
  copyText,
  dailyShareLine,
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
  type ResultReceipt,
  type RunInfo,
  type DifficultySwitches,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { confirmDialog, openDialog, toast, type Dialog } from '../chrome/dialog.ts';
import { showHowToPlay } from '../chrome/how-to-play.ts';
import { escapeXml } from '../den/svg.ts';
import type { RunAftermath } from '../app/den-life.ts';
import { patchArt } from '../jacket/patch-look.ts';
import { openChannelPicker } from '../channels/channel-picker.ts';
import { createRunRound, createVersusGame } from './den-modes.ts';

export interface PlaySessionOptions {
  services: Services;
  entry: GameEntry;
  /**
   * Where the play view goes. It is put in place before the game mounts, so the game is in the
   * page when it takes focus and the first key pressed reaches it.
   */
  parent: HTMLElement;
  run: RunInfo;
  /** A Power Cycle Run round: the micro-challenge it plays. */
  micro?: string | null;
  onBackToHall(): void;
  onOpenSettings(): void;
  /** A run round is over; the Den flips to the next one. */
  onRoundOver?(): void;
  /** "Back to the chalkboard" after a Versus Night game. */
  onBackToVersus?(): void;
  /** The dial on the game menu tuned to another channel: start again on it. */
  onSwitchChannel?(channel: string): void;
}

export interface PlaySession {
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
  const { services, entry } = options;
  const { manifest } = entry;
  if (!entry.load) throw new Error(`${manifest.id} has no module yet`);
  const module: GameModule = await entry.load();
  // Set once a run round has ended, so the walk back to the Den needs no confirmation.
  let leaveFreely = false;
  const round = createRunRound({
    services,
    module,
    run: options.run,
    challengeId: options.micro ?? null,
    onRoundOver: () => {
      leaveFreely = true;
      options.onRoundOver?.();
    },
  });
  const versusGame = round ? null : createVersusGame(services, manifest.id, options.run);
  const run = round?.run ?? options.run;

  const element = document.createElement('section');
  element.className = 'play-view';
  element.setAttribute('aria-label', manifest.title);
  element.style.setProperty('--game-accent-day', manifest.accent.day);
  element.style.setProperty('--game-accent-night', manifest.accent.night);
  element.innerHTML =
    `<div class="game-host" tabindex="-1"></div>` +
    `<div class="play-chrome">` +
    `<button type="button" class="button play-back" data-action="hall">← Back to the Hall</button>` +
    // On the game menu, the TV dial: not in a run round or a Versus Night game, where the channel is set.
    (round || versusGame
      ? ''
      : `<button type="button" class="button play-channel" data-action="dial">CH ${String(channelNumber(manifest.channels, run.channel)).padStart(2, '0')} · ${escapeXml(manifest.channels.find((channel) => channel.id === run.channel)?.title ?? '')}</button>`) +
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
  if (!host || !backButton || !pauseButton || !hint)
    throw new Error('Play view markup is missing parts');
  if (round) element.querySelector('.play-chrome')?.append(round.hud);
  const channelButton = element.querySelector<HTMLButtonElement>('.play-channel');

  let view: GameView = 'menu';
  let pauseItems: readonly PauseItem[] = [];
  let paused = false;
  let overlay: Dialog | null = null;
  let instance: GameInstance | null = null;
  let disposed = false;
  const loops = new Set<GameLoop>();
  const earnedThisRun: PatchEarned[] = [];

  // ——— Progress hooks for this game ———
  const { denLife } = services;
  denLife.registerPatches(manifest.id, module.patches);
  const tracker = createPatchTracker({
    games: [{ id: manifest.id, patches: module.patches }],
    progress: services.repos.progress,
  });
  const stopTracker = tracker.connect(services.bus);
  const stopEarned = tracker.onEarned((earned) => {
    earnedThisRun.push(earned);
    toast(`Patch earned: ${earned.patch.title}${earned.gold ? ' (gold thread)' : ''}`, {
      tone: 'celebrate',
    });
  });
  services.bus.beginSession({
    game: manifest.id,
    mode: run.mode,
    channel: run.channel,
    difficulty: denLife.switches(),
  });
  // A switch flipped mid-run (from the pause menu or the Den) reaches the game, which applies it
  // from its next round or game; events carry the new positions from now on.
  const switchListeners = new Set<(switches: DifficultySwitches) => void>();
  let lastSwitches = denLife.switches();
  const stopSwitches = denLife.onChange(() => {
    const next = denLife.switches();
    if (next.left === lastSwitches.left && next.right === lastSwitches.right) return;
    lastSwitches = next;
    services.bus.setDifficulty(next);
    for (const listener of switchListeners) listener(next);
  });
  const seats = versusGame?.seats ?? denLife.seatsFor(manifest);
  // The Counter as it stood when the game began, so the results can say which lamps this run lit.
  const litAtStart = denLife.litLamps();

  // ——— Input ———
  // One person alone has the whole keyboard; two share it. A game whose own menu switches between
  // the two sets the layout again for each match.
  const controls = services.settings.get().controls;
  const people = seats.filter((seat) => seat.kind === 'human').length;
  const input = createInput({
    pointerTarget: host,
    layout: people >= 2 ? 'split' : 'solo',
    bindings: controls.bindings ?? DEFAULT_BINDINGS,
    padSeats: controls.padSeats,
  });

  const showChromeFor = (next: GameView) => {
    backButton.hidden = next !== 'menu';
    if (channelButton) channelButton.hidden = next !== 'menu';
    pauseButton.hidden = next !== 'play';
    if (next === 'play') {
      maybeShowEscHint();
      round?.playing();
    }
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
    if (leaveFreely || !instance || instance.leaveCheck() === 'safe') return true;
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
    round?.setPaused(true);
    instance?.pause(reason);
    services.audio.silence();
  };
  const resumeGame = () => {
    if (!paused) return;
    paused = false;
    input.reset();
    for (const loop of loops) loop.resume();
    round?.setPaused(false);
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
    const switchesRow = () => {
      const switches = denLife.switches();
      const button = (side: 'left' | 'right', label: string) =>
        `<button type="button" class="pause-switch" data-switch="${side}" aria-label="${label} difficulty switch: ${switches[side] === 'A' ? 'A, hard' : 'B, easy'}. Press to flip"><span>${label}</span><span class="pause-switch-slot"><span class="pause-switch-thumb${switches[side] === 'A' ? ' is-a' : ''}"></span></span><strong>${switches[side]}</strong></button>`;
      const note = manifest.difficulty?.liveChange
        ? ''
        : '<small>A flip applies from the next round.</small>';
      return `<div class="pause-switches" data-ref="switches">${button('left', 'Left')}${button('right', 'Right')}${note}</div>`;
    };
    overlay.body.innerHTML =
      `<p class="dialog-kicker">${escapeXml(manifest.title)}</p>` +
      switchesRow() +
      `<div class="menu-list">` +
      items
        .map(
          ([id, label], i) =>
            `<button type="button" class="button${i === 0 ? ' button--primary' : ''}" data-item="${escapeXml(id)}">${escapeXml(label)}</button>`,
        )
        .join('') +
      `</div>`;
    const pauseDialog = overlay;
    pauseDialog.body.addEventListener('click', (event) => {
      const side = (event.target as Element).closest<HTMLButtonElement>('[data-switch]')?.dataset
        .switch;
      if (side === 'left' || side === 'right') {
        denLife.setSwitch(side, denLife.switches()[side] === 'A' ? 'B' : 'A');
        services.audio.play('switch-snick');
        const row = pauseDialog.body.querySelector('[data-ref="switches"]');
        if (row) row.outerHTML = switchesRow();
        pauseDialog.body.querySelector<HTMLButtonElement>(`[data-switch="${side}"]`)?.focus();
        return;
      }
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
    if (document.visibilityState === 'hidden' && view === 'play' && !overlay)
      openPauseMenu('hidden');
  };
  document.addEventListener('visibilitychange', onVisibility);
  element.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLButtonElement>('[data-action]')?.dataset
      .action;
    if (action === 'hall') backToHall();
    if (action === 'pause') openPauseMenu();
    if (action === 'dial')
      openChannelPicker({
        services,
        manifest,
        current: run.channel,
        verb: 'Switch to',
        onPlay: (channel) => options.onSwitchChannel?.(channel),
      });
  });

  // ——— Results the Hall presents ———
  /** The daily share line, with the player's name only when they asked for it. */
  const shareLineFor = (result: GameResult) => {
    const name = services.repos.profile.get().displayName.trim();
    return dailyShareLine({
      title: manifest.title,
      date: new Date(),
      channelNumber: channelNumber(manifest.channels, run.channel),
      score: result.scoreLabel,
      ...(result.emoji === undefined ? {} : { emoji: result.emoji }),
      ...(services.settings.get().shareWithName && name !== '' ? { name } : {}),
    });
  };

  // Each patch earned is stitched in on the results screen: the needle passes, the thread fills.
  const stitchedPatches = (receipt: ResultReceipt) =>
    receipt.patchesEarned.length === 0
      ? ''
      : `<ul class="results-patches" aria-label="Patches earned">${receipt.patchesEarned
          .map(
            (earned, index) =>
              `<li class="stitching" style="--stitch-delay: ${index * 700}ms"><span class="stitching-art" aria-hidden="true">${patchArt({ manifest, patchId: earned.patch.id, tier: earned.patch.tier, state: 'earned', gold: earned.gold }, 88, `results-${index}`)}<span class="stitching-needle"></span></span><span>${escapeXml(earned.patch.title)}${earned.gold ? ' <em>gold thread</em>' : ''}</span></li>`,
          )
          .join('')}</ul>`;

  const lampsLit = (aftermath: RunAftermath | null) =>
    aftermath && aftermath.newLamps.length > 0
      ? `<p class="results-lamps"><span class="results-lamp" aria-hidden="true"></span>Lamp ${aftermath.newLamps.join(' and ')} lit on the Counter</p>`
      : '';

  const showResults = (
    result: GameResult,
    receipt: ResultReceipt,
    versusLine: string | null,
    aftermath: RunAftermath | null,
  ) => {
    if (overlay) overlay.close();
    const versus = result.winnerSeat !== undefined;
    const seatName = (seat: 1 | 2) =>
      seats.find((info) => info.seat === seat)?.name ?? `Seat ${seat}`;
    const headline =
      versusLine ??
      (versus
        ? result.winnerSeat === null || result.winnerSeat === undefined
          ? "It's a draw"
          : `${seatName(result.winnerSeat)} wins!`
        : result.won === false
          ? 'Nice try'
          : 'Well played');
    overlay = openDialog({
      title: headline,
      className: 'dialog--results',
      onClose: () => (overlay = null),
    });
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
      stitchedPatches(receipt) +
      lampsLit(aftermath) +
      (run.mode === 'daily'
        ? `<p class="results-daily">${aftermath?.dailyCounted === false ? "Practice: today's daily already counts your first run. " : ''}<span class="results-daily-line">${escapeXml(shareLineFor(result))}</span><button type="button" class="button button--quiet" data-result="daily">Copy</button></p>`
        : '') +
      `<div class="results-share">` +
      (manifest.supports.challengeLinks
        ? `<button type="button" class="button button--quiet" data-result="challenge">Challenge a friend</button>`
        : '') +
      `<button type="button" class="button button--quiet" data-result="card">Share card</button>` +
      `</div>` +
      `<div class="menu-list menu-list--row">` +
      (versusLine !== null
        ? `<button type="button" class="button button--primary" data-result="versus">Back to the chalkboard <span class="kbd">V</span></button>`
        : `<button type="button" class="button button--primary" data-result="again">${versus ? 'Rematch' : 'Play again'} <span class="kbd">R</span></button>`) +
      `<button type="button" class="button" data-result="menu">Game menu</button>` +
      `<button type="button" class="button" data-result="hall">Back to the Hall <span class="kbd">H</span></button>` +
      `</div>`;
    if (receipt.newBest) services.audio.play('soft-tap', { pitch: 1.5 });
    if (receipt.patchesEarned.length > 0) services.audio.play('needle-stitch');
    const act = (what: string) => {
      if (what === 'versus') {
        dialog.close();
        options.onBackToVersus?.();
      } else if (what === 'again') {
        dialog.close();
        instance?.playAgain();
      } else if (what === 'menu') {
        dialog.close();
        instance?.gameMenu();
      } else if (what === 'hall') {
        dialog.close();
        options.onBackToHall();
      } else if (what === 'daily') {
        const line = shareLineFor(result);
        void copyText(line).then((ok) => toast(ok ? 'Share line copied' : line));
      } else if (what === 'challenge') {
        const link = `${location.origin}${location.pathname}${challenge}`;
        void copyText(link).then((ok) => toast(ok ? 'Challenge link copied' : link));
      } else if (what === 'card') {
        const card = context.share.card({ subtitle: headline, lines: [result.scoreLabel] });
        downloadText(`${manifest.id}-card.svg`, card, 'image/svg+xml');
      }
    };
    dialog.body.addEventListener('click', (event) => {
      const what = (event.target as Element).closest<HTMLButtonElement>('[data-result]')?.dataset
        .result;
      if (what) act(what);
    });
    dialog.element.addEventListener('keydown', (event) => {
      if ((event.key === 'r' || event.key === 'R') && versusLine === null) act('again');
      if ((event.key === 'v' || event.key === 'V') && versusLine !== null) act('versus');
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
  const settings = services.settings;
  const context: GameContext = {
    manifest,
    run,
    rng: createRng(run.seed),
    seats,
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
    difficulty: {
      get: () => denLife.switches(),
      onChange(listener) {
        switchListeners.add(listener);
        return () => switchListeners.delete(listener);
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
      // A stopped loop is let go: kept, it would hold its game's finished match in memory.
      const loop = createLoop({
        ...loopOptions,
        autoPause: false,
        onStop: () => {
          loops.delete(loop);
          loopOptions.onStop?.();
        },
      });
      loops.add(loop);
      return loop;
    },
    emit: (event) => services.bus.emit(event),
    reportResult(result) {
      const durationMs = result.durationMs;
      const submitted = Number.isFinite(result.score)
        ? services.records.submit(
            manifest.id,
            {
              score: result.score,
              at: new Date().toISOString(),
              seed: run.seed,
              durationMs,
              channel: run.channel,
              mode: run.mode,
            },
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
      const aftermath = denLife.recordFinishedRun({
        manifest,
        run,
        result,
        seats,
        litBefore: litAtStart,
      });
      const versusLine = versusGame ? versusGame.recordResult(result) : null;
      // A run round ends with the game; the round's own banner replaces the results screen.
      round?.gameEnded();
      // The Den sparkles them in and marks them seen when the player walks back.
      for (const item of denLife.announceGrowth(aftermath.newGrowth))
        toast(item.toast, { tone: 'celebrate' });
      services.bus.emit({
        type: 'result',
        data: { score: result.score, won: result.won ?? false, newBest: submitted.newBest },
      });
      const receipt: ResultReceipt = {
        newBest: submitted.newBest,
        rank: submitted.rank,
        patchesEarned: earnedThisRun.splice(0),
        micro: null,
      };
      if (result.presentation === 'hall' && !round) {
        // The bus delivers the result event (and any patch it earns) on a
        // microtask queued before this one, so the screen sees those patches too.
        queueMicrotask(() =>
          showResults(
            result,
            { ...receipt, patchesEarned: [...receipt.patchesEarned, ...earnedThisRun.splice(0)] },
            versusLine,
            aftermath,
          ),
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
        message:
          'Your records, stats, save and patches for this game will be cleared. Other games are not touched.',
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
  options.parent.append(element);
  instance = module.mount(host, context);
  host.focus();

  return {
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
      stopSwitches();
      round?.dispose();
      services.bus.endSession();
      element.remove();
    },
  };
}
