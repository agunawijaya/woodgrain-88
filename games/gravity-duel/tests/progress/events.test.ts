/**
 * Tests for Gravity Duel event schemas, patches, micro-challenges, and event
 * factory transformations.
 */
import { validateMicroChallenges, validatePatches } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../src/channels.ts';
import {
  dockEvent,
  GRAVITY_EVENTS,
  matchLostEvent,
  matchWonEvent,
  nearStarEvent,
  pointLostEvent,
  pointWonEvent,
  refuelEvent,
} from '../../src/progress/events.ts';
import { GRAVITY_MICRO_CHALLENGES } from '../../src/progress/micro.ts';
import { GRAVITY_PATCHES } from '../../src/progress/patches.ts';

describe('Gravity Duel event schemas and patch definitions', () => {
  it('declares every event and field read by patches', () => {
    // The collection plan allows one secret patch; prompt 05 asks for two (Slingshot and Hot
    // Landing), as prompt 04 did for Trailblaze. Everything else must validate.
    const problems = validatePatches(GRAVITY_PATCHES, GRAVITY_EVENTS);
    const nonSecretProblems = problems.filter((problem) => !problem.includes('secret patch'));
    expect(nonSecretProblems).toEqual([]);
  });

  it('declares every event and field read by micro-challenges', () => {
    const channelIds = CHANNELS.map((channel) => channel.def.id);
    const channelProblems = validateMicroChallenges(GRAVITY_MICRO_CHALLENGES, channelIds);
    expect(channelProblems).toEqual([]);

    const eventMap = new Map(GRAVITY_EVENTS.map((schema) => [schema.type, schema]));
    for (const challenge of GRAVITY_MICRO_CHALLENGES) {
      const schema = eventMap.get(challenge.pass.metric.event);
      expect(schema).toBeDefined();
      if (challenge.pass.metric.kind === 'max' || challenge.pass.metric.kind === 'sum') {
        expect(schema?.fields?.[challenge.pass.metric.field]).toBe('number');
      }
    }
  });

  it('declares all eight required patches with their designated tiers', () => {
    expect(GRAVITY_PATCHES).toHaveLength(8);
    const patchIds = GRAVITY_PATCHES.map((patch) => patch.id);
    expect(patchIds).toEqual([
      'first-contact',
      'soft-touch',
      'ghost-kill',
      'fuel-miser',
      'soft-dock',
      'lous-orbit',
      'slingshot',
      'hot-landing',
    ]);
  });
});

describe('Gravity Duel event factories', () => {
  it('converts radians into whole degrees and booleans into 1 or 0 for point-won', () => {
    const quarterTurn = Math.PI / 2;
    const event = pointWonEvent({
      bend: quarterTurn,
      afterCloak: true,
      frugal: false,
    });

    expect(event).toEqual({
      type: 'point-won',
      data: {
        bend: 90,
        afterCloak: 1,
        frugal: 0,
      },
    });

    const directShot = pointWonEvent({
      bend: 0,
      afterCloak: false,
      frugal: true,
    });

    expect(directShot).toEqual({
      type: 'point-won',
      data: {
        bend: 0,
        afterCloak: 0,
        frugal: 1,
      },
    });

    const negativeTurn = pointWonEvent({
      bend: -Math.PI / 4,
      afterCloak: true,
      frugal: true,
    });

    expect(negativeTurn.data?.bend).toBe(45);
  });

  it('produces an empty point-lost event', () => {
    expect(pointLostEvent()).toEqual({ type: 'point-lost' });
  });

  it('converts difficulty switch into 1 or 0 and retains dock count for dock', () => {
    const onA = dockEvent({ inMatch: 3, switchA: true });
    expect(onA).toEqual({
      type: 'dock',
      data: {
        inMatch: 3,
        switchA: 1,
      },
    });

    const onB = dockEvent({ inMatch: 1, switchA: false });
    expect(onB).toEqual({
      type: 'dock',
      data: {
        inMatch: 1,
        switchA: 0,
      },
    });
  });

  it('records duration in whole seconds for near-star', () => {
    expect(nearStarEvent(12)).toEqual({
      type: 'near-star',
      data: { seconds: 12 },
    });
  });

  it('records arrival speed for refuel', () => {
    expect(refuelEvent(56)).toEqual({
      type: 'refuel',
      data: { speed: 56 },
    });
  });

  it('converts booleans and maps facts for match-won', () => {
    const wonLou = matchWonEvent({
      duel: true,
      vsKid: true,
      fuelLeft: 7,
      louOrbit: true,
      kid: 'lou',
    });

    expect(wonLou).toEqual({
      type: 'match-won',
      data: {
        duel: 1,
        vsKid: 1,
        fuelLeft: 7,
        louOrbit: 1,
        kid: 'lou',
      },
    });

    const wonSolo = matchWonEvent({
      duel: false,
      vsKid: false,
      fuelLeft: 0,
      louOrbit: false,
      kid: '',
    });

    expect(wonSolo).toEqual({
      type: 'match-won',
      data: {
        duel: 0,
        vsKid: 0,
        fuelLeft: 0,
        louOrbit: 0,
        kid: '',
      },
    });
  });

  it('records the rival kid id for match-lost', () => {
    expect(matchLostEvent('dee')).toEqual({
      type: 'match-lost',
      data: { kid: 'dee' },
    });
    expect(matchLostEvent('')).toEqual({
      type: 'match-lost',
      data: { kid: '' },
    });
  });
});
