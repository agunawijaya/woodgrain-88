/**
 * The lead's tuning tool: runs every balance target and the perfect
 * docker's check, and prints a Markdown table of the results.
 *
 * Usage:
 *   pnpm exec tsx games/gravity-duel/scripts/simulate.ts [--matches N] [--seed N] [--only "name"]
 */
import { simulate } from '../src/sim/duel.ts';
import {
  BALANCE_TARGETS,
  PERFECT_DOCKER_TARGET,
  inBalanceBand,
  measureTarget,
  type BalanceTarget,
} from '../src/sim/targets.ts';

interface Args {
  readonly matches: number;
  readonly seed: number;
  readonly only: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  let matches = 160;
  let seed = 1;
  let only: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--matches') matches = Number.parseInt(argv[++i] ?? '160', 10);
    else if (arg === '--seed') seed = Number.parseInt(argv[++i] ?? '1', 10);
    else if (arg === '--only') only = argv[++i] ?? null;
  }
  return { matches, seed, only };
}

function bandText(target: BalanceTarget): string {
  const high = target.high === Infinity ? '∞' : target.high.toFixed(2);
  return `${target.low.toFixed(2)} – ${high}`;
}

function runBalanceTargets(args: Args): void {
  console.log('Balance targets');
  console.log('----------------');
  console.log('| Target | Variation | Measured | Band | Result |');
  console.log('| --- | --- | --- | --- | --- |');

  const seedBase = args.seed * 100_000;
  let offset = 0;
  for (const target of BALANCE_TARGETS) {
    if (args.only && target.name !== args.only) continue;
    const value = measureTarget(target, args.matches, seedBase + offset);
    offset += args.matches;
    const pass = inBalanceBand(target, value);
    const shown = Number.isFinite(value) ? value.toFixed(3) : '∞';
    console.log(
      `| ${target.name} | ${target.variation} | ${shown} | ${bandText(target)} | ${pass ? 'PASS' : 'FAIL'} |`,
    );
  }
}

function runPerfectDocker(args: Args): void {
  if (args.only && args.only !== PERFECT_DOCKER_TARGET.name) return;
  console.log('\nPerfect docker');
  console.log('--------------');
  for (const switchPosition of ['B', 'A'] as const) {
    let allDocked = 0;
    const dockCounts: number[] = [];
    for (const seed of PERFECT_DOCKER_TARGET.seeds) {
      const result = simulate({
        variation: PERFECT_DOCKER_TARGET.variation,
        seats: [{ kind: 'perfect-docker' }, { kind: 'idle' }],
        seed,
        switches: [switchPosition, switchPosition],
      });
      dockCounts.push(result.docks[0]);
      if (result.docks[0] >= PERFECT_DOCKER_TARGET.target) allDocked += 1;
    }
    const average = (dockCounts.reduce((a, b) => a + b, 0) / dockCounts.length).toFixed(1);
    console.log(
      `switch ${switchPosition}: reached 10 docks on ${allDocked}/${PERFECT_DOCKER_TARGET.seeds.length} seeds, average ${average} docks`,
    );
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Gravity Duel simulation suite (matches: ${args.matches}, seed: ${args.seed})\n`);
  runBalanceTargets(args);
  runPerfectDocker(args);
}

main();
