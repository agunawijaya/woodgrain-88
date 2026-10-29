/**
 * Engine fuzzing tests for Trailblaze: executes 100,000 random stick streams
 * of 1,500 ticks each across variations 1–12, verifying engine invariants:
 * riders never occupy non-empty cells without crashing on that tick, and rider
 * scores strictly match awarded points.
 *
 * Runs only when asked:
 * `TRAILBLAZE_FUZZ=1 pnpm vitest run --project trailblaze tests/sim/fuzz.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CARTRIDGE_TARGET, createMatch, startMatch, stepMatch } from '../../src/engine/match.ts';
import { EMPTY, type Match, type MatchSetup, type Rider } from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';
import { createSeededStickStream } from '../engine/helpers/drivers.ts';

function rider(match: Readonly<Match>, seat: number): Rider {
  const item = match.riders[seat];
  if (!item) throw new Error(`Missing rider for seat ${seat}`);
  return item;
}

const TEN_MINUTES_MS = 600_000;
const STREAM_COUNT = 100_000;
const TICKS_PER_STREAM = 1_500;

describe.skipIf(!process.env.TRAILBLAZE_FUZZ)('trailblaze engine fuzzing', () => {
  it(
    '100,000 random stick streams preserve board and scoring invariants',
    () => {
      for (let s = 0; s < STREAM_COUNT; s++) {
        const variation = (s % 12) + 1;
        const rules = variationRules(variation);
        const setup: MatchSetup = {
          rules,
          players: 2,
          switches: ['B', 'B'],
          target: CARTRIDGE_TARGET,
        };

        const match = createMatch(setup);
        startMatch(match);

        const nextSticks = createSeededStickStream(s + 1);
        let awarded0 = 0;
        let awarded1 = 0;
        let streamValid = true;

        for (let t = 0; t < TICKS_PER_STREAM; t++) {
          const sticks = nextSticks();
          const events = stepMatch(match, sticks);

          let hasStep = false;
          let crashed0 = false;
          let crashed1 = false;

          for (const ev of events) {
            if (ev.type === 'point') {
              if (ev.seat === 0) awarded0++;
              else awarded1++;
            } else if (ev.type === 'step') {
              hasStep = true;
            } else if (ev.type === 'crash') {
              for (const crash of ev.crashes) {
                if (crash.seat === 0) crashed0 = true;
                else crashed1 = true;
              }
            }
          }

          if (rider(match, 0).score !== awarded0 || rider(match, 1).score !== awarded1) {
            streamValid = false;
            break;
          }

          if (hasStep) {
            if (!crashed0 && match.cells[rider(match, 0).cell] !== EMPTY) {
              streamValid = false;
              break;
            }
            if (!crashed1 && match.cells[rider(match, 1).cell] !== EMPTY) {
              streamValid = false;
              break;
            }
          }
        }

        expect(streamValid).toBe(true);
      }
    },
    TEN_MINUTES_MS,
  );
});
