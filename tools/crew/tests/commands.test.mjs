/**
 * The crew's check commands: which command lines pass, that agy's rules and the
 * gate hook agree, and that the settings merge keeps the owner's own rules.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { agyAllowRules, isCrewCommand } from '../lib/commands.mjs';
import { decide } from '../lib/gate.mjs';
import { missingCrewRules, withCrewRules } from '../lib/permissions.mjs';
import { prepareWorkspace } from '../lib/workspace.mjs';

const GATE = fileURLToPath(new URL('../lib/gate.mjs', import.meta.url));

test('the check commands the crew may run', () => {
  for (const line of [
    'pnpm exec eslint games/hot-and-cold/src',
    'pnpm exec eslint packages/kit/src/kids packages/kit/tests/memory.test.ts',
    'pnpm exec prettier --check games/hot-and-cold docs/team/CREW.md',
    'pnpm exec tsc -p games/hot-and-cold/tsconfig.json',
    '  pnpm exec eslint   packages/kit/src  ',
  ]) {
    assert.ok(isCrewCommand(line), line);
  }
});

test('refuses everything else, however it is dressed up', () => {
  for (const line of [
    '',
    'git status',
    'pnpm install',
    'pnpm test',
    'pnpm exec playwright test',
    // Tests and formatting write files, which agy's sandbox refuses; the bridge runs those.
    'pnpm exec vitest run --project kit',
    'pnpm exec prettier --write games/hot-and-cold',
    'node scripts/anything.mjs',
    'pnpm exec eslint',
    'pnpm exec eslint ../../outside',
    'pnpm exec eslint /etc',
    'pnpm exec eslint E:/Projects',
    'pnpm exec eslint .hidden',
    'pnpm exec eslint src\\windows\\path',
    'pnpm exec eslint a b c d e',
    'pnpm exec tsc -p a/tsconfig.json b/tsconfig.json',
    'pnpm exec eslint src && git push',
    'pnpm exec eslint src; rm -rf games',
    'pnpm exec eslint src | tee out.txt',
    'pnpm exec eslint src > out.txt',
    'pnpm exec eslint $(whoami)',
    'pnpm exec eslint "src"',
    'pnpm exec eslint src/*.ts',
    'pnpm exec eslint %USERPROFILE%',
    'pnpm exec eslint src\ngit push',
  ]) {
    assert.equal(isCrewCommand(line), false, JSON.stringify(line));
  }
});

test('every agy rule is a command the gate lets through, token for token', () => {
  const rules = agyAllowRules();
  assert.equal(new Set(rules).size, rules.length);
  for (const rule of rules) {
    const tokens = /^command\(regex:(.*)\)$/.exec(rule)?.[1].split(' ');
    assert.ok(tokens, rule);
    // A sample line for the rule: each pattern token replaced by a value it accepts.
    const sample = tokens.map((token) => (/^[a-z-]+$/.test(token) ? token : 'src/x.ts'));
    assert.ok(isCrewCommand(sample.join(' ')), `${rule} -> ${sample.join(' ')}`);
  }
});

test('the gate allows check commands and refuses the rest with the list of what may run', () => {
  const call = (CommandLine) => ({ toolCall: { name: 'run_command', args: { CommandLine } } });
  assert.deepEqual(decide(call('pnpm exec eslint games/x/src')), { decision: 'allow' });
  const refused = decide(call('git push'));
  assert.equal(refused.decision, 'deny');
  assert.match(refused.reason, /refused "git push"/);
  assert.match(refused.reason, /pnpm exec tsc -p <path>/);
  assert.equal(decide(undefined).decision, 'deny');
});

test('the gate never lets a command leave the sandbox, even an allowed one', () => {
  const outside = decide({
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'pnpm exec eslint games/x/src', BypassSandbox: true },
    },
  });
  assert.equal(outside.decision, 'deny');
  assert.match(outside.reason, /outside the sandbox/);
});

test('the gate answers agy over stdin and stdout', () => {
  const ask = (CommandLine) =>
    JSON.parse(
      spawnSync(process.execPath, [GATE], {
        input: JSON.stringify({ toolCall: { name: 'run_command', args: { CommandLine } } }),
        encoding: 'utf8',
      }).stdout,
    );
  assert.equal(ask('pnpm exec tsc -p hall/tsconfig.json').decision, 'allow');
  assert.equal(ask('whoami').decision, 'deny');
});

test('installing the rules keeps the owner settings and replaces stale crew rules', () => {
  const owner = {
    model: 'some model',
    permissions: {
      allow: ['command(git)', 'command(regex:pnpm exec eslint old)'],
      deny: ['command(rm)'],
    },
  };
  const merged = withCrewRules(owner);
  assert.equal(merged.model, 'some model');
  assert.deepEqual(merged.permissions.deny, ['command(rm)']);
  assert.equal(merged.permissions.allow[0], 'command(git)');
  assert.ok(!merged.permissions.allow.includes('command(regex:pnpm exec eslint old)'));
  assert.deepEqual(missingCrewRules(merged), []);
  assert.deepEqual(withCrewRules(merged), merged, 'installing twice changes nothing');
  assert.equal(missingCrewRules({}).length, agyAllowRules().length);
});

test('a staging copy gets the gate hook, and no install without a lockfile', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'crew-workspace-'));
  try {
    const result = await prepareWorkspace(dir, process.env);
    assert.equal(result.installed, false);
    const hooks = JSON.parse(readFileSync(join(dir, '.agents', 'hooks.json'), 'utf8'));
    const handler = hooks['crew-gate'].PreToolUse[0];
    assert.equal(handler.matcher, 'run_command');
    // Run from .agents/, the gate is the staging copy's own, inside the crew's workspace.
    assert.equal(handler.hooks[0].command, 'node ../tools/crew/lib/gate.mjs');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
