/**
 * One match on the field. The kit loop ticks the pure engine at the 1978
 * pace; each seat is a person (keys, pad or mouse), a Neighbourhood Kid or
 * nobody; the engine's events drive the look's field view and the HUD. The
 * session also keeps what the rules leave to the screen: which clues are
 * showing (Notebook keeps them, Classic Memory only while held, Thin Ice
 * melts them), the possibility fog, and a micro-challenge's time limit. The
 * game menu's backdrop and the Den TV run the same session with two Kids.
 */
import type { Quality, Stage } from '@woodgrain-88/arena';
import {
  createRng,
  type Appearance,
  type AudioEngine,
  type GameLoop,
  type InputController,
  type KidId,
  type LoopOptions,
  type MemoryMode,
  type Seat as PlayerSeat,
  type Seed,
} from '@woodgrain-88/kit';
import { createKidPlayer, type ClueMode, type KidPlayer } from '../ai/kid.ts';
import { createMatchSound } from '../audio/match-sound.ts';
import type { Clue } from '../engine/board.ts';
import { HOME_SQUARES, type Square } from '../engine/grid.ts';
import {
  createMatch,
  IDLE,
  SEATS,
  startMatch,
  stepMatch,
  type Check,
  type Match,
  type MatchEvent,
  type MatchResult,
  type Seat,
  type SeatInput,
} from '../engine/match.ts';
import { SETTLE_TICKS, TICK_SECONDS, type DifficultySwitch, type Rules } from '../engine/rules.ts';
import { trackStories, type StoryTracker } from '../engine/solver.ts';
import { squareCentre } from '../look/field-space.ts';
import type { HeatPalette } from '../look/heat.ts';
import type { FieldView, LookDefinition } from '../look/look.ts';
import { createHud, type Hud, type HudSeat } from '../ui/hud.ts';
import { isSteering, seatInput } from './controls.ts';
import { createMouseWalk, squareUnderPointer, type MouseWalk } from './mouse.ts';

export type SeatDriver =
  | { readonly kind: 'human'; readonly seat: PlayerSeat }
  | { readonly kind: 'kid'; readonly kid: KidId }
  /** Nobody: hunting alone, the second explorer stays off the field. */
  | { readonly kind: 'empty' };

export interface MatchSessionOptions {
  readonly stage: Stage;
  readonly look: LookDefinition;
  /** Where the HUD goes; null for a match without one (the menu backdrop, the Den TV). */
  readonly hudHost: HTMLElement | null;
  /** The element the pointer is measured against; null turns the mouse off. */
  readonly pointerArea: HTMLElement | null;
  readonly rules: Rules;
  readonly seed: Seed;
  readonly switches: readonly [DifficultySwitch, DifficultySwitch];
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly seats: readonly [HudSeat, HudSeat];
  readonly clues: ClueMode;
  readonly memory: MemoryMode;
  /** The possibility fog; ignored where it cannot be worked out (two flags at once). */
  readonly fog: boolean;
  /** Thin Ice: Notebook clues melt away after this many seconds. */
  readonly clueFadeSeconds?: number;
  readonly appearance: Appearance;
  readonly quality: Quality;
  readonly reducedMotion: boolean;
  readonly reducedEffects: boolean;
  readonly cluePalette: HeatPalette;
  readonly createLoop: (options: LoopOptions) => GameLoop;
  /** The seats' controllers; null when nobody human plays. */
  readonly input: InputController | null;
  /** Ends the match after this many seconds of play even if the rules would go on (micro). */
  readonly timeLimit?: number;
  /** Sound for the match, at the player's volume; leave out for a silent field (the Den TV). */
  readonly audio?: { readonly engine: AudioEngine; readonly volume: () => number };
  /** Lays out the first field by hand once it is dealt (the tutorial's lessons need their squares). */
  readonly arrange?: (match: Match) => void;
  /** Each tick's events with the match after them (progress, sound). */
  readonly onEvents?: (events: readonly MatchEvent[], match: Match) => void;
  readonly onOver?: (outcome: MatchOutcome) => void;
}

export interface MatchOutcome {
  readonly match: Match;
  /** The engine's result; null when a time limit stopped the match first. */
  readonly result: MatchResult | null;
  /** The Kids that played, for "What the Kid remembered". */
  readonly kids: readonly KidPlayer[];
  /** What each of seat 1's checks showed, in order, for the share line. */
  readonly trail: readonly Clue['kind'][];
  readonly durationMs: number;
}

export interface MatchSession {
  /** Starts drawing the field; the match itself waits for `release` when `held` was asked for. */
  start(options?: { held?: boolean }): void;
  /** Lets a held match begin. */
  release(): void;
  /** Ends live play and leaves the last picture standing, HUD gone (the results screen). */
  stand(): void;
  setAppearance(appearance: Appearance): void;
  /**
   * Live look change, mid-match: the field keeps playing on a fresh stage. The caller owns the
   * old stage and disposes it once this returns.
   */
  setLook(next: { stage: Stage; look: LookDefinition }): void;
  readonly match: Match;
  dispose(): void;
}

/** The end of a match stays on screen this long (the missed flag shown) before the results. */
const END_HOLD_SECONDS = 1.6;
/**
 * A step is drawn within the button's settle time, so the explorer always stands on its square by
 * the moment the rules let it check there: the picture never trails the rules. A held direction
 * walks in brisk steps with a short stand between them, as the 1978 explorer moved square by square.
 */
const WALK_SECONDS = SETTLE_TICKS * TICK_SECONDS;

export function createMatchSession(options: MatchSessionOptions): MatchSession {
  const { rules, drivers } = options;
  let stage = options.stage;
  let look = options.look;
  const alone = drivers[1].kind === 'empty';
  const match = createMatch({
    rules,
    seats: alone ? 1 : 2,
    switches: options.switches,
    seed: options.seed,
  });
  const kids: (KidPlayer | null)[] = drivers.map((driver, seat) =>
    driver.kind === 'kid'
      ? createKidPlayer({
          kid: driver.kid,
          seat: seat as Seat,
          memory: options.memory,
          clues: options.clues,
          seed: `${String(options.seed)}/kid-${seat}`,
          ...(options.clueFadeSeconds === undefined
            ? {}
            : { clueFadeSeconds: options.clueFadeSeconds }),
        })
      : null,
  );
  const humans = SEATS.filter((seat) => drivers[seat].kind === 'human');
  const mouse: MouseWalk | null = options.pointerArea ? createMouseWalk(options.clues) : null;
  const fogOn = options.fog && rules.flags === 1;
  const sound = options.audio
    ? createMatchSound({ audio: options.audio.engine, look: look.id, volume: options.audio.volume })
    : null;
  const keepClues = options.clues === 'notebook';

  let appearance = options.appearance;
  let view: FieldView = buildView();
  let hud: Hud | null = options.hudHost
    ? createHud({
        host: options.hudHost,
        look: look.id,
        seats: options.seats,
        appearance,
        reducedMotion: options.reducedMotion,
        classic: options.clues === 'classic',
      })
    : null;

  /** Clues on the field now, by square. */
  const showing = new Map<Square, Check>();
  /** Thin Ice: when each showing clue melts, in seconds of play. */
  const melts = new Map<Square, number>();
  /** The square each seat is holding a Classic Memory clue up on (a bomb's, after the ride home). */
  const holdingUp: [Square | null, Square | null] = [null, null];
  let stories: StoryTracker = trackStories(rules.motion);
  const trail: Clue['kind'][] = [];

  let held = false;
  let finished = false;
  let ending: number | null = null;
  let played = 0;
  let startedAt = 0;
  let lastFrame = 0;

  function buildView(): FieldView {
    const built = look.createView({
      stage,
      appearance,
      quality: options.quality,
      // The view's own randomness (snow puffs, crater shapes) never touches the match's.
      rng: createRng(`${String(options.seed)}/view`),
      seats: [options.seats[0].colours, options.seats[1].colours],
      players: alone ? 1 : 2,
      reducedEffects: options.reducedEffects,
      cluePalette: options.cluePalette,
    });
    stage.scene.add(built.root);
    return built;
  }

  const name = (seat: Seat) => options.seats[seat].name;

  // ——— Seats ———

  /** The seat the mouse drives: the only person playing, or in turns the person whose turn it is. */
  function mouseSeat(): Seat | null {
    if (humans.length === 1) return humans[0] ?? null;
    if (humans.length === 2 && rules.style === 'turns') return match.turn;
    if (humans.length === 2 && rules.style === 'hunts') return match.hunter;
    return null;
  }

  function readMouse(): void {
    const pointer = options.input?.pointer;
    const area = options.pointerArea;
    if (!mouse || !pointer || !area) return;
    if (pointer.released) mouse.release();
    if (!pointer.pressed || pointer.x === null || pointer.y === null) return;
    const seat = mouseSeat();
    if (seat === null || !match.seats[seat].playing) return;
    const square = squareUnderPointer(
      stage.camera,
      look.fieldHeight,
      pointer.x,
      pointer.y,
      area.clientWidth,
      area.clientHeight,
    );
    if (square !== null) mouse.press(square, match.seats[seat].square);
  }

  function inputs(): [SeatInput, SeatInput] {
    const frame = options.input?.poll();
    readMouse();
    const steered = mouseSeat();
    return [inputFor(0, frame), inputFor(1, frame)];

    function inputFor(seat: Seat, polled: typeof frame): SeatInput {
      const driver = drivers[seat];
      if (driver.kind === 'kid') return kids[seat]?.input(match) ?? IDLE;
      if (driver.kind === 'empty' || !polled) return IDLE;
      const keys = seatInput(polled.seats[driver.seat]);
      if (!mouse || steered !== seat) return keys;
      if (isSteering(keys)) {
        mouse.cancel();
        return keys;
      }
      const other = match.seats[seat === 0 ? 1 : 0];
      const fromMouse = mouse.input(match.seats[seat].square, other.playing ? other.square : null);
      return { ...fromMouse, reveal: keys.reveal || fromMouse.reveal };
    }
  }

  // ——— What the events show ———

  function newField(playing: readonly Seat[]): void {
    view.reset();
    view.setPlaying(playing);
    for (const seat of playing) view.placeExplorer(seat, match.seats[seat].square);
    showing.clear();
    melts.clear();
    holdingUp[0] = null;
    holdingUp[1] = null;
    stories = trackStories(rules.motion);
    mouse?.cancel();
    showFog();
  }

  function showFog(): void {
    if (!fogOn) return;
    if (match.checks.length === 0) {
      view.setFog(null);
      return;
    }
    const belief = stories.believe(match.flagMoves);
    view.setFog(Array.from(belief.chance, (chance) => chance > 0));
  }

  function hide(square: Square): void {
    if (!showing.delete(square)) return;
    melts.delete(square);
    view.conceal(square);
  }

  function showCheck(check: Check): void {
    const { seat, square, clue } = check;
    if (seat === 0) trail.push(clue.kind);
    if (clue.kind === 'flag') return;
    stories.add({ square, clue, flagMoves: check.flagMoves });
    showing.set(square, check);
    if (!keepClues) holdingUp[seat] = square;
    if (keepClues && options.clueFadeSeconds !== undefined) {
      melts.set(square, played + options.clueFadeSeconds);
    }
    if (clue.kind === 'bomb') {
      view.blast(seat, square);
      hud?.say(`Bomb! ${name(seat)} heads home.`, 'alert', seat);
    } else {
      view.reveal(seat, square, clue, { keep: keepClues });
    }
  }

  function apply(events: readonly MatchEvent[]): void {
    let fogChanged = false;
    for (const event of events) {
      switch (event.type) {
        case 'round':
          newField(event.playing);
          if (rules.style === 'hunts' && !alone) hud?.say(`${name(match.hunter)} hunts.`);
          break;
        case 'step':
          view.walk(event.seat, event.from, event.to, WALK_SECONDS);
          break;
        case 'blocked':
          view.nudge(event.seat, event.toward);
          if (drivers[event.seat].kind === 'human') {
            hud?.say(`${name(event.seat === 0 ? 1 : 0)} is standing there.`, 'plain', event.seat);
          }
          break;
        case 'check':
          showCheck(event.check);
          fogChanged = true;
          break;
        case 'release': {
          const square = holdingUp[event.seat];
          holdingUp[event.seat] = null;
          if (square !== null) hide(square);
          break;
        }
        case 'home':
          view.sendHome(event.seat, event.to);
          if (event.to === null) hud?.say(`Home is taken: ${name(event.seat)} stays put.`);
          break;
        case 'capture':
          hide(event.square);
          view.capture(event.seat, event.square);
          if (fogOn) view.setFog(null);
          hud?.say(`${name(event.seat)} found the flag!`, 'joy', event.seat);
          break;
        case 'final-turn':
          hud?.say(`${name(event.seat)} gets the last hunt, to even the turns.`);
          break;
        case 'over':
          for (const flag of event.flags) view.showFlag(flag);
          if (event.flags.length > 0) hud?.say('There was the flag.', 'plain');
          break;
        case 'score':
        case 'turn':
        case 'clock':
          break;
      }
    }
    if (fogChanged && !match.celebration) showFog();
  }

  function meltClues(): void {
    for (const [square, at] of melts) if (played >= at) hide(square);
  }

  // ——— The loop ———

  /** Live play is over; the field keeps drawing (a flag fluttering) behind whatever comes next. */
  function finish(): void {
    if (finished) return;
    finished = true;
    hud?.mark(null, 0);
    options.onOver?.({
      match,
      result: match.result,
      kids: kids.filter((kid): kid is KidPlayer => kid !== null),
      trail,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  function hear(events: readonly MatchEvent[]): void {
    for (const kid of kids) kid?.hear(events, match);
    apply(events);
    sound?.hear(events);
    options.onEvents?.(events, match);
  }

  const loop = options.createLoop({
    hz: 1 / TICK_SECONDS,
    update(dt) {
      if (finished || held) return;
      if (ending !== null) {
        ending -= dt;
        if (ending <= 0) finish();
        return;
      }
      played += dt;
      hear(stepMatch(match, inputs()));
      meltClues();
      const outOfTime = options.timeLimit !== undefined && played >= options.timeLimit;
      if (match.result) ending = END_HOLD_SECONDS;
      else if (outOfTime) finish();
    },
    render() {
      const now = performance.now();
      const seconds = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      view.update(seconds);
      stage.lights.update(seconds);
      view.flush();
      hud?.update(match);
      markTarget();
      stage.render();
    },
  });

  function markTarget(): void {
    if (!hud || !options.hudHost) return;
    const seat = mouseSeat();
    const target = mouse?.target ?? null;
    if (seat === null || target === null || finished) {
      hud.mark(null, 0);
      return;
    }
    const point = squareCentre(target, look.fieldHeight).project(stage.camera);
    const box = options.hudHost.getBoundingClientRect();
    hud.mark({ x: ((point.x + 1) / 2) * box.width, y: ((1 - point.y) / 2) * box.height }, seat);
  }

  /** Puts everything the match shows back on a fresh view (after an appearance change). */
  function redraw(): void {
    const playing = SEATS.filter((seat) => match.seats[seat].playing);
    view.setPlaying(playing);
    for (const check of showing.values()) {
      view.reveal(check.seat, check.square, check.clue, { keep: true });
    }
    for (const seat of playing) view.placeExplorer(seat, match.seats[seat].square);
    showFog();
    if (match.celebration) view.capture(match.celebration.seat, match.celebration.square);
  }

  hear(startMatch(match));
  options.arrange?.(match);
  for (const seat of SEATS) view.placeExplorer(seat, HOME_SQUARES[seat]);

  return {
    match,
    start(startOptions) {
      held = startOptions?.held ?? false;
      startedAt = performance.now();
      lastFrame = startedAt;
      loop.start();
    },
    release() {
      if (!held) return;
      held = false;
      startedAt = performance.now();
    },
    stand() {
      finished = true;
      hud?.dispose();
      hud = null;
    },
    setAppearance(next) {
      if (next === appearance) return;
      appearance = next;
      view.root.removeFromParent();
      view.dispose();
      view = buildView();
      redraw();
      hud?.setAppearance(next);
    },
    setLook(next) {
      view.root.removeFromParent();
      view.dispose();
      stage = next.stage;
      look = next.look;
      view = buildView();
      redraw();
      sound?.setLook(look.id);
    },
    dispose() {
      loop.stop();
      view.root.removeFromParent();
      view.dispose();
      hud?.dispose();
    },
  };
}
