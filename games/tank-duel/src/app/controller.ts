/**
 * Tank Duel inside the Hall: one stage for the whole visit, and the screens
 * the player moves through on it. The game menu idles over a Kids' duel; a
 * match goes through the pre-match cards, the match itself and the results
 * with the best hit replayed. Daily, challenge, micro-challenge and Versus
 * Night runs skip the menu and start the run they were opened for.
 */
import { createStage, type Stage } from '@woodgrain-88/arena';
import {
  dailyShareLine,
  KID_IDS,
  kidById,
  type Appearance,
  type GameContext,
  type GameInstance,
  type GameResult,
  type KidId,
  type LoopOptions,
  type ResultReceipt,
  type Seat,
  type Unsubscribe,
} from '@woodgrain-88/kit';
import { channelById } from '../engine/channels.ts';
import type { MatchEvent, MatchOptions, MatchState, Side } from '../engine/types.ts';
import {
  matchEndEvents,
  progressEvents,
  SURVIVED_EVENT,
  type MatchCircumstances,
} from '../progress/events.ts';
import { framingFor } from '../render/framing.ts';
import { createPrematchScreen, type PrematchScreen } from '../screens/prematch.ts';
import { createRecordsScreen } from '../screens/records.ts';
import { createResultsScreen, type ResultsScreen } from '../screens/results.ts';
import { createSettingsSheet } from '../screens/settings-sheet.ts';
import { createTutorialScreen } from '../screens/tutorial.ts';
import { createMenuScreen, type MenuScreen, type PlayMode } from '../screens/menu.ts';
import { ensureScreenStyle } from '../screens/style.ts';
import {
  createMatchSession,
  type MatchOutcome,
  type MatchSession,
  type SeatDriver,
} from '../session/match-session.ts';
import { buildResult } from '../session/result.ts';
import type { HudSeat } from '../ui/hud.ts';
import { finishTutorial, readSave, recordMatch, writeSave, type TankSave } from './save.ts';
import { createTankSettings, type TankSettingsStore } from './settings.ts';

/** A match the player asked for, kept so "Play again" can ask for the same one. */
interface MatchPlan {
  readonly mode: PlayMode;
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly kid: KidId | null;
}

type View = 'menu' | 'prematch' | 'match' | 'results' | 'tutorial';

const ROOT_STYLE = /* css */ `
.td-root { position: absolute; inset: 0; overflow: hidden; background: #3b2a1e; }
.td-root[data-appearance='dark'] { background: #07080c; }
.td-stage, .td-hud-layer { position: absolute; inset: 0; }
.td-hud-layer { pointer-events: none; z-index: 2; }
`;

/** The Kid the Hall seated in seat 2, or one picked from the run's seed when it seated a person. */
function seatedKid(context: GameContext): KidId {
  const fromSeat = context.seats.find((seat) => seat.seat === 2)?.kid;
  return fromSeat ?? KID_IDS[context.run.seed % KID_IDS.length] ?? 'lou';
}

function seatName(context: GameContext, seat: Seat, fallback: string): string {
  return (
    context.seats.find((info) => info.seat === seat && info.kind === 'human')?.name ?? fallback
  );
}

export function mountTankDuel(host: HTMLElement, context: GameContext): GameInstance {
  const root = document.createElement('div');
  root.className = 'td-root';
  const rootStyle = document.createElement('style');
  rootStyle.textContent = ROOT_STYLE;
  const stageHost = document.createElement('div');
  stageHost.className = 'td-stage';
  const hudLayer = document.createElement('div');
  hudLayer.className = 'td-hud-layer';
  const screens = document.createElement('div');
  screens.className = 'td-screens';
  root.append(rootStyle, stageHost, hudLayer, screens);
  host.append(root);
  ensureScreenStyle(root);

  const settings: TankSettingsStore = createTankSettings(context.settings.game);
  let save: TankSave = readSave(context.save);
  const channel = channelById(context.run.channel);
  let appearance: Appearance = context.settings.appearance();
  let kid: KidId = context.settings.game.get<KidId>('opponent', seatedKid(context));
  if (!KID_IDS.includes(kid)) kid = seatedKid(context);

  const stage: Stage = createStage({
    host: stageHost,
    appearance,
    quality: 'high',
    framing: framingFor(channel),
  });

  let view: View = 'menu';
  let session: MatchSession | null = null;
  let menu: MenuScreen | null = null;
  let prematch: PrematchScreen | null = null;
  let results: ResultsScreen | null = null;
  let sheetClose: (() => void) | null = null;
  let plan: MatchPlan | null = null;
  let takenHit = false;
  const subscriptions: Unsubscribe[] = [];

  function paintAppearance(): void {
    root.dataset.appearance = appearance;
    screens.dataset.appearance = appearance;
    screens.dataset.teamColours = settings.get().teamColours;
  }
  paintAppearance();

  function clearScreens(): void {
    menu?.dispose();
    prematch?.dispose();
    results?.dispose();
    sheetClose?.();
    menu = null;
    prematch = null;
    results = null;
    sheetClose = null;
  }

  function endSession(): void {
    session?.dispose();
    session = null;
  }

  function matchOptions(): MatchOptions {
    const switches = context.difficulty.get();
    const tank = settings.get();
    return {
      // Last Tank keeps its own short rounds whatever the rule; the engine reads it from the channel.
      scoring: context.run.mode === 'normal' ? tank.scoring : 'timed',
      handicap: [switches.left === 'A', switches.right === 'A'],
      wiring: tank.wiring,
      reverseGear: tank.reverseGear,
      ownRicochets: tank.ownRicochets,
    };
  }

  /** The keys a seat's player uses: alone, the whole keyboard; two people share it. */
  function keysNote(seat: 1 | 2, sharedKeyboard: boolean): string {
    if (seat === 2) return 'WASD · Space';
    return sharedKeyboard ? 'Arrows · Enter' : 'Arrows · Space';
  }

  /** Both seats as the HUD and the screens show them. */
  function hudSeats(drivers: readonly [SeatDriver, SeatDriver]): readonly [HudSeat, HudSeat] {
    const sharedKeyboard = drivers.every((driver) => driver.kind === 'human');
    return [hudSeat(drivers[0], 0, sharedKeyboard), hudSeat(drivers[1], 1, sharedKeyboard)];
  }

  function hudSeat(driver: SeatDriver, side: Side, sharedKeyboard: boolean): HudSeat {
    const position = side === 0 ? context.difficulty.get().left : context.difficulty.get().right;
    const switchNote = position === 'A' ? 'Handicap' : '';
    if (driver.kind === 'kid') return { name: kidById(driver.kid).name, note: switchNote };
    if (driver.kind === 'idle' || driver.kind === 'script')
      return { name: 'Practice target', note: 'Sits still, as in 1977' };
    const name = seatName(context, driver.seat, driver.seat === 1 ? 'Player 1' : 'Player 2');
    return { name, note: switchNote || keysNote(driver.seat, sharedKeyboard) };
  }

  /** The parts of every session that come from the player's settings and the context. */
  function sessionBasics(drivers: readonly [SeatDriver, SeatDriver]) {
    const tank = settings.get();
    return {
      stage,
      drivers,
      seats: hudSeats(drivers),
      appearance,
      reducedMotion: context.settings.reducedMotion(),
      explosions: tank.explosions,
      palette: tank.teamColours,
      shake: context.settings.screenShake(),
      rng: context.rng.fork(`match-${Math.floor(performance.now())}`),
      createLoop: (options: LoopOptions) => context.createLoop(options),
      input: drivers.some((driver) => driver.kind === 'human') ? context.input : null,
      favour: drivers[1].kind === 'human' ? ('either' as const) : (0 as const),
      audio: {
        engine: context.audio,
        volumes: () => {
          const mix = settings.get();
          return { engines: mix.engineVolume, effects: mix.effectsVolume };
        },
      },
    };
  }

  function startSession(
    drivers: readonly [SeatDriver, SeatDriver],
    withHud: boolean,
    onOver?: (outcome: MatchOutcome) => void,
  ): MatchSession {
    endSession();
    stage.setFraming(framingFor(channel));
    // Alone, the player has the whole keyboard; two people split it, the arrows and WASD.
    context.input.setLayout(drivers.every((driver) => driver.kind === 'human') ? 'split' : 'solo');
    const { audio, ...basics } = sessionBasics(drivers);
    const created = createMatchSession({
      ...basics,
      hudHost: withHud ? hudLayer : null,
      channel,
      match: matchOptions(),
      ...(withHud ? { audio } : {}),
      // The aim line is a practice aid: never in a match that counts.
      aimLine: withHud && plan?.mode === 'practice' && settings.get().aimLine,
      ...(context.run.micro ? { timeLimit: context.run.micro.seconds } : {}),
      ...(withHud ? { onStep: reportProgress } : {}),
      ...(onOver ? { onOver } : {}),
    });
    session = created;
    return created;
  }

  // ——— Game menu ———

  function showMenu(): void {
    clearScreens();
    view = 'menu';
    context.setView('menu');
    context.setPauseItems([]);
    const rival = KID_IDS.find((other) => other !== kid && other !== 'lou') ?? 'pip';
    const idle = (): void => {
      startSession(
        [
          { kind: 'kid', kid },
          { kind: 'kid', kid: rival },
        ],
        false,
        () => {
          if (view === 'menu') idle();
        },
      ).start();
    };
    idle();
    menu = createMenuScreen({
      host: screens,
      channel,
      kid,
      scoring: settings.get().scoring,
      switches: context.difficulty.get(),
      onStart: (mode) => beginPlan(planFor(mode)),
      onKid: (chosen) => {
        kid = chosen;
        context.settings.game.set('opponent', chosen);
      },
      onScoring: (rule) => settings.update({ scoring: rule }),
      onHowToPlay: () => showTutorial(),
      onSettings: () => openSheet('settings'),
      onRecords: () => openSheet('records'),
    });
    menu.show();
  }

  function showTutorial(): void {
    clearScreens();
    endSession();
    view = 'tutorial';
    context.setView('play');
    context.setPauseItems([]);
    const tutorial = createTutorialScreen({
      host: screens,
      stage,
      startSession: (lesson) => {
        endSession();
        session = createMatchSession({
          ...sessionBasics(lesson.drivers),
          ...lesson,
          hudHost: null,
          match: {
            scoring: 'timed',
            handicap: [false, false],
            wiring: settings.get().wiring,
            reverseGear: settings.get().reverseGear,
          },
          aimLine: (lesson.aimLine ?? false) || settings.get().aimLine,
        });
        return session;
      },
      onDone: (finished) => {
        if (finished) {
          save = finishTutorial(save);
          writeSave(context.save, save);
        }
        showMenu();
      },
    });
    sheetClose = () => tutorial.dispose();
  }

  function openSheet(which: 'settings' | 'records'): void {
    sheetClose?.();
    const sheet =
      which === 'settings'
        ? createSettingsSheet({
            host: screens,
            settings,
            onAllSettings: () => context.openSettings(),
            onClose: () => closeSheet(),
          })
        : createRecordsScreen({
            host: screens,
            save,
            best: (channelId) => context.records.best(channelId, 'normal'),
            onClose: () => closeSheet(),
          });
    sheetClose = () => sheet.dispose();
  }

  function closeSheet(): void {
    sheetClose?.();
    sheetClose = null;
    menu?.show();
  }

  function planFor(mode: PlayMode): MatchPlan {
    const player: SeatDriver = { kind: 'human', seat: 1 };
    if (mode === 'versus')
      return { mode, drivers: [player, { kind: 'human', seat: 2 }], kid: null };
    if (mode === 'practice') return { mode, drivers: [player, { kind: 'idle' }], kid: null };
    return { mode, drivers: [player, { kind: 'kid', kid }], kid };
  }

  /** The plan for a run the Hall opened directly: its seats as the Hall gave them. */
  function planFromSeats(): MatchPlan {
    const drivers = ([1, 2] as const).map((seat): SeatDriver => {
      const info = context.seats.find((each) => each.seat === seat);
      if (info?.kind === 'bot' && info.kid) return { kind: 'kid', kid: info.kid };
      if (seat === 2 && context.run.mode !== 'versus-night')
        return { kind: 'kid', kid: seatedKid(context) };
      return { kind: 'human', seat };
    }) as [SeatDriver, SeatDriver];
    const seatTwo = drivers[1];
    return {
      mode: seatTwo.kind === 'human' ? 'versus' : 'kid',
      drivers,
      kid: seatTwo.kind === 'kid' ? seatTwo.kid : null,
    };
  }

  // ——— Pre-match and match ———

  function beginPlan(next: MatchPlan): void {
    plan = next;
    clearScreens();
    view = 'prematch';
    context.setView('play');
    context.setPauseItems([]);
    // The coming match's table, live but held, behind the commanders' cards.
    startSession(next.drivers, true, (outcome) => finishMatch(next, outcome)).start({ held: true });
    prematch = createPrematchScreen({
      host: screens,
      channel,
      commanders: hudSeats(next.drivers),
      kids: [null, next.kid],
      ...(context.run.challenge ? { challengeScore: context.run.challenge.score } : {}),
      input: context.input,
      createLoop: (options) => context.createLoop(options),
      humans: [next.drivers[0].kind === 'human', next.drivers[1].kind === 'human'],
      onReady: () => startMatch(),
      onBack: () => showMenu(),
    });
  }

  function startMatch(): void {
    clearScreens();
    view = 'match';
    takenHit = false;
    context.setView('play');
    context.setPauseItems(
      context.run.mode === 'normal'
        ? [{ id: 'change-channel', label: 'Change channel', onSelect: () => showMenu() }]
        : [],
    );
    // The fire press that said "ready" must not also fire the first shell.
    context.input.reset();
    session?.release();
  }

  function circumstances(): MatchCircumstances {
    return {
      channel,
      kid: plan?.kid ?? null,
      playerOnA: context.difficulty.get().left === 'A',
    };
  }

  /** Practice earns nothing: a tank that never moves or fires is not a duel. */
  function counts(): boolean {
    return plan?.mode !== 'practice';
  }

  function reportProgress(state: MatchState, events: readonly MatchEvent[]): void {
    if (!counts()) return;
    for (const event of events) {
      if (event.kind === 'hit' && event.victim === 0) takenHit = true;
      if (event.kind === 'own-hit' && event.side === 0) takenHit = true;
    }
    for (const event of progressEvents(events, circumstances())) context.emit(event);
    if (state.over) for (const event of matchEndEvents(state, circumstances())) context.emit(event);
  }

  function finishMatch(finished: MatchPlan, outcome: MatchOutcome): void {
    let receipt: ResultReceipt | null = null;
    let result: GameResult | null = null;
    if (counts()) {
      if (context.run.micro && !takenHit) context.emit(SURVIVED_EVENT);
      const [first, second] = hudSeats(finished.drivers);
      result = buildResult({
        final: outcome.final,
        seats: [
          { name: first.name, kid: null },
          { name: second.name, kid: finished.kid },
        ],
        points: outcome.points,
        durationMs: outcome.durationMs,
        bestBank: outcome.bestBank,
      });
      receipt = context.reportResult(result);
      const winner = outcome.final.winner;
      save = recordMatch(save, {
        channel: channel.id,
        kid: finished.kid,
        outcome: winner === 0 ? 'win' : winner === 1 ? 'loss' : 'draw',
        bestBank: outcome.bestBank,
        at: new Date().toISOString(),
      });
      writeSave(context.save, save);
    }
    // A micro-challenge's own banner follows in the Hall; the game just stops.
    if (context.run.micro) return;
    showResults(finished, outcome, receipt, result);
  }

  /** A daily run's line for the share, as the Hall writes it for the games it presents. */
  function dailyShare(result: GameResult | null) {
    if (context.run.mode !== 'daily' || !result) return {};
    const line = dailyShareLine({
      title: context.manifest.title,
      date: new Date(),
      channelNumber: channel.number,
      score: result.scoreLabel,
      ...(result.emoji === undefined ? {} : { emoji: result.emoji }),
    });
    return { share: { line, copy: () => context.share.copy(line) } };
  }

  function showResults(
    finished: MatchPlan,
    outcome: MatchOutcome,
    receipt: ResultReceipt | null,
    result: GameResult | null,
  ): void {
    clearScreens();
    view = 'results';
    context.setView('results');
    context.setPauseItems([]);
    if (outcome.clip) session?.replay(outcome.clip);
    else session?.stand();
    results = createResultsScreen({
      host: screens,
      channel,
      final: outcome.final,
      seats: hudSeats(finished.drivers),
      kids: [null, finished.kid],
      versus: finished.drivers[1].kind === 'human',
      receipt,
      bestBank: outcome.bestBank,
      onPlayAgain: () => beginPlan(finished),
      onGameMenu: () => showMenu(),
      onBackToHall: () => context.backToHall(),
      ...dailyShare(result),
    });
  }

  // ——— Settings and appearance, live ———

  // Enter on the game menu plays a Kid, as its first button says, even before anything has focus.
  const onMenuKey = (event: KeyboardEvent): void => {
    if (view !== 'menu' || sheetClose !== null || event.key !== 'Enter' || event.repeat) return;
    if (event.target !== host && event.target !== document.body) return;
    event.preventDefault();
    beginPlan(planFor('kid'));
  };
  host.addEventListener('keydown', onMenuKey);
  subscriptions.push(() => host.removeEventListener('keydown', onMenuKey));

  subscriptions.push(
    context.settings.onAppearance((next) => {
      appearance = next;
      paintAppearance();
      stage.setAppearance(next);
      session?.setAppearance(next);
    }),
    settings.onChange(() => paintAppearance()),
    context.difficulty.onChange((switches) => menu?.setSwitches(switches)),
  );

  if (context.run.mode === 'normal') showMenu();
  else if (context.run.micro) {
    plan = planFromSeats();
    const micro = plan;
    startSession(micro.drivers, true, (outcome) => finishMatch(micro, outcome)).start();
    view = 'match';
    context.setView('play');
  } else beginPlan(planFromSeats());

  return {
    // The chrome pauses every loop made through the context; nothing else here runs on its own.
    pause: () => undefined,
    resume() {
      session?.restartAudio();
    },
    gameMenu() {
      showMenu();
    },
    playAgain() {
      if (plan) beginPlan(plan);
    },
    leaveCheck() {
      return view === 'match' ? 'would-lose-progress' : 'safe';
    },
    dispose() {
      for (const unsubscribe of subscriptions) unsubscribe();
      clearScreens();
      endSession();
      stage.dispose();
      root.remove();
    },
  };
}
