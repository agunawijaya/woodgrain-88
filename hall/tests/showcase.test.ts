/**
 * Tests for the showcase profile generator: determinism, schema sanitization,
 * growth item evaluation, counter lamps, ladder progress, and query parsing.
 */
import {
  blockLadder,
  isoWeekKey,
  sanitize,
  streakView,
  utcDateKey,
  type SchemaContext,
} from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { counterPlaces, placeFinished } from '../src/data/cycle.ts';
import { createRegistry } from '../src/data/registry.ts';
import { earnedGrowth, growthFacts } from '../src/den/growth.ts';
import {
  parseShowcaseLevel,
  showcaseProfile,
  type ShowcaseLevel,
  type ShowcaseProfile,
} from '../src/dev/showcase.ts';

const registry = createRegistry();
const manifests = registry.manifests;
const fixedNow = new Date('2026-10-26T12:00:00.000Z');

function createSchemaContext(now: Date): SchemaContext {
  return {
    now: () => now,
    newId: () => 'test-id',
  };
}

function evaluateShowcaseFacts(profile: ShowcaseProfile) {
  const patchTiers = new Map<string, { club: string[]; legend: string[] }>();
  for (const [gameId, defs] of Object.entries(profile.patches)) {
    const club = defs.filter((d) => d.tier === 'club').map((d) => d.id);
    const legend = defs.filter((d) => d.tier === 'legend').map((d) => d.id);
    patchTiers.set(gameId, { club, legend });
  }

  const places = counterPlaces(manifests);
  const litPlaces = places.filter((place) => placeFinished(place, profile.progress));
  const allLampsLit = litPlaces.length === places.length;

  const facts = growthFacts({
    manifests,
    patchTiers,
    progress: profile.progress,
    allLampsLit,
    playable: () => true,
  });

  const growth = earnedGrowth(facts);
  return { places, litPlaces, facts, growth };
}

describe('showcase profile generator', () => {
  const levels: ShowcaseLevel[] = ['full', 'mid', 'new'];

  it.each(levels)('survives schema sanitization unchanged for level %s', (level) => {
    const profile = showcaseProfile(level, manifests, fixedNow);
    const context = createSchemaContext(fixedNow);

    const sanitizedProgress = sanitize('progress', profile.progress, context);
    expect(sanitizedProgress).toEqual(profile.progress);

    const sanitizedStats = sanitize('stats', profile.stats, context);
    expect(sanitizedStats).toEqual(profile.stats);

    const sanitizedRecords = sanitize('records', profile.records, context);
    expect(sanitizedRecords).toEqual(profile.records);
  });

  it('satisfies all rules for the full showcase level', () => {
    const profile = showcaseProfile('full', manifests, fixedNow);
    expect(profile.displayName).toBe('Robin');

    // 1. Every game's club patch earned
    for (const manifest of manifests) {
      const clubPatch = profile.progress.games[manifest.id]?.patches['club-1'];
      expect(clubPatch?.earnedAt).toBeTruthy();
    }

    // 2. Pro earned in at least 20 games
    const proGames = manifests.filter(
      (m) => profile.progress.games[m.id]?.patches['pro-1']?.earnedAt,
    );
    expect(proGames.length).toBeGreaterThanOrEqual(20);

    // 3. Legend in exactly 12 games, spread across all four families
    const legendGames = manifests.filter(
      (m) => profile.progress.games[m.id]?.patches['legend-1']?.earnedAt,
    );
    expect(legendGames).toHaveLength(12);
    for (const family of ['duels', 'brain', 'sports', 'arcade'] as const) {
      const inFamily = legendGames.filter((m) => m.family === family);
      expect(inFamily.length).toBeGreaterThan(0);
    }

    // 4. Secret in 6 games
    const secretGames = manifests.filter(
      (m) => profile.progress.games[m.id]?.patches['secret-1']?.earnedAt,
    );
    expect(secretGames).toHaveLength(6);

    // 5. At least 10 earned patches gold
    let goldCount = 0;
    for (const gameProgress of Object.values(profile.progress.games)) {
      for (const patch of Object.values(gameProgress.patches)) {
        if (patch.earnedAt && patch.gold) {
          goldCount++;
        }
      }
    }
    expect(goldCount).toBeGreaterThanOrEqual(10);

    // 6. Streak: best 104, current 34 ending on now's UTC day, exactly one snow day in two weeks
    expect(profile.progress.den.streak.best).toBe(104);
    const view = streakView(profile.progress.den.streak, fixedNow);
    expect(view.current).toBe(34);
    expect(view.best).toBe(104);
    expect(view.playedToday).toBe(true);

    const snowDays = Object.entries(profile.progress.den.streak.days).filter(
      ([, kind]) => kind === 'snow',
    );
    expect(snowDays).toHaveLength(2);
    const firstWeek = isoWeekKey(snowDays[0]?.[0] ?? '');
    const secondWeek = isoWeekKey(snowDays[1]?.[0] ?? '');
    expect(firstWeek).not.toBe(secondWeek);

    // 7. Block Ladder: all 6 kids beaten, at least two on A
    const ladder = blockLadder(profile.progress.den.kids);
    expect(ladder.rung).toBe(6);
    expect(ladder.champion).toBe(true);
    expect(ladder.next).toBeNull();
    expect(ladder.beatenOnA.length).toBeGreaterThanOrEqual(2);

    // 8. Versus: 12 series played, 12 recent records, 3 rivalries ("Robin", "Sam", "Alex", plus kid)
    expect(profile.progress.den.versus.seriesPlayed).toBe(12);
    expect(profile.progress.den.versus.recent).toHaveLength(12);
    const rivalryKeys = Object.keys(profile.progress.den.versus.rivalries);
    expect(rivalryKeys).toHaveLength(3);

    // 9. All 32 lamps lit (including lane-hopper/rabbit and pier-derby/hack)
    expect(profile.progress.games['lane-hopper']?.versionsFinished.rabbit).toBeTruthy();
    expect(profile.progress.games['pier-derby']?.versionsFinished.hack).toBeTruthy();
    const { litPlaces, facts, growth } = evaluateShowcaseFacts(profile);
    expect(litPlaces).toHaveLength(32);
    expect(facts.allLampsLit).toBe(true);

    // 10. Jacket: at least 30 on front with no two within 60 units, and 8 on back
    const front = profile.progress.den.jacket.placements.filter((p) => p.side === 'front');
    const back = profile.progress.den.jacket.placements.filter((p) => p.side === 'back');
    expect(front.length).toBeGreaterThanOrEqual(30);
    expect(back).toHaveLength(8);

    for (let i = 0; i < front.length; i++) {
      const a = front[i];
      if (!a) continue;
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(600);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(700);

      for (let j = i + 1; j < front.length; j++) {
        const b = front[j];
        if (!b) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        expect(dist).toBeGreaterThanOrEqual(60);
      }
    }

    // 11. Free run records (3) and today's daily run
    expect(profile.progress.den.runs.free).toHaveLength(3);
    const todayKey = utcDateKey(fixedNow);
    expect(profile.progress.den.runs.daily[todayKey]).toBeTruthy();

    // 12. Stats with plays for every game
    for (const manifest of manifests) {
      expect(profile.stats.games[manifest.id]?.plays).toBeGreaterThan(0);
    }

    // Growth includes every growth kind
    const kinds = new Set(growth.map((item) => item.kind));
    expect(kinds.has('poster')).toBe(true);
    expect(kinds.has('trophy')).toBe(true);
    expect(kinds.has('paper-chain')).toBe(true);
    expect(kinds.has('string-lights')).toBe(true);
    expect(kinds.has('on-air')).toBe(true);
    expect(kinds.has('ribbon')).toBe(true);
    expect(kinds.has('second-beanbag')).toBe(true);
    expect(kinds.has('plaque-and-remote')).toBe(true);
    expect(growth.filter((item) => item.kind === 'trophy')).toHaveLength(12);
    expect(growth.filter((item) => item.kind === 'poster')).toHaveLength(4);
  });

  it('satisfies all rules for the mid showcase level', () => {
    const profile = showcaseProfile('mid', manifests, fixedNow);
    expect(profile.displayName).toBe('Sam');

    // 1. Patches in 27 games, 27 lamps lit, no alternate versions
    const gamesWithPatches = manifests.filter((m) =>
      Object.values(profile.progress.games[m.id]?.patches ?? {}).some((p) => p.earnedAt),
    );
    expect(gamesWithPatches).toHaveLength(27);

    const { litPlaces, facts, growth } = evaluateShowcaseFacts(profile);
    expect(litPlaces).toHaveLength(27);
    expect(profile.progress.games['lane-hopper']?.versionsFinished.rabbit).toBeFalsy();
    expect(profile.progress.games['pier-derby']?.versionsFinished.hack).toBeFalsy();

    // 2. Clubs complete in two families only (two posters)
    expect(facts.clubFamilies).toHaveLength(2);
    expect(growth.filter((item) => item.kind === 'poster')).toHaveLength(2);

    // 3. 5 legends (5 trophies)
    expect(facts.legendGames).toHaveLength(5);
    expect(growth.filter((item) => item.kind === 'trophy')).toHaveLength(5);

    // 4. Streak current and best 34 (chain and lights, no ON AIR)
    expect(profile.progress.den.streak.best).toBe(34);
    const view = streakView(profile.progress.den.streak, fixedNow);
    expect(view.current).toBe(34);
    expect(view.best).toBe(34);

    const kinds = new Set(growth.map((item) => item.kind));
    expect(kinds.has('paper-chain')).toBe(true);
    expect(kinds.has('string-lights')).toBe(true);
    expect(kinds.has('on-air')).toBe(false);

    // 5. Ladder rung 4 (Pip, Benny, Dee, Rosa beaten; no ribbon)
    const ladder = blockLadder(profile.progress.den.kids);
    expect(ladder.rung).toBe(4);
    expect(ladder.champion).toBe(false);
    expect(kinds.has('ribbon')).toBe(false);

    // 6. Versus 12 series (second beanbag)
    expect(profile.progress.den.versus.seriesPlayed).toBe(12);
    expect(kinds.has('second-beanbag')).toBe(true);

    // 7. 20 placements on the front
    const front = profile.progress.den.jacket.placements.filter((p) => p.side === 'front');
    expect(front).toHaveLength(20);
    const back = profile.progress.den.jacket.placements.filter((p) => p.side === 'back');
    expect(back).toHaveLength(0);

    // 8. Plaque and remote not earned
    expect(kinds.has('plaque-and-remote')).toBe(false);
  });

  it('generates an empty profile with synthetic patches for the new level', () => {
    const profile = showcaseProfile('new', manifests, fixedNow);
    expect(profile.displayName).toBe('Player');

    const { litPlaces, growth } = evaluateShowcaseFacts(profile);
    expect(litPlaces).toHaveLength(0);
    expect(growth).toHaveLength(0);

    // Synthetic patches are still provided for every game
    expect(Object.keys(profile.patches)).toHaveLength(manifests.length);
    for (const manifest of manifests) {
      const defs = profile.patches[manifest.id];
      expect(defs).toHaveLength(4);
      expect(defs?.map((d) => d.tier)).toEqual(['club', 'pro', 'legend', 'secret']);
    }

    // No patches earned in progress
    for (const gameProgress of Object.values(profile.progress.games)) {
      for (const patch of Object.values(gameProgress.patches)) {
        expect(patch.earnedAt).toBeNull();
      }
    }
  });

  it('guarantees deterministic output for the same level and now', () => {
    const runA = showcaseProfile('full', manifests, fixedNow);
    const runB = showcaseProfile('full', manifests, fixedNow);
    expect(runA).toEqual(runB);

    const midA = showcaseProfile('mid', manifests, fixedNow);
    const midB = showcaseProfile('mid', manifests, fixedNow);
    expect(midA).toEqual(midB);
  });

  it('validates synthetic patch formats and lengths across all games', () => {
    const profile = showcaseProfile('full', manifests, fixedNow);
    for (const manifest of manifests) {
      const defs = profile.patches[manifest.id] ?? [];
      expect(defs).toHaveLength(4);

      const seenIds = new Set<string>();
      for (const def of defs) {
        expect(def.id).toMatch(/^(club|pro|legend|secret)-[0-9]+$/);
        expect(seenIds.has(def.id)).toBe(false);
        seenIds.add(def.id);

        expect(def.title.length).toBeGreaterThan(0);
        expect(def.title.length).toBeLessThanOrEqual(28);
        expect(def.description.length).toBeGreaterThan(0);

        if (def.tier === 'secret') {
          expect(def.hint).toBeTruthy();
          expect((def.hint ?? '').length).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('parses showcase levels correctly with parseShowcaseLevel', () => {
    expect(parseShowcaseLevel('?showcase=full')).toBe('full');
    expect(parseShowcaseLevel('?a=1&showcase=mid')).toBe('mid');
    expect(parseShowcaseLevel('?showcase=new&extra=test')).toBe('new');
    expect(parseShowcaseLevel('?showcase=unknown')).toBeNull();
    expect(parseShowcaseLevel('?showcase=')).toBeNull();
    expect(parseShowcaseLevel('?other=1')).toBeNull();
    expect(parseShowcaseLevel('')).toBeNull();
  });
});
