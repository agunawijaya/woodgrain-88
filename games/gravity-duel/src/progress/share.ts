/**
 * Gravity Duel share line formatting: point emoji summaries (🟦 for player
 * points, 🟥 for rival points), duel share lines with player score first, and
 * solo docking summaries.
 */
import { MAX_SUMMARY_EMOJI } from '@woodgrain-88/kit';
import type { Seat } from '../engine/types.ts';

const PLAYER_EMOJI = '🟦';
const RIVAL_EMOJI = '🟥';

function symbolFor(seat: Seat, playerSeat: Seat): string {
  return seat === playerSeat ? PLAYER_EMOJI : RIVAL_EMOJI;
}

/** One symbol per point from the player's side; more than MAX_SUMMARY_EMOJI keeps the last ones after "…". */
export function pointSymbols(points: readonly Seat[], playerSeat: Seat): string {
  if (points.length <= MAX_SUMMARY_EMOJI) {
    return points.map((seat) => symbolFor(seat, playerSeat)).join('');
  }
  const tail = points.slice(-MAX_SUMMARY_EMOJI);
  const tailEmoji = tail.map((seat) => symbolFor(seat, playerSeat)).join('');
  return `…${tailEmoji}`;
}

/** "Gravity Duel · 🟦🟥🟦🟦 · 10–7", the player's score first. */
export function shareLine(points: readonly Seat[], playerSeat: Seat): string {
  let playerScore = 0;
  let rivalScore = 0;

  for (const seat of points) {
    if (seat === playerSeat) {
      playerScore += 1;
    } else {
      rivalScore += 1;
    }
  }

  const symbols = pointSymbols(points, playerSeat);
  return `Gravity Duel · ${symbols} · ${playerScore}–${rivalScore}`;
}

/** Solo docking: "Gravity Duel · 7 docks" (1 dock: "1 dock"). */
export function soloShareLine(docks: number): string {
  const label = docks === 1 ? '1 dock' : `${docks} docks`;
  return `Gravity Duel · ${label}`;
}
