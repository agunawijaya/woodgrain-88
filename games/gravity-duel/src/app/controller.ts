/**
 * Gravity Duel inside the Hall: one stage per look, and the screens the
 * player moves through on it. The game menu idles over two Kids (Rosa and
 * Moss) duelling on the selected channel in the selected look, silently. A
 * match goes through the pre-match cards (one in solo docking), the duel or
 * docking race, and the results. Daily, challenge and
 * micro-challenge runs skip the menu and start the run they were opened for.
 * Changing the look builds a new stage (each look has its own light);
 * changing the appearance builds the view again on the same stage, and the
 * match carries on.
 */
import type { Stage } from '@woodgrain-88/arena';
import {
  hashSeed,
  kidById,
  withKidsMark,
  type Appearance,
  type Bindings,
  type GameContext,
  type GameInstance,
  type GameLoop,
  type GameResult,
  type KidId,
  type MemoryMode,
  type ResultReceipt,
  type Seat as PlayerSeat,
  type SwitchPosition,
  type Unsubscribe,
} from '@woodgrain-88/kit';
import { Vector3 } from 'three';
import { createKidPilot, type KidPilot } from '../ai/pilot.ts';
import { coastPath, missilePath } from '../ai/forecast.ts';
import { createMatchSound, type MatchSound } from '../audio/match-sound.ts';
import { channelById, CHANNELS, type GravityChannel } from '../channels.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  IDLE,
  SHIP_WALL_MARGIN,
  SHORT_MATCH_TICKS,
  TICKS_PER_SECOND,
  type Centre,
  type Match,
  type MatchSetup,
  type Mode,
  type Seat,
} from '../engine/types.ts';
import {
  createFollowCamera,
  createHitNudge,
  type CameraMove,
  type HitNudge,
} from '../look/cameras.ts';
import type {
  CentreKind,
  GuidePose,
  LookId,
  SceneFrame,
  SeatColours,
  SpaceView,
} from '../look/look.ts';
import { createLookStage, LOOK_IDS, lookById } from '../look/looks.ts';
import { createShipPortraits, type ShipPortraits } from '../look/ship-portrait.ts';
import { seatColours, type SeatPalette } from '../look/seats.ts';
import { pointSymbols, shareLine, soloShareLine } from '../progress/share.ts';
import { createProgressTracker, type ProgressTracker } from '../progress/tracker.ts';
import {
  createMenuScreen,
  isSoloMode,
  MENU_KIDS,
  type MenuScreen,
  type OpponentType,
} from '../screens/menu.ts';
import { createPrematchScreen, SHIP_NAMES, type PrematchScreen } from '../screens/prematch.ts';
import { createRecordsScreen } from '../screens/records.ts';
import { createResultsScreen, type ResultsScreen } from '../screens/results.ts';
import { createSettingsSheet } from '../screens/settings-sheet.ts';
import { ensureScreenStyle } from '../screens/style.ts';
import { createTutorialScreen } from '../screens/tutorial.ts';
import {
  classicBindings,
  createPlayerControls,
  LONE_PLAYER,
  modernBindings,
  PLAYER_FOR_SEAT,
  type ControlScheme,
} from '../session/controls.ts';
import { toTable } from '../session/frame.ts';
import {
  createMatchSession,
  type MatchSession,
  type SeatDriver,
} from '../session/match-session.ts';
import { createHud, type Hud } from '../ui/hud.ts';
import { createKidReplay, type KidReplay } from './kid-replay.ts';
import {
  finishTutorial,
  readSave,
  recordMatch,
  writeSave,
  type GravitySave,
  type Opponent,
} from './save.ts';
import {
  createGravitySettings,
  type Camera,
  type GravitySettings,
  type GravitySettingsStore,
} from './settings.ts';

/** Who flies a seat: a person on one half of the keyboard, or a Neighbourhood Kid. */
type Rider =
  | { readonly kind: 'person'; readonly player: PlayerSeat }
  | { readonly kind: 'kid'; readonly kid: KidId };

/** A match the player asked for, kept so "Play again" can ask for the same one. */
interface MatchPlan {
  readonly channel: GravityChannel;
  /** One per engine seat: length 1 in solo docking (seat 0 only), else 2. */
  readonly riders: readonly Rider[];
}

/** Everything a match on screen is made of, torn down together. */
interface Ride {
  readonly plan: MatchPlan;
  readonly session: MatchSession;
  readonly loop: GameLoop;
  readonly colours: readonly [SeatColours, SeatColours];
  view: SpaceView;
  readonly hud: Hud | null;
  readonly sound: MatchSound | null;
  readonly tracker: ProgressTracker | null;
  readonly replay: KidReplay | null;
  follow: CameraMove | null;
  nudge: HitNudge | null;
  /** Held behind the pre-match cards: drawn, not moving. */
  held: boolean;
  frozenFor: number;
  finished: boolean;
}

type View = 'menu' | 'prematch' | 'match' | 'results';

/** The board stays frozen this long after the winning point before the results come up. */
const FREEZE_SECONDS = 1.2;
const COUNT_FROM = 3;
/** The trajectory guide is recomputed this often; cheap, but no need for every frame. */
const GUIDE_EVERY_TICKS = 3;
const GUIDE_COAST_TICKS = 150;
const GUIDE_SHOT_TICKS = 4;
const GUIDE_POINT_EVERY = 6;

const ROOT_STYLE = /* css */ `
.gd-root { position: absolute; inset: 0; overflow: hidden; background: #e8ecf2; }
.gd-root[data-appearance='dark'] { background: #05070c; }
.gd-stage, .gd-hud-layer, .gd-screens { position: absolute; inset: 0; }
.gd-hud-layer { pointer-events: none; z-index: 2; }
.gd-hud-layer > * { pointer-events: auto; }
.gd-screens { z-index: 3; pointer-events: none; }
.gd-screens > * { pointer-events: auto; }
`;

function centreKindOf(centre: Centre): CentreKind {
  return centre === 'none' ? null : centre;
}

/** The result-reporting seat: kit player 1 if riding, else the first person riding. */
function playerSeatOf(riders: readonly Rider[]): Seat | null {
  const seats = riders.map((rider, seat) => ({ rider, seat: seat as Seat }));
  const people = seats.filter(({ rider }) => rider.kind === 'person');
  const first = people.find(({ rider }) => rider.kind === 'person' && rider.player === 1);
  return (first ?? people[0])?.seat ?? null;
}

export function mountGravityDuel(host: HTMLElement, context: GameContext): GameInstance {
  const root = document.createElement('div');
  root.className = 'gd-root';
  const rootStyle = document.createElement('style');
  rootStyle.textContent = ROOT_STYLE;
  const stageHost = document.createElement('div');
  stageHost.className = 'gd-stage';
  const hudLayer = document.createElement('div');
  hudLayer.className = 'gd-hud-layer';
  const screens = document.createElement('div');
  screens.className = 'gd-screens';
  root.append(rootStyle, stageHost, hudLayer, screens);
  host.append(root);
  ensureScreenStyle(screens);

  const settings: GravitySettingsStore = createGravitySettings(context.settings.game);
  let save: GravitySave = readSave(context.save);
  let appearance: Appearance = context.settings.appearance();

  // Menu-only picks, not persisted: the mode tab filtering the dial, and the chosen opponent.
  let channelId = channelById(context.run.channel)
    ? context.run.channel
    : settings.get().lastChannel;
  let menuMode: Mode = channelById(channelId)?.rules.mode ?? 'duel';
  let opponent: OpponentType = 'rosa';

  const playerBindings: Bindings = context.input.bindings;
  const controls = createPlayerControls(context.input);
  applyBindings(settings.get().scheme);

  let look: LookId = settings.get().look;
  let stage: Stage = buildStage();
  let view: View = 'menu';
  let ride: Ride | null = null;
  let menu: MenuScreen | null = null;
  let prematch: PrematchScreen | null = null;
  let closeUps: ShipPortraits | null = null;
  let results: ResultsScreen | null = null;
  let sheetClose: (() => void) | null = null;
  let matchesStarted = 0;
  const subscriptions: Unsubscribe[] = [];

  function applyBindings(scheme: ControlScheme): void {
    context.input.setBindings(
      scheme === 'modern' ? modernBindings(playerBindings) : classicBindings(playerBindings),
    );
  }

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

  function channel(): GravityChannel {
    return channelById(channelId) ?? channelById('game-1') ?? (CHANNELS[0] as GravityChannel);
  }

  function shipCloseUps(colours: readonly [SeatColours, SeatColours]): ShipPortraits | null {
    try {
      return createShipPortraits({
        look,
        appearance,
        seats: colours,
        width: 300,
        height: 169,
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

  // ——— Flying ———

  function personName(player: PlayerSeat): string {
    const named = context.seats.find((info) => info.seat === player && info.kind === 'human');
    return named?.name ?? `Player ${String(player)}`;
  }

  function riderName(rider: Rider): string {
    return rider.kind === 'kid' ? kidById(rider.kid).name : personName(rider.player);
  }

  /** The switch each engine seat plays by: the console's own, left for seat 0, right for seat 1. */
  function switchesFor(live: boolean): readonly [SwitchPosition, SwitchPosition] {
    if (!live) return ['B', 'B'];
    const { left, right } = context.difficulty.get();
    return [left, right];
  }

  /** Whether the guide is drawn this match: a person's own choice, unless this run forces it off. */
  function guideWanted(forced: boolean): boolean {
    return settings.get().guide && !forced;
  }

  function startRide(plan: MatchPlan, live: boolean, guideForced: boolean): Ride {
    endRide();
    const switches = switchesFor(live);
    const scheme = settings.get().scheme;
    const colours = seatColours(palette());
    const target = live ? settings.get().matchLength : 5;
    const matchIndex = matchesStarted++;
    const setup: MatchSetup = {
      rules: plan.channel.rules,
      switches,
      target,
      clockTicks: target === 5 ? SHORT_MATCH_TICKS : CARTRIDGE_MATCH_TICKS,
      seed: hashSeed(`${String(context.run.seed)}/match/${String(matchIndex)}`),
    };
    const people = plan.riders.filter((rider) => rider.kind === 'person').length;
    context.input.setLayout(people === 2 ? 'split' : 'solo');
    const seedText = `${String(context.run.seed)}/${String(matchIndex)}`;
    const trailView = buildView(plan.channel, colours);
    const playerSeat = live ? playerSeatOf(plan.riders) : null;
    const hud = live
      ? createHud({
          host: hudLayer,
          look,
          seats: [hudSeat(plan, 0, colours), hudSeat(plan, 1, colours)],
          appearance,
        })
      : null;
    const sound = live ? createMatchSound(context.audio, look) : null;
    const rival = plan.riders.find((_rider, seat) => seat !== playerSeat);
    const tracker =
      live && playerSeat !== null
        ? createProgressTracker({
            channel: plan.channel,
            playerSeat,
            rival: rival?.kind === 'kid' ? { kind: 'kid', kid: rival.kid } : { kind: 'nobody' },
            switches,
          })
        : null;
    const drivers: SeatDriver[] = plan.riders.map((rider, seat) =>
      rider.kind === 'kid'
        ? createKidPilot({
            kid: rider.kid,
            seat: seat as Seat,
            mode: context.settings.kids(),
            seed: `${seedText}/${rider.kid}`,
          })
        : controls.driver(seat as Seat, rider.player, scheme),
    );
    const firstKid = drivers.find((driver): driver is KidPilot => 'reflex' in driver) ?? null;

    let lastGuideTick = -1;
    let cachedGuides: SceneFrame['guides'] = undefined;
    function computeGuides(match: Readonly<Match>): SceneFrame['guides'] {
      if (!live || !guideWanted(guideForced)) return undefined;
      return plan.riders.map((rider, seat) =>
        rider.kind === 'person' ? guideFor(match, seat as Seat) : null,
      );
    }

    let current: Ride | null = null;
    const session = createMatchSession({
      setup,
      drivers: [drivers[0] ?? { controls: () => IDLE }, drivers[1] ?? { controls: () => IDLE }],
      view: trailView,
      guides: (match) => {
        if (cachedGuides !== undefined && match.tick - lastGuideTick < GUIDE_EVERY_TICKS) {
          return cachedGuides;
        }
        lastGuideTick = match.tick;
        cachedGuides = computeGuides(match);
        return cachedGuides;
      },
      onTick: (match) => {
        if (!current) return;
        current.tracker?.observe(match);
        if (current.tracker) for (const earned of current.tracker.drain()) context.emit(earned);
        current.replay?.watch(match);
      },
      onEvent: (event, match) => {
        if (!current) return;
        current.sound?.hear(event, match);
        current.tracker?.hear(event, match);
        if (event.kind === 'hit') {
          current.nudge?.nudge(tablePoint(match, event.victim));
          current.replay?.moment(match);
        }
        if (event.kind === 'scored') current.replay?.moment(match);
      },
    });

    const loop = context.createLoop({
      hz: TICKS_PER_SECOND,
      update: (dt) => {
        if (!current || current.held) return;
        current.session.advance(dt);
        current.follow?.update(dt);
        current.nudge?.update(dt);
        stage.lights.update(dt);
        if (!current.session.over) return;
        if (current.finished) return;
        current.frozenFor += dt;
        if (current.frozenFor < FREEZE_SECONDS) return;
        current.finished = true;
        if (view === 'menu') idleBehindMenu();
        else if (view === 'match') finishMatch(current);
      },
      render: () => {
        stage.render();
        if (!current) return;
        current.hud?.update(current.session.match);
        current.sound?.follow(current.session.match);
      },
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
      follow: null,
      nudge: null,
      held: live,
      frozenFor: 0,
      finished: false,
    };
    ride = current;
    if (live) {
      applyCamera(current);
      applyNudge(current);
    }
    loop.start();
    return current;
  }

  /** A hit's spot on the table, for the hit nudge: the ship's position when the touch happened. */
  function tablePoint(match: Readonly<Match>, seat: Seat): Vector3 {
    const ship = match.ships[seat];
    const { x, z } = toTable(ship.prevX, ship.prevY);
    return new Vector3(x, 0, z);
  }

  function guideFor(match: Readonly<Match>, seat: Seat): GuidePose | null {
    const ship = match.ships[seat];
    if (!ship.present) return null;
    const rules = match.setup.rules;
    const coast = coastPath(ship, GUIDE_COAST_TICKS, rules, SHIP_WALL_MARGIN, GUIDE_POINT_EVERY);
    const missile = missilePath(ship, ship.heading, rules, GUIDE_SHOT_TICKS);
    return {
      ship: coast.map((point) => toTable(point.x, point.y)),
      missile: missile.map((point) => toTable(point.x, point.y)),
    };
  }

  function hudSeat(
    plan: MatchPlan,
    seat: Seat,
    colours: readonly [SeatColours, SeatColours],
  ): { readonly name: string; readonly colours: SeatColours } {
    const rider = plan.riders[seat];
    return { name: rider ? riderName(rider) : '', colours: colours[seat] };
  }

  function buildView(
    gravityChannel: GravityChannel,
    colours: readonly [SeatColours, SeatColours],
  ): SpaceView {
    const rules = gravityChannel.rules;
    const next = lookById(look).createView({
      stage,
      appearance,
      quality: 'high',
      rng: context.rng.fork(`view/${String(matchesStarted)}`),
      seats: colours,
      centre: centreKindOf(rules.centre),
      edges: rules.edges,
      pods: rules.pods,
      ...(rules.remix ? { remix: rules.remix.id } : {}),
      reducedEffects: settings.get().reducedEffects || context.settings.reducedMotion(),
    });
    stage.scene.add(next.root);
    return next;
  }

  function endRide(): void {
    if (!ride) return;
    ride.loop.stop();
    ride.follow?.release();
    ride.nudge?.release();
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
    closeUps = null;
    const { left, right } = context.difficulty.get();
    const colours = seatColours(palette());
    closeUps = shipCloseUps(colours);
    const canvases = closeUps?.canvases;
    const shipNames = SHIP_NAMES[look];
    const ships =
      canvases?.[0] && canvases[1]
        ? {
            look: lookById(look).name,
            seats: [
              { name: shipNames[0], colour: colours[0].main, portrait: canvases[0] },
              { name: shipNames[1], colour: colours[1].main, portrait: canvases[1] },
            ],
          }
        : undefined;
    menu = createMenuScreen({
      host: screens,
      mode: menuMode,
      channelId,
      opponent,
      look,
      scheme: settings.get().scheme,
      matchLength: settings.get().matchLength,
      switches: [left, right],
      ...(ships ? { ships } : {}),
      isUnlocked: (id) => isOpen(id),
      onMode: (nextMode) => {
        menuMode = nextMode;
        if (channelById(channelId)?.rules.mode !== nextMode) {
          const first = CHANNELS.find((candidate) => candidate.rules.mode === nextMode);
          if (first) {
            channelId = first.def.id;
            settings.update({ lastChannel: channelId });
          }
        }
        idleBehindMenu();
      },
      onChannel: (id) => {
        channelId = id;
        settings.update({ lastChannel: id });
        idleBehindMenu();
      },
      onOpponent: (chosen) => {
        opponent = chosen;
      },
      onLook: (chosen) => settings.update({ look: chosen }),
      onScheme: (chosen) => settings.update({ scheme: chosen }),
      onMatchLength: (length) => settings.update({ matchLength: length }),
      onStart: (friend) => beginPlan(planFor(friend), false),
      onHowToPlay: () => showTutorial(),
      onSettings: () => openSheet('settings'),
      onRecords: () => openSheet('records'),
      onBackToHall: () => context.backToHall(),
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

  /** Rosa against Moss, on a duel channel (the dial's own pick, or Open Space on a race or solo one). */
  function idleBehindMenu(): void {
    const shown =
      channel().rules.mode === 'duel' ? channel() : (channelById('game-1') ?? channel());
    startRide(
      {
        channel: shown,
        riders: [
          { kind: 'kid', kid: 'rosa' },
          { kind: 'kid', kid: 'moss' },
        ],
      },
      false,
      false,
    );
  }

  function openSheet(which: 'settings' | 'records'): void {
    sheetClose?.();
    const onClose = () => closeSheet();
    const people = ride?.plan.riders.filter((rider) => rider.kind === 'person').length ?? 0;
    const sheet =
      which === 'settings'
        ? createSettingsSheet({
            host: screens,
            settings,
            guideForced: isGuideForced(),
            followAvailable: people === 1,
            onAllSettings: () => context.openSettings(),
            onClose,
          })
        : createRecordsScreen({ host: screens, save, onClose });
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

  function planFor(friend: boolean): MatchPlan {
    const chosen = channel();
    const me: Rider = { kind: 'person', player: LONE_PLAYER };
    if (isSoloMode(chosen.rules.mode)) return { channel: chosen, riders: [me] };
    const second: Rider = { kind: 'person', player: PLAYER_FOR_SEAT[0] };
    const rival: Rider = friend ? second : { kind: 'kid', kid: opponent };
    return { channel: chosen, riders: [rival, me] };
  }

  /** The plan for a run the Hall opened directly: Daily, a challenge link or a micro-challenge. */
  function planFromRun(): { readonly plan: MatchPlan; readonly guideForced: boolean } {
    const me: Rider = { kind: 'person', player: LONE_PLAYER };
    if (context.run.mode === 'daily') {
      // The seed picks one of the four daily channels, and (for a duel or race) a Kid, not Pip.
      const daily = context.rng.fork('daily');
      const chosen =
        channelById(daily.pick(['game-4', 'game-5', 'game-8', 'game-14'])) ?? channel();
      if (isSoloMode(chosen.rules.mode)) {
        return { plan: { channel: chosen, riders: [me] }, guideForced: true };
      }
      const kid = daily.pick(MENU_KIDS.filter((candidate) => candidate !== 'pip'));
      return { plan: { channel: chosen, riders: [{ kind: 'kid', kid }, me] }, guideForced: true };
    }
    const chosen = channel();
    if (isSoloMode(chosen.rules.mode)) {
      return { plan: { channel: chosen, riders: [me] }, guideForced: true };
    }
    const second = context.seats.find((seat) => seat.seat === PLAYER_FOR_SEAT[0]);
    const rival: Rider =
      second?.kind === 'human'
        ? { kind: 'person', player: second.seat }
        : { kind: 'kid', kid: second?.kid ?? 'rosa' };
    const guideForced = context.run.mode === 'challenge' || context.run.micro !== undefined;
    return { plan: { channel: chosen, riders: [rival, me] }, guideForced };
  }

  /** Whether this run (as opposed to a setting) keeps the guide off: Daily, challenge, micro. */
  function isGuideForced(): boolean {
    return (
      context.run.mode === 'daily' ||
      context.run.mode === 'challenge' ||
      context.run.micro !== undefined
    );
  }

  // ——— Pre-match, match and results ———

  function beginPlan(plan: MatchPlan, guideForced: boolean): void {
    clearScreens();
    view = 'prematch';
    context.setView('play');
    context.setPauseItems([]);
    const current = startRide(plan, true, guideForced);
    // The scoreboard would sit under the look's name; it comes in with the match.
    hudLayer.hidden = true;
    const switches = switchesFor(true);
    closeUps = shipCloseUps(current.colours);
    const canvases = closeUps?.canvases;
    prematch = createPrematchScreen({
      host: screens,
      look,
      seats: isSoloMode(plan.channel.rules.mode)
        ? [prematchSeat(plan, 0, current.colours, switches, canvases)]
        : [
            prematchSeat(plan, 0, current.colours, switches, canvases),
            prematchSeat(plan, 1, current.colours, switches, canvases),
          ],
      onReady: () => countDown(current, prematch),
      onBack: () => showMenu(),
    });
  }

  function prematchSeat(
    plan: MatchPlan,
    seat: Seat,
    colours: readonly [SeatColours, SeatColours],
    switches: readonly [SwitchPosition, SwitchPosition],
    canvases: readonly HTMLCanvasElement[] | undefined,
  ): {
    readonly name: string;
    readonly colours: SeatColours;
    readonly switchPosition: SwitchPosition;
    readonly keys: string;
    readonly kid?: KidId;
    readonly portrait?: HTMLCanvasElement;
  } {
    const rider = plan.riders[seat];
    if (!rider) throw new Error('prematchSeat: engine seat has no rider');
    const keys =
      rider.kind === 'kid' ? '' : rider.player === LONE_PLAYER ? 'Arrows · Enter' : 'WASD · Space';
    const portrait = canvases?.[seat];
    return {
      name: riderName(rider),
      colours: colours[seat],
      switchPosition: switches[seat],
      keys,
      ...(rider.kind === 'kid' ? { kid: rider.kid } : {}),
      ...(portrait ? { portrait } : {}),
    };
  }

  /** 3, 2, 1, go, then the match starts; `screen` gets the count shown over the cards, if any. */
  function countDown(current: Ride, screen: PrematchScreen | null): void {
    let count = COUNT_FROM;
    const step = (): void => {
      if (ride !== current) return;
      screen?.setCount(count > 0 ? count : null);
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
    hudLayer.hidden = false;
    // The press that said "ready" must not also steer the first step.
    context.input.reset();
    current.held = false;
  }

  function finishMatch(current: Ride): void {
    const { plan } = current;
    const playerSeat = playerSeatOf(plan.riders);
    const solo = isSoloMode(plan.channel.rules.mode);
    const kidRider = plan.riders.find((rider) => rider.kind === 'kid');
    const kids = kidRider ? context.settings.kids() : undefined;
    const bothPeople =
      plan.riders.length === 2 && plan.riders.every((rider) => rider.kind === 'person');
    const result = buildResult(current, playerSeat, solo, bothPeople, kidRider, kids);
    const receipt = context.reportResult(result);
    recordFinished(current, playerSeat);
    current.sound?.quiet();
    // A micro-challenge's own banner follows in the Hall; the game just stops.
    if (context.run.micro) return;
    showResults(current, receipt, playerSeat, solo);
  }

  function buildResult(
    current: Ride,
    playerSeat: Seat | null,
    solo: boolean,
    bothPeople: boolean,
    kidRider: Rider | undefined,
    kids: MemoryMode | undefined,
  ): GameResult {
    const match = current.session.match;
    const mine = playerSeat === null ? 0 : match.ships[playerSeat].score;
    const rivalSeat: Seat = playerSeat === 0 ? 1 : 0;
    const theirs = playerSeat === null ? 0 : match.ships[rivalSeat].score;
    const kitWinnerSeat: PlayerSeat | null =
      match.winner === null ? null : match.winner === 1 ? 1 : 2;
    return {
      score: mine,
      scoreLabel: solo ? `${String(mine)} docks` : `${String(mine)}–${String(theirs)}`,
      durationMs: Math.round((match.tick / TICKS_PER_SECOND) * 1000),
      presentation: 'game',
      ...(solo
        ? {}
        : bothPeople
          ? { winnerSeat: kitWinnerSeat }
          : { won: match.winner === playerSeat }),
      ...(!solo && playerSeat !== null
        ? { emoji: pointSymbols(current.session.stats.points, playerSeat) }
        : {}),
      opponentKid: kidRider?.kind === 'kid' ? kidRider.kid : null,
      ...(kids === undefined ? {} : { kids }),
    };
  }

  function recordFinished(current: Ride, playerSeat: Seat | null): void {
    if (playerSeat === null) return;
    const { plan, session } = current;
    const rival = plan.riders.find((_rider, seat) => seat !== playerSeat);
    const opponentChoice: Opponent =
      rival?.kind === 'kid' ? { kind: 'kid', kid: rival.kid } : { kind: 'person' };
    const rivalSeat: Seat = playerSeat === 0 ? 1 : 0;
    const mine = session.match.ships[playerSeat].score;
    const theirs = session.match.ships[rivalSeat].score;
    save = recordMatch(save, {
      channelId: plan.channel.def.id,
      opponent: opponentChoice,
      scheme: settings.get().scheme,
      memory: context.settings.kids(),
      mode: plan.channel.rules.mode,
      playerScore: mine,
      rivalScore: theirs,
      durationMs: Math.round((session.match.tick / TICKS_PER_SECOND) * 1000),
      guideOn: guideWanted(isGuideForced()),
    });
    writeSave(context.save, save);
  }

  function showResults(
    current: Ride,
    receipt: ResultReceipt,
    playerSeat: Seat | null,
    solo: boolean,
  ): void {
    clearScreens();
    view = 'results';
    context.setView('results');
    // The results carry the final score; the HUD's last word would only linger.
    current.hud?.dispose();
    const { session, plan, colours } = current;
    const stats = session.stats;
    const kidRider = plan.riders.find((rider) => rider.kind === 'kid');
    const kids = kidRider ? context.settings.kids() : undefined;
    const line = solo
      ? soloShareLine(session.match.ships[0].score)
      : playerSeat !== null
        ? withKidsMark(shareLine(stats.points, playerSeat), kids)
        : '';
    const rules = plan.channel.rules;
    results = createResultsScreen({
      host: screens,
      versus: !solo,
      seats: solo
        ? [resultsSeat(plan, session, stats, colours, 0)]
        : [
            resultsSeat(plan, session, stats, colours, 0),
            resultsSeat(plan, session, stats, colours, 1),
          ],
      winner: solo ? null : session.match.winner,
      ...(solo
        ? {
            soloDocks: session.match.ships[0].score,
            durationMs: Math.round((session.match.tick / TICKS_PER_SECOND) * 1000),
          }
        : {}),
      showCombatStats: rules.mode === 'duel',
      showStarCrashes: rules.centre === 'star',
      showDocks: rules.mode !== 'duel',
      ...(line ? { shareLine: line } : {}),
      patchesEarned: receipt.patchesEarned,
      ...(kidRider?.kind === 'kid'
        ? {
            kid: {
              id: kidRider.kid,
              name: kidById(kidRider.kid).name,
              frames: current.replay?.frames() ?? [],
            },
          }
        : {}),
      onPlayAgain: () => beginPlan(plan, isGuideForced()),
      onGameMenu: () => showMenu(),
      onBackToHall: () => context.backToHall(),
      ...(line ? { onShare: () => void context.share.copy(line) } : {}),
    });
  }

  function resultsSeat(
    plan: MatchPlan,
    session: MatchSession,
    stats: MatchSession['stats'],
    colours: readonly [SeatColours, SeatColours],
    seat: Seat,
  ): {
    readonly name: string;
    readonly score: number;
    readonly shots: number;
    readonly hits: number;
    readonly fuelUsed: number;
    readonly docks: number;
    readonly starCrashes: number;
    readonly colours: SeatColours;
  } {
    const rider = plan.riders[seat];
    return {
      name: rider ? riderName(rider) : '—',
      score: session.match.ships[seat].score,
      shots: stats.shotsFired[seat],
      hits: stats.hits[seat],
      fuelUsed: stats.fuelUsed[seat],
      docks: stats.docks[seat],
      starCrashes: stats.starCrashes[seat],
      colours: colours[seat],
    };
  }

  // ——— Look, camera, switches and appearance, live ———

  /** A new look mid-ride: a new stage with the look's own light, the same match drawn on it. */
  function changeLook(next: LookId): void {
    if (next === look) return;
    look = next;
    const old = stage;
    stage = buildStage();
    if (ride) {
      const rebuilt = buildView(ride.plan.channel, ride.colours);
      ride.session.setView(rebuilt);
      ride.view = rebuilt;
      ride.sound?.setLook(next);
      applyCamera(ride);
      applyNudge(ride);
    }
    old.dispose();
    if (view === 'match') showPauseItems();
  }

  /** Follow is offered only to a lone player; it tracks that seat's ship. */
  function applyCamera(current: Ride): void {
    current.follow?.release();
    current.follow = null;
    const people = current.plan.riders.filter((rider) => rider.kind === 'person').length;
    if (people !== 1 || settings.get().camera !== 'follow' || view === 'menu') return;
    const playerSeat = playerSeatOf(current.plan.riders);
    if (playerSeat === null) return;
    current.follow = createFollowCamera(
      stage,
      () => current.view.root,
      lookById(look).framing,
      (out) => {
        const ship = current.session.match.ships[playerSeat];
        if (!ship.present) return null;
        const { x, z } = toTable(ship.x, ship.y);
        return out.set(x, 0, z);
      },
    );
  }

  /** The hit nudge shows only over the whole board: never with Follow (already close) or the menu. */
  function applyNudge(current: Ride): void {
    current.nudge?.release();
    current.nudge = null;
    if (view === 'menu' || current.follow) return;
    if (context.settings.reducedMotion()) return;
    current.nudge = createHitNudge(stage, () => current.view.root, lookById(look).framing);
  }

  function showPauseItems(): void {
    const next = LOOK_IDS[(LOOK_IDS.indexOf(look) + 1) % LOOK_IDS.length] ?? 'brass';
    const scheme = settings.get().scheme;
    const camera: Camera = settings.get().camera;
    const people = ride?.plan.riders.filter((rider) => rider.kind === 'person').length ?? 0;
    context.setPauseItems([
      {
        id: 'look',
        label: `Look: ${lookById(look).name}`,
        onSelect: () => settings.update({ look: next }),
      },
      {
        id: 'controls',
        label: `Controls: ${scheme === 'modern' ? 'Modern' : 'Classic'}`,
        onSelect: () => settings.update({ scheme: scheme === 'modern' ? 'classic' : 'modern' }),
      },
      {
        id: 'camera',
        label:
          people === 1
            ? `Camera: ${camera === 'follow' ? 'Follow' : 'Overhead'}`
            : 'Camera: Overhead (two players)',
        onSelect: () => {
          if (people !== 1) return;
          settings.update({ camera: camera === 'follow' ? 'overhead' : 'follow' });
          if (ride) {
            applyCamera(ride);
            applyNudge(ride);
          }
          showPauseItems();
        },
      },
    ]);
  }

  function changeAppearance(next: Appearance): void {
    appearance = next;
    paintAppearance();
    stage.setAppearance(next);
    if (!ride) return;
    stage.scene.remove(ride.view.root);
    const rebuilt = buildView(ride.plan.channel, ride.colours);
    ride.session.setView(rebuilt);
    ride.view = rebuilt;
    applyNudge(ride);
  }

  subscriptions.push(
    context.settings.onAppearance((next) => changeAppearance(next)),
    settings.onChange((next: GravitySettings) => {
      paintAppearance();
      changeLook(next.look);
      applyBindings(next.scheme);
      if (ride) {
        applyCamera(ride);
        applyNudge(ride);
      }
    }),
    context.difficulty.onChange(({ left, right }) => menu?.setSwitches([left, right])),
  );

  if (context.run.mode === 'normal') showMenu();
  else {
    const { plan, guideForced } = planFromRun();
    if (context.run.micro) {
      view = 'match';
      context.setView('play');
      context.setPauseItems([]);
      startRide(plan, true, guideForced).held = false;
    } else beginPlan(plan, guideForced);
  }

  return {
    // The chrome pauses every loop made through the context; held sounds are ours to quiet.
    pause: () => ride?.sound?.quiet(),
    resume: () => undefined,
    gameMenu() {
      showMenu();
    },
    playAgain() {
      if (ride) beginPlan(ride.plan, isGuideForced());
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
