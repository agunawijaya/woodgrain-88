#!/usr/bin/env node
/**
 * The crew bridge: how a Claude Code lead hands routine work to Gemini models
 * running headless in the Antigravity CLI, without the owner relaying anything.
 * See docs/team/PROTOCOL.md for when and how to use it, and ADR-0007 for why it
 * works the way it does.
 *
 *   crew dispatch <order.md> [--member agy-argon|agy-flash|deepseek-pro|deepseek-flash]
 *                            [--model <model>] [--wait]
 *   crew followup <order-id> "<numbered notes>" [--wait]
 *   crew review <order-id> [--verdict accepted|rejected|taken-over]
 *               [--lead-tokens N] [--solo-tokens N] [--note "..."]
 *   crew status
 *   crew ping          (every member: both Agy models, both DeepSeek models, the subagents)
 *   crew allow        (lets the crew run its check commands; see lib/permissions.mjs)
 *
 * Every command prints one JSON object on stdout.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPingArgs,
  interpretRun,
  PING_TIMEOUT_SECONDS,
  resolveAgyCommand,
  runProcess,
} from './lib/agy.mjs';
import { readLedger, recordReview, writeLedger } from './lib/ledger.mjs';
import { MEMBERS } from './lib/members.mjs';
import { DEFAULT_MODEL_BY_KIND } from './lib/order.mjs';
import {
  buildOpencodeArgs,
  interpretOpencodeRun,
  PING_TIMEOUT_SECONDS as OPENCODE_PING_TIMEOUT_SECONDS,
  resolveOpencodeCommand,
  writePingConfig,
} from './lib/opencode.mjs';
import { installCrewRules, missingCrewRules, readAgySettings } from './lib/permissions.mjs';
import { dispatchOrder, followUp, readState } from './lib/run.mjs';
import { activeClaims, withLock } from './lib/slots.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Flags that take no value; every other --flag reads the next argument.
const SWITCHES = new Set(['wait']);

function readFlags(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') && SWITCHES.has(arg.slice(2))) {
      flags[arg.slice(2)] = true;
    } else if (arg.startsWith('--')) {
      flags[arg.slice(2)] = args[i + 1];
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function optionalCount(value, name) {
  if (value === undefined) return undefined;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) throw new Error(`--${name} must be a whole number.`);
  return count;
}

/** `opencode models` output is the same shape as `agy models`: id, then a tab, then its name. */
async function listOpencodeModels(opencode) {
  const run = await runProcess({
    command: opencode.command,
    args: [...opencode.prefix, 'models'],
    cwd: repoRoot,
    timeoutSeconds: 60,
  });
  return run.stdout
    .split(/\r?\n/)
    .map((line) => line.split(/\s/)[0])
    .filter(Boolean);
}

/** A no-tool turn in `.team/worktrees/_ping-opencode/`, denying every tool (behaviour 19). */
async function pingOpencodeModel(opencode, model) {
  const pingDir = join(repoRoot, '.team', 'worktrees', '_ping-opencode');
  mkdirSync(pingDir, { recursive: true });
  writePingConfig(pingDir);
  const args = buildOpencodeArgs({
    prompt: 'Reply with the single word READY and nothing else. Do not use any tools.',
    model,
  });
  const run = await runProcess({
    command: opencode.command,
    args: [...opencode.prefix, ...args],
    cwd: pingDir,
    // OpenCode works in PWD, not the process's directory; see run.mjs.
    env: { ...process.env, PWD: pingDir },
    timeoutSeconds: OPENCODE_PING_TIMEOUT_SECONDS,
    killTree: true,
  });
  const verdict = interpretOpencodeRun(run);
  const ready = verdict.outcome === 'ok' && /READY/i.test(verdict.result?.response ?? '');
  return ready ? 'ready' : verdict.outcome;
}

const subagentAvailable = (name) =>
  existsSync(join(homedir(), '.claude', 'agents', `${name}.md`)) ? 'available' : 'missing';

async function ping() {
  const agy = resolveAgyCommand();
  const models = await runProcess({
    command: agy.command,
    args: [...agy.prefix, 'models'],
    cwd: repoRoot,
    timeoutSeconds: 60,
  });
  const geminiModels = models.stdout
    .split(/\r?\n/)
    .map((line) => line.split(/\s/)[0])
    .filter((name) => /^gemini-/.test(name));
  const pingDir = join(repoRoot, '.team', 'worktrees', '_ping');
  mkdirSync(pingDir, { recursive: true });
  const defaults = [...new Set(Object.values(DEFAULT_MODEL_BY_KIND))];
  const byModel = {};
  for (const model of defaults) {
    const run = await runProcess({
      command: agy.command,
      args: [...agy.prefix, ...buildPingArgs(model)],
      cwd: pingDir,
      timeoutSeconds: PING_TIMEOUT_SECONDS,
    });
    const verdict = interpretRun(run);
    const ready = verdict.outcome === 'ok' && /READY/i.test(verdict.result?.response ?? '');
    const quotaNote = /Resets in [^."]+/.exec(run.stderr)?.[0];
    byModel[model] = ready ? 'ready' : `${verdict.outcome}${quotaNote ? ` (${quotaNote})` : ''}`;
  }
  const ready = Object.values(byModel).filter((state) => state === 'ready').length;
  const missingRules = missingCrewRules(readAgySettings()).length;

  const opencode = resolveOpencodeCommand();
  const opencodeModels = await listOpencodeModels(opencode);
  const deepseekResults = {};
  for (const [name, member] of Object.entries(MEMBERS)) {
    if (member.runner !== 'opencode') continue;
    deepseekResults[name] = opencodeModels.includes(member.model)
      ? await pingOpencodeModel(opencode, member.model)
      : `model "${member.model}" not listed by opencode models`;
  }

  const members = {
    'agy-argon': byModel[MEMBERS['agy-argon'].model],
    'agy-flash': byModel[MEMBERS['agy-flash'].model],
    ...deepseekResults,
    engineer: subagentAvailable('engineer'),
    'qa-scout': subagentAvailable('qa-scout'),
  };
  const everyMemberReady = Object.values(members).every(
    (state) => state === 'ready' || state === 'available',
  );

  return {
    ok: ready === defaults.length && geminiModels.length > 0 && everyMemberReady,
    geminiModels,
    defaultModels: byModel,
    members,
    crewChecks:
      missingRules === 0
        ? 'ready'
        : `${missingRules} agy rules missing; run \`crew allow\` so the crew can run its checks`,
    message:
      ready === defaults.length
        ? 'crew is reachable on every default model'
        : ready > 0
          ? 'some default models are blocked; pass --model to dispatch on one that is ready'
          : 'no default model is reachable',
  };
}

function status() {
  const ledger = readLedger(repoRoot);
  const running = new Set(activeClaims(repoRoot).map((claim) => claim.id));
  return {
    orders: ledger.orders.map((order) => {
      const state = readState(repoRoot, order.id);
      return {
        id: order.id,
        kind: order.kind,
        status: running.has(order.id) ? 'running' : order.status,
        rounds: order.rounds,
        member: order.member ?? 'agy',
        model: order.model,
        seconds: order.seconds,
        crewTokens: order.crewTokens.total,
        lastReport: state ? `.team/runs/${order.id}/round-${state.rounds.length}/report.md` : null,
      };
    }),
    running: [...running],
  };
}

async function review(id, flags) {
  return withLock(repoRoot, 'ledger', () => {
    const ledger = readLedger(repoRoot);
    const entry = recordReview(ledger, {
      id,
      verdict: flags.verdict,
      leadTokens: optionalCount(flags['lead-tokens'], 'lead-tokens'),
      soloTokens: optionalCount(flags['solo-tokens'], 'solo-tokens'),
      note: flags.note,
      at: new Date().toISOString(),
    });
    writeLedger(repoRoot, ledger);
    return entry;
  });
}

async function main(argv) {
  const [command, ...rest] = argv;
  const { positional, flags } = readFlags(rest);
  switch (command) {
    case 'dispatch':
      if (!positional[0])
        throw new Error('Usage: crew dispatch <order.md> [--member <name>] [--model <model>]');
      return dispatchOrder({
        repoRoot,
        orderPath: positional[0],
        modelOverride: flags.model,
        memberOverride: flags.member,
        waitForSlot: flags.wait === true,
      });
    case 'followup':
      if (!positional[0]) throw new Error('Usage: crew followup <order-id> "<notes>"');
      return followUp({
        repoRoot,
        id: positional[0],
        message: positional.slice(1).join(' '),
        memberOverride: flags.member,
        waitForSlot: flags.wait === true,
      });
    case 'review':
      if (!positional[0])
        throw new Error('Usage: crew review <order-id> [--verdict ...] [--lead-tokens N]');
      return review(positional[0], flags);
    case 'status':
      return status();
    case 'ping':
      return ping();
    case 'allow':
      return installCrewRules();
    default:
      throw new Error('Commands: dispatch, followup, review, status, ping, allow');
  }
}

try {
  const result = await main(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (
    result &&
    (result.ok === false || ['transport', 'quota', 'timeout', 'crew-error'].includes(result.status))
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
