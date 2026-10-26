/**
 * Local first through one door (CLAUDE.md rule 13): only the kit's store
 * touches browser storage. Tests may seed it to set up a scenario, so only
 * shipped source folders are scanned.
 */
import { linesOf, type Problem } from './files.ts';

const SCANNED = [/^hall\/src\//, /^packages\/[^/]+\/src\//, /^games\/[^/]+\/src\//];
const STORE_FOLDER = 'packages/kit/src/store/';
const STORAGE = /\b(localStorage|sessionStorage|indexedDB)\b/;

export function checkStorage(files: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  for (const file of files) {
    if (
      !/\.(ts|js|mjs)$/.test(file) ||
      !SCANNED.some((scope) => scope.test(file)) ||
      file.startsWith(STORE_FOLDER)
    )
      continue;
    for (const { text, line } of linesOf(file)) {
      if (STORAGE.test(text)) {
        problems.push({ file, line, message: 'touches browser storage outside the kit store' });
      }
    }
  }
  return problems;
}
