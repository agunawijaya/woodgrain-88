/**
 * The game menu, laid over the table while two Kids duel behind it: the
 * title plate and the channel on the cartridge-label band, the three ways to
 * play, the scoring rule, the difficulty switches as they stand, and the six
 * Kids' school photos to pick a rival from. The Hall's own chrome (Back to
 * the Hall, the channel dial) sits above it, so the panel starts below them.
 */
import {
  KIDS,
  kidById,
  kidPortraitSvg,
  type DifficultySwitches,
  type KidId,
} from '@woodgrain-88/kit';
import { CHANNEL_LINES } from '../copy/channel-lines.ts';
import type { ChannelRules, ScoringRule } from '../engine/types.ts';
import { escapeText } from './style.ts';

export type PlayMode = 'kid' | 'versus' | 'practice';

export interface MenuOptions {
  readonly host: HTMLElement;
  readonly channel: ChannelRules;
  readonly kid: KidId;
  readonly scoring: ScoringRule;
  readonly switches: DifficultySwitches;
  readonly onStart: (mode: PlayMode) => void;
  readonly onKid: (kid: KidId) => void;
  readonly onScoring: (rule: ScoringRule) => void;
  readonly onHowToPlay: () => void;
  readonly onSettings: () => void;
  readonly onRecords: () => void;
}

export interface MenuScreen {
  show(): void;
  hide(): void;
  setSwitches(switches: DifficultySwitches): void;
  dispose(): void;
}

const STYLE = /* css */ `
.td-menu { grid-template-columns: minmax(0, 1fr); }
.td-menu-panel {
  position: absolute;
  left: clamp(16px, 3vw, 56px);
  top: clamp(72px, 11vh, 120px);
  width: min(440px, 38vw);
  display: grid;
  gap: clamp(12px, 1.8vh, 20px);
}
.td-title {
  padding: clamp(14px, 2.2vh, 22px) clamp(18px, 2vw, 28px) clamp(12px, 1.8vh, 18px);
  display: grid;
  gap: 8px;
}
.td-title h1 {
  margin: 0;
  font-size: clamp(44px, 8.4vh, 96px);
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.28);
}
.td-title .td-band {
  justify-self: start;
  padding: 5px 12px 4px;
  border-radius: 4px;
  background: var(--td-mustard);
  color: #22160a;
  font-size: clamp(15px, 2vh, 20px);
  letter-spacing: 0.1em;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.td-title .td-origin { margin: 0; font-size: clamp(14px, 1.7vh, 16px); opacity: 0.88; }
.td-menu-card { padding: clamp(14px, 2vh, 20px); display: grid; gap: clamp(10px, 1.5vh, 16px); }
.td-menu-card .td-line { margin: 0; font-size: clamp(15px, 1.9vh, 18px); line-height: 1.4; }
.td-modes { display: grid; gap: 10px; }
.td-modes .td-button { justify-content: space-between; width: 100%; padding-inline: 1.1em; }
.td-modes .td-button small {
  font: 600 0.62em/1.2 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
  letter-spacing: 0.02em;
  text-transform: none;
  opacity: 0.85;
}
.td-modes .td-button span:first-child { display: grid; justify-items: start; gap: 2px; text-align: left; }
.td-rule { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.td-handicap { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.td-switches { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; font-size: clamp(14px, 1.7vh, 16px); }
.td-switches b { font-weight: 800; }
.td-help {
  appearance: none;
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid currentColor;
  background: none;
  color: var(--td-panel-ink);
  font: 800 15px/1 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
  cursor: pointer;
  opacity: 0.85;
}
.td-help[aria-expanded='true'] { background: var(--td-mustard); color: #22160a; border-color: #22160a; opacity: 1; }
.td-help:focus-visible { outline: 3px solid var(--td-focus); outline-offset: 2px; }
.td-help-text {
  /* Floats above the line, so opening it never pushes the menu off the screen. */
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  z-index: 5;
  width: min(420px, calc(100vw - 48px));
  margin: 0;
  padding: 14px 16px;
  border-left: 5px solid var(--td-mustard);
  font-size: clamp(14px, 1.7vh, 16px);
  line-height: 1.45;
}
.td-help-text p { margin: 0 0 0.5em; }
.td-help-text p:last-child { margin-bottom: 0; }
.td-links { display: flex; flex-wrap: wrap; gap: 0 18px; }
.td-rivals {
  position: absolute;
  right: clamp(16px, 3vw, 56px);
  bottom: clamp(16px, 4vh, 44px);
  display: grid;
  justify-items: end;
  gap: 18px;
  max-width: min(980px, 58vw);
}
.td-rivals .td-label { color: var(--td-cream); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7); }
.td-photos { display: flex; justify-content: flex-end; gap: clamp(6px, 0.8vw, 14px); }
.td-photos .td-photo { width: clamp(78px, 8.2vw, 128px); }
.td-rival-note { padding: 10px 14px; max-width: 420px; font-size: clamp(14px, 1.7vh, 16px); line-height: 1.4; }
.td-rival-note strong { font-size: 1.05em; }
.td-menu[data-hovered='versus'] .td-rivals { opacity: 0.55; }
@media (max-width: 760px) {
  .td-menu-panel { width: auto; right: 16px; }
  .td-rivals { position: static; margin: 0 16px 16px; max-width: none; justify-items: start; }
  .td-menu { overflow-y: auto; align-content: end; }
}
`;

/** The cartridge band's text: dial number and our channel title. */
function bandText(channel: ChannelRules): string {
  return `CH ${String(channel.number).padStart(2, '0')} · ${channel.title}`;
}

function originText(channel: ChannelRules): string {
  return channel.originalGame === null
    ? 'A Remix channel, new rules on the old table.'
    : `Game ${channel.originalGame} of the 27 on the 1977 cartridge.`;
}

/** A switch in words: A is a handicap, B none (the console's own letters stay in the help). */
function handicapText(position: 'A' | 'B'): string {
  return position === 'A' ? 'shorter shots' : 'none';
}

/** What a handicap is, why it is there, and where to set it, for anyone who wonders. */
const HANDICAP_HELP =
  `<p>A handicap evens out a match between players of different skill, like giving odds in chess. ` +
  `With a handicap, a player's shells fly only about five eighths as far, and their aircraft are ` +
  `slower, so they have to get closer to hit.</p>` +
  `<p>A parent playing a young child might take one. Against a Kid, give the Kid one to make it ` +
  `easier, or take one yourself for a challenge: patches you earn with your own handicap on are ` +
  `sewn in gold thread.</p>` +
  `<p>Both start with none. Set them on the console's Difficulty switches in the Den (or press ` +
  `[ and ] there), or from the pause menu during a match. On the console, as on the original, ` +
  `A means a handicap and B means none.</p>`;

/** A small tilt per photo, as if they were dropped on the table, the same every time. */
const PHOTO_TILTS = ['-3deg', '2deg', '-1.5deg', '3deg', '-2.5deg', '1.5deg'];

function photoMarkup(kidId: KidId, index: number, chosen: KidId): string {
  const kid = kidById(kidId);
  return (
    `<button type="button" class="td-photo" role="radio" data-kid="${kid.id}" ` +
    `aria-checked="${kid.id === chosen}" aria-label="${escapeText(kid.name)}: ${escapeText(kid.style)}" ` +
    `style="--tilt: ${PHOTO_TILTS[index] ?? '0deg'}" tabindex="${kid.id === chosen ? 0 : -1}">` +
    kidPortraitSvg(kid, { expression: 'photo', idPrefix: `td-menu-${kid.id}` }) +
    `<span class="td-hand">${escapeText(kid.name)}</span></button>`
  );
}

export function createMenuScreen(options: MenuOptions): MenuScreen {
  const root = document.createElement('section');
  root.className = 'td-screen td-menu';
  root.setAttribute('aria-label', 'Tank Duel game menu');
  root.dataset.hovered = 'kid';
  const style = document.createElement('style');
  style.textContent = STYLE;

  let kid = options.kid;
  let scoring = options.scoring;
  const { channel } = options;

  root.innerHTML =
    `<div class="td-scrim"></div>` +
    `<div class="td-menu-panel">` +
    `<header class="td-title td-plate td-rivets">` +
    `<h1 class="td-display">Tank Duel</h1>` +
    `<span class="td-band td-display">${escapeText(bandText(channel))}</span>` +
    `<p class="td-origin">${escapeText(originText(channel))}</p>` +
    `</header>` +
    `<div class="td-menu-card td-panel">` +
    `<p class="td-line">${escapeText(CHANNEL_LINES[channel.id] ?? '')}</p>` +
    `<div class="td-modes">` +
    `<button type="button" class="td-button td-plate td-display is-primary" data-mode="kid">` +
    `<span>Vs a Kid<small class="td-kid-line"></small></span><span class="td-key" aria-hidden="true">Enter</span></button>` +
    `<button type="button" class="td-button td-plate td-display" data-mode="versus">` +
    `<span>Versus<small>Two players, one table</small></span></button>` +
    `<button type="button" class="td-button td-plate td-display" data-mode="practice">` +
    `<span>Practice<small>The other tank sits still, as in 1977</small></span></button>` +
    `</div>` +
    `<div class="td-rule"><span class="td-label" id="td-rule-label">Scoring</span>` +
    `<div class="td-toggle" role="radiogroup" aria-labelledby="td-rule-label">` +
    `<button type="button" role="radio" data-rule="timed">Timed round · 2:44</button>` +
    `<button type="button" role="radio" data-rule="first-to-10">First to 10</button>` +
    `</div></div>` +
    `<div class="td-handicap">` +
    `<span class="td-label" id="td-handicap-label">Handicap</span>` +
    `<p class="td-switches" aria-live="polite" aria-labelledby="td-handicap-label"></p>` +
    `<button type="button" class="td-help" aria-expanded="false" aria-controls="td-handicap-help" ` +
    `aria-label="What is a handicap?">?</button>` +
    `<div class="td-help-text td-panel" id="td-handicap-help" hidden>${HANDICAP_HELP}</div>` +
    `</div>` +
    `<div class="td-links">` +
    `<button type="button" class="td-link" data-link="how">How to play</button>` +
    `<button type="button" class="td-link" data-link="settings">Settings</button>` +
    `<button type="button" class="td-link" data-link="records">Records</button>` +
    `</div></div></div>` +
    `<div class="td-rivals">` +
    `<span class="td-label" id="td-rivals-label">Pick your rival</span>` +
    `<div class="td-photos" role="radiogroup" aria-labelledby="td-rivals-label">` +
    KIDS.map((each, index) => photoMarkup(each.id, index, kid)).join('') +
    `</div>` +
    `<p class="td-rival-note td-panel" aria-live="polite"></p>` +
    `</div>`;
  root.prepend(style);
  options.host.append(root);

  const query = (selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`menu markup is missing ${selector}`);
    return found;
  };
  const kidLine = query('.td-kid-line');
  const rivalNote = query('.td-rival-note');
  const switchLine = query('.td-switches');
  const helpButton = query('.td-help');
  const helpText = query('.td-help-text');
  const showHelp = (open: boolean): void => {
    helpButton.setAttribute('aria-expanded', String(open));
    helpText.hidden = !open;
  };
  const helpOpen = (): boolean => helpButton.getAttribute('aria-expanded') === 'true';
  helpButton.addEventListener('click', () => {
    showHelp(!helpOpen());
  });
  // Escape closes the explanation and leaves focus on its button; so does a click elsewhere.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !helpOpen()) return;
    showHelp(false);
    helpButton.focus();
  });
  root.addEventListener('pointerdown', (event) => {
    const inside = event.target instanceof Node && helpButton.parentElement?.contains(event.target);
    if (helpOpen() && !inside) showHelp(false);
  });
  const photos = [...root.querySelectorAll<HTMLButtonElement>('.td-photo')];
  const ruleButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-rule]')];

  function showKid(): void {
    const chosen = kidById(kid);
    kidLine.textContent = `Against ${chosen.name}`;
    rivalNote.innerHTML = `<strong>${escapeText(chosen.name)}</strong> · ${escapeText(chosen.style)}<br>${escapeText(chosen.bio)}`;
    for (const photo of photos) {
      const isChosen = photo.dataset.kid === kid;
      photo.setAttribute('aria-checked', String(isChosen));
      photo.tabIndex = isChosen ? 0 : -1;
    }
  }

  function showRule(): void {
    for (const button of ruleButtons) {
      const isChosen = button.dataset.rule === scoring;
      button.setAttribute('aria-checked', String(isChosen));
      button.tabIndex = isChosen ? 0 : -1;
    }
  }

  function setSwitches(switches: DifficultySwitches): void {
    switchLine.innerHTML =
      `<span>You: <b>${handicapText(switches.left)}</b></span>` +
      `<span>Opponent: <b>${handicapText(switches.right)}</b></span>`;
  }

  /** Arrow keys move the choice inside a radio group, as on any form. */
  function arrowKeys(
    group: readonly HTMLButtonElement[],
    choose: (button: HTMLButtonElement) => void,
  ) {
    return (event: KeyboardEvent) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (step === undefined) return;
      const index = group.findIndex((button) => button === document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = group[(index + step + group.length) % group.length];
      if (!next) return;
      choose(next);
      next.focus();
    };
  }

  function chooseKid(button: HTMLButtonElement): void {
    const id = KIDS.find((each) => each.id === button.dataset.kid)?.id;
    if (!id || id === kid) return;
    kid = id;
    showKid();
    options.onKid(id);
  }

  function chooseRule(button: HTMLButtonElement): void {
    const rule = button.dataset.rule === 'first-to-10' ? 'first-to-10' : 'timed';
    if (rule === scoring) return;
    scoring = rule;
    showRule();
    options.onScoring(rule);
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const mode = target?.closest<HTMLElement>('[data-mode]')?.dataset.mode;
    if (mode === 'kid' || mode === 'versus' || mode === 'practice') {
      options.onStart(mode);
      return;
    }
    const photo = target?.closest<HTMLButtonElement>('.td-photo');
    if (photo) return chooseKid(photo);
    const rule = target?.closest<HTMLButtonElement>('[data-rule]');
    if (rule) return chooseRule(rule);
    const link = target?.closest<HTMLElement>('[data-link]')?.dataset.link;
    if (link === 'how') options.onHowToPlay();
    if (link === 'settings') options.onSettings();
    if (link === 'records') options.onRecords();
  });
  query('.td-photos').addEventListener('keydown', arrowKeys(photos, chooseKid));
  query('.td-toggle').addEventListener('keydown', arrowKeys(ruleButtons, chooseRule));
  // Hovering a mode says what it does to the rival strip; Versus has no rival to pick.
  for (const button of root.querySelectorAll<HTMLElement>('[data-mode]')) {
    const show = () => (root.dataset.hovered = button.dataset.mode ?? 'kid');
    button.addEventListener('pointerenter', show);
    button.addEventListener('focus', show);
  }

  showKid();
  showRule();
  setSwitches(options.switches);

  return {
    show() {
      root.hidden = false;
      // The Hall focuses the game's host once the game is mounted; take the focus back after it.
      requestAnimationFrame(() => query('[data-mode="kid"]').focus({ preventScroll: true }));
    },
    hide() {
      root.hidden = true;
    },
    setSwitches,
    dispose() {
      root.remove();
    },
  };
}
