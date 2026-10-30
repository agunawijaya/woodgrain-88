/**
 * Trailblaze inside the Hall: one stage per look, and the screens the player
 * moves through on it. The game menu idles over two Kids riding the chosen
 * channel; a match goes through the pre-match cards, the ride and the results
 * with the frozen board still behind them. Daily, challenge and micro-challenge
 * runs skip the menu and start the run they were opened for. Changing the look
 * builds a new stage (each look has its own light); changing the appearance
 * builds the view again on the same stage, and the match carries on.
 */
import type { Stage } from '@woodgrain-88/arena';
import {
  downloadText,
  KID_IDS,
  kidById,
  withDiagonalKeys,
  withKidsMark,
  type Appearance,
  type Bindings,
  type GameContext,
  type GameInstance,
  type GameLoop,
  type GameResult,
  type KidId,
  type ResultReceipt,
  type Seat as PlayerSeat,
  type SwitchPosition,
  type Unsubscribe,
} from '@woodgrain-88/kit';
import { createComputer1977, lookaheadFor } from '../ai/computer-1977.ts';
import { createKidRider, type KidRider } from '../ai/kid.ts';
import { createMatchSound, type MatchSound } from '../audio/match-sound.ts';
import { channelById, CHANNELS, type TrailblazeChannel } from '../channels.ts';
import { IDLE, type MatchSetup, type Seat, type StepPilot } from '../engine/types.ts';
import { createChaseCamera, type ChaseCamera } from '../look/chase-camera.ts';
import { createCrashPush, type CrashPush } from '../look/crash-push.ts';
import type { LookId, SeatColours, TrailView } from '../look/look.ts';
import { createLookStage, LOOK_IDS, lookById, paintBackground } from '../look/looks.ts';
import { createRiderPortraits, type RiderPortraits } from '../look/rider-portrait.ts';
import { fourWayColours, seatColours, type SeatPalette } from '../look/seats.ts';
import { pointSymbols, shareLine } from '../progress/share.ts';
import { createProgressTracker, type ProgressTracker } from '../progress/tracker.ts';
import { createGalleryScreen } from '../screens/gallery.ts';
import {
  createMenuScreen,
  type MenuScreen,
  type OpponentType,
  type TrailblazePlayMode,
} from '../screens/menu.ts';
import { createPrematchScreen, type PrematchScreen } from '../screens/prematch.ts';
import { createRecordsScreen } from '../screens/records.ts';
import { createResultsScreen, type ResultsScreen } from '../screens/results.ts';
import { createSettingsSheet } from '../screens/settings-sheet.ts';
import { ensureScreenStyle } from '../screens/style.ts';
import { createTutorialScreen } from '../screens/tutorial.ts';
import { createPlayerControls, PLAYER_FOR_RIDER } from '../session/controls.ts';
import {
  createMatchSession,
  type MatchSession,
  type SeatDriver,
} from '../session/match-session.ts';
import { createHud, type Hud } from '../ui/hud.ts';
import { encodeBoard, filledPercent } from '../doodle/board.ts';
import { doodleSvg } from '../doodle/svg.ts';
import { doodleExportedEvent } from '../progress/events.ts';
import { createKidReplay, type KidReplay } from './kid-replay.ts';
import {
  addDoodle,
  finishTutorial,
  readSave,
  recordMatch,
  writeSave,
  type TrailblazeSave,
} from './save.ts';
import {
  createTrailblazeSettings,
  type OpponentChoice,
  type TrailblazeSettingsStore,
} from './settings.ts';

/** Who rides a seat: a person on one half of the keyboard, a Kid, the 1977 computer. */
type Rider =
  | { readonly kind: 'person'; readonly player: PlayerSeat }
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'computer' };

/** A match the player asked for, kept so "Play again" can ask for the same one. */
interface MatchPlan {
  readonly mode: TrailblazePlayMode;
  readonly channel: TrailblazeChannel;
  /** One per riding seat, in seat order; one seat rides alone. */
  readonly riders: readonly Rider[];
}

/** Everything a match on screen is made of, torn down together. */
interface Ride {
  readonly plan: MatchPlan;
  readonly session: MatchSession;
  readonly loop: GameLoop;
  readonly colours: readonly SeatColours[];
  view: TrailView;
  readonly hud: Hud | null;
  readonly sound: MatchSound | null;
  readonly tracker: ProgressTracker | null;
  /** The first Kid's last seconds before its crash, for "How Rosa saw it". */
  readonly replay: KidReplay | null;
  chase: ChaseCamera | null;
  push: CrashPush | null;
  /** Held behind the pre-match cards: drawn, not moving. */
  held: boolean;
  frozenFor: number;
  finished: boolean;
}

type View = 'menu' | 'prematch' | 'match' | 'results' | 'sheet';

/** The board stays frozen this long after the winning point before the results come up. */
const FREEZE_SECONDS = 1.2;
const COUNT_FROM = 3;

const ROOT_STYLE = /* css */ `
.tb-root { position: absolute; inset: 0; overflow: hidden; background: #e8ecf2; }
.tb-root[data-appearance='dark'] { background: #05080f; }
.tb-stage, .tb-hud-layer, .tb-screens { position: absolute; inset: 0; }
.tb-hud-layer { pointer-events: none; z-index: 2; }
.tb-hud-layer > * { pointer-events: auto; }
.tb-screens { z-index: 3; pointer-events: none; }
/* A Doodle keeps no score, so its HUD only speaks. */
.tb-hud-layer[data-scoring='none'] .tb-hud-centre { display: none; }
.tb-screens > * { pointer-events: auto; }
`;

function opponentOf(choice: OpponentChoice): OpponentType {
  return choice.kind === 'kid' ? choice.kid : 'computer';
}

function choiceOf(opponent: OpponentType): OpponentChoice {
  return opponent === 'computer' ? { kind: 'computer' } : { kind: 'kid', kid: opponent };
}

/** The Kids after `kid` in the usual order, for filling the other seats of a Four Way. */
function kidsAfter(kid: KidId, count: number): KidId[] {
  const start = KID_IDS.indexOf(kid);
  return Array.from(
    { length: count },
    (_, index) => KID_IDS[(start + index + 1) % KID_IDS.length] ?? 'moss',
  );
}

export function mountTrailblaze(host: HTMLElement, context: GameContext): GameInstance {
  const root = document.createElement('div');
  root.className = 'tb-root';
  const rootStyle = document.createElement('style');
  rootStyle.textContent = ROOT_STYLE;
  const stageHost = document.createElement('div');
  stageHost.className = 'tb-stage';
  const hudLayer = document.createElement('div');
  hudLayer.className = 'tb-hud-layer';
  const screens = document.createElement('div');
  screens.className = 'tb-screens';
  root.append(rootStyle, stageHost, hudLayer, screens);
  host.append(root);
  ensureScreenStyle(screens);

  const settings: TrailblazeSettingsStore = createTrailblazeSettings(context.settings.game);
  let save: TrailblazeSave = readSave(context.save);
  let appearance: Appearance = context.settings.appearance();
  // The Hall opens the game on the channel the player picked there.
  let channelId = channelById(context.run.channel)
    ? context.run.channel
    : settings.get().lastChannel;
  let opponent: OpponentType = opponentOf(settings.get().opponent);

  // The joystick's diagonals, added for this game only and handed back on the way out.
  const playerBindings: Bindings = context.input.bindings;
  context.input.setBindings(withDiagonalKeys(playerBindings));
  const controls = createPlayerControls(context.input);

  let look: LookId = settings.get().look;
  let stage: Stage = buildStage();
  let view: View = 'menu';
  let ride: Ride | null = null;
  let menu: MenuScreen | null = null;
  let prematch: PrematchScreen | null = null;
  let closeUps: RiderPortraits | null = null;
  let results: ResultsScreen | null = null;
  let sheetClose: (() => void) | null = null;
  let matchesStarted = 0;
  const subscriptions: Unsubscribe[] = [];

  function buildStage(): Stage {
    return createLookStage({ host: stageHost, look: lookById(look), appearance, quality: 'high' });
  }

  function palette(): SeatPalette {
    return settings.get().colourBlind ? 'colour-blind' : 'standard';
  }

  function paintAppearance(): void {
    root.dataset.appearance = appearance;
    screens.dataset.appearance = appearance;
    screens.dataset.palette = palette();
  }
  paintAppearance();

  function channel(): TrailblazeChannel {
    return channelById(channelId) ?? channelById('game-1') ?? (CHANNELS[0] as TrailblazeChannel);
  }

  /** The look's riders up close in the given colours; none where the browser gives no GL. */
  function riderCloseUps(
    colours: readonly SeatColours[],
    width: number,
    height: number,
  ): RiderPortraits | null {
    try {
      return createRiderPortraits({
        look,
        appearance,
        seats: colours,
        width,
        height,
        animate: !context.settings.reducedMotion(),
      });
    } catch {
      return null;
    }
  }

  function clearScreens(): void {
    menu?.dispose();
    prematch?.dispose();
    closeUps?.dispose();
    closeUps = null;
    results?.dispose();
    sheetClose?.();
    menu = null;
    prematch = null;
    results = null;
    sheetClose = null;
  }

  // ——— Riding ———

  function personName(player: PlayerSeat): string {
    const named = context.seats.find((info) => info.seat === player && info.kind === 'human');
    return named?.name ?? `Player ${String(player)}`;
  }

  function riderName(rider: Rider): string {
    if (rider.kind === 'kid') return kidById(rider.kid).name;
    if (rider.kind === 'computer') return 'Computer 1977';
    return personName(rider.player);
  }

  function switchesFor(riders: readonly Rider[], live: boolean): SwitchPosition[] {
    const { left, right } = context.difficulty.get();
    return riders.map((rider, seat) => {
      if (!live || rider.kind === 'kid') return 'B';
      return seat === 0 ? left : seat === 1 ? right : 'B';
    });
  }

  function driverFor(rider: Rider, seat: Seat, seed: string): SeatDriver | KidRider {
    if (rider.kind === 'person') return controls.driver(rider.player);
    if (rider.kind === 'kid') {
      return createKidRider({
        kid: rider.kid,
        seat,
        mode: context.settings.kids(),
        seed: `${seed}/${rider.kid}`,
      });
    }
    return { stick: () => IDLE };
  }

  /** The person whose results these are: player 1 if riding, else the first person. */
  function playerSeatOf(riders: readonly Rider[]): Seat | null {
    const seats = riders.map((rider, seat) => ({ rider, seat: seat as Seat }));
    const people = seats.filter(({ rider }) => rider.kind === 'person');
    const first = people.find(({ rider }) => rider.kind === 'person' && rider.player === 1);
    return (first ?? people[0])?.seat ?? null;
  }

  function startRide(plan: MatchPlan, live: boolean): Ride {
    endRide();
    const players = plan.riders.length as 1 | 2 | 4;
    const switches = switchesFor(plan.riders, live);
    const pilots = plan.riders.map((rider, seat): StepPilot | null =>
      rider.kind === 'computer' ? createComputer1977(lookaheadFor(switches[seat] ?? 'B')) : null,
    );
    const setup: MatchSetup = {
      rules: plan.channel.rules,
      players,
      switches,
      target: live ? settings.get().matchLength : 5,
      pilots,
    };
    const colours = players === 4 ? fourWayColours(palette()) : seatColours(palette());
    const people = plan.riders.filter((rider) => rider.kind === 'person').length;
    context.input.setLayout(people === 2 ? 'split' : 'solo');
    const seed = `${String(context.run.seed)}/${String(matchesStarted++)}`;
    const trailView = buildView(players, colours);
    const playerSeat = live ? playerSeatOf(plan.riders) : null;
    const rival = plan.riders.find((_rider, seat) => seat !== playerSeat);
    const hud = live
      ? createHud({
          host: hudLayer,
          seats: plan.riders.map((rider, seat) => ({
            name: riderName(rider),
            colours: colours[seat] ?? colours[0] ?? seatColours()[0],
            isHuman: rider.kind === 'person',
          })),
          appearance,
        })
      : null;
    const sound = live ? createMatchSound(context.audio, look) : null;
    hudLayer.dataset.scoring = plan.channel.rules.motion === 'free-draw' ? 'none' : 'points';
    const tracker =
      live && playerSeat !== null
        ? createProgressTracker({
            channel: plan.channel,
            playerSeat,
            rival:
              rival?.kind === 'kid'
                ? { kind: 'kid', kid: rival.kid }
                : rival?.kind === 'computer'
                  ? { kind: 'computer' }
                  : rival
                    ? { kind: 'person' }
                    : { kind: 'nobody' },
            switches,
          })
        : null;
    const drivers = plan.riders.map((rider, seat) => driverFor(rider, seat as Seat, seed));
    const firstKid = drivers.find((driver): driver is KidRider => 'reflex' in driver);
    let current: Ride | null = null;
    const session = createMatchSession({
      setup,
      drivers,
      view: trailView,
      onEvent: (event) => {
        if (!current) return;
        current.sound?.hear(event, current.session.match);
        if (current.tracker) {
          current.tracker.hear(event, current.session.match);
          for (const earned of current.tracker.drain()) context.emit(earned);
        }
        if (event.type === 'point') current.hud?.point(event.seat, event.score);
        if (event.type === 'speed') current.hud?.setSpeedStage(event.stage);
        if (event.type === 'trap') current.hud?.trap(event.seat);
        if (event.type === 'crash') {
          const crashedSeats = event.crashes.map((crash) => crash.seat);
          current.replay?.crashed(current.session.match, crashedSeats);
          current.push?.start(crashedSeats);
        }
      },
    });
    const loop = context.createLoop({
      hz: 50,
      update: (dt) => tick(dt),
      render: () => stage.render(),
    });
    current = {
      plan,
      session,
      loop,
      colours,
      view: trailView,
      hud,
      sound,
      tracker,
      replay: live && firstKid ? createKidReplay(firstKid) : null,
      chase: null,
      push: null,
      held: live,
      frozenFor: 0,
      finished: false,
    };
    ride = current;
    if (live) {
      applyCamera(current);
      applyPush(current);
    }
    loop.start();
    return current;
  }

  function buildView(players: 1 | 2 | 4, colours: readonly SeatColours[]): TrailView {
    const next = lookById(look).createView({
      stage,
      appearance,
      quality: 'high',
      rng: context.rng.fork(`view/${String(matchesStarted)}`),
      seats: colours,
      players,
      reducedEffects: settings.get().reducedEffects || context.settings.reducedMotion(),
    });
    stage.scene.add(next.root);
    return next;
  }

  /** One 20 ms tick of whatever is on screen: the menu's idle duel or the player's match. */
  function tick(dt: number): void {
    const current = ride;
    if (!current || current.held) return;
    current.session.advance(dt);
    current.chase?.update(dt);
    current.push?.update(dt);
    current.replay?.watch(current.session.match);
    const match = current.session.match;
    current.plan.riders.forEach((rider, seat) => {
      if (rider.kind === 'person')
        current.hud?.setQueuedTurn(seat, match.riders[seat]?.latched ?? null);
    });
    if (!current.session.over || current.finished) return;
    current.frozenFor += dt;
    if (current.frozenFor < FREEZE_SECONDS) return;
    current.finished = true;
    if (view === 'menu') idleBehindMenu();
    else if (view === 'match') finishMatch(current);
  }

  function endRide(): void {
    if (!ride) return;
    ride.loop.stop();
    ride.chase?.release();
    ride.push?.release();
    ride.sound?.dispose();
    ride.hud?.dispose();
    stage.scene.remove(ride.view.root);
    ride.session.dispose();
    ride = null;
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

  function buildMenu(): void {
    menu?.dispose();
    closeUps?.dispose();
    const { left, right } = context.difficulty.get();
    const shown = lookById(look);
    const colours = seatColours(palette());
    closeUps = riderCloseUps(colours, 180, 120);
    const riders = shown.riders.flatMap((name, seat) => {
      const portrait = closeUps?.canvases[seat];
      return portrait ? [{ name, colour: colours[seat]?.main ?? '#ffffff', portrait }] : [];
    });
    menu = createMenuScreen({
      host: screens,
      channelId,
      opponent,
      look,
      ...(riders.length > 0 ? { riders: { look: shown.name, seats: riders } } : {}),
      matchLength: settings.get().matchLength,
      switches: [left, right],
      memory: 'human',
      isUnlocked: (id) => isOpen(id),
      onStart: (mode, chosenChannel, chosenOpponent) => {
        channelId = chosenChannel;
        opponent = chosenOpponent;
        beginPlan(planFor(mode));
      },
      onChannel: (id) => {
        channelId = id;
        settings.update({ lastChannel: id });
        idleBehindMenu();
      },
      onOpponent: (chosen) => {
        opponent = chosen;
        settings.update({ opponent: choiceOf(chosen) });
      },
      onLook: (chosen) => settings.update({ look: chosen }),
      onMatchLength: (length) => settings.update({ matchLength: length }),
      onHowToPlay: () => showTutorial(),
      onSettings: () => openSheet('settings'),
      onRecords: () => openSheet('records'),
      onGallery: () => openSheet('gallery'),
    });
    menu.show();
  }

  /** A Remix channel is open once the patch named for it has been earned. */
  function isOpen(id: string): boolean {
    const found = channelById(id);
    if (!found || found.def.kind === 'original') return true;
    const patch = found.def.unlockedBy;
    return context.patches.status().some((status) => status.def.id === patch && status.earned);
  }

  /** Two Kids riding the chosen channel behind the menu, one short match after another. */
  function idleBehindMenu(): void {
    const kid: KidId = opponent === 'computer' || opponent === 'moss' ? 'rosa' : opponent;
    const shown = channel().rules.motion === 'free-draw' ? channelById('game-1') : channel();
    if (!shown) return;
    startRide(
      {
        mode: 'kid',
        channel: shown,
        riders: [
          { kind: 'kid', kid },
          { kind: 'kid', kid: 'moss' },
        ],
      },
      false,
    );
  }

  function openSheet(which: 'settings' | 'records' | 'gallery'): void {
    sheetClose?.();
    const onClose = () => closeSheet();
    let sheet: { dispose(): void };
    if (which === 'settings') {
      sheet = createSettingsSheet({
        host: screens,
        settings,
        onAllSettings: () => context.openSettings(),
        onClose,
      });
    } else if (which === 'records') {
      sheet = createRecordsScreen({ host: screens, save, onClose });
    } else {
      sheet = createGalleryScreen({
        host: screens,
        doodles: save.doodles,
        appearance,
        palette: palette(),
        onDownload: (doodle, svg) =>
          downloadText(`trailblaze-doodle-${doodle.id}.svg`, svg, 'image/svg+xml'),
        onDelete: (id) => {
          save = { ...save, doodles: save.doodles.filter((doodle) => doodle.id !== id) };
          writeSave(context.save, save);
        },
        onClose,
      });
    }
    sheetClose = () => sheet.dispose();
  }

  function closeSheet(): void {
    sheetClose?.();
    sheetClose = null;
    if (view === 'menu') buildMenu();
  }

  function showTutorial(): void {
    clearScreens();
    const tutorial = createTutorialScreen({
      host: screens,
      onDone: () => {
        save = finishTutorial(save);
        writeSave(context.save, save);
        showMenu();
      },
    });
    sheetClose = () => tutorial.dispose();
  }

  // ——— Plans ———

  function planFor(mode: TrailblazePlayMode): MatchPlan {
    const chosen = channel();
    const me: Rider = { kind: 'person', player: 1 };
    const second: Rider = { kind: 'person', player: 2 };
    const kid: KidId = opponent === 'computer' ? 'rosa' : opponent;
    switch (mode) {
      case 'versus':
      case 'doodle-together':
        return { mode, channel: chosen, riders: [second, me] };
      case 'doodle':
        return { mode, channel: chosen, riders: [me] };
      case 'computer':
        return { mode, channel: chosen, riders: [{ kind: 'computer' }, me] };
      case 'four-way': {
        const [b, c] = kidsAfter(kid, 2);
        return {
          mode,
          channel: chosen,
          riders: [
            { kind: 'kid', kid },
            me,
            { kind: 'kid', kid: b ?? 'moss' },
            { kind: 'kid', kid: c ?? 'dee' },
          ],
        };
      }
      case 'four-way-two': {
        const [b] = kidsAfter(kid, 1);
        return {
          mode,
          channel: chosen,
          riders: [second, me, { kind: 'kid', kid }, { kind: 'kid', kid: b ?? 'moss' }],
        };
      }
      case 'kid':
        return { mode, channel: chosen, riders: [{ kind: 'kid', kid }, me] };
    }
  }

  /** The plan for a run the Hall opened directly, with the seats as the Hall gave them. */
  function planFromRun(): MatchPlan {
    const chosen = channel();
    const me: Rider = { kind: 'person', player: 1 };
    const micro = context.run.micro?.id;
    if (micro === 'top-speed-30' || micro === 'fill-300') {
      return { mode: 'doodle', channel: chosen, riders: [me] };
    }
    if (micro === 'trap-dee') {
      return { mode: 'kid', channel: chosen, riders: [{ kind: 'kid', kid: 'dee' }, me] };
    }
    const second = context.seats.find((seat) => seat.seat === 2);
    if (second?.kind === 'human') {
      return { mode: 'versus', channel: chosen, riders: [{ kind: 'person', player: 2 }, me] };
    }
    if (chosen.rules.opponent === 'computer') {
      return { mode: 'computer', channel: chosen, riders: [{ kind: 'computer' }, me] };
    }
    const kid = second?.kid ?? 'rosa';
    return { mode: 'kid', channel: chosen, riders: [{ kind: 'kid', kid }, me] };
  }

  // ——— Pre-match, match and results ———

  function beginPlan(plan: MatchPlan): void {
    clearScreens();
    view = 'prematch';
    context.setView('play');
    context.setPauseItems([]);
    const current = startRide(plan, true);
    const switches = switchesFor(plan.riders, true);
    const shared = plan.riders.filter((rider) => rider.kind === 'person').length === 2;
    const { riders: riderNames, ridesAs } = lookById(look);
    closeUps = riderCloseUps(current.colours, 300, 169);
    prematch = createPrematchScreen({
      host: screens,
      look,
      ...(closeUps ? { portraits: closeUps.canvases } : {}),
      seats: plan.riders.map((rider, seat) => ({
        name: riderName(rider),
        role:
          rider.kind === 'person'
            ? rider.player === 1
              ? 'you'
              : 'player2'
            : rider.kind === 'kid'
              ? 'kid'
              : 'computer',
        ...(rider.kind === 'kid' ? { kid: rider.kid } : {}),
        seatIndex: seat,
        colours: current.colours[seat] ?? seatColours()[0],
        switchPosition: switches[seat] ?? 'B',
        keys:
          rider.kind !== 'person'
            ? ''
            : rider.player === PLAYER_FOR_RIDER[0] && shared
              ? 'WASD · Space'
              : 'Arrows · Enter',
        rides: `${ridesAs} ${riderNames[seat % 2] ?? riderNames[0]}`,
      })),
      onReady: () => countDown(current),
      onBack: () => showMenu(),
    });
  }

  /** 3, 2, 1 over the cards, then the riders go. */
  function countDown(current: Ride): void {
    let count = COUNT_FROM;
    const step = (): void => {
      if (ride !== current) return;
      prematch?.setCount(count > 0 ? count : null);
      current.sound?.countdown(count);
      if (count > 0) {
        count--;
        window.setTimeout(step, 700);
        return;
      }
      startMatch(current);
    };
    step();
  }

  function startMatch(current: Ride): void {
    clearScreens();
    view = 'match';
    context.setView('play');
    showPauseItems();
    // The press that said "ready" must not also steer the first step.
    context.input.reset();
    current.held = false;
  }

  function finishMatch(current: Ride): void {
    const { session, plan } = current;
    const match = session.match;
    const playerSeat = playerSeatOf(plan.riders);
    const scores = match.riders.map((rider) => rider.score);
    const mine = playerSeat === null ? 0 : (scores[playerSeat] ?? 0);
    const others = scores.filter((_, seat) => seat !== playerSeat);
    const best = others.length > 0 ? Math.max(...others) : 0;
    const kidRider = plan.riders.find((rider) => rider.kind === 'kid');
    const kids = kidRider ? context.settings.kids() : undefined;
    const versus =
      plan.riders.every((rider) => rider.kind === 'person') && plan.riders.length === 2;
    const line =
      playerSeat === null ? '' : withKidsMark(shareLine(session.stats.points, playerSeat), kids);
    const result: GameResult = {
      score: mine,
      scoreLabel: `${String(mine)}–${String(best)}`,
      durationMs: Math.round((match.tick / 50) * 1000),
      presentation: 'game',
      ...(versus
        ? { winnerSeat: match.winner === null ? null : match.winner === 1 ? 1 : 2 }
        : { won: match.winner !== null && match.winner === playerSeat }),
      details: [
        { label: 'Longest ride', value: `${session.stats.longestRoundSeconds.toFixed(1)} s` },
      ],
      ...(playerSeat === null ? {} : { emoji: pointSymbols(session.stats.points, playerSeat) }),
      opponentKid: kidRider?.kind === 'kid' ? kidRider.kid : null,
      ...(kids === undefined ? {} : { kids }),
    };
    const receipt = context.reportResult(result);
    recordFinished(plan, mine, best, session.stats.longestRoundSeconds);
    current.sound?.quiet();
    // A micro-challenge's own banner follows in the Hall; the game just stops.
    if (context.run.micro) return;
    showResults(current, receipt, line);
  }

  function recordFinished(plan: MatchPlan, mine: number, theirs: number, longest: number): void {
    const rival = plan.riders.find((rider) => rider.kind !== 'person') ?? plan.riders[0];
    const opponentChoice: OpponentChoice =
      rival?.kind === 'kid'
        ? { kind: 'kid', kid: rival.kid }
        : rival?.kind === 'computer'
          ? { kind: 'computer' }
          : { kind: 'person' };
    save = recordMatch(save, {
      channelId: plan.channel.def.id,
      opponent: opponentChoice,
      memory: context.settings.kids(),
      playerScore: mine,
      rivalScore: theirs,
      longestRideSeconds: longest,
    });
    writeSave(context.save, save);
  }

  function showResults(current: Ride, receipt: ResultReceipt, line: string): void {
    clearScreens();
    view = 'results';
    context.setView('results');
    const { session, plan, colours } = current;
    // The results carry the final score; the HUD's last word ("Rosa scores!") would only linger.
    current.hud?.dispose();
    const traps = session.stats.traps;
    const kidRider = plan.riders.find((rider) => rider.kind === 'kid');
    results = createResultsScreen({
      host: screens,
      versus: plan.riders.every((rider) => rider.kind === 'person'),
      seats: plan.riders.map((rider, seat) => ({
        name: riderName(rider),
        score: session.match.riders[seat]?.score ?? 0,
        cellsLaid: session.stats.cellsLaid[seat] ?? 0,
        trapsSprung: traps.filter((trap) => trap.seat !== seat).length,
        colours: colours[seat] ?? seatColours()[0],
        isHuman: rider.kind === 'person',
      })),
      winner: session.match.winner,
      longestRideSeconds: session.stats.longestRoundSeconds,
      patchesEarned: receipt.patchesEarned,
      ...(kidRider?.kind === 'kid'
        ? {
            kid: {
              id: kidRider.kid,
              name: kidById(kidRider.kid).name,
              replayFrames: current.replay?.frames() ?? [],
            },
          }
        : {}),
      ...(line ? { shareLine: line } : {}),
      onPlayAgain: () => beginPlan(plan),
      onGameMenu: () => showMenu(),
      onBackToHall: () => context.backToHall(),
    });
  }

  // ——— Look, settings and appearance, live ———

  /** A new look mid-ride: a new stage with the look's own light, the same match drawn on it. */
  function changeLook(next: LookId): void {
    if (next === look) return;
    look = next;
    const old = stage;
    stage = buildStage();
    if (ride) {
      const rebuilt = buildView(ride.session.match.setup.players, ride.colours);
      ride.session.setView(rebuilt);
      ride.view = rebuilt;
      ride.sound?.setLook(next);
      applyCamera(ride);
      applyPush(ride);
    }
    old.dispose();
    if (view === 'match') showPauseItems();
  }

  /** Chase follows a lone person's rider; with two people, or none, the whole board shows. */
  function applyCamera(current: Ride): void {
    current.chase?.release();
    current.chase = null;
    const people = current.plan.riders.filter((rider) => rider.kind === 'person').length;
    const seat = playerSeatOf(current.plan.riders);
    if (people !== 1 || seat === null || settings.get().camera !== 'chase' || view === 'menu') {
      return;
    }
    current.chase = createChaseCamera(stage, () => current.view, lookById(look).framing, seat);
  }

  /** The push shows only over the whole board: never with Chase (it is already close) or the menu. */
  function applyPush(current: Ride): void {
    current.push?.release();
    current.push = null;
    if (view === 'menu' || current.chase) return;
    if (settings.get().reducedEffects || context.settings.reducedMotion()) return;
    current.push = createCrashPush(stage, () => current.view, lookById(look).framing);
  }

  function showPauseItems(): void {
    const next = LOOK_IDS[(LOOK_IDS.indexOf(look) + 1) % LOOK_IDS.length] ?? 'neon';
    const camera = settings.get().camera;
    const people = ride?.plan.riders.filter((rider) => rider.kind === 'person').length ?? 0;
    context.setPauseItems([
      {
        id: 'look',
        label: `Look: ${lookById(look).name}`,
        onSelect: () => settings.update({ look: next }),
      },
      {
        id: 'camera',
        label:
          people === 1
            ? `Camera: ${camera === 'chase' ? 'Chase' : 'Overhead'}`
            : 'Camera: Overhead (two players)',
        onSelect: () => {
          if (people !== 1) return;
          settings.update({ camera: camera === 'chase' ? 'overhead' : 'chase' });
          if (ride) {
            applyCamera(ride);
            applyPush(ride);
          }
          showPauseItems();
        },
      },
    ]);
  }

  /** X in a Doodle channel keeps the drawing: in the gallery, and as a picture to save. */
  function keepDoodle(): void {
    if (!ride || view !== 'match' || ride.plan.channel.rules.motion !== 'free-draw') return;
    const { match } = ride.session;
    const now = new Date();
    const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
    const filled = filledPercent(match.cells);
    save = addDoodle(save, {
      id: `${String(now.getTime())}-${ride.plan.channel.def.id}`,
      channelId: ride.plan.channel.def.id,
      look,
      savedAt: now.getTime(),
      board: encodeBoard(match.cells),
      filledPercent: filled,
    });
    writeSave(context.save, save);
    const art = { cells: match.cells, laidAt: match.laidAt, look, appearance, palette: palette() };
    downloadText(`trailblaze-doodle-${stamp}.svg`, doodleSvg(art), 'image/svg+xml');
    context.emit(doodleExportedEvent(filled));
    ride.hud?.say('Kept in the gallery', 'joy');
  }

  const onKeepKey = (event: KeyboardEvent): void => {
    if (event.code === 'KeyX' && !event.repeat) keepDoodle();
  };
  window.addEventListener('keydown', onKeepKey);
  subscriptions.push(() => window.removeEventListener('keydown', onKeepKey));

  function changeAppearance(next: Appearance): void {
    appearance = next;
    paintAppearance();
    stage.setAppearance(next);
    paintBackground(stage, lookById(look), next);
    ride?.hud?.setAppearance(next);
    if (!ride) return;
    stage.scene.remove(ride.view.root);
    const rebuilt = buildView(ride.session.match.setup.players, ride.colours);
    ride.session.setView(rebuilt);
    ride.view = rebuilt;
    applyPush(ride);
  }

  subscriptions.push(
    context.settings.onAppearance((next) => changeAppearance(next)),
    settings.onChange((next) => {
      paintAppearance();
      changeLook(next.look);
    }),
    context.difficulty.onChange(({ left, right }) => menu?.setSwitches([left, right])),
  );

  if (context.run.mode === 'normal') showMenu();
  else {
    const plan = planFromRun();
    if (context.run.micro) {
      view = 'match';
      context.setView('play');
      startRide(plan, true).held = false;
    } else beginPlan(plan);
  }

  return {
    // The chrome pauses every loop made through the context; held sounds are ours to quiet.
    pause: () => ride?.sound?.quiet(),
    resume: () => undefined,
    gameMenu() {
      showMenu();
    },
    playAgain() {
      if (ride) beginPlan(ride.plan);
    },
    leaveCheck() {
      return view === 'match' ? 'would-lose-progress' : 'safe';
    },
    dispose() {
      for (const unsubscribe of subscriptions) unsubscribe();
      clearScreens();
      endRide();
      stage.dispose();
      context.input.setBindings(playerBindings);
      root.remove();
    },
  };
}
