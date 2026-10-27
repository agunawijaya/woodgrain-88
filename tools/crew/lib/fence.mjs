/**
 * Fence enforcement. After a run, every change the crew made in its staging
 * copy is sorted into one of three piles:
 *
 *   applied    inside the fence, and the lead has not touched that file since
 *              the copy was made: carried into the real working tree
 *   conflicts  inside the fence, but the real file changed meanwhile: kept for
 *              the lead to merge by hand
 *   violations outside the fence: never applied, kept for review
 *
 * Kept files land in the run's rejected/ folder under their repo path.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { matchesAny } from './glob.mjs';
import { CREW_HOOK_ROOT, diffTrees, hashBuffer, hashFile, hashTree, listFiles } from './tree.mjs';

function currentHash(repoRoot, rel) {
  const absolute = join(repoRoot, rel);
  return existsSync(absolute) ? hashFile(absolute) : undefined;
}

function keepForReview(stagingDir, rejectedDir, rel) {
  const source = join(stagingDir, rel);
  if (!existsSync(source)) return;
  const target = join(rejectedDir, rel);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
}

export function enforceFence({ repoRoot, stagingDir, baseline, fence, rejectedDir }) {
  const after = hashTree(stagingDir, { excludeRoots: [CREW_HOOK_ROOT] });
  const { added, modified, deleted } = diffTrees(baseline, after);
  const changes = [
    ...added.map((path) => ({ path, change: 'added' })),
    ...modified.map((path) => ({ path, change: 'modified' })),
    ...deleted.map((path) => ({ path, change: 'deleted' })),
  ].sort((a, b) => (a.path < b.path ? -1 : 1));

  const applied = [];
  const conflicts = [];
  const violations = [];

  for (const entry of changes) {
    if (!matchesAny(entry.path, fence)) {
      keepForReview(stagingDir, rejectedDir, entry.path);
      violations.push(entry);
      continue;
    }
    const realHashNow = currentHash(repoRoot, entry.path);
    if (realHashNow !== baseline.get(entry.path)) {
      keepForReview(stagingDir, join(rejectedDir, 'conflicts'), entry.path);
      conflicts.push(entry);
      continue;
    }
    const target = join(repoRoot, entry.path);
    if (entry.change === 'deleted') {
      rmSync(target, { force: true });
    } else {
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(stagingDir, entry.path), target);
    }
    applied.push(entry);
  }
  return { applied, conflicts, violations };
}

/**
 * Puts protected folders back exactly as they were before the run and reports
 * what had to be restored. With the staging copy this should never trigger; it
 * guards against a crew run writing through --add-dir or an absolute path.
 */
export function restoreProtected({ repoRoot, roots, captured, rejectedDir }) {
  const restored = [];
  const currentFiles = new Set(
    roots.flatMap((root) => listFiles(join(repoRoot, root)).map((rel) => `${root}/${rel}`)),
  );
  for (const [rel, bytes] of captured) {
    const absolute = join(repoRoot, rel);
    const stillThere = existsSync(absolute);
    if (stillThere && hashFile(absolute) === hashBuffer(bytes)) continue;
    if (stillThere) keepForReview(repoRoot, join(rejectedDir, 'protected'), rel);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes);
    restored.push({ path: rel, change: stillThere ? 'modified' : 'deleted' });
  }
  for (const rel of currentFiles) {
    if (captured.has(rel)) continue;
    keepForReview(repoRoot, join(rejectedDir, 'protected'), rel);
    rmSync(join(repoRoot, rel), { force: true });
    restored.push({ path: rel, change: 'added' });
  }
  return restored;
}
