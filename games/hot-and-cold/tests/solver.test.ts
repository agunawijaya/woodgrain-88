/**
 * Tests for the flag belief solver and information theoretic utility:
 * prior distribution, candidate narrowing, moving flag property tests,
 * contradiction resolution, and expected information heuristics.
 */
import { describe, expect, it } from 'vitest';
import { bearingTowards, kingDistance, squareAt, SQUARE_COUNT } from '../src/engine/grid.ts';
import { createMatch, IDLE, startMatch, stepMatch, type SeatInput } from '../src/engine/match.ts';
import { cartridgeRules } from '../src/engine/rules.ts';
import { believe, expectedInformation, type Fact, type FlagBelief } from '../src/engine/solver.ts';

describe('solver', () => {
  it('assigns 1/63 probability with no facts for still, bouncing, and wrapping flags', () => {
    for (const motion of ['still', 'bounce', 'wrap'] as const) {
      const belief = believe(motion, [], 0);
      expect(belief.consistent).toBe(true);
      expect(belief.candidates).toHaveLength(SQUARE_COUNT);
      expect(belief.stories).toBe(motion === 'still' ? 63 : 504);

      let totalChance = 0;
      for (let square = 0; square < SQUARE_COUNT; square++) {
        const p = belief.chance[square];
        expect(p).toBeDefined();
        if (p !== undefined) {
          expect(p).toBeCloseTo(1 / 63, 6);
          totalChance += p;
        }
      }
      expect(totalChance).toBeCloseTo(1.0, 6);
    }
  });

  it('narrows candidates based on distance, arrow, and bomb clues with chances summing to 1', () => {
    const probe = squareAt(4, 3);

    // Distance fact: only squares at king distance 2.
    const distanceFact: Fact = {
      square: probe,
      clue: { kind: 'distance', distance: 2 },
      flagMoves: 0,
    };
    const distBelief = believe('still', [distanceFact], 0);
    expect(distBelief.consistent).toBe(true);
    expect(distBelief.candidates.length).toBeGreaterThan(0);
    expect(distBelief.candidates).not.toContain(probe);

    let distSum = 0;
    for (const candidate of distBelief.candidates) {
      expect(kingDistance(probe, candidate)).toBe(2);
      distSum += distBelief.chance[candidate] ?? 0;
    }
    expect(distSum).toBeCloseTo(1.0, 6);

    // Arrow fact: only squares in the declared bearing.
    const arrowFact: Fact = {
      square: probe,
      clue: { kind: 'arrow', bearing: 'ne' },
      flagMoves: 0,
    };
    const arrowBelief = believe('still', [arrowFact], 0);
    expect(arrowBelief.consistent).toBe(true);
    expect(arrowBelief.candidates.length).toBeGreaterThan(0);
    expect(arrowBelief.candidates).not.toContain(probe);

    let arrowSum = 0;
    for (const candidate of arrowBelief.candidates) {
      expect(bearingTowards(probe, candidate)).toBe('ne');
      arrowSum += arrowBelief.chance[candidate] ?? 0;
    }
    expect(arrowSum).toBeCloseTo(1.0, 6);

    // Bomb fact: any miss excludes the checked square.
    const bombFact: Fact = {
      square: probe,
      clue: { kind: 'bomb' },
      flagMoves: 0,
    };
    const bombBelief = believe('still', [bombFact], 0);
    expect(bombBelief.consistent).toBe(true);
    expect(bombBelief.candidates).toHaveLength(62);
    expect(bombBelief.candidates).not.toContain(probe);

    let bombSum = 0;
    for (const candidate of bombBelief.candidates) {
      bombSum += bombBelief.chance[candidate] ?? 0;
    }
    expect(bombSum).toBeCloseTo(1.0, 6);
  });

  it('tracks true flag position across 50 seeded matches for moving flags', () => {
    // 25 seeds for variation 3 (bounce) and 25 seeds for variation 4 (wrap).
    const variations = [
      { varNum: 3, count: 25 },
      { varNum: 4, count: 25 },
    ];

    const press: SeatInput = { east: 0, south: 0, reveal: true };
    const stepEast: SeatInput = { east: 1, south: 0, reveal: false };

    for (const { varNum, count } of variations) {
      for (let s = 1; s <= count; s++) {
        const rules = cartridgeRules(varNum);
        const match = createMatch({
          rules,
          seats: 1,
          switches: ['B', 'B'],
          seed: `prop-solver-${varNum}-${s}`,
        });
        startMatch(match);

        // Perform several checks on different squares.
        for (let checkCycle = 0; checkCycle < 3; checkCycle++) {
          if (match.result) break;

          // Settle and press reveal to check current square.
          while (match.seats[0].settle > 0) {
            stepMatch(match, [IDLE, IDLE]);
          }
          // Press reveal.
          stepMatch(match, [press, IDLE]);
          // Release reveal.
          stepMatch(match, [IDLE, IDLE]);

          // Verify solver belief against all checks made so far.
          const facts: Fact[] = match.checks.map((c) => ({
            square: c.square,
            clue: c.clue,
            flagMoves: c.flagMoves,
          }));

          const belief = believe(match.rules.motion, facts, match.flagMoves);
          expect(belief.consistent).toBe(true);
          const currentFlag = match.flags[0];
          expect(currentFlag).toBeDefined();
          if (currentFlag !== undefined) {
            expect(belief.candidates).toContain(currentFlag);
          }

          // Step away to another square for next check.
          for (let stepTick = 0; stepTick < 16; stepTick++) {
            stepMatch(match, [stepEast, IDLE]);
          }
        }
      }
    }
  });

  it('returns consistent: false for contradictory facts, keeping stories breaking fewest facts', () => {
    // Two contradictory clues on square 0: distance 1 and distance 4 cannot both be true.
    const factA: Fact = {
      square: 0,
      clue: { kind: 'distance', distance: 1 },
      flagMoves: 0,
    };
    const factB: Fact = {
      square: 0,
      clue: { kind: 'distance', distance: 4 },
      flagMoves: 0,
    };

    const belief: FlagBelief = believe('still', [factA, factB], 0);

    expect(belief.consistent).toBe(false);
    expect(belief.stories).toBeGreaterThan(0);

    // Each retained candidate should satisfy either factA or factB (breaking only 1 fact).
    for (const candidate of belief.candidates) {
      const dist = kingDistance(0, candidate);
      expect(dist === 1 || dist === 4).toBe(true);
    }
  });

  it('evaluates expectedInformation as 0 for a known flag and ranks center higher than corner', () => {
    // When only 1 candidate remains, information value is 0.
    const flagFoundFact: Fact = {
      square: squareAt(2, 2),
      clue: { kind: 'flag' },
      flagMoves: 0,
    };
    const knownBelief = believe('still', [flagFoundFact], 0);
    expect(knownBelief.stories).toBe(1);
    expect(expectedInformation(knownBelief, squareAt(4, 3), null)).toBe(0);

    // With no clues yet, candidates are evenly spread across the field.
    const openBelief = believe('still', [], 0);
    const center = squareAt(4, 3);
    const corner = squareAt(0, 0);

    const centerEntropy = expectedInformation(openBelief, center, null);
    const cornerEntropy = expectedInformation(openBelief, corner, null);

    // A center square partitions candidates across eight diverse directions and multiple
    // distances, yielding more expected information than a corner.
    expect(centerEntropy).toBeGreaterThan(cornerEntropy);
  });
});
