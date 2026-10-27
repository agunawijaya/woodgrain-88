/**
 * Records screen for Hot & Cold: standings against each Neighbourhood Kid,
 * the clean flag streak, and a table of personal best runs grouped in channel order.
 */
import { KIDS, kidPortraitSvg } from '@woodgrain-88/kit';
import type { HotColdSave, KidRecord } from '../app/save.ts';
import { CHANNELS } from '../channels.ts';
import { createSheet } from './sheet.ts';
import { escapeText } from './style.ts';

export interface RecordsOptions {
  readonly host: HTMLElement;
  readonly save: HotColdSave;
  readonly onClose: () => void;
}

const STYLE = /* css */ `
.hc-records-content {
  display: grid;
  gap: clamp(16px, 2.5vh, 26px);
}
.hc-records-section {
  display: grid;
  gap: 10px;
}
.hc-records-kids {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(8px, 1.4vw, 16px);
}
figure.hc-records-kid {
  margin: 0;
  cursor: default;
  align-items: center;
  justify-items: center;
}
.hc-kid-score {
  font-size: clamp(14px, 1.8vh, 16px);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--hc-ink);
  text-align: center;
}
.hc-records-streak {
  margin: 0;
  font-size: clamp(15px, 2vh, 18px);
  color: var(--hc-ink);
  line-height: 1.4;
}
.hc-records-empty {
  margin: 0;
  font-size: clamp(14px, 1.8vh, 16px);
  color: var(--hc-ink-soft);
  line-height: 1.4;
}
.hc-records-table-wrap {
  overflow-x: auto;
}
.hc-records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: clamp(13px, 1.6vh, 15px);
  color: var(--hc-ink);
}
.hc-records-table th,
.hc-records-table td {
  padding: 6px 10px;
  text-align: left;
}
.hc-records-table thead th {
  border-bottom: 2px solid var(--hc-paper-edge);
  font-size: clamp(11px, 1.4vh, 13px);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hc-ink-soft);
}
.hc-records-table td,
.hc-records-table th[scope='row'] {
  border-bottom: 1px solid var(--hc-paper-edge);
}
.hc-records-table th[scope='row'] {
  font-weight: 500;
}
.hc-cell-played {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.hc-cell-best {
  font-variant-numeric: tabular-nums;
}
.hc-records-kids .hc-photo {
  width: clamp(76px, 8.6vw, 98px);
}
.hc-records-kids .hc-photo .hc-hand {
  font-size: clamp(14px, 1.8vh, 17px);
}
`;

const PHOTO_TILTS = ['-2.5deg', '1.5deg', '-1deg', '2deg', '-2deg', '1deg'];

/** "3 wins, no losses, 1 draw", for screen readers. */
function recordInWords(record: KidRecord): string {
  const count = (value: number, one: string, many: string) =>
    value === 0 ? `no ${many}` : value === 1 ? `1 ${one}` : `${value} ${many}`;
  return [
    count(record.wins, 'win', 'wins'),
    count(record.losses, 'loss', 'losses'),
    count(record.draws, 'draw', 'draws'),
  ].join(', ');
}

const CLUE_NAMES: Readonly<Record<string, string>> = {
  notebook: 'Notebook',
  classic: 'Classic Memory',
};

const MEMORY_NAMES: Readonly<Record<string, string>> = { human: 'Human', sharp: 'Sharp' };

const MODE_NAMES: Readonly<Record<string, string>> = {
  normal: 'Normal',
  daily: 'Daily',
  challenge: 'Challenge',
  'power-cycle-run': 'Run',
  'versus-night': 'Versus Night',
};

/** One table row per best on a known channel, in dial order. */
function bestRows(save: HotColdSave): string[] {
  const rows: string[] = [];
  for (const channel of CHANNELS) {
    for (const [key, best] of Object.entries(save.bests)) {
      const [channelId, mode = '', clues = '', memory = ''] = key.split('|');
      if (channelId !== channel.def.id) continue;
      rows.push(
        `<tr class="hc-records-row">` +
          `<th scope="row">${escapeText(channel.def.title)}</th>` +
          `<td class="hc-cell-played">${save.played[channel.def.id] ?? 0}</td>` +
          `<td class="hc-cell-clues">${escapeText(CLUE_NAMES[clues] ?? clues)}</td>` +
          `<td class="hc-cell-memory">${escapeText(MEMORY_NAMES[memory] ?? memory)}</td>` +
          `<td class="hc-cell-mode">${escapeText(MODE_NAMES[mode] ?? mode)}</td>` +
          `<td class="hc-cell-best">${escapeText(best.label)}</td>` +
          `<td class="hc-cell-when">${escapeText(best.at.slice(0, 10))}</td>` +
          `</tr>`,
      );
    }
  }
  return rows;
}

const TABLE_HEAD =
  '<thead><tr>' +
  ['Channel', 'Played', 'Clues', 'Kid memory', 'Mode', 'Best', 'When']
    .map((heading) => `<th scope="col">${heading}</th>`)
    .join('') +
  '</tr></thead>';

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
  container.className = 'hc-records-content';

  const kidsMarkup = KIDS.map((kid, index) => {
    const record = options.save.kids[kid.id];
    const tilt = PHOTO_TILTS[index] ?? '0deg';
    return (
      `<figure class="hc-photo hc-records-kid" data-kid="${kid.id}" style="--tilt: ${tilt}">` +
      kidPortraitSvg(kid, { expression: 'photo', idPrefix: `hc-records-${kid.id}` }) +
      `<figcaption class="hc-hand">${escapeText(kid.name)}</figcaption>` +
      `<div class="hc-kid-record">` +
      `<span class="hc-kid-score" aria-hidden="true">${record.wins}–${record.losses}–${record.draws}</span>` +
      `<span class="hc-hidden-text">${escapeText(recordInWords(record))}</span>` +
      `</div>` +
      `</figure>`
    );
  }).join('');

  const streak = options.save.cleanStreak;
  const streakSentence = `You have found ${streak === 1 ? '1 flag' : `${streak} flags`} in a row without setting off a bomb.`;
  const rows = bestRows(options.save);
  const bestsContent =
    rows.length === 0
      ? '<p class="hc-records-empty">No best runs yet. Find a flag and one appears here.</p>'
      : `<div class="hc-records-table-wrap"><table class="hc-records-table">${TABLE_HEAD}` +
        `<tbody>${rows.join('')}</tbody></table></div>`;

  container.innerHTML =
    `<section class="hc-records-section" aria-labelledby="hc-records-kids-heading">` +
    `<h3 class="hc-label" id="hc-records-kids-heading">Against the Kids</h3>` +
    `<div class="hc-records-kids">${kidsMarkup}</div>` +
    `</section>` +
    `<section class="hc-records-section" aria-labelledby="hc-records-streak-heading">` +
    `<h3 class="hc-label" id="hc-records-streak-heading">Clean streak</h3>` +
    `<p class="hc-records-streak">${escapeText(streakSentence)}</p>` +
    `</section>` +
    `<section class="hc-records-section" aria-labelledby="hc-records-bests-heading">` +
    `<h3 class="hc-label" id="hc-records-bests-heading">Best runs</h3>` +
    bestsContent +
    `</section>`;

  sheet.body.append(container);

  return {
    dispose() {
      sheet.dispose();
    },
  };
}
