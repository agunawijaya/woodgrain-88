/**
 * Run slots: at most three crew runs at once per session, never two whose
 * fences could touch the same file. Each running order holds a small claim
 * file in .team/runs/active/; claims left by a crashed bridge are dropped once
 * their process is gone.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fencesOverlap } from './glob.mjs';

export const MAX_PARALLEL_RUNS = 3;

const activeDir = (repoRoot) => join(repoRoot, '.team', 'runs', 'active');

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export function activeClaims(repoRoot) {
  const dir = activeDir(repoRoot);
  if (!existsSync(dir)) return [];
  const claims = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const claim = JSON.parse(readFileSync(file, 'utf8'));
    if (processIsAlive(claim.pid)) claims.push(claim);
    else rmSync(file, { force: true });
  }
  return claims;
}

/** Claims a slot for an order or throws with the reason it must wait. */
export function claimSlot(repoRoot, { id, fence }, pid = process.pid) {
  const everyClaim = activeClaims(repoRoot);
  if (everyClaim.some((claim) => claim.id === id && claim.pid !== pid)) {
    throw new Error(`Order ${id} is already running.`);
  }
  const claims = everyClaim.filter((claim) => claim.id !== id);
  if (claims.length >= MAX_PARALLEL_RUNS) {
    throw new Error(`${claims.length} crew runs are already in flight; wait for one to finish.`);
  }
  const clash = claims.find((claim) => fencesOverlap(claim.fence, fence));
  if (clash)
    throw new Error(`Fence overlaps the running order ${clash.id}; run them one after the other.`);
  mkdirSync(activeDir(repoRoot), { recursive: true });
  writeFileSync(
    join(activeDir(repoRoot), `${id}.json`),
    JSON.stringify({ id, fence, pid, since: new Date().toISOString() }),
  );
}

export function releaseSlot(repoRoot, id) {
  rmSync(join(activeDir(repoRoot), `${id}.json`), { force: true });
}

const LOCK_RETRY_MS = 50;
const LOCK_GIVE_UP_MS = 10_000;

/**
 * Serialises read-modify-write of shared files (the ledger) between parallel
 * bridge processes. mkdir is atomic on every platform we run on.
 */
export async function withLock(repoRoot, name, action) {
  const lockDir = join(repoRoot, '.team', 'runs', `${name}.lock`);
  mkdirSync(join(repoRoot, '.team', 'runs'), { recursive: true });
  const deadline = Date.now() + LOCK_GIVE_UP_MS;
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() > deadline) rmSync(lockDir, { recursive: true, force: true });
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
  try {
    return await action();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}
