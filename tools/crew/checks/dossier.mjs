#!/usr/bin/env node
/**
 * Acceptance check for behaviour dossiers: the agreed structure is there, and
 * nothing in the text looks copied from the disassembly (instruction lines,
 * byte runs, sprite bit patterns, code blocks). Dossiers describe behaviour in
 * the crew's own words; this catches the obvious slips before the lead reads.
 *
 *   node tools/crew/checks/dossier.mjs research/dossiers/08-trailblaze.md [--pair]
 */
import { readFileSync } from 'node:fs';

const REQUIRED_FIELDS = [
  'dossier',
  'game',
  'cartridgeSlots',
  'sources',
  'identity',
  'verified-by-lead',
];
const SECTIONS = [
  '## 1. Identity check',
  '## 2. Game loop',
  '## 3. Controls',
  '## 4. Rules and scoring',
  '## 5. Variations',
  '## 6. Opponents and AI',
  '## 7. Hooks',
  '## 8. Feel numbers',
  '## 9. Confidence',
];
const PAIR_SECTION = '## 10. Differences between the two programs';

const COPY_SIGNS = [
  // Mermaid diagrams are the project's diagram format; any other fence would hold quoted code.
  [/```(?!mermaid\s*$)(?!\s*$)/, 'contains a code block'],
  [
    /\b(LDA|LDX|LDY|STA|STX|STY|ADC|SBC|CMP|CPX|CPY|AND|ORA|EOR|BIT|INC|DEC|ASL|LSR|ROL|ROR|JMP|JSR)\s+[#$(]/,
    'quotes an instruction',
  ],
  [/\[[.#]{8}\]/, 'quotes a sprite bit pattern'],
  [/(\b[0-9A-Fa-f]{2}\s){5,}/, 'quotes a run of raw bytes'],
  [/\.byte\b/i, 'quotes a data directive'],
];

const MIN_WORDS = 800;
const MAX_WORDS = 6500;

function check(path, isPair) {
  const text = readFileSync(path, 'utf8');
  const problems = [];
  const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!header) problems.push('no front matter');
  for (const field of REQUIRED_FIELDS) {
    if (header && !new RegExp(`^${field}:`, 'm').test(header[1]))
      problems.push(`front matter lacks ${field}`);
  }
  for (const section of isPair ? [...SECTIONS, PAIR_SECTION] : SECTIONS) {
    if (!text.includes(section)) problems.push(`missing heading "${section}"`);
  }
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, message] of COPY_SIGNS) {
      if (pattern.test(line)) problems.push(`line ${index + 1} ${message}`);
    }
  });
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS || words > MAX_WORDS)
    problems.push(`${words} words; expected ${MIN_WORDS}–${MAX_WORDS}`);
  return problems;
}

const [path, flag] = process.argv.slice(2);
if (!path) {
  console.error('Usage: node tools/crew/checks/dossier.mjs <dossier.md> [--pair]');
  process.exit(2);
}
const problems = check(path, flag === '--pair');
if (problems.length > 0) {
  console.error(`${path}:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`${path}: structure and provenance checks passed`);
