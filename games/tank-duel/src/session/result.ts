/**
 * A finished match as the kit's `GameResult`: seat 1's points as the score,
 * who won, a few lines for the results card, and one square per hit for the
 * share line.
 */
import type { GameResult, KidId, Seat } from '@woodgrain-88/kit';
import type { ChannelRules, MatchEvent, MatchState, ScoringRule, Side } from '../engine/types.ts';

export interface SeatSummary {
  readonly name: string;
  /** The Kid in this seat, or null for a person. */
  readonly kid: KidId | null;
}

export interface ScoredPoint {
  readonly side: Side;
  readonly points: number;
}

export interface MatchSummary {
  /** The match's last state; `over` is true. */
  readonly final: MatchState;
  readonly seats: readonly [SeatSummary, SeatSummary];
  /** Every scoring hit in order. */
  readonly points: readonly ScoredPoint[];
  readonly durationMs: number;
  /** Most bounces on one of seat 1's scoring hits this match (0 when none banked). */
  readonly bestBank: number;
}

/** The points among some engine events, in order: hits, and own ricochets the other side gains by. */
export function scoredPoints(events: readonly MatchEvent[]): ScoredPoint[] {
  const points: ScoredPoint[] = [];
  for (const event of events) {
    if (event.kind === 'hit') {
      points.push({ side: event.shooter, points: event.points });
    } else if (event.kind === 'own-hit') {
      points.push({ side: (1 - event.side) as Side, points: 1 });
    }
  }
  return points;
}

/** "7–4", seat 1 first. */
export function scoreLabel(scores: readonly [number, number]): string {
  return `${scores[0]}–${scores[1]}`;
}

const SEAT_ONE_SQUARE = '🟩';
const SEAT_TWO_SQUARE = '🟥';
const MAX_EMOJI_POINTS = 12;

/** One square per hit (🟩 seat 1, 🟥 seat 2); a long match keeps its last 12, where it was decided. */
export function emojiLine(points: readonly ScoredPoint[]): string {
  return points
    .slice(-MAX_EMOJI_POINTS)
    .map((point) => (point.side === 0 ? SEAT_ONE_SQUARE : SEAT_TWO_SQUARE))
    .join('');
}

function describeRule(channel: ChannelRules, scoring: ScoringRule): string {
  if (channel.remix?.kind === 'last-tank') {
    return `First to ${channel.remix.roundsToWin} rounds`;
  }
  if (scoring === 'first-to-10') {
    return 'First to 10';
  }
  return 'Timed round';
}

export function buildResult(summary: MatchSummary): GameResult {
  const { final, seats, points, durationMs, bestBank } = summary;
  const score = final.scores[0];
  const label = scoreLabel(final.scores);

  const won = final.winner === 0;
  const winnerSeat: Seat | null = final.winner === 0 ? 1 : final.winner === 1 ? 2 : null;

  const opponentSeat = seats[1];
  const details: { label: string; value: string }[] = [
    { label: 'Opponent', value: opponentSeat.name },
    { label: 'Rule', value: describeRule(final.channel, final.options.scoring) },
  ];

  if (bestBank > 0) {
    details.push({ label: 'Best bank', value: `×${bestBank}` });
  }

  const channelNumber = String(final.channel.number).padStart(2, '0');
  details.push({
    label: 'Channel',
    value: `CH ${channelNumber} · ${final.channel.title}`,
  });

  const emoji = emojiLine(points);

  return {
    score,
    scoreLabel: label,
    durationMs: Math.round(durationMs),
    won,
    winnerSeat,
    details,
    ...(emoji.length > 0 ? { emoji } : {}),
    // The rival is picked in the game's own menu, so the Den learns it from the result.
    opponentKid: seats[1].kid,
    presentation: 'game',
  };
}
