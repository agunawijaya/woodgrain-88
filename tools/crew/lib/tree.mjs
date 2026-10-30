/**
 * File-tree plumbing for fences: listing and hashing files, making the staging
 * copy the crew works in, and comparing trees before and after a run.
 *
 * The crew never edits the real working tree. It works in a copy under
 * .team/worktrees/<order-id>/, so the lead can keep editing the repo while a
 * run is in flight, and only changes inside the fence are carried back.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/** Never walked: dependencies, build output and git internals. */
const SKIPPED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  '.vite',
]);

/** Where the bridge puts agy's hook config in a staging copy; never carried back. */
export const CREW_HOOK_ROOT = '.agents';

/**
 * Root entries left out of the staging copy. The reference folders are read in
 * place through --add-dir rather than copied; .team/ and .claude/ are the
 * lead's own machinery, and .agents/ in a staging copy is written by the bridge.
 */
export const STAGING_EXCLUDED_ROOTS = ['original', 'src', '.team', '.claude', CREW_HOOK_ROOT];

const toPosix = (path) => path.split(sep).join('/');

export function listFiles(root, { excludeRoots = [] } = {}) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      const rel = toPosix(relative(root, absolute));
      if (entry.isDirectory()) {
        if (SKIPPED_DIR_NAMES.has(entry.name)) continue;
        if (dir === root && excludeRoots.includes(entry.name)) continue;
        walk(absolute);
      } else if (entry.isFile()) {
        if (dir === root && excludeRoots.includes(entry.name)) continue;
        if (/^\.env(\..*)?$/.test(entry.name)) continue;
        files.push(rel);
      }
    }
  };
  if (existsSync(root)) walk(root);
  return files.sort();
}

export function hashFile(absolutePath) {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

/** Map of repo-relative path to content hash. */
export function hashTree(root, options) {
  return new Map(listFiles(root, options).map((rel) => [rel, hashFile(join(root, rel))]));
}

/**
 * Copies the repo into a fresh staging folder and returns the baseline
 * hashes. `extraExcludedRoots` leaves out more than the usual roots — the
 * free-tier DeepSeek member also skips `research/`, so it cannot read the
 * dossiers by browsing even though they are not in its order's reads.
 */
export function createStagingCopy(repoRoot, stagingDir, { extraExcludedRoots = [] } = {}) {
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  const files = listFiles(repoRoot, {
    excludeRoots: [...STAGING_EXCLUDED_ROOTS, ...extraExcludedRoots],
  });
  const baseline = new Map();
  for (const rel of files) {
    const source = join(repoRoot, rel);
    const target = join(stagingDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target);
    baseline.set(rel, hashFile(source));
  }
  return baseline;
}

export function diffTrees(before, after) {
  const added = [];
  const modified = [];
  const deleted = [];
  for (const [path, hash] of after) {
    if (!before.has(path)) added.push(path);
    else if (before.get(path) !== hash) modified.push(path);
  }
  for (const path of before.keys()) {
    if (!after.has(path)) deleted.push(path);
  }
  return { added, modified, deleted };
}

/**
 * Holds the exact bytes of protected folders so that anything the crew changes
 * there through --add-dir can be put back byte for byte.
 */
export function captureProtected(repoRoot, roots) {
  const contents = new Map();
  for (const root of roots) {
    const absoluteRoot = join(repoRoot, root);
    for (const rel of listFiles(absoluteRoot)) {
      contents.set(`${root}/${rel}`, readFileSync(join(absoluteRoot, rel)));
    }
  }
  return contents;
}

export function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
