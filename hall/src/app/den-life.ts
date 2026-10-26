/**
 * Den Life in the Hall: the one place that applies the collection-wide rules
 * when something happens, so every view reads the same answers. It knows
 * every patch definition seen so far, the console's two switches, the
 * Counter's lamps, the streak, the record against each kid, and what the
 * room has grown; it folds a finished run into all of them at once.
 */
import {
  blockLadder,
  createEmitter,
  emojiSummary,
  kidById,
  recordDailyRun,
  recordKidResult,
  recordStreakDay,
  streakView,
  type DifficultySwitches,
  type GameManifest,
  type GameResult,
  type KidId,
  type MicroChallengeDef,
  type PatchDef,
  type RunCandidate,
  type RunInfo,
  type SeatInfo,
  type StreakView,
  type SwitchPosition,
  type Unsubscribe,
} from '@woodgrain-88/kit';
import { counterPlaces, placeFinished, type CounterPlace } from '../data/cycle.ts';
import { earnedGrowth, growthFacts, newGrowth, type GrowthItem } from '../den/growth.ts';
import type { Services } from './services.ts';

export type SwitchSide = 'left' | 'right';

/** What a finished run changed in Den Life, for the results screen and the toasts. */
export interface RunAftermath {
  /** Whether this run counted for the daily score (first run of the day). */
  dailyCounted: boolean;
  /** Growth items appearing for the first time. */
  newGrowth: GrowthItem[];
  /** Counter places lit by this run. */
  newLamps: number[];
}

export interface DenLife {
  /** Patch definitions by game: from loaded modules, and in the showcase from its own set. */
  patchesFor(gameId: string): readonly PatchDef[];
  registerPatches(gameId: string, patches: readonly PatchDef[]): void;
  /** Micro-challenges by game, for the Power Cycle Run: from loaded modules, or the showcase's own. */
  microFor(gameId: string): readonly MicroChallengeDef[];
  registerMicro(gameId: string, challenges: readonly MicroChallengeDef[]): void;
  /** Every game a run can pick, with its challenges. */
  runCandidates(): RunCandidate[];
  /**
   * Loads every playable game's module once and registers its patches and
   * micro-challenges, so growth, the jacket and the run know them without the
   * game having been played in this visit. Resolves when all are in.
   */
  loadGameData(): Promise<void>;
  switches(): DifficultySwitches;
  setSwitch(side: SwitchSide, position: SwitchPosition): void;
  /** The kid a game's bot seat gets: the next one to beat on the Block Ladder. */
  opponentFor(gameId: string): KidId;
  seatsFor(manifest: GameManifest): SeatInfo[];
  lampLit(place: CounterPlace): boolean;
  litLamps(): number[];
  streak(now?: Date): StreakView;
  /** Everything the room has grown, whether or not the player chose to show it. */
  growth(): GrowthItem[];
  /** Marks items as revealed so each sparkles in only once. */
  markGrowthSeen(items: readonly GrowthItem[]): void;
  /**
   * The items among these not yet toasted in this visit, now marked as
   * toasted: the results screen and the Den both announce new growth, and
   * whichever comes first says it once.
   */
  announceGrowth(items: readonly GrowthItem[]): GrowthItem[];
  /**
   * `litBefore` is the Counter's lit lamps when the session began: patches are
   * earned during play, so by the time a run is reported its lamp is already lit.
   */
  recordFinishedRun(input: {
    manifest: GameManifest;
    run: RunInfo;
    result: GameResult;
    seats: readonly SeatInfo[];
    litBefore: readonly number[];
  }): RunAftermath;
  /** Anything Den Life shows changed: progress, stats or the switches. */
  onChange(listener: () => void): Unsubscribe;
}

export function createDenLife(
  services: Pick<Services, 'registry' | 'repos' | 'settings' | 'stats'>,
  options: { playable?: (manifest: GameManifest) => boolean } = {},
): DenLife {
  const { registry, repos, settings } = services;
  const catalog = new Map<string, readonly PatchDef[]>();
  const announced = new Set<string>();
  const micro = new Map<string, readonly MicroChallengeDef[]>();
  let gameData: Promise<void> | null = null;
  const changes = createEmitter<undefined>();
  const places = counterPlaces(registry.manifests);
  const notify = () => changes.emit(undefined);
  repos.progress.onChange(notify);
  repos.stats.onChange(notify);
  settings.onChange(notify);

  const lampLit = (place: CounterPlace) => placeFinished(place, repos.progress.get());

  const litLamps = () => places.filter(lampLit).map((place) => place.slot);

  const tiersByGame = () =>
    new Map(
      registry.manifests.map((manifest) => {
        const defs = catalog.get(manifest.id) ?? [];
        return [
          manifest.id,
          {
            club: defs.filter((def) => def.tier === 'club').map((def) => def.id),
            legend: defs.filter((def) => def.tier === 'legend').map((def) => def.id),
          },
        ] as const;
      }),
    );

  const growth = () =>
    earnedGrowth(
      growthFacts({
        manifests: registry.manifests,
        patchTiers: tiersByGame(),
        progress: repos.progress.get(),
        allLampsLit: litLamps().length === places.length,
        ...(options.playable ? { playable: options.playable } : {}),
      }),
    );

  const opponentFor = (gameId: string): KidId => {
    const chosen = settings.game(gameId).get<KidId | null>('opponent', null);
    return chosen ?? blockLadder(repos.progress.get().den.kids).next ?? 'lou';
  };

  return {
    patchesFor: (gameId) => catalog.get(gameId) ?? [],
    registerPatches(gameId, patches) {
      catalog.set(gameId, patches);
      notify();
    },
    microFor: (gameId) => micro.get(gameId) ?? [],
    registerMicro(gameId, challenges) {
      micro.set(gameId, challenges);
    },
    runCandidates: () =>
      registry.manifests.flatMap((manifest) => {
        const challenges = micro.get(manifest.id) ?? [];
        return challenges.length > 0 ? [{ game: manifest.id, challenges }] : [];
      }),
    loadGameData() {
      gameData ??= Promise.all(
        registry.entries
          .filter((entry) => entry.load !== undefined && entry.manifest.status === 'playable')
          .map(async (entry) => {
            const module = await entry.load?.();
            if (!module) return;
            // Whatever was registered first stays: a session's own module, or the dev showcase's set.
            if (!catalog.has(entry.manifest.id)) catalog.set(entry.manifest.id, module.patches);
            if (!micro.has(entry.manifest.id)) micro.set(entry.manifest.id, module.microChallenges ?? []);
          }),
      ).then(notify);
      return gameData;
    },
    switches: () => settings.get().difficulty,
    setSwitch(side, position) {
      settings.update((draft) => {
        draft.difficulty = { ...draft.difficulty, [side]: position };
      });
    },
    opponentFor,
    seatsFor(manifest) {
      const player: SeatInfo = { seat: 1, kind: 'human', name: services.repos.profile.get().displayName };
      if (manifest.versus === 'local') return [player, { seat: 2, kind: 'human', name: 'Player 2' }];
      const kid = opponentFor(manifest.id);
      return [player, { seat: 2, kind: 'bot', kid, name: kidById(kid).name }];
    },
    lampLit,
    litLamps,
    streak: (now = new Date()) => streakView(repos.progress.get().den.streak, now),
    growth,
    markGrowthSeen(items) {
      if (items.length === 0) return;
      const at = new Date().toISOString();
      repos.progress.update((draft) => {
        for (const item of items) draft.den.growthSeen[item.id] ??= at;
      });
    },
    announceGrowth(items) {
      const fresh = items.filter((item) => !announced.has(item.id));
      for (const item of fresh) announced.add(item.id);
      return fresh;
    },
    recordFinishedRun({ manifest, run, result, seats, litBefore }) {
      const now = new Date();
      const lampsBefore = new Set(litBefore);
      let dailyCounted = false;
      const switches = settings.get().difficulty;
      repos.progress.update((draft) => {
        draft.den.streak = recordStreakDay(draft.den.streak, now);
        if (run.mode === 'daily') {
          const emoji = result.emoji !== undefined && emojiSummary(result.emoji) !== null ? result.emoji : null;
          const recorded = recordDailyRun(draft.den.daily, now, manifest.id, {
            score: result.score,
            scoreLabel: result.scoreLabel,
            emoji,
            channel: run.channel,
            at: now.toISOString(),
          });
          draft.den.daily = recorded.daily;
          dailyCounted = recorded.counted;
        }
        const opponent = seats.find((seat) => seat.kind === 'bot')?.kid;
        // Against a Kid, a game may report only whether the player won; that is the same answer.
        const winner = result.winnerSeat !== undefined ? result.winnerSeat : result.won === undefined ? undefined : result.won ? 1 : 2;
        if (opponent !== undefined && winner !== undefined) {
          const outcome = winner === 1 ? 'win' : winner === 2 ? 'loss' : 'draw';
          draft.den.kids = recordKidResult(draft.den.kids, opponent, outcome, switches.left === 'A', now.toISOString());
        }
      });
      const seen = repos.progress.get().den.growthSeen;
      return {
        dailyCounted,
        newGrowth: newGrowth(growth(), seen),
        newLamps: litLamps().filter((slot) => !lampsBefore.has(slot)),
      };
    },
    onChange: (listener) => changes.on(listener),
  };
}

