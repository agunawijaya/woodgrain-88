/**
 * The practice aim line: where a shell fired now along the vehicle's heading
 * would go, bounces and all, traced with the same wall geometry the engine
 * uses. Only the practice table and the tutorial draw it; a real match never
 * does.
 */
import { shellRulesFor, type MatchWorld } from '../engine/match.ts';
import type { MatchState, Side } from '../engine/types.ts';
import { headingVector, type Vec2 } from '../engine/vec.ts';
import { muzzlePoint } from '../engine/vehicles.ts';
import { traceShot } from '../engine/walls.ts';

/** The line shows two bounces at most: enough to plan a bank, not enough to solve it for you. */
const SHOWN_BOUNCES = 2;
/** How far along the shell's flight the line reaches, as a share of one lifetime's distance. */
const SHOWN_SHARE = 0.75;

/** The predicted path from the muzzle, or null when the side already has a shell in the air. */
export function predictedShot(state: MatchState, side: Side, world: MatchWorld): Vec2[] | null {
  if (state.shells[side] !== null || state.channel.field.kind === 'sky') return null;
  const leader = state.vehicles.find((vehicle) => vehicle.side === side && vehicle.slot === 0);
  if (!leader) return null;
  const rules = shellRulesFor(state.channel, state.options.handicap[side]);
  const trace = traceShot(
    muzzlePoint(leader),
    headingVector(leader.heading),
    rules.lifetime * rules.speed * SHOWN_SHARE,
    world.edges,
    { bounce: rules.walls === 'bounce', maxHits: SHOWN_BOUNCES },
  );
  return [...trace.points];
}
