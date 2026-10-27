/**
 * Records screen for Tank Duel: player standings against each Neighbourhood Kid,
 * the longest banked scoring shot landed, and a 31-channel table in dial order
 * showing personal best hits and match play counts.
 */
import { KIDS, kidPortraitSvg, type RunRecord } from '@woodgrain-88/kit';
import type { KidRecord, TankSave } from '../app/save.ts';
import { CHANNELS } from '../engine/channels.ts';
import { createSheet } from './sheet.ts';
import { escapeText } from './style.ts';

export interface RecordsOptions {
  readonly host: HTMLElement;
  readonly save: TankSave;
  readonly best: (channelId: string) => RunRecord | null;
  readonly onClose: () => void;
}

const STYLE = /* css */ `
.td-records-content {
  display: grid;
  gap: clamp(16px, 2.5vh, 26px);
}
.td-records-section {
  display: grid;
  gap: 10px;
}
.td-records-kids {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(8px, 1.4vw, 16px);
}
figure.td-records-kid {
  margin: 0;
  cursor: default;
  align-items: center;
  justify-items: center;
}
.td-kid-score {
  font-size: clamp(14px, 1.8vh, 16px);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--td-panel-ink);
}
.td-records-bank {
  margin: 0;
  font-size: clamp(15px, 2vh, 18px);
  color: var(--td-panel-ink);
  line-height: 1.4;
}
.td-records-table-wrap {
  overflow-x: auto;
}
.td-records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: clamp(13px, 1.6vh, 15px);
  color: var(--td-panel-ink);
}
.td-records-table th,
.td-records-table td {
  padding: 6px 10px;
}
.td-records-table thead th {
  border-bottom: 2px solid var(--td-panel-edge);
  font-size: clamp(11px, 1.4vh, 13px);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--td-ink-soft);
}
.td-records-table thead th:first-child,
.td-records-table td.td-cell-ch {
  text-align: center;
  width: 48px;
}
.td-records-table thead th:nth-child(2),
.td-records-table th[scope='row'] {
  text-align: left;
}
.td-records-table thead th:nth-child(3),
.td-records-table td.td-cell-best {
  text-align: right;
  width: 68px;
}
.td-records-table thead th:nth-child(4),
.td-records-table td.td-cell-played {
  text-align: right;
  width: 68px;
}
.td-cell-ch,
.td-cell-best,
.td-cell-played {
  font-variant-numeric: tabular-nums;
}
.td-group-row th {
  padding-top: 16px;
  padding-bottom: 6px;
  font-family: 'Big Shoulders Display Variable', 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  font-weight: 800;
  font-size: clamp(15px, 1.9vh, 18px);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  color: var(--td-olive);
  border-bottom: 1px solid var(--td-panel-edge);
}
.td-screens[data-appearance='dark'] .td-group-row th {
  color: var(--td-mustard);
}
.td-records-kids .td-photo {
  width: clamp(76px, 8.6vw, 98px);
}
.td-records-kids .td-photo .td-hand {
  font-size: clamp(14px, 1.8vh, 17px);
}
.td-channel-row td,
.td-channel-row th {
  border-bottom: 1px solid rgba(54, 64, 28, 0.14);
}
.td-screens[data-appearance='dark'] .td-channel-row td,
.td-screens[data-appearance='dark'] .td-channel-row th {
  border-bottom-color: rgba(242, 162, 44, 0.12);
}
.td-channel-row th[scope='row'] {
  font-weight: 500;
}
.td-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;

const PHOTO_TILTS = ['-2.5deg', '1.5deg', '-1deg', '2deg', '-2deg', '1deg'];

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatEnGbDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()] ?? '';
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function formatBestBank(bank: TankSave['bestBank']): string {
  if (!bank || bank.bounces <= 0) {
    return 'No bank shot yet. Bounce one in on a bouncing channel.';
  }
  const channel = CHANNELS.find((c) => c.id === bank.channel);
  const chNum = channel ? String(channel.number).padStart(2, '0') : bank.channel;
  const chTitle = channel ? channel.title : bank.channel;
  const dateText = formatEnGbDate(bank.at);
  return `×${bank.bounces} on CH ${chNum} · ${chTitle}, ${dateText}`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  if (count === 0) return `no ${pluralForm}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm}`;
}

function formatRecordSr(record: KidRecord): string {
  const wins = plural(record.wins, 'win', 'wins');
  const losses = plural(record.losses, 'loss', 'losses');
  const draws = plural(record.draws, 'draw', 'draws');
  return `${wins}, ${losses}, ${draws}`;
}

export function createRecordsScreen(options: RecordsOptions): { dispose(): void } {
  const sheet = createSheet({
    host: options.host,
    title: 'Records',
    onClose: options.onClose,
  });

  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.append(style);

  const container = document.createElement('div');
  container.className = 'td-records-content';

  const kidsMarkup = KIDS.map((kid, index) => {
    const record = options.save.kids[kid.id];
    const tilt = PHOTO_TILTS[index] ?? '0deg';
    return (
      `<figure class="td-photo td-records-kid" data-kid="${kid.id}" style="--tilt: ${tilt}">` +
      kidPortraitSvg(kid, { expression: 'photo', idPrefix: `td-records-${kid.id}` }) +
      `<figcaption class="td-hand">${escapeText(kid.name)}</figcaption>` +
      `<div class="td-kid-record">` +
      `<span class="td-kid-score" aria-hidden="true">${record.wins}–${record.losses}–${record.draws}</span>` +
      `<span class="td-sr-only">${escapeText(formatRecordSr(record))}</span>` +
      `</div>` +
      `</figure>`
    );
  }).join('');

  let tableRows = '';
  let lastGroup: string | null = null;
  for (const channel of CHANNELS) {
    if (channel.group !== lastGroup) {
      lastGroup = channel.group;
      tableRows +=
        `<tr class="td-group-row">` +
        `<th scope="colgroup" colspan="4">${escapeText(channel.group)}</th>` +
        `</tr>`;
    }
    const best = options.best(channel.id);
    const bestScoreText = best !== null ? String(best.score) : '–';
    const played = options.save.played[channel.id] ?? 0;
    const chFormatted = String(channel.number).padStart(2, '0');

    tableRows +=
      `<tr class="td-channel-row">` +
      `<td class="td-cell-ch">${chFormatted}</td>` +
      `<th scope="row">${escapeText(channel.title)}</th>` +
      `<td class="td-cell-best">${bestScoreText}</td>` +
      `<td class="td-cell-played">${played}</td>` +
      `</tr>`;
  }

  container.innerHTML =
    `<section class="td-records-section" aria-labelledby="td-records-kids-heading">` +
    `<h3 class="td-label" id="td-records-kids-heading">Against the Kids</h3>` +
    `<div class="td-records-kids">${kidsMarkup}</div>` +
    `</section>` +
    `<section class="td-records-section" aria-labelledby="td-records-bank-heading">` +
    `<h3 class="td-label" id="td-records-bank-heading">Best bank shot</h3>` +
    `<p class="td-records-bank">${escapeText(formatBestBank(options.save.bestBank))}</p>` +
    `</section>` +
    `<section class="td-records-section" aria-labelledby="td-records-channels-heading">` +
    `<h3 class="td-label" id="td-records-channels-heading">Channels</h3>` +
    `<div class="td-records-table-wrap">` +
    `<table class="td-records-table">` +
    `<thead>` +
    `<tr>` +
    `<th scope="col">CH</th>` +
    `<th scope="col">Channel</th>` +
    `<th scope="col">Best</th>` +
    `<th scope="col">Played</th>` +
    `</tr>` +
    `</thead>` +
    `<tbody>${tableRows}</tbody>` +
    `</table>` +
    `</div>` +
    `</section>`;

  sheet.body.append(container);

  return {
    dispose() {
      sheet.dispose();
    },
  };
}
