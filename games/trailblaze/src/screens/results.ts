/**
 * Results screen for Trailblaze: score lines in seat colours, winner banner,
 * longest ride, cells laid and traps sprung per rider, earned patches, and
 * "How Rosa saw it" replay frames with the Kid's awareness outline and reflex marks.
 */
import { patchSvg, type KidId, type PatchEarned } from '@woodgrain-88/kit';
import type { Cell } from '../engine/types.ts';
import type { SeatColours } from '../look/look.ts';
import { DISPLAY_FONT, ensureScreenStyle, escapeText } from './style.ts';

const TRAILBLAZE_EMBLEM = 'M4 20v-8h6V6h10M4 20h0M20 6h0';

export interface KidReplayFrame {
  readonly atMs: number; // ms before the crash, 0 for the crash itself
  readonly cells: Int8Array;
  readonly kidHead: Cell;
  readonly awareness: number;
  readonly marks: readonly ('slipped-late' | 'slipped-wrong' | 'missed')[];
}

export interface ResultsSeat {
  readonly name: string;
  readonly score: number;
  /** Cells this rider laid over the whole match. */
  readonly cellsLaid: number;
  /** Traps this rider closed on a rival over the whole match. */
  readonly trapsSprung: number;
  readonly colours: SeatColours;
  readonly isHuman: boolean;
}

export interface ResultsOptions {
  readonly host: HTMLElement;
  readonly versus?: boolean;
  readonly seats: readonly ResultsSeat[];
  readonly winner: number | null; // Seat index (0, 1) or null for draw
  readonly longestRideSeconds: number;
  readonly patchesEarned?: readonly PatchEarned[];
  readonly kid?: {
    readonly id: KidId;
    readonly name: string;
    readonly replayFrames?: readonly KidReplayFrame[];
  };
  readonly onPlayAgain: () => void;
  readonly onGameMenu: () => void;
  readonly onBackToHall: () => void;
  readonly shareLine?: string;
}

export interface ResultsScreen {
  dispose(): void;
}

const STYLE = /* css */ `
.tb-results-panel {
  position: absolute;
  right: clamp(16px, 3vw, 56px);
  top: clamp(64px, 10vh, 100px);
  bottom: clamp(16px, 3vh, 40px);
  width: min(480px, 44vw);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.5vh, 14px);
  overflow-y: auto;
  padding: 4px;
}

.tb-results-panel > * { flex-shrink: 0; }

.tb-banner {
  padding: clamp(16px, 2.5vh, 24px) 20px clamp(12px, 1.8vh, 16px);
  display: grid;
  gap: 4px;
}

.tb-banner h2 {
  margin: 0;
  font-family: ${DISPLAY_FONT};
  font-size: clamp(34px, 5.6vh, 60px);
  font-weight: 800;
  line-height: 1;
}

.tb-banner p {
  margin: 0;
  font-size: clamp(14px, 1.8vh, 16px);
  color: var(--tb-muted);
}

.tb-scores {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tb-score-card {
  padding: 14px 14px 10px;
  display: grid;
  gap: 2px;
  border-left: 6px solid var(--seat);
}

.tb-score-card .tb-score-name {
  font-weight: 800;
  font-size: clamp(13px, 1.7vh, 15px);
}

.tb-score-card .tb-score-val {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(32px, 5vh, 48px);
  line-height: 1;
  color: var(--seat);
}

.tb-facts {
  padding: 12px 16px;
  display: grid;
  gap: 6px;
  font-size: clamp(13px, 1.6vh, 15px);
}

.tb-facts-longest { margin: 0; display: flex; justify-content: space-between; gap: 12px; }
.tb-facts-longest span { color: var(--tb-muted); }
.tb-facts-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.tb-facts-table th, .tb-facts-table td { padding: 3px 0 3px 12px; text-align: right; }
.tb-facts-table th[scope="row"] { padding-left: 0; text-align: left; font-weight: 400; color: var(--tb-muted); }
.tb-facts-table td { font-weight: 700; }
.tb-facts-table thead th {
  font-weight: 700;
  border-bottom: 3px solid var(--seat);
  padding-bottom: 4px;
  max-width: 9ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Actions */
.tb-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tb-actions .is-primary { grid-column: 1 / -1; }
.tb-actions .tb-button { justify-content: space-between; }

.tb-share-card {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tb-share-line {
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--tb-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Patches */
.tb-patches {
  padding: 14px 16px 12px;
  display: grid;
  gap: 8px;
}

.tb-patch {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
}

/* Replay: How Rosa saw it */
.tb-replay {
  padding: 14px 16px 14px;
}

.tb-replay summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 800;
  font-size: clamp(15px, 1.9vh, 17px);
  user-select: none;
}

.tb-replay summary::-webkit-details-marker { display: none; }
.tb-replay summary:focus-visible { outline: 3px solid var(--tb-focus); outline-offset: 3px; }

.tb-replay summary::after {
  content: '▸';
  transition: transform 140ms ease;
}

.tb-replay[open] summary::after {
  transform: rotate(90deg);
}

.tb-replay-frames {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.tb-replay-frame {
  display: grid;
  gap: 4px;
  justify-items: center;
  background: rgba(0, 0, 0, 0.25);
  padding: 6px;
  border-radius: 6px;
  border: 1px solid var(--tb-border);
}

.tb-replay-frame canvas {
  width: 100%;
  max-width: 160px;
  height: auto;
  border-radius: 3px;
  background: #0c1220;
  display: block;
}

.tb-frame-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 160px;
  font-size: 11px;
  color: var(--tb-muted);
}

.tb-frame-marks {
  display: flex;
  gap: 4px;
}

.tb-mark-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  vertical-align: middle;
}

.tb-replay-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--tb-border);
  font-size: 11px;
  color: var(--tb-muted);
}

.tb-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 800px) {
  .tb-results-panel {
    position: relative;
    inset: auto;
    width: auto;
    margin: 64px 16px 20px;
  }
}
`;

function markIconSvg(mark: 'slipped-late' | 'slipped-wrong' | 'missed'): string {
  switch (mark) {
    case 'slipped-late':
      // Clock icon
      return (
        `<svg class="tb-mark-icon" viewBox="0 0 14 14" aria-label="Slipped late">` +
        `<circle cx="7" cy="7" r="5.5" fill="none" stroke="#ffd166" stroke-width="1.5"/>` +
        `<polyline points="7 4 7 7 9.5 7" fill="none" stroke="#ffd166" stroke-width="1.5" stroke-linecap="round"/>` +
        `</svg>`
      );
    case 'slipped-wrong':
      // Crossed arrow
      return (
        `<svg class="tb-mark-icon" viewBox="0 0 14 14" aria-label="Slipped wrong">` +
        `<line x1="3" y1="3" x2="11" y2="11" stroke="#ff5964" stroke-width="1.5" stroke-linecap="round"/>` +
        `<line x1="11" y1="3" x2="3" y2="11" stroke="#ff5964" stroke-width="1.5" stroke-linecap="round"/>` +
        `</svg>`
      );
    case 'missed':
      // Closed eye
      return (
        `<svg class="tb-mark-icon" viewBox="0 0 14 14" aria-label="Missed rival turn">` +
        `<path d="M 2 7 Q 7 11 12 7" fill="none" stroke="#64b5f6" stroke-width="1.5" stroke-linecap="round"/>` +
        `<line x1="4" y1="8.5" x2="3" y2="11" stroke="#64b5f6" stroke-width="1.3" stroke-linecap="round"/>` +
        `<line x1="7" y1="9" x2="7" y2="12" stroke="#64b5f6" stroke-width="1.3" stroke-linecap="round"/>` +
        `<line x1="10" y1="8.5" x2="11" y2="11" stroke="#64b5f6" stroke-width="1.3" stroke-linecap="round"/>` +
        `</svg>`
      );
  }
}

/**
 * The headline: who won and by how much. "You" is the one person riding; with two people (or none)
 * the winner is named. The winner's score comes first, then the best of the rest.
 */
function winnerBanner(options: ResultsOptions): { title: string; line: string } {
  const scores = options.seats.map((seat) => seat.score);
  if (options.winner === null) {
    return { title: 'A draw', line: `A draw at ${scores.join('–')}` };
  }
  const winner = options.seats[options.winner];
  if (!winner) return { title: 'Match over', line: '' };
  const others = options.seats.filter((seat) => seat !== winner).map((seat) => seat.score);
  const score = `${String(winner.score)}–${String(Math.max(0, ...others))}`;
  const people = options.seats.filter((seat) => seat.isHuman).length;
  if (winner.isHuman && people === 1) return { title: 'You win', line: `You win ${score}` };
  return { title: `${winner.name} wins`, line: `${winner.name} wins ${score}` };
}

export function createResultsScreen(options: ResultsOptions): ResultsScreen {
  ensureScreenStyle(options.host);

  const root = document.createElement('section');
  root.className = 'tb-screen tb-results';
  root.setAttribute('aria-label', 'Match results');

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.prepend(style);

  const banner = winnerBanner(options);

  // Scores markup
  const scoresHtml = options.seats
    .map((seat) => {
      return (
        `<div class="tb-score-card tb-card" style="--seat: ${seat.colours.main}">` +
        `<span class="tb-score-name">${escapeText(seat.name)}</span>` +
        `<span class="tb-score-val">${seat.score}</span>` +
        `</div>`
      );
    })
    .join('');

  // Facts
  const headersHtml = options.seats
    .map(
      (seat) =>
        `<th scope="col" style="--seat: ${seat.colours.main}">${escapeText(seat.name)}</th>`,
    )
    .join('');
  const cellsLaidHtml = options.seats.map((seat) => `<td>${seat.cellsLaid}</td>`).join('');
  const trapsSprungHtml = options.seats.map((seat) => `<td>${seat.trapsSprung}</td>`).join('');

  const factsHtml =
    `<div class="tb-facts tb-card">` +
    `<p class="tb-facts-longest"><span>Longest ride</span><strong>${options.longestRideSeconds.toFixed(1)} s</strong></p>` +
    `<table class="tb-facts-table">` +
    `<thead>` +
    `<tr>` +
    `<td></td>` +
    headersHtml +
    `</tr>` +
    `</thead>` +
    `<tbody>` +
    `<tr><th scope="row">Cells laid</th>${cellsLaidHtml}</tr>` +
    `<tr><th scope="row">Traps sprung</th>${trapsSprungHtml}</tr>` +
    `</tbody>` +
    `</table>` +
    `</div>`;

  // Patches stitched
  let patchesHtml = '';
  if (options.patchesEarned && options.patchesEarned.length > 0) {
    const items = options.patchesEarned
      .map((earned) => {
        const svg = patchSvg(
          {
            tier: earned.patch.tier,
            emblem: TRAILBLAZE_EMBLEM,
            colours: { ground: '#142036', thread: '#ffd166', border: '#ff8a2a' },
            gold: earned.gold,
            state: 'earned',
            seed: earned.patch.id,
            title: earned.patch.title,
          },
          52,
        );
        return (
          `<div class="tb-patch">${svg}<span>${escapeText(earned.patch.title)}` +
          (earned.gold ? ' · gold thread' : '') +
          `</span></div>`
        );
      })
      .join('');
    patchesHtml = `<div class="tb-patches tb-card"><span class="tb-label">Patches stitched</span>${items}</div>`;
  }

  // How Rosa saw it
  let replayHtml = '';
  const kid = options.kid;
  if (kid?.replayFrames?.length) {
    const replayFrames = kid.replayFrames;
    const framesHtml = replayFrames
      .map((frame, index) => {
        const timeLabel = frame.atMs === 0 ? 'Crash' : `${(frame.atMs / 1000).toFixed(1)}s before`;
        const marksIcons = frame.marks.map(markIconSvg).join('');
        return (
          `<div class="tb-replay-frame">` +
          `<canvas class="tb-frame-canvas" data-frame-index="${index}" width="160" height="80"></canvas>` +
          `<div class="tb-frame-meta"><span>${timeLabel}</span><span class="tb-frame-marks">${marksIcons}</span></div>` +
          `</div>`
        );
      })
      .join('');

    const legendHtml =
      `<div class="tb-replay-legend">` +
      `<span class="tb-legend-item">${markIconSvg('slipped-late')} Slipped late</span>` +
      `<span class="tb-legend-item">${markIconSvg('slipped-wrong')} Slipped wrong</span>` +
      `<span class="tb-legend-item">${markIconSvg('missed')} Missed rival turn</span>` +
      `</div>`;

    replayHtml =
      `<details class="tb-replay tb-card">` +
      `<summary>How ${escapeText(kid.name)} saw it</summary>` +
      `<div class="tb-replay-frames">${framesHtml}</div>` +
      legendHtml +
      `</details>`;
  }

  // Action buttons
  const playAgainLabel = options.versus ? 'Rematch' : 'Play again';
  const actionsHtml =
    `<div class="tb-actions">` +
    `<button type="button" class="tb-button is-primary" data-action="play-again">` +
    `<span>${playAgainLabel}</span><span class="tb-key" aria-hidden="true">R</span></button>` +
    `<button type="button" class="tb-button" data-action="game-menu"><span>Game menu</span></button>` +
    `<button type="button" class="tb-button" data-action="back-to-hall">` +
    `<span>Back to the Hall</span><span class="tb-key" aria-hidden="true">H</span></button>` +
    `</div>`;

  // Share line
  let shareHtml = '';
  if (options.shareLine) {
    shareHtml =
      `<div class="tb-share-card tb-card">` +
      `<span class="tb-share-line">${escapeText(options.shareLine)}</span>` +
      `<button type="button" class="tb-link" data-action="share">Copy</button>` +
      `</div>`;
  }

  root.innerHTML =
    `<div class="tb-scrim" style="transform: scaleX(-1)"></div>` +
    `<div class="tb-results-panel">` +
    `<header class="tb-banner tb-card">` +
    `<h2>${escapeText(banner.title)}</h2>` +
    `<p>${escapeText(banner.line)}</p>` +
    `</header>` +
    `<div class="tb-scores">${scoresHtml}</div>` +
    factsHtml +
    patchesHtml +
    actionsHtml +
    shareHtml +
    replayHtml +
    `</div>`;

  root.prepend(style);
  options.host.append(root);

  // Render 2D canvas frames if kid frames exist
  if (kid?.replayFrames) {
    const replayFrames = kid.replayFrames;
    const canvases = root.querySelectorAll<HTMLCanvasElement>('.tb-frame-canvas');
    canvases.forEach((canvas) => {
      const idx = Number(canvas.dataset.frameIndex);
      const frame = replayFrames[idx];
      if (!frame) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s0Col = options.seats[0]?.colours.main ?? '#ff8a2a';
      const s1Col = options.seats[1]?.colours.main ?? '#38a8ff';

      ctx.fillStyle = '#0c1220';
      ctx.fillRect(0, 0, 160, 80);

      // Draw cells: 40 cols, 20 rows, 4 px per cell
      for (let c = 0; c < 800; c++) {
        const val = frame.cells[c];
        if (val === -1) continue; // Empty
        const col = c % 40;
        const row = Math.floor(c / 40);
        if (val === 0) {
          ctx.fillStyle = s0Col;
          ctx.fillRect(col * 4, row * 4, 4, 4);
        } else if (val === 1) {
          ctx.fillStyle = s1Col;
          ctx.fillRect(col * 4, row * 4, 4, 4);
        } else if (val === -2) {
          ctx.fillStyle = '#1c283c'; // Border
          ctx.fillRect(col * 4, row * 4, 4, 4);
        }
      }

      // Kid's awareness square outlined around kid's head
      const headCol = frame.kidHead % 40;
      const headRow = Math.floor(frame.kidHead / 40);
      const aw = frame.awareness;

      const minCol = Math.max(0, headCol - aw);
      const maxCol = Math.min(39, headCol + aw);
      const minRow = Math.max(0, headRow - aw);
      const maxRow = Math.min(19, headRow + aw);

      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        minCol * 4 + 0.5,
        minRow * 4 + 0.5,
        (maxCol - minCol + 1) * 4 - 1,
        (maxRow - minRow + 1) * 4 - 1,
      );

      // Marker on head
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headCol * 4 + 1, headRow * 4 + 1, 2, 2);
    });
  }

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-action="play-again"]')) {
      options.onPlayAgain();
      return;
    }
    if (target.closest('[data-action="game-menu"]')) {
      options.onGameMenu();
      return;
    }
    if (target.closest('[data-action="back-to-hall"]')) {
      options.onBackToHall();
      return;
    }
    if (target.closest('[data-action="share"]')) {
      const shareBtn = target.closest<HTMLButtonElement>('[data-action="share"]');
      if (options.shareLine) {
        void navigator.clipboard.writeText(options.shareLine).then(
          () => {
            if (shareBtn) shareBtn.textContent = 'Copied';
          },
          () => {
            if (shareBtn) shareBtn.textContent = 'Copy failed';
          },
        );
      }
      return;
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
