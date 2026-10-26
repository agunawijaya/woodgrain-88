/**
 * One crew round, start to finish: claim a slot, make the staging copy, run
 * agy, sort the changes through the fence, run acceptance, write the report
 * and fold the round into the ledger. `dispatchOrder` starts a conversation;
 * `followUp` resumes it with the lead's notes.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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
import { parseOrder, resolveModel, timeoutSecondsFor, validateOrder } from './order.mjs';
import {
  composeDispatchPrompt,
  composeFollowupPrompt,
  MAX_PROMPT_CHARS,
  splitReads,
} from './prompt.mjs';
import { claimSlot, releaseSlot, withLock } from './slots.mjs';
import { captureProtected, createStagingCopy } from './tree.mjs';

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
  const problems = validateOrder(order, absolute);
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
    `- Denied crew actions: ${round.deniedActions.map((action) => action.display_name ?? action.action).join(', ') || 'none'}`,
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

async function executeRound({
  repoRoot,
  order,
  orderFile,
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
    const baseline = createStagingCopy(repoRoot, stagingDir);
    const captured = captureProtected(repoRoot, PROTECTED_REFERENCE_ROOTS);
    const { addDirs } = splitReads(repoRoot, order.reads);
    const timeoutSeconds = timeoutSecondsFor(order.kind);
    const args = buildAgyArgs({ prompt, model, timeoutSeconds, conversationId, addDirs });

    const startedAt = new Date().toISOString();
    const { run, verdict, attempts } = await runAgyWithRetry({
      agy: resolveAgyCommand(env),
      args,
      cwd: stagingDir,
      timeoutSeconds,
      env,
    });
    writeFileSync(join(dir, 'agy-stdout.txt'), run.stdout);
    writeFileSync(join(dir, 'agy-stderr.txt'), run.stderr);

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
      !((verdict.result?.denied_actions ?? []).length > 0 && fenceResult.applied.length === 0)
        ? await runAcceptance({ repoRoot, commands: order.acceptance, logDir: dir })
        : [];

    const round = {
      id: order.id,
      orderFile,
      round: roundNumber,
      startedAt,
      model,
      status: statusFor(
        verdict.outcome,
        fenceResult,
        acceptance,
        verdict.result?.denied_actions ?? [],
      ),
      message: verdict.message,
      attempts,
      // agy reports usage and duration for the whole conversation so far, so a
      // follow-up's own cost is the difference from the previous round.
      seconds: Math.round(run.seconds * 10) / 10,
      cumulativeUsage: usageOf(verdict.result),
      tokens: subtractUsage(usageOf(verdict.result), conversationId ? previousUsage : undefined),
      conversationId: verdict.result?.conversation_id ?? conversationId ?? null,
      deniedActions: verdict.result?.denied_actions ?? [],
      ...fenceResult,
      acceptance,
      crewReport: extractCrewReport(verdict.result?.response),
    };
    writeReport(dir, round);

    await withLock(repoRoot, 'ledger', () => {
      const ledger = readLedger(repoRoot);
      recordRound(ledger, {
        id: order.id,
        kind: order.kind,
        model,
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
  waitForSlot = false,
  env = process.env,
}) {
  const { order, orderFile } = loadOrder(repoRoot, orderPath);
  const model = resolveModel(order, modelOverride);
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
    model,
    prompt,
    roundNumber,
    env,
    waitForSlot,
  });
  const state = existing ?? { id: order.id, orderFile, kind: order.kind, rounds: [] };
  state.model = model;
  state.conversationId = round.conversationId;
  state.rounds.push(round);
  writeState(repoRoot, state);
  return summarise(round, state);
}

export async function followUp({ repoRoot, id, message, waitForSlot = false, env = process.env }) {
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
