/**
 * Talking to the OpenCode CLI, the second runner the crew drives (prompt 05,
 * stage 0; see ADR-0015). It mirrors agy.mjs: build the
 * only argument list the bridge ever passes, write the permission file that
 * stands in for agy's sandbox, and sort a finished run into the same outcomes
 * the dispatcher already knows how to act on.
 *
 * Verified on this machine (OpenCode v2.2.2, 2026-10-30, see the brief):
 * `opencode run --standalone --model <id> --format json "<message>"` prints
 * JSON Lines, one event per line, and never asks a question back — there is
 * nobody to answer one in a headless run, which is also why the config below
 * denies `task` and `question`. `--standalone` starts a private server that
 * reads a fresh `opencode.json`, because OpenCode's background service
 * otherwise caches a directory's config the first time it sees it.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { CREW_COMMANDS } from './commands.mjs';

// Never Claude, never a plain Gemini/OpenAI id: only the two DeepSeek models
// the lead verified (ADR-0015, prompt 05).
export const ALLOWED_MODEL = /^(?:deepseek\/[a-z0-9.-]+|opencode\/deepseek-[a-z0-9.-]+)$/;

const FORBIDDEN_FLAGS = ['--auto', '--dangerously-skip-permissions', '--yolo'];

/**
 * Decides how to launch opencode: a script for tests, the path in CREW_OPENCODE, or the real
 * executable. On Windows `opencode` on the PATH is npm's shim (a .cmd and a shell script), which
 * spawn cannot start without a shell, and a shell would mangle a long prompt full of quotes and
 * line breaks; so the bridge finds the .exe the shim points at, beside the shim in npm's folder.
 */
export function resolveOpencodeCommand(env = process.env, platform = process.platform) {
  const configured = env.CREW_OPENCODE;
  if (configured && /\.(mjs|js)$/.test(configured)) {
    return { command: process.execPath, prefix: [configured] };
  }
  if (configured) return { command: configured, prefix: [] };
  if (platform !== 'win32') return { command: 'opencode', prefix: [] };
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (!dir || !existsSync(join(dir, 'opencode.cmd'))) continue;
    const executable = join(dir, 'node_modules', '@opencode', 'cli', 'bin', 'opencode.exe');
    if (existsSync(executable)) return { command: executable, prefix: [] };
  }
  return { command: 'opencode', prefix: [] };
}

export function buildOpencodeArgs({ prompt, model, sessionId }) {
  if (!ALLOWED_MODEL.test(model)) {
    throw new Error(`Refusing to run opencode with model "${model}".`);
  }
  const args = [
    'run',
    '--standalone',
    '--model',
    model,
    '--format',
    'json',
    ...(sessionId ? ['--session', sessionId] : []),
    prompt,
  ];
  if (args.some((arg) => FORBIDDEN_FLAGS.includes(arg))) {
    throw new Error('Refusing to pass a permission-skipping flag to opencode.');
  }
  return args;
}

/** Shell syntax that could chain, redirect, substitute or glob past the allows above it. */
const SHELL_SYNTAX_DENY = [
  '*&*',
  '*|*',
  '*;*',
  '*>*',
  '*<*',
  '*`*',
  '*$*',
  '*..*',
  'git *',
  'rm *',
  'del *',
  'curl *',
  'wget *',
];

/**
 * Writes the staging copy's `opencode.json` before a run. OpenCode has no
 * sandbox like agy's that refuses every write from a command, so this file is
 * the only thing standing between a DeepSeek member and the rest of the
 * machine: the last matching rule wins, so every map below opens with a
 * blanket "deny" and only then allows the exact shapes the crew may use.
 */
export function writeOpencodeConfig(stagingDir, { fence, referenceFiles, runner }) {
  // Edit: only the order's own fence, exactly as the order wrote it — the
  // bridge still re-checks every change against the fence afterwards, but a
  // member that cannot even attempt to write outside it wastes no turns on it.
  const edit = { '*': 'deny' };
  for (const glob of fence) edit[glob] = 'allow';

  // Bash: the same read-only check commands agy's members may run themselves
  // (commands.mjs), written as OpenCode wildcard patterns.
  const bash = { '*': 'deny' };
  for (const shape of CREW_COMMANDS) bash[`${shape.words.join(' ')} *`] = 'allow';
  // Unlike agy's sandbox, OpenCode has nothing that stops Vitest writing its
  // config bundle and cache, so only its own members may also run the suite.
  if (runner === 'opencode') bash['pnpm exec vitest run *'] = 'allow';
  // Placed after the allows above so a wildcard allow can never smuggle in
  // chaining, redirection, substitution or the handful of commands that could
  // reach outside the staging copy.
  for (const pattern of SHELL_SYNTAX_DENY) bash[pattern] = 'deny';

  // External directories: nothing by default, then the order's own reference
  // reads under src/ or original/, by absolute path, exactly as agy gets them
  // through --add-dir.
  const externalDirectory = { '*': 'deny' };
  for (const file of referenceFiles) externalDirectory[file] = 'allow';

  const config = {
    permission: {
      edit,
      bash,
      // No network request has any business in a headless crew run.
      webfetch: 'deny',
      websearch: 'deny',
      // No subagents, and nobody to answer a question in a headless run.
      task: 'deny',
      question: 'deny',
      todowrite: 'deny',
      external_directory: externalDirectory,
    },
  };
  writeFileSync(join(stagingDir, 'opencode.json'), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export const PING_TIMEOUT_SECONDS = 90;

/** The no-tool config for `crew ping`: proves login and the model without letting it touch anything. */
export function writePingConfig(dir) {
  const config = {
    permission: {
      edit: { '*': 'deny' },
      bash: { '*': 'deny' },
      webfetch: 'deny',
      websearch: 'deny',
      task: 'deny',
      question: 'deny',
      todowrite: 'deny',
      external_directory: { '*': 'deny' },
    },
  };
  writeFileSync(join(dir, 'opencode.json'), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

const QUOTA_SIGNS = /quota|rate limit|\b429\b|\b402\b|insufficient balance/i;
const DENIED_PREFIX = 'Permission denied';

/** Parses OpenCode's JSON Lines output; an unparsable line is skipped, not fatal. */
function parseEvents(stdout) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // A stray non-JSON line (a startup banner, a warning) is not an error.
    }
  }
  return events;
}

/** The final reply is every `text` part's text, in the order the events arrived. */
function responseOf(events) {
  return events
    .filter((event) => event.type === 'text')
    .map((event) => event.part?.text ?? '')
    .join('');
}

function sessionIdOf(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].sessionID) return events[i].sessionID;
  }
  return null;
}

/** A run's own usage is the sum of its steps (a follow-up reports only its own). */
function usageOf(events) {
  const totals = { input: 0, output: 0, thinking: 0, cacheRead: 0, total: 0 };
  for (const event of events) {
    if (event.type !== 'step_finish') continue;
    const tokens = event.part?.tokens;
    if (!tokens) continue;
    totals.input += tokens.input ?? 0;
    totals.output += tokens.output ?? 0;
    totals.thinking += tokens.reasoning ?? 0;
    totals.cacheRead += tokens.cache?.read ?? 0;
  }
  totals.total = totals.input + totals.output + totals.thinking;
  return totals;
}

function deniedActionsOf(events) {
  const denied = [];
  for (const event of events) {
    if (event.type !== 'tool_use') continue;
    const error = event.part?.state?.error;
    if (typeof error === 'string' && error.startsWith(DENIED_PREFIX)) {
      denied.push({ tool: event.part?.tool, error });
    }
  }
  return denied;
}

/** Whether the turn ended the way a finished turn does: its last step stopped of its own accord. */
function finishedTurn(events) {
  const steps = events.filter((event) => event.type === 'step_finish');
  return steps.length > 0 && steps[steps.length - 1].part?.reason === 'stop';
}

/**
 * Sorts a finished opencode process into the same outcomes `interpretRun`
 * gives for agy: ok, crew-error, quota, timeout, transport. A denied tool
 * call does not end an OpenCode turn (unlike agy), so a round with denied
 * actions and applied changes is reviewed like any other.
 */
export function interpretOpencodeRun(run) {
  const events = parseEvents(run.stdout);
  const result =
    events.length > 0
      ? {
          sessionId: sessionIdOf(events),
          response: responseOf(events),
          usage: usageOf(events),
          deniedActions: deniedActionsOf(events),
        }
      : null;

  if (run.timedOut) {
    return { outcome: 'timeout', result, message: 'opencode did not finish in time' };
  }
  const errorEvents = events.filter((event) => event.type === 'error');
  const failed = run.exitCode !== 0 || errorEvents.length > 0 || !finishedTurn(events);
  // Only the run's own errors can say the quota ran out. The crew's replies and the files it
  // read are full of ordinary words (a doc that mentions a quota, a "burn rate"), and a turn that
  // finished cleanly did not run out of anything.
  const errorText = [run.stderr, ...errorEvents.map((event) => JSON.stringify(event))].join('\n');
  if (failed && QUOTA_SIGNS.test(errorText)) {
    return { outcome: 'quota', result, message: 'DeepSeek quota or rate limit reached' };
  }
  if (run.spawnError) return { outcome: 'transport', result, message: run.spawnError };
  if (events.length === 0) {
    return { outcome: 'transport', result, message: `no parsable event (exit ${run.exitCode})` };
  }
  if (errorEvents.length > 0 || run.exitCode !== 0) {
    return { outcome: 'crew-error', result, message: `opencode exit code ${run.exitCode}` };
  }
  return { outcome: 'ok', result, message: 'turn completed' };
}
