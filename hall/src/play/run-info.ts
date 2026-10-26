/**
 * Turns a play route's query (#/play/<id>?mode=daily&ch=...&version=...) into
 * the run a game is started with: mode, channel, seed, cartridge version and,
 * for a challenge link, the verified score to beat. A tampered or broken
 * challenge simply becomes a normal run.
 *
 * The version is the one a challenge was set on, else the one the route asks
 * for (the Den's channels do), else the player's saved choice, else the
 * game's default; games without versions get none.
 */
import {
  dailyNumber,
  dailySeed,
  decodeChallenge,
  randomSeed,
  resolveVersion,
  RUN_MODES,
  type GameManifest,
  type RunInfo,
  type RunMode,
} from '@woodgrain-88/kit';

function isRunMode(value: string | null): value is RunMode {
  return value !== null && (RUN_MODES as readonly string[]).includes(value);
}

export function runFromParams(
  manifest: GameManifest,
  params: URLSearchParams,
  hash: string,
  now: Date = new Date(),
  savedVersion?: string,
): RunInfo {
  const withVersion = (run: RunInfo, ...requested: (string | null | undefined)[]): RunInfo => {
    const version = resolveVersion(manifest, ...requested, savedVersion);
    return version === undefined ? run : { ...run, version };
  };
  const firstChannel = manifest.channels[0]?.id ?? 'classic';
  const knownChannel = (id: string | null) =>
    id !== null && manifest.channels.some((channel) => channel.id === id) ? id : firstChannel;
  const requested = params.get('mode');

  if (requested === 'challenge') {
    const challenge = decodeChallenge(hash);
    if (challenge?.game === manifest.id) {
      const run: RunInfo = { mode: 'challenge', seed: challenge.seed, channel: knownChannel(challenge.channel), challenge };
      return withVersion(run, challenge.version);
    }
  }
  if (requested === 'daily' && manifest.supports.daily) {
    const run: RunInfo = {
      mode: 'daily',
      seed: dailySeed(manifest.id, now),
      channel: knownChannel(params.get('ch')),
      dailyNumber: dailyNumber(now),
    };
    return withVersion(run, params.get('version'));
  }
  const mode: RunMode = isRunMode(requested) && requested !== 'challenge' && requested !== 'daily' ? requested : 'normal';
  return withVersion({ mode, seed: randomSeed(), channel: knownChannel(params.get('ch')) }, params.get('version'));
}
