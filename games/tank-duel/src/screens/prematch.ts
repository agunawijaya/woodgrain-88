/**
 * Pre-match commanders' cards screen: both combatants face each other over
 * the live table. Human players press fire to declare ready; Kids ready up
 * after a brief delay. When both are set, the match is released.
 */
import {
  kidById,
  kidPortraitSvg,
  type GameLoop,
  type InputController,
  type KidId,
  type LoopOptions,
  type Seat,
} from '@woodgrain-88/kit';
import type { ChannelRules } from '../engine/types.ts';
import type { HudSeat } from '../ui/hud.ts';
import { escapeText } from './style.ts';

export interface PrematchOptions {
  readonly host: HTMLElement;
  readonly channel: ChannelRules;
  readonly commanders: readonly [HudSeat, HudSeat];
  readonly kids: readonly [KidId | null, KidId | null];
  /** A challenge link's score to beat, shown under the channel. */
  readonly challengeScore?: number;
  readonly input: InputController;
  readonly createLoop: (options: LoopOptions) => GameLoop;
  /** Which seats are people (they press fire); the rest are ready on their own. */
  readonly humans: readonly [boolean, boolean];
  readonly onReady: () => void;
  readonly onBack: () => void;
}

export interface PrematchScreen {
  dispose(): void;
}

const STYLE = /* css */ `
.td-prematch {
  position: absolute;
  /* Starts under the score plates, which already say who is playing. */
  inset: max(56px, 9vh) 0 0 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: center;
  justify-items: center;
  padding: clamp(20px, 3vh, 40px) clamp(20px, 4vw, 48px) clamp(16px, 3vh, 32px);
  box-sizing: border-box;
  /* The live table stays in view, dimmed, so the cards read as the thing to look at. */
  background: radial-gradient(ellipse 70% 60% at 50% 55%, rgba(20, 14, 8, 0.28), rgba(20, 14, 8, 0.6));
}
.td-prematch-header {
  display: grid;
  justify-items: center;
  gap: 6px;
  text-align: center;
}
.td-prematch-header .td-band {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 4px;
  background: var(--td-mustard);
  color: #22160a;
  font-size: clamp(18px, 2.6vh, 26px);
  letter-spacing: 0.08em;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.td-prematch-header .td-origin {
  margin: 0;
  font-size: clamp(14px, 1.8vh, 17px);
  color: var(--td-cream);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.td-prematch-header .td-challenge {
  margin: 0;
  font-weight: 700;
  font-size: clamp(15px, 2vh, 19px);
  color: var(--td-mustard);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
.td-prematch-arena {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 3vw, 48px);
  width: 100%;
  max-width: 900px;
}
.td-prematch-card {
  flex: 1;
  max-width: 360px;
  min-height: clamp(280px, 46vh, 380px);
  padding: clamp(16px, 2.4vh, 24px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  box-sizing: border-box;
}
.td-prematch-card[data-side='0'] {
  border-top: 6px solid var(--td-team-0);
}
.td-prematch-card[data-side='1'] {
  border-top: 6px solid var(--td-team-1);
}
.td-prematch-vs {
  font-size: clamp(40px, 8vh, 76px);
  color: var(--td-cream);
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.6);
  user-select: none;
}
.td-card-portrait {
  min-height: 140px;
  display: grid;
  place-items: center;
}
.td-commander-name {
  margin: 0;
  font-size: clamp(22px, 3.4vh, 32px);
  letter-spacing: 0.05em;
  color: var(--td-plate-ink);
}
.td-commander-note {
  margin: 0;
  font-size: clamp(12px, 1.6vh, 15px);
  opacity: 0.85;
}
.td-commander-style {
  margin: 0;
  font-size: clamp(12px, 1.5vh, 14px);
  font-style: italic;
  opacity: 0.8;
}
.td-ready-prompt {
  margin-top: auto;
  font-size: clamp(13px, 1.7vh, 16px);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--td-plate-ink);
}
.td-ready-stamp {
  margin-top: auto;
  border: 4px solid var(--td-rust);
  color: var(--td-rust);
  font-family:
    'Big Shoulders Display Variable', 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  font-weight: 800;
  font-size: clamp(26px, 4vh, 38px);
  letter-spacing: 0.16em;
  padding: 4px 20px;
  border-radius: 6px;
  transform: rotate(-8deg);
  animation: td-stamp-down 160ms cubic-bezier(0.17, 0.89, 0.32, 1.28);
  box-shadow: inset 0 0 0 2px var(--td-rust);
  user-select: none;
}
@keyframes td-stamp-down {
  from { transform: rotate(-8deg) scale(2.2); opacity: 0; }
  to { transform: rotate(-8deg) scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .td-ready-stamp { animation: none; }
}
.td-prematch-footer {
  width: 100%;
  max-width: 900px;
  display: flex;
  justify-content: flex-start;
}
.td-prematch-back {
  margin: 0;
  color: var(--td-cream);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`;

function bandText(channel: ChannelRules): string {
  return `CH ${String(channel.number).padStart(2, '0')} · ${channel.title}`;
}

function originText(channel: ChannelRules): string {
  if (channel.originalGame !== null) {
    return `Game ${channel.originalGame} of the 1977 cartridge`;
  }
  return 'Remix channel';
}

function dogTagSvg(teamColor: string, idPrefix: string): string {
  return (
    `<svg viewBox="0 0 100 130" width="100" height="130" class="td-dogtag" aria-hidden="true">` +
    `<defs>` +
    `<filter id="${idPrefix}-emboss" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="1" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.4"/>` +
    `<feDropShadow dx="0" dy="-1" stdDeviation="0.5" flood-color="#000000" flood-opacity="0.5"/>` +
    `</filter>` +
    `</defs>` +
    `<rect x="12" y="8" width="76" height="114" rx="20" fill="#d9c296" stroke="#9e875e" stroke-width="2"/>` +
    `<rect x="16" y="12" width="68" height="106" rx="16" fill="none" stroke="#bda376" ` +
    `stroke-width="1.5" stroke-dasharray="3 2"/>` +
    `<circle cx="50" cy="22" r="4.5" fill="#1f170f" stroke="#8a734b" stroke-width="1.5"/>` +
    `<g transform="translate(23, 44) scale(2.2)" fill="${teamColor}">` +
    `<rect x="1" y="14" width="22" height="6" rx="2"/>` +
    `<circle cx="4" cy="17" r="1.5" fill="#1f170f"/>` +
    `<circle cx="9" cy="17" r="1.5" fill="#1f170f"/>` +
    `<circle cx="14" cy="17" r="1.5" fill="#1f170f"/>` +
    `<circle cx="19" cy="17" r="1.5" fill="#1f170f"/>` +
    `<rect x="3" y="9" width="18" height="5" rx="1"/>` +
    `<rect x="6" y="4" width="9" height="5" rx="1"/>` +
    `<rect x="15" y="6" width="9" height="2" rx="0.5"/>` +
    `</g>` +
    `</svg>`
  );
}

function cardPortraitMarkup(kidId: KidId | null, side: number): string {
  if (kidId !== null) {
    const kid = kidById(kidId);
    return (
      `<div class="td-card-portrait td-photo" style="--tilt: 0deg; cursor: default;">` +
      kidPortraitSvg(kid, { expression: 'photo', idPrefix: `td-pre-${kid.id}` }) +
      `<span class="td-hand">${escapeText(kid.name)}</span>` +
      `</div>` +
      `<p class="td-commander-style">${escapeText(kid.style)}</p>`
    );
  }
  const teamColor = side === 0 ? 'var(--td-team-0)' : 'var(--td-team-1)';
  return `<div class="td-card-portrait">${dogTagSvg(teamColor, `td-pre-tag-${side}`)}</div>`;
}

export function createPrematchScreen(options: PrematchOptions): PrematchScreen {
  const root = document.createElement('section');
  root.className = 'td-screen td-prematch';
  root.setAttribute('aria-label', 'Pre-match');

  const style = document.createElement('style');
  style.textContent = STYLE;

  const challengeMarkup =
    options.challengeScore !== undefined
      ? `<p class="td-challenge">Challenge: beat ${options.challengeScore} hits</p>`
      : '';

  // Two people on one keyboard: player 1 has the arrows and Enter, player 2 WASD and Space. Alone,
  // either fire key works and Space is the one to show.
  const sharedKeyboard = options.humans[0] && options.humans[1];
  const fireKey = (side: number): string => (side === 0 && sharedKeyboard ? 'Enter' : 'Space');
  const initialKeyHints = [
    options.humans[0] ? fireKey(0) : '',
    options.humans[1] ? fireKey(1) : '',
  ] as const;

  root.innerHTML =
    `<div class="td-scrim"></div>` +
    `<header class="td-prematch-header">` +
    `<span class="td-band td-display">${escapeText(bandText(options.channel))}</span>` +
    `<p class="td-origin">${escapeText(originText(options.channel))}</p>` +
    challengeMarkup +
    `</header>` +
    `<div class="td-prematch-arena td-cards" aria-live="polite">` +
    // Left card (seat 1, side 0)
    `<div class="td-prematch-card td-plate td-rivets" data-side="0">` +
    cardPortraitMarkup(options.kids[0], 0) +
    `<h2 class="td-display td-commander-name">${escapeText(options.commanders[0].name)}</h2>` +
    (options.commanders[0].note
      ? `<p class="td-commander-note">${escapeText(options.commanders[0].note)}</p>`
      : '') +
    (options.humans[0]
      ? `<div class="td-ready-prompt" data-side="0">Press fire when ready ` +
        `<span class="td-key" data-side="0">${initialKeyHints[0]}</span></div>`
      : '') +
    `<div class="td-ready-stamp" data-side="0" hidden>READY</div>` +
    `</div>` +
    `<div class="td-prematch-vs td-display" aria-hidden="true">VS</div>` +
    // Right card (seat 2, side 1)
    `<div class="td-prematch-card td-plate td-rivets" data-side="1">` +
    cardPortraitMarkup(options.kids[1], 1) +
    `<h2 class="td-display td-commander-name">${escapeText(options.commanders[1].name)}</h2>` +
    (options.commanders[1].note
      ? `<p class="td-commander-note">${escapeText(options.commanders[1].note)}</p>`
      : '') +
    (options.humans[1]
      ? `<div class="td-ready-prompt" data-side="1">Press fire when ready ` +
        `<span class="td-key" data-side="1">${initialKeyHints[1]}</span></div>`
      : '') +
    `<div class="td-ready-stamp" data-side="1" hidden>READY</div>` +
    `</div>` +
    `</div>` +
    `<div class="td-prematch-announcer sr-only" aria-live="polite" aria-atomic="true"></div>` +
    `<footer class="td-prematch-footer">` +
    `<button type="button" class="td-link td-prematch-back">← Back</button>` +
    `</footer>`;

  root.prepend(style);
  options.host.append(root);

  const stamps = [
    root.querySelector<HTMLElement>('.td-ready-stamp[data-side="0"]'),
    root.querySelector<HTMLElement>('.td-ready-stamp[data-side="1"]'),
  ] as const;

  const prompts = [
    root.querySelector<HTMLElement>('.td-ready-prompt[data-side="0"]'),
    root.querySelector<HTMLElement>('.td-ready-prompt[data-side="1"]'),
  ] as const;

  const keyElements = [
    root.querySelector<HTMLElement>('.td-key[data-side="0"]'),
    root.querySelector<HTMLElement>('.td-key[data-side="1"]'),
  ] as const;

  const announcer = root.querySelector<HTMLElement>('.td-prematch-announcer');
  const backButton = root.querySelector<HTMLButtonElement>('.td-prematch-back');

  backButton?.addEventListener('click', () => {
    options.onBack();
  });

  const readyState: [boolean, boolean] = [false, false];
  const seatReadyAt: [number, number] = [0, 0];
  let elapsedSeconds = 0;
  let readyDispatched = false;

  function markSeatReady(side: 0 | 1): void {
    if (readyState[side]) return;
    readyState[side] = true;
    seatReadyAt[side] = options.humans[side] ? elapsedSeconds : 0.9;

    const stamp = stamps[side];
    if (stamp) stamp.hidden = false;

    const prompt = prompts[side];
    if (prompt) prompt.hidden = true;

    const commander = options.commanders[side];
    if (announcer) {
      announcer.textContent = `${commander.name} is ready`;
    }
  }

  const loop = options.createLoop({
    update(dt) {
      elapsedSeconds += dt;
      const frame = options.input.poll();

      for (let side = 0; side < 2; side++) {
        const sideIndex = side as 0 | 1;
        const seatNum = (side + 1) as Seat;
        const seatFrame = frame.seats[seatNum];
        const isHuman = options.humans[sideIndex];

        if (isHuman) {
          const keyEl = keyElements[sideIndex];
          if (keyEl) {
            const nextHint = seatFrame.usingPad ? 'A / ✕' : fireKey(side);
            if (keyEl.textContent !== nextHint) {
              keyEl.textContent = nextHint;
            }
          }
          if (!readyState[sideIndex] && seatFrame.pressed.has('fire')) {
            markSeatReady(sideIndex);
          }
        } else {
          // Bot / Kid seats stamp themselves ready after ~0.9 seconds
          if (!readyState[sideIndex] && elapsedSeconds >= 0.9) {
            markSeatReady(sideIndex);
          }
        }
      }

      if (readyState[0] && readyState[1] && !readyDispatched) {
        const bothReadyAt = Math.max(seatReadyAt[0], seatReadyAt[1]);
        if (elapsedSeconds - bothReadyAt >= 0.5) {
          readyDispatched = true;
          options.onReady();
        }
      }
    },
  });

  loop.start();

  return {
    dispose() {
      loop.stop();
      root.remove();
    },
  };
}
