/**
 * Records: every channel, opponent, controls scheme and Kid setting the
 * player has a line for, with its best margin of victory, fastest win and
 * (in solo docking) most docks. Runs flown with the trajectory guide on
 * never reach `recordMatch`, so they never show up here.
 */
import { KIDS } from '@woodgrain-88/kit';
import type { GravitySave, RecordLine } from '../app/save.ts';
import { CHANNELS } from '../channels.ts';
import { createSheet, type Sheet } from './sheet.ts';

export interface RecordsOptions {
  readonly host: HTMLElement;
  readonly save: GravitySave;
  readonly onClose: () => void;
}

export interface RecordsScreen {
  dispose(): void;
}

function opponentName(opponent: string): string {
  if (opponent === 'person') return 'A friend';
  const kidId = opponent.startsWith('kid:') ? opponent.slice(4) : null;
  const kid = kidId ? KIDS.find((candidate) => candidate.id === kidId) : null;
  return kid?.name ?? opponent;
}

function schemeName(scheme: string): string {
  return scheme === 'modern' ? 'Modern' : 'Classic';
}

function memoryName(memory: string): string {
  return memory === 'sharp' ? 'Sharp' : 'Human';
}

/** `channelId|opponent|scheme|memory` back into its parts, for display. */
function describeKey(key: string): { readonly channel: string; readonly rest: string } {
  const [channelId, opponent, scheme, memory] = key.split('|');
  const channel = CHANNELS.find((candidate) => candidate.def.id === channelId);
  return {
    channel: channel?.def.title ?? channelId ?? key,
    rest: `${opponentName(opponent ?? '')} · ${schemeName(scheme ?? '')} · ${memoryName(memory ?? '')}`,
  };
}

function formatLine(line: RecordLine): string {
  const parts = [`${String(line.won)}–${String(line.lost)}`];
  if (line.bestMargin > 0) parts.push(`best margin ${String(line.bestMargin)}`);
  if (line.fastestWinMs !== null)
    parts.push(`fastest win ${(line.fastestWinMs / 1000).toFixed(1)}s`);
  if (line.mostDocks > 0) parts.push(`${String(line.mostDocks)} docks`);
  return parts.join(' · ');
}

const STYLE = /* css */ `
.gd-records-list { display: grid; gap: 10px; }
.gd-records-row { padding: 10px 14px; }
.gd-records-channel { font-weight: 800; }
.gd-records-rest { color: var(--gd-muted); font-size: 0.85em; }
.gd-records-empty { text-align: center; color: var(--gd-muted); padding: 24px; }
`;

export function createRecordsScreen(options: RecordsOptions): RecordsScreen {
  const sheet: Sheet = createSheet({
    host: options.host,
    title: 'Records',
    onClose: options.onClose,
  });
  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.append(style);

  const entries = Object.entries(options.save.records);
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'gd-records-empty';
    empty.textContent = 'No matches recorded yet.';
    sheet.body.append(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'gd-records-list';
    for (const [key, line] of entries) {
      const { channel, rest } = describeKey(key);
      const row = document.createElement('div');
      row.className = 'gd-card gd-records-row';
      const title = document.createElement('div');
      title.className = 'gd-records-channel';
      title.textContent = channel;
      const detail = document.createElement('div');
      detail.className = 'gd-records-rest';
      detail.textContent = `${rest} — ${formatLine(line)}`;
      row.append(title, detail);
      list.append(row);
    }
    sheet.body.append(list);
  }

  return { dispose: () => sheet.dispose() };
}
