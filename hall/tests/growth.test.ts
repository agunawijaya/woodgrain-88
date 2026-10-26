/**
 * Tests for the Den's room growth facts and earned items: progression from empty
 * progress to full room decoration, trophy ordering, family poster completion
 * thresholds, streak milestones, Block Ladder ribbon, Versus Night beanbag,
 * 32-lamp completion, and unseen item calculation.
 */
import { emptyDenLife, type GameManifest, type ProgressData } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import {
  STREAK_MILESTONES,
  VERSUS_SERIES_FOR_BEANBAG,
  earnedGrowth,
  growthFacts,
  newGrowth,
  type GrowthItem,
} from '../src/den/growth.ts';

function createEmptyProgress(): ProgressData {
  return {
    games: {},
    den: emptyDenLife(),
  };
}

function createManifest(overrides: Partial<GameManifest> = {}): GameManifest {
  return {
    id: 'game-1',
    slot: 1,
    title: 'Game 1',
    tagline: 'A test game tagline.',
    teaser: 'A test game teaser description.',
    family: 'arcade',
    players: '1P',
    versus: 'none',
    sessionMinutes: [1, 5],
    status: 'playable',
    scoreOrder: 'higher',
    accent: { day: '#111111', night: '#222222' },
    emblem: 'M0 0h10',
    label: {
      pattern: 'stripes',
      paper: '#ffffff',
      ink: '#000000',
      band: '#333333',
      bandText: '#ffffff',
    },
    inspiredBy: {
      originalTitle: 'Original Game',
      uiTitle: 'the original game',
      publisher: 'Publisher',
      year: 1980,
      cartridgeSlots: [1],
    },
    controls: [{ keys: ['Space'], does: 'jump' }],
    channels: [
      { id: 'classic', kind: 'original', title: 'Classic', description: 'Classic channel' },
    ],
    supports: { daily: true, challengeLinks: true, microChallenges: false },
    events: [],
    ...overrides,
  };
}

function addPatch(
  progress: ProgressData,
  gameId: string,
  patchId: string,
  earnedAt = '2026-10-26T12:00:00.000Z',
  gold = false,
): void {
  const game = (progress.games[gameId] ??= {
    patches: {},
    channels: {},
    firstPlayedAt: null,
    versionsFinished: {},
  });
  game.patches[patchId] = {
    value: 1,
    earnedAt,
    gold,
  };
}

describe('growth rules', () => {
  it('gives an empty list of growth items when progress is empty', () => {
    const game = createManifest();
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>();
    const progress = createEmptyProgress();

    const facts = growthFacts({
      manifests: [game],
      patchTiers,
      progress,
      allLampsLit: false,
    });

    expect(facts.legendGames).toEqual([]);
    expect(facts.clubFamilies).toEqual([]);
    expect(facts.bestStreak).toBe(0);
    expect(facts.blockChampion).toBe(false);
    expect(facts.versusSeries).toBe(0);
    expect(facts.allLampsLit).toBe(false);
    expect(earnedGrowth(facts)).toEqual([]);
  });

  it('awards trophies in manifest order for each game with an earned Legend patch', () => {
    const game1 = createManifest({ id: 'game-1', title: 'Game One', slot: 1 });
    const game2 = createManifest({ id: 'game-2', title: 'Game Two', slot: 2 });
    const game3 = createManifest({ id: 'game-3', title: 'Game Three', slot: 3 });

    const manifests = [game1, game2, game3];
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>([
      ['game-1', { club: [], legend: ['legend-1'] }],
      ['game-2', { club: [], legend: ['legend-2'] }],
      ['game-3', { club: [], legend: ['legend-3'] }],
    ]);

    const progress = createEmptyProgress();
    // Earn game-3 first, then game-1; game-2 is unearned.
    addPatch(progress, 'game-3', 'legend-3');
    addPatch(progress, 'game-1', 'legend-1');

    const facts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    const trophies = earnedGrowth(facts).filter((item) => item.kind === 'trophy');

    expect(trophies).toEqual([
      { id: 'trophy:game-1', kind: 'trophy', toast: 'A trophy for Game One', game: 'game-1' },
      { id: 'trophy:game-3', kind: 'trophy', toast: 'A trophy for Game Three', game: 'game-3' },
    ]);
  });

  it('awards a family poster only when every playable game in that family has a Club patch', () => {
    const arcade1 = createManifest({ id: 'arc-1', slot: 1, family: 'arcade', status: 'playable' });
    const arcade2 = createManifest({ id: 'arc-2', slot: 2, family: 'arcade', status: 'playable' });
    const brainComingSoon = createManifest({
      id: 'brain-1',
      slot: 3,
      family: 'brain',
      status: 'coming-soon',
    });

    const manifests = [arcade1, arcade2, brainComingSoon];
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>([
      ['arc-1', { club: ['club-1'], legend: [] }],
      ['arc-2', { club: ['club-2'], legend: [] }],
      ['brain-1', { club: ['club-b'], legend: [] }],
    ]);

    const progress = createEmptyProgress();
    addPatch(progress, 'arc-1', 'club-1');

    // 1. None when one playable game of the family lacks a Club patch
    const partialFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(partialFacts.clubFamilies).not.toContain('arcade');
    expect(
      earnedGrowth(partialFacts).some((item) => item.kind === 'poster' && item.family === 'arcade'),
    ).toBe(false);

    // 2. None for a family with no playable games on the shelf (even if patch exists)
    addPatch(progress, 'brain-1', 'club-b');
    const brainFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(brainFacts.clubFamilies).not.toContain('brain');

    // Completing all playable games in arcade awards the poster
    addPatch(progress, 'arc-2', 'club-2');
    const fullArcadeFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(fullArcadeFacts.clubFamilies).toContain('arcade');
    expect(earnedGrowth(fullArcadeFacts)).toContainEqual({
      id: 'poster:arcade',
      kind: 'poster',
      toast: 'The Arcade poster goes up on the wall',
      family: 'arcade',
    });

    // 3. With playable: () => true, every game counts toward the family poster
    const showcaseFacts = growthFacts({
      manifests,
      patchTiers,
      progress,
      allLampsLit: false,
      playable: () => true,
    });
    // Now brain-1 counts, and since brain-1 has club-b, brain poster is earned
    expect(showcaseFacts.clubFamilies).toContain('brain');
    expect(earnedGrowth(showcaseFacts)).toContainEqual({
      id: 'poster:brain',
      kind: 'poster',
      toast: 'The Brain poster goes up on the wall',
      family: 'brain',
    });
  });

  it('awards streak milestones exactly at thresholds 7, 30, and 100', () => {
    const manifests = [createManifest()];
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>();

    const checkMilestones = (bestStreak: number): Set<string> => {
      const progress = createEmptyProgress();
      progress.den.streak.best = bestStreak;
      const facts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
      return new Set(earnedGrowth(facts).map((item) => item.id));
    };

    expect(STREAK_MILESTONES.paperChain).toBe(7);
    expect(STREAK_MILESTONES.stringLights).toBe(30);
    expect(STREAK_MILESTONES.onAir).toBe(100);

    // At 6: nothing
    const at6 = checkMilestones(6);
    expect(at6.has('paper-chain')).toBe(false);
    expect(at6.has('string-lights')).toBe(false);
    expect(at6.has('on-air')).toBe(false);

    // At 7: paper-chain only
    const at7 = checkMilestones(7);
    expect(at7.has('paper-chain')).toBe(true);
    expect(at7.has('string-lights')).toBe(false);
    expect(at7.has('on-air')).toBe(false);

    // At 29: still paper-chain only
    const at29 = checkMilestones(29);
    expect(at29.has('paper-chain')).toBe(true);
    expect(at29.has('string-lights')).toBe(false);
    expect(at29.has('on-air')).toBe(false);

    // At 30: paper-chain and string-lights
    const at30 = checkMilestones(30);
    expect(at30.has('paper-chain')).toBe(true);
    expect(at30.has('string-lights')).toBe(true);
    expect(at30.has('on-air')).toBe(false);

    // At 99: paper-chain and string-lights
    const at99 = checkMilestones(99);
    expect(at99.has('paper-chain')).toBe(true);
    expect(at99.has('string-lights')).toBe(true);
    expect(at99.has('on-air')).toBe(false);

    // At 100: all three streak milestones
    const at100 = checkMilestones(100);
    expect(at100.has('paper-chain')).toBe(true);
    expect(at100.has('string-lights')).toBe(true);
    expect(at100.has('on-air')).toBe(true);
  });

  it('awards the Block champion ribbon only when the Block Ladder champion is true', () => {
    const manifests = [createManifest()];
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>();

    const progress = createEmptyProgress();
    const ladderKids = ['pip', 'benny', 'dee', 'rosa', 'moss'] as const;
    for (const kid of ladderKids) {
      progress.den.kids[kid] = {
        wins: 1,
        losses: 0,
        draws: 0,
        winsOnA: 0,
        firstBeatenAt: '2026-10-26T12:00:00.000Z',
        firstBeatenOnAAt: null,
      };
    }

    // 5 of 6 kids beaten: not champion
    const notChampFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(notChampFacts.blockChampion).toBe(false);
    expect(earnedGrowth(notChampFacts).some((item) => item.kind === 'ribbon')).toBe(false);

    // All 6 kids beaten: champion
    progress.den.kids.lou = {
      wins: 1,
      losses: 0,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: '2026-10-26T12:00:00.000Z',
      firstBeatenOnAAt: null,
    };

    const champFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(champFacts.blockChampion).toBe(true);
    expect(earnedGrowth(champFacts)).toContainEqual({
      id: 'ribbon',
      kind: 'ribbon',
      toast: 'A Block champion ribbon on the corkboard',
    });
  });

  it('awards the second beanbag at 10 Versus series but not at 9', () => {
    const manifests = [createManifest()];
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>();
    expect(VERSUS_SERIES_FOR_BEANBAG).toBe(10);

    const progress = createEmptyProgress();
    progress.den.versus.seriesPlayed = 9;
    const factsAt9 = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(earnedGrowth(factsAt9).some((item) => item.kind === 'second-beanbag')).toBe(false);

    progress.den.versus.seriesPlayed = 10;
    const factsAt10 = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(earnedGrowth(factsAt10)).toContainEqual({
      id: 'second-beanbag',
      kind: 'second-beanbag',
      toast: 'A second beanbag for Versus Night. The cat has taken it',
    });
  });

  it('awards the plaque and remote only when all lamps are lit', () => {
    const manifests = [createManifest()];
    const patchTiers = new Map<string, { club: readonly string[]; legend: readonly string[] }>();
    const progress = createEmptyProgress();

    const notLitFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: false });
    expect(earnedGrowth(notLitFacts).some((item) => item.kind === 'plaque-and-remote')).toBe(false);

    const allLitFacts = growthFacts({ manifests, patchTiers, progress, allLampsLit: true });
    expect(earnedGrowth(allLitFacts)).toContainEqual({
      id: 'plaque-and-remote',
      kind: 'plaque-and-remote',
      toast: 'All 32 lamps: a 32 in 1 plaque, and a remote for the TV',
    });
  });

  it('returns items missing from growthSeen in order with newGrowth', () => {
    const item1: GrowthItem = { id: 'poster:arcade', kind: 'poster', toast: 'Poster' };
    const item2: GrowthItem = { id: 'paper-chain', kind: 'paper-chain', toast: 'Chain' };
    const item3: GrowthItem = { id: 'ribbon', kind: 'ribbon', toast: 'Ribbon' };
    const items = [item1, item2, item3];

    // None seen yet
    expect(newGrowth(items, {})).toEqual([item1, item2, item3]);

    // Item 2 already seen
    const seen = { 'paper-chain': '2026-10-26T12:00:00.000Z' };
    expect(newGrowth(items, seen)).toEqual([item1, item3]);

    // All items seen
    const allSeen = {
      'poster:arcade': '2026-10-26T12:00:00.000Z',
      'paper-chain': '2026-10-26T12:00:00.000Z',
      ribbon: '2026-10-26T12:00:00.000Z',
    };
    expect(newGrowth(items, allSeen)).toEqual([]);
  });
});
