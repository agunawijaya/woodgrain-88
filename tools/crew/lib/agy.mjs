/**
 * Talking to the Antigravity CLI. Builds the only argument list the bridge
 * ever passes, runs it with a hard wall-clock limit, and sorts the outcome so
 * the dispatcher knows whether a retry makes sense.
 *
 * Verified on this machine (ADR-0007): in headless accept-edits mode agy edits
 * files but soft-denies every shell command, and a denied command ends the
 * turn. That is why the crew is told never to run commands and the bridge runs
 * acceptance itself.
 */
import { spawn } from 'node:child_process';
import { ALLOWED_MODEL } from './order.mjs';

const FORBIDDEN_FLAGS = ['--dangerously-skip-permissions'];

// agy's own --print-timeout is not always honoured, so the bridge kills the
// process itself once this grace period has passed.
const KILL_GRACE_SECONDS = 60;

/** Decides how to launch agy: the real executable, or a script for tests. */
export function resolveAgyCommand(env = process.env) {
  const configured = env.CREW_AGY;
  if (!configured) return { command: 'agy', prefix: [] };
  if (/\.(mjs|js)$/.test(configured)) return { command: process.execPath, prefix: [configured] };
  return { command: configured, prefix: [] };
}

export function buildAgyArgs({ prompt, model, timeoutSeconds, conversationId, addDirs = [] }) {
  if (!ALLOWED_MODEL.test(model)) throw new Error(`Refusing to run agy with model "${model}".`);
  const args = [
    '-p',
    prompt,
    '--model',
    model,
    '--mode',
    'accept-edits',
    '--sandbox',
    '--output-format',
    'json',
    '--print-timeout',
    `${timeoutSeconds}s`,
  ];
  for (const dir of addDirs) args.push('--add-dir', dir);
  if (conversationId) args.push('--conversation', conversationId);
  if (args.some((arg) => FORBIDDEN_FLAGS.includes(arg))) {
    throw new Error('Refusing to pass a permission-skipping flag to agy.');
  }
  return args;
}

export const PING_TIMEOUT_SECONDS = 90;

/**
 * A no-op turn in plan mode: proves login, quota and the model without
 * touching files. Quota is counted per model family, so ping checks one
 * model of each family the order kinds default to.
 */
export function buildPingArgs(model) {
  if (!ALLOWED_MODEL.test(model)) throw new Error(`Refusing to ping with model "${model}".`);
  return [
    '-p',
    'Reply with the single word READY and nothing else. Do not use any tools.',
    '--model',
    model,
    '--mode',
    'plan',
    '--output-format',
    'json',
    '--print-timeout',
    `${PING_TIMEOUT_SECONDS}s`,
  ];
}

export function runProcess({ command, args, cwd, timeoutSeconds, env, shell = false }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(command, args, { cwd, env: env ?? process.env, windowsHide: true, shell });
    } catch (error) {
      resolve({ exitCode: null, stdout, stderr, timedOut, spawnError: String(error), seconds: 0 });
      return;
    }
    const killer = setTimeout(
      () => {
        timedOut = true;
        child.kill();
      },
      (timeoutSeconds + KILL_GRACE_SECONDS) * 1000,
    );
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(killer);
      resolve({ exitCode: null, stdout, stderr, timedOut, spawnError: String(error), seconds: 0 });
    });
    child.on('close', (exitCode) => {
      clearTimeout(killer);
      const seconds = (Date.now() - started) / 1000;
      resolve({ exitCode, stdout, stderr, timedOut, spawnError: null, seconds });
    });
  });
}

const QUOTA_SIGNS = /quota|RESOURCE_EXHAUSTED|rate limit|\b429\b/i;

function parseJsonOutput(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Sorts a finished agy process into one outcome:
 *   ok          the turn completed and agy returned its JSON result
 *   crew-error  agy answered but the turn did not succeed
 *   quota       the Antigravity quota or rate limit stopped the run
 *   timeout     the run hit the bridge's wall-clock limit
 *   transport   agy could not be started or returned no readable result
 * Only `transport` is worth an automatic retry.
 */
export function interpretRun(run) {
  const result = parseJsonOutput(run.stdout);
  const text = `${run.stderr}\n${result?.response ?? ''}`;
  if (run.timedOut) return { outcome: 'timeout', result, message: 'agy did not finish in time' };
  if (QUOTA_SIGNS.test(text) && result?.status !== 'SUCCESS') {
    return { outcome: 'quota', result, message: 'Antigravity quota or rate limit reached' };
  }
  if (run.spawnError) return { outcome: 'transport', result, message: run.spawnError };
  if (!result) {
    return { outcome: 'transport', result, message: `no JSON result (exit ${run.exitCode})` };
  }
  if (result.status !== 'SUCCESS') {
    return { outcome: 'crew-error', result, message: `agy status ${result.status}` };
  }
  return { outcome: 'ok', result, message: 'turn completed' };
}

/** The crew ends its reply with a fenced JSON report (docs/team/CREW.md); read the last one. */
export function extractCrewReport(response) {
  if (!response) return null;
  const blocks = [...response.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  const last = blocks.at(-1);
  if (!last) return null;
  try {
    return JSON.parse(last[1]);
  } catch {
    return null;
  }
}

export function usageOf(result) {
  const usage = result?.usage ?? {};
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    thinking: usage.thinking_tokens ?? 0,
    cacheRead: usage.cache_read_tokens ?? 0,
    total: usage.total_tokens ?? 0,
  };
}

/** One round's own usage, given the conversation's running total before it. */
export function subtractUsage(current, previous) {
  if (!previous) return current;
  const delta = (key) => Math.max(0, current[key] - (previous[key] ?? 0));
  return {
    input: delta('input'),
    output: delta('output'),
    thinking: delta('thinking'),
    cacheRead: delta('cacheRead'),
    total: delta('total'),
  };
}
