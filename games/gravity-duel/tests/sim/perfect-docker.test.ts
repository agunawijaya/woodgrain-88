/**
 * Proves the docking rule (NOTES.md, Docking): a flawless docker, flying
 * solo variation 14 with nothing else to do, must reach the cartridge
 * target of 10 docks before the clock, on every one of a wide spread of
 * seeds, on switch B. This is the one target the brief requires to really
 * pass; it is not a Kid and is never tuned.
 */
import { describe, expect, it } from 'vitest';
import { simulate } from '../../src/sim/duel.ts';
import { PERFECT_DOCKER_TARGET } from '../../src/sim/targets.ts';

describe('perfect docker', () => {
  it('docks ten times before the clock, every seed, on switch B', () => {
    for (const seed of PERFECT_DOCKER_TARGET.seeds) {
      const result = simulate({
        variation: PERFECT_DOCKER_TARGET.variation,
        seats: [{ kind: 'perfect-docker' }, { kind: 'idle' }],
        seed,
        switches: [PERFECT_DOCKER_TARGET.switchPosition, PERFECT_DOCKER_TARGET.switchPosition],
      });

      expect(result.reason).toBe('target');
      expect(result.docks[0]).toBeGreaterThanOrEqual(PERFECT_DOCKER_TARGET.target);
    }
  });
});
