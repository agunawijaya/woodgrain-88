/**
 * The pre-match cards, over the live field: who is hunting, in which colour,
 * with which switch and by which clue rule. People press reveal when they are
 * ready (or click Start); Kids are ready after a moment. When everyone is
 * set, the match is let go. Hunting alone there is one card.
 */
import {
  kidById,
  kidPortraitSvg,
  type GameLoop,
  type InputController,
  type KidId,
  type LoopOptions,
  type Seat as PlayerSeat,
} from '@woodgrain-88/kit';
import type { ClueMode } from '../ai/kid.ts';
import { channelNumber, type HotColdChannel } from '../channels.ts';
import type { HudSeat } from '../ui/hud.ts';
import { escapeText } from './style.ts';

export interface PrematchSeat {
  readonly hud: HudSeat;
  readonly kid: KidId | null;
  /** The person's controller seat, or null for a Kid. */
  readonly person: PlayerSeat | null;
  /** The key that checks a square for this person, as shown on the card. */
  readonly revealKey: string;
  readonly switchNote: string;
}

export interface PrematchOptions {
  readonly host: HTMLElement;
  readonly channel: HotColdChannel;
  /** One card per explorer on the field: one alone, two otherwise. */
  readonly seats: readonly PrematchSeat[];
  readonly clues: ClueMode;
  /** A challenge link's score to beat, as it reads. */
  readonly challenge?: string;
  readonly input: InputController;
  readonly createLoop: (options: LoopOptions) => GameLoop;
  readonly onReady: () => void;
  readonly onBack: () => void;
}

export interface PrematchScreen {
  dispose(): void;
}

/** A Kid says ready after this long, so the cards have a moment on screen. */
const KID_READY_SECONDS = 0.9;
/** Everyone ready: the cards hold this long before the match starts. */
const SETTLE_SECONDS = 0.5;

const STYLE = /* css */ `
.hc-prematch {
  position: absolute;
  inset: max(64px, 10vh) 0 0 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: center;
  justify-items: center;
  padding: clamp(18px, 3vh, 36px) clamp(16px, 4vw, 48px);
  box-sizing: border-box;
  background: radial-gradient(ellipse 70% 60% at 50% 55%, rgba(8, 16, 30, 0.22), rgba(8, 16, 30, 0.58));
}
.hc-prematch-head { display: grid; justify-items: center; gap: 6px; text-align: center; padding: 18px 20px 12px; }
.hc-prematch-head .hc-band {
  padding: 5px 12px 4px;
  border-radius: 4px;
  background: var(--hc-ink);
  color: var(--hc-paper);
  font-size: clamp(16px, 2.2vh, 22px);
  letter-spacing: 0.1em;
}
.hc-prematch-head p { margin: 0; font-size: clamp(14px, 1.8vh, 17px); }
.hc-cards { display: flex; align-items: center; justify-content: center; gap: clamp(16px, 4vw, 64px); flex-wrap: wrap; }
.hc-seat-card {
  width: clamp(220px, 22vw, 300px);
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: clamp(20px, 3vh, 28px) 18px clamp(16px, 2.4vh, 22px);
  text-align: center;
  border-top: 0;
}
.hc-seat-card::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 8px;
  background: var(--seat);
}
.hc-seat-card .hc-photo { cursor: default; width: clamp(96px, 9vw, 130px); }
.hc-seat-badge {
  display: grid;
  place-items: center;
  width: clamp(96px, 9vw, 130px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--seat) 60%, #ffffff), var(--seat));
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.18), 0 8px 16px rgba(0, 0, 0, 0.25);
}
.hc-seat-badge svg { width: 54%; height: auto; }
.hc-seat-name { margin: 0; font-size: clamp(26px, 4vh, 40px); }
.hc-seat-note { margin: 0; font-size: clamp(13px, 1.6vh, 15px); color: var(--hc-ink-soft); }
.hc-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.hc-ready-prompt { font-size: clamp(14px, 1.8vh, 17px); font-weight: 700; display: inline-flex; gap: 0.5em; align-items: center; }
.hc-ready-stamp {
  font-size: clamp(22px, 3.2vh, 32px);
  color: var(--hc-hot);
  border: 3px solid currentColor;
  border-radius: 6px;
  padding: 2px 12px;
  transform: rotate(-6deg);
}
.hc-ready-stamp[hidden], .hc-ready-prompt[hidden] { display: none; }
.hc-versus { font-size: clamp(32px, 6vh, 64px); color: #ffffff; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6); }
.hc-prematch-foot { display: flex; gap: 16px; align-items: center; }
.hc-prematch-foot .hc-link { color: #ffffff; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
`;

/** A little explorer's flag, for a person's card. */
function personBadge(): string {
  return (
    '<div class="hc-seat-badge" aria-hidden="true"><svg viewBox="0 0 40 48">' +
    '<path d="M10 46V4" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M12 6h22l-6 8 6 8H12z" fill="#ffffff"/></svg></div>'
  );
}

function cardMarkup(seat: PrematchSeat, index: number, clues: ClueMode): string {
  const portrait =
    seat.kid === null
      ? personBadge()
      : `<div class="hc-photo" style="--tilt: 0deg">` +
        kidPortraitSvg(kidById(seat.kid), { expression: 'photo', idPrefix: `hc-pre-${seat.kid}` }) +
        `<span class="hc-hand">${escapeText(kidById(seat.kid).name)}</span></div>`;
  const clueBadge =
    clues === 'classic'
      ? '<span class="hc-badge is-classic">Classic Memory</span>'
      : '<span class="hc-badge is-notebook">Notebook</span>';
  const ready =
    seat.person === null
      ? ''
      : `<div class="hc-ready-prompt" data-card="${index}">Hold <span class="hc-key">${escapeText(seat.revealKey)}</span> to check · press it when ready</div>`;
  return (
    `<div class="hc-seat-card hc-card" data-card="${index}" style="--seat: ${seat.hud.colours.main}">` +
    portrait +
    `<h2 class="hc-display hc-seat-name">${escapeText(seat.hud.name)}</h2>` +
    (seat.hud.note ? `<p class="hc-seat-note">${escapeText(seat.hud.note)}</p>` : '') +
    `<div class="hc-badges">${clueBadge}<span class="hc-badge">${escapeText(seat.switchNote)}</span></div>` +
    ready +
    `<div class="hc-ready-stamp hc-display" data-card="${index}" hidden>Ready</div>` +
    `</div>`
  );
}

export function createPrematchScreen(options: PrematchOptions): PrematchScreen {
  const root = document.createElement('section');
  root.className = 'hc-screen hc-prematch';
  root.setAttribute('aria-label', 'Before the match');
  const style = document.createElement('style');
  style.textContent = STYLE;
  const { channel, seats } = options;
  const number = channelNumber(channel.def.id);

  root.innerHTML =
    `<header class="hc-prematch-head hc-card">` +
    `<span class="hc-band hc-display">CH ${String(number).padStart(2, '0')} · ${escapeText(channel.def.title)}</span>` +
    `<p>${escapeText(channel.def.description)}</p>` +
    (options.challenge
      ? `<p><strong>Challenge:</strong> ${escapeText(options.challenge)}</p>`
      : '') +
    `</header>` +
    `<div class="hc-cards">` +
    seats
      .map((seat, index) =>
        index === 0
          ? cardMarkup(seat, index, options.clues)
          : `<div class="hc-versus hc-display" aria-hidden="true">vs</div>` +
            cardMarkup(seat, index, options.clues),
      )
      .join('') +
    `</div>` +
    `<p class="hc-hidden-text" aria-live="polite" data-announcer></p>` +
    `<footer class="hc-prematch-foot">` +
    `<button type="button" class="hc-link" data-back>← Back</button>` +
    `<button type="button" class="hc-button is-primary" data-start>Start</button>` +
    `</footer>`;
  root.prepend(style);
  options.host.append(root);

  const announcer = root.querySelector<HTMLElement>('[data-announcer]');
  const ready = seats.map(() => false);
  const readyAt = seats.map(() => 0);
  let elapsed = 0;
  let released = false;

  function markReady(index: number): void {
    if (ready[index]) return;
    ready[index] = true;
    readyAt[index] = elapsed;
    const stamp = root.querySelector<HTMLElement>(`.hc-ready-stamp[data-card="${index}"]`);
    if (stamp) stamp.hidden = false;
    const prompt = root.querySelector<HTMLElement>(`.hc-ready-prompt[data-card="${index}"]`);
    if (prompt) prompt.hidden = true;
    if (announcer) announcer.textContent = `${seats[index]?.hud.name ?? ''} is ready`;
  }

  root.querySelector('[data-back]')?.addEventListener('click', () => options.onBack());
  root.querySelector('[data-start]')?.addEventListener('click', () => {
    seats.forEach((_, index) => markReady(index));
  });

  const loop = options.createLoop({
    update(dt) {
      elapsed += dt;
      const frame = options.input.poll();
      seats.forEach((seat, index) => {
        if (seat.person === null) {
          if (elapsed >= KID_READY_SECONDS) markReady(index);
        } else if (frame.seats[seat.person].pressed.has('fire')) {
          markReady(index);
        }
      });
      if (!released && ready.every(Boolean) && elapsed - Math.max(...readyAt) >= SETTLE_SECONDS) {
        released = true;
        options.onReady();
      }
    },
  });
  loop.start();
  requestAnimationFrame(() =>
    root.querySelector<HTMLElement>('[data-start]')?.focus({ preventScroll: true }),
  );

  return {
    dispose() {
      loop.stop();
      root.remove();
    },
  };
}
