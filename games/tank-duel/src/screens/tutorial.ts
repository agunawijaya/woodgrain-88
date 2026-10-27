/**
 * How to play, by playing: six short lessons on the real table, each with a
 * target that cannot fight back. Drive onto a marker; hit a sitting tank;
 * curl a guided shell round the concrete; bank a shell off the wall; find an
 * invisible tank by its own shot; shoot down a biplane. About a minute and a
 * half for someone who has never played, and every step can be skipped.
 */
import type { Stage } from '@woodgrain-88/arena';
import { channelById } from '../engine/channels.ts';
import type { MatchEvent, MatchState, Side, VehicleState } from '../engine/types.ts';
import { NO_INPUT } from '../engine/types.ts';
import { distance, vec, type Vec2 } from '../engine/vec.ts';
import { toTable } from '../render/board.ts';
import { framingFor } from '../render/framing.ts';
import type { MatchSession, MatchSessionOptions, SeatDriver } from '../session/match-session.ts';
import { escapeText } from './style.ts';

/** What the tutorial needs from the game to run a lesson's table. */
export type LessonSessionStarter = (
  options: Pick<MatchSessionOptions, 'channel' | 'drivers' | 'setup' | 'onStep' | 'aimLine'>,
) => MatchSession;

export interface TutorialOptions {
  readonly host: HTMLElement;
  readonly stage: Stage;
  readonly startSession: LessonSessionStarter;
  /** The tutorial ended: `finished` when the last lesson was reached rather than left. */
  readonly onDone: (finished: boolean) => void;
}

export interface TutorialScreen {
  dispose(): void;
}

interface Placement {
  readonly at: Vec2;
  readonly heading: number;
}

interface Lesson {
  readonly title: string;
  /** Keys in [brackets] are drawn as key caps. */
  readonly instruction: string;
  readonly channel: string;
  readonly player: Placement;
  readonly target: Placement;
  readonly targetDriver: SeatDriver;
  readonly marker?: Vec2;
  /** Shows where a shell would go: the bank lesson's aid, whatever the setting. */
  readonly aimLine?: boolean;
  readonly done: (state: MatchState, events: readonly MatchEvent[], marker?: Vec2) => boolean;
}

/** A hit by the player's side, banked at least `bounces` times. */
function playerHit(bounces = 0) {
  return (_state: MatchState, events: readonly MatchEvent[]): boolean =>
    events.some((event) => event.kind === 'hit' && event.shooter === 0 && event.bounces >= bounces);
}

function leader(state: MatchState, side: Side): VehicleState | undefined {
  return state.vehicles.find((vehicle) => vehicle.side === side && vehicle.slot === 0);
}

/** The invisible lesson's target fires straight up every three seconds, so its shot gives it away. */
const BLINKING_TARGET: SeatDriver = {
  kind: 'script',
  stick: (state) => ({ ...NO_INPUT, fire: Math.floor(state.time / 1.5) % 2 === 0 }),
};

const LESSONS: readonly Lesson[] = [
  {
    title: 'Drive',
    instruction: 'Turn with [←] and [→], drive forward with [↑]. Roll onto the marker.',
    channel: 'game-5',
    player: { at: vec(10, 30), heading: 0 },
    target: { at: vec(56, 8), heading: 8 },
    targetDriver: { kind: 'idle' },
    marker: vec(26, 18),
    done: (state, _events, marker) => {
      const own = leader(state, 0);
      return own !== undefined && marker !== undefined && distance(own.position, marker) < 2.6;
    },
  },
  {
    title: 'Fire',
    instruction: 'Line up with the other tank and press [Space]. One shell flies at a time.',
    channel: 'game-5',
    player: { at: vec(14, 20), heading: 0 },
    target: { at: vec(44, 20), heading: 8 },
    targetDriver: { kind: 'idle' },
    done: playerHit(),
  },
  {
    title: 'Guided shells',
    instruction:
      'The concrete is in the way. Fire, then keep turning with [A] and [D]: the shell turns with you. Curl it round.',
    channel: 'game-1',
    player: { at: vec(14, 20), heading: 0 },
    target: { at: vec(50, 20), heading: 8 },
    targetDriver: { kind: 'idle' },
    done: playerHit(),
  },
  {
    title: 'Bank shot',
    instruction:
      'Here shells bounce. The thin gold line shows where yours would go: turn until it bounces off the wall into the target.',
    channel: 'game-7',
    player: { at: vec(10, 30), heading: 0 },
    target: { at: vec(34, 22), heading: 8 },
    targetDriver: { kind: 'idle' },
    aimLine: true,
    done: playerHit(1),
  },
  {
    title: 'Invisible tanks',
    instruction:
      'Both tanks are invisible. A tank shows itself when it fires, bumps into something or is hit. Watch for its shot, then hit it.',
    channel: 'game-10',
    player: { at: vec(8, 20), heading: 0 },
    target: { at: vec(18, 20), heading: 12 },
    targetDriver: BLINKING_TARGET,
    done: playerHit(),
  },
  {
    title: 'Aircraft',
    instruction:
      'Planes never stop. Turn with [←] and [→]; [↑] and [↓] set the speed. Shoot the other biplane down.',
    channel: 'game-15',
    player: { at: vec(12, 20), heading: 0 },
    target: { at: vec(40, 14), heading: 0 },
    targetDriver: { kind: 'idle' },
    done: playerHit(),
  },
];

/** Seconds the "Nice shot" stamp stays before the next lesson. */
const CELEBRATE_SECONDS = 1.3;

const STYLE = /* css */ `
.td-tutorial { pointer-events: none; }
.td-tutorial > * { pointer-events: auto; }
.td-lesson {
  position: absolute;
  left: 50%;
  bottom: clamp(16px, 4vh, 40px);
  transform: translateX(-50%);
  width: min(720px, calc(100% - 32px));
  padding: clamp(14px, 2vh, 20px) clamp(16px, 2vw, 24px);
  display: grid;
  gap: 10px;
}
.td-lesson-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.td-lesson-head h2 { margin: 0; font-size: clamp(24px, 3.4vh, 34px); }
.td-lesson p { margin: 0; font-size: clamp(16px, 2.1vh, 19px); line-height: 1.45; }
.td-lesson p .td-key { opacity: 1; margin: 0 2px; font-size: 0.8em; vertical-align: 0.1em; }
.td-pips { display: flex; gap: 6px; }
.td-pips span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--td-olive);
}
.td-screens[data-appearance='dark'] .td-pips span { border-color: var(--td-mustard); }
.td-pips span.is-done { background: var(--td-olive); }
.td-screens[data-appearance='dark'] .td-pips span.is-done { background: var(--td-mustard); }
.td-lesson-links { display: flex; gap: 18px; justify-content: flex-end; }
.td-marker {
  position: absolute;
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
  border-radius: 50%;
  border: 4px dashed var(--td-mustard);
  box-shadow: 0 0 18px rgba(242, 162, 44, 0.7);
  animation: td-marker 1.6s linear infinite;
  pointer-events: none;
}
@keyframes td-marker { to { transform: rotate(360deg); } }
.td-nice {
  position: absolute;
  left: 50%;
  top: 38%;
  transform: translate(-50%, -50%) rotate(-6deg);
  padding: 8px 26px;
  border: 5px solid var(--td-rust);
  border-radius: 8px;
  color: var(--td-rust);
  background: rgba(244, 233, 204, 0.85);
  font-size: clamp(36px, 7vh, 72px);
  pointer-events: none;
  animation: td-nice 220ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes td-nice { from { transform: translate(-50%, -50%) rotate(-6deg) scale(2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .td-marker, .td-nice { animation: none; }
}
`;

/** "[A]" becomes a key cap; everything else is plain text. */
function instructionMarkup(text: string): string {
  return escapeText(text).replace(/\[([^\]]+)\]/g, '<span class="td-key">$1</span>');
}

function placed(state: MatchState, lesson: Lesson): MatchState {
  return {
    ...state,
    vehicles: state.vehicles.map((vehicle) => {
      if (vehicle.slot !== 0) return vehicle;
      const spot = vehicle.side === 0 ? lesson.player : lesson.target;
      return { ...vehicle, position: spot.at, heading: spot.heading };
    }),
  };
}

export function createTutorialScreen(options: TutorialOptions): TutorialScreen {
  const root = document.createElement('section');
  root.className = 'td-screen td-tutorial';
  root.setAttribute('aria-label', 'How to play');
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);
  const panel = document.createElement('div');
  panel.className = 'td-lesson td-panel';
  panel.setAttribute('aria-live', 'polite');
  root.append(panel);
  options.host.append(root);

  let index = 0;
  let session: MatchSession | null = null;
  let marker: HTMLElement | null = null;
  let celebrating: ReturnType<typeof setTimeout> | null = null;

  function showPanel(lesson: Lesson): void {
    const pips = LESSONS.map(
      (_each, at) => `<span class="${at < index ? 'is-done' : ''}" aria-hidden="true"></span>`,
    ).join('');
    panel.innerHTML =
      `<div class="td-lesson-head"><h2 class="td-display">${escapeText(lesson.title)}</h2>` +
      `<span class="td-label">Step ${index + 1} of ${LESSONS.length}</span></div>` +
      `<p>${instructionMarkup(lesson.instruction)}</p>` +
      `<div class="td-lesson-head"><div class="td-pips">${pips}</div>` +
      `<div class="td-lesson-links">` +
      `<button type="button" class="td-link" data-act="skip">Skip this step</button>` +
      `<button type="button" class="td-link" data-act="leave">Leave the tutorial</button>` +
      `</div></div>`;
  }

  function placeMarker(at: Vec2 | undefined): void {
    marker?.remove();
    marker = null;
    if (!at) return;
    const point = toTable(at.x, at.y, 0).project(options.stage.camera);
    const box = options.host.getBoundingClientRect();
    marker = document.createElement('div');
    marker.className = 'td-marker';
    marker.style.left = `${((point.x + 1) / 2) * box.width}px`;
    marker.style.top = `${((1 - point.y) / 2) * box.height}px`;
    root.append(marker);
  }

  function celebrate(): void {
    if (celebrating !== null) return;
    const stamp = document.createElement('div');
    stamp.className = 'td-nice td-display';
    stamp.textContent = index === LESSONS.length - 1 ? 'That’s the lot!' : 'Nice shot!';
    if (LESSONS[index]?.title === 'Drive') stamp.textContent = 'Nice driving!';
    root.append(stamp);
    celebrating = setTimeout(() => {
      stamp.remove();
      celebrating = null;
      next();
    }, CELEBRATE_SECONDS * 1000);
  }

  function begin(): void {
    const lesson = LESSONS[index];
    if (!lesson) {
      finish(true);
      return;
    }
    const channel = channelById(lesson.channel);
    options.stage.setFraming(framingFor(channel, 0));
    session?.dispose();
    session = options.startSession({
      channel,
      drivers: [{ kind: 'human', seat: 1 }, lesson.targetDriver],
      setup: (state) => placed(state, lesson),
      ...(lesson.aimLine ? { aimLine: true } : {}),
      onStep: (state, events) => {
        if (lesson.done(state, events, lesson.marker)) celebrate();
      },
    });
    session.start();
    showPanel(lesson);
    placeMarker(lesson.marker);
  }

  function next(): void {
    index++;
    begin();
  }

  function finish(finished: boolean): void {
    if (celebrating !== null) clearTimeout(celebrating);
    session?.dispose();
    session = null;
    options.onDone(finished);
  }

  panel.addEventListener('click', (event) => {
    const act =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-act]') : null;
    if (act?.dataset.act === 'skip') next();
    if (act?.dataset.act === 'leave') finish(false);
  });

  begin();

  return {
    dispose() {
      if (celebrating !== null) clearTimeout(celebrating);
      session?.dispose();
      root.remove();
    },
  };
}
