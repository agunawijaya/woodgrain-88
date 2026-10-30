/**
 * The opencode runner in isolation: the exact argument list, the permission
 * file it writes into a staging copy, and how it sorts a finished process
 * into the bridge's outcomes.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { CREW_COMMANDS } from '../lib/commands.mjs';
import {
  ALLOWED_MODEL,
  buildOpencodeArgs,
  interpretOpencodeRun,
  resolveOpencodeCommand,
  writeOpencodeConfig,
  writePingConfig,
} from '../lib/opencode.mjs';

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'opencode-test-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function readConfig() {
  return JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
}

test('resolveOpencodeCommand runs a .mjs fixture through node, like resolveAgyCommand', () => {
  assert.deepEqual(resolveOpencodeCommand({}, 'linux'), { command: 'opencode', prefix: [] });
  const resolved = resolveOpencodeCommand({ CREW_OPENCODE: '/path/to/fake-opencode.mjs' });
  assert.equal(resolved.command, process.execPath);
  assert.deepEqual(resolved.prefix, ['/path/to/fake-opencode.mjs']);
});

test('ALLOWED_MODEL accepts only the two verified DeepSeek id shapes', () => {
  assert.ok(ALLOWED_MODEL.test('deepseek/deepseek-v4-pro'));
  assert.ok(ALLOWED_MODEL.test('opencode/deepseek-v4.1-flash-free'));
  for (const bad of ['claude-opus-5-5-high', 'gemini-4-argon-medium', 'gpt-oss-120b', 'deepseek']) {
    assert.ok(!ALLOWED_MODEL.test(bad), `${bad} should be refused`);
  }
});

test('buildOpencodeArgs is exact, with and without a session, and never passes --auto', () => {
  assert.deepEqual(buildOpencodeArgs({ prompt: 'hello', model: 'deepseek/deepseek-v4-pro' }), [
    'run',
    '--standalone',
    '--model',
    'deepseek/deepseek-v4-pro',
    '--format',
    'json',
    'hello',
  ]);
  assert.deepEqual(
    buildOpencodeArgs({ prompt: 'hello', model: 'deepseek/deepseek-v4-pro', sessionId: 'ses_1' }),
    [
      'run',
      '--standalone',
      '--model',
      'deepseek/deepseek-v4-pro',
      '--format',
      'json',
      '--session',
      'ses_1',
      'hello',
    ],
  );
  assert.throws(
    () => buildOpencodeArgs({ prompt: 'hello', model: 'gemini-4-argon-medium' }),
    /Refusing to run opencode/,
  );
});

test('a non-DeepSeek model is refused even if it looks like one at a glance', () => {
  for (const bad of ['claude-opus-5-5-high', 'openai/gpt-5', 'deepseek-v4-pro']) {
    assert.throws(() => buildOpencodeArgs({ prompt: 'x', model: bad }));
  }
});

test('writeOpencodeConfig fences edits to the order, allows the crew checks, and denies shell syntax after them', () => {
  writeOpencodeConfig(dir, {
    fence: ['games/x/**', 'tools/crew/README.md'],
    referenceFiles: ['/repo/src/game.asm'],
    runner: 'opencode',
  });
  const config = readConfig();
  assert.equal(config.permission.edit['*'], 'deny');
  assert.equal(config.permission.edit['games/x/**'], 'allow');
  assert.equal(config.permission.edit['tools/crew/README.md'], 'allow');

  for (const shape of CREW_COMMANDS) {
    assert.equal(config.permission.bash[`${shape.words.join(' ')} *`], 'allow');
  }
  assert.equal(config.permission.bash['pnpm exec vitest run *'], 'allow');
  for (const pattern of [
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
  ]) {
    assert.equal(config.permission.bash[pattern], 'deny');
  }
  assert.equal(config.permission.webfetch, 'deny');
  assert.equal(config.permission.websearch, 'deny');
  assert.equal(config.permission.task, 'deny');
  assert.equal(config.permission.question, 'deny');
  assert.equal(config.permission.todowrite, 'deny');
  assert.equal(config.permission.external_directory['*'], 'deny');
  assert.equal(config.permission.external_directory['/repo/src/game.asm'], 'allow');
});

test('writePingConfig denies every tool, with nothing to allow', () => {
  writePingConfig(dir);
  const config = readConfig();
  assert.equal(config.permission.edit['*'], 'deny');
  assert.equal(config.permission.bash['*'], 'deny');
  assert.equal(config.permission.webfetch, 'deny');
  assert.equal(config.permission.websearch, 'deny');
  assert.equal(config.permission.task, 'deny');
  assert.equal(config.permission.question, 'deny');
  assert.equal(config.permission.todowrite, 'deny');
  assert.equal(config.permission.external_directory['*'], 'deny');
});

function jsonl(events) {
  return events.map((event) => JSON.stringify(event)).join('\n');
}

test('interpretOpencodeRun reads the text parts and the summed usage on success', () => {
  const stdout = jsonl([
    { type: 'step_start', sessionID: 'ses_1' },
    { type: 'text', sessionID: 'ses_1', part: { text: 'Hello ' } },
    { type: 'text', sessionID: 'ses_1', part: { text: 'world.' } },
    {
      type: 'step_finish',
      sessionID: 'ses_1',
      part: { tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 1, write: 0 } } },
    },
    {
      type: 'step_finish',
      sessionID: 'ses_1',
      part: { tokens: { input: 10, output: 2, reasoning: 0, cache: { read: 0, write: 0 } } },
    },
  ]);
  const verdict = interpretOpencodeRun({
    stdout,
    stderr: '',
    timedOut: false,
    spawnError: null,
    exitCode: 0,
  });
  assert.equal(verdict.outcome, 'ok');
  assert.equal(verdict.result.response, 'Hello world.');
  assert.equal(verdict.result.sessionId, 'ses_1');
  assert.deepEqual(verdict.result.usage, {
    input: 110,
    output: 22,
    thinking: 5,
    cacheRead: 1,
    total: 137,
  });
  assert.deepEqual(verdict.result.deniedActions, []);
});

test('interpretOpencodeRun reports a denied tool call without ending the outcome as an error', () => {
  const stdout = jsonl([
    { type: 'step_start', sessionID: 'ses_2' },
    {
      type: 'tool_use',
      sessionID: 'ses_2',
      part: {
        tool: 'write',
        state: { status: 'error', error: 'Permission denied: edit outside the fence' },
      },
    },
    { type: 'text', sessionID: 'ses_2', part: { text: 'Done.' } },
    {
      type: 'step_finish',
      sessionID: 'ses_2',
      part: { tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } },
    },
  ]);
  const verdict = interpretOpencodeRun({
    stdout,
    stderr: '',
    timedOut: false,
    spawnError: null,
    exitCode: 0,
  });
  assert.equal(verdict.outcome, 'ok');
  assert.deepEqual(verdict.result.deniedActions, [
    { tool: 'write', error: 'Permission denied: edit outside the fence' },
  ]);
});

test('interpretOpencodeRun sorts an error event into crew-error', () => {
  const stdout = jsonl([{ type: 'error', sessionID: 'ses_3', part: { message: 'gave up' } }]);
  const verdict = interpretOpencodeRun({
    stdout,
    stderr: '',
    timedOut: false,
    spawnError: null,
    exitCode: 0,
  });
  assert.equal(verdict.outcome, 'crew-error');
});

test('interpretOpencodeRun recognises a quota or rate-limit message', () => {
  const verdict = interpretOpencodeRun({
    stdout: '',
    stderr: 'Error: 429 rate limit exceeded',
    timedOut: false,
    spawnError: null,
    exitCode: 1,
  });
  assert.equal(verdict.outcome, 'quota');
});

test('interpretOpencodeRun ignores quota words in a turn that finished cleanly', () => {
  const finished = [
    { type: 'text', sessionID: 's1', part: { text: 'Each segment burns at a fixed rate.' } },
    {
      type: 'tool_use',
      sessionID: 's1',
      part: {
        tool: 'read',
        state: { status: 'completed', output: 'If the quota runs out (429 rate limit), wait.' },
      },
    },
    { type: 'step_finish', sessionID: 's1', part: { reason: 'stop', tokens: { input: 1 } } },
  ];
  const verdict = interpretOpencodeRun({
    stdout: finished.map((event) => JSON.stringify(event)).join('\n'),
    stderr: '',
    timedOut: false,
    spawnError: null,
    exitCode: 0,
  });
  assert.equal(verdict.outcome, 'ok');
});

test('interpretOpencodeRun reads a quota from an error event that ended the turn', () => {
  const events = [
    { type: 'step_start', sessionID: 's2', part: {} },
    { type: 'error', sessionID: 's2', error: { data: { message: 'Insufficient Balance' } } },
  ];
  const verdict = interpretOpencodeRun({
    stdout: events.map((event) => JSON.stringify(event)).join('\n'),
    stderr: '',
    timedOut: false,
    spawnError: null,
    exitCode: 1,
  });
  assert.equal(verdict.outcome, 'quota');
});

test('interpretOpencodeRun treats a kill as a timeout', () => {
  const verdict = interpretOpencodeRun({
    stdout: '',
    stderr: '',
    timedOut: true,
    spawnError: null,
    exitCode: null,
  });
  assert.equal(verdict.outcome, 'timeout');
});

test('interpretOpencodeRun treats unparsable output as a transport failure, not a crash', () => {
  const verdict = interpretOpencodeRun({
    stdout: 'not json at all\nstill not json\n',
    stderr: '',
    timedOut: false,
    spawnError: null,
    exitCode: 0,
  });
  assert.equal(verdict.outcome, 'transport');
});
