/**
 * Tests for the UTC daily clock, daily seed derivation, Power Cycle selection
 * and share line formatting.
 */
import { describe, expect, it } from 'vitest';
import type { ChannelDef } from '../src/channels.ts';
import {
  DAILY_EPOCH,
  dailyChannel,
  dailyNumber,
  dailySeed,
  dailyShareLine,
  isSameUtcDay,
  powerCycleOfTheDay,
  recordDailyRun,
  utcDateKey,
  utcDayIndex,
} from '../src/daily.ts';
import { hashSeed } from '../src/rng.ts';
import type { DailyRunData } from '../src/store/types.ts';

interface TestGame {
  id: string;
  status: 'playable' | 'coming-soon';
}

describe('daily clock', () => {
  it('computes UTC day index and ISO date key from UTC milliseconds', () => {
    expect(utcDayIndex(new Date('1970-01-01T00:00:00.000Z'))).toBe(0);
    expect(utcDayIndex(new Date('1970-01-01T23:59:59.999Z'))).toBe(0);
    expect(utcDayIndex(new Date('1970-01-02T00:00:00.000Z'))).toBe(1);

    expect(utcDateKey(new Date('2026-10-25T00:00:00.000Z'))).toBe('2026-10-25');
    expect(utcDateKey(new Date('2026-10-25T23:59:59.999Z'))).toBe('2026-10-25');
  });

  it('numbers the epoch day #1, the day before #0, and steps at midnight UTC', () => {
    expect(DAILY_EPOCH).toBe('2026-10-25');
    expect(dailyNumber(new Date('2026-10-24T00:00:00.000Z'))).toBe(0);
    expect(dailyNumber(new Date('2026-10-24T23:59:59.000Z'))).toBe(0);
    expect(dailyNumber(new Date('2026-10-25T00:00:00.000Z'))).toBe(1);
    expect(dailyNumber(new Date('2026-10-25T23:59:59.000Z'))).toBe(1);
    expect(dailyNumber(new Date('2026-10-26T00:00:00.000Z'))).toBe(2);

    // Non-UTC offsets that fall inside the same UTC day share the same daily number.
    expect(dailyNumber(new Date('2026-10-25T20:00:00.000-03:00'))).toBe(1);
    expect(dailyNumber(new Date('2026-10-25T02:00:00.000+05:00'))).toBe(0);
  });

  it('steps cleanly across a year boundary and a leap day', () => {
    const dec31 = dailyNumber(new Date('2026-12-31T12:00:00.000Z'));
    const jan01 = dailyNumber(new Date('2027-01-01T12:00:00.000Z'));
    expect(jan01 - dec31).toBe(1);

    const feb28 = dailyNumber(new Date('2028-02-28T12:00:00.000Z'));
    const feb29 = dailyNumber(new Date('2028-02-29T12:00:00.000Z'));
    const mar01 = dailyNumber(new Date('2028-03-01T12:00:00.000Z'));
    expect(feb29 - feb28).toBe(1);
    expect(mar01 - feb29).toBe(1);
  });

  it('derives daily seeds with hashSeed from the game id and daily number', () => {
    const dayOneMorning = new Date('2026-10-25T08:00:00.000Z');
    const dayOneNight = new Date('2026-10-25T22:45:00.000Z');
    const dayTwo = new Date('2026-10-26T08:00:00.000Z');

    expect(dailySeed('tank-duel', dayOneMorning)).toBe(hashSeed('daily/tank-duel/1'));
    expect(dailySeed('tank-duel', dayOneNight)).toBe(dailySeed('tank-duel', dayOneMorning));
    expect(dailySeed('tank-duel', dayTwo)).toBe(hashSeed('daily/tank-duel/2'));
    expect(dailySeed('tank-duel', dayOneMorning)).not.toBe(dailySeed('sky-duel', dayOneMorning));
  });

  it('returns null from powerCycleOfTheDay when no games are playable', () => {
    const date = new Date('2026-10-25T12:00:00.000Z');
    expect(powerCycleOfTheDay([], date)).toBeNull();

    const comingSoonOnly: TestGame[] = [
      { id: 'tank-duel', status: 'coming-soon' },
      { id: 'sky-duel', status: 'coming-soon' },
    ];
    expect(powerCycleOfTheDay(comingSoonOnly, date)).toBeNull();
  });

  it('picks only playable games and stays stable when the input list is shuffled', () => {
    const ordered: TestGame[] = [
      { id: 'aqua-plane', status: 'playable' },
      { id: 'burn-rubber', status: 'coming-soon' },
      { id: 'green-nine', status: 'playable' },
      { id: 'tank-duel', status: 'playable' },
      { id: 'sky-duel', status: 'coming-soon' },
      { id: 'tower-stack', status: 'playable' },
    ];
    const shuffled: TestGame[] = [
      { id: 'tower-stack', status: 'playable' },
      { id: 'sky-duel', status: 'coming-soon' },
      { id: 'green-nine', status: 'playable' },
      { id: 'aqua-plane', status: 'playable' },
      { id: 'tank-duel', status: 'playable' },
      { id: 'burn-rubber', status: 'coming-soon' },
    ];

    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(Date.UTC(2026, 9, 25 + offset, 12, 0, 0));
      const pickA = powerCycleOfTheDay(ordered, date);
      const pickB = powerCycleOfTheDay(shuffled, date);
      expect(pickA).not.toBeNull();
      expect(pickA?.status).toBe('playable');
      expect(pickB?.id).toBe(pickA?.id);
    }
  });

  it('avoids repeating yesterday when today hashes to the same candidate and >1 game is playable', () => {
    const candidates: TestGame[] = [
      { id: 'aqua-plane', status: 'playable' },
      { id: 'green-nine', status: 'playable' },
      { id: 'tank-duel', status: 'playable' },
    ];
    const count = candidates.length;

    let collisionDay: number | null = null;
    for (let day = 1; day <= 200; day++) {
      const rawPrev2 = hashSeed(`power-cycle/${day - 2}`) % count;
      const rawPrev1 = hashSeed(`power-cycle/${day - 1}`) % count;
      const rawToday = hashSeed(`power-cycle/${day}`) % count;
      if (rawPrev2 !== rawPrev1 && rawToday === rawPrev1) {
        collisionDay = day;
        break;
      }
    }
    expect(collisionDay).not.toBeNull();

    const targetDay = collisionDay ?? 1;
    const yesterday = new Date(Date.UTC(2026, 9, 24 + targetDay - 1, 12, 0, 0));
    const today = new Date(Date.UTC(2026, 9, 24 + targetDay, 12, 0, 0));
    const rawIndex = hashSeed(`power-cycle/${targetDay}`) % count;
    const expectedShifted = candidates[(rawIndex + 1) % count];

    const yesterdayPick = powerCycleOfTheDay(candidates, yesterday);
    const todayPick = powerCycleOfTheDay(candidates, today);
    expect(yesterdayPick?.id).toBe(candidates[rawIndex]?.id);
    expect(todayPick?.id).toBe(expectedShifted?.id);
    expect(todayPick?.id).not.toBe(yesterdayPick?.id);

    // With a single playable game, it must still return that game.
    const single: TestGame[] = [{ id: 'tank-duel', status: 'playable' }];
    expect(powerCycleOfTheDay(single, yesterday)?.id).toBe('tank-duel');
    expect(powerCycleOfTheDay(single, today)?.id).toBe('tank-duel');
  });

  it('checks whether an ISO timestamp falls on the same UTC day as now', () => {
    const now = new Date('2026-10-25T18:30:00.000Z');
    expect(isSameUtcDay(null, now)).toBe(false);
    expect(isSameUtcDay('2026-10-25T00:00:00.000Z', now)).toBe(true);
    expect(isSameUtcDay('2026-10-25T23:59:59.999Z', now)).toBe(true);
    expect(isSameUtcDay('2026-10-24T23:59:59.999Z', now)).toBe(false);
    expect(isSameUtcDay('2026-10-26T00:00:00.000Z', now)).toBe(false);
  });

  it('picks daily channel deterministically, varies across days, and handles single-channel games', () => {
    const channels: ChannelDef[] = [
      { id: 'ch-1', kind: 'original', title: 'One', description: 'One' },
      { id: 'ch-2', kind: 'original', title: 'Two', description: 'Two' },
      { id: 'ch-3', kind: 'original', title: 'Three', description: 'Three' },
      { id: 'ch-4', kind: 'original', title: 'Four', description: 'Four' },
      { id: 'ch-5', kind: 'original', title: 'Five', description: 'Five' },
      { id: 'ch-6', kind: 'remix', title: 'Six', description: 'Six', unlockedBy: 'patch-1' },
    ];
    const game = { id: 'tank-duel', channels };

    // Deterministic per game and day
    const morning = new Date('2026-10-25T08:00:00.000Z');
    const night = new Date('2026-10-25T22:00:00.000Z');
    expect(dailyChannel(game, morning).id).toBe(dailyChannel(game, night).id);

    // Differs across days (over 30 days at least 3 distinct channels for a 6-channel game)
    const seen = new Set<string>();
    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(Date.UTC(2026, 9, 25 + offset, 12, 0, 0));
      seen.add(dailyChannel(game, date).id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);

    // Always returns the only channel of a one-channel game
    const singleGame = {
      id: 'solo-game',
      channels: channels.slice(0, 1),
    };
    for (let offset = 0; offset < 10; offset++) {
      const date = new Date(Date.UTC(2026, 9, 25 + offset, 12, 0, 0));
      expect(dailyChannel(singleGame, date).id).toBe('ch-1');
    }
  });

  it('keeps only the first run of a day for daily score, and counts again the next day', () => {
    const dailyMap: Record<string, Record<string, DailyRunData>> = {};
    const dayOne = new Date('2026-10-25T10:00:00.000Z');
    const run1: DailyRunData = {
      score: 100,
      scoreLabel: '100 pts',
      emoji: '🟩🟩🟩🟩',
      channel: 'ch-1',
      at: '2026-10-25T10:00:00.000Z',
    };

    // First run counts
    const firstResult = recordDailyRun(dailyMap, dayOne, 'tank-duel', run1);
    expect(firstResult.counted).toBe(true);
    expect(firstResult.daily['2026-10-25']?.['tank-duel']).toEqual(run1);
    expect(dailyMap).toEqual({}); // input not mutated

    // Second run the same UTC day does not count and does not replace the first
    const dayOneLater = new Date('2026-10-25T18:00:00.000Z');
    const run2: DailyRunData = {
      score: 200,
      scoreLabel: '200 pts',
      emoji: '🟩🟩🟩🟩',
      channel: 'ch-1',
      at: '2026-10-25T18:00:00.000Z',
    };
    const secondResult = recordDailyRun(firstResult.daily, dayOneLater, 'tank-duel', run2);
    expect(secondResult.counted).toBe(false);
    expect(secondResult.daily['2026-10-25']?.['tank-duel']).toEqual(run1);

    // The next day counts again
    const dayTwo = new Date('2026-10-26T09:00:00.000Z');
    const run3: DailyRunData = {
      score: 300,
      scoreLabel: '300 pts',
      emoji: '🟩🟩🟩🟩',
      channel: 'ch-2',
      at: '2026-10-26T09:00:00.000Z',
    };
    const thirdResult = recordDailyRun(secondResult.daily, dayTwo, 'tank-duel', run3);
    expect(thirdResult.counted).toBe(true);
    expect(thirdResult.daily['2026-10-25']?.['tank-duel']).toEqual(run1);
    expect(thirdResult.daily['2026-10-26']?.['tank-duel']).toEqual(run3);
  });

  it('formats dailyShareLine for all-present, minimal and invalid-emoji inputs', () => {
    const date = new Date('2026-11-05T15:00:00.000Z'); // Daily #12

    // All present
    const allPresent = dailyShareLine({
      title: 'Tank Duel',
      date,
      channelNumber: 7,
      score: '3–1',
      emoji: '🟩🟩🟥🟩',
      name: 'Robin',
    });
    expect(allPresent).toBe("Woodgrain '88 #12 · Tank Duel ch.7 · 3–1 · 🟩🟩🟥🟩 · Robin");

    // Minimal
    const minimal = dailyShareLine({
      title: 'Tank Duel',
      date,
    });
    expect(minimal).toBe("Woodgrain '88 #12 · Tank Duel");

    // Invalid emoji is left out
    const invalidEmoji = dailyShareLine({
      title: 'Tank Duel',
      date,
      channelNumber: 7,
      score: '3–1',
      emoji: 'not an emoji',
      name: 'Robin',
    });
    expect(invalidEmoji).toBe("Woodgrain '88 #12 · Tank Duel ch.7 · 3–1 · Robin");
  });
});

describe('dailyChannel and Remix channels', () => {
  it('only ever picks an original channel, which every player has open', () => {
    const game = {
      id: 'mixed-game',
      channels: [
        {
          id: 'classic',
          kind: 'original' as const,
          title: 'Classic',
          description: 'The original.',
        },
        {
          id: 'remix-a',
          kind: 'remix' as const,
          title: 'Remix A',
          description: 'A remix.',
          unlockedBy: 'club',
        },
        {
          id: 'remix-b',
          kind: 'remix' as const,
          title: 'Remix B',
          description: 'A remix.',
          unlockedBy: 'pro',
        },
      ],
    };
    for (let offset = 0; offset < 60; offset++) {
      expect(dailyChannel(game, new Date(Date.UTC(2026, 9, 25 + offset, 12))).id).toBe('classic');
    }
  });
});
