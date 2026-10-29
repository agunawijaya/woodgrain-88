/**
 * Trailblaze in-match HUD: score tallies top centre in seat colours with
 * shape marks (circle, diamond, square, triangle), 5-pip speed indicator,
 * queued turn arrows, pause button with Esc hint, and transient announcements.
 */
import type { Appearance } from '@woodgrain-88/kit';
import type { Heading, Match } from '../engine/types.ts';
import type { SeatColours } from '../look/look.ts';
import { DISPLAY_FONT, ensureScreenStyle, LEGIBLE_FONT } from '../screens/style.ts';

export interface HudSeatInfo {
  readonly name: string;
  readonly colours: SeatColours;
  readonly isHuman?: boolean;
}

export interface HudOptions {
  readonly host: HTMLElement;
  readonly seats: readonly HudSeatInfo[];
  readonly appearance?: Appearance;
}

export type MessageTone = 'plain' | 'alert' | 'joy';

export interface Hud {
  update(matchOrScores: Readonly<Match> | readonly number[]): void;
  setQueuedTurn(seat: number, heading: Heading | null): void;
  setSpeedStage(stage: number): void;
  say(text: string, tone?: MessageTone, seat?: number): void;
  point(seat: number, score: number): void;
  trap(seat: number): void;
  win(seat: number | null): void;
  setAppearance(appearance: Appearance): void;
  setColours(colours: readonly SeatColours[]): void;
  dispose(): void;
}

const MESSAGE_SECONDS = 2.4;

const HEADING_ARROWS: Readonly<Record<Heading, string>> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  'up-left': '↖',
  'up-right': '↗',
  'down-left': '↙',
  'down-right': '↘',
};

const SHAPES: readonly string[] = [
  // Seat 0: Circle
  '<svg class="tb-shape-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="currentColor"/></svg>',
  // Seat 1: Diamond
  '<svg class="tb-shape-icon" viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,2 14,8 8,14 2,8" fill="currentColor"/></svg>',
  // Seat 2: Square
  '<svg class="tb-shape-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill="currentColor" rx="1"/></svg>',
  // Seat 3: Triangle
  '<svg class="tb-shape-icon" viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,2 14,13 2,13" fill="currentColor"/></svg>',
];

const STYLE = /* css */ `
.tb-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  font-family: ${LEGIBLE_FONT};
  color: #ffffff;
}

.tb-hud > * {
  pointer-events: auto;
}

.tb-hud-centre {
  position: absolute;
  top: clamp(10px, 2vh, 18px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 18px 8px;
  border-radius: 10px;
  background: rgba(12, 18, 32, 0.88);
  border: 1px solid rgba(159, 176, 200, 0.2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
}

.tb-tallies {
  display: flex;
  align-items: center;
  gap: clamp(12px, 2vw, 24px);
}

.tb-tally {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--seat);
  font-family: ${DISPLAY_FONT};
  font-size: clamp(28px, 4.8vh, 44px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.tb-shape-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.tb-queued-arrow {
  display: inline-block;
  font-family: ${LEGIBLE_FONT};
  font-size: 16px;
  font-weight: 800;
  color: var(--seat);
  min-width: 16px;
  text-align: center;
}

.tb-queued-arrow:empty {
  visibility: hidden;
}

.tb-hud-divider {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(22px, 3.6vh, 32px);
  color: rgba(255, 255, 255, 0.4);
  line-height: 1;
}

/* Speed indicator */
.tb-speed-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tb-speed-pip {
  width: 16px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  transition: background 120ms ease;
}

.tb-speed-pip.is-filled {
  background: var(--tb-seat-1);
  box-shadow: 0 0 6px rgba(56, 168, 255, 0.6);
}

/* Announcements */
.tb-hud-message {
  position: absolute;
  left: 50%;
  bottom: clamp(20px, 4vh, 36px);
  transform: translateX(-50%) translateY(10px);
  max-width: min(90vw, 640px);
  padding: 0.5em 1.2em;
  border-radius: 999px;
  background: rgba(12, 18, 32, 0.92);
  border: 1px solid rgba(159, 176, 200, 0.25);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
  font-weight: 700;
  font-size: clamp(15px, 2vh, 19px);
  color: #ffffff;
  opacity: 0;
  transition: opacity 200ms ease, transform 200ms ease;
  pointer-events: none;
}

.tb-hud-message.is-shown {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.tb-hud-message[data-tone='alert'] {
  color: #ff5252;
}

.tb-hud-message[data-tone='joy'] {
  color: #69f0ae;
}

@media (prefers-reduced-motion: reduce) {
  .tb-hud-message { transition: none; }
}
`;

export function createHud(options: HudOptions): Hud {
  ensureScreenStyle(options.host);

  const root = document.createElement('div');
  root.className = 'tb-hud';
  root.dataset.appearance = options.appearance ?? 'dark';

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  // Pause button top right

  // Centre block
  const centre = document.createElement('div');
  centre.className = 'tb-hud-centre';

  const talliesWrap = document.createElement('div');
  talliesWrap.className = 'tb-tallies';

  const seatCount = Math.max(options.seats.length, 2);
  const scores = new Array<number>(seatCount).fill(0);
  const queuedTurns = new Array<Heading | null>(seatCount).fill(null);
  let speedStage = 0; // 0..4

  const tallyElements: {
    container: HTMLElement;
    value: HTMLElement;
    arrow: HTMLElement;
  }[] = [];

  for (let i = 0; i < seatCount; i++) {
    const seatInfo = options.seats[i] ?? {
      name: `Rider ${i + 1}`,
      colours: { main: i === 0 ? '#ff8a2a' : '#38a8ff', deep: '#b4501b' },
    };

    if (i > 0) {
      const divider = document.createElement('span');
      divider.className = 'tb-hud-divider';
      divider.textContent = '·';
      divider.setAttribute('aria-hidden', 'true');
      talliesWrap.append(divider);
    }

    const tally = document.createElement('div');
    tally.className = 'tb-tally';
    tally.style.setProperty('--seat', seatInfo.colours.main);

    const shape = document.createElement('span');
    shape.innerHTML = SHAPES[i % SHAPES.length] ?? '';

    const value = document.createElement('span');
    value.className = 'tb-score-num';
    value.textContent = '0';

    const arrow = document.createElement('span');
    arrow.className = 'tb-queued-arrow';
    arrow.setAttribute('aria-hidden', 'true');

    tally.append(shape, value, arrow);
    talliesWrap.append(tally);

    tallyElements.push({ container: tally, value, arrow });
  }

  // Speed indicator: five pips
  const speedIndicator = document.createElement('div');
  speedIndicator.className = 'tb-speed-indicator';
  speedIndicator.setAttribute('role', 'status');
  speedIndicator.setAttribute('aria-label', 'Speed 1 of 5');

  const pips: HTMLElement[] = [];
  for (let p = 0; p < 5; p++) {
    const pip = document.createElement('div');
    pip.className = 'tb-speed-pip' + (p === 0 ? ' is-filled' : '');
    speedIndicator.append(pip);
    pips.push(pip);
  }

  centre.append(talliesWrap, speedIndicator);
  root.append(centre);

  // Message toast
  const messageToast = document.createElement('div');
  messageToast.className = 'tb-hud-message';
  root.append(messageToast);

  // Screen reader announcer
  const announcer = document.createElement('p');
  announcer.setAttribute('role', 'status');
  announcer.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
  root.append(announcer);

  options.host.append(root);

  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  function renderSpeed(): void {
    const filledCount = Math.max(1, Math.min(5, speedStage + 1));
    speedIndicator.setAttribute('aria-label', `Speed ${filledCount} of 5`);
    pips.forEach((pip, idx) => {
      pip.classList.toggle('is-filled', idx < filledCount);
    });
  }

  function renderScores(): void {
    tallyElements.forEach((el, idx) => {
      const score = scores[idx] ?? 0;
      el.value.textContent = String(score);
    });
  }

  function renderQueued(): void {
    tallyElements.forEach((el, idx) => {
      const turn = queuedTurns[idx];
      el.arrow.textContent = turn ? HEADING_ARROWS[turn] : '';
    });
  }

  return {
    update(matchOrScores) {
      if ('riders' in matchOrScores) {
        matchOrScores.riders.forEach((rider, idx) => {
          scores[idx] = rider.score;
          queuedTurns[idx] = rider.latched;
        });
      } else {
        matchOrScores.forEach((s: number, idx: number) => {
          scores[idx] = s;
        });
      }
      renderScores();
      renderQueued();
    },
    setQueuedTurn(seat, heading) {
      queuedTurns[seat] = heading;
      renderQueued();
    },
    setSpeedStage(stage) {
      speedStage = stage;
      renderSpeed();
    },
    say(text, tone = 'plain', seat) {
      messageToast.textContent = text;
      messageToast.dataset.tone = tone;
      if (seat !== undefined && options.seats[seat]) {
        messageToast.style.borderColor = options.seats[seat].colours.main;
      } else {
        messageToast.style.borderColor = '';
      }
      messageToast.classList.add('is-shown');
      announcer.textContent = text;
      if (messageTimer !== null) clearTimeout(messageTimer);
      messageTimer = setTimeout(() => {
        messageToast.classList.remove('is-shown');
      }, MESSAGE_SECONDS * 1000);
    },
    point(seat, score) {
      scores[seat] = score;
      renderScores();
      const seatInfo = options.seats[seat];
      const name = seatInfo?.name ?? `Rider ${seat + 1}`;
      this.say(`${name} scores!`, 'plain', seat);
    },
    trap(seat) {
      const seatInfo = options.seats[seat];
      const name = seatInfo?.name ?? `Rider ${seat + 1}`;
      this.say(`${name} is boxed in!`, 'alert', seat);
    },
    win(seat) {
      if (seat === null) {
        this.say('A draw!', 'joy');
      } else {
        const seatInfo = options.seats[seat];
        const name = seatInfo?.name ?? `Rider ${seat + 1}`;
        this.say(`${name} wins!`, 'joy', seat);
      }
    },
    setAppearance(appearance) {
      root.dataset.appearance = appearance;
    },
    setColours(colours) {
      tallyElements.forEach((el, idx) => {
        const col = colours[idx];
        if (col) {
          el.container.style.setProperty('--seat', col.main);
        }
      });
    },
    dispose() {
      if (messageTimer !== null) clearTimeout(messageTimer);
      root.remove();
    },
  };
}
