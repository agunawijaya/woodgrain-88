/**
 * Our own titles only (CLAUDE.md rule 3): original titles, publishers and the
 * console's name may appear in `inspiredBy` data, the About page and the
 * credits, and nowhere else in the Hall, the packages or a game's source.
 * Matching is case-sensitive and whole-word, so ordinary words such as
 * "surrounding" or "combative" never trip it.
 */
import { linesOf, type Problem } from './files.ts';

export const DENY_LIST = [
  'Atari',
  'Activision',
  'CommaVid',
  'US Games',
  'Combat',
  'Freeway',
  'Othello',
  'Air-Sea Battle',
  'Surround',
  'Space Jockey',
  'Cosmic Swarm',
  'Stampede',
  'Laser Blast',
  'Fishing Derby',
  'Slot Racers',
  'Human Cannonball',
  'Outlaw',
  'Sky Diver',
  'Space War',
  'VCS',
];

const SCANNED = [/^hall\/(src|tests)\//, /^packages\/[^/]+\/src\//, /^games\/[^/]+\/src\//];
const ALLOWED_FILES = [/^hall\/src\/pages\/about\.ts$/];
const SOURCE = /\.(ts|tsx|js|mjs|css|html)$/;
// inspiredBy fields are the one sanctioned home for the originals' names.
const INSPIRED_BY_LINE = /^\s*(originalTitle|publisher)\s*:/;

const patterns = DENY_LIST.map((word) => ({
  word,
  pattern: new RegExp(`\\b${word.replace(/[-\s]/g, (c) => (c === '-' ? '\\-' : '\\s'))}\\b`),
}));

export function findNames(text: string): string[] {
  return patterns.filter(({ pattern }) => pattern.test(text)).map(({ word }) => word);
}

export function checkNames(files: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  for (const file of files) {
    if (!SOURCE.test(file) || !SCANNED.some((scope) => scope.test(file))) continue;
    if (ALLOWED_FILES.some((allowed) => allowed.test(file))) continue;
    for (const { text, line } of linesOf(file)) {
      if (INSPIRED_BY_LINE.test(text)) continue;
      for (const word of findNames(text))
        problems.push({ file, line, message: `mentions "${word}"` });
    }
  }
  return problems;
}
