/**
 * Gravity Duel's game menu, built to mirror Trailblaze's: a left panel card
 * (wordmark, the channel badge, the dial, the mode's start buttons, the look
 * and controls choices, the switches readout, the links), a "Ships" card top
 * right with the look's two ships up close, and a "Pick your rival" row of
 * Kid polaroids bottom right. The background duel plays on, untouched, in
 * the middle of the screen.
 */
import { kidPortraitSvg, KIDS, type KidId, type SwitchPosition } from '@woodgrain-88/kit';
import {
  channelFacts,
  CHANNELS,
  channelById,
  GROUPS,
  type ChannelFacts,
  type GravityChannel,
} from '../channels.ts';
import type { Mode } from '../engine/types.ts';
import type { LookId } from '../look/look.ts';
import { LOOK_IDS, lookById } from '../look/looks.ts';
import type { ControlScheme } from '../session/controls.ts';
import { GRAVITY_PATCHES } from '../progress/patches.ts';
import {
  DISPLAY_FONT,
  LEGIBLE_FONT,
  ensureScreenStyle,
  escapeText,
  wordmarkMarkup,
} from './style.ts';

/** Who the player wants across the field: one of the six Kids. */
export type OpponentType = KidId;

export const MENU_KIDS: readonly KidId[] = ['lou', 'moss', 'rosa', 'benny', 'dee', 'pip'];

/** The one-line style the brief gives each Kid for the opponent picker. */
export const KID_LINES: Readonly<Record<KidId, string>> = {
  lou: 'Calm, frugal with fuel, leads his shots well, turns late.',
  moss: 'Keeps her distance, cloaks when threatened, loves the starbase.',
  rosa: 'Hunts you down and slings shots round the star.',
  benny: 'Copies your moves, a beat later.',
  dee: 'Full thrust everywhere. The star gets her a lot.',
  pip: 'Wanders, wastes missiles, then bends a perfect one round the sun.',
};

/** The mode tabs' own group key, in the order the brief lists them. */
export const MODE_GROUPS: readonly Mode[] = ['duel', 'race', 'solo'];

export function isSoloMode(mode: Mode): boolean {
  return mode === 'solo';
}

export function channelsForMode(mode: Mode): readonly GravityChannel[] {
  return CHANNELS.filter((channel) => channel.rules.mode === mode);
}

/** The look's two ships up close, for the "Ships" card top right. */
export interface MenuShips {
  readonly look: string;
  readonly seats: readonly {
    readonly name: string;
    readonly colour: string;
    readonly portrait: HTMLCanvasElement;
  }[];
}

export interface MenuOptions {
  readonly host: HTMLElement;
  readonly mode: Mode;
  readonly channelId: string;
  readonly opponent: OpponentType;
  readonly look: LookId;
  readonly scheme: ControlScheme;
  readonly matchLength: 10 | 5;
  readonly switches: readonly [SwitchPosition, SwitchPosition];
  /** The chosen look's two ships up close; left out without GL. */
  readonly ships?: MenuShips;
  /** A Remix channel is open once the patch named for it is earned. */
  readonly isUnlocked: (channelId: string) => boolean;
  readonly onMode: (mode: Mode) => void;
  readonly onChannel: (channelId: string) => void;
  readonly onOpponent: (opponent: OpponentType) => void;
  readonly onLook: (look: LookId) => void;
  readonly onScheme: (scheme: ControlScheme) => void;
  readonly onMatchLength: (length: 10 | 5) => void;
  /** `friend`: true for "Versus" (two people); false for "vs a Kid" or "Fly solo". */
  readonly onStart: (friend: boolean) => void;
  readonly onHowToPlay: () => void;
  readonly onSettings: () => void;
  readonly onRecords: () => void;
  readonly onBackToHall: () => void;
}

export interface MenuScreen {
  show(): void;
  setSwitches(switches: readonly [SwitchPosition, SwitchPosition]): void;
  dispose(): void;
}

const LOOK_SWATCHES: Readonly<Record<LookId, { bg: string; s0: string; s1: string }>> = {
  deep: { bg: '#05070f', s0: '#ff8a2a', s1: '#38a8ff' },
  brass: { bg: '#241c10', s0: '#d87a2a', s1: '#3c8cd8' },
  paper: { bg: '#f5ecd6', s0: '#e67828', s1: '#207cd4' },
  whirl: { bg: '#0b2430', s0: '#ff8a2a', s1: '#38a8ff' },
};

/** The polaroids lean a little, each its own way, as Trailblaze's do. */
const PHOTO_TILTS = ['-2.5deg', '1.5deg', '-1.5deg', '2.5deg', '-2deg', '1deg'];

/** One line for both switches, since the left and right ones may sit differently. */
const SWITCH_NOTE =
  'A: your own missile can hit you and docks need an exact speed match. B: neither.';

/** The dial's two-digit number: the cartridge's own for the 17 games, then on through the Remixes. */
function channelNumber(channel: GravityChannel): string {
  const index = CHANNELS.findIndex((candidate) => candidate.def.id === channel.def.id);
  return String(index + 1).padStart(2, '0');
}

function patchTitle(patchId: string | undefined): string {
  return GRAVITY_PATCHES.find((patch) => patch.id === patchId)?.title ?? 'a patch';
}

function lookSwatchSvg(id: LookId): string {
  const { bg, s0, s1 } = LOOK_SWATCHES[id];
  return (
    `<svg class="gd-swatch-svg" viewBox="0 0 32 22" aria-hidden="true">` +
    `<rect width="32" height="22" fill="${bg}" rx="2"/>` +
    `<circle cx="16" cy="11" r="3" fill="#f6e27f"/>` +
    `<path d="M 4 17 L 11 6" stroke="${s0}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M 28 17 L 21 6" stroke="${s1}" stroke-width="2.5" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** A small inline icon for one of `channelFacts`' edges, centre, gravity, cloak or pods. */
function factIcon(label: string, path: string): string {
  return (
    `<span class="gd-fact" title="${escapeText(label)}" aria-label="${escapeText(label)}">` +
    `<svg class="gd-fact-icon" viewBox="0 0 24 24" aria-hidden="true">` +
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg></span>`
  );
}

function iconsFor(facts: ChannelFacts): string {
  const icons: string[] = [];
  icons.push(
    facts.edges === 'wrap'
      ? factIcon('Wraparound edges', 'M4 4 L20 20 M20 4 L4 20')
      : factIcon('Bouncing walls', 'M3 3h18v18H3z'),
  );
  if (facts.centre === 'star')
    icons.push(
      factIcon('A star in the middle', 'M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z'),
    );
  if (facts.centre === 'starbase')
    icons.push(
      factIcon(
        'A starbase in the middle',
        'M12 3v4M12 17v4M3 12h4M17 12h4M7 7l2.5 2.5M14.5 14.5L17 17M17 7l-2.5 2.5M9.5 14.5L7 17',
      ),
    );
  if (facts.centre === 'beacon')
    icons.push(factIcon('A beacon in the middle', 'M12 2v6M9 8h6l-1 6h-4z M8 22h8'));
  if (facts.gravity) icons.push(factIcon('Gravity pulls', 'M12 3a9 9 0 1 0 9 9M12 3v4M12 3l3 2'));
  if (facts.cloak)
    icons.push(factIcon('Cloak', 'M12 2C7 2 4 6 4 11c0 5 4 9 8 11 4-2 8-6 8-11 0-5-3-9-8-9z'));
  if (facts.pods === 'own')
    icons.push(factIcon('A pod each', 'M7 12a5 5 0 1 1 10 0M17 12a5 5 0 1 1-10 0'));
  if (facts.pods === 'shared')
    icons.push(factIcon('One shared pod', 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z'));
  return icons.join('');
}

const STYLE = /* css */ `
.gd-menu { position: absolute; inset: 0; }

.gd-menu-panel {
  --gd-panel-top: clamp(68px, 10vh, 100px);
  position: absolute;
  left: clamp(16px, 3vw, 56px);
  top: var(--gd-panel-top);
  max-height: calc(100vh - var(--gd-panel-top) - 16px);
  width: min(480px, 42vw);
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vh, 12px);
  overflow: hidden;
}

.gd-title-panel { flex-shrink: 0; padding: clamp(12px, 1.6vh, 18px) clamp(16px, 2vw, 22px); display: grid; gap: 6px; }
.gd-channel-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  background: var(--gd-text);
  color: var(--gd-panel-bg);
  font-family: ${DISPLAY_FONT};
  font-size: clamp(14px, 1.8vh, 18px);
  font-weight: 800;
  letter-spacing: 0.06em;
}
.gd-channel-origin { margin: 0; font-size: clamp(13px, 1.6vh, 15px); color: var(--gd-muted); }

.gd-menu-card { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; padding: clamp(12px, 1.6vh, 18px) clamp(16px, 2vw, 22px); overflow: hidden; }
.gd-menu-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: clamp(8px, 1.2vh, 12px); padding-right: 4px; }

.gd-menu-tabs { align-self: flex-start; }
.gd-menu-tabs button[aria-selected='true'] { background: var(--gd-accent); color: #ffffff; box-shadow: 0 2px 0 #4c3878; }
.gd-screens[data-appearance='dark'] .gd-menu-tabs button[aria-selected='true'] { color: #1a1030; }

.gd-dial-wrap { display: grid; gap: 6px; }
.gd-dial-header { display: flex; align-items: center; justify-content: space-between; }
.gd-dial-nav { display: flex; gap: 6px; }
.gd-dial-nav button {
  appearance: none; border: 1px solid var(--gd-border); background: var(--gd-well); color: var(--gd-text);
  border-radius: 4px; padding: 2px 8px; cursor: pointer; font: 700 12px ${LEGIBLE_FONT};
}
.gd-dial-strip { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scroll-behavior: smooth; }
.gd-dial-item {
  appearance: none; border: 1px solid var(--gd-border); background: var(--gd-panel-bg); color: var(--gd-text);
  border-radius: 6px; padding: 6px 10px; cursor: pointer; display: grid; gap: 4px; min-width: 96px; flex-shrink: 0; text-align: left;
}
.gd-dial-item[aria-selected='true'] { border-color: var(--gd-accent); box-shadow: 0 0 0 2px var(--gd-accent); }
.gd-dial-item.is-locked { opacity: 0.6; }
.gd-dial-title { font-size: 12px; font-weight: 700; white-space: nowrap; }
.gd-dial-icons { display: flex; gap: 3px; color: var(--gd-muted); }
.gd-fact-icon { width: 14px; height: 14px; display: block; }

.gd-modes { display: grid; gap: 6px; }
.gd-modes .gd-button { justify-content: space-between; width: 100%; padding: 0.45em 1em; text-align: left; }
.gd-modes .gd-button > span:first-child { display: grid; justify-items: start; gap: 2px; }
.gd-modes .gd-button small { font: 600 clamp(12px, 1.5vh, 14px)/1.2 ${LEGIBLE_FONT}; opacity: 0.88; text-transform: none; letter-spacing: 0; }

.gd-choices { display: flex; flex-direction: column; gap: clamp(7px, 1vh, 10px); }
.gd-choice { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
.gd-swatches { display: flex; gap: 6px; }
.gd-swatch-button { appearance: none; border: 1px solid var(--gd-border); border-radius: 6px; padding: 3px; background: transparent; cursor: pointer; display: inline-grid; place-items: center; }
.gd-swatch-button[aria-checked='true'] { outline: 2px solid var(--gd-accent); }
.gd-swatch-svg { width: 32px; height: 22px; border-radius: 3px; display: block; }

.gd-switch-line { margin: 0; font-size: clamp(14px, 1.7vh, 16px); }
.gd-switch-hint { margin: 0; font-size: clamp(12px, 1.4vh, 14px); color: var(--gd-muted); line-height: 1.35; }

.gd-links { flex-shrink: 0; display: flex; flex-wrap: wrap; gap: 0 16px; padding-top: 10px; margin-top: 8px; border-top: 1px solid var(--gd-border); }

/* "Ships" card, top right: the look's own two ships up close. */
.gd-menu-ships { position: absolute; top: clamp(68px, 10vh, 100px); right: 24px; width: min(360px, 30vw); padding: 12px 14px 14px; display: grid; gap: 10px; }
.gd-menu-ships-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.gd-menu-ship { display: grid; gap: 6px; margin: 0; }
.gd-menu-ship-well { aspect-ratio: 3 / 2; border-radius: 6px; overflow: hidden; background: var(--gd-well); }
.gd-menu-ship-well canvas { display: block; width: 100%; height: 100%; }
.gd-menu-ship figcaption { font-weight: 700; font-size: clamp(13px, 1.6vh, 15px); padding-bottom: 3px; border-bottom: 3px solid var(--seat); }

/* "Pick your rival", bottom right. */
.gd-rivals { position: absolute; left: calc(clamp(16px, 3vw, 56px) + min(480px, 42vw) + 24px); right: 24px; bottom: clamp(16px, 3vh, 40px); display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.gd-rivals[hidden] { display: none; }
.gd-rivals > .gd-label { color: var(--gd-text); text-shadow: 0 0 4px var(--gd-panel-bg), 0 0 10px var(--gd-panel-bg); text-align: right; width: 100%; }
.gd-rival-photos .gd-photo { transform: rotate(var(--tilt, 0deg)); transition: transform 140ms cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 140ms ease-out; }
.gd-rival-photos .gd-photo[aria-checked='true'] { transform: translateY(-6px) scale(1.06); }
.gd-rival-photos { display: flex; justify-content: flex-end; width: 100%; max-width: calc(6 * 110px + 5 * 10px); gap: clamp(4px, 0.7vw, 10px); }
.gd-rival-photos .gd-photo { flex: 1 1 0; max-width: 110px; min-width: 60px; width: auto; }
@media (prefers-reduced-motion: reduce) { .gd-rival-photos .gd-photo { transition: none; } }
.gd-rival-note { width: 100%; max-width: calc(6 * 110px + 5 * 10px); padding: 12px 14px 10px; font-size: clamp(13px, 1.6vh, 15px); line-height: 1.4; box-sizing: border-box; }
.gd-rival-note p { margin: 0; }
.gd-rival-note .gd-memory-note { margin-top: 6px; color: var(--gd-muted); }

@media (max-width: 840px) {
  .gd-menu-panel { position: relative; left: auto; top: auto; max-height: none; width: auto; margin: 64px 16px 16px; overflow: visible; }
  .gd-menu-card, .gd-menu-scroll { overflow: visible; }
  .gd-menu-ships { position: static; width: auto; margin: 0 16px 16px; }
  .gd-rivals { position: static; left: auto; right: auto; margin: 0 16px 24px; max-width: none; align-items: flex-start; }
  .gd-rivals > .gd-label { text-align: left; }
  .gd-rival-photos { flex-wrap: wrap; justify-content: flex-start; }
}
`;

export function createMenuScreen(options: MenuOptions): MenuScreen {
  ensureScreenStyle(options.host);
  const root = document.createElement('section');
  root.className = 'gd-screen gd-menu';
  root.setAttribute('aria-label', 'Gravity Duel game menu');
  root.hidden = true;
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'gd-link';
  back.style.cssText = 'position: absolute; top: 16px; left: 16px;';
  back.textContent = '← Back to the Hall';
  back.addEventListener('click', options.onBackToHall);
  root.append(back);

  // render() replaces only this container's markup; the style tag and the back button, appended
  // directly to `root`, stay put across every redraw.
  const content = document.createElement('div');
  root.append(content);

  let mode = options.mode;
  let channelId = options.channelId;
  let opponent = options.opponent;
  let look = options.look;
  let scheme = options.scheme;
  let matchLength = options.matchLength;
  let switches: readonly [SwitchPosition, SwitchPosition] = options.switches;

  function channel(): GravityChannel {
    const inMode = channelsForMode(mode);
    const fallback = inMode[0] ?? CHANNELS[0];
    if (!fallback) throw new Error('No channels');
    return inMode.find((candidate) => candidate.def.id === channelId) ?? fallback;
  }

  function startButtonsHtml(current: GravityChannel): string {
    if (isSoloMode(mode)) {
      return (
        `<button type="button" class="gd-button is-primary" data-start="solo">` +
        `<span>FLY SOLO<small>Dock as many as you can before the clock</small></span>` +
        `<span class="gd-key" aria-hidden="true">Enter</span></button>`
      );
    }
    const unlocked = options.isUnlocked(current.def.id);
    if (!unlocked) {
      return (
        `<button type="button" class="gd-button is-primary" disabled>` +
        `<span>LOCKED<small>Earn ${escapeText(patchTitle(current.def.unlockedBy))} to open it</small></span></button>`
      );
    }
    const name = KIDS.find((kid) => kid.id === opponent)?.name ?? opponent;
    return (
      `<button type="button" class="gd-button is-primary" data-start="kid">` +
      `<span>VS A KID<small>Against ${escapeText(name)}</small></span>` +
      `<span class="gd-key" aria-hidden="true">Enter</span></button>` +
      `<button type="button" class="gd-button" data-start="friend">` +
      `<span>VERSUS<small>Two ships, one keyboard</small></span></button>`
    );
  }

  function render(): void {
    const current = channel();
    const origin =
      current.def.kind === 'remix'
        ? `A Remix, opened by ${patchTitle(current.def.unlockedBy)}.`
        : `Game ${String(current.rules.number)} of the 17 on the 1978 cartridge.`;

    const dialHtml = channelsForMode(mode)
      .map((candidate) => {
        const isSelected = candidate.def.id === current.def.id;
        const candidateUnlocked = options.isUnlocked(candidate.def.id);
        return (
          `<button type="button" class="gd-dial-item${candidateUnlocked ? '' : ' is-locked'}" ` +
          `data-channel="${candidate.def.id}" role="tab" aria-selected="${String(isSelected)}">` +
          `<span class="gd-dial-title">${candidateUnlocked ? '' : '🔒 '}${channelNumber(candidate)} ${escapeText(candidate.def.title)}</span>` +
          `<span class="gd-dial-icons">${iconsFor(channelFacts(candidate))}</span>` +
          `</button>`
        );
      })
      .join('');

    const kidCardsHtml = MENU_KIDS.map((id, index) => {
      const kid = KIDS.find((candidate) => candidate.id === id);
      const chosen = opponent === id;
      return (
        `<button type="button" class="gd-photo" role="radio" data-opponent="${id}" ` +
        `style="--tilt: ${PHOTO_TILTS[index] ?? '0deg'}" ` +
        `aria-checked="${String(chosen)}" aria-label="${escapeText(kid?.name ?? id)}" tabindex="${chosen ? 0 : -1}">` +
        (kid ? kidPortraitSvg(kid, { expression: 'photo', idPrefix: `gd-menu-${id}` }) : '') +
        `<span class="gd-style-line">${escapeText(kid?.name ?? id)}</span></button>`
      );
    }).join('');

    content.innerHTML =
      `<div class="gd-menu-panel">` +
      `<header class="gd-title-panel gd-card">` +
      wordmarkMarkup() +
      `<div>` +
      `<span class="gd-channel-tag">CH ${channelNumber(current)} · ${escapeText(current.def.title.toUpperCase())}</span>` +
      `<p class="gd-channel-origin">${escapeText(origin)}</p>` +
      `</div></header>` +
      `<div class="gd-menu-card gd-card">` +
      `<div class="gd-menu-scroll">` +
      `<div class="gd-menu-tabs gd-toggle" role="tablist" aria-label="Mode">` +
      MODE_GROUPS.map(
        (group) =>
          `<button type="button" role="tab" aria-selected="${String(group === mode)}" ` +
          `data-mode="${group}">${escapeText(GROUPS[group])}</button>`,
      ).join('') +
      `</div>` +
      `<div class="gd-dial-wrap">` +
      `<div class="gd-dial-header"><span class="gd-label">Channel dial</span>` +
      `<div class="gd-dial-nav">` +
      `<button type="button" data-action="prev-channel" aria-label="Previous channel">[</button>` +
      `<button type="button" data-action="next-channel" aria-label="Next channel">]</button>` +
      `</div></div>` +
      `<div class="gd-dial-strip" role="tablist" aria-label="Channels">${dialHtml}</div>` +
      `</div>` +
      `<div class="gd-modes">${startButtonsHtml(current)}</div>` +
      `<div class="gd-choices">` +
      `<div class="gd-choice"><span class="gd-label" id="gd-look-label">Look</span>` +
      `<div class="gd-swatches" role="radiogroup" aria-labelledby="gd-look-label">` +
      LOOK_IDS.map(
        (id) =>
          `<button type="button" class="gd-swatch-button" role="radio" data-look="${id}" ` +
          `aria-checked="${String(id === look)}" aria-label="${escapeText(lookById(id).name)}">${lookSwatchSvg(id)}</button>`,
      ).join('') +
      `</div></div>` +
      `<div class="gd-choice"><span class="gd-label" id="gd-scheme-label">Controls</span>` +
      `<div class="gd-toggle" role="radiogroup" aria-labelledby="gd-scheme-label">` +
      `<button type="button" role="radio" data-scheme="classic" aria-checked="${String(scheme === 'classic')}">Classic</button>` +
      `<button type="button" role="radio" data-scheme="modern" aria-checked="${String(scheme === 'modern')}">Modern</button>` +
      `</div>` +
      `<p class="gd-switch-hint">${scheme === 'classic' ? 'Turn, thrust and drift, as in 1978.' : 'Point where you want to face; the ship turns there at the old rate.'}</p>` +
      `</div>` +
      `<div class="gd-choice"><span class="gd-label" id="gd-length-label">Match length</span>` +
      `<div class="gd-toggle" role="radiogroup" aria-labelledby="gd-length-label">` +
      `<button type="button" role="radio" data-match-length="10" aria-checked="${String(matchLength === 10)}">Cartridge</button>` +
      `<button type="button" role="radio" data-match-length="5" aria-checked="${String(matchLength === 5)}">Short</button>` +
      `</div></div>` +
      (mode === 'solo'
        ? ''
        : `<div class="gd-choice"><span class="gd-label" id="gd-switches-label">Switches</span>` +
          `<p class="gd-switch-line" aria-live="polite" aria-labelledby="gd-switches-label">` +
          `<span>Left: <b>${switches[0]}</b></span> · <span>Right: <b>${switches[1]}</b></span></p>` +
          `<p class="gd-switch-hint">${SWITCH_NOTE}</p></div>`) +
      `</div>` +
      `</div>` +
      `<div class="gd-links">` +
      `<button type="button" class="gd-link" data-link="how">How to play</button>` +
      `<button type="button" class="gd-link" data-link="settings">Settings</button>` +
      `<button type="button" class="gd-link" data-link="records">Records</button>` +
      `</div>` +
      `</div></div>` +
      shipsHtml() +
      `<div class="gd-rivals"${mode === 'solo' ? ' hidden' : ''}>` +
      `<span class="gd-label" id="gd-rivals-label">Pick your rival</span>` +
      `<div class="gd-rival-photos" role="radiogroup" aria-labelledby="gd-rivals-label">${kidCardsHtml}</div>` +
      `<div class="gd-rival-note gd-card" aria-live="polite">` +
      `<p><strong>${escapeText(KIDS.find((kid) => kid.id === opponent)?.name ?? opponent)}</strong> · ${escapeText(KID_LINES[opponent])}</p>` +
      `</div></div>`;

    const ships = content.querySelectorAll('.gd-menu-ship-well');
    options.ships?.seats.forEach((seat, seatIndex) => ships[seatIndex]?.append(seat.portrait));
  }

  function shipsHtml(): string {
    const ships = options.ships;
    if (!ships) return '';
    const seats = ships.seats
      .map(
        (seat) =>
          `<figure class="gd-menu-ship" style="--seat: ${seat.colour}">` +
          `<div class="gd-menu-ship-well"></div><figcaption>${escapeText(seat.name)}</figcaption></figure>`,
      )
      .join('');
    return (
      `<section class="gd-menu-ships gd-card" aria-label="Ships in ${escapeText(ships.look)}">` +
      `<span class="gd-label">Ships · ${escapeText(ships.look)}</span>` +
      `<div class="gd-menu-ships-row">${seats}</div></section>`
    );
  }

  function scrollSelectedDialIntoView(): void {
    const selected = root.querySelector<HTMLElement>('.gd-dial-item[aria-selected="true"]');
    if (!selected) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    selected.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduced ? 'instant' : 'smooth',
    });
  }

  function changeChannel(id: string): void {
    if (id === channelId) {
      scrollSelectedDialIntoView();
      return;
    }
    if (!channelById(id)) return;
    channelId = id;
    render();
    options.onChannel(id);
    scrollSelectedDialIntoView();
  }

  function stepChannel(delta: -1 | 1): void {
    const inMode = channelsForMode(mode);
    const currentIndex = inMode.findIndex((candidate) => candidate.def.id === channelId);
    const nextIndex = (currentIndex + delta + inMode.length) % inMode.length;
    const next = inMode[nextIndex];
    if (next) changeChannel(next.def.id);
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-action="prev-channel"]')) return stepChannel(-1);
    if (target.closest('[data-action="next-channel"]')) return stepChannel(1);

    const modeBtn = target.closest<HTMLElement>('[data-mode]');
    if (modeBtn?.dataset.mode) {
      const nextMode = modeBtn.dataset.mode as Mode;
      if (nextMode !== mode) {
        mode = nextMode;
        channelId = channelsForMode(mode)[0]?.def.id ?? channelId;
        render();
        options.onMode(nextMode);
      }
      return;
    }

    const dialItem = target.closest<HTMLElement>('.gd-dial-item');
    if (dialItem?.dataset.channel) return changeChannel(dialItem.dataset.channel);

    const startBtn = target.closest<HTMLElement>('[data-start]');
    if (startBtn && !startBtn.hasAttribute('disabled')) {
      options.onStart(startBtn.dataset.start === 'friend');
      return;
    }

    const photo = target.closest<HTMLElement>('[data-opponent]');
    if (photo?.dataset.opponent) {
      const next = photo.dataset.opponent as OpponentType;
      if (next !== opponent) {
        opponent = next;
        render();
        options.onOpponent(next);
      }
      return;
    }

    const lookBtn = target.closest<HTMLElement>('[data-look]');
    if (lookBtn?.dataset.look) {
      const next = lookBtn.dataset.look as LookId;
      if (next !== look) {
        look = next;
        render();
        options.onLook(next);
      }
      return;
    }

    const schemeBtn = target.closest<HTMLElement>('[data-scheme]');
    if (schemeBtn?.dataset.scheme) {
      const next = schemeBtn.dataset.scheme as ControlScheme;
      if (next !== scheme) {
        scheme = next;
        render();
        options.onScheme(next);
      }
      return;
    }

    const lengthBtn = target.closest<HTMLElement>('[data-match-length]');
    if (lengthBtn?.dataset.matchLength) {
      const next = Number(lengthBtn.dataset.matchLength) as 10 | 5;
      if (next !== matchLength) {
        matchLength = next;
        render();
        options.onMatchLength(next);
      }
      return;
    }

    const linkBtn = target.closest<HTMLElement>('[data-link]');
    if (linkBtn?.dataset.link === 'how') return options.onHowToPlay();
    if (linkBtn?.dataset.link === 'settings') return options.onSettings();
    if (linkBtn?.dataset.link === 'records') return options.onRecords();
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === '[') {
      event.preventDefault();
      stepChannel(-1);
    } else if (event.key === ']') {
      event.preventDefault();
      stepChannel(1);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  render();
  options.host.append(root);

  return {
    show() {
      root.hidden = false;
      scrollSelectedDialIntoView();
      requestAnimationFrame(() => {
        root
          .querySelector<HTMLButtonElement>('.gd-modes .is-primary')
          ?.focus({ preventScroll: true });
      });
    },
    setSwitches(next) {
      switches = next;
      render();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
