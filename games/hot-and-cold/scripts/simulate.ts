/**
 * Seeded simulations for Hot & Cold's balance notes (NOTES.md):
 *
 *   tsx scripts/simulate.ts solvability [fields]          every field can be solved, per flag motion
 *   tsx scripts/simulate.ts solo [hunts]                  checks to the flag: perfect hunter, Lou, Pip
 *   tsx scripts/simulate.ts duels [matches] [salt] [n]    Kid against Kid in variation n (default 1)
 *
 * Every run is seeded, so the numbers in NOTES.md can be had again exactly; a salt gives a fresh
 * set of seeds to check a result is not an accident of one set.
 */
import type { KidId } from '@woodgrain-88/kit';
import { cartridgeRules, shortened } from '../src/engine/rules.ts';
import {
  duel,
  huntChecks,
  median,
  percentile,
  solveField,
  type Hunter,
} from '../src/sim/measure.ts';

const [mode = 'duels', countText, salt = '', variationText = '1'] = process.argv.slice(2);

function percent(part: number, whole: number): string {
  return `${((100 * part) / whole).toFixed(1)}%`;
}

function solvability(fields: number): void {
  for (const motion of ['still', 'bounce', 'wrap'] as const) {
    const checks: number[] = [];
    let lost = 0;
    for (let field = 0; field < fields; field++) {
      const taken = solveField(`solvable/${motion}/${field}`, motion);
      if (taken < 0) lost++;
      else checks.push(taken);
    }
    console.log(
      `${motion}: ${fields} fields, truth lost ${lost}, checks median ${median(checks)}, ` +
        `95th ${percentile(checks, 0.95)}, worst ${Math.max(...checks)}, ` +
        `over 75: ${checks.filter((taken) => taken > 75).length}`,
    );
  }
}

function solo(hunts: number): void {
  const hunters: [string, Hunter][] = [
    ['perfect', { kid: 'lou', memory: 'sharp', clues: 'notebook', perfect: true }],
    ['Lou, notebook', { kid: 'lou', memory: 'human', clues: 'notebook' }],
    ['Lou, classic', { kid: 'lou', memory: 'human', clues: 'classic' }],
    ['Pip, classic', { kid: 'pip', memory: 'human', clues: 'classic' }],
  ];
  for (const variation of [5, 6, 7]) {
    const rules = cartridgeRules(variation);
    for (const [label, hunter] of hunters) {
      const checks = Array.from({ length: hunts }, (_, hunt) =>
        huntChecks(rules, `solo/${variation}/${hunt}`, hunter),
      );
      console.log(
        `variation ${variation}, ${label}: median ${median(checks)}, 90th ${percentile(checks, 0.9)}`,
      );
    }
  }
}

function duels(matches: number): void {
  const variation = Number(variationText);
  const rules = shortened(cartridgeRules(variation));
  const pairs: [KidId, KidId][] = [
    ['lou', 'pip'],
    ['moss', 'dee'],
    ['lou', 'moss'],
    ['rosa', 'benny'],
    ['dee', 'pip'],
  ];
  for (const clues of ['classic', 'notebook'] as const) {
    for (const [first, second] of pairs) {
      const record = duel(rules, first, second, clues, matches, salt);
      console.log(
        `${clues} variation ${variation}: ${first} beats ${second} ` +
          `${percent(record.firstWins, matches)}, draws ${percent(record.draws, matches)} ` +
          `(${matches} matches, ${record.minutes.toFixed(1)} min each)`,
      );
    }
  }
}

const defaults: Record<string, number> = { solvability: 100_000, solo: 400 };
const count = Number(countText ?? defaults[mode] ?? 200);
const started = Date.now();
if (mode === 'solvability') solvability(count);
else if (mode === 'solo') solo(count);
else duels(count);
console.log(`(${((Date.now() - started) / 1000).toFixed(1)} s)`);
