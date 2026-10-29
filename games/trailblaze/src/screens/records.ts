/**
 * Records screen for Trailblaze: a table per channel group (Bordered,
 * Wraparound, Doodle, Remix) showing matches played, won, lost, best margin,
 * and longest ride, or an empty state when no matches have finished.
 */
import { kidById, type KidId } from '@woodgrain-88/kit';
import type { RecordLine, TrailblazeSave } from '../app/save.ts';
import { channelById } from '../channels.ts';
import { createSheet } from './sheet.ts';
import { escapeText, LEGIBLE_FONT } from './style.ts';

export interface RecordsOptions {
  readonly host: HTMLElement;
  readonly save: TrailblazeSave;
  readonly onClose: () => void;
}

interface ParsedRecord {
  readonly channelId: string;
  readonly channelTitle: string;
  readonly group: string;
  readonly opponent: string;
  readonly memory: string;
  readonly line: RecordLine;
}

const STYLE = /* css */ `
.tb-records-content {
  display: grid;
  gap: clamp(16px, 2.5vh, 26px);
  font-family: ${LEGIBLE_FONT};
}

.tb-records-group {
  display: grid;
  gap: 8px;
}

.tb-records-group-title {
  margin: 0;
  font-size: clamp(16px, 2.2vh, 20px);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tb-text);
}

.tb-records-empty {
  margin: 0;
  font-size: clamp(14px, 1.8vh, 16px);
  color: var(--tb-muted);
  line-height: 1.4;
}

.tb-table-wrap {
  overflow-x: auto;
}

.tb-records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: clamp(13px, 1.6vh, 15px);
  color: var(--tb-text);
  white-space: nowrap;
}

.tb-records-table th,
.tb-records-table td {
  padding: 6px 10px;
  text-align: left;
}

.tb-records-table thead th {
  border-bottom: 2px solid var(--tb-border);
  font-size: clamp(11px, 1.4vh, 13px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tb-muted);
}

.tb-records-table td,
.tb-records-table th[scope='row'] {
  border-bottom: 1px solid var(--tb-border);
}

.tb-num-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
`;

function parseRecordKey(key: string, line: RecordLine): ParsedRecord | null {
  const parts = key.split('|');
  const channelId = parts[0];
  const oppPart = parts[1];
  const memPart = parts[2];
  if (!channelId || !oppPart) return null;

  const channel = channelById(channelId);
  const channelTitle = channel ? channel.def.title : channelId;
  const group = channel?.def.group ?? 'Other';

  let opponent = oppPart;
  if (oppPart.startsWith('kid:')) {
    const kidId = oppPart.slice(4) as KidId;
    opponent = kidId === 'lou' ? 'Grandpa Lou' : kidById(kidId).name;
  } else if (oppPart === 'computer') {
    opponent = 'Computer 1977';
  } else if (oppPart === 'person') {
    opponent = 'Two Players';
  }

  let memory = '-';
  if (memPart === 'human') memory = 'Human';
  if (memPart === 'sharp') memory = 'Sharp';

  return {
    channelId,
    channelTitle,
    group,
    opponent,
    memory,
    line,
  };
}

export function createRecordsScreen(options: RecordsOptions): { dispose(): void } {
  const sheet = createSheet({
    host: options.host,
    title: 'Records',
    onClose: options.onClose,
  });

  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.prepend(style);

  const container = document.createElement('div');
  container.className = 'tb-records-content';

  const rawRecords = Object.entries(options.save.records);
  const parsedList: ParsedRecord[] = [];

  for (const [key, line] of rawRecords) {
    const parsed = parseRecordKey(key, line);
    if (parsed && parsed.line.played > 0) {
      parsedList.push(parsed);
    }
  }

  if (parsedList.length === 0) {
    container.innerHTML = `<p class="tb-records-empty">No matches yet. Your records fill in as you ride.</p>`;
    sheet.body.append(container);
    return sheet;
  }

  // Groups in canonical order
  const groupNames = ['Bordered', 'Wraparound', 'Doodle', 'Remix'];
  let renderedGroups = 0;

  for (const group of groupNames) {
    const groupItems = parsedList.filter((item) => item.group === group);
    if (groupItems.length === 0) continue;
    renderedGroups++;

    const rowsHtml = groupItems
      .map((item) => {
        const bestMarginStr = item.line.bestMargin > 0 ? `+${item.line.bestMargin}` : '0';
        const longestRideStr = `${item.line.longestRide.toFixed(1)}s`;
        return (
          `<tr class="tb-records-row">` +
          `<th scope="row">${escapeText(item.channelTitle)}</th>` +
          `<td>${escapeText(item.opponent)}</td>` +
          `<td>${escapeText(item.memory)}</td>` +
          `<td class="tb-num-cell">${item.line.played}</td>` +
          `<td class="tb-num-cell">${item.line.won}</td>` +
          `<td class="tb-num-cell">${item.line.lost}</td>` +
          `<td class="tb-num-cell">${escapeText(bestMarginStr)}</td>` +
          `<td class="tb-num-cell">${escapeText(longestRideStr)}</td>` +
          `</tr>`
        );
      })
      .join('');

    const groupSection = document.createElement('section');
    groupSection.className = 'tb-records-group';
    groupSection.innerHTML =
      `<h3 class="tb-records-group-title">${escapeText(group)}</h3>` +
      `<div class="tb-table-wrap">` +
      `<table class="tb-records-table">` +
      `<thead><tr>` +
      `<th scope="col">Channel</th>` +
      `<th scope="col">Opponent</th>` +
      `<th scope="col">Memory</th>` +
      `<th scope="col" class="tb-num-cell">Played</th>` +
      `<th scope="col" class="tb-num-cell">Won</th>` +
      `<th scope="col" class="tb-num-cell">Lost</th>` +
      `<th scope="col" class="tb-num-cell">Best margin</th>` +
      `<th scope="col" class="tb-num-cell">Longest ride</th>` +
      `</tr></thead>` +
      `<tbody>${rowsHtml}</tbody>` +
      `</table>` +
      `</div>`;

    container.append(groupSection);
  }

  if (renderedGroups === 0) {
    container.innerHTML = `<p class="tb-records-empty">No matches yet. Your records fill in as you ride.</p>`;
  }

  sheet.body.append(container);
  return sheet;
}
