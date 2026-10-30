/**
 * The pre-match cards, to Trailblaze's standard: each seat's ship up close in
 * a dark well lit in the seat's colour, who flies it and on what keys, then a
 * footer card that turns into a 3-2-1-go countdown in place. Solo docking has
 * one ship, so one card and no "vs".
 */
import { kidById, kidPortraitSvg, type KidId, type SwitchPosition } from '@woodgrain-88/kit';
import type { LookId, SeatColours } from '../look/look.ts';
import { lookById } from '../look/looks.ts';
import { DISPLAY_FONT, ensureScreenStyle, escapeText } from './style.ts';

/** The look's own names for its ships, orange (seat 0) then blue (seat 1). */
export const SHIP_NAMES: Readonly<Record<LookId, readonly [string, string]>> = {
  deep: ['Lance', 'Crescent'],
  brass: ['Clipper', 'Beetle'],
  paper: ['Zip', 'Bubble'],
  whirl: ['Minnow', 'Puffer'],
};

export interface PrematchSeat {
  readonly name: string;
  readonly colours: SeatColours;
  readonly switchPosition: SwitchPosition;
  /** Empty for a Kid: it needs no keys shown. */
  readonly keys: string;
  readonly kid?: KidId;
  readonly portrait?: HTMLCanvasElement;
}

export interface PrematchOptions {
  readonly host: HTMLElement;
  readonly look: LookId;
  /** Seat 0 first; solo docking passes only seat 0. */
  readonly seats: readonly [PrematchSeat] | readonly [PrematchSeat, PrematchSeat];
  readonly onReady: () => void;
  readonly onBack: () => void;
}

export interface PrematchScreen {
  /** The countdown number over the foot card, or null to show the ready prompt instead. */
  setCount(count: number | null): void;
  dispose(): void;
}

const STYLE = /* css */ `
.gd-prematch {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: center;
  justify-items: center;
  padding: clamp(16px, 3vh, 32px) clamp(16px, 4vw, 48px);
  box-sizing: border-box;
  z-index: 4;
}

.gd-prematch-header {
  padding: 12px 24px;
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}

.gd-prematch-look {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(20px, 3vh, 28px);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gd-prematch-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 3.5vw, 48px);
  flex-wrap: wrap;
}

.gd-seat-card {
  width: clamp(230px, 22vw, 320px);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 12px 12px clamp(16px, 2.2vh, 22px);
  text-align: center;
}

/* The ship close-up: a dark well, lit from below in the seat's colour. */
.gd-seat-ship {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 60% 38% at 50% 78%, color-mix(in srgb, var(--seat) 30%, transparent), transparent 72%),
    var(--gd-well);
}

.gd-seat-ship canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.gd-seat-who {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.gd-seat-portrait {
  width: clamp(48px, 4.4vw, 64px);
  display: grid;
  place-items: center;
}

.gd-seat-portrait svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
}

.gd-seat-name {
  font-size: clamp(18px, 2.4vh, 24px);
  font-weight: 800;
  margin: 0;
}

.gd-seat-flies {
  display: block;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--gd-muted);
}

.gd-seat-meta {
  display: grid;
  gap: 4px;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--gd-muted);
}

.gd-seat-swatch-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.gd-seat-keys {
  font-weight: 700;
  color: var(--gd-text);
  margin-top: 2px;
}

.gd-seat-card::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 4px;
  background: var(--seat);
}

.gd-prematch-foot {
  padding: 16px 28px;
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.gd-prompt-text {
  font-size: clamp(16px, 2.2vh, 22px);
  font-weight: 700;
}

.gd-countdown {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(52px, 9vh, 96px);
  font-weight: 800;
  line-height: 1;
  color: var(--gd-accent);
  animation: gd-count-pop 400ms cubic-bezier(0.2, 1.4, 0.4, 1);
}

@keyframes gd-count-pop {
  from { transform: scale(0.6); opacity: 0.3; }
  to { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .gd-countdown { animation: none; }
}
`;

/** A short seat-coloured dot and stroke, standing in for Trailblaze's trail swatch. */
function seatSwatchSvg(colours: SeatColours): string {
  return (
    `<svg class="gd-seat-swatch" viewBox="0 0 48 14" width="48" height="14" aria-hidden="true">` +
    `<circle cx="7" cy="7" r="4" fill="${colours.main}"/>` +
    `<line x1="18" y1="7" x2="44" y2="7" stroke="${colours.main}" stroke-width="3" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** A plain person icon in the seat's colour, for a human pilot. */
function personIconSvg(colours: SeatColours): string {
  return (
    `<svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true">` +
    `<circle cx="50" cy="38" r="18" fill="${colours.main}"/>` +
    `<path d="M 24 86 C 24 64 36 58 50 58 C 64 58 76 64 76 86 Z" fill="${colours.main}"/>` +
    `</svg>`
  );
}

function seatPortraitHtml(seat: PrematchSeat): string {
  if (seat.kid) {
    const kid = kidById(seat.kid);
    return kidPortraitSvg(kid, { expression: 'photo', idPrefix: `gd-prematch-${kid.id}` });
  }
  return personIconSvg(seat.colours);
}

export function createPrematchScreen(options: PrematchOptions): PrematchScreen {
  ensureScreenStyle(options.host);

  const root = document.createElement('section');
  root.className = 'gd-screen gd-prematch';
  root.setAttribute('aria-label', 'Pre-match lineup');

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  const shipNames = SHIP_NAMES[options.look];
  const cardsHtml = options.seats
    .map((seat, index) => {
      const portraitHtml = seatPortraitHtml(seat);
      return (
        `<div class="gd-card gd-seat-card" style="--seat: ${seat.colours.main}">` +
        `<div class="gd-seat-ship" data-seat-ship="${String(index)}"></div>` +
        `<div class="gd-seat-who">` +
        `<div class="gd-seat-portrait">${portraitHtml}</div>` +
        `<div><h3 class="gd-seat-name">${escapeText(seat.name)}</h3>` +
        `<span class="gd-seat-flies">Flies ${escapeText(shipNames[index] ?? '')}</span></div>` +
        `</div>` +
        `<div class="gd-seat-meta">` +
        `<div class="gd-seat-swatch-line">${seatSwatchSvg(seat.colours)}</div>` +
        `<span>Switch ${escapeText(seat.switchPosition)}</span>` +
        (seat.keys ? `<span class="gd-seat-keys">${escapeText(seat.keys)}</span>` : '') +
        `</div>` +
        `</div>`
      );
    })
    .join('');

  root.innerHTML =
    `<div class="gd-card gd-prematch-header">` +
    `<span class="gd-label">Space look</span>` +
    `<span class="gd-prematch-look">${escapeText(lookById(options.look).name)}</span>` +
    `</div>` +
    `<div class="gd-prematch-cards">${cardsHtml}</div>` +
    `<div class="gd-card gd-prematch-foot"></div>`;
  root.prepend(style);
  root.querySelectorAll('.gd-seat-ship').forEach((well, index) => {
    const portrait = options.seats[index]?.portrait;
    if (portrait) well.append(portrait);
  });
  const foot = root.querySelector('.gd-prematch-foot');

  /** Only the foot changes as the count runs, so the ships keep flying in their cards. */
  function showCount(count: number | null): void {
    if (!foot) return;
    foot.innerHTML =
      count !== null
        ? `<div class="gd-countdown">${count > 0 ? String(count) : 'Go!'}</div>`
        : `<p class="gd-prompt-text">Press Enter or Space to fly</p>`;
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      options.onReady();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onBack();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  showCount(null);
  options.host.append(root);

  return {
    setCount(count) {
      showCount(count);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
