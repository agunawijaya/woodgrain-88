/**
 * The results card, over the field as it stood at the end (the flag still
 * flying): who won or how the hunt went, the score, the Kid's word on it,
 * what the Kid remembered of the match, any patches stitched, and the way on:
 * Play again (R), Game menu, Back to the Hall (H).
 */
import {
  kidById,
  kidPortraitSvg,
  patchSvg,
  type KidExpression,
  type KidMemory,
  type PatchEarned,
  type ResultReceipt,
} from '@woodgrain-88/kit';
import type { ClueMode, KidPlayer } from '../ai/kid.ts';
import { kidLine, MEMORY_INTROS, type KidMood } from '../copy/kid-lines.ts';
import { BEARINGS, spotOf, type Square } from '../engine/grid.ts';
import type { Match, MatchResult } from '../engine/match.ts';
import type { Fact } from '../engine/solver.ts';
import { manifest } from '../manifest.ts';
import { seatOneOutcome } from '../session/result.ts';
import type { HudSeat } from '../ui/hud.ts';
import { escapeText } from './style.ts';

export interface ResultsOptions {
  readonly host: HTMLElement;
  readonly match: Match;
  readonly result: MatchResult | null;
  readonly seats: readonly [HudSeat, HudSeat];
  /** The Kid in seat 2, with what it remembered; null for a person or nobody. */
  readonly kid: KidPlayer | null;
  readonly clues: ClueMode;
  /** Two people at one machine: the banner names the winning seat. */
  readonly versus: boolean;
  /** Null where nothing is recorded (the tutorial). */
  readonly receipt: ResultReceipt | null;
  /** Why this run is not on the records, if it is not (the fog was on). */
  readonly offRecord: string | null;
  readonly onPlayAgain: () => void;
  readonly onGameMenu: () => void;
  readonly onBackToHall: () => void;
  /** A daily run's share line, with a way to copy it. */
  readonly share?: { readonly line: string; readonly copy: () => Promise<boolean> };
}

export interface ResultsScreen {
  dispose(): void;
}

const STYLE = /* css */ `
.hc-results-panel {
  position: absolute;
  right: clamp(16px, 3vw, 56px);
  top: clamp(64px, 10vh, 110px);
  bottom: clamp(16px, 3vh, 40px);
  width: min(460px, 40vw);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.5vh, 14px);
  overflow-y: auto;
  padding: 4px;
}
.hc-results-panel > * { flex-shrink: 0; }
.hc-banner { padding: clamp(20px, 2.8vh, 28px) 20px clamp(12px, 1.8vh, 16px); display: grid; gap: 6px; }
.hc-banner h2 { margin: 0; font-size: clamp(38px, 6.6vh, 72px); }
.hc-banner p { margin: 0; font-size: clamp(15px, 1.9vh, 18px); color: var(--hc-ink-soft); }
.hc-scores { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hc-scores.is-alone { grid-template-columns: 1fr; }
.hc-score-card { padding: 16px 14px 12px; display: grid; gap: 2px; border-left: 8px solid var(--seat); }
.hc-score-card .hc-name { font-weight: 800; font-size: clamp(14px, 1.8vh, 17px); }
.hc-score-card .hc-value { font-size: clamp(36px, 6vh, 60px); line-height: 1; }
.hc-score-card .hc-unit { font-size: clamp(12px, 1.5vh, 14px); color: var(--hc-ink-soft); }
.hc-winner { color: var(--hc-hot); font-size: clamp(12px, 1.4vh, 13px); font-weight: 800; letter-spacing: 0.12em; }
.hc-kid-say { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; }
.hc-kid-say .hc-photo { cursor: default; width: clamp(78px, 7vw, 104px); }
.hc-kid-say blockquote { margin: 0; padding: 16px 16px 12px; font-size: clamp(19px, 2.5vh, 24px); line-height: 1.25; }
.hc-memory { padding: 14px 16px 12px; }
.hc-memory summary {
  cursor: pointer;
  list-style: none;
  display: grid;
  gap: 4px;
  padding-top: 4px;
  border-radius: 6px;
}
.hc-memory summary::-webkit-details-marker { display: none; }
.hc-memory summary:focus-visible { outline: 3px solid var(--hc-focus); outline-offset: 3px; }
.hc-memory-title { font-weight: 800; font-size: clamp(16px, 2vh, 19px); display: flex; justify-content: space-between; gap: 8px; }
.hc-memory-title::after { content: '▸'; transition: transform 160ms ease; }
.hc-memory[open] .hc-memory-title::after { transform: rotate(90deg); }
.hc-tally { display: flex; flex-wrap: wrap; gap: 6px; }
.hc-memory-body { display: grid; gap: 10px; margin-top: 10px; font-size: clamp(14px, 1.7vh, 16px); line-height: 1.4; }
.hc-memory-body p { margin: 0; }
.hc-memory-body ul { margin: 2px 0 0; padding-left: 1.2em; }
.hc-facts { padding: 14px 16px 10px; display: grid; gap: 4px; font-size: clamp(14px, 1.7vh, 16px); }
.hc-facts div { display: flex; justify-content: space-between; gap: 12px; }
.hc-facts dt { color: var(--hc-ink-soft); }
.hc-facts dd { margin: 0; font-weight: 700; }
.hc-patches { padding: 16px 16px 12px; display: grid; gap: 8px; }
.hc-patch { display: flex; align-items: center; gap: 12px; font-weight: 700; }
.hc-share { padding: 16px 16px 10px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.hc-share span { font-size: clamp(14px, 1.7vh, 16px); }
.hc-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hc-actions .is-primary { grid-column: 1 / -1; }
.hc-actions .hc-button { justify-content: space-between; }
@media (prefers-reduced-motion: reduce) { .hc-memory-title::after { transition: none; } }
@media (max-width: 760px) {
  .hc-results-panel { position: relative; inset: auto; width: auto; margin: 72px 12px 12px; }
  .hc-results { overflow-y: auto; }
}
`;

const COLUMN_LETTERS = 'ABCDEFGHI';
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

/** A square as a player reads it: column letter and row number, "C4". */
export function squareName(square: Square): string {
  const { column, row } = spotOf(square);
  return `${COLUMN_LETTERS[column] ?? '?'}${row + 1}`;
}

/** A remembered clue in a few words: "a 3 on C4", "an arrow ↗ on B2". */
export function factText(fact: Fact): string {
  const at = squareName(fact.square);
  switch (fact.clue.kind) {
    case 'distance':
      return `a ${fact.clue.distance} on ${at}`;
    case 'arrow':
      return `an arrow ${ARROWS[BEARINGS.indexOf(fact.clue.bearing)] ?? ''} on ${at}`;
    case 'bomb':
      return `a bomb on ${at}`;
    case 'flag':
      return `the flag on ${at}`;
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

interface Headline {
  readonly title: string;
  readonly line: string;
}

function headline(options: ResultsOptions): Headline {
  const { match, result, seats } = options;
  const flags = match.seats[0].captures;
  const kidName = options.kid ? kidById(options.kid.kid).name : seats[1].name;
  if (!result) return { title: 'Time!', line: `${plural(flags, 'flag')} found.` };
  switch (result.kind) {
    case 'single':
      return {
        title: `Found in ${plural(result.checks, 'check')}`,
        line: 'Today’s flag: the same field for everyone.',
      };
    case 'clock':
      return {
        title: plural(result.captures, 'flag'),
        line: 'Found before the clock ran out.',
      };
    case 'hunts':
      if (match.setup.seats === 1) {
        return { title: plural(flags, 'flag'), line: `Found in ${match.rules.goal} checks.` };
      }
      break;
    case 'first-to':
      break;
  }
  const outcome = seatOneOutcome(result, match.setup.seats);
  if (outcome === 'draw') return { title: 'Draw', line: 'Same number of checks each.' };
  const goal =
    result.kind === 'first-to' ? `First to ${match.rules.goal} flags.` : 'Fewest checks wins.';
  if (options.versus) {
    const winner = outcome === 'win' ? seats[0].name : seats[1].name;
    return { title: `${winner} wins`, line: goal };
  }
  return { title: outcome === 'win' ? 'You win' : `${kidName} wins`, line: goal };
}

function scoresMarkup(options: ResultsOptions): string {
  const { match, result, seats } = options;
  const alone = match.setup.seats === 1;
  const counting = match.rules.style === 'hunts' || match.rules.singleHunt;
  const outcome = seatOneOutcome(result, match.setup.seats);
  const card = (index: 0 | 1) => {
    const state = match.seats[index];
    // A single hunt ends on the flag, before its last check is counted: read the checks made.
    const value = match.rules.singleHunt ? state.checks : counting ? state.score : state.captures;
    const unit = match.rules.singleHunt
      ? value === 1
        ? 'check'
        : 'checks'
      : counting
        ? `checks · ${plural(state.captures, 'flag')}`
        : value === 1
          ? 'flag'
          : 'flags';
    const won = (index === 0 && outcome === 'win') || (index === 1 && outcome === 'loss');
    return (
      `<div class="hc-score-card hc-card" style="--seat: ${seats[index].colours.main}">` +
      (won && !alone ? '<span class="hc-winner">WINNER</span>' : '') +
      `<span class="hc-name">${escapeText(seats[index].name)}</span>` +
      `<span class="hc-value hc-display">${value}</span>` +
      `<span class="hc-unit">${escapeText(unit)}</span></div>`
    );
  };
  return `<div class="hc-scores${alone ? ' is-alone' : ''}">${card(0)}${alone ? '' : card(1)}</div>`;
}

function kidMood(options: ResultsOptions): { mood: KidMood; expression: KidExpression } {
  const outcome = seatOneOutcome(options.result, options.match.setup.seats);
  if (outcome === 'loss') return { mood: 'won', expression: 'win' };
  if (outcome === 'win') return { mood: 'lost', expression: 'lose' };
  return { mood: 'draw', expression: 'photo' };
}

function kidSayMarkup(options: ResultsOptions): string {
  if (!options.kid) return '';
  const kid = kidById(options.kid.kid);
  const { mood, expression } = kidMood(options);
  const line = kidLine(kid.id, mood, options.match.tick);
  return (
    `<div class="hc-kid-say">` +
    `<div class="hc-photo" style="--tilt: -2deg">` +
    kidPortraitSvg(kid, { expression, idPrefix: `hc-results-${kid.id}` }) +
    `<span class="hc-hand">${escapeText(kid.name)}</span></div>` +
    `<blockquote class="hc-card hc-hand">“${escapeText(line)}”</blockquote></div>`
  );
}

function listMarkup(heading: string, items: readonly string[]): string {
  if (items.length === 0) return '';
  const shown = items.slice(0, 4);
  const more =
    items.length > shown.length ? `<li>and ${items.length - shown.length} more</li>` : '';
  return (
    `<p><strong>${escapeText(heading)}</strong></p><ul>` +
    shown.map((item) => `<li>${escapeText(item)}</li>`).join('') +
    more +
    `</ul>`
  );
}

/** "What Lou remembered": the Kid's memory of the match, for the curious. */
export function memoryPanelMarkup(kid: KidPlayer, clues: ClueMode): string {
  const name = kidById(kid.kid).name;
  const memory: KidMemory<Fact> = kid.memory;
  if (clues === 'notebook') {
    return (
      `<details class="hc-memory hc-card"><summary>` +
      `<span class="hc-memory-title">What ${escapeText(name)} remembered</span>` +
      `<span class="hc-tally"><span class="hc-badge is-notebook">Notebook</span></span></summary>` +
      `<div class="hc-memory-body"><p>Every clue stayed on the field, so ${escapeText(name)} did not ` +
      `need to remember them. Instead ${escapeText(name)} read at most ` +
      `${memory.profile.capacity} of them at a time, the way a person takes in a busy board.</p>` +
      `<p>Play in Classic Memory to see what ${escapeText(name)} keeps, forgets and mixes up.</p></div></details>`
    );
  }
  const summary = memory.summary();
  const mixed = summary.misremembered.map(
    ({ truth, belief }) => `${factText(truth)} became ${factText(belief)}`,
  );
  return (
    `<details class="hc-memory hc-card"><summary>` +
    `<span class="hc-memory-title">What ${escapeText(name)} remembered</span>` +
    `<span class="hc-tally">` +
    `<span class="hc-badge">Kept ${summary.kept.length}</span>` +
    `<span class="hc-badge">Forgot ${summary.forgotten.length}</span>` +
    `<span class="hc-badge">Mixed up ${summary.misremembered.length}</span>` +
    `<span class="hc-badge">Missed ${summary.missed.length}</span>` +
    `</span></summary>` +
    `<div class="hc-memory-body">` +
    `<p>${escapeText(MEMORY_INTROS[kid.kid])}</p>` +
    listMarkup('Still remembers', summary.kept.map(factText)) +
    listMarkup('Forgot', summary.forgotten.map(factText)) +
    listMarkup('Mixed up', mixed) +
    listMarkup('Never noticed you find', summary.missed.map(factText)) +
    `</div></details>`
  );
}

function factsMarkup(options: ResultsOptions): string {
  const rows: [string, string][] = [];
  const me = options.match.seats[0];
  rows.push(['Your checks', String(me.checks)]);
  rows.push(['Clues', options.clues === 'classic' ? 'Classic Memory' : 'Notebook']);
  if (options.receipt?.newBest && me.captures > 0)
    rows.push(['Record', 'New best on this channel']);
  if (options.offRecord) rows.push(['Record', options.offRecord]);
  return (
    `<dl class="hc-facts hc-card">` +
    rows
      .map(
        ([term, value]) => `<div><dt>${escapeText(term)}</dt><dd>${escapeText(value)}</dd></div>`,
      )
      .join('') +
    `</dl>`
  );
}

function patchMarkup(earned: PatchEarned): string {
  const svg = patchSvg(
    {
      tier: earned.patch.tier,
      emblem: manifest.emblem,
      colours: { ground: '#264653', thread: '#fdf0d5', border: '#c25b2b' },
      gold: earned.gold,
      state: 'earned',
      seed: earned.patch.id,
      title: earned.patch.title,
    },
    56,
  );
  return (
    `<div class="hc-patch">${svg}<span>${escapeText(earned.patch.title)}` +
    (earned.gold ? ' · gold thread' : '') +
    `</span></div>`
  );
}

function patchesMarkup(receipt: ResultReceipt | null): string {
  if (!receipt?.patchesEarned.length) return '';
  return (
    `<div class="hc-patches hc-card"><span class="hc-label">Patches stitched</span>` +
    receipt.patchesEarned.map(patchMarkup).join('') +
    `</div>`
  );
}

export function createResultsScreen(options: ResultsOptions): ResultsScreen {
  const root = document.createElement('section');
  root.className = 'hc-screen hc-results';
  root.setAttribute('aria-label', 'Match results');
  const style = document.createElement('style');
  style.textContent = STYLE;
  const top = headline(options);

  root.innerHTML =
    `<div class="hc-scrim" style="transform: scaleX(-1)"></div>` +
    `<div class="hc-results-panel">` +
    `<header class="hc-banner hc-card"><h2 class="hc-display">${escapeText(top.title)}</h2>` +
    `<p>${escapeText(top.line)}</p></header>` +
    scoresMarkup(options) +
    patchesMarkup(options.receipt) +
    (options.share
      ? `<div class="hc-share hc-card"><span>${escapeText(options.share.line)}</span>` +
        `<button type="button" class="hc-link" data-action="copy-share">Copy</button></div>`
      : '') +
    kidSayMarkup(options) +
    // The way on comes before the curiosities, so it is in view without scrolling.
    `<div class="hc-actions">` +
    `<button type="button" class="hc-button is-primary" data-action="play-again">` +
    `<span>${options.versus ? 'Rematch' : 'Play again'}</span><span class="hc-key" aria-hidden="true">R</span></button>` +
    `<button type="button" class="hc-button" data-action="game-menu"><span>Game menu</span></button>` +
    `<button type="button" class="hc-button" data-action="back-to-hall">` +
    `<span>Back to the Hall</span><span class="hc-key" aria-hidden="true">H</span></button>` +
    `</div>` +
    (options.kid ? memoryPanelMarkup(options.kid, options.clues) : '') +
    factsMarkup(options) +
    `</div>`;
  root.prepend(style);
  options.host.append(root);

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-action]');
    const action = button?.dataset.action;
    if (action === 'play-again') options.onPlayAgain();
    if (action === 'game-menu') options.onGameMenu();
    if (action === 'back-to-hall') options.onBackToHall();
    if (action === 'copy-share' && options.share && button) {
      void options.share.copy().then((copied) => {
        button.textContent = copied ? 'Copied' : 'Copy failed';
      });
    }
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.code === 'KeyR') {
      event.preventDefault();
      options.onPlayAgain();
    } else if (event.code === 'KeyH') {
      event.preventDefault();
      options.onBackToHall();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  root
    .querySelector<HTMLButtonElement>('[data-action="play-again"]')
    ?.focus({ preventScroll: true });

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
