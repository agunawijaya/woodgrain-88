/**
 * Simulation script running comprehensive bot sweeps and balance verifications
 * across all 31 Tank Duel channels and Kid pairings.
 *
 * Usage:
 *   pnpm exec tsx games/tank-duel/scripts/simulate.ts [--quick]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KID_IDS, type KidId } from '@woodgrain-88/kit';
import { CHANNELS } from '../src/engine/channels.ts';
import type { Contender } from '../src/sim/duel.ts';
import { pairing, seeds, type PairingResult } from '../src/sim/sweep.ts';
import { inScoreBand, SCORE_BAND } from '../src/sim/targets.ts';

const isQuick = process.argv.includes('--quick');
const sweepSeedCount = isQuick ? 2 : 4;
const targetSeedCount = isQuick ? 12 : 256;

const startTime = Date.now();

console.log(`Starting Tank Duel simulations (quick mode: ${isQuick ? 'yes' : 'no'})...`);

// Generate all 15 unique Kid pairings
const kidPairings: [KidId, KidId][] = [];
for (let i = 0; i < KID_IDS.length; i++) {
  const kidA = KID_IDS[i];
  if (!kidA) continue;
  for (let j = i + 1; j < KID_IDS.length; j++) {
    const kidB = KID_IDS[j];
    if (!kidB) continue;
    kidPairings.push([kidA, kidB]);
  }
}

// 1. Channel sweep: all 31 channels with all 15 Kid pairings
const channelResults: PairingResult[] = [];
const sweepSeeds = seeds(sweepSeedCount, 100);

for (let cIndex = 0; cIndex < CHANNELS.length; cIndex++) {
  const channel = CHANNELS[cIndex];
  if (!channel) continue;

  console.log(`[${cIndex + 1}/${CHANNELS.length}] Sweeping ${channel.id}: ${channel.title}...`);

  for (const [kidA, kidB] of kidPairings) {
    const a: Contender = { kind: 'kid', kid: kidA };
    const b: Contender = { kind: 'kid', kid: kidB };
    const res = pairing(channel.id, a, b, sweepSeeds, { scoring: 'timed' });
    channelResults.push(res);
  }
}

// 2. The four balance targets
console.log('Evaluating balance targets...');

// Target 1: Lou vs Pip on game-1 (70-85%)
console.log('  Running Target 1: Lou vs Pip on game-1...');
const t1Res = pairing(
  'game-1',
  { kind: 'kid', kid: 'lou' },
  { kind: 'kid', kid: 'pip' },
  seeds(targetSeedCount, 11000),
);

// Target 2: Dee vs Moss on game-1 (40-60%)
console.log('  Running Target 2: Dee vs Moss on game-1...');
const t2Res = pairing(
  'game-1',
  { kind: 'kid', kid: 'dee' },
  { kind: 'kid', kid: 'moss' },
  seeds(targetSeedCount, 12000),
);

// Target 3: Novice vs Pip on game-1 (35-55%)
console.log('  Running Target 3: Novice vs Pip on game-1...');
const t3Res = pairing(
  'game-1',
  { kind: 'novice' },
  { kind: 'kid', kid: 'pip' },
  seeds(targetSeedCount, 13000),
);

// Target 4: every timed match of the sweep ends inside the score band in >= 90% of seeds. Two Remix channels
// are left out because their scores do not count hits: Ricochet Royale pays a point per bounce, and
// Last Tank counts rounds won.
const SCORES_NOT_HITS = new Set(['ricochet-royale', 'last-tank']);
const t4Totals = channelResults
  .filter((result) => !SCORES_NOT_HITS.has(result.channel))
  .flatMap((result) => result.totals);
const t4InRange = t4Totals.filter(inScoreBand).length;
const t4Rate = t4Totals.length > 0 ? t4InRange / t4Totals.length : 0;

// Aggregate per-channel results
interface ChannelRow {
  channel: string;
  title: string;
  matches: number;
  scoreless: number;
  totals: number[];
  bankHits: number;
}

const channelMap = new Map<string, ChannelRow>();
for (const ch of CHANNELS) {
  channelMap.set(ch.id, {
    channel: ch.id,
    title: ch.title,
    matches: 0,
    scoreless: 0,
    totals: [],
    bankHits: 0,
  });
}

for (const res of channelResults) {
  const row = channelMap.get(res.channel);
  if (row) {
    row.matches += res.matches;
    row.scoreless += res.scoreless;
    row.totals.push(...res.totals);
    row.bankHits += res.bankHits;
  }
}

function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const val1 = sorted[mid - 1] ?? 0;
  const val2 = sorted[mid] ?? 0;
  return Math.round((val1 + val2) / 2);
}

// Target 5: No channel has > 5% scoreless
let maxChannelScorelessRate = 0;
for (const row of channelMap.values()) {
  const rate = row.matches > 0 ? row.scoreless / row.matches : 0;
  if (rate > maxChannelScorelessRate) {
    maxChannelScorelessRate = rate;
  }
}

const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`Simulations complete in ${durationSeconds} s.`);

// Build Markdown Report
const reportLines: string[] = [];
reportLines.push('# Tank Duel Simulation Report');
reportLines.push('');
reportLines.push(
  `Simulations run in **${durationSeconds} s** (${isQuick ? 'quick mode' : 'full sweep'}).`,
);
reportLines.push('');

// Target Evaluation Table
reportLines.push('## Balance Targets');
reportLines.push('');
reportLines.push('| Target | Metric | Scope | Measured | Target Range | Status |');
reportLines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

const t1Pass = t1Res.aRate >= 0.7 && t1Res.aRate <= 0.85;
reportLines.push(
  `| Target 1 | Grandpa Lou beats Pip | game-1 | ${(t1Res.aRate * 100).toFixed(1)}% | 70.0% – 85.0% | ${t1Pass ? 'PASS' : 'FAIL'} |`,
);

const t2Pass = t2Res.aRate >= 0.4 && t2Res.aRate <= 0.6;
reportLines.push(
  `| Target 2 | Dee against Moss | game-1 | ${(t2Res.aRate * 100).toFixed(1)}% | 40.0% – 60.0% | ${t2Pass ? 'PASS' : 'FAIL'} |`,
);

const t3Pass = t3Res.aRate >= 0.35 && t3Res.aRate <= 0.55;
reportLines.push(
  `| Target 3 | Novice human beats Pip | game-1 | ${(t3Res.aRate * 100).toFixed(1)}% | 35.0% – 55.0% | ${t3Pass ? 'PASS' : 'FAIL'} |`,
);

const t4Pass = t4Rate >= 0.9;
reportLines.push(
  `| Target 4 | Combined score ${SCORE_BAND.low}–${SCORE_BAND.high} | All timed matches but two Remix channels | ${(t4Rate * 100).toFixed(1)}% | ≥ 90.0% | ${t4Pass ? 'PASS' : 'FAIL'} |`,
);

const t5Pass = maxChannelScorelessRate <= 0.05;
reportLines.push(
  `| Target 5 | Max scoreless rate | All channels | ${(maxChannelScorelessRate * 100).toFixed(1)}% | ≤ 5.0% | ${t5Pass ? 'PASS' : 'FAIL'} |`,
);

reportLines.push('');
reportLines.push('## Channel Statistics');
reportLines.push('');
reportLines.push(
  '| Channel | Title | Matches | Scoreless | Scoreless % | Median Score | Bank Hits | Status |',
);
reportLines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

for (const row of channelMap.values()) {
  const scorelessPct = row.matches > 0 ? (row.scoreless / row.matches) * 100 : 0;
  const med = calculateMedian(row.totals);
  const status = scorelessPct <= 5.0 ? 'PASS' : 'FAIL';

  reportLines.push(
    `| ${row.channel} | ${row.title} | ${row.matches} | ${row.scoreless} | ${scorelessPct.toFixed(1)}% | ${med} | ${row.bankHits} | ${status} |`,
  );
}

reportLines.push('');

const filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(filename);
const outPath = path.resolve(currentDir, '../docs/SIMULATIONS.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, reportLines.join('\n'), 'utf-8');

console.log(`Saved report to ${outPath}`);
