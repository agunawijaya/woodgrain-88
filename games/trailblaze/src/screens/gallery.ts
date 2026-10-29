/**
 * Doodle artwork gallery: up to 12 saved drawings rendered inline via
 * doodleSvg, with channel name, save date, SVG download and two-step delete confirmation.
 */
import type { Appearance } from '@woodgrain-88/kit';
import type { DoodleEntry } from '../app/save.ts';
import { channelById } from '../channels.ts';
import { decodeBoard } from '../doodle/board.ts';
import { doodleSvg } from '../doodle/svg.ts';
import { CELL_COUNT } from '../engine/types.ts';
import type { SeatPalette } from '../look/seats.ts';
import { createSheet } from './sheet.ts';
import { escapeText, LEGIBLE_FONT } from './style.ts';

export interface GalleryOptions {
  readonly host: HTMLElement;
  readonly doodles: readonly DoodleEntry[];
  readonly appearance?: Appearance;
  readonly palette?: SeatPalette;
  readonly onDownload?: (doodle: DoodleEntry, svgContent: string) => void;
  readonly onDelete?: (doodleId: string) => void;
  readonly onClose: () => void;
}

const STYLE = /* css */ `
.tb-gallery-content {
  display: grid;
  gap: 20px;
  font-family: ${LEGIBLE_FONT};
}

.tb-gallery-empty {
  margin: 0;
  font-size: clamp(14px, 1.8vh, 16px);
  color: var(--tb-muted);
  line-height: 1.45;
}

.tb-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.tb-gallery-tile {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--tb-border);
  border-radius: 8px;
  padding: 10px;
  display: grid;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tb-gallery-preview {
  width: 100%;
  aspect-ratio: 2 / 1;
  border-radius: 4px;
  overflow: hidden;
  background: #000000;
  display: grid;
  place-items: center;
}

.tb-gallery-preview svg {
  width: 100%;
  height: 100%;
  display: block;
}

.tb-gallery-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.tb-gallery-channel {
  font-weight: 700;
  color: var(--tb-text);
}

.tb-gallery-date {
  color: var(--tb-muted);
  font-size: 12px;
}

.tb-gallery-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.tb-gallery-actions .tb-button {
  flex: 1;
  min-height: 34px;
  font-size: 12px;
  padding: 0.3em 0.6em;
}

.tb-btn-delete.is-confirming {
  background: #d32f2f;
  color: #ffffff;
  border-color: #b71c1c;
}
`;

function formatDate(ms: number): string {
  try {
    const d = new Date(ms);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

export function createGalleryScreen(options: GalleryOptions): { dispose(): void } {
  const sheet = createSheet({
    host: options.host,
    title: 'Doodle Gallery',
    onClose: options.onClose,
  });

  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.prepend(style);

  const container = document.createElement('div');
  container.className = 'tb-gallery-content';

  let doodleList = [...options.doodles].slice(0, 12);

  function render(): void {
    if (doodleList.length === 0) {
      container.innerHTML = `<p class="tb-gallery-empty">Draw something in a Doodle channel and press X to keep it here.</p>`;
      return;
    }

    const tilesHtml = doodleList
      .map((doodle) => {
        const channel = channelById(doodle.channelId);
        const channelName = channel ? channel.def.title : doodle.channelId;
        const dateStr = formatDate(doodle.savedAt);

        const decoded = decodeBoard(doodle.board);
        const cells = decoded ?? new Int8Array(CELL_COUNT);
        const svgCode = doodleSvg({
          cells,
          look: doodle.look,
          appearance: options.appearance ?? 'dark',
          palette: options.palette ?? 'standard',
        });

        return (
          `<div class="tb-gallery-tile" data-doodle-id="${doodle.id}">` +
          `<div class="tb-gallery-preview">${svgCode}</div>` +
          `<div class="tb-gallery-meta">` +
          `<span class="tb-gallery-channel">${escapeText(channelName)}</span>` +
          `<span class="tb-gallery-date">${escapeText(dateStr)}</span>` +
          `</div>` +
          `<div class="tb-gallery-actions">` +
          `<button type="button" class="tb-button" data-action="download">Download SVG</button>` +
          `<button type="button" class="tb-button tb-btn-delete" data-action="delete" data-state="idle">Delete</button>` +
          `</div>` +
          `</div>`
        );
      })
      .join('');

    container.innerHTML = `<div class="tb-gallery-grid">${tilesHtml}</div>`;
  }

  container.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const tile = target.closest<HTMLElement>('.tb-gallery-tile');
    const doodleId = tile?.dataset.doodleId;
    if (!doodleId) return;

    const doodle = doodleList.find((d) => d.id === doodleId);
    if (!doodle) return;

    if (target.closest('[data-action="download"]')) {
      const decoded = decodeBoard(doodle.board);
      const cells = decoded ?? new Int8Array(CELL_COUNT);
      const svgCode = doodleSvg({
        cells,
        look: doodle.look,
        appearance: options.appearance ?? 'dark',
        palette: options.palette ?? 'standard',
      });

      if (options.onDownload) {
        options.onDownload(doodle, svgCode);
      } else {
        // Default download fallback
        const blob = new Blob([svgCode], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trailblaze-doodle-${doodle.id}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }

    const deleteBtn = target.closest<HTMLButtonElement>('[data-action="delete"]');
    if (deleteBtn) {
      if (deleteBtn.dataset.state === 'idle') {
        deleteBtn.dataset.state = 'confirming';
        deleteBtn.classList.add('is-confirming');
        deleteBtn.textContent = 'Confirm delete?';
      } else if (deleteBtn.dataset.state === 'confirming') {
        options.onDelete?.(doodle.id);
        doodleList = doodleList.filter((d) => d.id !== doodle.id);
        render();
      }
      return;
    }
  });

  render();
  sheet.body.append(container);

  return sheet;
}
