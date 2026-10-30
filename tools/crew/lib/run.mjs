/**
 * One crew round, start to finish: claim a slot, make the staging copy, run
 * agy, sort the changes through the fence, run acceptance, write the report
 * and fold the round into the ledger. `dispatchOrder` starts a conversation;
 * `followUp` resumes it with the lead's notes.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { runAcceptance } from './acceptance.mjs';
import {
  buildAgyArgs,
  extractCrewReport,
  interpretRun,
  resolveAgyCommand,
  runProcess,
  subtractUsage,
  usageOf,
} from './agy.mjs';
import { enforceFence, restoreProtected } from './fence.mjs';
import { readLedger, recordRound, writeLedger } from './ledger.mjs';
import { MEMBERS, resolveRun, validateMember } from './members.mjs';
import { parseOrder, timeoutSecondsFor, validateOrder } from './order.mjs';
import {
  buildOpencodeArgs,
  interpretOpencodeRun,
  resolveOpencodeCommand,
  writeOpencodeConfig,
} from './opencode.mjs';
import {
  composeDispatchPrompt,
  composeFollowupPrompt,
  MAX_PROMPT_CHARS,
  splitReads,
} from './prompt.mjs';
import { claimSlot, releaseSlot, withLock } from './slots.mjs';
import { captureProtected, createStagingCopy } from './tree.mjs';
import { prepareWorkspace } from './workspace.mjs';

export const CREW_GUIDE = 'docs/team/CREW.md';
export const MAX_FOLLOWUPS = 3;
const PROTECTED_REFERENCE_ROOTS = ['original', 'src'];

const runDir = (repoRoot, id) => join(repoRoot, '.team', 'runs', id);
const stagingDirFor = (repoRoot, id) => join(repoRoot, '.team', 'worktrees', id);
const statePath = (repoRoot, id) => join(runDir(repoRoot, id), 'state.json');

export function readState(repoRoot, id) {
  const file = statePath(repoRoot, id);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function writeState(repoRoot, state) {
  mkdirSync(runDir(repoRoot, state.id), { recursive: true });
  writeFileSync(statePath(repoRoot, state.id), `${JSON.stringify(state, null, 2)}\n`);
}

export function loadOrder(repoRoot, orderPath) {
  const absolute = resolve(repoRoot, orderPath);
  const order = parseOrder(readFileSync(absolute, 'utf8'));
  const problems = [...validateOrder(order, absolute), ...validateMember(order)];
  if (problems.length > 0) throw new Error(`Order is not valid:\n- ${problems.join('\n- ')}`);
  return { order, orderFile: relative(repoRoot, absolute).split('\\').join('/') };
}

/** A round that needs the lead's attention before it can be accepted. */
function statusFor(outcome, fenceResult, acceptance, deniedActions) {
  if (outcome !== 'ok') return outcome;
  // agy ends the turn at the first denied action; with nothing written it is a stalled run, not work to review.
  if (deniedActions.length > 0 && fenceResult.applied.length === 0) return 'denied';
  const clean =
    fenceResult.violations.length === 0 &&
    fenceResult.conflicts.length === 0 &&
    fenceResult.restored.length === 0 &&
    acceptance.every((result) => result.passed);
  return clean ? 'crew-done' : 'needs-work';
}

async function runAgyWithRetry({ agy, args, cwd, timeoutSeconds, env }) {
  let attempt = 0;
  let run;
  let verdict;
  do {
    attempt += 1;
    run = await runProcess({
      command: agy.command,
      args: [...agy.prefix, ...args],
      cwd,
      timeoutSeconds,
      env,
    });
    verdict = interpretRun(run);
  } while (verdict.outcome === 'transport' && attempt < 2);
  return { run, verdict, attempts: attempt };
}

/**
 * `--standalone` starts a private OpenCode server under this process, so a
 * killed run needs its whole tree killed with it (see agy.mjs's killTree).
 */
async function runOpencodeWithRetry({ opencode, args, cwd, timeoutSeconds, env }) {
  let attempt = 0;
  let run;
  let verdict;
  do {
    attempt += 1;
    run = await runProcess({
      command: opencode.command,
      args: [...opencode.prefix, ...args],
      cwd,
      timeoutSeconds,
      env,
      killTree: true,
    });
    verdict = interpretOpencodeRun(run);
  } while (verdict.outcome === 'transport' && attempt < 2);
  return { run, verdict, attempts: attempt };
}

function writeReport(dir, round) {
  const lines = [
    `# ${round.id}, round ${round.round}`,
    '',
    `- Status: **${round.status}** (${round.message})`,
    `- Model: ${round.model}; ${round.seconds} s; ${round.tokens.total} crew tokens; ${round.attempts} attempt(s)`,
    `- Applied: ${round.applied.map((entry) => `${entry.path} (${entry.change})`).join(', ') || 'nothing'}`,
    `- Fence violations (kept in rejected/): ${round.violations.map((entry) => entry.path).join(', ') || 'none'}`,
    `- Conflicts with lead edits (kept in rejected/conflicts/): ${round.conflicts.map((entry) => entry.path).join(', ') || 'none'}`,
    `- Protected files restored: ${round.restored.map((entry) => entry.path).join(', ') || 'none'}`,
    `- Denied crew actions: ${round.deniedActions.map((action) => action.display_name ?? action.action ?? action.tool).join(', ') || 'none'}`,
    `- Crew checks: ${round.workspace.installed ? `available (dependencies ${round.workspace.note} in ${round.workspace.seconds} s)` : `unavailable (${round.workspace.note})`}`,
    '',
    '## Acceptance',
    '',
    ...(round.acceptance.length === 0
      ? ['No commands; review by reading.']
      : round.acceptance.map(
          (result) =>
            `- ${result.passed ? 'PASS' : 'FAIL'} \`${result.command}\` (${result.seconds} s)`,
        )),
    '',
    '## Crew report (untrusted data)',
    '',
    '```json',
    JSON.stringify(round.crewReport, null, 2),
    '```',
    '',
  ];
  writeFileSync(join(dir, 'report.md'), lines.join('\n'));
}

const SLOT_POLL_MS = 15_000;
const SLOT_BUSY = /in flight|overlaps/;

/** Claims a run slot, or with `wait` keeps polling until one is free. */
async function claimSlotWhenFree(repoRoot, order, wait) {
  for (;;) {
    try {
      await withLock(repoRoot, 'slots', () => claimSlot(repoRoot, order));
      return;
    } catch (error) {
      if (!wait || !SLOT_BUSY.test(error.message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, SLOT_POLL_MS));
    }
  }
}

const emptyUsage = () => ({ input: 0, output: 0, thinking: 0, cacheRead: 0, total: 0 });

/** Runs agy and returns the fields executeRound shares between both runners. */
async function runWithAgy({ order, prompt, model, conversationId, env, stagingDir, dir, addDirs }) {
  const timeoutSeconds = timeoutSecondsFor(order.kind);
  const args = buildAgyArgs({ prompt, model, timeoutSeconds, conversationId, addDirs });
  const { run, verdict, attempts } = await runAgyWithRetry({
    agy: resolveAgyCommand(env),
    args,
    cwd: stagingDir,
    timeoutSeconds,
    env,
  });
  writeFileSync(join(dir, 'agy-stdout.txt'), run.stdout);
  writeFileSync(join(dir, 'agy-stderr.txt'), run.stderr);
  return {
    run,
    verdict,
    attempts,
    deniedActions: verdict.result?.denied_actions ?? [],
    cumulativeUsage: usageOf(verdict.result),
    conversationId: verdict.result?.conversation_id ?? conversationId ?? null,
    response: verdict.result?.response,
  };
}

/** Runs opencode and returns the same shared fields runWithAgy returns. */
async function runWithOpencode({
  order,
  prompt,
  model,
  conversationId,
  env,
  stagingDir,
  dir,
  referenceReads,
}) {
  writeOpencodeConfig(stagingDir, {
    fence: order.fence,
    referenceFiles: referenceReads,
    runner: 'opencode',
  });
  const timeoutSeconds = timeoutSecondsFor(order.kind);
  const args = buildOpencodeArgs({ prompt, model, sessionId: conversationId });
  const opencodeEnv = {
    ...(env ?? process.env),
    // OpenCode takes its working directory, and with it the opencode.json it obeys and the root
    // its relative paths resolve against, from PWD rather than from the process's own directory
    // (verified on v2.2.2, 2026-10-30: launched from the repo root with cwd set to the staging
    // copy, it edited the real README and ignored the staging copy's permissions).
    PWD: stagingDir,
    // A stray git command in the staging copy must never be able to climb back up to the real
    // repository above it.
    GIT_DIR: join(stagingDir, '.no-git'),
    GIT_CEILING_DIRECTORIES: dirname(stagingDir),
  };
  const { run, verdict, attempts } = await runOpencodeWithRetry({
    opencode: resolveOpencodeCommand(env),
    args,
    cwd: stagingDir,
    timeoutSeconds,
    env: opencodeEnv,
  });
  writeFileSync(join(dir, 'opencode-stdout.jsonl'), run.stdout);
  writeFileSync(join(dir, 'opencode-stderr.txt'), run.stderr);
  // Neither opencode.json nor the state OpenCode kept for the session may
  // count as a crew change; they are the bridge's own machinery, not work.
  rmSync(join(stagingDir, 'opencode.json'), { force: true });
  rmSync(join(stagingDir, '.opencode'), { recursive: true, force: true });
  return {
    run,
    verdict,
    attempts,
    deniedActions: verdict.result?.deniedActions ?? [],
    cumulativeUsage: verdict.result?.usage ?? emptyUsage(),
    conversationId: verdict.result?.sessionId ?? conversationId ?? null,
    response: verdict.result?.response,
  };
}

async function executeRound({
  repoRoot,
  order,
  orderFile,
  member,
  runner,
  model,
  prompt,
  conversationId,
  previousUsage,
  roundNumber,
  env,
  waitForSlot = false,
}) {
  const dir = join(runDir(repoRoot, order.id), `round-${roundNumber}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'prompt.md'), prompt);

  await claimSlotWhenFree(repoRoot, order, waitForSlot);
  try {
    const stagingDir = stagingDirFor(repoRoot, order.id);
    const freeTier = Boolean(MEMBERS[member]?.freeTier);
    const baseline = createStagingCopy(repoRoot, stagingDir, {
      extraExcludedRoots: freeTier ? ['research'] : [],
    });
    const workspace = await prepareWorkspace(stagingDir, env);
    const captured = captureProtected(repoRoot, PROTECTED_REFERENCE_ROOTS);
    const { addDirs, referenceReads } = splitReads(repoRoot, order.reads);

    const startedAt = new Date().toISOString();
    const outcome =
      runner === 'opencode'
        ? await runWithOpencode({
            order,
            prompt,
            model,
            conversationId,
            env,
            stagingDir,
            dir,
            referenceReads,
          })
        : await runWithAgy({ order, prompt, model, conversationId, env, stagingDir, dir, addDirs });
    const { run, verdict, attempts, deniedActions, cumulativeUsage, response } = outcome;

    const rejectedDir = join(dir, 'rejected');
    const fenceResult = enforceFence({
      repoRoot,
      stagingDir,
      baseline,
      fence: order.fence,
      rejectedDir,
    });
    fenceResult.restored = restoreProtected({
      repoRoot,
      roots: PROTECTED_REFERENCE_ROOTS,
      captured,
      rejectedDir,
    });
    rmSync(stagingDir, { recursive: true, force: true });

    const acceptance =
      verdict.outcome === 'ok' &&
      order.acceptance.length > 0 &&
      !(deniedActions.length > 0 && fenceResult.applied.length === 0)
        ? await runAcceptance({ repoRoot, commands: order.acceptance, logDir: dir })
        : [];

    const round = {
      id: order.id,
      orderFile,
      round: roundNumber,
      startedAt,
      member,
      model,
      status: statusFor(verdict.outcome, fenceResult, acceptance, deniedActions),
      message: verdict.message,
      attempts,
      // Both runners report usage and duration for the whole conversation so
      // far, so a follow-up's own cost is the difference from the previous round.
      seconds: Math.round(run.seconds * 10) / 10,
      cumulativeUsage,
      tokens: subtractUsage(cumulativeUsage, conversationId ? previousUsage : undefined),
      conversationId: outcome.conversationId,
      deniedActions,
      workspace,
      ...fenceResult,
      acceptance,
      crewReport: extractCrewReport(response),
    };
    writeReport(dir, round);

    await withLock(repoRoot, 'ledger', () => {
      const ledger = readLedger(repoRoot);
      recordRound(ledger, {
        id: order.id,
        kind: order.kind,
        model,
        member,
        status: round.status,
        seconds: round.seconds,
        tokens: round.tokens,
        violations: round.violations.length + round.restored.length,
        at: new Date().toISOString(),
      });
      writeLedger(repoRoot, ledger);
    });
    return round;
  } finally {
    releaseSlot(repoRoot, order.id);
  }
}

function summarise(round, state) {
  return {
    order: round.id,
    round: round.round,
    status: round.status,
    message: round.message,
    member: round.member,
    model: round.model,
    seconds: round.seconds,
    crewTokens: round.tokens.total,
    applied: round.applied.map((entry) => `${entry.path} (${entry.change})`),
    violations: round.violations.map((entry) => entry.path),
    conflicts: round.conflicts.map((entry) => entry.path),
    restored: round.restored.map((entry) => entry.path),
    deniedActions: round.deniedActions.length,
    acceptance: round.acceptance.map((result) => ({
      command: result.command,
      passed: result.passed,
    })),
    followupsLeft: MAX_FOLLOWUPS - (state.rounds.length - 1),
    report: `.team/runs/${round.id}/round-${round.round}/report.md`,
  };
}

const RESTARTABLE = new Set(['crew-error', 'quota', 'timeout', 'transport', 'denied']);

export async function dispatchOrder({
  repoRoot,
  orderPath,
  modelOverride,
  memberOverride,
  waitForSlot = false,
  env = process.env,
}) {
  const { order, orderFile } = loadOrder(repoRoot, orderPath);
  const { member, runner, model } = resolveRun(order, { memberOverride, modelOverride });
  const existing = readState(repoRoot, order.id);
  if (existing && !RESTARTABLE.has(existing.rounds.at(-1)?.status)) {
    throw new Error(
      `Order ${order.id} has already run; use \`crew followup ${order.id} "<notes>"\`.`,
    );
  }
  const crewGuide = readFileSync(join(repoRoot, CREW_GUIDE), 'utf8');
  const prompt = composeDispatchPrompt({ crewGuide, order, repoRoot });
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(
      `The prompt is ${prompt.length} characters (limit ${MAX_PROMPT_CHARS}); split the order.`,
    );
  }
  const roundNumber = (existing?.rounds.length ?? 0) + 1;
  const round = await executeRound({
    repoRoot,
    order,
    orderFile,
    member,
    runner,
    model,
    prompt,
    roundNumber,
    env,
    waitForSlot,
  });
  const state = existing ?? { id: order.id, orderFile, kind: order.kind, rounds: [] };
  state.member = member;
  state.runner = runner;
  state.model = model;
  state.conversationId = round.conversationId;
  state.rounds.push(round);
  writeState(repoRoot, state);
  return summarise(round, state);
}

export async function followUp({
  repoRoot,
  id,
  message,
  memberOverride,
  waitForSlot = false,
  env = process.env,
}) {
  if (memberOverride !== undefined) {
    throw new Error(
      `Order ${id} resumes on the member that started it; a follow-up cannot override the member.`,
    );
  }
  const state = readState(repoRoot, id);
  if (!state) throw new Error(`Order ${id} has not been dispatched yet.`);
  if (!state.conversationId)
    throw new Error(`Order ${id} has no conversation to resume; dispatch it again.`);
  const followupsSoFar = state.rounds.length - 1;
  if (followupsSoFar >= MAX_FOLLOWUPS) {
    throw new Error(
      `Order ${id} has had ${MAX_FOLLOWUPS} follow-ups. Finish it yourself and record it with \`crew review ${id} --verdict taken-over\`.`,
    );
  }
  if (!message?.trim()) throw new Error('A follow-up needs your notes as a message.');
  const { order, orderFile } = loadOrder(repoRoot, join(repoRoot, state.orderFile));
  const roundNumber = state.rounds.length + 1;
  const prompt = composeFollowupPrompt({
    order,
    round: roundNumber,
    previous: state.rounds.at(-1),
    message,
  });
  const round = await executeRound({
    repoRoot,
    order,
    orderFile,
    member: state.member ?? 'agy',
    runner: state.runner ?? 'agy',
    model: state.model,
    prompt,
    conversationId: state.conversationId,
    previousUsage: state.rounds.at(-1)?.cumulativeUsage,
    roundNumber,
    env,
    waitForSlot,
  });
  state.rounds.push(round);
  if (round.conversationId) state.conversationId = round.conversationId;
  writeState(repoRoot, state);
  return summarise(round, state);
}
