/**
 * Tests for the Den's Block champion patch: status evaluation across Neighbourhood
 * Kid win records, earned timestamp derivation from the latest first win, gold thread
 * qualification from switch A victories, and jacket drawer patch production.
 */
import { KID_IDS, emptyDenLife, type KidId, type ProgressData } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_CHAMPION,
  DEN_OWNER,
  blockChampionStatus,
  denDrawer,
} from '../src/jacket/den-patches.ts';

function createEmptyProgress(): ProgressData {
  return {
    games: {},
    den: emptyDenLife(),
  };
}

describe('block champion patch and den drawer', () => {
  it('reports unearned and an empty drawer when not champion', () => {
    const progress = createEmptyProgress();

    // With 0 wins against any kid
    expect(blockChampionStatus(progress)).toEqual({
      earned: false,
      gold: false,
      earnedAt: null,
    });
    expect(denDrawer(progress)).toEqual([]);

    // With 5 of the 6 kids beaten
    const fiveKids = KID_IDS.slice(0, 5);
    for (const kid of fiveKids) {
      progress.den.kids[kid] = {
        wins: 1,
        losses: 0,
        draws: 0,
        winsOnA: 1,
        firstBeatenAt: '2026-10-20T10:00:00.000Z',
        firstBeatenOnAAt: '2026-10-20T10:00:00.000Z',
      };
    }

    expect(blockChampionStatus(progress)).toEqual({
      earned: false,
      gold: false,
      earnedAt: null,
    });
    expect(denDrawer(progress)).toEqual([]);
  });

  it('reports earned with the latest firstBeatenAt date, and gold only when all six kids are beaten on A', () => {
    const progress = createEmptyProgress();
    const timestamps: Record<KidId, string> = {
      pip: '2026-10-10T12:00:00.000Z',
      benny: '2026-10-12T14:00:00.000Z',
      dee: '2026-10-15T09:30:00.000Z',
      rosa: '2026-10-18T18:00:00.000Z',
      moss: '2026-10-22T11:15:00.000Z',
      lou: '2026-10-26T16:45:00.000Z',
    };

    // All six kids beaten, but lou has winsOnA = 0
    for (const kid of KID_IDS) {
      progress.den.kids[kid] = {
        wins: 1,
        losses: 0,
        draws: 0,
        winsOnA: kid !== 'lou' ? 1 : 0,
        firstBeatenAt: timestamps[kid],
        firstBeatenOnAAt: kid !== 'lou' ? timestamps[kid] : null,
      };
    }

    const statusNotGold = blockChampionStatus(progress);
    expect(statusNotGold.earned).toBe(true);
    expect(statusNotGold.earnedAt).toBe('2026-10-26T16:45:00.000Z');
    expect(statusNotGold.gold).toBe(false);

    // Lou beaten on switch A as well
    const louRecord = progress.den.kids.lou;
    if (louRecord) {
      louRecord.winsOnA = 1;
      louRecord.firstBeatenOnAAt = '2026-10-26T17:00:00.000Z';
    }

    const statusGold = blockChampionStatus(progress);
    expect(statusGold.earned).toBe(true);
    expect(statusGold.earnedAt).toBe('2026-10-26T16:45:00.000Z');
    expect(statusGold.gold).toBe(true);
  });

  it('produces a drawer patch entry for block-champion legend patch when champion', () => {
    const progress = createEmptyProgress();
    for (const kid of KID_IDS) {
      progress.den.kids[kid] = {
        wins: 1,
        losses: 0,
        draws: 0,
        winsOnA: 1,
        firstBeatenAt: '2026-10-20T10:00:00.000Z',
        firstBeatenOnAAt: '2026-10-20T10:00:00.000Z',
      };
    }

    const drawer = denDrawer(progress);
    expect(drawer).toHaveLength(1);
    expect(drawer[0]).toEqual({
      game: DEN_OWNER.id,
      patch: BLOCK_CHAMPION.id,
      tier: BLOCK_CHAMPION.tier,
      family: DEN_OWNER.family,
      gold: true,
      slot: DEN_OWNER.slot,
    });
  });
});
