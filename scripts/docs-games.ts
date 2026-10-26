/**
 * `pnpm docs:games`: writes the README's game list from the registry, so the
 * list can never drift from the manifests. It rewrites only the lines between
 * the two marker comments, then formats the file with Prettier so `pnpm lint`
 * stays green. Original titles stay out of the README (they live in
 * CREDITS.md and the About page).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { createRegistry, FAMILY_NAMES } from '../hall/src/data/registry.ts';

const root = resolve(import.meta.dirname, '..');
const readmePath = join(root, 'README.md');
const START = '<!-- games:start -->';
const END = '<!-- games:end -->';

const players = (label: string) => (label === '1P' ? '1' : label === '2P' ? '2' : '1–2');

const rows = createRegistry().manifests.map(
  (m) =>
    `| ${String(m.slot).padStart(2, '0')} | ${m.title} | ${FAMILY_NAMES[m.family]} | ${players(m.players)}${m.versus !== 'none' ? ' (couch versus)' : ''} | ${m.status === 'playable' ? 'playable' : 'coming soon'} | ${m.tagline} |`,
);

const table = [
  START,
  '',
  '| Slot | Game | Family | Players | Status | In one line |',
  '|---|---|---|---|---|---|',
  ...rows,
  '',
  END,
].join('\n');

const readme = readFileSync(readmePath, 'utf8');
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1) throw new Error('README.md is missing the games markers');
const rewritten = readme.slice(0, start) + table + readme.slice(end + END.length);
const options = (await resolveConfig(readmePath)) ?? {};
writeFileSync(readmePath, await format(rewritten, { ...options, filepath: readmePath }));
console.warn(`README.md: wrote ${rows.length} games`);
