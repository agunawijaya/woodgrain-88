import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fencesOverlap, globToRegExp, literalPrefix, matchesAny } from '../lib/glob.mjs';

test('** spans folders, * stays inside one segment', () => {
  assert.ok(matchesAny('packages/kit/src/rng.ts', ['packages/kit/src/**']));
  assert.ok(matchesAny('packages/kit/src/deep/a/b.ts', ['packages/kit/src/**']));
  assert.ok(matchesAny('packages/kit/tests/rng.test.ts', ['packages/kit/tests/*.test.ts']));
  assert.ok(!matchesAny('packages/kit/tests/sub/rng.test.ts', ['packages/kit/tests/*.test.ts']));
  assert.ok(!matchesAny('packages/kit/srcs/x.ts', ['packages/kit/src/**']));
});

test('**/ in the middle matches zero or more folders', () => {
  const regex = globToRegExp('games/**/NOTES.md');
  assert.ok(regex.test('games/NOTES.md'));
  assert.ok(regex.test('games/tank-duel/docs/NOTES.md'));
  assert.ok(!regex.test('games/tank-duel/docs/NOTES.mdx'));
});

test('braces and ? work, dots are literal', () => {
  assert.ok(matchesAny('packages/kit/src/rng.ts', ['packages/kit/src/{rng,loop}.ts']));
  assert.ok(!matchesAny('packages/kit/src/input.ts', ['packages/kit/src/{rng,loop}.ts']));
  assert.ok(
    matchesAny('research/dossiers/08-trailblaze.md', ['research/dossiers/0?-trailblaze.md']),
  );
  assert.ok(
    !matchesAny('research/dossiers/08-trailblazeXmd', ['research/dossiers/08-trailblaze.md']),
  );
});

test('literal prefixes stop at the segment before the first wildcard', () => {
  assert.equal(literalPrefix('packages/kit/src/**'), 'packages/kit/src/');
  assert.equal(literalPrefix('packages/kit/src/ab*.ts'), 'packages/kit/src/');
  assert.equal(literalPrefix('docs/team/CREW.md'), 'docs/team/CREW.md');
});

test('fences overlap only when they could share a file', () => {
  assert.ok(
    !fencesOverlap(['research/dossiers/08-trailblaze.md'], ['research/dossiers/09-crown-jump.md']),
  );
  assert.ok(fencesOverlap(['packages/kit/src/**'], ['packages/kit/src/rng.ts']));
  assert.ok(fencesOverlap(['packages/kit/**'], ['packages/kit/src/loop/**']));
  assert.ok(!fencesOverlap(['packages/kit/src/rng.ts'], ['packages/kit/src/loop.ts']));
  assert.ok(!fencesOverlap(['hall/src/**'], ['packages/kit/src/**']));
  assert.ok(!fencesOverlap(['packages/kit/tests/*.test.ts'], ['packages/kit/src/rng.ts']));
});
