/**
 * The member registry and how an order picks one: front matter, the command
 * line override, model pinning per runner, and the free tier's data rule.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isKnownMember,
  MEMBERS,
  memberNames,
  resolveRun,
  validateMember,
} from '../lib/members.mjs';
import { parseOrder, validateOrder } from '../lib/order.mjs';

const baseOrder = `---
id: test-order
kind: docs
fence:
  - docs/notes.md
acceptance: []
reads: []
---

## Goal

Test.
`;

function orderWith(overrides) {
  return { ...parseOrder(baseOrder), ...overrides };
}

test('the registry pins each member to one runner and model', () => {
  assert.deepEqual(memberNames().sort(), [
    'agy-argon',
    'agy-flash',
    'deepseek-flash',
    'deepseek-pro',
  ]);
  assert.equal(MEMBERS['agy-argon'].runner, 'agy');
  assert.equal(MEMBERS['agy-argon'].model, 'gemini-4-argon-medium');
  assert.equal(MEMBERS['agy-flash'].runner, 'agy');
  assert.equal(MEMBERS['agy-flash'].model, 'gemini-3.8-flash-medium');
  assert.equal(MEMBERS['deepseek-pro'].runner, 'opencode');
  assert.equal(MEMBERS['deepseek-pro'].model, 'deepseek/deepseek-v4-pro');
  assert.equal(MEMBERS['deepseek-flash'].runner, 'opencode');
  assert.equal(MEMBERS['deepseek-flash'].model, 'opencode/deepseek-v4.1-flash-free');
  assert.equal(MEMBERS['deepseek-flash'].freeTier, true);
  assert.ok(!isKnownMember('claude-opus'));
  assert.ok(!isKnownMember(undefined));
});

test("with neither a member nor an override, resolution keeps today's Agy-by-kind behaviour", () => {
  const run = resolveRun(orderWith({ kind: 'engine' }));
  assert.deepEqual(run, { member: 'agy', runner: 'agy', model: 'gemini-4-argon-medium' });
});

test('an order may name its member in front matter', () => {
  const order = orderWith({ member: 'deepseek-pro' });
  assert.deepEqual(resolveRun(order), {
    member: 'deepseek-pro',
    runner: 'opencode',
    model: 'deepseek/deepseek-v4-pro',
  });
});

test("--member overrides the order's own front matter", () => {
  const order = orderWith({ member: 'deepseek-pro' });
  assert.deepEqual(resolveRun(order, { memberOverride: 'agy-flash' }), {
    member: 'agy-flash',
    runner: 'agy',
    model: 'gemini-3.8-flash-medium',
  });
});

test('an unknown member is refused', () => {
  assert.throws(
    () => resolveRun(orderWith({}), { memberOverride: 'claude-opus' }),
    /Unknown crew member/,
  );
});

test('--model on an opencode member may only pick another allowed DeepSeek id', () => {
  const order = orderWith({ member: 'deepseek-pro' });
  assert.deepEqual(
    resolveRun(order, { modelOverride: 'opencode/deepseek-v4.1-flash-free' }).model,
    'opencode/deepseek-v4.1-flash-free',
  );
  assert.throws(
    () => resolveRun(order, { modelOverride: 'gemini-4-argon-medium' }),
    /not allowed for member/,
  );
  assert.throws(
    () => resolveRun(order, { modelOverride: 'claude-opus-5-5-high' }),
    /not allowed for member/,
  );
});

test('--model on an agy member may only pick another allowed Gemini id', () => {
  const order = orderWith({ member: 'agy-argon' });
  assert.throws(
    () => resolveRun(order, { modelOverride: 'deepseek/deepseek-v4-pro' }),
    /not allowed for member/,
  );
});

test('validateMember refuses a DeepSeek model for an Agy member and a Gemini model for an opencode member', () => {
  assert.ok(
    validateMember(orderWith({ member: 'agy-argon', model: 'deepseek/deepseek-v4-pro' })).length >
      0,
  );
  assert.ok(
    validateMember(orderWith({ member: 'deepseek-pro', model: 'gemini-4-argon-medium' })).length >
      0,
  );
  assert.deepEqual(validateMember(orderWith({ member: 'deepseek-pro' })), []);
});

test('validateMember refuses an unknown member name', () => {
  assert.ok(validateMember(orderWith({ member: 'claude-opus' })).length > 0);
});

test("validateOrder defers a member order's model check to validateMember", () => {
  // A DeepSeek model would be refused by the plain gemini-only check; naming
  // the member lifts that, and validateMember is what judges it instead.
  const order = orderWith({ member: 'deepseek-pro', model: 'deepseek/deepseek-v4-pro' });
  assert.deepEqual(validateOrder(order), []);
});

test('a free-tier order may not read the reference folders or the research dossiers', () => {
  for (const read of ['original/cart.bin', 'src/game.asm', 'research/01-notes.md']) {
    const order = orderWith({ member: 'deepseek-flash', reads: [read] });
    assert.ok(
      validateMember(order).some((problem) => problem.includes('free-tier')),
      `${read} should be refused for the free tier`,
    );
  }
  assert.deepEqual(
    validateMember(orderWith({ member: 'deepseek-flash', reads: ['docs/x.md'] })),
    [],
  );
});

test('the free-tier rule does not apply to a paid DeepSeek member', () => {
  assert.deepEqual(
    validateMember(orderWith({ member: 'deepseek-pro', reads: ['src/game.asm'] })),
    [],
  );
});
