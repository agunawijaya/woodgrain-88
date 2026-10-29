/**
 * Trailblaze share formatting: point emoji summaries (🟦 for player wins,
 * 🟥 for rival wins, ⬜ for mutual crashes) and standard share lines with
 * player score first.
 */
import { MAX_SUMMARY_EMOJI } from '@woodgrain-88/kit';
import type { Seat } from '../engine/types.ts';
import type { PointTaker } from '../session/match-session.ts';

const PLAYER_EMOJI = '🟦';
const RIVAL_EMOJI = '🟥';
const BOTH_EMOJI = '⬜';

function symbolFor(point: PointTaker, playerSeat: Seat): string {
  if (point === playerSeat) return PLAYER_EMOJI;
  if (point === 'both') return BOTH_EMOJI;
  return RIVAL_EMOJI;
}

/** One symbol per point from the player's side: 🟦 the player, 🟥 the rival, ⬜ both crashed. */
export function pointSymbols(points: readonly PointTaker[], playerSeat: Seat): string {
  if (points.length <= MAX_SUMMARY_EMOJI) {
    return points.map((p) => symbolFor(p, playerSeat)).join('');
  }
  const tail = points.slice(-MAX_SUMMARY_EMOJI);
  const tailEmoji = tail.map((p) => symbolFor(p, playerSeat)).join('');
  return `…${tailEmoji}`;
}

/** `Trailblaze · 🟦🟦🟥⬜🟦 · 10–6`, the player's score first. The Hall adds the collection prefix. */
export function shareLine(points: readonly PointTaker[], playerSeat: Seat): string {
  let playerScore = 0;
  let rivalScore = 0;

  for (const point of points) {
    if (point === playerSeat) {
      playerScore += 1;
    } else if (point === 'both') {
      playerScore += 1;
      rivalScore += 1;
    } else {
      rivalScore += 1;
    }
  }

  const symbols = pointSymbols(points, playerSeat);
  return `Trailblaze · ${symbols} · ${playerScore}–${rivalScore}`;
}
