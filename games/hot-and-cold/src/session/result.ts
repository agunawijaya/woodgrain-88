/**
 * A finished match as the Den records it. Scores read "higher is better"
 * everywhere: flags found in a race, in turns, in hunt for hunt and against
 * the clock. The daily is the one hunt where fewer checks is the point, so
 * its score is points (a par less the checks taken) while its label and
 * share line say the checks plainly.
 */
import type { GameResult, KidId, Seat as PlayerSeat } from '@woodgrain-88/kit';
import type { ClueMode } from '../ai/kid.ts';
import type { Clue } from '../engine/board.ts';
import type { Match, MatchResult } from '../engine/match.ts';

/** The daily's par: a find in 4 checks scores 21 points. Every find scores at least 1. */
export const DAILY_PAR = 25;

const TRAIL_EMOJI: Readonly<Record<Clue['kind'], string>> = {
  distance: '🔢',
  arrow: '➡️',
  bomb: '💥',
  flag: '🚩',
};

/** The share line's trail: one symbol per check, the first twelve. */
export function emojiTrail(trail: readonly Clue['kind'][]): string {
  return trail
    .slice(0, 12)
    .map((kind) => TRAIL_EMOJI[kind])
    .join('');
}

export type SeatOutcome = 'win' | 'loss' | 'draw';

/** How the match went for seat 1; null when nobody else played or the match was cut short. */
export function seatOneOutcome(result: MatchResult | null, players: 1 | 2): SeatOutcome | null {
  if (!result || players === 1) return null;
  if (result.kind === 'first-to') return result.winner === 0 ? 'win' : 'loss';
  if (result.kind === 'hunts') {
    if (result.winner === null) return 'draw';
    return result.winner === 0 ? 'win' : 'loss';
  }
  return null;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export interface ResultInput {
  readonly match: Match;
  readonly result: MatchResult | null;
  readonly trail: readonly Clue['kind'][];
  readonly durationMs: number;
  /** The Kid in seat 2, or null for a person or nobody. */
  readonly kid: KidId | null;
  readonly clues: ClueMode;
  /** Two people at one machine: the result names a winning seat. */
  readonly versus: boolean;
}

export function buildResult(input: ResultInput): GameResult {
  const { match, result } = input;
  const me = match.seats[0];
  const bombs = input.trail.filter((kind) => kind === 'bomb').length;
  const details = [
    { label: 'Checks', value: String(me.checks) },
    { label: 'Bombs', value: String(bombs) },
    { label: 'Clues', value: input.clues === 'classic' ? 'Classic Memory' : 'Notebook' },
  ];
  const base = {
    durationMs: input.durationMs,
    emoji: emojiTrail(input.trail),
    presentation: 'game' as const,
    opponentKid: input.kid,
  };

  if (result?.kind === 'single') {
    const score = Math.max(1, DAILY_PAR - result.checks);
    return {
      ...base,
      score,
      scoreLabel: plural(result.checks, 'check'),
      won: true,
      details: [...details, { label: 'Points', value: `${score} (${DAILY_PAR} less your checks)` }],
    };
  }

  const outcome = seatOneOutcome(result, match.setup.seats);
  const flags = me.captures;
  if (result?.kind === 'first-to') {
    const [mine, theirs] = result.captures;
    return {
      ...base,
      score: mine,
      scoreLabel: `${mine}–${theirs}`,
      ...winner(outcome, input.versus),
      details,
    };
  }
  if (result?.kind === 'hunts' && outcome !== null) {
    const [mine, theirs] = result.checks;
    return {
      ...base,
      score: flags,
      scoreLabel: `${plural(mine, 'check')} to ${theirs}`,
      ...winner(outcome, input.versus),
      details: [...details, { label: 'Flags', value: String(flags) }],
    };
  }
  // Alone: hunting to the check limit, against the clock, or stopped by a micro-challenge's time.
  return {
    ...base,
    score: flags,
    scoreLabel: plural(flags, 'flag'),
    won: flags > 0,
    details: [...details, { label: 'Flags', value: String(flags) }],
  };
}

function winner(
  outcome: SeatOutcome | null,
  versus: boolean,
): { won: boolean; winnerSeat?: PlayerSeat | null } {
  const won = outcome === 'win';
  if (!versus) return { won };
  return { won, winnerSeat: outcome === 'draw' ? null : won ? 1 : 2 };
}
