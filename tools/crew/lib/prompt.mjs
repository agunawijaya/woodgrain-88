/**
 * What the crew actually reads: docs/team/CREW.md followed by the order, with
 * the fence, references and acceptance commands spelled out, or, for a
 * follow-up, the bridge's findings and the lead's numbered notes.
 */
import { join } from 'node:path';

// Windows caps a command line at 32,767 characters and the prompt travels as
// one argument; staying well below leaves room for the other flags.
export const MAX_PROMPT_CHARS = 30_000;

const REFERENCE_ROOTS = ['src', 'original'];

/** Splits an order's reads into staging-copy paths and read-only reference folders. */
export function splitReads(repoRoot, reads) {
  const workspaceReads = [];
  const referenceReads = [];
  const addDirs = new Set();
  for (const path of reads) {
    const root = path.split('/')[0];
    if (REFERENCE_ROOTS.includes(root)) {
      referenceReads.push(join(repoRoot, path));
      addDirs.add(join(repoRoot, root));
    } else {
      workspaceReads.push(path);
    }
  }
  return { workspaceReads, referenceReads, addDirs: [...addDirs] };
}

const bulletList = (items, empty) =>
  items.length === 0 ? `- ${empty}` : items.map((item) => `- ${item}`).join('\n');

export function composeDispatchPrompt({ crewGuide, order, repoRoot }) {
  const { workspaceReads, referenceReads } = splitReads(repoRoot, order.reads);
  return [
    crewGuide.trim(),
    '',
    '---',
    '',
    `# Work order ${order.id} (kind: ${order.kind})`,
    '',
    'Your write fence. These are the only paths you may create or change:',
    bulletList(order.fence, '(none)'),
    '',
    'Read these first (paths relative to your working directory):',
    bulletList(workspaceReads, '(nothing beyond the brief)'),
    '',
    'Read-only reference files outside your workspace. Read them with absolute paths; never modify, copy or quote them:',
    bulletList(referenceReads, '(none)'),
    '',
    'The lead will run these acceptance commands after you finish. Do not run them yourself:',
    bulletList(
      order.acceptance.map((command) => `\`${command}\``),
      '(none; the lead reviews by reading)',
    ),
    '',
    order.body,
  ].join('\n');
}

function describeChanges(entries) {
  return entries.map((entry) => `${entry.path} (${entry.change})`);
}

export function composeFollowupPrompt({ order, round, previous, message }) {
  const failed = (previous.acceptance ?? []).filter((result) => !result.passed);
  const sections = [
    `# Follow-up from the lead on work order ${order.id}, round ${round}`,
    '',
    'Same rules as before: stay inside your fence, edit files with your editing tools, never run shell commands, end with the JSON report block.',
    '',
    'Your fence:',
    bulletList(order.fence, '(none)'),
    '',
  ];
  if (previous.violations?.length) {
    sections.push(
      'These changes from your last round were outside your fence and were discarded:',
      bulletList(describeChanges(previous.violations), ''),
      '',
    );
  }
  if (failed.length) {
    sections.push('These acceptance commands failed after your last round:');
    for (const result of failed) {
      sections.push(
        `- \`${result.command}\` exited with ${result.exitCode}. Last lines:`,
        '',
        '```',
        result.tail,
        '```',
        '',
      );
    }
  }
  sections.push("The lead's notes:", '', message.trim());
  return sections.join('\n');
}
