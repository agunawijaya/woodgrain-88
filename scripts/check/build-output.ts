/**
 * Checks on the built site (hall/dist): no network URLs in shipped code (the
 * site never fetches anything), no trace of the test-only fixture games or
 * the dev showcase, and no three.js in what the Hall loads up front (it comes
 * only with a game that needs it).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repoRoot, type Problem } from './files.ts';

const DIST = join(repoRoot, 'hall', 'dist');
// The SVG namespace is an identifier, not a request; the About page links to its one source; and
// three.js cites a graphics paper in a shader comment it ships, which nothing ever fetches.
const ALLOWED_URLS = [
  /^http:\/\/www\.w3\.org\//,
  /^https:\/\/www\.computinghistory\.org\.uk\//,
  /^https:\/\/jcgt\.org\/published\//,
];
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

/** The fixtures' ids and titles (hall/tests/fixtures, FIXTURE_IDS); `test-catch` also covers the five run copies. */
const FIXTURE_TRACES = [
  'test-paddles',
  'Test Paddles',
  'test-grid',
  'Test Grid',
  'test-catch',
  'Test Catch',
];
/** The showcase's URL parameter and its made-up run goals only exist in dev builds. */
const SHOWCASE_TRACES = ['showcase', 'Survive the whole 45 seconds'];

export function checkFixtureNotShipped(): Problem[] {
  const problems: Problem[] = [];
  for (const path of builtFiles()) {
    const text = readFileSync(path, 'utf8');
    for (const trace of FIXTURE_TRACES) {
      if (text.includes(trace))
        problems.push({
          file: repoPath(path),
          message: `contains the test-only fixture "${trace}"`,
        });
    }
    for (const trace of SHOWCASE_TRACES) {
      if (text.includes(trace))
        problems.push({ file: repoPath(path), message: `contains the dev showcase ("${trace}")` });
    }
  }
  if (existsSync(join(DIST, 'harness.html'))) {
    problems.push({ file: 'hall/dist/harness.html', message: 'the harness was built' });
  }
  return problems;
}

/** A name every three.js build carries; the Hall's own code never uses it. */
const THREE_TRACE = 'WebGLRenderer';

/** The entry script and everything index.html preloads: what the Hall loads before any game. */
function upFrontFiles(): string[] {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const sources = [...html.matchAll(/(?:src|href)="\/?([^"]+\.js)"/g)].map(
    (match) => match[1] ?? '',
  );
  return sources.filter((source) => source.length > 0).map((source) => join(DIST, source));
}

export function checkThreeKeptOut(): Problem[] {
  return upFrontFiles()
    .filter((path) => existsSync(path) && readFileSync(path, 'utf8').includes(THREE_TRACE))
    .map((path) => ({
      file: repoPath(path),
      message: 'three.js is in what the Hall loads up front',
    }));
}
