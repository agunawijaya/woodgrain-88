/**
 * The files the checks look at: everything git would publish (tracked plus
 * untracked-but-not-ignored), so a check fails before a bad file is ever
 * committed. Paths are repo-relative with forward slashes.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..', '..');

export interface Problem {
  file: string;
  line?: number;
  message: string;
}

export function repoFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\n').filter(Boolean).sort();
}

export function readRepoFile(file: string): string {
  return readFileSync(join(repoRoot, file), 'utf8');
}

/** Each line of a file with its 1-based number, for line-level checks. */
export function linesOf(file: string): { text: string; line: number }[] {
  return readRepoFile(file)
    .split(/\r?\n/)
    .map((text, index) => ({ text, line: index + 1 }));
}
