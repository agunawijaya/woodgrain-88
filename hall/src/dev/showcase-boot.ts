/**
 * Dev only: `?showcase=full|mid|new` boots the Hall on a generated profile
 * (showcase.ts) held in memory, so every Den Life screen and growth item can
 * be seen, judged and photographed before the games that earn them exist.
 * Nothing touches the browser's storage, and main.ts only imports this file
 * inside an `import.meta.env.DEV` branch, so production builds leave it out
 * (the build check looks for it).
 *
 * The showcase counts every game as playable, gives every game its synthetic
 * patches, sews the jacket with Auto-arrange, marks the grown room as already
 * seen so photographs show it settled rather than mid-sparkle, and, at 'full'
 * and 'mid', leaves a Versus Night series running at 2–1 so the chalkboards
 * have a score on them, and a Power Cycle Run two rounds in, so #/run opens
 * on the automatic flip into round three. Every game gets a made-up
 * micro-challenge for the run, worded per family.
 */
import {
  beginRound,
  beginTransition,
  drawNextGame,
  finishRound,
  memoryBackend,
  planRun,
  recordGame,
  startRun,
  startSeries,
  type Family,
  type GameEntry,
  type GameManifest,
  type MicroChallengeDef,
  type RunState,
  type VersusSeries,
} from '@woodgrain-88/kit';
import { createServices, type Services } from '../app/services.ts';
import { autoArrange } from '../jacket/arrange.ts';
import { earnedDrawer } from '../jacket/drawer.ts';
import { parseShowcaseLevel, showcaseProfile, type ShowcaseLevel } from './showcase.ts';

/** Services for the showcase in the URL, or null when there is none. */
export function showcaseFromUrl(search: string, overrides: readonly GameEntry[]): Services | null {
  const level = parseShowcaseLevel(search);
  return level === null ? null : showcaseServices(level, overrides);
}

function midSeries(services: Services): VersusSeries | null {
  const pool = services.registry.manifests
    .filter((manifest) => manifest.versus !== 'none')
    .map((manifest) => manifest.id);
  if (pool.length === 0) return null;
  let series = startSeries({
    seats: [
      { kind: 'human', name: 'Robin' },
      { kind: 'human', name: 'Sam' },
    ],
    bestOf: 5,
    pool,
    seed: 1988,
  });
  for (const winner of [1, 2, 1] as const) series = recordGame(drawNextGame(series), winner);
  return drawNextGame(series);
}

const MICRO_GOALS: Record<Family, readonly string[]> = {
  duels: ['Land three hits', 'Win the first round', 'Take no hits for 20 seconds'],
  brain: ['Clear two boards', 'Make four matches', 'Solve one puzzle'],
  sports: ['Score twice', 'Win a rally', 'Sink three shots'],
  arcade: ['Survive the whole 45 seconds', 'Score 500 points', 'Clear the first wave'],
};

function showcaseMicro(manifest: GameManifest): MicroChallengeDef[] {
  const goals = MICRO_GOALS[manifest.family];
  const goal = goals[manifest.slot % goals.length] ?? 'Score once';
  return [
    {
      id: 'showcase',
      channel: manifest.channels[0]?.id ?? 'classic',
      title: goal,
      goal,
      pass: { metric: { kind: 'count', event: 'score' }, target: 3 },
    },
  ];
}

/** Two rounds played (one done, one missed), waiting on the flip into the third. */
function runInProgress(services: Services): RunState | null {
  const candidates = services.denLife.runCandidates();
  if (candidates.length < 5) return null;
  let state = beginTransition(startRun(planRun(candidates, 1988)));
  for (const passed of [true, false]) {
    const round = state.plan.rounds[state.roundIndex];
    if (!round) return null;
    state = finishRound(beginRound(state), {
      game: round.game,
      challenge: round.challenge.id,
      passed,
      score: passed ? 3 : 1,
      seconds: passed ? 31 : 45,
    });
  }
  return state;
}

export function showcaseServices(level: ShowcaseLevel, overrides: readonly GameEntry[]): Services {
  const services = createServices(overrides, {
    backend: { backend: memoryBackend(), persistent: false },
    playable: () => true,
  });
  const { repos, denLife } = services;
  const profile = showcaseProfile(level, services.registry.manifests, new Date());
  for (const [game, patches] of Object.entries(profile.patches))
    denLife.registerPatches(game, patches);
  for (const manifest of services.registry.manifests)
    denLife.registerMicro(manifest.id, showcaseMicro(manifest));
  repos.progress.set(profile.progress);
  const drawer = earnedDrawer(
    services.registry.manifests,
    (id) => denLife.patchesFor(id),
    profile.progress,
  );
  repos.progress.update((draft) => {
    draft.den.jacket.placements = autoArrange(drawer);
  });
  repos.stats.set(profile.stats);
  repos.records.set(profile.records);
  repos.profile.update((draft) => {
    draft.displayName = profile.displayName;
  });
  repos.settings.update((draft) => {
    draft.introSeen = true;
  });
  denLife.markGrowthSeen(denLife.growth());
  if (level !== 'new') {
    services.versusNight.set(midSeries(services));
    services.powerRun.set(runInProgress(services));
  }
  return services;
}
