/**
 * The measurements behind Hot & Cold's balance notes, shared by the
 * simulation script and the balance tests so the numbers in NOTES.md and the
 * locked targets come from the same code:
 *
 * - `solveField`: how many checks the exact solver needs on a field, with no walking.
 * - `huntChecks`: how many checks a Kid (or the perfect hunter) needs for one hunt, walking.
 * - `duel`: how often one Kid beats another over many seeded matches.
 */
import { createRng, type KidId, type MemoryMode } from '@woodgrain-88/kit';
import { createKidPlayer, type ClueMode } from '../ai/kid.ts';
import { PERFECT_STYLE } from '../ai/styles.ts';
import { clueAt, generateBoard } from '../engine/board.ts';
import { HEADINGS, stepFlag } from '../engine/flag.ts';
import { TICK_SECONDS, type FlagMotion, type Rules } from '../engine/rules.ts';
import { trackStories } from '../engine/solver.ts';
import { playMatch } from './play.ts';

/**
 * Hunts a fresh field with perfect knowledge and no walking: always check the likeliest square.
 * Returns the checks it took, or -1 if the true flag ever fell out of the candidates.
 */
export function solveField(seed: string, motion: FlagMotion): number {
  const rng = createRng(seed);
  const board = generateBoard(rng);
  let flag = board.flags[0] ?? 0;
  let heading = rng.pick(HEADINGS);
  const tracker = trackStories(motion);
  for (let moves = 0, checks = 1; checks <= 200; checks++) {
    const belief = tracker.believe(moves);
    if (!belief.candidates.includes(flag)) return -1;
    let pick = belief.candidates[0] ?? 0;
    for (const square of belief.candidates) {
      if ((belief.chance[square] ?? 0) > (belief.chance[pick] ?? 0)) pick = square;
    }
    const clue = clueAt(board, pick, [flag]);
    if (clue.kind === 'flag') return checks;
    tracker.add({ square: pick, clue, flagMoves: moves });
    const next = stepFlag(flag, heading, motion);
    flag = next.square;
    heading = next.heading;
    if (motion !== 'still') moves++;
  }
  return 200;
}

export interface Hunter {
  readonly kid: KidId;
  readonly memory: MemoryMode;
  readonly clues: ClueMode;
  /** Hunt with the perfect hunter's style instead of the Kid's own. */
  readonly perfect?: boolean;
}

/** Checks one hunter needs to find the flag once, walking and checking at a person's pace. */
export function huntChecks(rules: Rules, seed: string, hunter: Hunter): number {
  const player = createKidPlayer({
    kid: hunter.kid,
    seat: 0,
    memory: hunter.memory,
    clues: hunter.clues,
    seed: `${seed}/kid`,
    ...(hunter.perfect ? { style: PERFECT_STYLE } : {}),
  });
  const single = { ...rules, singleHunt: true };
  const played = playMatch({ rules: single, seats: 1, switches: ['B', 'B'], seed }, [player, null]);
  return played.result?.kind === 'single' ? played.result.checks : Infinity;
}

export interface DuelRecord {
  readonly firstWins: number;
  readonly draws: number;
  readonly matches: number;
  /** Average length of a match in minutes of play. */
  readonly minutes: number;
}

/** Plays `first` against `second`, alternating seats so neither always starts top left. */
export function duel(
  rules: Rules,
  first: KidId,
  second: KidId,
  clues: ClueMode,
  matches: number,
  salt = '',
): DuelRecord {
  let firstWins = 0;
  let draws = 0;
  let ticks = 0;
  for (let match = 0; match < matches; match++) {
    const swap = match % 2 === 1;
    const seed = `duel${salt}/${clues}/${first}-${second}/${match}`;
    const seated = (seat: 0 | 1, kid: KidId) =>
      createKidPlayer({ kid, seat, memory: 'human', clues, seed: `${seed}/${seat}` });
    const players = [seated(0, swap ? second : first), seated(1, swap ? first : second)] as const;
    const played = playMatch({ rules, seats: 2, switches: ['B', 'B'], seed }, players);
    ticks += played.ticks;
    const result = played.result;
    const winner = result?.kind === 'first-to' || result?.kind === 'hunts' ? result.winner : null;
    if (winner === null) draws++;
    else if ((winner === 0) !== swap) firstWins++;
  }
  return { firstWins, draws, matches, minutes: (ticks * TICK_SECONDS) / matches / 60 };
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}
