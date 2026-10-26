/**
 * Checks on the built site (hall/dist): no network URLs in shipped code (the
 * site never fetches anything) and no trace of the test-only fake game.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repoRoot, type Problem } from './files.ts';

const DIST = join(repoRoot, 'hall', 'dist');
// The SVG namespace is an identifier, not a request; the About page links to its one source.
const ALLOWED_URLS = [/^http:\/\/www\.w3\.org\//, /^https:\/\/www\.computinghistory\.org\.uk\//];
const URL_PATTERN = /https?:\/\/[^\s"'`)<>\\]+/g;

export function buildExists(): boolean {
  return existsSync(join(DIST, 'index.html'));
}

function builtFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return builtFiles(path);
    return /\.(js|css|html|webmanifest|json)$/.test(entry.name) ? [path] : [];
  });
}

const repoPath = (path: string) => relative(repoRoot, path).split('\\').join('/');

export function checkNetworkUrls(): Problem[] {
  const problems: Problem[] = [];
  for (const path of builtFiles()) {
    const text = readFileSync(path, 'utf8');
    for (const url of text.match(URL_PATTERN) ?? []) {
      if (!ALLOWED_URLS.some((allowed) => allowed.test(url))) {
        problems.push({ file: repoPath(path), message: `network URL ${url}` });
      }
    }
  }
  return problems;
}

export function checkFixtureNotShipped(): Problem[] {
  const problems: Problem[] = [];
  for (const path of builtFiles()) {
    const text = readFileSync(path, 'utf8');
    if (text.includes('test-paddles') || text.includes('Test Paddles')) {
      problems.push({ file: repoPath(path), message: 'contains the test-only fake game' });
    }
  }
  if (existsSync(join(DIST, 'harness.html'))) {
    problems.push({ file: 'hall/dist/harness.html', message: 'the harness was built' });
  }
  return problems;
}
