/**
 * Export and import of everything as one JSON file, so a player can move
 * their Den to another browser without any server. Import always shows a
 * preview first and never applies anything it could not validate.
 */
import { isPlainObject, REPO_NAMES, type Envelope, type RepoName } from './local-store.ts';
import type { Repositories } from './repos.ts';
import { SCHEMA_VERSIONS, upgrade, type RepoDataMap, type SchemaContext } from './schema.ts';

export const EXPORT_APP = 'woodgrain-88';
export const EXPORT_FORMAT = 1;
/** Files larger than this are refused before parsing. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export interface ExportBundle {
  app: typeof EXPORT_APP;
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  /** Every repository, each in its envelope at the current schema version. */
  repos: Partial<Record<RepoName, Envelope<unknown>>>;
}

/** What the import preview tells the player before they confirm. */
export interface ImportSummary {
  exportedAt: string;
  displayName: string | null;
  /** Games with at least one record. */
  gamesWithRecords: number;
  /** Total runs across all record boards. */
  runs: number;
  patchesEarned: number;
  sessions: number;
}

export type ImportPreview =
  | { ok: true; bundle: ExportBundle; summary: ImportSummary }
  | { ok: false; error: string };

function resolveContext(context?: Partial<SchemaContext>): SchemaContext {
  return {
    now: context?.now ?? (() => new Date()),
    newId: context?.newId ?? (() => crypto.randomUUID()),
  };
}

function upgradeCandidate<N extends RepoName>(
  name: N,
  rawRepos: Record<string, unknown>,
  context: SchemaContext,
): RepoDataMap[N] | null {
  const rawEnv = rawRepos[name];
  if (!isPlainObject(rawEnv)) return null;
  const version = rawEnv.v;
  if (typeof version !== 'number' || !Number.isInteger(version) || !('data' in rawEnv)) {
    return null;
  }
  return upgrade(name, { v: version, data: rawEnv.data }, context);
}

export function exportAll(repos: Repositories, now?: Date): ExportBundle {
  const timestamp = (now ?? new Date()).toISOString();
  const bundleRepos: Partial<Record<RepoName, Envelope<unknown>>> = {};
  for (const name of REPO_NAMES) {
    bundleRepos[name] = {
      v: SCHEMA_VERSIONS[name],
      data: structuredClone(repos[name].get()),
    };
  }
  return {
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    exportedAt: timestamp,
    repos: bundleRepos,
  };
}

/** e.g. "woodgrain-88-2026-10-25.json" (UTC date). */
export function exportFileName(now?: Date): string {
  const date = now ?? new Date();
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${EXPORT_APP}-${year}-${month}-${day}.json`;
}

/**
 * Validates an export file's text. Refuses (ok: false with a short,
 * player-readable reason) when it is too large, not JSON, not an object, the
 * wrong app, or a newer format. Each repository is upgraded and sanitised;
 * repositories that fail are left out of the bundle, unknown repository names
 * are ignored. A file with no usable repository is refused.
 */
export function previewImport(text: string, context?: Partial<SchemaContext>): ImportPreview {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "That file is too big to be a Woodgrain '88 save." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not a Woodgrain '88 save." };
  }

  if (!isPlainObject(parsed) || parsed.app !== EXPORT_APP) {
    return { ok: false, error: "That file is not a Woodgrain '88 save." };
  }

  const format = parsed.format;
  if (typeof format !== 'number' || !Number.isInteger(format) || format < 1) {
    return { ok: false, error: "That file is not a Woodgrain '88 save." };
  }

  if (format > EXPORT_FORMAT) {
    return { ok: false, error: "That save comes from a newer version of Woodgrain '88." };
  }

  if (!isPlainObject(parsed.repos)) {
    return { ok: false, error: 'That save has nothing we can read.' };
  }

  const fullContext = resolveContext(context);
  const profile = upgradeCandidate('profile', parsed.repos, fullContext);
  const settings = upgradeCandidate('settings', parsed.repos, fullContext);
  const progress = upgradeCandidate('progress', parsed.repos, fullContext);
  const records = upgradeCandidate('records', parsed.repos, fullContext);
  const stats = upgradeCandidate('stats', parsed.repos, fullContext);
  const saves = upgradeCandidate('saves', parsed.repos, fullContext);
  const eventLog = upgradeCandidate('event-log', parsed.repos, fullContext);

  const bundleRepos: Partial<Record<RepoName, Envelope<unknown>>> = {};
  if (profile !== null) bundleRepos.profile = { v: SCHEMA_VERSIONS.profile, data: profile };
  if (settings !== null) bundleRepos.settings = { v: SCHEMA_VERSIONS.settings, data: settings };
  if (progress !== null) bundleRepos.progress = { v: SCHEMA_VERSIONS.progress, data: progress };
  if (records !== null) bundleRepos.records = { v: SCHEMA_VERSIONS.records, data: records };
  if (stats !== null) bundleRepos.stats = { v: SCHEMA_VERSIONS.stats, data: stats };
  if (saves !== null) bundleRepos.saves = { v: SCHEMA_VERSIONS.saves, data: saves };
  if (eventLog !== null) {
    bundleRepos['event-log'] = { v: SCHEMA_VERSIONS['event-log'], data: eventLog };
  }

  if (Object.keys(bundleRepos).length === 0) {
    return { ok: false, error: 'That save has nothing we can read.' };
  }

  const rawExportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt.trim() : '';
  const exportedAt = rawExportedAt.length > 0 ? rawExportedAt : fullContext.now().toISOString();

  const gamesWithRuns = new Set<string>();
  let runs = 0;
  if (records !== null) {
    for (const [boardKey, boardRuns] of Object.entries(records.boards)) {
      runs += boardRuns.length;
      if (boardRuns.length > 0) {
        const slashIndex = boardKey.indexOf('/');
        const gameId = slashIndex >= 0 ? boardKey.slice(0, slashIndex) : boardKey;
        if (gameId.length > 0) gamesWithRuns.add(gameId);
      }
    }
  }

  let patchesEarned = 0;
  if (progress !== null) {
    for (const gameProgress of Object.values(progress.games)) {
      for (const patch of Object.values(gameProgress.patches)) {
        if (patch.earnedAt !== null) patchesEarned += 1;
      }
    }
  }

  const summary: ImportSummary = {
    exportedAt,
    displayName: profile?.displayName ?? null,
    gamesWithRecords: gamesWithRuns.size,
    runs,
    patchesEarned,
    sessions: eventLog ? eventLog.sessions.length : 0,
  };

  return {
    ok: true,
    bundle: {
      app: EXPORT_APP,
      format: EXPORT_FORMAT,
      exportedAt,
      repos: bundleRepos,
    },
    summary,
  };
}

/** Replaces every repository present in the bundle; the others are untouched. */
export function applyImport(repos: Repositories, bundle: ExportBundle): void {
  const context = resolveContext();
  for (const name of REPO_NAMES) {
    const envelope = bundle.repos[name];
    if (envelope === undefined) continue;
    switch (name) {
      case 'profile': {
        const data = upgrade('profile', envelope, context);
        if (data !== null) repos.profile.set(data);
        break;
      }
      case 'settings': {
        const data = upgrade('settings', envelope, context);
        if (data !== null) repos.settings.set(data);
        break;
      }
      case 'progress': {
        const data = upgrade('progress', envelope, context);
        if (data !== null) repos.progress.set(data);
        break;
      }
      case 'records': {
        const data = upgrade('records', envelope, context);
        if (data !== null) repos.records.set(data);
        break;
      }
      case 'stats': {
        const data = upgrade('stats', envelope, context);
        if (data !== null) repos.stats.set(data);
        break;
      }
      case 'saves': {
        const data = upgrade('saves', envelope, context);
        if (data !== null) repos.saves.set(data);
        break;
      }
      case 'event-log': {
        const data = upgrade('event-log', envelope, context);
        if (data !== null) repos['event-log'].set(data);
        break;
      }
    }
  }
}
