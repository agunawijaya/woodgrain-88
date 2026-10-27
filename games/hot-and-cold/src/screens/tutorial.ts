/**
 * How to play, by playing: about a minute on one small field laid out for
 * the lessons. Walk to a marked square, check it and read the number, check
 * an arrow, step on a bomb and ride home, then put the clues together and dig
 * up the flag. A last card says how moving flags change things. Every lesson
 * waits for the player to do it; Skip is always there.
 */
import type { SquareKind } from '../engine/board.ts';
import { squareAt, type Square } from '../engine/grid.ts';
import type { Match, MatchEvent } from '../engine/match.ts';
import type { MatchSession } from '../session/match-session.ts';

export interface TutorialOptions {
  readonly host: HTMLElement;
  /** Starts the lesson field: one explorer, the flag where the lessons need it. */
  readonly startSession: (lesson: {
    readonly arrange: (match: Match) => void;
    readonly onEvents: (events: readonly MatchEvent[], match: Match) => void;
  }) => MatchSession;
  /** Where a square's centre is on screen, in CSS pixels inside the host. */
  readonly project: (square: Square) => { readonly x: number; readonly y: number };
  readonly onDone: (finished: boolean) => void;
}

export interface TutorialScreen {
  dispose(): void;
}

/** The lesson field: the flag on F3, a 4 on B2, an arrow on D4 and a bomb on C3. */
const FLAG = squareAt(5, 2);
const FIRST_CLUE = squareAt(1, 1);
const ARROW_CLUE = squareAt(3, 3);
const BOMB = squareAt(2, 2);

interface Lesson {
  readonly title: string;
  readonly text: string;
  /** The square to walk to, marked on the field; null for none. */
  readonly target: Square | null;
  /** Whether this tick's events finish the lesson. */
  readonly done: ((events: readonly MatchEvent[], match: Match) => boolean) | null;
}

const LESSONS: readonly Lesson[] = [
  {
    title: 'Walk',
    text: 'Walk to the marked square: arrows or WASD, or click it. Explorers step a square at a time.',
    target: FIRST_CLUE,
    done: (_events, match) => match.seats[0].square === FIRST_CLUE,
  },
  {
    title: 'Check',
    text: 'Hold Enter or Space to check the square you stand on (or click it). A number says how many steps away the flag is, diagonals counting as one.',
    target: FIRST_CLUE,
    done: (events) => events.some((event) => event.type === 'check'),
  },
  {
    title: 'Arrows',
    text: 'Walk to the next mark and check it. An arrow points the flag’s way: straight along a row or column only when the flag is on it.',
    target: ARROW_CLUE,
    done: (events) =>
      events.some((event) => event.type === 'check' && event.check.square === ARROW_CLUE),
  },
  {
    title: 'Bombs',
    text: 'This square hides a bomb. Check it anyway and see: a bomb sends you back to your home corner.',
    target: BOMB,
    done: (events) => events.some((event) => event.type === 'home'),
  },
  {
    title: 'Find it',
    text: 'The 4 says four steps from B2; the arrow says up and to the right of D4. Where they agree, the flag is. Go and dig it up!',
    target: null,
    done: (events) => events.some((event) => event.type === 'capture'),
  },
  {
    title: 'Moving flags',
    text: 'On the bouncing and wrapping channels the flag moves a square every time anyone misses, so old clues go stale. That’s it: good hunting!',
    target: null,
    done: null,
  },
];

const STYLE = /* css */ `
.hc-tutorial-card {
  position: absolute;
  left: 50%;
  bottom: clamp(16px, 4vh, 44px);
  transform: translateX(-50%);
  width: min(640px, calc(100% - 32px));
  padding: 20px 20px 14px;
  display: grid;
  gap: 8px;
}
.hc-tutorial-card h2 { margin: 0; font-size: clamp(26px, 4vh, 38px); }
.hc-tutorial-card p { margin: 0; font-size: clamp(15px, 2vh, 19px); line-height: 1.45; }
.hc-tutorial-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.hc-dots { display: flex; gap: 6px; }
.hc-dots span { width: 9px; height: 9px; border-radius: 50%; background: var(--hc-well); box-shadow: inset 0 0 0 1px var(--hc-paper-edge); }
.hc-dots span.is-done { background: var(--hc-hot); }
.hc-tutorial-target {
  position: absolute;
  width: 34px;
  height: 40px;
  margin: -46px 0 0 -17px;
  color: var(--hc-hot);
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  pointer-events: none;
  animation: hc-bob 0.9s ease-in-out infinite alternate;
}
.hc-tutorial-target[hidden] { display: none; }
@keyframes hc-bob { from { translate: 0 -5px; } to { translate: 0 2px; } }
@media (prefers-reduced-motion: reduce) { .hc-tutorial-target { animation: none; } }
`;

export function createTutorialScreen(options: TutorialOptions): TutorialScreen {
  const root = document.createElement('section');
  root.className = 'hc-screen hc-tutorial';
  root.setAttribute('aria-label', 'How to play');
  root.style.pointerEvents = 'none';
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.innerHTML =
    `<div class="hc-tutorial-target" aria-hidden="true"><svg viewBox="0 0 26 30" width="34" height="40">` +
    `<path d="M13 29 L4 13 A10 10 0 1 1 22 13 Z" fill="currentColor" stroke="#fff" stroke-width="2"/>` +
    `<circle cx="13" cy="10" r="3.6" fill="#fff"/></svg></div>` +
    `<div class="hc-tutorial-card hc-card" style="pointer-events: auto">` +
    `<h2 class="hc-display" data-title></h2><p data-text aria-live="polite"></p>` +
    `<div class="hc-tutorial-foot"><div class="hc-dots" aria-hidden="true">` +
    LESSONS.map(() => '<span></span>').join('') +
    `</div><div><button type="button" class="hc-link" data-skip>Skip</button> ` +
    `<button type="button" class="hc-button is-primary" data-next hidden>Finish</button></div></div></div>`;
  root.prepend(style);
  options.host.append(root);

  const title = root.querySelector<HTMLElement>('[data-title]');
  const text = root.querySelector<HTMLElement>('[data-text]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  const target = root.querySelector<HTMLElement>('.hc-tutorial-target');
  const dots = [...root.querySelectorAll<HTMLElement>('.hc-dots span')];
  let index = 0;
  let frame = 0;
  let closed = false;

  function show(): void {
    const lesson = LESSONS[index];
    if (!lesson || !title || !text || !next) return;
    title.textContent = lesson.title;
    text.textContent = lesson.text;
    dots.forEach((dot, at) => dot.classList.toggle('is-done', at < index));
    next.hidden = lesson.done !== null;
    if (!next.hidden) next.focus({ preventScroll: true });
  }

  function placeTarget(): void {
    const square = LESSONS[index]?.target ?? null;
    if (target) {
      target.hidden = square === null;
      if (square !== null) {
        const point = options.project(square);
        target.style.left = `${point.x}px`;
        target.style.top = `${point.y}px`;
      }
    }
    if (!closed) frame = requestAnimationFrame(placeTarget);
  }

  function close(finished: boolean): void {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    options.onDone(finished);
  }

  const session = options.startSession({
    arrange(match) {
      const kinds = match.board.kinds.map((_, square): SquareKind =>
        square === BOMB ? 'bomb' : square === ARROW_CLUE || square === FLAG ? 'arrow' : 'distance',
      );
      match.board = { kinds, flags: [FLAG] };
      match.flags = [FLAG];
    },
    onEvents(events, match) {
      const lesson = LESSONS[index];
      if (!lesson?.done?.(events, match)) return;
      index++;
      show();
    },
  });
  session.start();

  root.querySelector('[data-skip]')?.addEventListener('click', () => close(false));
  next?.addEventListener('click', () => close(true));
  show();
  placeTarget();

  return {
    dispose() {
      closed = true;
      cancelAnimationFrame(frame);
      root.remove();
    },
  };
}
