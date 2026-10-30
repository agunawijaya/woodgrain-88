/**
 * Trailblaze game menu: channel dial with 19 channels in four groups,
 * channel facts icons, mode selection (duel, computer 1977, doodle, four-way),
 * opponent picker with the six Kids and Computer 1977, look switcher, scoring,
 * difficulty switches, and links to How to play, Settings, Records and Doodle gallery.
 */
import {
  KIDS,
  kidById,
  kidPortraitSvg,
  type KidId,
  type MemoryMode,
  type SwitchPosition,
} from '@woodgrain-88/kit';
import {
  CHANNELS,
  channelById,
  channelFacts,
  type ChannelFacts,
  type TrailblazeChannel,
} from '../channels.ts';
import type { LookId } from '../look/look.ts';
import { TRAILBLAZE_PATCHES } from '../progress/patches.ts';
import {
  computerPortraitSvg,
  DISPLAY_FONT,
  ensureScreenStyle,
  escapeText,
  LEGIBLE_FONT,
  wordmarkMarkup,
} from './style.ts';

export type OpponentType = KidId | 'computer';

export type TrailblazePlayMode =
  'kid' | 'versus' | 'computer' | 'doodle' | 'doodle-together' | 'four-way' | 'four-way-two';

export interface MenuOptions {
  readonly host: HTMLElement;
  readonly channelId?: string;
  readonly opponent?: OpponentType;
  readonly look?: LookId;
  readonly matchLength?: 10 | 5;
  readonly switches?: readonly [SwitchPosition, SwitchPosition];
  readonly memory?: MemoryMode;
  readonly isUnlocked?: (channelId: string) => boolean;
  /** The chosen look's two riders up close, for the card at the top right; left out without GL. */
  readonly riders?: MenuRiders;
  readonly onStart?: (mode: TrailblazePlayMode, channelId: string, opponent: OpponentType) => void;
  readonly onChannel?: (channelId: string) => void;
  readonly onOpponent?: (opponent: OpponentType) => void;
  readonly onLook?: (look: LookId) => void;
  readonly onMatchLength?: (matchLength: 10 | 5) => void;
  readonly onSwitches?: (switches: readonly [SwitchPosition, SwitchPosition]) => void;
  readonly onHowToPlay?: () => void;
  readonly onSettings?: () => void;
  readonly onRecords?: () => void;
  readonly onGallery?: () => void;
}

export interface MenuRiders {
  /** The look's name, for the card's label. */
  readonly look: string;
  /** Seat 1's rider first, each with its close-up (rider-portrait.ts) and its seat's colour. */
  readonly seats: readonly {
    readonly name: string;
    readonly colour: string;
    readonly portrait: HTMLCanvasElement;
  }[];
}

export interface MenuScreen {
  show(): void;
  hide(): void;
  setChannel(channelId: string): void;
  setSwitches(switches: readonly [SwitchPosition, SwitchPosition]): void;
  dispose(): void;
}

export const KID_LINES: Readonly<Record<OpponentType, string>> = {
  lou: 'Reads the whole board, then turns a beat late.',
  moss: 'Claims the big side early and keeps clear of trouble.',
  rosa: 'Hunts you. She will cut straight across your path.',
  benny: 'Copies your turns a moment after you make them.',
  dee: 'The quickest hands on the street. Boxes herself in.',
  pip: 'Wanders about, then springs a trap out of nowhere.',
  computer: 'Never blinks, never plans. Looks three cells ahead (six on switch A).',
};

const LOOK_NAMES: Readonly<Record<LookId, string>> = {
  neon: 'Neon Grid',
  trains: 'Toy Trains',
  mummy: "Mummy's Wrap",
  ice: 'Ice Trail',
};

const LOOK_SWATCHES: Readonly<Record<LookId, { bg: string; s0: string; s1: string }>> = {
  neon: { bg: '#060b14', s0: '#ff8a2a', s1: '#38a8ff' },
  trains: { bg: '#233320', s0: '#d87a2a', s1: '#3c8cd8' },
  mummy: { bg: '#dfd4be', s0: '#c06820', s1: '#2878b8' },
  ice: { bg: '#dceaf5', s0: '#e67828', s1: '#207cd4' },
};

const STYLE = /* css */ `
.tb-menu {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.tb-menu-panel {
  --tb-panel-top: clamp(68px, 10vh, 100px);
  position: absolute;
  left: clamp(16px, 3vw, 56px);
  top: var(--tb-panel-top);
  max-height: calc(100vh - var(--tb-panel-top) - 16px);
  width: min(480px, 42vw);
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vh, 12px);
  overflow: hidden;
}

.tb-title-panel {
  flex-shrink: 0;
  padding: clamp(12px, 1.6vh, 18px) clamp(16px, 2vw, 22px);
  display: grid;
  gap: 6px;
}

.tb-channel-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  background: var(--tb-text);
  color: var(--tb-panel-bg);
  font-family: ${DISPLAY_FONT};
  font-size: clamp(15px, 2vh, 19px);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.tb-channel-origin {
  margin: 0;
  font-size: clamp(13px, 1.6vh, 15px);
  color: var(--tb-muted);
}

.tb-menu-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(12px, 1.6vh, 18px) clamp(16px, 2vw, 22px);
  overflow: hidden;
}

.tb-menu-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--tb-border) transparent;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vh, 12px);
  padding-right: 4px;
}

.tb-menu-scroll::-webkit-scrollbar {
  width: 6px;
}

.tb-menu-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.tb-menu-scroll::-webkit-scrollbar-thumb {
  background: var(--tb-border);
  border-radius: 3px;
}

/* Dial */
.tb-dial-wrap {
  display: grid;
  gap: 6px;
}

.tb-dial-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tb-dial-nav {
  display: flex;
  gap: 6px;
}

.tb-dial-nav button {
  appearance: none;
  border: 1px solid var(--tb-border);
  background: var(--tb-well);
  color: var(--tb-text);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font: 700 12px ${LEGIBLE_FONT};
}

.tb-dial-nav button:hover {
  background: var(--tb-text);
  color: var(--tb-panel-bg);
}

.tb-dial-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scroll-behavior: smooth;
}

.tb-dial-item {
  appearance: none;
  border: 1px solid var(--tb-border);
  background: var(--tb-panel-bg);
  color: var(--tb-text);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  display: grid;
  gap: 4px;
  min-width: 80px;
  flex-shrink: 0;
  text-align: left;
}

.tb-dial-item[aria-selected='true'] {
  border-color: var(--tb-seat-1);
  box-shadow: 0 0 0 2px var(--tb-seat-1);
}

.tb-dial-item.is-locked {
  opacity: 0.65;
}

.tb-dial-title {
  font: 700 12px/1.2 ${LEGIBLE_FONT};
  white-space: nowrap;
}

.tb-dial-facts {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--tb-muted);
}

.tb-fact-icon {
  width: 14px;
  height: 14px;
  display: block;
}

/* Modes */
.tb-modes {
  display: grid;
  gap: 6px;
}

.tb-modes .tb-button {
  justify-content: space-between;
  width: 100%;
  padding: 0.45em 1em;
  text-align: left;
}

.tb-modes .tb-button > span:first-child {
  display: grid;
  justify-items: start;
  gap: 2px;
}

.tb-modes .tb-button small {
  font: 600 clamp(12px, 1.5vh, 14px)/1.2 ${LEGIBLE_FONT};
  letter-spacing: 0.01em;
  text-transform: none;
  opacity: 0.88;
}

.tb-choices {
  display: flex;
  flex-direction: column;
  gap: clamp(7px, 1vh, 10px);
}

.tb-choice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

.tb-swatches {
  display: flex;
  gap: 6px;
}

.tb-swatch-button {
  appearance: none;
  border: 1px solid var(--tb-border);
  border-radius: 6px;
  padding: 3px;
  background: transparent;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
}

.tb-swatch-button[aria-checked='true'] {
  outline: 2px solid var(--tb-seat-1);
}

.tb-swatch-svg {
  width: 32px;
  height: 22px;
  border-radius: 3px;
  display: block;
}

.tb-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  font-size: clamp(14px, 1.7vh, 16px);
}

.tb-switches b {
  font-weight: 800;
}

.tb-switches-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.tb-switch-hint {
  margin: 0;
  font-size: clamp(12px, 1.4vh, 14px);
  color: var(--tb-muted);
  line-height: 1.35;
}

.tb-links {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px solid var(--tb-border);
}

/* The chosen look's riders, up close, top right: the whole-board camera is too far to show them. */
.tb-menu-riders {
  position: absolute;
  top: clamp(68px, 10vh, 100px);
  right: 24px;
  width: min(380px, 30vw);
  padding: 12px 14px 14px;
  display: grid;
  gap: 10px;
  pointer-events: none;
}

.tb-menu-riders-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tb-menu-rider {
  display: grid;
  gap: 6px;
  margin: 0;
}

.tb-menu-rider-well {
  aspect-ratio: 3 / 2;
  border-radius: 6px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 62% 40% at 50% 78%, color-mix(in srgb, var(--seat) 30%, transparent), transparent 72%),
    var(--tb-well);
}

.tb-menu-rider-well canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.tb-menu-rider figcaption {
  font-weight: 700;
  font-size: clamp(13px, 1.6vh, 15px);
  padding-bottom: 3px;
  border-bottom: 3px solid var(--seat);
}

/* Opponent picker on bottom right */
.tb-rivals {
  --row-max-width: calc(7 * 120px + 6 * 10px);
  position: absolute;
  left: calc(clamp(16px, 3vw, 56px) + min(480px, 42vw) + 24px);
  right: 24px;
  bottom: clamp(16px, 3vh, 40px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  transition: opacity 160ms ease;
}

.tb-rivals > .tb-label {
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  text-align: right;
  width: 100%;
}

.tb-photos {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  max-width: var(--row-max-width);
  gap: clamp(4px, 0.7vw, 10px);
}

.tb-photos .tb-photo {
  flex: 1 1 0;
  max-width: 120px;
  min-width: 64px;
  width: auto;
}

.tb-rival-note {
  width: 100%;
  max-width: var(--row-max-width);
  padding: 14px 16px 12px;
  font-size: clamp(13px, 1.6vh, 15px);
  line-height: 1.4;
  box-sizing: border-box;
}

.tb-rival-note p { margin: 0; }
.tb-rival-note .tb-memory-note {
  margin-top: 6px;
  color: var(--tb-muted);
}

@media (max-width: 840px) {
  .tb-menu { overflow-y: auto; }
  .tb-menu-panel {
    position: relative;
    left: auto;
    top: auto;
    max-height: none;
    width: auto;
    margin: 64px 16px 16px;
    overflow: visible;
  }
  .tb-menu-card {
    overflow: visible;
  }
  .tb-menu-scroll {
    overflow: visible;
  }
  .tb-menu-riders {
    position: static;
    width: auto;
    margin: 0 16px 16px;
  }
  .tb-rivals {
    position: static;
    left: auto;
    right: auto;
    margin: 0 16px 24px;
    max-width: none;
    align-items: flex-start;
  }
  .tb-rivals > .tb-label {
    text-align: left;
  }
  .tb-photos { flex-wrap: wrap; justify-content: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .tb-dial-strip {
    scroll-behavior: auto;
  }
}
`;

function factIconsSvg(facts: ChannelFacts): string {
  // 1. speed: flat line vs rising line
  const speedSvg =
    facts.speed === 'constant'
      ? '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="Constant speed"><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="Speed-up"><line x1="2" y1="11" x2="11" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="6 3 11 3 11 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // 2. edges: closed square vs open square with arrows
  const edgesSvg =
    facts.edges === 'bordered'
      ? '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="Bordered walls"><rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" rx="1"/></svg>'
      : '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="Wraparound edges"><path d="M 2 4 L 2 10 M 12 4 L 12 10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M 4 7 L 1 7 M 10 7 L 13 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  // 3. steering: 4 arrows vs 8 arrows
  const steeringSvg =
    facts.steering === 4
      ? '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="4-way steering"><path d="M 7 2 L 7 12 M 2 7 L 12 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="8-way steering"><path d="M 7 1 L 7 13 M 1 7 L 13 7 M 3 3 L 11 11 M 3 11 L 11 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // 4. fire: none vs gaps vs erase
  const fireSvg =
    facts.fire === 'none'
      ? '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="No fire button"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4"/></svg>'
      : facts.fire === 'gaps'
        ? '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="Leave gaps with fire"><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 2"/></svg>'
        : '<svg class="tb-fact-icon" viewBox="0 0 14 14" aria-label="Erase with fire"><rect x="3" y="4" width="8" height="6" fill="none" stroke="currentColor" stroke-width="1.5" rx="1"/><line x1="6" y1="4" x2="6" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>';

  return `${speedSvg}${edgesSvg}${steeringSvg}${fireSvg}`;
}

function lookSwatchSvg(lookId: LookId): string {
  const { bg, s0, s1 } = LOOK_SWATCHES[lookId];
  return (
    `<svg class="tb-swatch-svg" viewBox="0 0 32 22" aria-hidden="true">` +
    `<rect width="32" height="22" fill="${bg}" rx="2"/>` +
    `<path d="M 3 5 L 14 5 L 14 16" fill="none" stroke="${s0}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M 29 16 L 19 16 L 19 5" fill="none" stroke="${s1}" stroke-width="2.5" stroke-linecap="round"/>` +
    `</svg>`
  );
}

function patchTitleFor(unlockedBy: string): string {
  const patch = TRAILBLAZE_PATCHES.find((p) => p.id === unlockedBy);
  return patch ? patch.title : unlockedBy;
}

function modesForChannel(
  channel: TrailblazeChannel,
  unlocked: boolean,
  opponent: OpponentType,
): string {
  if (!unlocked) {
    const patchTitle = channel.def.unlockedBy ? patchTitleFor(channel.def.unlockedBy) : '';
    return (
      `<button type="button" class="tb-button is-primary" disabled>` +
      `<span>LOCKED<small>Opens with ${escapeText(patchTitle)}</small></span></button>`
    );
  }
  if (channel.def.id === 'game-13' || channel.def.id === 'game-14') {
    return (
      `<button type="button" class="tb-button is-primary" data-mode="doodle">` +
      `<span>DOODLE<small>Draw alone, nothing to crash into</small></span>` +
      `<span class="tb-key" aria-hidden="true">Enter</span></button>` +
      `<button type="button" class="tb-button" data-mode="doodle-together">` +
      `<span>DOODLE TOGETHER<small>Two pens, one board</small></span></button>`
    );
  }
  if (channel.def.id === 'four-way') {
    return (
      `<button type="button" class="tb-button is-primary" data-mode="four-way">` +
      `<span>FOUR WAY<small>You and three Kids</small></span>` +
      `<span class="tb-key" aria-hidden="true">Enter</span></button>` +
      `<button type="button" class="tb-button" data-mode="four-way-two">` +
      `<span>FOUR WAY · TWO PLAYERS<small>Two players, two Kids</small></span></button>`
    );
  }
  if (channel.def.id === 'game-2' || channel.def.id === 'game-4') {
    return (
      `<button type="button" class="tb-button is-primary" data-mode="computer">` +
      `<span>VS COMPUTER 1977<small>The cartridge’s own rider</small></span>` +
      `<span class="tb-key" aria-hidden="true">Enter</span></button>` +
      `<button type="button" class="tb-button" data-mode="versus">` +
      `<span>VERSUS<small>Two riders, one keyboard</small></span></button>`
    );
  }
  const oppName = opponent === 'computer' ? 'Computer 1977' : kidById(opponent).name;
  return (
    `<button type="button" class="tb-button is-primary" data-mode="kid">` +
    `<span>VS A KID<small>Against ${escapeText(oppName)}</small></span>` +
    `<span class="tb-key" aria-hidden="true">Enter</span></button>` +
    `<button type="button" class="tb-button" data-mode="versus">` +
    `<span>VERSUS<small>Two riders, one keyboard</small></span></button>` +
    `<button type="button" class="tb-button" data-mode="computer">` +
    `<span>VS COMPUTER 1977<small>The cartridge’s own rider</small></span></button>`
  );
}

export function createMenuScreen(options: MenuOptions): MenuScreen {
  ensureScreenStyle(options.host);

  const root = document.createElement('section');
  root.className = 'tb-screen tb-menu';
  root.setAttribute('aria-label', 'Trailblaze game menu');

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.prepend(style);

  let currentChannelId = options.channelId ?? 'game-1';
  let opponent: OpponentType = options.opponent ?? 'rosa';
  let look: LookId = options.look ?? 'neon';
  let matchLength: 10 | 5 = options.matchLength ?? 10;
  let switches: readonly [SwitchPosition, SwitchPosition] = options.switches ?? ['B', 'B'];

  function isChannelUnlocked(channel: TrailblazeChannel): boolean {
    if (channel.def.kind !== 'remix') return true;
    if (options.isUnlocked) return options.isUnlocked(channel.def.id);
    return true;
  }

  function renderContent(): void {
    const fallback = CHANNELS[0];
    if (!fallback) throw new Error('No channels');
    const channel: TrailblazeChannel = channelById(currentChannelId) ?? fallback;
    const unlocked = isChannelUnlocked(channel);
    const channelIndex = CHANNELS.findIndex((c) => c.def.id === channel.def.id);
    const channelNumStr = String(channelIndex + 1).padStart(2, '0');

    const originText =
      channel.def.kind === 'remix'
        ? `A Remix, opened by ${patchTitleFor(channel.def.unlockedBy ?? '')}.`
        : `Game ${channel.rules.number} of the 14 on the 1977 cartridge.`;

    const modesHtml = modesForChannel(channel, unlocked, opponent);

    // Dial entries
    const dialStripHtml = CHANNELS.map((ch, idx) => {
      const isSelected = ch.def.id === channel.def.id;
      const isChUnlocked = isChannelUnlocked(ch);
      const facts = channelFacts(ch);
      const lockLabel = isChUnlocked ? '' : '🔒 ';
      return (
        `<button type="button" class="tb-dial-item${isChUnlocked ? '' : ' is-locked'}" ` +
        `data-channel="${ch.def.id}" role="tab" aria-selected="${String(isSelected)}">` +
        `<span class="tb-dial-title">${lockLabel}${String(idx + 1).padStart(2, '0')} ${escapeText(ch.def.title)}</span>` +
        `<span class="tb-dial-facts">${factIconsSvg(facts)}</span>` +
        `</button>`
      );
    }).join('');

    // Opponent cards (6 Kids + Computer 1977)
    const photoTilts = ['-2.5deg', '1.5deg', '-1.5deg', '2.5deg', '-2deg', '1deg', '0deg'];
    const kidCardsHtml = KIDS.map((k, index) => {
      const isChosen = opponent === k.id;
      return (
        `<button type="button" class="tb-photo" role="radio" data-opponent="${k.id}" ` +
        `aria-checked="${String(isChosen)}" aria-label="${escapeText(k.name)}" ` +
        `style="--tilt: ${photoTilts[index]}" tabindex="${isChosen ? 0 : -1}">` +
        kidPortraitSvg(k, { expression: 'photo', idPrefix: `tb-menu-${k.id}` }) +
        `<span class="tb-hand">${escapeText(k.name)}</span></button>`
      );
    }).join('');

    const isComputerChosen = opponent === 'computer';
    const computerCardHtml =
      `<button type="button" class="tb-photo" role="radio" data-opponent="computer" ` +
      `aria-checked="${String(isComputerChosen)}" aria-label="Computer 1977" ` +
      `style="--tilt: ${photoTilts[6]}" tabindex="${isComputerChosen ? 0 : -1}">` +
      computerPortraitSvg() +
      `<span class="tb-hand">Computer 1977</span></button>`;

    const opponentNote =
      opponent === 'computer'
        ? `<strong>Computer 1977</strong> · ${KID_LINES.computer}`
        : `<strong>${escapeText(opponent === 'lou' ? 'Grandpa Lou' : kidById(opponent).name)}</strong> · ${escapeText(KID_LINES[opponent])}`;

    const memoryNote = options.memory === 'sharp' ? 'Memory: Sharp' : 'Memory: Human';

    root.innerHTML =
      `<div class="tb-scrim"></div>` +
      `<div class="tb-menu-panel">` +
      `<header class="tb-title-panel tb-card">` +
      wordmarkMarkup() +
      `<div class="tb-title-line">` +
      `<span class="tb-channel-tag">CH ${channelNumStr} · ${escapeText(channel.def.title.toUpperCase())}</span>` +
      `<p class="tb-channel-origin">${escapeText(originText)}</p>` +
      `</div></header>` +
      `<div class="tb-menu-card tb-card">` +
      `<div class="tb-menu-scroll">` +
      // Channel dial
      `<div class="tb-dial-wrap">` +
      `<div class="tb-dial-header">` +
      `<span class="tb-label">Channel dial</span>` +
      `<div class="tb-dial-nav">` +
      `<button type="button" data-action="prev-channel" aria-label="Previous channel">[</button>` +
      `<button type="button" data-action="next-channel" aria-label="Next channel">]</button>` +
      `</div></div>` +
      `<div class="tb-dial-strip" role="tablist" aria-label="Channels">${dialStripHtml}</div>` +
      `</div>` +
      // Modes
      `<div class="tb-modes">${modesHtml}</div>` +
      // Choices (tightened vertical spacing by a third)
      `<div class="tb-choices">` +
      // Look switcher
      `<div class="tb-choice">` +
      `<span class="tb-label" id="tb-look-label">Look</span>` +
      `<div class="tb-swatches" role="radiogroup" aria-labelledby="tb-look-label">` +
      (['neon', 'trains', 'mummy', 'ice'] as const)
        .map(
          (l) =>
            `<button type="button" class="tb-swatch-button" role="radio" data-look="${l}" ` +
            `aria-checked="${String(l === look)}" aria-label="${LOOK_NAMES[l]}">${lookSwatchSvg(l)}</button>`,
        )
        .join('') +
      `</div></div>` +
      // Scoring toggle
      `<div class="tb-choice">` +
      `<span class="tb-label" id="tb-scoring-label">Scoring</span>` +
      `<div class="tb-toggle" role="radiogroup" aria-labelledby="tb-scoring-label" data-group="scoring">` +
      `<button type="button" role="radio" data-match-length="10" ` +
      `aria-checked="${String(matchLength === 10)}">First to 10</button>` +
      `<button type="button" role="radio" data-match-length="5" ` +
      `aria-checked="${String(matchLength === 5)}">First to 5</button>` +
      `</div></div>` +
      // Difficulty switches
      `<div class="tb-choice">` +
      `<span class="tb-label" id="tb-switches-label">Switches</span>` +
      `<p class="tb-switches" aria-live="polite" aria-labelledby="tb-switches-label">` +
      `<span>Left: <b>${switches[0]}</b></span> · <span>Right: <b>${switches[1]}</b></span>` +
      `</p>` +
      `<p class="tb-switch-hint">A: reversing straight back crashes you. B: it is ignored.</p>` +
      `</div>` +
      `</div>` +
      `</div>` +
      // Links (stay visible at the bottom of the card)
      `<div class="tb-links">` +
      `<button type="button" class="tb-link" data-link="how">How to play</button>` +
      `<button type="button" class="tb-link" data-link="settings">Settings</button>` +
      `<button type="button" class="tb-link" data-link="records">Records</button>` +
      `<button type="button" class="tb-link" data-link="gallery">Doodle gallery</button>` +
      `</div>` +
      `</div></div>` +
      ridersHtml() +
      // Opponent picker
      `<div class="tb-rivals">` +
      `<span class="tb-label" id="tb-rivals-label">Pick your rival</span>` +
      `<div class="tb-photos" role="radiogroup" aria-labelledby="tb-rivals-label">` +
      kidCardsHtml +
      computerCardHtml +
      `</div>` +
      `<div class="tb-rival-note tb-card" aria-live="polite">` +
      `<p>${opponentNote}</p>` +
      `<p class="tb-memory-note">${escapeText(memoryNote)}</p>` +
      `</div>` +
      `</div>`;

    root.prepend(style);
    root.querySelectorAll('.tb-menu-rider-well').forEach((well, seat) => {
      const portrait = options.riders?.seats[seat]?.portrait;
      if (portrait) well.append(portrait);
    });
  }

  /** The card's frame; the close-ups go into its wells once the menu is drawn. */
  function ridersHtml(): string {
    const riders = options.riders;
    if (!riders) return '';
    const seats = riders.seats
      .map(
        (seat) =>
          `<figure class="tb-menu-rider" style="--seat: ${seat.colour}">` +
          `<div class="tb-menu-rider-well"></div>` +
          `<figcaption>${escapeText(seat.name)}</figcaption>` +
          `</figure>`,
      )
      .join('');
    return (
      `<section class="tb-menu-riders tb-card" aria-label="Riders in ${escapeText(riders.look)}">` +
      `<span class="tb-label">Riders · ${escapeText(riders.look)}</span>` +
      `<div class="tb-menu-riders-row">${seats}</div>` +
      `</section>`
    );
  }

  function scrollSelectedDialIntoView(): void {
    const selectedItem = root.querySelector<HTMLElement>('.tb-dial-item[aria-selected="true"]');
    if (!selectedItem) return;
    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    selectedItem.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReduced ? 'instant' : 'smooth',
    });
  }

  function changeChannel(channelId: string): void {
    if (channelId === currentChannelId) {
      scrollSelectedDialIntoView();
      return;
    }
    const channel = channelById(channelId);
    if (!channel) return;
    currentChannelId = channelId;
    renderContent();
    options.onChannel?.(channelId);
    scrollSelectedDialIntoView();
  }

  function stepChannel(delta: -1 | 1): void {
    const currentIndex = CHANNELS.findIndex((c) => c.def.id === currentChannelId);
    const nextIndex = (currentIndex + delta + CHANNELS.length) % CHANNELS.length;
    const nextChannel = CHANNELS[nextIndex];
    if (nextChannel) {
      changeChannel(nextChannel.def.id);
    }
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    // Dial nav buttons
    if (target.closest('[data-action="prev-channel"]')) {
      stepChannel(-1);
      return;
    }
    if (target.closest('[data-action="next-channel"]')) {
      stepChannel(1);
      return;
    }

    // Dial item clicked
    const dialItem = target.closest<HTMLElement>('.tb-dial-item');
    if (dialItem?.dataset.channel) {
      changeChannel(dialItem.dataset.channel);
      return;
    }

    // Mode buttons
    const modeBtn = target.closest<HTMLElement>('[data-mode]');
    if (modeBtn && !modeBtn.hasAttribute('disabled')) {
      const mode = modeBtn.dataset.mode as TrailblazePlayMode;
      options.onStart?.(mode, currentChannelId, opponent);
      return;
    }

    // Opponent photo
    const photo = target.closest<HTMLElement>('[data-opponent]');
    if (photo?.dataset.opponent) {
      const nextOpp = photo.dataset.opponent as OpponentType;
      if (nextOpp !== opponent) {
        opponent = nextOpp;
        renderContent();
        options.onOpponent?.(opponent);
      }
      return;
    }

    // Look button
    const lookBtn = target.closest<HTMLElement>('[data-look]');
    if (lookBtn?.dataset.look) {
      const nextLook = lookBtn.dataset.look as LookId;
      if (nextLook !== look) {
        look = nextLook;
        renderContent();
        options.onLook?.(look);
      }
      return;
    }

    // Scoring length
    const scoreBtn = target.closest<HTMLElement>('[data-match-length]');
    if (scoreBtn?.dataset.matchLength) {
      const nextLen = Number(scoreBtn.dataset.matchLength) as 10 | 5;
      if (nextLen !== matchLength) {
        matchLength = nextLen;
        renderContent();
        options.onMatchLength?.(matchLength);
      }
      return;
    }

    // Links
    const linkBtn = target.closest<HTMLElement>('[data-link]');
    if (linkBtn?.dataset.link) {
      const link = linkBtn.dataset.link;
      if (link === 'how') options.onHowToPlay?.();
      if (link === 'settings') options.onSettings?.();
      if (link === 'records') options.onRecords?.();
      if (link === 'gallery') options.onGallery?.();
      return;
    }
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === '[') {
      event.preventDefault();
      stepChannel(-1);
      return;
    }
    if (event.key === ']') {
      event.preventDefault();
      stepChannel(1);
      return;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  renderContent();
  scrollSelectedDialIntoView();
  options.host.append(root);

  return {
    show() {
      root.hidden = false;
      scrollSelectedDialIntoView();
      requestAnimationFrame(() => {
        root
          .querySelector<HTMLButtonElement>('.tb-modes .is-primary')
          ?.focus({ preventScroll: true });
      });
    },
    hide() {
      root.hidden = true;
    },
    setChannel(channelId: string) {
      changeChannel(channelId);
    },
    setSwitches(nextSwitches: readonly [SwitchPosition, SwitchPosition]) {
      switches = nextSwitches;
      renderContent();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
