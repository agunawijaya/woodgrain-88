/**
 * Pre-match cards: two cards (four in Four Way) showing who rides and on
 * what: a close-up of the look's rider in the seat's colour, the person or
 * Kid riding it, their trail pattern swatch, difficulty switch and keys,
 * then the look's name and the 3-2-1 countdown to the match.
 */
import { kidById, kidPortraitSvg, type KidId, type SwitchPosition } from '@woodgrain-88/kit';
import type { LookId, SeatColours } from '../look/look.ts';
import { computerPortraitSvg, DISPLAY_FONT, ensureScreenStyle, escapeText } from './style.ts';

export interface PrematchSeat {
  readonly name: string;
  readonly role: 'you' | 'player2' | 'kid' | 'computer';
  readonly kid?: KidId;
  readonly seatIndex: number;
  readonly colours: SeatColours;
  readonly switchPosition: SwitchPosition;
  readonly keys: string;
  /** Who this seat rides in the look, as the card says it: "Rides Lancer", "Skates as Juniper". */
  readonly rides: string;
}

export interface PrematchOptions {
  readonly host: HTMLElement;
  readonly look: LookId;
  readonly seats: readonly PrematchSeat[];
  /** Each seat's rider close-up (rider-portrait.ts), in seat order; left out where there is no GL. */
  readonly portraits?: readonly HTMLCanvasElement[];
  readonly onReady?: () => void;
  readonly onBack?: () => void;
}

export interface PrematchScreen {
  setCount(n: number | null): void;
  dispose(): void;
}

const LOOK_NAMES: Readonly<Record<LookId, string>> = {
  neon: 'Neon Grid',
  trains: 'Toy Trains',
  mummy: "Mummy's Wrap",
  ice: 'Ice Trail',
};

const STYLE = /* css */ `
.tb-prematch {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: center;
  justify-items: center;
  padding: clamp(16px, 3vh, 32px) clamp(16px, 4vw, 48px);
  box-sizing: border-box;
  background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(12, 18, 32, 0.4), rgba(12, 18, 32, 0.85));
  z-index: 4;
}

.tb-prematch-header {
  padding: 12px 24px;
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}

.tb-prematch-look {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(20px, 3vh, 28px);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tb-prematch-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 3.5vw, 48px);
  flex-wrap: wrap;
}

.tb-seat-card {
  width: clamp(230px, 22vw, 320px);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 12px 12px clamp(16px, 2.2vh, 22px);
  text-align: center;
  border-top: 0;
}

/* The rider close-up: a well lit from below in the seat's colour, the figure standing in it. */
.tb-seat-ride {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 60% 38% at 50% 78%, color-mix(in srgb, var(--seat) 30%, transparent), transparent 72%),
    var(--tb-well);
}

.tb-seat-ride canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.tb-seat-who {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.tb-seat-rides {
  display: block;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--tb-muted);
}

.tb-seat-card::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 6px;
  background: var(--seat);
}

.tb-seat-portrait {
  width: clamp(48px, 4.4vw, 64px);
  display: grid;
  place-items: center;
}

.tb-seat-portrait svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
}

.tb-seat-name {
  font-size: clamp(18px, 2.4vh, 24px);
  font-weight: 800;
  margin: 0;
}

.tb-seat-meta {
  display: grid;
  gap: 4px;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--tb-muted);
}

.tb-swatch-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tb-colour-pip {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--seat);
  box-shadow: 0 0 0 1px var(--tb-border);
}

.tb-trail-swatch {
  width: 60px;
  height: 14px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.25);
  display: block;
}

.tb-seat-keys {
  font-weight: 700;
  color: var(--tb-text);
  margin-top: 2px;
}

.tb-prematch-foot {
  padding: 16px 28px;
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.tb-prompt-text {
  font-size: clamp(16px, 2.2vh, 22px);
  font-weight: 700;
}

.tb-countdown {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(52px, 9vh, 96px);
  font-weight: 800;
  line-height: 1;
  color: var(--tb-seat-1);
  text-shadow: 0 0 24px rgba(56, 168, 255, 0.6);
  animation: tb-count-pop 400ms cubic-bezier(0.2, 1.4, 0.4, 1);
}

@keyframes tb-count-pop {
  from { transform: scale(0.6); opacity: 0.3; }
  to { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .tb-countdown { animation: none; }
}
`;

function trailPatternSvg(look: LookId, colours: SeatColours): string {
  switch (look) {
    case 'neon':
      return (
        `<svg class="tb-trail-swatch" viewBox="0 0 60 14" aria-hidden="true">` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="${colours.main}" stroke-width="6" stroke-linecap="round" opacity="0.5"/>` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="${colours.main}" stroke-width="3" stroke-linecap="round"/>` +
        `</svg>`
      );
    case 'trains':
      return (
        `<svg class="tb-trail-swatch" viewBox="0 0 60 14" aria-hidden="true">` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="${colours.deep}" stroke-width="6" stroke-linecap="round"/>` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="${colours.main}" stroke-width="2" stroke-dasharray="3 3"/>` +
        `</svg>`
      );
    case 'mummy':
      return (
        `<svg class="tb-trail-swatch" viewBox="0 0 60 14" aria-hidden="true">` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="${colours.main}" stroke-width="6" stroke-linecap="round"/>` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="#efe3c8" stroke-width="4" stroke-linecap="round"/>` +
        `</svg>`
      );
    case 'ice':
      return (
        `<svg class="tb-trail-swatch" viewBox="0 0 60 14" aria-hidden="true">` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="${colours.deep}" stroke-width="6" stroke-linecap="round"/>` +
        `<line x1="2" y1="7" x2="58" y2="7" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
        `</svg>`
      );
  }
}

function humanAvatarSvg(seatIndex: number, colours: SeatColours): string {
  return (
    `<svg viewBox="0 0 100 100" width="100" height="100" aria-label="Player ${seatIndex + 1}">` +
    `<rect width="100" height="100" fill="#202a3a" rx="4"/>` +
    `<circle cx="50" cy="40" r="18" fill="${colours.main}"/>` +
    `<path d="M 24 86 C 24 64 36 58 50 58 C 64 58 76 64 76 86 Z" fill="${colours.main}"/>` +
    `</svg>`
  );
}

function seatPortraitHtml(seat: PrematchSeat): string {
  if (seat.role === 'kid' && seat.kid) {
    const kid = kidById(seat.kid);
    return kidPortraitSvg(kid, {
      expression: 'photo',
      idPrefix: `tb-prematch-${kid.id}`,
    });
  }
  if (seat.role === 'computer') {
    return computerPortraitSvg();
  }
  return humanAvatarSvg(seat.seatIndex, seat.colours);
}

export function createPrematchScreen(options: PrematchOptions): PrematchScreen {
  ensureScreenStyle(options.host);

  const root = document.createElement('section');
  root.className = 'tb-screen tb-prematch';
  root.setAttribute('aria-label', 'Pre-match lineup');

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.prepend(style);

  const cardsHtml = options.seats
    .map((seat) => {
      const portraitHtml = seatPortraitHtml(seat);
      const patternSvg = trailPatternSvg(options.look, seat.colours);

      return (
        `<div class="tb-card tb-seat-card" style="--seat: ${seat.colours.main}">` +
        `<div class="tb-seat-ride"></div>` +
        `<div class="tb-seat-who">` +
        `<div class="tb-seat-portrait">${portraitHtml}</div>` +
        `<div><h3 class="tb-seat-name">${escapeText(seat.name)}</h3>` +
        `<span class="tb-seat-rides">${escapeText(seat.rides)}</span></div>` +
        `</div>` +
        `<div class="tb-seat-meta">` +
        `<div class="tb-swatch-line">` +
        `<span class="tb-colour-pip" aria-hidden="true"></span>` +
        patternSvg +
        `</div>` +
        `<span>Switch ${seat.switchPosition}</span>` +
        `<span class="tb-seat-keys">${escapeText(seat.keys)}</span>` +
        `</div>` +
        `</div>`
      );
    })
    .join('');

  root.innerHTML =
    `<div class="tb-card tb-prematch-header">` +
    `<span class="tb-label">Arena look</span>` +
    `<span class="tb-prematch-look">${escapeText(LOOK_NAMES[options.look])}</span>` +
    `</div>` +
    `<div class="tb-prematch-cards">${cardsHtml}</div>` +
    `<div class="tb-card tb-prematch-foot"></div>`;
  root.prepend(style);
  root.querySelectorAll('.tb-seat-ride').forEach((well, seat) => {
    const portrait = options.portraits?.[seat];
    if (portrait) well.append(portrait);
  });
  const foot = root.querySelector('.tb-prematch-foot');

  /** Only the foot changes as the count runs, so the riders keep riding in their cards. */
  function showCount(count: number | null): void {
    if (!foot) return;
    foot.innerHTML =
      count !== null
        ? `<div class="tb-countdown">${String(count)}</div>`
        : `<p class="tb-prompt-text">Press Enter or Space to ride</p>`;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      options.onReady?.();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onBack?.();
      return;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  showCount(null);
  options.host.append(root);

  return {
    setCount(n: number | null) {
      showCount(n);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
