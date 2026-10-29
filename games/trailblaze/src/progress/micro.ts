/**
 * Trailblaze micro-challenges for the Power Cycle Run: 45 seconds each.
 * Two test high-speed survival and wrapping edges; two test boxing Dee in
 * and filling open cells in solo play.
 */
import type { MicroChallengeDef } from '@woodgrain-88/kit';

export const TRAILBLAZE_MICRO_CHALLENGES: readonly MicroChallengeDef[] = [
  {
    id: 'top-speed-30',
    channel: 'game-3',
    title: 'Hold on at top speed',
    goal: 'Ride 30 seconds at top speed',
    seconds: 45,
    pass: { metric: { kind: 'max', event: 'ride', field: 'topSpeedSeconds' }, target: 30 },
  },
  {
    id: 'trap-dee',
    channel: 'game-1',
    title: 'Box Dee in',
    goal: 'Shut Dee in a pocket once',
    seconds: 45,
    pass: { metric: { kind: 'sum', event: 'point-won', field: 'trappedDee' }, target: 1 },
  },
  {
    id: 'fill-300',
    channel: 'game-1',
    title: 'Fill 300 cells',
    goal: 'Lay 300 cells riding alone',
    seconds: 45,
    pass: { metric: { kind: 'sum', event: 'solo-cells', field: 'cells' }, target: 300 },
  },
  {
    id: 'wrap-point',
    channel: 'game-8',
    title: 'Win at the edges',
    goal: 'Win a point in wraparound',
    seconds: 45,
    pass: { metric: { kind: 'sum', event: 'point-won', field: 'wraparound' }, target: 1 },
  },
];
