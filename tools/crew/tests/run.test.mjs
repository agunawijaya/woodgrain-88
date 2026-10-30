/**
 * End-to-end bridge runs against the fake agy in a throwaway repo: fences,
 * protected folders, retries, acceptance and follow-up limits.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readLedger } from '../lib/ledger.mjs';
import { dispatchOrder, followUp, MAX_FOLLOWUPS } from '../lib/run.mjs';

const fakeAgy = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-agy.mjs');
const fakeOpencode = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-opencode.mjs');

let repo;

function put(rel, text) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), text);
}

const read = (rel) => readFileSync(join(repo, rel), 'utf8');

function writeOrder({
  id = 'test-order',
  fence = ['docs/**'],
  acceptance = [],
  reads = [],
  member,
} = {}) {
  const list = (items) =>
    items.length === 0 ? ' []' : `\n${items.map((item) => `  - ${item}`).join('\n')}`;
  put(
    `.team/orders/${id}.md`,
    `---\nid: ${id}\nkind: docs\n${member ? `member: ${member}\n` : ''}fence:${list(fence)}\nacceptance:${list(acceptance)}\nreads:${list(reads)}\n---\n\n## Goal\n\nTest.\n`,
  );
  return `.team/orders/${id}.md`;
}

function envFor(scenario) {
  return {
    ...process.env,
    CREW_AGY: fakeAgy,
    FAKE_AGY_SCENARIO: scenario,
    FAKE_AGY_REAL_REPO: repo,
    FAKE_AGY_LOG: join(repo, 'agy-calls.log'),
    FAKE_AGY_COUNTER: join(repo, 'agy-counter.txt'),
  };
}

function envForOpencode(scenario) {
  return {
    ...process.env,
    CREW_OPENCODE: fakeOpencode,
    FAKE_OPENCODE_SCENARIO: scenario,
    FAKE_OPENCODE_REAL_REPO: repo,
    FAKE_OPENCODE_LOG: join(repo, 'opencode-calls.log'),
    FAKE_OPENCODE_COUNTER: join(repo, 'opencode-counter.txt'),
    FAKE_OPENCODE_CONFIG_LOG: join(repo, 'opencode-config-seen.json'),
    FAKE_OPENCODE_LISTING: join(repo, 'opencode-listing.txt'),
  };
}

function loggedCalls() {
  return read('agy-calls.log')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

function loggedOpencodeCalls() {
  return read('opencode-calls.log')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'crew-test-'));
  put('docs/team/CREW.md', '# Crew rules\n\nStay in your fence.\n');
  put('docs/old.md', 'old\n');
  put('README.md', 'original readme\n');
  put('src/game.asm', 'reference listing\n');
  put('original/cart.bin', 'reference image\n');
  put('research/01-notes.md', 'dossier notes\n');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

test('changes inside the fence are applied to the real tree', async () => {
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder(),
    env: envFor('inside'),
  });
  assert.equal(summary.status, 'crew-done');
  assert.deepEqual(summary.applied, ['docs/notes.md (added)']);
  assert.equal(read('docs/notes.md'), 'crew notes\n');
  assert.ok(
    !existsSync(join(repo, '.team', 'worktrees', 'test-order')),
    'staging copy is cleaned up',
  );
});

test('deletions inside the fence are applied too', async () => {
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder(),
    env: envFor('delete'),
  });
  assert.deepEqual(summary.applied, ['docs/old.md (deleted)']);
  assert.ok(!existsSync(join(repo, 'docs', 'old.md')));
});

test('changes outside the fence never reach the real tree and are kept for review', async () => {
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder(),
    env: envFor('outside'),
  });
  assert.equal(summary.status, 'needs-work');
  assert.deepEqual(summary.violations, ['README.md', 'hall/sneaky.ts']);
  assert.equal(read('README.md'), 'original readme\n');
  assert.ok(!existsSync(join(repo, 'hall', 'sneaky.ts')));
  const rejected = join(repo, '.team', 'runs', 'test-order', 'round-1', 'rejected');
  assert.equal(readFileSync(join(rejected, 'README.md'), 'utf8'), 'rewritten by the crew\n');
  assert.ok(existsSync(join(rejected, 'hall', 'sneaky.ts')));
  assert.equal(readLedger(repo).orders[0].violations, 2);
});

test('the reference folders are restored byte for byte if the crew writes into them', async () => {
  const orderPath = writeOrder({ reads: ['src/game.asm'] });
  const summary = await dispatchOrder({ repoRoot: repo, orderPath, env: envFor('protected') });
  assert.equal(summary.status, 'needs-work');
  assert.deepEqual(summary.restored.sort(), ['src/game.asm', 'src/new-file.txt']);
  assert.equal(read('src/game.asm'), 'reference listing\n');
  assert.ok(!existsSync(join(repo, 'src', 'new-file.txt')));
  const [args] = loggedCalls();
  assert.equal(args[args.indexOf('--add-dir') + 1], join(repo, 'src'));
});

test('a file the lead changed during the run is not overwritten', async () => {
  put('docs/notes.md', 'before\n');
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder(),
    env: envFor('conflict'),
  });
  assert.equal(summary.status, 'needs-work');
  assert.deepEqual(summary.conflicts, ['docs/notes.md']);
  assert.equal(read('docs/notes.md'), 'the lead edited this meanwhile\n');
  const kept = join(
    repo,
    '.team',
    'runs',
    'test-order',
    'round-1',
    'rejected',
    'conflicts',
    'docs',
    'notes.md',
  );
  assert.equal(readFileSync(kept, 'utf8'), 'crew notes\n');
});

test('the bridge pins a gemini model and never skips permissions', async () => {
  await dispatchOrder({ repoRoot: repo, orderPath: writeOrder(), env: envFor('inside') });
  const [args] = loggedCalls();
  assert.equal(args[args.indexOf('--model') + 1], 'gemini-3.8-flash-medium');
  assert.equal(args[args.indexOf('--mode') + 1], 'accept-edits');
  assert.ok(args.includes('--sandbox'));
  assert.ok(!args.some((arg) => arg.includes('dangerously')));
  assert.match(args[args.indexOf('-p') + 1], /^# Crew rules/);
  await assert.rejects(
    dispatchOrder({
      repoRoot: repo,
      orderPath: writeOrder({ id: 'other-order' }),
      modelOverride: 'claude-opus-5-5-high',
      env: envFor('inside'),
    }),
    /not allowed/,
  );
});

test('a transport error is retried once; a second one gives up', async () => {
  const recovered = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder(),
    env: envFor('transport-once'),
  });
  assert.equal(recovered.status, 'crew-done');
  assert.equal(loggedCalls().length, 2);

  rmSync(join(repo, 'agy-counter.txt'));
  const failed = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder({ id: 'flaky-order' }),
    env: envFor('transport-always'),
  });
  assert.equal(failed.status, 'transport');
  assert.equal(read('agy-counter.txt'), '2');
});

test('a turn stopped by a denied action is reported as denied and can be dispatched again', async () => {
  const orderPath = writeOrder({ acceptance: ['node -e "process.exit(1)"'] });
  const summary = await dispatchOrder({ repoRoot: repo, orderPath, env: envFor('denied') });
  assert.equal(summary.status, 'denied');
  assert.deepEqual(summary.acceptance, [], 'acceptance is skipped when nothing was written');
  const again = await dispatchOrder({ repoRoot: repo, orderPath, env: envFor('inside') });
  assert.equal(again.status, 'needs-work');
  assert.equal(again.round, 2);
});

test('an exhausted quota is reported clearly and not retried', async () => {
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder(),
    env: envFor('quota'),
  });
  assert.equal(summary.status, 'quota');
  assert.match(summary.message, /quota/);
  assert.equal(loggedCalls().length, 1);
});

test('acceptance runs after the changes and decides the status; failures are never retried', async () => {
  const passing = writeOrder({ acceptance: ['node -e "process.exit(0)"'] });
  assert.equal(
    (await dispatchOrder({ repoRoot: repo, orderPath: passing, env: envFor('inside') })).status,
    'crew-done',
  );

  const failing = writeOrder({ id: 'failing-order', acceptance: ['node -e "process.exit(3)"'] });
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath: failing,
    env: envFor('inside'),
  });
  assert.equal(summary.status, 'needs-work');
  assert.deepEqual(summary.acceptance, [{ command: 'node -e "process.exit(3)"', passed: false }]);
  assert.equal(loggedCalls().length, 2);
});

test('follow-ups resume the conversation, carry failures back, and stop after three', async () => {
  const orderPath = writeOrder({
    acceptance: ['node -e "console.log(\'boom\'); process.exit(1)"'],
  });
  await dispatchOrder({ repoRoot: repo, orderPath, env: envFor('inside') });
  await assert.rejects(
    dispatchOrder({ repoRoot: repo, orderPath, env: envFor('inside') }),
    /already run/,
  );

  for (let i = 1; i <= MAX_FOLLOWUPS; i++) {
    const summary = await followUp({
      repoRoot: repo,
      id: 'test-order',
      message: '1. Fix the thing.',
      env: envFor('inside'),
    });
    assert.equal(summary.round, i + 1);
  }
  const calls = loggedCalls();
  const followupArgs = calls[1];
  assert.equal(followupArgs[followupArgs.indexOf('--conversation') + 1], 'conv-123');
  const followupPrompt = followupArgs[followupArgs.indexOf('-p') + 1];
  assert.match(followupPrompt, /boom/);
  assert.match(followupPrompt, /1\. Fix the thing\./);
  await assert.rejects(
    followUp({ repoRoot: repo, id: 'test-order', message: 'again', env: envFor('inside') }),
    /taken-over/,
  );
  const entry = readLedger(repo).orders[0];
  assert.equal(entry.rounds, 1 + MAX_FOLLOWUPS);
  assert.equal(
    entry.crewTokens.total,
    1250,
    'agy usage is cumulative per conversation; rounds count only their delta',
  );
});

test('a third parallel claim waits for a free slot and overlapping fences are refused', async () => {
  const { claimSlot, releaseSlot } = await import('../lib/slots.mjs');
  claimSlot(repo, { id: 'one', fence: ['research/dossiers/01-a.md'] });
  claimSlot(repo, { id: 'two', fence: ['research/dossiers/02-b.md'] });
  assert.throws(
    () => claimSlot(repo, { id: 'clash', fence: ['research/dossiers/**'] }),
    /overlaps/,
  );
  claimSlot(repo, { id: 'three', fence: ['research/dossiers/03-c.md'] });
  assert.throws(
    () => claimSlot(repo, { id: 'four', fence: ['research/dossiers/04-d.md'] }),
    /in flight/,
  );
  releaseSlot(repo, 'one');
  claimSlot(repo, { id: 'four', fence: ['research/dossiers/04-d.md'] });
});

test('an order that is already running cannot be dispatched a second time', async () => {
  const { claimSlot } = await import('../lib/slots.mjs');
  const otherLiveProcess = process.ppid;
  claimSlot(repo, { id: 'busy', fence: ['docs/busy.md'] }, otherLiveProcess);
  assert.throws(() => claimSlot(repo, { id: 'busy', fence: ['docs/busy.md'] }), /already running/);
});

// --- the opencode runner (prompt 05, stage 0) -------------------------------

test('a change from a DeepSeek member inside the fence is applied, through the opencode runner', async () => {
  const orderPath = writeOrder({ member: 'deepseek-pro' });
  const summary = await dispatchOrder({ repoRoot: repo, orderPath, env: envForOpencode('inside') });
  assert.equal(summary.status, 'crew-done');
  assert.equal(summary.member, 'deepseek-pro');
  assert.deepEqual(summary.applied, ['docs/notes.md (added)']);
  assert.equal(read('docs/notes.md'), 'crew notes\n');
  const [args] = loggedOpencodeCalls();
  assert.deepEqual(args.slice(0, 5), [
    'run',
    '--standalone',
    '--model',
    'deepseek/deepseek-v4-pro',
    '--format',
  ]);
  assert.ok(!args.includes('--auto'));
});

test('the bridge closes stdin, which the real opencode reads to the end before it answers', async () => {
  const orderPath = writeOrder({ member: 'deepseek-pro' });
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath,
    env: envForOpencode('waits-for-stdin'),
  });
  assert.equal(summary.status, 'crew-done');
  assert.deepEqual(summary.applied, ['docs/notes.md (added)']);
});

test('opencode works in the staging copy: the bridge sets PWD, which opencode reads instead of its own directory', async () => {
  const orderPath = writeOrder({ member: 'deepseek-pro' });
  const pwdLog = join(repo, 'pwd.log');
  await dispatchOrder({
    repoRoot: repo,
    orderPath,
    env: { ...envForOpencode('inside'), PWD: repo, FAKE_OPENCODE_PWD_LOG: pwdLog },
  });
  const [pwd, cwd] = read('pwd.log').split('\n');
  assert.equal(pwd, cwd);
  assert.match(pwd ?? '', /worktrees/);
});

test('opencode.json and .opencode/ never appear as applied or rejected changes', async () => {
  const orderPath = writeOrder({ member: 'deepseek-pro', fence: ['docs/**'] });
  const summary = await dispatchOrder({
    repoRoot: repo,
    orderPath,
    env: envForOpencode('outside'),
  });
  assert.ok(!summary.applied.some((entry) => entry.includes('opencode.json')));
  assert.ok(!summary.applied.some((entry) => entry.includes('.opencode')));
  assert.ok(!summary.violations.includes('opencode.json'));
  const rejected = join(repo, '.team', 'runs', 'test-order', 'round-1', 'rejected');
  assert.ok(!existsSync(join(rejected, 'opencode.json')));
  // The config the fake saw proves the bridge wrote one before the run.
  assert.ok(existsSync(join(repo, 'opencode-config-seen.json')));
});

test('a free-tier staging copy leaves out research/ entirely', async () => {
  const orderPath = writeOrder({ member: 'deepseek-flash' });
  await dispatchOrder({ repoRoot: repo, orderPath, env: envForOpencode('inside') });
  const listing = read('opencode-listing.txt').split(',');
  assert.ok(
    !listing.includes('research'),
    `research/ should not be in the staging copy: ${listing}`,
  );
  assert.ok(listing.includes('docs'), 'other folders are still there');
});

test('a free-tier order refuses to read the reference folders or the dossiers', async () => {
  const orderPath = writeOrder({ member: 'deepseek-flash', reads: ['research/01-notes.md'] });
  await assert.rejects(
    dispatchOrder({ repoRoot: repo, orderPath, env: envForOpencode('inside') }),
    /free-tier/,
  );
});

test('a follow-up to a DeepSeek member resumes with --session on the same member', async () => {
  const orderPath = writeOrder({
    member: 'deepseek-pro',
    acceptance: ['node -e "console.log(\'boom\'); process.exit(1)"'],
  });
  await dispatchOrder({ repoRoot: repo, orderPath, env: envForOpencode('inside') });
  const summary = await followUp({
    repoRoot: repo,
    id: 'test-order',
    message: '1. Fix the thing.',
    env: envForOpencode('inside'),
  });
  assert.equal(summary.member, 'deepseek-pro');
  const calls = loggedOpencodeCalls();
  const followupArgs = calls[1];
  assert.equal(followupArgs[followupArgs.indexOf('--session') + 1], 'ses_123');
  await assert.rejects(
    followUp({ repoRoot: repo, id: 'test-order', message: 'x', memberOverride: 'deepseek-flash' }),
    /cannot override the member/,
  );
});

test('a scenario that never exits is killed at the timeout, and the round is timeout', async () => {
  const orderPath = writeOrder({ member: 'deepseek-pro' });
  process.env.CREW_TEST_TIMEOUT_SECONDS = '1';
  process.env.CREW_TEST_KILL_GRACE_SECONDS = '1';
  try {
    const summary = await dispatchOrder({
      repoRoot: repo,
      orderPath,
      env: envForOpencode('never-exits'),
    });
    assert.equal(summary.status, 'timeout');
  } finally {
    delete process.env.CREW_TEST_TIMEOUT_SECONDS;
    delete process.env.CREW_TEST_KILL_GRACE_SECONDS;
  }
});

test('the ledger and LEDGER.md show the member for both runners', async () => {
  await dispatchOrder({ repoRoot: repo, orderPath: writeOrder(), env: envFor('inside') });
  await dispatchOrder({
    repoRoot: repo,
    orderPath: writeOrder({ id: 'deepseek-order', member: 'deepseek-pro' }),
    env: envForOpencode('inside'),
  });
  const ledger = readLedger(repo);
  assert.equal(ledger.orders.find((order) => order.id === 'test-order').member, 'agy');
  assert.equal(ledger.orders.find((order) => order.id === 'deepseek-order').member, 'deepseek-pro');
  const renderedLedger = read('.team/LEDGER.md');
  assert.match(renderedLedger, /\| Order \| Kind \| Model \| Member \|/);
  assert.match(
    renderedLedger,
    /\| deepseek-order \| docs \| deepseek\/deepseek-v4-pro \| deepseek-pro \|/,
  );
});
