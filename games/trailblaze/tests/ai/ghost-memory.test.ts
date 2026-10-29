/**
 * Tests for Ghost Trails kid memory: wall runs forming as riders step,
 * committing when turning or when rounds end, perfect recall under sharp profile,
 * forgetting under short half-life human profile, perception mask clearing invisible
 * trail and marking recalled runs, and unmodified behaviour on channel 1.
 */
import {
  createRng,
  KID_MEMORY,
  memoryProfile,
  SHARP_MEMORY,
  type MemoryProfile,
} from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createGhostMemory, WALL_RUN_ADAPTER, type WallRun } from '../../src/ai/ghost-memory.ts';
import { createKidRider } from '../../src/ai/kid.ts';
import { cellAt } from '../../src/engine/grid.ts';
import { CARTRIDGE_TARGET, createMatch, startMatch } from '../../src/engine/match.ts';
import {
  CELL_COUNT,
  TICKS_PER_SECOND,
  type Laid,
  type MatchEvent,
} from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';

describe('ghost memory', () => {
  describe('adapter', () => {
    it('keys a run by from:heading', () => {
      const run: WallRun = { from: cellAt(10, 10), heading: 'right', length: 5 };
      expect(WALL_RUN_ADAPTER.key(run)).toBe(`${cellAt(10, 10)}:right`);
    });

    it('distorts a run by shifting sideways or changing length by one', () => {
      const rng = createRng(42);
      const original: WallRun = { from: cellAt(10, 10), heading: 'right', length: 5 };
      let shifted = false;
      let lengthChanged = false;

      for (let i = 0; i < 20; i++) {
        const distorted = WALL_RUN_ADAPTER.distort(original, rng);
        if (distorted.from !== original.from) {
          shifted = true;
          // Perpendicular sideways to 'right' is 'up' (row 9) or 'down' (row 11)
          expect(distorted.from === cellAt(10, 9) || distorted.from === cellAt(10, 11)).toBe(true);
          expect(distorted.heading).toBe('right');
          expect(distorted.length).toBe(5);
        } else {
          lengthChanged = true;
          expect(distorted.from).toBe(original.from);
          expect(distorted.heading).toBe('right');
          expect(Math.abs(distorted.length - original.length)).toBe(1);
        }
      }

      expect(shifted).toBe(true);
      expect(lengthChanged).toBe(true);
    });
  });

  describe('run formation', () => {
    it('runs form from laid cells and become facts when a rider turns; a straight run of 10 is one fact', () => {
      const profile = memoryProfile('lou', 'human');
      const ghostMemory = createGhostMemory(profile, 0);
      const match = createMatch({
        rules: { ...variationRules(1), remix: { ghostAfter: 150 } },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      const rng = createRng(1001);

      // Lay 9 cells heading 'right' without turning (entered: 'right', left: 'right')
      for (let i = 0; i < 9; i++) {
        const laid: Laid[] = [
          {
            cell: cellAt(10 + i, 10),
            seat: 0,
            entered: 'right',
            left: 'right',
          },
        ];
        ghostMemory.hear(laid, match, i * 0.3, rng);
      }

      // No fact committed yet while rider continues straight
      expect(ghostMemory.memory.summary().kept.length).toBe(0);

      // Step 10: rider turns 'down' at cell (19, 10)
      const turnLaid: Laid[] = [
        {
          cell: cellAt(19, 10),
          seat: 0,
          entered: 'right',
          left: 'down',
        },
      ];
      ghostMemory.hear(turnLaid, match, 3.0, rng);

      // Now the straight run of 10 is committed as exactly one fact
      const kept = ghostMemory.memory.summary().kept;
      expect(kept.length).toBe(1);
      expect(kept[0]).toEqual({
        from: cellAt(10, 10),
        heading: 'right',
        length: 10,
      });

      // Salience for run > 8 is striking (1.3 * 1.5 = 1.95 for Lou own)
      const learnedEvent = ghostMemory.memory.log.find((e) => e.kind === 'learned');
      expect(learnedEvent).toBeDefined();
    });

    it('commits active runs when the round ends on crash', () => {
      const profile = memoryProfile('moss', 'human');
      const ghostMemory = createGhostMemory(profile, 0);
      const match = createMatch({
        rules: { ...variationRules(1), remix: { ghostAfter: 150 } },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      const rng = createRng(1002);

      // 4 straight steps
      for (let i = 0; i < 4; i++) {
        ghostMemory.hear(
          [{ cell: cellAt(10 + i, 10), seat: 0, entered: 'right', left: 'right' }],
          match,
          i * 0.3,
          rng,
        );
      }
      expect(ghostMemory.memory.summary().kept.length).toBe(0);

      // Match enters crash phase
      match.phase = 'crash';
      ghostMemory.hear([], match, 1.5, rng);

      // The uncompleted run is committed upon round end
      expect(ghostMemory.memory.summary().kept.length).toBe(1);
      expect(ghostMemory.memory.summary().kept[0]).toEqual({
        from: cellAt(10, 10),
        heading: 'right',
        length: 4,
      });
    });
  });

  describe('recall and forgetting', () => {
    it('recallInto marks a remembered run cells; with a sharp profile everything comes back exactly; a human profile with a short half-life forgets an old run after enough time', () => {
      const match = createMatch({
        rules: { ...variationRules(1), remix: { ghostAfter: 150 } },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      const rng = createRng(555);

      // 1. Sharp profile: perfect recall
      const sharpMemory = createGhostMemory(SHARP_MEMORY, 0);
      for (let i = 0; i < 9; i++) {
        sharpMemory.hear(
          [{ cell: cellAt(10 + i, 5), seat: 0, entered: 'right', left: 'right' }],
          match,
          i * 0.3,
          rng,
        );
      }
      sharpMemory.hear(
        [{ cell: cellAt(19, 5), seat: 0, entered: 'right', left: 'down' }],
        match,
        3.0,
        rng,
      );

      const sharpMask = new Uint8Array(CELL_COUNT);
      sharpMemory.recallInto(sharpMask, match, 1000, rng);

      // All 10 cells in the run are marked as blocked (1)
      for (let i = 0; i < 10; i++) {
        expect(sharpMask[cellAt(10 + i, 5)]).toBe(1);
      }
      // Unrelated cells remain 0
      expect(sharpMask[cellAt(9, 5)]).toBe(0);
      expect(sharpMask[cellAt(20, 5)]).toBe(0);
      expect(sharpMask[cellAt(10, 6)]).toBe(0);

      // 2. Human profile with short half-life: forgets old run
      const shortProfile: MemoryProfile = {
        ...KID_MEMORY.pip,
        halfLife: 1, // 1 second half-life
        distortion: 0,
      };
      const fadingMemory = createGhostMemory(shortProfile, 0);
      for (let i = 0; i < 4; i++) {
        fadingMemory.hear(
          [{ cell: cellAt(5 + i, 8), seat: 0, entered: 'right', left: 'right' }],
          match,
          0,
          rng,
        );
      }
      fadingMemory.hear(
        [{ cell: cellAt(9, 8), seat: 0, entered: 'right', left: 'down' }],
        match,
        0,
        rng,
      );

      // Fresh recall at t = 0.1s recalls accurately
      const freshMask = new Uint8Array(CELL_COUNT);
      fadingMemory.recallInto(freshMask, match, 0.1, rng);
      for (let i = 0; i < 5; i++) {
        expect(freshMask[cellAt(5 + i, 8)]).toBe(1);
      }

      // Old recall at t = 50s (50 half-lives later): fact has faded below FORGET_BELOW
      const forgottenMask = new Uint8Array(CELL_COUNT);
      fadingMemory.recallInto(forgottenMask, match, 50, rng);
      for (let i = 0; i < 5; i++) {
        expect(forgottenMask[cellAt(5 + i, 8)]).toBe(0);
      }
      expect(fadingMemory.memory.summary().forgotten.length).toBe(1);
    });
  });

  describe('kid in ghost trails match', () => {
    it('in a Ghost Trails match, a Kid whose memory is empty treats an old invisible trail cell as open (its mask), and with that run remembered treats it as blocked', () => {
      const match = createMatch({
        rules: { ...variationRules(1), remix: { ghostAfter: 150 } },
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      const rider = createKidRider({
        kid: 'lou',
        seat: 0,
        mode: 'human',
        seed: 42,
      });

      // Rider 0 at (10, 10), heading right
      const r0 = match.riders[0];
      if (r0) {
        r0.cell = cellAt(10, 10);
        r0.heading = 'right';
      }

      // Old invisible trail placed 2 cells ahead at (12, 10)
      const oldCell = cellAt(12, 10);
      match.cells[oldCell] = 1; // Rival's trail
      match.laidAt[oldCell] = 10; // Laid at tick 10
      match.tick = 200; // Age = 190 ticks >= ghostAfter (150)

      const stepEvent: MatchEvent = {
        type: 'step',
        laid: [],
        erased: [],
        moves: [],
        period: 15,
      };

      // Case A: Memory is empty -> old trail cell is treated as open in its mask
      rider.hear([stepEvent], match);
      expect(rider.perceptionMask).toBeDefined();
      expect(rider.perceptionMask?.[oldCell]).toBe(0);

      // Case B: With that run remembered -> marked as blocked in its mask
      const rememberedRun: WallRun = {
        from: cellAt(12, 5),
        heading: 'down',
        length: 8, // spans (12, 5) down to (12, 12), which includes (12, 10)
      };
      rider.ghostMemory?.memory.observe(rememberedRun, 1.5, match.tick / TICKS_PER_SECOND);

      rider.hear([stepEvent], match);
      expect(rider.perceptionMask?.[oldCell]).toBe(1);
    });

    it('on channel 1 (no ghost rule), createKidRider behaves exactly as before', () => {
      const match = createMatch({
        rules: variationRules(1),
        players: 2,
        switches: ['B', 'B'],
        target: CARTRIDGE_TARGET,
      });
      startMatch(match);

      const rider = createKidRider({
        kid: 'lou',
        seat: 0,
        mode: 'human',
        seed: 42,
      });

      rider.hear([{ type: 'round', round: 1 }], match);

      // ghostMemory remains inactive / null when ghostAfter is not configured
      expect(rider.ghostMemory).toBeNull();

      // Standard perception works without ghost memory
      const stepEvent: MatchEvent = {
        type: 'step',
        laid: [],
        erased: [],
        moves: [],
        period: 15,
      };
      rider.hear([stepEvent], match);
      expect(rider.reflex.log.length).toBeGreaterThan(0);
    });
  });
});
