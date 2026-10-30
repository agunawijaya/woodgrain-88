/**
 * Results, to Trailblaze's standard: a right-hand column over the frozen
 * field, which keeps drifting behind it. A banner names the winner (or the
 * docks, solo), score cards and a stats table follow, then Play again,
 * Game menu and Back to the Hall, the share line, any patches stitched this
 * match, and "How the Kid flew it" when a Kid played.
 */
import type { KidId, PatchEarned } from '@woodgrain-88/kit';
import type { KidReplayFrame } from '../app/kid-replay.ts';
import type { SeatColours } from '../look/look.ts';
import { DISPLAY_FONT, ensureScreenStyle, escapeText } from './style.ts';

export interface ResultsSeat {
  readonly name: string;
  readonly score: number;
  readonly shots: number;
  readonly hits: number;
  readonly fuelUsed: number;
  readonly docks: number;
  readonly starCrashes: number;
  readonly colours: SeatColours;
}

export interface ResultsOptions {
  readonly host: HTMLElement;
  /** False in solo docking, where there is no rival to win against. */
  readonly versus: boolean;
  /** One seat in solo docking, two otherwise. */
  readonly seats: readonly [ResultsSeat] | readonly [ResultsSeat, ResultsSeat];
  readonly winner: 0 | 1 | null;
  /** Solo docking's own line: "N docks". */
  readonly soloDocks?: number;
  /** The match's length, for solo's "In m:ss" line; left out where the controller has no time to show. */
  readonly durationMs?: number;
  /** Shots, hits and accuracy only mean anything where ships can fire: duel channels. */
  readonly showCombatStats: boolean;
  /** The star crashes row only where the channel has a star (including Binary Stars). */
  readonly showStarCrashes: boolean;
  /** The docks row only in docking races and solo docking. */
  readonly showDocks: boolean;
  readonly shareLine?: string;
  readonly patchesEarned: readonly PatchEarned[];
  readonly kid?: {
    readonly id: KidId;
    readonly name: string;
    readonly frames: readonly KidReplayFrame[];
  };
  readonly onPlayAgain: () => void;
  readonly onGameMenu: () => void;
  readonly onBackToHall: () => void;
  readonly onShare?: () => void;
}

export interface ResultsScreen {
  dispose(): void;
}

function accuracy(seat: ResultsSeat): string {
  if (seat.shots === 0) return '—';
  return `${String(Math.round((seat.hits / seat.shots) * 100))}%`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

const STYLE = /* css */ `
.gd-results-panel {
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

.gd-results-panel > * { flex-shrink: 0; }

.gd-results-scrim { transform: scaleX(-1); background: var(--gd-scrim); }

.gd-banner {
  padding: clamp(16px, 2.5vh, 24px) 20px clamp(12px, 1.8vh, 16px);
  display: grid;
  gap: 4px;
}

.gd-banner h2 {
  margin: 0;
  font-family: ${DISPLAY_FONT};
  font-size: clamp(34px, 5.6vh, 60px);
  font-weight: 800;
  line-height: 1;
}

.gd-banner p {
  margin: 0;
  font-size: clamp(14px, 1.8vh, 16px);
  color: var(--gd-muted);
}

.gd-scores {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.gd-scores.gd-scores-solo { grid-template-columns: 1fr; }

.gd-score-card {
  padding: 14px 14px 10px;
  display: grid;
  gap: 2px;
  border-left: 6px solid var(--seat);
}

.gd-score-card .gd-score-name {
  font-weight: 800;
  font-size: clamp(13px, 1.7vh, 15px);
}

.gd-score-card .gd-score-val {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(32px, 5vh, 48px);
  line-height: 1;
  color: var(--seat);
}

.gd-facts {
  padding: 12px 16px;
  display: grid;
  gap: 6px;
  font-size: clamp(13px, 1.6vh, 15px);
}

.gd-facts-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.gd-facts-table th, .gd-facts-table td { padding: 3px 0 3px 12px; text-align: right; }
.gd-facts-table th[scope='row'] { padding-left: 0; text-align: left; font-weight: 400; color: var(--gd-muted); }
.gd-facts-table td { font-weight: 700; }
.gd-facts-table thead th {
  font-weight: 700;
  border-bottom: 3px solid var(--seat);
  padding-bottom: 4px;
  max-width: 9ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gd-actions .is-primary { grid-column: 1 / -1; }
.gd-actions .gd-button { justify-content: space-between; }

.gd-share-card {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.gd-share-line {
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--gd-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd-patches {
  padding: 14px 16px 12px;
  display: grid;
  gap: 8px;
}

.gd-patch-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--gd-border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.85em;
  font-weight: 700;
}

.gd-kid-replay {
  padding: 14px 16px 14px;
}

.gd-kid-replay summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 800;
  font-size: clamp(15px, 1.9vh, 17px);
  user-select: none;
}

.gd-kid-replay summary::-webkit-details-marker { display: none; }
.gd-kid-replay summary:focus-visible { outline: 3px solid var(--gd-focus); outline-offset: 3px; }

.gd-kid-replay summary::after {
  content: '▸';
  transition: transform 140ms ease;
}

.gd-kid-replay[open] summary::after {
  transform: rotate(90deg);
}

.gd-kid-strip {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  overflow-x: auto;
}

.gd-kid-frame { flex: 0 0 auto; width: 96px; }
.gd-kid-frame canvas { width: 100%; height: 64px; background: #0c0a16; border-radius: 4px; display: block; }
.gd-kid-frame-caption { font-size: 0.7em; text-align: center; color: var(--gd-muted); margin-top: 2px; }

@media (max-width: 800px) {
  .gd-results-panel {
    position: relative;
    inset: auto;
    width: auto;
    margin: 64px 16px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gd-kid-replay summary::after { transition: none; }
}
`;

/** A tiny 2D sketch of ships, missiles and the centre, with the Kid's aim as a dotted line. */
function drawFrame(canvas: HTMLCanvasElement, frame: KidReplayFrame): void {
  const pen = canvas.getContext('2d');
  if (!pen) return;
  const scale = canvas.width / 36;
  const toPixel = (x: number, z: number): readonly [number, number] => [
    canvas.width / 2 + x * scale,
    canvas.height / 2 + z * scale,
  ];
  pen.clearRect(0, 0, canvas.width, canvas.height);
  pen.fillStyle = '#f6e27f';
  pen.beginPath();
  pen.arc(canvas.width / 2, canvas.height / 2, 2, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = '#ff5964';
  for (const missile of frame.missiles) {
    const [x, y] = toPixel(missile.x, missile.z);
    pen.beginPath();
    pen.arc(x, y, 1.5, 0, Math.PI * 2);
    pen.fill();
  }
  pen.strokeStyle = '#c3a9ff';
  for (const ship of frame.ships) {
    const [x, y] = toPixel(ship.x, ship.z);
    pen.save();
    pen.translate(x, y);
    pen.rotate(-ship.heading);
    pen.beginPath();
    pen.moveTo(5, 0);
    pen.lineTo(-4, 3);
    pen.lineTo(-4, -3);
    pen.closePath();
    pen.stroke();
    pen.restore();
  }
  if (frame.aimHeading !== null) {
    const [sx, sy] = frame.ships[0]
      ? toPixel(frame.ships[0].x, frame.ships[0].z)
      : [canvas.width / 2, canvas.height / 2];
    pen.save();
    pen.strokeStyle = 'rgba(255,255,255,0.6)';
    pen.setLineDash([2, 2]);
    pen.beginPath();
    pen.moveTo(sx, sy);
    pen.lineTo(sx + Math.cos(frame.aimHeading) * 14, sy - Math.sin(frame.aimHeading) * 14);
    pen.stroke();
    pen.restore();
  }
}

/** The headline and the line under it: who won and by how much, or solo's docks and its time. */
function headline(options: ResultsOptions): { readonly title: string; readonly line: string } {
  if (!options.versus) {
    const docks = options.soloDocks ?? options.seats[0].score;
    const title = `${String(docks)} ${docks === 1 ? 'dock' : 'docks'}`;
    const line = options.durationMs === undefined ? '' : `In ${formatDuration(options.durationMs)}`;
    return { title, line };
  }
  if (options.winner === null) {
    const level = String(options.seats[0].score);
    return { title: 'A draw', line: `A draw at ${level}–${level}` };
  }
  const winningSeat = options.seats[options.winner];
  if (!winningSeat) return { title: 'Match over', line: '' };
  const others = options.seats.filter((seat) => seat !== winningSeat).map((seat) => seat.score);
  const score = `${String(winningSeat.score)}–${String(Math.max(0, ...others))}`;
  return { title: `${winningSeat.name} wins`, line: `${winningSeat.name} wins ${score}` };
}

interface StatRow {
  readonly label: string;
  readonly values: readonly string[];
}

/** Only the rows that mean anything for this match: combat stats in duels, star crashes where
 * there is a star, docks in the docking modes. */
function statRows(options: ResultsOptions): readonly StatRow[] {
  const { seats } = options;
  const rows: StatRow[] = [];
  if (options.showCombatStats) {
    rows.push({ label: 'Shots', values: seats.map((seat) => String(seat.shots)) });
    rows.push({ label: 'Hits', values: seats.map((seat) => String(seat.hits)) });
    rows.push({ label: 'Accuracy', values: seats.map(accuracy) });
  }
  rows.push({ label: 'Fuel used', values: seats.map((seat) => String(seat.fuelUsed)) });
  if (options.showStarCrashes) {
    rows.push({ label: 'Star crashes', values: seats.map((seat) => String(seat.starCrashes)) });
  }
  if (options.showDocks) {
    rows.push({ label: 'Docks', values: seats.map((seat) => String(seat.docks)) });
  }
  return rows;
}

export function createResultsScreen(options: ResultsOptions): ResultsScreen {
  ensureScreenStyle(options.host);

  const root = document.createElement('section');
  root.className = 'gd-screen gd-results';
  root.setAttribute('aria-label', 'Match results');

  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  const banner = headline(options);

  const scoresHtml = options.seats
    .map(
      (seat) =>
        `<div class="gd-score-card gd-card" style="--seat: ${seat.colours.main}">` +
        `<span class="gd-score-name">${escapeText(seat.name)}</span>` +
        `<span class="gd-score-val">${String(seat.score)}</span>` +
        `</div>`,
    )
    .join('');

  const rows = statRows(options);
  const headersHtml = options.seats
    .map(
      (seat) =>
        `<th scope="col" style="--seat: ${seat.colours.main}">${escapeText(seat.name)}</th>`,
    )
    .join('');
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr><th scope="row">${escapeText(row.label)}</th>` +
        row.values.map((value) => `<td>${escapeText(value)}</td>`).join('') +
        `</tr>`,
    )
    .join('');
  const factsHtml =
    rows.length > 0
      ? `<div class="gd-facts gd-card">` +
        `<table class="gd-facts-table"><thead><tr><td></td>${headersHtml}</tr></thead>` +
        `<tbody>${rowsHtml}</tbody></table></div>`
      : '';

  let patchesHtml = '';
  if (options.patchesEarned.length > 0) {
    const chips = options.patchesEarned
      .map((earned) => `<span class="gd-patch-chip">${escapeText(earned.patch.title)}</span>`)
      .join('');
    patchesHtml = `<div class="gd-patches gd-card"><span class="gd-label">Patches stitched</span>${chips}</div>`;
  }

  let replayHtml = '';
  const kid = options.kid;
  if (kid && kid.frames.length > 0) {
    const framesHtml = kid.frames
      .map((frame, index) => {
        const fuelNote =
          frame.believedFuel === null
            ? ''
            : ` · thought ${String(frame.believedFuel)} left (really ${String(frame.trueFuel ?? 0)})`;
        return (
          `<div class="gd-kid-frame">` +
          `<canvas class="gd-kid-frame-canvas" data-frame-index="${String(index)}" width="96" height="64"></canvas>` +
          `<div class="gd-kid-frame-caption">${(frame.beforeMs / 1000).toFixed(1)}s before${fuelNote}</div>` +
          `</div>`
        );
      })
      .join('');
    replayHtml =
      `<details class="gd-kid-replay gd-card">` +
      `<summary>How ${escapeText(kid.name)} flew it</summary>` +
      `<div class="gd-kid-strip">${framesHtml}</div>` +
      `</details>`;
  }

  const playAgainLabel = options.versus ? 'Rematch' : 'Play again';
  const actionsHtml =
    `<div class="gd-actions">` +
    `<button type="button" class="gd-button is-primary" data-action="play-again">` +
    `<span>${playAgainLabel}</span><span class="gd-key" aria-hidden="true">R</span></button>` +
    `<button type="button" class="gd-button" data-action="game-menu"><span>Game menu</span></button>` +
    `<button type="button" class="gd-button" data-action="back-to-hall">` +
    `<span>Back to the Hall</span><span class="gd-key" aria-hidden="true">H</span></button>` +
    `</div>`;

  let shareHtml = '';
  if (options.shareLine) {
    shareHtml =
      `<div class="gd-share-card gd-card">` +
      `<span class="gd-share-line">${escapeText(options.shareLine)}</span>` +
      (options.onShare
        ? `<button type="button" class="gd-link" data-action="share">Copy</button>`
        : '') +
      `</div>`;
  }

  root.innerHTML =
    `<div class="gd-scrim gd-results-scrim"></div>` +
    `<div class="gd-results-panel">` +
    `<header class="gd-banner gd-card">` +
    `<h2>${escapeText(banner.title)}</h2>` +
    `<p>${escapeText(banner.line)}</p>` +
    `</header>` +
    `<div class="gd-scores${options.seats.length === 1 ? ' gd-scores-solo' : ''}">${scoresHtml}</div>` +
    factsHtml +
    patchesHtml +
    actionsHtml +
    shareHtml +
    replayHtml +
    `</div>`;

  root.prepend(style);
  options.host.append(root);

  if (kid && kid.frames.length > 0) {
    root.querySelectorAll<HTMLCanvasElement>('.gd-kid-frame-canvas').forEach((canvas) => {
      const index = Number(canvas.dataset.frameIndex);
      const frame = kid.frames[index];
      if (frame) drawFrame(canvas, frame);
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
      options.onShare?.();
    }
  });

  const onKeyDown = (event: KeyboardEvent): void => {
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
