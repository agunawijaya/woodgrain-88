/**
 * One match on the table. The kit loop steps the pure engine; each side is
 * driven either by a person's stick or by a Neighbourhood Kid's commander;
 * the diorama and the HUD are drawn between steps. Every step's events go to
 * whoever listens (progress, sound), and the best hit is kept for the results
 * replay. The game menu's idle backdrop and the Den TV run the same session
 * with two Kids and no HUD.
 */
import { createCameraShake, type CameraShake, type Stage } from '@woodgrain-88/arena';
import type {
  Appearance,
  AudioEngine,
  GameLoop,
  InputController,
  KidId,
  LoopOptions,
  Rng,
  Seat,
  SeatFrame,
} from '@woodgrain-88/kit';
import { createCommander, type Commander } from '../ai/commander.ts';
import { createMatchSound, type MatchSound } from '../audio/match-sound.ts';
import { createMatch, createWorld, stepMatch, type MatchWorld } from '../engine/match.ts';
import type {
  ChannelRules,
  MatchEvent,
  MatchOptions,
  MatchState,
  Side,
  StickInput,
} from '../engine/types.ts';
import { NO_INPUT } from '../engine/types.ts';
import { isRevealed } from '../engine/visibility.ts';
import type { Vec2 } from '../engine/vec.ts';
import { toTable } from '../render/board.ts';
import { createMatchView, type MatchView } from '../render/match-view.ts';
import { FLYING_HEIGHT } from '../render/sky.ts';
import type { TeamPalette } from '../render/teams.ts';
import { createHud, type Hud, type HudSeat } from '../ui/hud.ts';
import { predictedShot } from './aim-line.ts';
import {
  createReplayCursor,
  createReplayRecorder,
  type ReplayClip,
  type ReplayRecorder,
} from './replay.ts';
import { scoredPoints, type ScoredPoint } from './result.ts';

export type SeatDriver =
  | { readonly kind: 'human'; readonly seat: Seat }
  | { readonly kind: 'kid'; readonly kid: KidId }
  /** Nobody at the controls: the tank sits still, as an unplayed one did in 1977 (practice). */
  | { readonly kind: 'idle' }
  /** A fixed routine, for the tutorial's targets. */
  | { readonly kind: 'script'; readonly stick: (state: MatchState) => StickInput };

export interface MatchSessionOptions {
  readonly stage: Stage;
  /** Where the score plates go; null for a match without a HUD (menu backdrop, Den TV). */
  readonly hudHost: HTMLElement | null;
  readonly channel: ChannelRules;
  readonly match: MatchOptions;
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly seats: readonly [HudSeat, HudSeat];
  readonly appearance: Appearance;
  readonly reducedMotion: boolean;
  readonly explosions: 'full' | 'reduced';
  readonly palette?: TeamPalette;
  readonly shake: boolean;
  readonly rng: Rng;
  readonly createLoop: (options: LoopOptions) => GameLoop;
  /** The seats' controllers; null when nobody human plays. */
  readonly input: InputController | null;
  /** Whose hits the results replay prefers. */
  readonly favour: Side | 'either';
  /** Sound for the match, with the player's mix; leave out for a silent table (the Den TV). */
  readonly audio?: {
    readonly engine: AudioEngine;
    readonly volumes: () => { readonly engines: number; readonly effects: number };
  };
  /** Ends the match after this many seconds even if the rules would go on (micro-challenges). */
  readonly timeLimit?: number;
  /** Rearranges the opening state (the tutorial places the vehicles where its lesson needs them). */
  readonly setup?: (state: MatchState) => MatchState;
  /** Draws seat 1's aim line (practice and the tutorial only). */
  readonly aimLine?: boolean;
  /** Each engine step's events, with the state after it. */
  readonly onStep?: (state: MatchState, events: readonly MatchEvent[]) => void;
  readonly onOver?: (outcome: MatchOutcome) => void;
}

export interface MatchOutcome {
  readonly final: MatchState;
  readonly points: readonly ScoredPoint[];
  /** Most bounces on one of side 0's scoring hits. */
  readonly bestBank: number;
  readonly clip: ReplayClip | null;
  readonly durationMs: number;
}

export interface MatchSession {
  /** Starts drawing the table; the match itself waits for `release` when `held` was asked for. */
  start(options?: { held?: boolean }): void;
  /** Lets a held match begin (both seats ready). */
  release(): void;
  /** Brings the engine hums back after the chrome silenced the game (the pause menu). */
  restartAudio(): void;
  /** Ends live play and loops a recorded clip on the same table, for the results screen. */
  replay(clip: ReplayClip): void;
  /** Ends live play and leaves the last frame standing, HUD and engines gone (results, no replay). */
  stand(): void;
  setAppearance(appearance: Appearance): void;
  /** The state as of the last step. */
  readonly state: MatchState;
  readonly world: MatchWorld;
  dispose(): void;
}

/** A stick pushed past this reads as a full push, as on the original's switches. */
const STICK_THRESHOLD = 0.4;
/** The pause on the last frame of a replay before it plays again. */
const REPLAY_HOLD_SECONDS = 1.2;
/** A scoring hit holds the action this long, so the blow lands before the spin starts. */
const HIT_STOP_SECONDS = 0.06;

/** The engine's stick from a seat's frame: the kit's axis points down the screen, the engine's up. */
export function stickFromFrame(frame: SeatFrame): StickInput {
  const { x, y } = frame.axis;
  return {
    x: x > STICK_THRESHOLD ? 1 : x < -STICK_THRESHOLD ? -1 : 0,
    y: y < -STICK_THRESHOLD ? 1 : y > STICK_THRESHOLD ? -1 : 0,
    // A tap shorter than one step is still a shot: the press counts even if the key is already up.
    fire: frame.held.has('fire') || frame.pressed.has('fire'),
  };
}

export function createMatchSession(options: MatchSessionOptions): MatchSession {
  const { stage, channel } = options;
  const world = createWorld(channel);
  const inTheAir = channel.field.kind === 'sky';
  const opening = createMatch(channel, options.match, world);
  let current = options.setup ? options.setup(opening) : opening;
  let previous = current;

  const commanders: readonly (Commander | null)[] = options.drivers.map((driver, side) =>
    driver.kind === 'kid'
      ? createCommander(driver.kid, side as Side, channel, world, options.rng.fork(`kid-${side}`))
      : null,
  );
  const shake: CameraShake = createCameraShake({
    maxOffset: 0.6,
    maxRoll: 0.012,
    recovery: 1.6,
    enabled: options.shake && !options.reducedMotion,
  });
  let appearance = options.appearance;
  let view: MatchView = buildView();
  const hud: Hud | null = options.hudHost
    ? createHud({
        host: options.hudHost,
        seats: options.seats,
        scoring: options.match.scoring,
        appearance,
        reducedMotion: options.reducedMotion,
        ...(options.palette ? { palette: options.palette } : {}),
      })
    : null;
  const recorder: ReplayRecorder = createReplayRecorder({ favour: options.favour });
  const points: ScoredPoint[] = [];
  let bestBank = 0;
  let finished = false;
  let startedAt = 0;
  let frameStarted = 0;
  let replayLoop: GameLoop | null = null;
  let held = false;
  let hitStop = 0;
  const sound: MatchSound | null = options.audio
    ? createMatchSound({
        audio: options.audio.engine,
        revealed: isRevealed,
        volumes: options.audio.volumes,
      })
    : null;

  function buildView(): MatchView {
    stage.setAppearance(appearance);
    return createMatchView({
      stage,
      channel,
      field: world.field,
      night: appearance === 'dark',
      rng: options.rng.fork('view'),
      revealed: isRevealed,
      reducedEffects: options.explosions === 'reduced' || options.reducedMotion,
      shake,
      ...(options.palette ? { palette: options.palette } : {}),
    });
  }

  function sticks(): readonly [StickInput, StickInput] {
    const frame = options.input?.poll();
    const forSide = (side: Side): StickInput => {
      const driver = options.drivers[side];
      if (driver.kind === 'kid') return commanders[side]?.think(current, world, 1 / 60) ?? NO_INPUT;
      if (driver.kind === 'idle') return NO_INPUT;
      if (driver.kind === 'script') return driver.stick(current);
      return frame ? stickFromFrame(frame.seats[driver.seat]) : NO_INPUT;
    };
    return [forSide(0), forSide(1)];
  }

  /** Raises the HUD's bank tag over the point on the board where a banked shell struck. */
  function showBank(at: Vec2, bounces: number): void {
    if (!hud || !options.hudHost) return;
    const point = toTable(at.x, at.y, (inTheAir ? FLYING_HEIGHT : 0) + 1.5).project(stage.camera);
    const box = options.hudHost.getBoundingClientRect();
    hud.bank(((point.x + 1) / 2) * box.width, ((1 - point.y) / 2) * box.height, bounces);
  }

  function noteEvents(events: readonly MatchEvent[]): void {
    for (const point of scoredPoints(events)) points.push(point);
    for (const event of events) {
      if (event.kind !== 'hit') continue;
      if (event.bounces > 0) showBank(event.at, event.bounces);
      if (event.shooter === 0) bestBank = Math.max(bestBank, event.bounces);
    }
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    loop.stop();
    options.onOver?.({
      final: current,
      points,
      bestBank,
      clip: recorder.best(),
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  const loop = options.createLoop({
    update(dt) {
      if (finished || held) return;
      if (hitStop > 0) {
        hitStop -= dt;
        return;
      }
      const step = stepMatch(current, sticks(), dt, world);
      previous = current;
      current = step.state;
      if (step.events.some((event) => event.kind === 'hit' || event.kind === 'own-hit')) {
        hitStop = HIT_STOP_SECONDS;
      }
      view.applyEvents(current, step.events);
      sound?.step(current, step.events);
      recorder.record({ state: current, events: step.events });
      noteEvents(step.events);
      options.onStep?.(current, step.events);
      const outOfTime = options.timeLimit !== undefined && current.time >= options.timeLimit;
      if (current.over || outOfTime) finish();
    },
    render(alpha) {
      const now = performance.now();
      const seconds = Math.min(0.1, (now - frameStarted) / 1000);
      frameStarted = now;
      view.draw(previous, current, alpha, seconds);
      if (options.aimLine) view.setAimLine(predictedShot(current, 0, world));
      stage.setShake(shake.update(seconds));
      hud?.update(current);
      sound?.frame(current);
      stage.render();
    },
  });

  return {
    get state() {
      return current;
    },
    world,
    start(startOptions) {
      held = startOptions?.held ?? false;
      startedAt = performance.now();
      frameStarted = startedAt;
      loop.start();
    },
    release() {
      if (!held) return;
      held = false;
      startedAt = performance.now();
    },
    restartAudio() {
      sound?.restart();
    },
    stand() {
      finished = true;
      loop.stop();
      hud?.dispose();
      sound?.dispose();
    },
    replay(clip) {
      finished = true;
      loop.stop();
      hud?.dispose();
      sound?.dispose();
      replayLoop?.stop();
      const cursor = createReplayCursor(clip);
      const began = performance.now();
      let lastFrame = began;
      replayLoop = options.createLoop({
        render() {
          const now = performance.now();
          const seconds = Math.min(0.1, (now - lastFrame) / 1000);
          lastFrame = now;
          const playhead = ((now - began) / 1000) % (cursor.duration + REPLAY_HOLD_SECONDS);
          const moment = cursor.seek(Math.min(playhead, cursor.duration));
          if (moment.events.length > 0) view.applyEvents(moment.current, moment.events);
          view.draw(moment.previous, moment.current, moment.alpha, seconds);
          stage.setShake(shake.update(seconds));
          stage.render();
        },
      });
      replayLoop.start();
    },
    setAppearance(next) {
      if (next === appearance) return;
      appearance = next;
      view.dispose();
      view = buildView();
      hud?.setAppearance(next);
    },
    dispose() {
      loop.stop();
      replayLoop?.stop();
      sound?.dispose();
      view.dispose();
      hud?.dispose();
    },
  };
}
