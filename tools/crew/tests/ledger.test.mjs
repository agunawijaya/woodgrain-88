import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ledgerTotals, recordReview, recordRound, renderLedger } from '../lib/ledger.mjs';

const tokens = (total) => ({ input: total - 100, output: 100, thinking: 0, cacheRead: 0, total });

function sampleLedger() {
  const ledger = { orders: [] };
  const at = '2026-10-25T20:00:00.000Z';
  recordRound(ledger, {
    id: 'a',
    kind: 'docs',
    model: 'gemini-3.8-flash-medium',
    status: 'needs-work',
    seconds: 30,
    tokens: tokens(1000),
    violations: 1,
    at,
  });
  recordRound(ledger, {
    id: 'a',
    kind: 'docs',
    model: 'gemini-3.8-flash-medium',
    status: 'crew-done',
    seconds: 12.5,
    tokens: tokens(500),
    violations: 0,
    at,
  });
  recordRound(ledger, {
    id: 'b',
    kind: 'engine',
    model: 'gemini-4-argon-medium',
    status: 'crew-done',
    seconds: 90,
    tokens: tokens(8000),
    violations: 0,
    at,
  });
  return ledger;
}

test('rounds fold into one entry per order', () => {
  const ledger = sampleLedger();
  assert.equal(ledger.orders.length, 2);
  const a = ledger.orders[0];
  assert.equal(a.rounds, 2);
  assert.equal(a.status, 'crew-done');
  assert.equal(a.seconds, 42.5);
  assert.equal(a.crewTokens.total, 1500);
  assert.equal(a.violations, 1);
});

test('totals add up and savings only count reviewed orders', () => {
  const ledger = sampleLedger();
  const at = '2026-10-25T21:00:00.000Z';
  recordReview(ledger, { id: 'a', verdict: 'accepted', leadTokens: 4000, soloTokens: 10000, at });
  const totals = ledgerTotals(ledger);
  assert.equal(totals.orders, 2);
  assert.equal(totals.rounds, 3);
  assert.equal(totals.crewTokens.total, 9500);
  assert.equal(totals.reviewed, 1);
  assert.equal(totals.estimatedSaving, 6000);
  assert.deepEqual(totals.byStatus, { accepted: 1, 'crew-done': 1 });
});

test('a review can take an order over or be refused', () => {
  const ledger = sampleLedger();
  const at = '2026-10-25T21:00:00.000Z';
  recordReview(ledger, { id: 'b', verdict: 'taken-over', note: 'fixed the AI by hand', at });
  assert.equal(ledger.orders[1].status, 'taken-over');
  assert.throws(() => recordReview(ledger, { id: 'b', verdict: 'maybe', at }), /Verdict/);
  assert.throws(
    () => recordReview(ledger, { id: 'zzz', verdict: 'accepted', at }),
    /No ledger entry/,
  );
});

test('the rendered ledger leads with totals and has one row per order', () => {
  const ledger = sampleLedger();
  recordReview(ledger, {
    id: 'a',
    leadTokens: 4000,
    soloTokens: 10000,
    note: 'pipes | in notes',
    at: 'x',
  });
  const markdown = renderLedger(ledger);
  const totalsLine = markdown.split('\n').find((line) => line.startsWith('**Totals:**'));
  assert.ok(totalsLine.includes('2 orders'));
  assert.ok(totalsLine.includes('9,500 crew tokens'));
  assert.ok(totalsLine.includes('about 6,000 Claude tokens saved'));
  assert.equal(markdown.split('\n').filter((line) => /^\| [ab] \|/.test(line)).length, 2);
  assert.ok(markdown.includes('pipes \\| in notes'));
});
