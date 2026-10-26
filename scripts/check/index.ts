/**
 * `pnpm check`: the collection's guardrails, run beside lint and tests. Each
 * check lists its problems and any problem fails the run. The build checks
 * need `pnpm build` first and are skipped, with a note, when there is none.
 */
import { buildExists, checkFixtureNotShipped, checkNetworkUrls } from './build-output.ts';
import { repoFiles, type Problem } from './files.ts';
import { checkFonts } from './fonts.ts';
import { checkNames } from './names.ts';
import { checkProvenance } from './provenance.ts';
import { checkRaster } from './raster.ts';
import { checkStorage } from './storage.ts';

const files = repoFiles();

const checks: [string, () => Problem[]][] = [
  ['Zero raster outside media folders', () => checkRaster(files)],
  ['No original titles or brands in the Hall, packages or games', () => checkNames(files)],
  ['Storage only through the kit store', () => checkStorage(files)],
  ['Nothing from original/, src/ or research/ published', () => checkProvenance(files)],
  ['Open, self-hosted fonts', checkFonts],
];

if (buildExists()) {
  checks.push(
    ['No network URLs in the build', checkNetworkUrls],
    ['Test fixtures and the dev showcase kept out of the build', checkFixtureNotShipped],
  );
} else {
  console.warn('· No build in hall/dist: run `pnpm build` to include the build checks.');
}

let failed = 0;
for (const [name, check] of checks) {
  const problems = check();
  if (problems.length === 0) {
    console.warn(`✓ ${name}`);
    continue;
  }
  failed++;
  console.error(`✗ ${name}: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  for (const problem of problems) {
    const where = problem.line === undefined ? problem.file : `${problem.file}:${problem.line}`;
    console.error(`    ${where}  ${problem.message}`);
  }
}
if (failed > 0) process.exitCode = 1;
