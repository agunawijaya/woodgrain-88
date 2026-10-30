import { KID_IDS, type KidId } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createKidPilot, type KidPilot } from '../../src/ai/pilot.ts';
import { createMatch, stepMatch } from '../../src/engine/match.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  IDLE,
  SUBPIXELS,
  type Controls,
  type Match,
  type Seat,
} from '../../src/engine/types.ts';
import { variation } from '../../src/engine/variations.ts';

function matchOn(number: number, seed = 1): Match {
  return createMatch({
    rules: variation(number),
    switches: ['B', 'B'],
    target: 10,
    clockTicks: CARTRIDGE_MATCH_TICKS,
    seed,
  });
}

/** Runs `ticks` with the given pilots (null seats sit idle) and returns every control used. */
function fly(
  match: Match,
  pilots: readonly (KidPilot | null)[],
  ticks: number,
): [Controls, Controls][] {
  const used: [Controls, Controls][] = [];
  for (let tick = 0; tick < ticks && match.phase === 'playing'; tick++) {
    for (const pilot of pilots) pilot?.hear(match.events, match);
    const controls = [0, 1].map((seat) => pilots[seat]?.controls(match) ?? IDLE) as [
      Controls,
      Controls,
    ];
    used.push(controls);
    stepMatch(match, controls);
  }
  return used;
}

function pilot(kid: KidId, seat: Seat, seed = 'test', mode: 'human' | 'sharp' = 'human') {
  return createKidPilot({ kid, seat, mode, seed });
}

describe('Kid pilots', () => {
  it('fly the same way for the same seed', () => {
    const first = fly(matchOn(4), [pilot('rosa', 0), pilot('moss', 1)], 1500);
    const second = fly(matchOn(4), [pilot('rosa', 0), pilot('moss', 1)], 1500);
    expect(second).toEqual(first);
  });

  it('every Kid gets a duel going: turns, thrusts and fires within a minute', () => {
    for (const kid of KID_IDS) {
      const used = fly(matchOn(1), [pilot(kid, 0), pilot('lou', 1)], 3000).map(([own]) => own);
      expect(used.some((controls) => controls.left || controls.right)).toBe(true);
      expect(used.some((controls) => controls.thrust)).toBe(true);
      expect(used.some((controls) => controls.fire)).toBe(true);
    }
  });

  it('a careful Kid burns clear of the star it is falling into', () => {
    const match = matchOn(4);
    const ship = match.ships[0];
    // Close to the star and drifting at it.
    ship.x = 60 * SUBPIXELS;
    ship.y = 45 * SUBPIXELS;
    ship.vx = 6 * 256;
    const lou = pilot('lou', 0);
    fly(match, [lou, null], 80);
    expect(lou.moments.some((moment) => moment.intent === 'escape')).toBe(true);
  });

  it('records what it planned, with the bars as it believes them', () => {
    const lou = pilot('lou', 0);
    fly(matchOn(1), [lou, pilot('pip', 1)], 600);
    const last = lou.moments.at(-1);
    expect(last).toBeDefined();
    expect(last?.beliefs.fuel).toBeGreaterThanOrEqual(0);
    expect(last?.beliefs.fuel).toBeLessThanOrEqual(8);
  });

  it('sharp Kids never fumble', () => {
    const sharp = pilot('pip', 0, 'sharp-test', 'sharp');
    fly(matchOn(1), [sharp, pilot('dee', 1)], 3000);
    const slips = sharp.reflex.log.filter((event) => event.kind.startsWith('slipped'));
    expect(slips).toHaveLength(0);
  });

  it('docks in solo docking on switch B', () => {
    const match = matchOn(14);
    const lou = pilot('lou', 0);
    fly(match, [lou, null], 6000);
    expect(match.ships[0].score).toBeGreaterThan(0);
  });
});
