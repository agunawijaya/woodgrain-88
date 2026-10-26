import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_MODEL_BY_KIND,
  parseOrder,
  resolveModel,
  timeoutSecondsFor,
  validateOrder,
} from '../lib/order.mjs';

const validOrder = `---
id: 0001-crew-readme
kind: docs
fence:
  - tools/crew/README.md
acceptance:
  - pnpm exec prettier --check tools/crew/README.md   # formatting only
reads: [tools/crew/crew.mjs, "docs/team/PROTOCOL.md"]
---

## Goal

Write the README.
`;

function orderWith(overrides) {
  return { ...parseOrder(validOrder), ...overrides };
}

test('parses front matter lists, inline lists, quotes and comments', () => {
  const order = parseOrder(validOrder);
  assert.equal(order.id, '0001-crew-readme');
  assert.equal(order.kind, 'docs');
  assert.deepEqual(order.fence, ['tools/crew/README.md']);
  assert.deepEqual(order.acceptance, ['pnpm exec prettier --check tools/crew/README.md']);
  assert.deepEqual(order.reads, ['tools/crew/crew.mjs', 'docs/team/PROTOCOL.md']);
  assert.match(order.body, /^## Goal/);
});

test('a well-formed order has no problems', () => {
  assert.deepEqual(validateOrder(parseOrder(validOrder), '.team/orders/0001-crew-readme.md'), []);
});

test('the file name must match the id', () => {
  const problems = validateOrder(parseOrder(validOrder), '.team/orders/other.md');
  assert.ok(problems.some((problem) => problem.includes('0001-crew-readme.md')));
});

test('fences may never reach the reference folders or the team records', () => {
  for (const fence of [
    'src/01_UFO.asm',
    'original/**',
    '.team/LEDGER.md',
    '.claude/settings.json',
    '.git/config',
  ]) {
    const problems = validateOrder(orderWith({ fence: [fence] }));
    assert.ok(
      problems.some((problem) => problem.includes('protected')),
      `${fence} should be refused`,
    );
  }
});

test('fences must be plain, anchored, repo-relative paths', () => {
  for (const fence of [
    '../outside.md',
    '/etc/passwd',
    'C:/Windows/x',
    'docs\\x.md',
    '**',
    '*.md',
    '**/README.md',
  ]) {
    assert.ok(
      validateOrder(orderWith({ fence: [fence] })).length > 0,
      `${fence} should be refused`,
    );
  }
  assert.ok(validateOrder(orderWith({ fence: [] })).length > 0);
});

test('reads the staging copy does not contain are refused', () => {
  for (const read of ['.claude/skills/x/SKILL.md', '.team/orders/a.md']) {
    const problems = validateOrder(orderWith({ reads: [read] }));
    assert.ok(
      problems.some((problem) => problem.includes('not visible')),
      `${read} should be refused`,
    );
  }
});

test('unknown kinds and missing goals are refused', () => {
  assert.ok(validateOrder(orderWith({ kind: 'everything' })).length > 0);
  assert.ok(validateOrder(orderWith({ body: 'No goal here.' })).length > 0);
});

test('only gemini models are accepted, from the order or the command line', () => {
  assert.equal(resolveModel(orderWith({})), DEFAULT_MODEL_BY_KIND.docs);
  assert.equal(resolveModel(orderWith({ model: 'gemini-4-argon-high' })), 'gemini-4-argon-high');
  assert.equal(resolveModel(orderWith({}), 'gemini-3.8-flash-low'), 'gemini-3.8-flash-low');
  for (const model of [
    'claude-opus-5-5-high',
    'claude-sonnet-5-5-low',
    'gpt-oss-120b-medium',
    'gemini',
  ]) {
    assert.throws(() => resolveModel(orderWith({}), model), /not allowed/);
    assert.ok(
      validateOrder(orderWith({ model })).length > 0,
      `${model} should be refused in an order`,
    );
  }
});

test('heavy kinds default to Argon, light kinds to Flash', () => {
  assert.equal(resolveModel(orderWith({ kind: 'engine' })), 'gemini-4-argon-medium');
  assert.equal(resolveModel(orderWith({ kind: 'dossier' })), 'gemini-4-argon-medium');
  assert.equal(resolveModel(orderWith({ kind: 'tests' })), 'gemini-3.8-flash-medium');
});

test('timeouts follow the kind', () => {
  assert.equal(timeoutSecondsFor('dossier'), 900);
  assert.equal(timeoutSecondsFor('engine'), 1500);
  assert.equal(timeoutSecondsFor('docs'), 600);
});
