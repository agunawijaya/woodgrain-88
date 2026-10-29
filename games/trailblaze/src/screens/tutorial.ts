/**
 * How to play tutorial: six cards stepping through Trailblaze mechanics
 * (continuous movement, steering rules, wall trails, boxing in, speed climbing,
 * and gaps/wraparound) with looping inline SVG animations.
 */
import { ensureScreenStyle, escapeText, DISPLAY_FONT } from './style.ts';

export interface TutorialOptions {
  readonly host: HTMLElement;
  readonly onDone: () => void;
}

export interface TutorialScreen {
  dispose(): void;
}

interface CardDef {
  readonly title: string;
  readonly copy: string;
  readonly svg: string;
}

const CARDS: readonly CardDef[] = [
  {
    title: 'Constant Motion',
    copy: 'You never stop. Your rider keeps going; you only choose where it turns.',
    svg:
      `<svg class="tb-tutorial-art" viewBox="0 0 200 100" aria-hidden="true">` +
      `<rect width="200" height="100" fill="#0c1220" rx="6"/>` +
      `<line x1="20" y1="50" x2="180" y2="50" stroke="#ff8a2a" stroke-width="6" stroke-linecap="round" stroke-dasharray="160" class="tb-anim-dash"/>` +
      `<circle cx="180" cy="50" r="7" fill="#ffffff" stroke="#ff8a2a" stroke-width="3" class="tb-anim-head"/>` +
      `</svg>`,
  },
  {
    title: 'Steering',
    copy: 'Steer with WASD or the arrows. You cannot turn straight back on yourself.',
    svg:
      `<svg class="tb-tutorial-art" viewBox="0 0 200 100" aria-hidden="true">` +
      `<rect width="200" height="100" fill="#0c1220" rx="6"/>` +
      `<path d="M 30 70 L 90 70 L 90 30" fill="none" stroke="#38a8ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="90" cy="30" r="6" fill="#ffffff"/>` +
      `<path d="M 120 70 L 170 70 L 170 70" fill="none" stroke="#ff5964" stroke-width="6" stroke-linecap="round"/>` +
      `<line x1="140" y1="55" x2="165" y2="85" stroke="#ff5964" stroke-width="4" stroke-linecap="round"/>` +
      `<line x1="165" y1="55" x2="140" y2="85" stroke="#ff5964" stroke-width="4" stroke-linecap="round"/>` +
      `</svg>`,
  },
  {
    title: 'Trails Become Walls',
    copy: 'Every cell you leave becomes a wall. Ride into any wall and your rival scores.',
    svg:
      `<svg class="tb-tutorial-art" viewBox="0 0 200 100" aria-hidden="true">` +
      `<rect width="200" height="100" fill="#0c1220" rx="6"/>` +
      `<line x1="100" y1="20" x2="100" y2="80" stroke="#ff8a2a" stroke-width="8" stroke-linecap="round"/>` +
      `<line x1="40" y1="50" x2="94" y2="50" stroke="#38a8ff" stroke-width="6" stroke-linecap="round"/>` +
      `<polygon points="96,44 104,40 100,50 106,56 98,56 96,62 94,54 88,52" fill="#ffd166" class="tb-anim-flash"/>` +
      `</svg>`,
  },
  {
    title: 'Boxing In',
    copy: 'Box your rival in: close the gap and they have nowhere left to go.',
    svg:
      `<svg class="tb-tutorial-art" viewBox="0 0 200 100" aria-hidden="true">` +
      `<rect width="200" height="100" fill="#0c1220" rx="6"/>` +
      `<rect x="40" y="25" width="120" height="50" fill="none" stroke="#38a8ff" stroke-width="6" rx="4" class="tb-anim-box"/>` +
      `<path d="M 60 45 L 80 45 L 80 55 L 70 55" fill="none" stroke="#ff8a2a" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="70" cy="55" r="4" fill="#ffffff"/>` +
      `</svg>`,
  },
  {
    title: 'Speed-Up',
    copy: 'On speed-up channels the pace climbs every five seconds.',
    svg:
      `<svg class="tb-tutorial-art" viewBox="0 0 200 100" aria-hidden="true">` +
      `<rect width="200" height="100" fill="#0c1220" rx="6"/>` +
      `<rect x="30" y="65" width="22" height="15" fill="#38a8ff" rx="2" class="tb-anim-bar-1"/>` +
      `<rect x="60" y="55" width="22" height="25" fill="#38a8ff" rx="2" class="tb-anim-bar-2"/>` +
      `<rect x="90" y="45" width="22" height="35" fill="#38a8ff" rx="2" class="tb-anim-bar-3"/>` +
      `<rect x="120" y="35" width="22" height="45" fill="#38a8ff" rx="2" class="tb-anim-bar-4"/>` +
      `<rect x="150" y="25" width="22" height="55" fill="#38a8ff" rx="2" class="tb-anim-bar-5"/>` +
      `</svg>`,
  },
  {
    title: 'Gaps & Wraparound',
    copy: 'Gaps: hold fire to leave holes. Wraparound: ride off one edge and in at the other.',
    svg:
      `<svg class="tb-tutorial-art" viewBox="0 0 200 100" aria-hidden="true">` +
      `<rect width="200" height="100" fill="#0c1220" rx="6"/>` +
      `<line x1="20" y1="35" x2="180" y2="35" stroke="#ff8a2a" stroke-width="6" stroke-linecap="round" stroke-dasharray="14 12"/>` +
      `<path d="M 160 65 L 195 65" stroke="#38a8ff" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M 5 65 L 45 65" stroke="#38a8ff" stroke-width="5" stroke-linecap="round"/>` +
      `<polyline points="40 60 46 65 40 70" fill="none" stroke="#38a8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`,
  },
];

const STYLE = /* css */ `
.tb-tutorial {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(10, 16, 28, 0.7);
  z-index: 5;
}

.tb-tutorial-card {
  width: min(540px, 92vw);
  padding: clamp(20px, 3vh, 32px);
  display: grid;
  gap: 16px;
  text-align: center;
}

.tb-tutorial-art {
  width: 100%;
  max-width: 320px;
  height: auto;
  margin: 0 auto;
  display: block;
}

.tb-tutorial-title {
  margin: 0;
  font-family: ${DISPLAY_FONT};
  font-size: clamp(24px, 3.8vh, 34px);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tb-tutorial-copy {
  margin: 0;
  font-size: clamp(15px, 2.1vh, 18px);
  line-height: 1.45;
  color: var(--tb-text);
}

.tb-tutorial-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.tb-tutorial-dots {
  display: flex;
  gap: 8px;
}

.tb-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tb-border);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.tb-dot.is-active {
  background: var(--tb-seat-1);
  box-shadow: 0 0 6px rgba(56, 168, 255, 0.5);
}

.tb-tutorial-nav {
  display: flex;
  gap: 8px;
}

/* Animations */
@keyframes tb-dash-flow {
  from { stroke-dashoffset: 160; }
  to { stroke-dashoffset: 0; }
}

@keyframes tb-pulse-flash {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes tb-bar-step {
  0%, 10% { opacity: 0.3; }
  20%, 90% { opacity: 1; }
  100% { opacity: 0.3; }
}

.tb-anim-dash {
  animation: tb-dash-flow 1.8s linear infinite;
}

.tb-anim-flash {
  transform-origin: 96px 50px;
  animation: tb-pulse-flash 0.8s ease-in-out infinite;
}

.tb-anim-bar-1 { animation: tb-bar-step 2.5s infinite 0.1s; }
.tb-anim-bar-2 { animation: tb-bar-step 2.5s infinite 0.3s; }
.tb-anim-bar-3 { animation: tb-bar-step 2.5s infinite 0.5s; }
.tb-anim-bar-4 { animation: tb-bar-step 2.5s infinite 0.7s; }
.tb-anim-bar-5 { animation: tb-bar-step 2.5s infinite 0.9s; }

@media (prefers-reduced-motion: reduce) {
  .tb-anim-dash, .tb-anim-flash,
  .tb-anim-bar-1, .tb-anim-bar-2, .tb-anim-bar-3, .tb-anim-bar-4, .tb-anim-bar-5 {
    animation: none !important;
  }
}
`;

export function createTutorialScreen(options: TutorialOptions): TutorialScreen {
  ensureScreenStyle(options.host);

  const root = document.createElement('section');
  root.className = 'tb-screen tb-tutorial';
  root.setAttribute('aria-label', 'How to play Trailblaze');

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.prepend(style);

  let currentIndex = 0;

  function render(): void {
    const fallback = CARDS[0];
    if (!fallback) throw new Error('No tutorial cards');
    const card: CardDef = CARDS[currentIndex] ?? fallback;
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === CARDS.length - 1;

    const dotsHtml = CARDS.map((_, idx) => {
      return `<span class="tb-dot${idx === currentIndex ? ' is-active' : ''}" aria-hidden="true"></span>`;
    }).join('');

    const nextBtnText = isLast ? 'Done' : 'Next';

    root.innerHTML =
      `<div class="tb-card tb-tutorial-card">` +
      card.svg +
      `<h2 class="tb-tutorial-title">${escapeText(card.title)}</h2>` +
      `<p class="tb-tutorial-copy">${escapeText(card.copy)}</p>` +
      `<div class="tb-tutorial-foot">` +
      `<button type="button" class="tb-link" data-action="skip">Skip</button>` +
      `<div class="tb-tutorial-dots" aria-label="Step ${currentIndex + 1} of ${CARDS.length}">${dotsHtml}</div>` +
      `<div class="tb-tutorial-nav">` +
      `<button type="button" class="tb-button" data-action="prev"${isFirst ? ' disabled' : ''}>` +
      `<span>Back</span><span class="tb-key" aria-hidden="true">←</span></button>` +
      `<button type="button" class="tb-button is-primary" data-action="next">` +
      `<span>${nextBtnText}</span><span class="tb-key" aria-hidden="true">→</span></button>` +
      `</div></div></div>`;

    root.prepend(style);
    root.querySelector<HTMLButtonElement>('[data-action="next"]')?.focus({ preventScroll: true });
  }

  function advance(delta: -1 | 1): void {
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0) return;
    if (nextIndex >= CARDS.length) {
      options.onDone();
      return;
    }
    currentIndex = nextIndex;
    render();
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-action="prev"]')) {
      advance(-1);
      return;
    }
    if (target.closest('[data-action="next"]')) {
      advance(1);
      return;
    }
    if (target.closest('[data-action="skip"]')) {
      options.onDone();
      return;
    }
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      advance(-1);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'Enter') {
      event.preventDefault();
      advance(1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onDone();
      return;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  render();
  options.host.append(root);

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
