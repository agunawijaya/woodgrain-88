/**
 * The combined score a timed round of two Kids should land in (balance target 4). The prompt asked
 * for 6–20; the owner raised it to 10–35 once the simulations showed what that cost. Under the 1977
 * rules two competent players score about 25–35 in a round, and only a ceasefire after every hit or
 * sloppy aim kept the Kids inside 6–20.
 */
export const SCORE_BAND = { low: 10, high: 35 } as const;

export function inScoreBand(total: number): boolean {
  return total >= SCORE_BAND.low && total <= SCORE_BAND.high;
}
