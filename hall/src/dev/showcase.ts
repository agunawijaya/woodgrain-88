/**
 * Dev-only showcase profile generator.
 *
 * Populates realistic, deterministic player profiles for dev harnesses and
 * screenshot capture. Supports 'full' (fully unlocked Den Life), 'mid' (partial
 * progress), and 'new' (empty initial state with locked outlines).
 */
import {
  emptyDenLife,
  utcDateKey,
  utcDayIndex,
  type DailyRunData,
  type DenLifeData,
  type Family,
  type GameManifest,
  type GameProgressData,
  type GameStatsData,
  type KidId,
  type KidRecordData,
  type PatchDef,
  type PatchPlacement,
  type PatchProgressData,
  type PatchTier,
  type ProgressData,
  type RecordsData,
  type RivalryData,
  type RunRecord,
  type RunResultData,
  type StatsData,
  type StreakData,
  type StreakDayKind,
  type VersusData,
  type VersusSeriesRecord,
} from '@woodgrain-88/kit';

export type ShowcaseLevel = 'full' | 'mid' | 'new';

export interface ShowcaseProfile {
  displayName: string;
  progress: ProgressData;
  stats: StatsData;
  records: RecordsData;
  /** Synthetic patches for every game, four per game: club, pro, legend, secret (with a hint). */
  patches: Record<string, PatchDef[]>;
}

const FAMILY_TITLES: Record<Family, Record<PatchTier, readonly string[]>> = {
  duels: {
    club: [
      'First Duelist',
      'Quick Reflexes',
      'Ten Paces',
      'High Noon',
      'Range Scout',
      'Steady Aim',
      'Dusty Boots',
      'Showdown Ready',
    ],
    pro: [
      'Deadeye Shot',
      'Iron Nerve',
      'Quickdraw Artist',
      'Ricochet King',
      'Fast On The Draw',
      'Corner Pocket',
      'Crack Shot',
      'Bounty Hunter',
    ],
    legend: [
      'Master Duelist',
      'Frontier Legend',
      'The Untouchable',
      'Town Sheriff',
      'Gunslinger Supreme',
      'Top Gunner',
      'Duel Champion',
      'Grand Marshal',
    ],
    secret: [
      'Ghost Bullet',
      'Cactus Shuffle',
      'Whispering Wind',
      'Phantom Shot',
      'Shadow Draw',
      'Midnight Stare',
      'Secret Saloon',
      'Lone Wolf',
    ],
  },
  brain: {
    club: [
      'Pattern Seeker',
      'First Guess',
      'Number Cruncher',
      'Card Counter',
      'Logic Apprentice',
      'Puzzle Solver',
      'Board Scholar',
      'Memory Spark',
    ],
    pro: [
      'Mastermind',
      'Checkmate Call',
      'Card Shark',
      'Clean Board',
      'Fast Thinker',
      'Sharp Mind',
      'Tactical Insight',
      'Calculation Pro',
    ],
    legend: [
      'Grandmaster',
      'Pure Genius',
      'Total Recall',
      'Living Calculator',
      'Brain Trust',
      'Puzzle Master',
      'Flawless Deduction',
      'Tower of Logic',
    ],
    secret: [
      'Hidden Sequence',
      'Midnight Cipher',
      'The Clever Route',
      'Secret Formula',
      'Lost Solution',
      'Subtle Clue',
      'The Ninth Step',
      'Mystery Code',
    ],
  },
  sports: {
    club: [
      'Rookie Player',
      'First Whistle',
      'Field Starter',
      'Fair Play',
      'Warmup Ace',
      'Open Season',
      'Camp Graduate',
      'First Strike',
    ],
    pro: [
      'Season MVP',
      'Golden Glove',
      'Precision Drive',
      'Ace Server',
      'Clean Knockout',
      'Speed Skater',
      'Perfect Strike',
      'Clutch Finish',
    ],
    legend: [
      'Hall of Fame',
      'Triple Crown',
      'World Champion',
      'Undefeated Ring',
      'Grand Slam',
      'Record Setter',
      'Legendary Athlete',
      'Gold Medalist',
    ],
    secret: [
      'Off-Piste',
      'Curveball Spin',
      'Photo Finish',
      'Lucky Catch',
      'Secret Playbook',
      'The Sneak Shot',
      'Backhand Wonder',
      'Buzzer Beater',
    ],
  },
  arcade: {
    club: [
      'Coin Drop',
      'First Hop',
      'Joy Sticking',
      'Green Horn',
      'Maze Runner',
      'Pixel Hopper',
      'Level One Clear',
      'Ready Player',
    ],
    pro: [
      'Speed Runner',
      'Traffic Weaver',
      'Alien Sweeper',
      'Bonus Chaser',
      'Multiplier Ace',
      'High Score Hero',
      'Combo Striker',
      'Turbo Rider',
    ],
    legend: [
      'Arcade Master',
      'Quarter King',
      'Screen Clearer',
      'Immortal Score',
      'Century Club',
      'Max Score Legend',
      'Loop Survivor',
      'Machine Tamer',
    ],
    secret: [
      'Glitch Finder',
      'Warp Tunnel',
      'Rabbit Foot',
      'Ghost Hop',
      'The Hidden Tunnel',
      'Underground Route',
      'Secret Extra',
      'Bonus Warp',
    ],
  },
};

const SECRET_HINTS: Record<Family, readonly string[]> = {
  duels: [
    'Draw only when the wind stops howling in the dust.',
    'A ricochet off the far wall might hit something unseen.',
    'Wait until the final second before you take your shot.',
    'Some say a duel won without stepping back reveals a secret.',
  ],
  brain: [
    'A certain pattern mirrors across the board when solved in reverse.',
    'Count the moves carefully before touching the center.',
    'Look between the lines of the grid for a hidden path.',
    'Only a mind that pauses before the last piece finds the door.',
  ],
  sports: [
    'Try casting near the sunken pier when the tide is high.',
    'A split second before the buzzer, take the long shot.',
    'Hug the tightest turn without scraping the edge once.',
    'Wait for the champion to tire before delivering the finish.',
  ],
  arcade: [
    'Cross without stopping between the sixth and seventh lane.',
    'Follow the rabbit into the brush on the top edge.',
    'Clear the final wave without letting any flyer dive.',
    'A path behind the barrier opens when the clock turns red.',
  ],
};

const MS_PER_DAY = 86_400_000;

// Synthetic goals are intentionally simple counters so they validate without real game logic.
function makeSyntheticPatch(
  manifest: GameManifest,
  tier: PatchTier,
  familySlotIndex: number,
): PatchDef {
  const titles = FAMILY_TITLES[manifest.family][tier];
  const title = titles[familySlotIndex % titles.length] ?? `${manifest.title} ${tier}`;

  const base = {
    id: `${tier}-1`,
    tier,
    title,
    description: `Earned through exceptional play in ${manifest.title}.`,
  };

  if (tier === 'secret') {
    const hints = SECRET_HINTS[manifest.family];
    const hint = hints[familySlotIndex % hints.length] ?? 'A hidden mystery awaits discovery.';
    return {
      ...base,
      hint,
      goal: { metric: { kind: 'count', event: 'game-finished' }, target: 1 },
    };
  }

  const target = tier === 'club' ? 1 : tier === 'pro' ? 5 : 10;
  return {
    ...base,
    goal: { metric: { kind: 'count', event: 'game-finished' }, target },
  };
}

// Generates synthetic definitions for every game in the registry so coming-soon
// titles can render jacket outlines.
function buildSyntheticPatches(manifests: readonly GameManifest[]): Record<string, PatchDef[]> {
  const familyCounters: Record<Family, number> = {
    duels: 0,
    brain: 0,
    sports: 0,
    arcade: 0,
  };

  const result: Record<string, PatchDef[]> = {};
  for (const manifest of manifests) {
    const familyIndex = familyCounters[manifest.family]++;
    result[manifest.id] = [
      makeSyntheticPatch(manifest, 'club', familyIndex),
      makeSyntheticPatch(manifest, 'pro', familyIndex),
      makeSyntheticPatch(manifest, 'legend', familyIndex),
      makeSyntheticPatch(manifest, 'secret', familyIndex),
    ];
  }
  return result;
}

// Walks backward from today to create an unbroken block of calendar activity.
function buildStreakDays(
  now: Date,
  totalDays: number,
  snowDayOffsets: readonly number[],
): Record<string, StreakDayKind> {
  const days: Record<string, StreakDayKind> = {};
  const currentDayIndex = utcDayIndex(now);
  const snowSet = new Set(snowDayOffsets);

  for (let i = 0; i < totalDays; i++) {
    const dayKey = utcDateKey(new Date((currentDayIndex - i) * MS_PER_DAY));
    days[dayKey] = snowSet.has(i) ? 'snow' : 'played';
  }

  return days;
}

// Places patches on a regular grid so adjacent badges never collide.
function buildGridPlacements(
  items: readonly { game: string; patch: string }[],
  side: 'front' | 'back',
  columns: number,
  originX: number,
  originY: number,
  spacingX: number,
  spacingY: number,
): PatchPlacement[] {
  return items.map((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      game: item.game,
      patch: item.patch,
      side,
      x: originX + col * spacingX,
      y: originY + row * spacingY,
      rotation: 0,
      z: index + 1,
    };
  });
}

function buildFullProfile(manifests: readonly GameManifest[], now: Date): ShowcaseProfile {
  const nowIso = now.toISOString();
  const todayKey = utcDateKey(now);

  // Group manifests by family to spread legends and maintain balanced representation.
  const byFamily: Record<Family, GameManifest[]> = {
    duels: [],
    brain: [],
    sports: [],
    arcade: [],
  };
  for (const manifest of manifests) {
    byFamily[manifest.family].push(manifest);
  }

  // Exactly 12 legends, 3 from each of the 4 families.
  const legendGameIds = new Set<string>();
  for (const family of ['duels', 'brain', 'sports', 'arcade'] as const) {
    const list = byFamily[family];
    for (let i = 0; i < 3 && i < list.length; i++) {
      const manifest = list[i];
      if (manifest) {
        legendGameIds.add(manifest.id);
      }
    }
  }

  // 20 games with Pro earned, 6 with Secret.
  const proGameIds = new Set(manifests.slice(0, 20).map((m) => m.id));
  const secretGameIds = new Set(manifests.slice(0, 6).map((m) => m.id));

  // Games progress: every game's club earned; 12 gold patches among the first 12 games.
  const games: Record<string, GameProgressData> = {};
  for (let i = 0; i < manifests.length; i++) {
    const manifest = manifests[i];
    if (!manifest) continue;

    const patches: Record<string, PatchProgressData> = {
      'club-1': {
        value: 1,
        earnedAt: nowIso,
        gold: i < 12,
      },
      'pro-1': {
        value: proGameIds.has(manifest.id) ? 5 : 0,
        earnedAt: proGameIds.has(manifest.id) ? nowIso : null,
        gold: false,
      },
      'legend-1': {
        value: legendGameIds.has(manifest.id) ? 10 : 0,
        earnedAt: legendGameIds.has(manifest.id) ? nowIso : null,
        gold: false,
      },
      'secret-1': {
        value: secretGameIds.has(manifest.id) ? 1 : 0,
        earnedAt: secretGameIds.has(manifest.id) ? nowIso : null,
        gold: false,
      },
    };

    const versionsFinished: Record<string, string> = {};
    if (manifest.id === 'lane-hopper') {
      versionsFinished.chicken = nowIso;
      versionsFinished.rabbit = nowIso;
    } else if (manifest.id === 'pier-derby') {
      versionsFinished.derby = nowIso;
      versionsFinished.hack = nowIso;
    }

    games[manifest.id] = {
      patches,
      channels: { classic: { unlockedAt: nowIso } },
      firstPlayedAt: nowIso,
      versionsFinished,
    };
  }

  // Streak: 34 days total, with day -9 and day -23 as snow days in separate ISO weeks.
  const streak: StreakData = {
    days: buildStreakDays(now, 34, [9, 23]),
    best: 104,
  };

  // Block Ladder: all 6 kids beaten, Pip and Benny beaten on switch A.
  const kids: Partial<Record<KidId, KidRecordData>> = {
    pip: {
      wins: 3,
      losses: 1,
      draws: 0,
      winsOnA: 2,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: nowIso,
    },
    benny: {
      wins: 2,
      losses: 2,
      draws: 1,
      winsOnA: 1,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: nowIso,
    },
    dee: {
      wins: 4,
      losses: 1,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
    rosa: {
      wins: 2,
      losses: 1,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
    moss: {
      wins: 1,
      losses: 3,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
    lou: {
      wins: 2,
      losses: 2,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
  };

  // Versus: 12 series played across 3 distinct rivalries.
  const recentVersus: VersusSeriesRecord[] = [];
  const rivalryConfigs = [
    { names: ['Alex', 'Robin'] as [string, string], kids: [null, null] as [null, null] },
    { names: ['Robin', 'Sam'] as [string, string], kids: [null, null] as [null, null] },
    { names: ['Dee', 'Robin'] as [string, string], kids: ['dee', null] as [KidId, null] },
  ];

  for (let i = 0; i < 12; i++) {
    const config = rivalryConfigs[i % rivalryConfigs.length];
    if (!config) continue;
    recentVersus.push({
      at: nowIso,
      names: config.names,
      kids: config.kids,
      bestOf: 3,
      games: [
        { game: manifests[0]?.id ?? 'baseline', winner: 1 },
        { game: manifests[1]?.id ?? 'big-top-cannon', winner: 2 },
        { game: manifests[2]?.id ?? 'bumper-chase', winner: 2 },
      ],
      winner: 2,
    });
  }

  const rivalries: Record<string, RivalryData> = {
    'alex|robin': {
      names: ['Alex', 'Robin'],
      series: [1, 3],
      games: [4, 7],
      lastAt: nowIso,
    },
    'dee|robin': {
      names: ['Dee', 'Robin'],
      series: [1, 3],
      games: [3, 7],
      lastAt: nowIso,
    },
    'robin|sam': {
      names: ['Robin', 'Sam'],
      series: [3, 1],
      games: [7, 4],
      lastAt: nowIso,
    },
  };

  const versus: VersusData = {
    seriesPlayed: 12,
    recent: recentVersus,
    rivalries,
  };

  // Jacket: 32 patches on the front in a 6x6 grid (spacing 90 >= 60) and 8 on the back.
  const frontBadges = manifests.map((m) => ({ game: m.id, patch: 'club-1' }));
  const firstManifest = manifests[0];
  const secondManifest = manifests[1];
  if (firstManifest) frontBadges.push({ game: firstManifest.id, patch: 'pro-1' });
  if (secondManifest) frontBadges.push({ game: secondManifest.id, patch: 'pro-1' });

  const backBadges = manifests
    .slice(2, 10)
    .map((m) => ({ game: m.id, patch: 'pro-1' }));

  const frontPlacements = buildGridPlacements(frontBadges, 'front', 6, 75, 80, 90, 90);
  const backPlacements = buildGridPlacements(backBadges, 'back', 4, 120, 150, 110, 120);

  // Power Cycle runs: 3 free runs, and one daily run on today's UTC day.
  const freeRuns: RunResultData[] = [
    {
      at: nowIso,
      seed: 1001,
      score: 3500,
      rounds: [{ game: 'baseline', challenge: 'rally', passed: true, seconds: 12 }],
    },
    {
      at: nowIso,
      seed: 1002,
      score: 2800,
      rounds: [{ game: 'baseline', challenge: 'rally', passed: true, seconds: 15 }],
    },
    {
      at: nowIso,
      seed: 1003,
      score: 2100,
      rounds: [{ game: 'baseline', challenge: 'rally', passed: true, seconds: 18 }],
    },
  ];

  const dailyRuns: Record<string, RunResultData> = {
    [todayKey]: {
      at: nowIso,
      seed: 2001,
      score: 2400,
      rounds: [
        {
          game: manifests[0]?.id ?? 'baseline',
          challenge: 'target',
          passed: true,
          seconds: 20,
        },
      ],
    },
  };

  const dailyGameRuns: Record<string, Record<string, DailyRunData>> = {
    [todayKey]: {
      [manifests[0]?.id ?? 'baseline']: {
        score: 2400,
        scoreLabel: '2,400 pts',
        emoji: null,
        channel: 'classic',
        at: nowIso,
      },
    },
  };

  const den: DenLifeData = {
    streak,
    daily: dailyGameRuns,
    kids,
    jacket: {
      placements: [...frontPlacements, ...backPlacements],
      lookedAt: nowIso,
    },
    versus,
    runs: {
      free: freeRuns,
      daily: dailyRuns,
    },
    growthSeen: {},
    counterCompletedAt: nowIso,
  };

  // Stats: every game has recorded plays.
  const statsGames: Record<string, GameStatsData> = {};
  for (const manifest of manifests) {
    statsGames[manifest.id] = {
      plays: 5 + (manifest.slot % 10),
      best: 1000 + manifest.slot * 100,
      timePlayedMs: (5 + (manifest.slot % 10)) * 60_000,
      lastPlayedAt: nowIso,
      versusWins: { 1: 3, 2: 1 },
    };
  }

  // Records: solo leaderboard entries.
  const firstGameId = manifests[0]?.id ?? 'baseline';
  const recordsBoards: Record<string, RunRecord[]> = {
    [`${firstGameId}/classic/normal`]: [
      {
        score: 3500,
        at: nowIso,
        seed: 1001,
        durationMs: 45000,
        channel: 'classic',
        mode: 'normal',
      },
      {
        score: 2800,
        at: nowIso,
        seed: 1002,
        durationMs: 48000,
        channel: 'classic',
        mode: 'normal',
      },
      {
        score: 2100,
        at: nowIso,
        seed: 1003,
        durationMs: 50000,
        channel: 'classic',
        mode: 'normal',
      },
    ],
  };

  return {
    displayName: 'Robin',
    progress: { games, den },
    stats: { games: statsGames },
    records: { boards: recordsBoards },
    patches: buildSyntheticPatches(manifests),
  };
}

function buildMidProfile(manifests: readonly GameManifest[], now: Date): ShowcaseProfile {
  const nowIso = now.toISOString();

  // Exactly two families (duels and brain) have all club patches earned.
  // Sports and arcade leave 3 games unplayed so exactly 27 games have patches and lamps.
  const sportsUnplayed = manifests
    .filter((m) => m.family === 'sports' && m.id !== 'pier-derby')
    .slice(-1);
  const arcadeUnplayed = manifests
    .filter((m) => m.family === 'arcade' && m.id !== 'lane-hopper')
    .slice(-2);
  const unplayedIds = new Set([...sportsUnplayed, ...arcadeUnplayed].map((m) => m.id));

  // 5 games among the 27 have Legend patches earned.
  const playedManifests = manifests.filter((m) => !unplayedIds.has(m.id));
  const legendGameIds = new Set(playedManifests.slice(0, 5).map((m) => m.id));

  const games: Record<string, GameProgressData> = {};
  const statsGames: Record<string, GameStatsData> = {};

  for (const manifest of manifests) {
    if (unplayedIds.has(manifest.id)) {
      games[manifest.id] = {
        patches: {
          'club-1': { value: 0, earnedAt: null, gold: false },
          'pro-1': { value: 0, earnedAt: null, gold: false },
          'legend-1': { value: 0, earnedAt: null, gold: false },
          'secret-1': { value: 0, earnedAt: null, gold: false },
        },
        channels: { classic: { unlockedAt: nowIso } },
        firstPlayedAt: null,
        versionsFinished: {},
      };
      statsGames[manifest.id] = {
        plays: 0,
        best: null,
        timePlayedMs: 0,
        lastPlayedAt: null,
        versusWins: { 1: 0, 2: 0 },
      };
      continue;
    }

    const isLegend = legendGameIds.has(manifest.id);
    const patches: Record<string, PatchProgressData> = {
      'club-1': { value: 1, earnedAt: nowIso, gold: false },
      'pro-1': { value: 0, earnedAt: null, gold: false },
      'legend-1': {
        value: isLegend ? 10 : 0,
        earnedAt: isLegend ? nowIso : null,
        gold: false,
      },
      'secret-1': { value: 0, earnedAt: null, gold: false },
    };

    const versionsFinished: Record<string, string> = {};
    if (manifest.id === 'lane-hopper') {
      versionsFinished.chicken = nowIso;
    } else if (manifest.id === 'pier-derby') {
      versionsFinished.derby = nowIso;
    }

    games[manifest.id] = {
      patches,
      channels: { classic: { unlockedAt: nowIso } },
      firstPlayedAt: nowIso,
      versionsFinished,
    };

    statsGames[manifest.id] = {
      plays: 4 + (manifest.slot % 5),
      best: 800 + manifest.slot * 50,
      timePlayedMs: (4 + (manifest.slot % 5)) * 60_000,
      lastPlayedAt: nowIso,
      versusWins: { 1: 2, 2: 1 },
    };
  }

  // Streak: current and best 34 (chain and lights, no ON AIR).
  const streak: StreakData = {
    days: buildStreakDays(now, 34, []),
    best: 34,
  };

  // Block Ladder: rung 4 (Pip, Benny, Dee, Rosa beaten; Moss and Lou not beaten).
  const kids: Partial<Record<KidId, KidRecordData>> = {
    pip: {
      wins: 2,
      losses: 1,
      draws: 0,
      winsOnA: 1,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: nowIso,
    },
    benny: {
      wins: 1,
      losses: 0,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
    dee: {
      wins: 3,
      losses: 2,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
    rosa: {
      wins: 1,
      losses: 1,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: nowIso,
      firstBeatenOnAAt: null,
    },
    moss: {
      wins: 0,
      losses: 2,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: null,
      firstBeatenOnAAt: null,
    },
    lou: {
      wins: 0,
      losses: 1,
      draws: 0,
      winsOnA: 0,
      firstBeatenAt: null,
      firstBeatenOnAAt: null,
    },
  };

  // Versus: 12 series played (second beanbag).
  const recentVersus: VersusSeriesRecord[] = [];
  for (let i = 0; i < 12; i++) {
    recentVersus.push({
      at: nowIso,
      names: ['Alex', 'Sam'],
      kids: [null, null],
      bestOf: 3,
      games: [
        { game: manifests[0]?.id ?? 'baseline', winner: 1 },
        { game: manifests[1]?.id ?? 'big-top-cannon', winner: 2 },
        { game: manifests[2]?.id ?? 'bumper-chase', winner: 2 },
      ],
      winner: 2,
    });
  }

  const versus: VersusData = {
    seriesPlayed: 12,
    recent: recentVersus,
    rivalries: {
      'alex|sam': {
        names: ['Alex', 'Sam'],
        series: [4, 8],
        games: [10, 18],
        lastAt: nowIso,
      },
    },
  };

  // Jacket: exactly 20 placements on the front.
  const frontBadges = playedManifests
    .slice(0, 20)
    .map((m) => ({ game: m.id, patch: 'club-1' }));
  const frontPlacements = buildGridPlacements(frontBadges, 'front', 5, 80, 100, 100, 100);

  const den: DenLifeData = {
    streak,
    daily: {},
    kids,
    jacket: {
      placements: frontPlacements,
      lookedAt: nowIso,
    },
    versus,
    runs: {
      free: [],
      daily: {},
    },
    growthSeen: {},
    counterCompletedAt: null,
  };

  return {
    displayName: 'Sam',
    progress: { games, den },
    stats: { games: statsGames },
    records: { boards: {} },
    patches: buildSyntheticPatches(manifests),
  };
}

function buildNewProfile(manifests: readonly GameManifest[]): ShowcaseProfile {
  return {
    displayName: 'Player',
    progress: {
      games: {},
      den: emptyDenLife(),
    },
    stats: {
      games: {},
    },
    records: {
      boards: {},
    },
    patches: buildSyntheticPatches(manifests),
  };
}

/**
 * Builds a deterministic showcase profile for dev preview and photography.
 */
export function showcaseProfile(
  level: ShowcaseLevel,
  manifests: readonly GameManifest[],
  now: Date,
): ShowcaseProfile {
  switch (level) {
    case 'full':
      return buildFullProfile(manifests, now);
    case 'mid':
      return buildMidProfile(manifests, now);
    case 'new':
      return buildNewProfile(manifests);
  }
}

/**
 * Reads "?showcase=full|mid|new" from a query string.
 */
export function parseShowcaseLevel(search: string): ShowcaseLevel | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const value = params.get('showcase');
  if (value === 'full' || value === 'mid' || value === 'new') {
    return value;
  }
  return null;
}
