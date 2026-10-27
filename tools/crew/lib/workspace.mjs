/**
 * Readies a staging copy so the crew can check its own work: a node_modules of
 * its own, installed offline from the pnpm store, and the gate hook that keeps
 * its commands to the check commands in commands.mjs.
 *
 * Never link a staging copy to the repo's node_modules. Before `pnpm exec`,
 * pnpm 12 re-links the workspace packages and writes through the link: on
 * 2026-10-27 that pointed the real repo at a staging copy and emptied its
 * virtual store. An offline install from the store takes about two seconds.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runProcess } from './agy.mjs';
import { CREW_HOOK_ROOT } from './tree.mjs';

const INSTALL_COMMAND = 'pnpm install --frozen-lockfile --offline';
const INSTALL_TIMEOUT_SECONDS = 180;

// The staging copy's own gate, relative to the hook's working directory (.agents/).
// The crew reads the hook when a command is refused; a gate outside its workspace
// is a denied read, and that ends its turn. Editing this copy buys it nothing:
// a hook's allow cannot override agy's rules, and the sandbox still holds writes.
const GATE_COMMAND = 'node ../tools/crew/lib/gate.mjs';

function writeGateHook(stagingDir) {
  const dir = join(stagingDir, CREW_HOOK_ROOT);
  mkdirSync(dir, { recursive: true });
  const hooks = {
    'crew-gate': {
      PreToolUse: [
        {
          matcher: 'run_command',
          hooks: [{ type: 'command', command: GATE_COMMAND, timeout: 10 }],
        },
      ],
    },
  };
  writeFileSync(join(dir, 'hooks.json'), `${JSON.stringify(hooks, null, 2)}\n`);
}

/** Installs dependencies into the staging copy and fits the gate hook. */
export async function prepareWorkspace(stagingDir, env) {
  writeGateHook(stagingDir);
  if (!existsSync(join(stagingDir, 'pnpm-lock.yaml'))) {
    return { installed: false, seconds: 0, note: 'no pnpm-lock.yaml to install from' };
  }
  const run = await runProcess({
    command: INSTALL_COMMAND,
    args: [],
    cwd: stagingDir,
    timeoutSeconds: INSTALL_TIMEOUT_SECONDS,
    env,
    shell: true,
  });
  const installed = run.exitCode === 0 && !run.timedOut;
  const lastLine = `${run.stdout}\n${run.stderr}`.trim().split(/\r?\n/).at(-1);
  return {
    installed,
    seconds: Math.round(run.seconds * 10) / 10,
    note: installed ? 'installed offline' : `install failed: ${lastLine}`,
  };
}
