/**
 * Acceptance: the commands an order lists, run by the bridge in the real repo
 * after the fenced changes are applied. The crew cannot run commands itself
 * (agy denies them in headless mode), so this is where its work meets the
 * test suite. Commands come from the lead-written order, never from the crew.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runProcess } from './agy.mjs';

const ACCEPTANCE_TIMEOUT_SECONDS = 600;
const TAIL_LINES = 40;

function tail(text, lines = TAIL_LINES) {
  return text.trimEnd().split(/\r?\n/).slice(-lines).join('\n');
}

export async function runAcceptance({ repoRoot, commands, logDir }) {
  const results = [];
  for (const [index, command] of commands.entries()) {
    const run = await runProcess({
      command,
      args: [],
      cwd: repoRoot,
      timeoutSeconds: ACCEPTANCE_TIMEOUT_SECONDS,
      shell: true,
    });
    const output = `${run.stdout}\n${run.stderr}`;
    writeFileSync(join(logDir, `acceptance-${index + 1}.log`), `$ ${command}\n\n${output}`);
    results.push({
      command,
      passed: run.exitCode === 0 && !run.timedOut,
      exitCode: run.exitCode,
      seconds: Math.round(run.seconds * 10) / 10,
      tail: tail(output),
    });
  }
  return results;
}
