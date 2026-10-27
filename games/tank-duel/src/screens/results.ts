/**
 * Results screen: final score, victory banner, the Kid's personal reaction,
 * facts and earned patches, and navigation to play again, return to the game
 * menu, or leave to the Hall. Sits beside the tabletop replay of the best hit.
 */
import {
  kidById,
  kidPortraitSvg,
  patchSvg,
  type KidExpression,
  type KidId,
  type PatchEarned,
  type ResultReceipt,
} from '@woodgrain-88/kit';
import { kidLine, type KidMood } from '../copy/kid-lines.ts';
import type { ChannelRules, MatchState } from '../engine/types.ts';
import { manifest } from '../manifest.ts';
import type { HudSeat } from '../ui/hud.ts';
import { escapeText } from './style.ts';

export interface ResultsOptions {
  readonly host: HTMLElement;
  readonly channel: ChannelRules;
  readonly final: MatchState;
  readonly seats: readonly [HudSeat, HudSeat];
  readonly kids: readonly [KidId | null, KidId | null];
  /** Two people: a winner banner per seat, and "Rematch" instead of "Play again". */
  readonly versus: boolean;
  /** Null in practice, where nothing is recorded. */
  readonly receipt: ResultReceipt | null;
  readonly bestBank: number;
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
.td-results {
  position: absolute;
  inset: 0;
  display: grid;
  pointer-events: none;
}
.td-results > * {
  pointer-events: auto;
}
.td-results-panel {
  position: absolute;
  left: clamp(16px, 3vw, 56px);
  top: clamp(24px, 4vh, 48px);
  bottom: clamp(16px, 3vh, 32px);
  width: min(440px, 40vw);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.6vh, 16px);
  overflow-y: auto;
  scrollbar-width: thin;
  padding-right: 6px;
  box-sizing: border-box;
}
.td-results-banner {
  padding: clamp(12px, 2vh, 20px);
  text-align: center;
  font-size: clamp(32px, 5vh, 52px);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.td-results-scores {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(8px, 1.2vw, 16px);
}
.td-score-plate {
  position: relative;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  box-sizing: border-box;
}
.td-score-plate[data-side='0'] {
  background: var(--td-team-0);
  color: #1f170f;
}
.td-score-plate[data-side='1'] {
  background: var(--td-team-1);
  color: #1f170f;
}
/* By night the plates glow in their team colours, lit from behind like the match's own. */
.td-screens[data-appearance='dark'] .td-score-plate[data-side='0'],
.td-screens[data-appearance='dark'] .td-score-plate[data-side='1'] {
  color: #fff3d6;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.td-screens[data-appearance='dark'] .td-score-plate[data-side='0'] {
  background:
    radial-gradient(120% 140% at 50% 0%, rgba(255, 255, 255, 0.2), transparent 60%),
    color-mix(in srgb, var(--td-team-0) 72%, #120c08);
  box-shadow: 0 0 22px color-mix(in srgb, var(--td-team-0) 50%, transparent), 0 4px 12px rgba(0, 0, 0, 0.6);
}
.td-screens[data-appearance='dark'] .td-score-plate[data-side='1'] {
  background:
    radial-gradient(120% 140% at 50% 0%, rgba(255, 255, 255, 0.2), transparent 60%),
    color-mix(in srgb, var(--td-team-1) 72%, #120c08);
  box-shadow: 0 0 22px color-mix(in srgb, var(--td-team-1) 50%, transparent), 0 4px 12px rgba(0, 0, 0, 0.6);
}
.td-score-name {
  font-size: clamp(14px, 2vh, 18px);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.td-score-val {
  font-size: clamp(28px, 4.4vh, 48px);
  line-height: 1;
}
.td-winner-ribbon {
  position: absolute;
  top: -8px;
  right: 12px;
  background: var(--td-mustard);
  color: #22160a;
  font-family:
    'Big Shoulders Display Variable', 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 3px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  text-transform: uppercase;
}
.td-results-kid {
  display: flex;
  align-items: center;
  gap: 14px;
}
.td-kid-note {
  flex: 1;
  padding: 12px 16px;
  font-size: clamp(16px, 2.2vh, 20px);
  line-height: 1.35;
  background: #fbf7ee;
  color: #22160a;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transform: rotate(1deg);
}
.td-screens[data-appearance='dark'] .td-kid-note {
  background: #efe6d3;
  color: #1a140e;
}
.td-results-facts {
  padding: 10px 16px;
  display: grid;
  gap: 6px;
}
.td-fact-row {
  font-size: clamp(14px, 1.8vh, 16px);
  font-weight: 600;
}
.td-results-patches {
  padding: 12px 16px;
  display: grid;
  gap: 10px;
}
.td-patches-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.td-patch-earned {
  display: flex;
  align-items: center;
  gap: 12px;
}
.td-patch-details {
  display: grid;
  gap: 2px;
}
.td-patch-title {
  font-weight: 700;
  font-size: clamp(14px, 1.8vh, 16px);
}
.td-patch-gold {
  font-size: 12px;
  font-weight: 700;
  color: var(--td-mustard);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.td-results-share {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  font-size: clamp(14px, 1.7vh, 16px);
}
.td-share-line { overflow-wrap: anywhere; }
.td-results-actions {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}
.td-results-actions .td-button {
  justify-content: space-between;
  width: 100%;
}
.td-replay-chip {
  position: absolute;
  top: clamp(16px, 2.5vh, 28px);
  right: clamp(20px, 3vw, 48px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(31, 23, 15, 0.75);
  backdrop-filter: blur(4px);
  color: var(--td-cream);
  font-family:
    'Big Shoulders Display Variable', 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  font-weight: 800;
  font-size: clamp(14px, 1.8vh, 18px);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.td-red-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff3b30;
  box-shadow: 0 0 8px #ff3b30;
  animation: td-pulse 1.4s ease-in-out infinite;
}
@keyframes td-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}
@media (prefers-reduced-motion: reduce) {
  .td-red-dot { animation: none; }
}
@media (max-width: 760px) {
  .td-results-panel {
    width: auto;
    right: 16px;
  }
}
`;

function bannerText(options: ResultsOptions): string {
  const { final, seats, kids, versus } = options;
  if (final.winner === null) return 'Draw';

  if (versus) {
    const winnerSeat = seats[final.winner];
    return `${winnerSeat.name} wins`;
  }

  if (final.winner === 0) return 'You win';

  const kidId = kids[1];
  if (kidId) {
    const kid = kidById(kidId);
    return `${kid.name} wins`;
  }

  const seat = seats[1];
  return `${seat.name} wins`;
}

function scorePlatesMarkup(
  final: MatchState,
  seats: readonly [HudSeat, HudSeat],
  versus: boolean,
): string {
  const winnerSide = final.winner;
  return (
    `<div class="td-results-scores">` +
    `<div class="td-score-plate td-plate" data-side="0">` +
    (versus && winnerSide === 0 ? `<span class="td-winner-ribbon">WINNER</span>` : '') +
    `<div class="td-score-who">` +
    `<span class="td-score-name">${escapeText(seats[0].name)}</span>` +
    `</div>` +
    `<span class="td-score-val td-display">${final.scores[0]}</span>` +
    `</div>` +
    `<div class="td-score-plate td-plate" data-side="1">` +
    (versus && winnerSide === 1 ? `<span class="td-winner-ribbon">WINNER</span>` : '') +
    `<div class="td-score-who">` +
    `<span class="td-score-name">${escapeText(seats[1].name)}</span>` +
    `</div>` +
    `<span class="td-score-val td-display">${final.scores[1]}</span>` +
    `</div>` +
    `</div>`
  );
}

function kidReactionMarkup(kids: readonly [KidId | null, KidId | null], final: MatchState): string {
  const kidId = kids[1] ?? kids[0];
  if (!kidId) return '';
  const kidSide: 0 | 1 = kids[1] !== null ? 1 : 0;
  const kid = kidById(kidId);

  let expression: KidExpression = 'photo';
  let mood: KidMood = 'draw';

  if (final.winner === kidSide) {
    expression = 'win';
    mood = 'won';
  } else if (final.winner !== null) {
    expression = 'lose';
    mood = 'lost';
  }

  const seed = Math.round(final.time * 1000);
  const line = kidLine(kidId, mood, seed);

  return (
    `<div class="td-results-kid">` +
    `<div class="td-photo" style="--tilt: -1.5deg; cursor: default;">` +
    kidPortraitSvg(kid, { expression, idPrefix: `td-results-${kid.id}` }) +
    `<span class="td-hand">${escapeText(kid.name)}</span>` +
    `</div>` +
    `<div class="td-kid-note td-panel td-hand">"${escapeText(line)}"</div>` +
    `</div>`
  );
}

/** Records only mean something once a hit has landed: a first match lost 0–14 is no "new best". */
function factsMarkup(receipt: ResultReceipt | null, bestBank: number, hits: number): string {
  if (!receipt) return '';
  const rows: string[] = [];
  if (bestBank > 0) {
    rows.push(`Best bank ×${bestBank}`);
  }
  if (receipt.newBest && hits > 0) {
    rows.push('New best on this channel');
  }
  if (receipt.rank !== null && receipt.rank !== 1 && hits > 0) {
    rows.push(`Rank ${receipt.rank} on this channel`);
  }
  if (rows.length === 0) return '';
  return (
    `<div class="td-results-facts td-panel">` +
    rows.map((row) => `<div class="td-fact-row">${escapeText(row)}</div>`).join('') +
    `</div>`
  );
}

function patchItemMarkup(earned: PatchEarned): string {
  const svg = patchSvg(
    {
      tier: earned.patch.tier,
      emblem: manifest.emblem,
      colours: { ground: '#4d5a2b', thread: '#f4e9cc', border: '#2b3317' },
      gold: earned.gold,
      state: 'earned',
      seed: earned.patch.id,
      title: earned.patch.title,
    },
    64,
  );
  return (
    `<div class="td-patch-earned">` +
    svg +
    `<div class="td-patch-details">` +
    `<span class="td-patch-title">${escapeText(earned.patch.title)}</span>` +
    (earned.gold ? `<span class="td-patch-gold">Gold thread</span>` : '') +
    `</div>` +
    `</div>`
  );
}

function patchesMarkup(receipt: ResultReceipt | null): string {
  if (!receipt?.patchesEarned.length) return '';
  return (
    `<div class="td-results-patches td-panel">` +
    `<span class="td-label">Patches Earned</span>` +
    `<div class="td-patches-list">` +
    receipt.patchesEarned.map(patchItemMarkup).join('') +
    `</div>` +
    `</div>`
  );
}

function actionButtonsMarkup(versus: boolean): string {
  const primaryLabel = versus ? 'Rematch' : 'Play again';
  return (
    `<div class="td-results-actions">` +
    `<button type="button" class="td-button td-plate td-display is-primary" data-action="play-again">` +
    `<span>${primaryLabel}</span>` +
    `<span class="td-key" aria-hidden="true">R</span>` +
    `</button>` +
    `<button type="button" class="td-button td-plate td-display" data-action="game-menu">` +
    `<span>Game menu</span>` +
    `</button>` +
    `<button type="button" class="td-button td-plate td-display" data-action="back-to-hall">` +
    `<span>Back to the Hall</span>` +
    `<span class="td-key" aria-hidden="true">H</span>` +
    `</button>` +
    `</div>`
  );
}

/** Today's line for the share, as the Hall would show it, with its Copy button. */
function shareMarkup(line: string | undefined): string {
  if (line === undefined) return '';
  return (
    `<div class="td-results-share td-panel">` +
    `<span class="td-share-line">${escapeText(line)}</span>` +
    `<button type="button" class="td-link" data-action="copy-share">Copy</button>` +
    `</div>`
  );
}

export function createResultsScreen(options: ResultsOptions): ResultsScreen {
  const root = document.createElement('section');
  root.className = 'td-screen td-results';
  root.setAttribute('aria-label', 'Match results');

  const style = document.createElement('style');
  style.textContent = STYLE;

  const replayChipMarkup =
    `<div class="td-replay-chip">` +
    `<span class="td-red-dot" aria-hidden="true"></span>` +
    `<span>REPLAY · best hit${options.bestBank > 0 ? ` · bank ×${options.bestBank}` : ''}</span>` +
    `</div>`;

  root.innerHTML =
    `<div class="td-scrim"></div>` +
    replayChipMarkup +
    `<div class="td-results-panel">` +
    `<header class="td-results-banner td-plate td-rivets td-display">` +
    `${escapeText(bannerText(options))}</header>` +
    scorePlatesMarkup(options.final, options.seats, options.versus) +
    kidReactionMarkup(options.kids, options.final) +
    factsMarkup(options.receipt, options.bestBank, options.final.scores[0]) +
    patchesMarkup(options.receipt) +
    shareMarkup(options.share?.line) +
    actionButtonsMarkup(options.versus) +
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

  const primaryButton = root.querySelector<HTMLButtonElement>('[data-action="play-again"]');
  primaryButton?.focus({ preventScroll: true });

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
