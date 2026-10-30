/**
 * The game menu, laid over the field while two Kids hunt behind it: the
 * title card with the channel on its band, the ways to play this channel,
 * the clue rule, the look (switching it repaints the field behind at once),
 * the difficulty switches as they stand, and the six Kids' school photos to
 * pick a rival from. The Hall's own chrome (Back to the Hall, the channel
 * dial) sits above it, so the panel starts below them.
 */
import {
  KID_MEMORY,
  KIDS,
  kidById,
  kidPortraitSvg,
  type DifficultySwitches,
  type KidId,
  type MemoryMode,
} from '@woodgrain-88/kit';
import type { ClueMode } from '../ai/kid.ts';
import { channelNumber, type HotColdChannel } from '../channels.ts';
import type { LookId } from '../look/look.ts';
import { escapeText, wordmarkMarkup } from './style.ts';

export type PlayMode = 'kid' | 'versus' | 'alone';

export interface MenuOptions {
  readonly host: HTMLElement;
  readonly channel: HotColdChannel;
  readonly kid: KidId;
  readonly clues: ClueMode;
  readonly look: LookId;
  readonly memory: MemoryMode;
  readonly switches: DifficultySwitches;
  readonly onStart: (mode: PlayMode) => void;
  readonly onKid: (kid: KidId) => void;
  readonly onClues: (clues: ClueMode) => void;
  readonly onLook: (look: LookId) => void;
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
.hc-menu-panel {
  position: absolute;
  left: clamp(16px, 3vw, 56px);
  top: clamp(68px, 10vh, 120px);
  max-height: calc(100% - clamp(68px, 10vh, 120px) - 12px);
  overflow-y: auto;
  width: min(450px, 38vw);
  display: grid;
  align-content: start;
  gap: clamp(8px, 1.4vh, 18px);
  padding: 0 4px 4px 0;
}
.hc-title { padding: clamp(16px, 2.4vh, 26px) clamp(18px, 2vw, 28px) clamp(10px, 1.6vh, 18px); display: grid; gap: 6px; }
.hc-title h1 { margin: 0; font-size: clamp(40px, 7.6vh, 100px); }
.hc-title-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.hc-band {
  justify-self: start;
  padding: 5px 12px 4px;
  border-radius: 4px;
  background: var(--hc-ink);
  color: var(--hc-paper);
  font-size: clamp(15px, 2vh, 20px);
  letter-spacing: 0.1em;
}
.hc-origin { margin: 0; font-size: clamp(14px, 1.7vh, 16px); color: var(--hc-ink-soft); }
.hc-menu-card { padding: clamp(16px, 2.2vh, 24px) clamp(14px, 1.6vw, 20px) clamp(10px, 1.6vh, 20px); display: grid; gap: clamp(8px, 1.2vh, 14px); }
.hc-line { margin: 0; font-size: clamp(15px, 1.9vh, 18px); line-height: 1.4; }
.hc-modes { display: grid; gap: 6px; }
.hc-modes .hc-button { justify-content: space-between; width: 100%; padding: 0.4em 1.1em; text-align: left; }
.hc-modes .hc-button > span:first-child { display: grid; justify-items: start; gap: 2px; }
.hc-modes .hc-button small {
  font: 600 clamp(12px, 1.5vh, 14px)/1.2 inherit;
  font-family: inherit;
  letter-spacing: 0.01em;
  text-transform: none;
  opacity: 0.88;
}
.hc-modes .hc-button.is-primary small { font-family: 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif; }
.hc-choice { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.hc-choice .hc-label { min-width: 4.6em; }
.hc-handicap { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.hc-switches { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; font-size: clamp(14px, 1.7vh, 16px); }
.hc-switches b { font-weight: 800; }
.hc-help {
  appearance: none;
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid currentColor;
  background: none;
  color: var(--hc-ink);
  font: 800 15px/1 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif;
  cursor: pointer;
}
.hc-help[aria-expanded='true'] { background: var(--hc-ink); color: var(--hc-paper); }
.hc-help:focus-visible { outline: 3px solid var(--hc-focus); outline-offset: 2px; }
/* Opens in place under the switches: the card clips anything floating out of it, and the panel
   scrolls, so a longer card is never cut off. */
.hc-help-text {
  flex-basis: 100%;
  margin: 2px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  border-left: 4px solid var(--hc-hot);
  background: var(--hc-well);
  scroll-margin-bottom: 56px;
  font-size: clamp(14px, 1.7vh, 16px);
  line-height: 1.45;
}
.hc-help-text p { margin: 0 0 0.5em; }
.hc-help-text p:last-child { margin-bottom: 0; }
.hc-links { display: flex; flex-wrap: wrap; gap: 0 18px; }
.hc-rivals {
  position: absolute;
  right: clamp(16px, 3vw, 56px);
  bottom: clamp(16px, 4vh, 44px);
  display: grid;
  justify-items: end;
  gap: 16px;
  max-width: min(960px, 56vw);
  transition: opacity 160ms ease;
}
.hc-rivals > .hc-label { color: #ffffff; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
.hc-photos { display: flex; justify-content: flex-end; gap: clamp(6px, 0.8vw, 14px); }
.hc-rival-note { padding: 16px 14px 10px; max-width: 440px; font-size: clamp(14px, 1.7vh, 16px); line-height: 1.4; }
.hc-rival-note p { margin: 0; }
.hc-rival-note .hc-memory { margin-top: 6px; color: var(--hc-ink-soft); }
.hc-menu[data-hovered='versus'] .hc-rivals,
.hc-menu[data-hovered='alone'] .hc-rivals { opacity: 0.5; }
@media (max-width: 760px) {
  .hc-menu { overflow-y: auto; align-content: end; }
  .hc-menu-panel { position: relative; left: auto; top: auto; width: auto; margin: 72px 16px 12px; }
  .hc-rivals { position: static; margin: 0 16px 16px; max-width: none; justify-items: start; }
  .hc-photos { flex-wrap: wrap; justify-content: flex-start; }
}
`;

const LOOK_NAMES: Readonly<Record<LookId, string>> = {
  polar: 'Polar',
  tabletop: 'Tabletop',
  radar: 'Radar',
};

/** What the switches do, and why they are there, for anyone who wonders. */
const SWITCH_HELP =
  '<p>The console’s difficulty switches change two variations, as they did in 1978. ' +
  'In the race (channel 1), a player on A walks a little slower. ' +
  'In hunt for hunt (channels 5 to 7), every check a player on A makes counts twice.</p>' +
  '<p>Give the stronger player A to even out a match, or take A yourself for a challenge. ' +
  'Set them on the console in the Den, or from the pause menu.</p>';

const PHOTO_TILTS = ['-3deg', '2deg', '-1.5deg', '3deg', '-2.5deg', '1.5deg'];

function photoMarkup(kidId: KidId, index: number, chosen: KidId): string {
  const kid = kidById(kidId);
  return (
    `<button type="button" class="hc-photo" role="radio" data-kid="${kid.id}" ` +
    `aria-checked="${kid.id === chosen}" aria-label="${escapeText(kid.name)}: ${escapeText(kid.style)}" ` +
    `style="--tilt: ${PHOTO_TILTS[index] ?? '0deg'}" tabindex="${kid.id === chosen ? 0 : -1}">` +
    kidPortraitSvg(kid, { expression: 'photo', idPrefix: `hc-menu-${kid.id}` }) +
    `<span class="hc-hand">${escapeText(kid.name)}</span></button>`
  );
}

/** How a Kid's memory reads in a sentence, from its profile. */
export function memoryNote(kid: KidId, memory: MemoryMode): string {
  if (memory === 'sharp')
    return 'Sharp Kids are on: every Kid remembers every clue and never slips.';
  const profile = KID_MEMORY[kid];
  const pace =
    profile.halfLife >= 90
      ? 'forgets slowly'
      : profile.halfLife >= 60
        ? 'forgets within a minute or two'
        : 'forgets fast';
  return `Keeps about ${profile.capacity} clues in mind and ${pace}.`;
}

function switchText(position: 'A' | 'B'): string {
  return position === 'A' ? 'A, the harder way' : 'B';
}

export function createMenuScreen(options: MenuOptions): MenuScreen {
  const root = document.createElement('section');
  root.className = 'hc-screen hc-menu';
  root.setAttribute('aria-label', 'Hot & Cold game menu');
  root.dataset.hovered = 'kid';
  const style = document.createElement('style');
  style.textContent = STYLE;

  const { channel } = options;
  const alwaysAlone = channel.rules.style === 'clock';
  let kid = options.kid;
  let clues = options.clues;
  let look = options.look;
  const number = channelNumber(channel.def.id);
  const origin =
    channel.def.kind === 'remix'
      ? 'A Remix channel: new rules on the same field.'
      : `Game ${channel.def.originalGame?.[0] ?? number} of 10 on the 1978 cartridge.`;

  const modes = alwaysAlone
    ? `<button type="button" class="hc-button is-primary" data-mode="alone">` +
      `<span>Play<small>Alone, against the clock</small></span>` +
      `<span class="hc-key" aria-hidden="true">Enter</span></button>`
    : `<button type="button" class="hc-button is-primary" data-mode="kid">` +
      `<span>Vs a Kid<small class="hc-kid-line"></small></span>` +
      `<span class="hc-key" aria-hidden="true">Enter</span></button>` +
      `<button type="button" class="hc-button" data-mode="versus">` +
      `<span>Two players<small>One keyboard, or two pads</small></span></button>` +
      `<button type="button" class="hc-button" data-mode="alone">` +
      `<span>Alone<small>Just you and the hidden flag</small></span></button>`;

  root.innerHTML =
    `<div class="hc-scrim"></div>` +
    `<div class="hc-menu-panel">` +
    `<header class="hc-title hc-card">` +
    `<h1>${wordmarkMarkup()}</h1>` +
    `<div class="hc-title-line">` +
    `<span class="hc-band hc-display">CH ${String(number).padStart(2, '0')} · ${escapeText(channel.def.title)}</span>` +
    `<p class="hc-origin">${escapeText(origin)}</p></div>` +
    `</header>` +
    `<div class="hc-menu-card hc-card">` +
    `<p class="hc-line">${escapeText(channel.def.description)}</p>` +
    `<div class="hc-modes">${modes}</div>` +
    `<div class="hc-choice"><span class="hc-label" id="hc-clues-label">Clues</span>` +
    `<div class="hc-toggle" role="radiogroup" aria-labelledby="hc-clues-label" data-group="clues">` +
    `<button type="button" role="radio" data-clues="notebook">Notebook</button>` +
    `<button type="button" role="radio" data-clues="classic">Classic Memory</button>` +
    `</div></div>` +
    `<div class="hc-choice"><span class="hc-label" id="hc-look-label">Look</span>` +
    `<div class="hc-toggle" role="radiogroup" aria-labelledby="hc-look-label" data-group="look">` +
    (['polar', 'tabletop', 'radar'] as const)
      .map(
        (id) => `<button type="button" role="radio" data-look="${id}">${LOOK_NAMES[id]}</button>`,
      )
      .join('') +
    `</div></div>` +
    `<div class="hc-handicap">` +
    `<span class="hc-label" id="hc-switch-label">Switches</span>` +
    `<p class="hc-switches" aria-live="polite" aria-labelledby="hc-switch-label"></p>` +
    `<button type="button" class="hc-help" aria-expanded="false" aria-controls="hc-switch-help" ` +
    `aria-label="What do the switches do?">?</button>` +
    `<div class="hc-help-text" id="hc-switch-help" hidden>${SWITCH_HELP}</div>` +
    `</div>` +
    `<div class="hc-links">` +
    `<button type="button" class="hc-link" data-link="how">How to play</button>` +
    `<button type="button" class="hc-link" data-link="settings">Settings</button>` +
    `<button type="button" class="hc-link" data-link="records">Records</button>` +
    `</div></div></div>` +
    (alwaysAlone
      ? ''
      : `<div class="hc-rivals">` +
        `<span class="hc-label" id="hc-rivals-label">Pick your rival</span>` +
        `<div class="hc-photos" role="radiogroup" aria-labelledby="hc-rivals-label">` +
        KIDS.map((each, index) => photoMarkup(each.id, index, kid)).join('') +
        `</div>` +
        `<div class="hc-rival-note hc-card" aria-live="polite"></div>` +
        `</div>`);
  root.prepend(style);
  options.host.append(root);

  const query = (selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`menu markup is missing ${selector}`);
    return found;
  };
  const switchLine = query('.hc-switches');
  const helpButton = query('.hc-help');
  const helpText = query('.hc-help-text');
  const photos = [...root.querySelectorAll<HTMLButtonElement>('.hc-photo')];
  const clueButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-clues]')];
  const lookButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-look]')];

  const showHelp = (open: boolean): void => {
    helpButton.setAttribute('aria-expanded', String(open));
    helpText.hidden = !open;
    if (open) helpText.scrollIntoView({ block: 'nearest' });
  };
  const helpOpen = (): boolean => helpButton.getAttribute('aria-expanded') === 'true';
  helpButton.addEventListener('click', () => showHelp(!helpOpen()));
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !helpOpen()) return;
    showHelp(false);
    helpButton.focus();
  });
  root.addEventListener('pointerdown', (event) => {
    const inside = event.target instanceof Node && helpButton.parentElement?.contains(event.target);
    if (helpOpen() && !inside) showHelp(false);
  });

  function check(
    group: readonly HTMLButtonElement[],
    isChosen: (button: HTMLButtonElement) => boolean,
  ) {
    for (const button of group) {
      const chosen = isChosen(button);
      button.setAttribute('aria-checked', String(chosen));
      button.tabIndex = chosen ? 0 : -1;
    }
  }

  function showKid(): void {
    if (alwaysAlone) return;
    const chosen = kidById(kid);
    query('.hc-kid-line').textContent = `Against ${chosen.name}`;
    query('.hc-rival-note').innerHTML =
      `<p><strong>${escapeText(chosen.name)}</strong> · ${escapeText(chosen.style)}</p>` +
      `<p>${escapeText(chosen.bio)}</p>` +
      `<p class="hc-memory">${escapeText(memoryNote(kid, options.memory))}</p>`;
    check(photos, (photo) => photo.dataset.kid === kid);
  }

  function setSwitches(switches: DifficultySwitches): void {
    switchLine.innerHTML =
      `<span>You: <b>${switchText(switches.left)}</b></span>` +
      `<span>Rival: <b>${switchText(switches.right)}</b></span>`;
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

  function chooseClues(button: HTMLButtonElement): void {
    const next: ClueMode = button.dataset.clues === 'classic' ? 'classic' : 'notebook';
    if (next === clues) return;
    clues = next;
    check(clueButtons, (each) => each.dataset.clues === clues);
    options.onClues(next);
  }

  function chooseLook(button: HTMLButtonElement): void {
    const next = lookButtons.includes(button) ? (button.dataset.look as LookId) : look;
    if (next === look) return;
    look = next;
    check(lookButtons, (each) => each.dataset.look === look);
    options.onLook(next);
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const mode = target?.closest<HTMLElement>('[data-mode]')?.dataset.mode;
    if (mode === 'kid' || mode === 'versus' || mode === 'alone') {
      options.onStart(mode);
      return;
    }
    const photo = target?.closest<HTMLButtonElement>('.hc-photo');
    if (photo) return chooseKid(photo);
    const clue = target?.closest<HTMLButtonElement>('[data-clues]');
    if (clue) return chooseClues(clue);
    const lookButton = target?.closest<HTMLButtonElement>('[data-look]');
    if (lookButton) return chooseLook(lookButton);
    const link = target?.closest<HTMLElement>('[data-link]')?.dataset.link;
    if (link === 'how') options.onHowToPlay();
    if (link === 'settings') options.onSettings();
    if (link === 'records') options.onRecords();
  });
  root
    .querySelector<HTMLElement>('.hc-photos')
    ?.addEventListener('keydown', arrowKeys(photos, chooseKid));
  query('[data-group="clues"]').addEventListener('keydown', arrowKeys(clueButtons, chooseClues));
  query('[data-group="look"]').addEventListener('keydown', arrowKeys(lookButtons, chooseLook));
  // Hovering a mode shows whether it has a rival to pick.
  for (const button of root.querySelectorAll<HTMLElement>('[data-mode]')) {
    const show = () => (root.dataset.hovered = button.dataset.mode ?? 'kid');
    button.addEventListener('pointerenter', show);
    button.addEventListener('focus', show);
  }

  showKid();
  check(clueButtons, (each) => each.dataset.clues === clues);
  check(lookButtons, (each) => each.dataset.look === look);
  setSwitches(options.switches);

  return {
    show() {
      root.hidden = false;
      // The Hall focuses the game's host once the game is mounted; take the focus back after it.
      requestAnimationFrame(() => query('.hc-modes .is-primary').focus({ preventScroll: true }));
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
