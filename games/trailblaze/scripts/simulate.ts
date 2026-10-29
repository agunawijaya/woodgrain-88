/**
 * Simulation script running head-to-head bot sweeps and balance verifications
 * for Trailblaze.
 *
 * Usage:
 *   pnpm exec tsx games/trailblaze/scripts/simulate.ts [matches]
 */
import { KID_IDS } from '@woodgrain-88/kit';
import type { Contender } from '../src/sim/duel.ts';
import { pairing } from '../src/sim/sweep.ts';
import { BALANCE_TARGETS, inBalanceBand } from '../src/sim/targets.ts';

const arg = process.argv[2];
const targetMatches = arg ? Number.parseInt(arg, 10) : 80;
const cellMatches = Math.max(2, Math.floor(targetMatches / 2));

let totalRounds = 0;
let totalTicks = 0;
let totalMatches = 0;

console.log('Trailblaze Simulation Suite');
console.log('==========================');
console.log(`Target matches: ${targetMatches}, Matrix cell matches: ${cellMatches}\n`);

console.log('Balance Targets:');
console.log('----------------');

const TARGET_SEED_BASE = 11_000;
let targetSeedOffset = 0;

for (const target of BALANCE_TARGETS) {
  const result = pairing(
    target.first,
    target.second,
    target.variation,
    targetMatches,
    TARGET_SEED_BASE + targetSeedOffset,
    target.fixedSeats ? { fixedSeats: true } : {},
  );
  targetSeedOffset += targetMatches;

  totalRounds += result.totalRounds ?? 0;
  totalTicks += result.totalTicks ?? 0;
  totalMatches += result.matches;

  const passed = inBalanceBand(target, result.winRate);
  const measured = `${(result.winRate * 100).toFixed(1)}%`;
  const band = `${(target.low * 100).toFixed(1)}% – ${(target.high * 100).toFixed(1)}%`;
  const status = passed ? 'PASS' : 'FAIL';

  console.log(
    `  ${target.name.padEnd(30)} var ${target.variation} | measured: ${measured.padStart(6)} | target: ${band.padStart(15)} | ${status}`,
  );
}

console.log('\nKid Matrix (Variation 1, win rate for row vs column):');
console.log('------------------------------------------------------');

const header = `Kid    | ${KID_IDS.map((k) => k.padEnd(6)).join(' | ')}`;
console.log(header);
console.log('-'.repeat(header.length));

const MATRIX_SEED_BASE = 21_000;
let matrixSeedOffset = 0;

for (const kidA of KID_IDS) {
  const cells: string[] = [];
  for (const kidB of KID_IDS) {
    if (kidA === kidB) {
      cells.push(' 50.0%');
      continue;
    }
    const contenderA: Contender = { kind: 'kid', kid: kidA, mode: 'human' };
    const contenderB: Contender = { kind: 'kid', kid: kidB, mode: 'human' };

    const result = pairing(
      contenderA,
      contenderB,
      1,
      cellMatches,
      MATRIX_SEED_BASE + matrixSeedOffset,
    );
    matrixSeedOffset += cellMatches;

    totalRounds += result.totalRounds ?? 0;
    totalTicks += result.totalTicks ?? 0;
    totalMatches += result.matches;

    cells.push(`${(result.winRate * 100).toFixed(1)}%`.padStart(6));
  }
  console.log(`${kidA.padEnd(6)} | ${cells.join(' | ')}`);
}

const avgRounds = totalMatches > 0 ? (totalRounds / totalMatches).toFixed(1) : '0';
const avgTicks = totalMatches > 0 ? (totalTicks / totalMatches).toFixed(1) : '0';

console.log('\nMatch Statistics:');
console.log('-----------------');
console.log(`Total matches played: ${totalMatches}`);
console.log(`Average rounds per match: ${avgRounds}`);
console.log(`Average ticks per match: ${avgTicks}`);
