/**
 * Patches: every game's published goals, sewn onto the player's denim jacket
 * in prompt 01. Thresholds are data and always visible (except a secret
 * patch's description, which shows its hint until earned), so a player always
 * knows exactly what earns what.
 *
 * Progress comes from game events. A goal measures one metric over all play:
 * how many times an event fired, the largest value a field reached in one
 * event, or the running sum of a field. A patch earned while the Pro switch is
 * on is "gold"; one first earned as Amateur turns gold when it is reached
 * again on Pro.
 */
import { createEmitter, type Unsubscribe } from './emitter.ts';
import type { EventBus, GameEventSchema, StampedEvent } from './events.ts';
import type { Repository } from './store/repos.ts';
import type { ProgressData } from './store/types.ts';
import type { IsoTime, RunMode } from './types.ts';

export const PATCH_TIERS = ['club', 'pro', 'legend', 'secret'] as const;
export type PatchTier = (typeof PATCH_TIERS)[number];

export type PatchMetric =
  | { kind: 'count'; event: string }
  | { kind: 'max'; event: string; field: string }
  | { kind: 'sum'; event: string; field: string };

export interface PatchGoal {
  metric: PatchMetric;
  /** Reached when the metric is at least this. Positive. */
  target: number;
  /** Only events from this channel count. */
  channel?: string;
  /** Only events from this run mode count. */
  mode?: RunMode;
}

export interface PatchDef {
  /** kebab-case, unique within the game, never renamed. */
  id: string;
  tier: PatchTier;
  /** At most 28 characters. */
  title: string;
  /** What earns it, in plain words. For a secret patch, shown only once earned. */
  description: string;
  /** A secret patch's teaser before it is earned. Required for secret patches. */
  hint?: string;
  goal: PatchGoal;
}

export interface PatchStatus {
  def: PatchDef;
  value: number;
  target: number;
  /** value / target, clamped to [0, 1]. */
  progress: number;
  earned: boolean;
  earnedAt: IsoTime | null;
  gold: boolean;
  /** What the UI may show as the description right now. */
  visibleDescription: string;
}

export interface PatchEarned {
  game: string;
  patch: PatchDef;
  gold: boolean;
  at: IsoTime;
  /** True when an already-earned patch just turned gold. */
  upgradedToGold: boolean;
}

export interface PatchTracker {
  /** Every patch of the game with its progress, in definition order. */
  status(gameId: string): PatchStatus[];
  /** Folds one event into progress and returns what it earned (usually nothing). */
  handle(event: StampedEvent): PatchEarned[];
  /** Fires for each newly earned or newly gold patch; the Hall shows a toast. */
  onEarned(listener: (earned: PatchEarned) => void): Unsubscribe;
  /** Subscribes `handle` to a bus. */
  connect(bus: EventBus): Unsubscribe;
}

export interface PatchTrackerOptions {
  games: readonly { id: string; patches: readonly PatchDef[] }[];
  progress: Repository<ProgressData>;
  /** Whether the Pro switch is on for this game right now. */
  isPro: (gameId: string) => boolean;
  now?: () => Date;
}

const KEBAB_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_PATCH_TITLE_LENGTH = 28;

function goalMatches(goal: PatchGoal, event: StampedEvent): boolean {
  if (goal.metric.event !== event.type) {
    return false;
  }
  if (goal.channel !== undefined && goal.channel !== event.channel) {
    return false;
  }
  if (goal.mode !== undefined && goal.mode !== event.mode) {
    return false;
  }
  return true;
}

function stepMetricValue(metric: PatchMetric, current: number, event: StampedEvent): number {
  if (metric.event !== event.type) {
    return current;
  }
  if (metric.kind === 'count') {
    return current + 1;
  }
  const raw = event.data?.[metric.field];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return current;
  }
  return metric.kind === 'max' ? Math.max(current, raw) : current + raw;
}

export function createPatchTracker(options: PatchTrackerOptions): PatchTracker {
  const now = options.now ?? (() => new Date());
  const earnedEmitter = createEmitter<PatchEarned>();
  const gamesMap = new Map<string, readonly PatchDef[]>(
    options.games.map((game) => [game.id, game.patches]),
  );

  function status(gameId: string): PatchStatus[] {
    const patches = gamesMap.get(gameId);
    if (patches === undefined) {
      return [];
    }
    const gameProgress = options.progress.get().games[gameId];
    return patches.map((def) => {
      const saved = gameProgress?.patches[def.id];
      const value = saved?.value ?? 0;
      const target = def.goal.target;
      const rawRatio = target > 0 ? value / target : 0;
      const progress = Math.min(1, Math.max(0, rawRatio));
      const earnedAt = saved?.earnedAt ?? null;
      const earned = earnedAt !== null;
      const gold = saved?.gold ?? false;
      const visibleDescription =
        def.tier === 'secret' && !earned ? (def.hint ?? '') : def.description;
      return {
        def,
        value,
        target,
        progress,
        earned,
        earnedAt,
        gold,
        visibleDescription,
      };
    });
  }

  function handle(event: StampedEvent): PatchEarned[] {
    const patches = gamesMap.get(event.game);
    if (patches === undefined) {
      return [];
    }
    const matching = patches.filter((patch) => goalMatches(patch.goal, event));
    if (matching.length === 0) {
      return [];
    }

    const earned: PatchEarned[] = [];
    const pro = options.isPro(event.game);
    const at = now().toISOString();

    options.progress.update((draft) => {
      const gameEntry = (draft.games[event.game] ??= {
        patches: {},
        channels: {},
        firstPlayedAt: null,
        secretsFound: {},
      });

      for (const patch of matching) {
        const existing = gameEntry.patches[patch.id];
        const prevValue = existing?.value ?? 0;
        const nextValue = stepMetricValue(patch.goal.metric, prevValue, event);
        if (nextValue === prevValue) {
          continue;
        }

        const prevEarnedAt = existing?.earnedAt ?? null;
        const wasEarned = prevEarnedAt !== null;
        const wasGold = existing?.gold ?? false;

        if (!wasEarned && nextValue >= patch.goal.target) {
          gameEntry.patches[patch.id] = {
            value: nextValue,
            earnedAt: at,
            gold: pro,
          };
          earned.push({
            game: event.game,
            patch,
            gold: pro,
            at,
            upgradedToGold: false,
          });
        } else if (wasEarned && !wasGold && pro && nextValue >= patch.goal.target) {
          gameEntry.patches[patch.id] = {
            value: nextValue,
            earnedAt: prevEarnedAt,
            gold: true,
          };
          earned.push({
            game: event.game,
            patch,
            gold: true,
            at,
            upgradedToGold: true,
          });
        } else {
          gameEntry.patches[patch.id] = {
            value: nextValue,
            earnedAt: prevEarnedAt,
            gold: wasGold,
          };
        }
      }
    });

    for (const item of earned) {
      earnedEmitter.emit(item);
    }

    return earned;
  }

  return {
    status,
    handle,
    onEarned(listener) {
      return earnedEmitter.on(listener);
    },
    connect(bus) {
      return bus.on((event) => {
        handle(event);
      });
    },
  };
}

/**
 * Problems with a game's patches: ids kebab-case and unique; at least one
 * club, one pro and one legend patch and at most one secret; secret patches
 * have a hint; every goal names a declared event, and max/sum goals a declared
 * numeric field of it; targets are positive finite numbers.
 */
export function validatePatches(
  patches: readonly PatchDef[],
  events: readonly GameEventSchema[],
): string[] {
  const problems: string[] = [];
  const tierCounts: Record<PatchTier, number> = {
    club: 0,
    pro: 0,
    legend: 0,
    secret: 0,
  };
  const seenIds = new Set<string>();
  const eventMap = new Map<string, GameEventSchema>(events.map((schema) => [schema.type, schema]));

  for (const patch of patches) {
    tierCounts[patch.tier] += 1;

    if (!KEBAB_ID_RE.test(patch.id)) {
      problems.push(`Patch id "${patch.id}" must be kebab-case.`);
    }
    if (seenIds.has(patch.id)) {
      problems.push(`Duplicate patch id "${patch.id}".`);
    } else {
      seenIds.add(patch.id);
    }

    if (patch.title.trim().length < 1 || patch.title.length > MAX_PATCH_TITLE_LENGTH) {
      problems.push(`Patch "${patch.id}" title must be 1–${MAX_PATCH_TITLE_LENGTH} characters.`);
    }
    if (patch.description.trim().length < 1) {
      problems.push(`Patch "${patch.id}" must have a non-empty description.`);
    }
    if (patch.tier === 'secret' && (patch.hint === undefined || patch.hint.trim().length < 1)) {
      problems.push(`Secret patch "${patch.id}" must have a non-empty hint.`);
    }

    if (!Number.isFinite(patch.goal.target) || patch.goal.target <= 0) {
      problems.push(`Patch "${patch.id}" target must be a positive finite number.`);
    }

    const metric = patch.goal.metric;
    const schema = eventMap.get(metric.event);
    if (schema === undefined) {
      problems.push(`Patch "${patch.id}" references undeclared event "${metric.event}".`);
    } else if (metric.kind === 'max' || metric.kind === 'sum') {
      const fieldType = schema.fields?.[metric.field];
      if (fieldType !== 'number') {
        problems.push(
          `Patch "${patch.id}" requires numeric field "${metric.field}" on event "${metric.event}".`,
        );
      }
    }
  }

  if (tierCounts.club < 1) {
    problems.push('At least one club patch is required.');
  }
  if (tierCounts.pro < 1) {
    problems.push('At least one pro patch is required.');
  }
  if (tierCounts.legend < 1) {
    problems.push('At least one legend patch is required.');
  }
  if (tierCounts.secret > 1) {
    problems.push('At most one secret patch is allowed.');
  }

  return problems;
}
