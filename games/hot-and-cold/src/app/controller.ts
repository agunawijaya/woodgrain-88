/**
 * Hot & Cold inside the Hall: one stage per look, and the screens the player
 * moves through on it. The game menu idles over two Kids racing for a flag;
 * a match goes through the pre-match cards, the match and the results with
 * the field still standing behind them. Daily, challenge and micro-challenge
 * runs skip the menu and start the run they were opened for. Changing the
 * look builds a new stage (each look has its own light); changing the
 * appearance only repaints.
 */
import type { Stage } from '@woodgrain-88/arena';
import {
  dailyShareLine,
  KID_IDS,
  kidById,
  type Appearance,
  type Bindings,
  type GameContext,
  type GameInstance,
  type GameResult,
  type KidId,
  type LoopOptions,
  type MemoryMode,
  type ResultReceipt,
  type Seat as PlayerSeat,
  type Unsubscribe,
} from '@woodgrain-88/kit';
import type { ClueMode } from '../ai/kid.ts';
import { channelById, DAILY_RULES, type HotColdChannel } from '../channels.ts';
import type { Match, MatchEvent, Seat } from '../engine/match.ts';
import { cartridgeRules, shortened, type DifficultySwitch, type Rules } from '../engine/rules.ts';
import { squareCentre } from '../look/field-space.ts';
import type { LookId } from '../look/look.ts';
import { createLookStage, LOOKS, paintBackground } from '../look/looks.ts';
import { seatColours } from '../look/seats.ts';
import { createProgressTracker, type ProgressTracker } from '../progress/tracker.ts';
import { createMenuScreen, type MenuScreen, type PlayMode } from '../screens/menu.ts';
import {
  createPrematchScreen,
  type PrematchScreen,
  type PrematchSeat,
} from '../screens/prematch.ts';
import { createRecordsScreen } from '../screens/records.ts';
import { createResultsScreen, type ResultsScreen } from '../screens/results.ts';
import { createSettingsSheet } from '../screens/settings-sheet.ts';
import { ensureScreenStyle } from '../screens/style.ts';
import { createTutorialScreen } from '../screens/tutorial.ts';
import { withDiagonals } from '../session/controls.ts';
import {
  createMatchSession,
  type MatchOutcome,
  type MatchSession,
  type SeatDriver,
} from '../session/match-session.ts';
import { buildResult, seatOneOutcome } from '../session/result.ts';
import type { HudSeat } from '../ui/hud.ts';
import {
  boardKey,
  finishTutorial,
  readSave,
  recordMatch,
  writeSave,
  type HotColdSave,
} from './save.ts';
import { createHotColdSettings, type HotColdSettingsStore } from './settings.ts';

/** A match the player asked for, kept so "Play again" can ask for the same one. */
interface MatchPlan {
  readonly mode: PlayMode;
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly kid: KidId | null;
}

type View = 'menu' | 'prematch' | 'match' | 'results' | 'tutorial';

/** What the tutorial asks of a session beyond a match's usual setup. */
interface TutorialLesson {
  readonly clues: ClueMode;
  readonly fog: boolean;
  readonly arrange: (match: Match) => void;
  readonly onEvents: (events: readonly MatchEvent[], match: Match) => void;
}

const ROOT_STYLE = /* css */ `
.hc-root { position: absolute; inset: 0; overflow: hidden; background: #dfe9f3; }
.hc-root[data-appearance='dark'] { background: #05080f; }
.hc-stage, .hc-hud-layer { position: absolute; inset: 0; }
.hc-hud-layer { pointer-events: none; z-index: 2; }
`;

/** Why the possibility fog is off for a run the Hall opened, or null when the player may choose. */
const FOG_LOCKS: Partial<Record<GameContext['run']['mode'], string>> = {
  daily: 'The fog is off for the daily: everyone hunts the same field the same way.',
  challenge: 'The fog is off for challenge links, so both of you hunt on equal terms.',
  'power-cycle-run': 'The fog is off in a Power Cycle Run.',
  'versus-night': 'The fog is off on Versus Night.',
};

/** The Kid the Hall seated in seat 2, or one picked from the run's seed when it seated a person. */
function seatedKid(context: GameContext): KidId {
  const fromSeat = context.seats.find((seat) => seat.seat === 2)?.kid;
  return fromSeat ?? KID_IDS[context.run.seed % KID_IDS.length] ?? 'lou';
}

function personName(context: GameContext, seat: PlayerSeat): string {
  const named = context.seats.find((info) => info.seat === seat && info.kind === 'human')?.name;
  return named ?? `Player ${seat}`;
}

export function mountHotAndCold(host: HTMLElement, context: GameContext): GameInstance {
  const root = document.createElement('div');
  root.className = 'hc-root';
  const rootStyle = document.createElement('style');
  rootStyle.textContent = ROOT_STYLE;
  const stageHost = document.createElement('div');
  stageHost.className = 'hc-stage';
  const hudLayer = document.createElement('div');
  hudLayer.className = 'hc-hud-layer';
  const screens = document.createElement('div');
  screens.className = 'hc-screens';
  root.append(rootStyle, stageHost, hudLayer, screens);
  host.append(root);
  ensureScreenStyle(root);

  const settings: HotColdSettingsStore = createHotColdSettings(context.settings.game);
  let save: HotColdSave = readSave(context.save);
  const channel: HotColdChannel = channelById(context.run.channel);
  let appearance: Appearance = context.settings.appearance();
  let kid: KidId = context.settings.game.get<KidId>('opponent', seatedKid(context));
  if (!KID_IDS.includes(kid)) kid = seatedKid(context);
  const fogLock = FOG_LOCKS[context.run.mode] ?? null;

  // The 1978 joystick's diagonals, added for this game only and handed back on the way out.
  const playerBindings: Bindings = context.input.bindings;
  context.input.setBindings(withDiagonals(playerBindings));

  let look: LookId = settings.get().look;
  let stage: Stage = buildStage();

  let view: View = 'menu';
  let session: MatchSession | null = null;
  let menu: MenuScreen | null = null;
  let prematch: PrematchScreen | null = null;
  let results: ResultsScreen | null = null;
  let sheetClose: (() => void) | null = null;
  let plan: MatchPlan | null = null;
  let tracker: ProgressTracker | null = null;
  let matchesStarted = 0;
  const subscriptions: Unsubscribe[] = [];

  function buildStage(): Stage {
    return createLookStage({ host: stageHost, look: LOOKS[look], appearance, quality: 'high' });
  }

  function paintAppearance(): void {
    root.dataset.appearance = appearance;
    screens.dataset.appearance = appearance;
    screens.dataset.seatColours = settings.get().seatColours;
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

  /** The Den's Kid memory: human by default, sharp for players who want the harder Kids. */
  function kidMemory(): MemoryMode {
    return 'human';
  }

  function clues(): ClueMode {
    return settings.get().clues;
  }

  function fogOn(): boolean {
    return fogLock === null && settings.get().fog;
  }

  /** The rules this run plays by: the daily's single hunt, or the channel's, shortened if asked. */
  function rulesForRun(): Rules {
    if (context.run.mode === 'daily') return DAILY_RULES;
    const short = context.run.mode === 'normal' && settings.get().matchLength === 'short';
    return short ? shortened(channel.rules) : channel.rules;
  }

  /**
   * The daily and a challenge link hunt the run's own field, the same for everyone; a match from
   * the menu gets a fresh field every time.
   */
  function matchSeed(): string | number {
    if (context.run.mode !== 'normal') return context.run.seed;
    return `${String(context.run.seed)}/${String(matchesStarted++)}`;
  }

  function switches(): readonly [DifficultySwitch, DifficultySwitch] {
    const { left, right } = context.difficulty.get();
    return [left, right];
  }

  // ——— Seats as the screens show them ———

  function sharedKeyboard(drivers: readonly [SeatDriver, SeatDriver]): boolean {
    return drivers.every((driver) => driver.kind === 'human');
  }

  function keysNote(seat: PlayerSeat, shared: boolean): string {
    if (!shared) return 'Arrows · Enter · or the mouse';
    return seat === 1 ? 'Arrows · Enter' : 'WASD · Space';
  }

  function hudSeats(drivers: readonly [SeatDriver, SeatDriver]): readonly [HudSeat, HudSeat] {
    const colours = seatColours(settings.get().seatColours);
    const shared = sharedKeyboard(drivers);
    const seatFor = (driver: SeatDriver, index: Seat): HudSeat => {
      if (driver.kind === 'kid') {
        return {
          name: kidById(driver.kid).name,
          note: kidById(driver.kid).style,
          colours: colours[index],
        };
      }
      if (driver.kind === 'human') {
        return {
          name: personName(context, driver.seat),
          note: keysNote(driver.seat, shared),
          colours: colours[index],
        };
      }
      return { name: '', note: '', colours: colours[index] };
    };
    return [seatFor(drivers[0], 0), seatFor(drivers[1], 1)];
  }

  function switchNote(rules: Rules, position: DifficultySwitch): string {
    if (position === 'B') return 'Switch B';
    if (rules.style === 'race' && rules.motion === 'still') return 'Switch A: slower steps';
    if (rules.style === 'hunts') return 'Switch A: checks count twice';
    return 'Switch A: no effect here';
  }

  function prematchSeats(drivers: readonly [SeatDriver, SeatDriver], rules: Rules): PrematchSeat[] {
    const huds = hudSeats(drivers);
    const shared = sharedKeyboard(drivers);
    const positions = switches();
    return ([0, 1] as const)
      .filter((index) => drivers[index].kind !== 'empty')
      .map((index) => {
        const driver = drivers[index];
        const person = driver.kind === 'human' ? driver.seat : null;
        return {
          hud: huds[index],
          kid: driver.kind === 'kid' ? driver.kid : null,
          person,
          revealKey: person === 2 && shared ? 'Space' : 'Enter',
          switchNote: switchNote(rules, positions[index]),
        };
      });
  }

  // ——— Sessions ———

  function startSession(
    drivers: readonly [SeatDriver, SeatDriver],
    rules: Rules,
    live: boolean,
    onOver?: (outcome: MatchOutcome) => void,
    lesson?: TutorialLesson,
  ): MatchSession {
    endSession();
    const humans = drivers.filter((driver) => driver.kind === 'human').length;
    context.input.setLayout(humans === 2 ? 'split' : 'solo');
    const mine = settings.get();
    const reducedMotion = context.settings.reducedMotion();
    const created = createMatchSession({
      stage,
      look: LOOKS[look],
      // The tutorial's own card does the talking; a HUD over it would only say "First to 1".
      hudHost: live && !lesson ? hudLayer : null,
      pointerArea: live ? host : null,
      rules,
      seed: live ? matchSeed() : `menu/${String(matchesStarted++)}`,
      switches: live ? switches() : ['B', 'B'],
      drivers,
      seats: hudSeats(drivers),
      clues: lesson?.clues ?? clues(),
      memory: kidMemory(),
      fog: lesson?.fog ?? (live && fogOn()),
      ...(channel.clueFadeSeconds === undefined || !live
        ? {}
        : { clueFadeSeconds: channel.clueFadeSeconds }),
      appearance,
      quality: 'high',
      reducedMotion,
      reducedEffects: reducedMotion || mine.effects === 'reduced',
      cluePalette: mine.clueColours === 'colour-blind' ? 'colour-blind' : 'thermal',
      createLoop: (options: LoopOptions) => context.createLoop(options),
      input: humans > 0 ? context.input : null,
      ...(live && context.run.micro ? { timeLimit: context.run.micro.seconds } : {}),
      ...(live
        ? { audio: { engine: context.audio, volume: () => settings.get().effectsVolume } }
        : {}),
      ...(lesson ? { arrange: lesson.arrange, onEvents: lesson.onEvents } : {}),
      ...(live && !lesson ? { onEvents: reportProgress } : {}),
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
    idleBehindMenu();
    buildMenu();
  }

  /** The menu's card, showing the settings as they are now. */
  function buildMenu(): void {
    menu?.dispose();
    menu = createMenuScreen({
      host: screens,
      channel,
      kid,
      clues: clues(),
      look,
      memory: kidMemory(),
      switches: context.difficulty.get(),
      onStart: (mode) => beginPlan(planFor(mode)),
      onKid: (chosen) => {
        kid = chosen;
        context.settings.game.set('opponent', chosen);
      },
      onClues: (chosen) => settings.update({ clues: chosen }),
      onLook: (chosen) => settings.update({ look: chosen }),
      onHowToPlay: () => showTutorial(),
      onSettings: () => openSheet('settings'),
      onRecords: () => openSheet('records'),
    });
    menu.show();
  }

  /** Two Kids racing for a flag behind the menu, one field after another. */
  function idleBehindMenu(): void {
    const rival = KID_IDS.find((other) => other !== kid) ?? 'pip';
    startSession(
      [
        { kind: 'kid', kid },
        { kind: 'kid', kid: rival },
      ],
      cartridgeRules(1),
      false,
      () => {
        if (view === 'menu') idleBehindMenu();
      },
    ).start();
  }

  function showTutorial(): void {
    clearScreens();
    endSession();
    view = 'tutorial';
    context.setView('play');
    context.setPauseItems([]);
    const tutorial = createTutorialScreen({
      host: screens,
      startSession: (lesson) => {
        const drivers: readonly [SeatDriver, SeatDriver] = [
          { kind: 'human', seat: 1 },
          { kind: 'empty' },
        ];
        // One flag to find; the match ends there and the last card stays over the field.
        const created = startSession(drivers, { ...cartridgeRules(1), goal: 1 }, true, undefined, {
          clues: 'notebook',
          fog: false,
          arrange: lesson.arrange,
          onEvents: lesson.onEvents,
        });
        return created;
      },
      project: (square) => {
        const point = squareCentre(square, LOOKS[look].fieldHeight).project(stage.camera);
        const box = hudLayer.getBoundingClientRect();
        return { x: ((point.x + 1) / 2) * box.width, y: ((1 - point.y) / 2) * box.height };
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
            fogLocked: fogLock,
            onAllSettings: () => context.openSettings(),
            onClose: () => closeSheet(),
          })
        : createRecordsScreen({ host: screens, save, onClose: () => closeSheet() });
    sheetClose = () => sheet.dispose();
  }

  /** Back to the menu, rebuilt: the sheet may have changed the clues or the look it shows. */
  function closeSheet(): void {
    sheetClose?.();
    sheetClose = null;
    if (view === 'menu') buildMenu();
  }

  function planFor(mode: PlayMode): MatchPlan {
    const player: SeatDriver = { kind: 'human', seat: 1 };
    if (mode === 'versus')
      return { mode, drivers: [player, { kind: 'human', seat: 2 }], kid: null };
    if (mode === 'alone' || channel.rules.style === 'clock') {
      return { mode: 'alone', drivers: [player, { kind: 'empty' }], kid: null };
    }
    return { mode, drivers: [player, { kind: 'kid', kid }], kid };
  }

  /** The plan for a run the Hall opened directly: its seats as the Hall gave them. */
  function planFromSeats(): MatchPlan {
    const rules = rulesForRun();
    const player: SeatDriver = { kind: 'human', seat: 1 };
    if (rules.singleHunt || rules.style === 'clock') {
      return { mode: 'alone', drivers: [player, { kind: 'empty' }], kid: null };
    }
    const second = context.seats.find((each) => each.seat === 2);
    if (second?.kind === 'human' && context.run.mode === 'versus-night') {
      return { mode: 'versus', drivers: [player, { kind: 'human', seat: 2 }], kid: null };
    }
    const rival = second?.kind === 'bot' && second.kid ? second.kid : seatedKid(context);
    return { mode: 'kid', drivers: [player, { kind: 'kid', kid: rival }], kid: rival };
  }

  // ——— Pre-match and match ———

  function beginPlan(next: MatchPlan): void {
    plan = next;
    clearScreens();
    view = 'prematch';
    context.setView('play');
    context.setPauseItems([]);
    const rules = rulesForRun();
    tracker = createProgressTracker(save.cleanStreak, {
      rules,
      kid: next.kid,
      clues: clues(),
      playerOnA: context.difficulty.get().left === 'A',
    });
    // The coming match's field, live but held, behind the cards.
    startSession(next.drivers, rules, true, (outcome) => finishMatch(next, outcome)).start({
      held: true,
    });
    const challenge = context.run.challenge;
    prematch = createPrematchScreen({
      host: screens,
      channel,
      seats: prematchSeats(next.drivers, rules),
      clues: clues(),
      ...(challenge ? { challenge: `beat a score of ${challenge.score}` } : {}),
      input: context.input,
      createLoop: (options) => context.createLoop(options),
      onReady: () => startMatch(),
      onBack: () => showMenu(),
    });
  }

  function startMatch(): void {
    clearScreens();
    view = 'match';
    context.setView('play');
    context.setPauseItems(
      context.run.mode === 'normal'
        ? [{ id: 'change-channel', label: 'Change channel', onSelect: () => showMenu() }]
        : [],
    );
    // The press that said "ready" must not also check the first square.
    context.input.reset();
    session?.release();
  }

  function reportProgress(events: readonly MatchEvent[], match: Match): void {
    if (!tracker) return;
    for (const event of tracker.hear(events, match)) context.emit(event);
  }

  function finishMatch(finished: MatchPlan, outcome: MatchOutcome): void {
    const versus = finished.drivers[1].kind === 'human';
    const result = buildResult({
      match: outcome.match,
      result: outcome.result,
      trail: outcome.trail,
      durationMs: outcome.durationMs,
      kid: finished.kid,
      clues: clues(),
      versus,
    });
    const receipt = context.reportResult(result);
    recordFinished(finished, outcome, result);
    // A micro-challenge's own banner follows in the Hall; the game just stops.
    if (context.run.micro) return;
    showResults(finished, outcome, receipt, result);
  }

  function recordFinished(finished: MatchPlan, outcome: MatchOutcome, result: GameResult): void {
    const recorded = recordMatch(save, {
      channel: channel.def.id,
      kid: finished.kid,
      outcome: seatOneOutcome(outcome.result, outcome.match.setup.seats),
      board: boardKey(channel.def.id, context.run.mode, clues(), kidMemory()),
      score: result.score,
      label: result.scoreLabel,
      at: new Date().toISOString(),
    });
    // A run with the fog on still counts as played, but never as a best.
    save = {
      ...(fogOn() ? { ...recorded, bests: save.bests } : recorded),
      cleanStreak: tracker?.streak ?? save.cleanStreak,
    };
    writeSave(context.save, save);
  }

  /** A daily run's line for the share, as the Hall writes it for the games it presents. */
  function dailyShare(result: GameResult) {
    if (context.run.mode !== 'daily') return {};
    const line = dailyShareLine({
      title: context.manifest.title,
      date: new Date(),
      score: result.scoreLabel,
      ...(result.emoji === undefined ? {} : { emoji: result.emoji }),
    });
    return { share: { line, copy: () => context.share.copy(line) } };
  }

  function showResults(
    finished: MatchPlan,
    outcome: MatchOutcome,
    receipt: ResultReceipt,
    result: GameResult,
  ): void {
    clearScreens();
    view = 'results';
    context.setView('results');
    context.setPauseItems([]);
    session?.stand();
    results = createResultsScreen({
      host: screens,
      match: outcome.match,
      result: outcome.result,
      seats: hudSeats(finished.drivers),
      kid: outcome.kids.find((player) => player.seat === 1) ?? null,
      clues: clues(),
      versus: finished.drivers[1].kind === 'human',
      receipt,
      offRecord: fogOn() ? 'Not a record: the fog was on' : null,
      onPlayAgain: () => beginPlan(finished),
      onGameMenu: () => showMenu(),
      onBackToHall: () => context.backToHall(),
      ...dailyShare(result),
    });
  }

  // ——— Look, settings and appearance, live ———

  function changeLook(next: LookId): void {
    if (next === look) return;
    look = next;
    endSession();
    stage.dispose();
    stage = buildStage();
    if (view === 'menu') idleBehindMenu();
  }

  // Enter on the game menu plays, as its first button says, even before anything has focus.
  const onMenuKey = (event: KeyboardEvent): void => {
    if (view !== 'menu' || sheetClose !== null || event.key !== 'Enter' || event.repeat) return;
    if (event.target !== host && event.target !== document.body) return;
    event.preventDefault();
    beginPlan(planFor(channel.rules.style === 'clock' ? 'alone' : 'kid'));
  };
  host.addEventListener('keydown', onMenuKey);
  subscriptions.push(() => host.removeEventListener('keydown', onMenuKey));

  subscriptions.push(
    context.settings.onAppearance((next) => {
      appearance = next;
      paintAppearance();
      stage.setAppearance(next);
      paintBackground(stage, LOOKS[look], next);
      session?.setAppearance(next);
    }),
    settings.onChange((next) => {
      paintAppearance();
      changeLook(next.look);
    }),
    context.difficulty.onChange((positions) => menu?.setSwitches(positions)),
  );

  // Dev builds let the harness and its tests read the live match; production leaves this out.
  if (import.meta.env.DEV) {
    (window as Window & { __hotColdMatch?: () => Match | null }).__hotColdMatch = () =>
      session?.match ?? null;
  }

  if (context.run.mode === 'normal') showMenu();
  else if (context.run.micro) {
    plan = planFromSeats();
    const micro = plan;
    tracker = createProgressTracker(save.cleanStreak, {
      rules: rulesForRun(),
      kid: micro.kid,
      clues: clues(),
      playerOnA: context.difficulty.get().left === 'A',
    });
    startSession(micro.drivers, rulesForRun(), true, (outcome) =>
      finishMatch(micro, outcome),
    ).start();
    view = 'match';
    context.setView('play');
  } else beginPlan(planFromSeats());

  return {
    // The chrome pauses every loop made through the context; nothing else here runs on its own.
    pause: () => undefined,
    resume: () => undefined,
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
      context.input.setBindings(playerBindings);
      root.remove();
    },
  };
}
