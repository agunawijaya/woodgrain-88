/**
 * Turns a play route's query (#/play/<id>?mode=daily&ch=...) into the run a
 * game is started with: mode, channel, seed and, for a challenge link, the
 * verified score to beat. A tampered or broken challenge simply becomes a
 * normal run.
 */
import {
  dailyNumber,
  dailySeed,
  decodeChallenge,
  randomSeed,
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
): RunInfo {
  const firstChannel = manifest.channels[0]?.id ?? 'classic';
  const knownChannel = (id: string | null) =>
    id !== null && manifest.channels.some((channel) => channel.id === id) ? id : firstChannel;
  const requested = params.get('mode');

  if (requested === 'challenge') {
    const challenge = decodeChallenge(hash);
    if (challenge?.game === manifest.id) {
      return {
        mode: 'challenge',
        seed: challenge.seed,
        channel: knownChannel(challenge.channel),
        challenge,
      };
    }
  }
  if (requested === 'daily' && manifest.supports.daily) {
    return {
      mode: 'daily',
      seed: dailySeed(manifest.id, now),
      channel: knownChannel(params.get('ch')),
      dailyNumber: dailyNumber(now),
    };
  }
  const mode: RunMode = isRunMode(requested) && requested !== 'challenge' && requested !== 'daily' ? requested : 'normal';
  return { mode, seed: randomSeed(), channel: knownChannel(params.get('ch')) };
}
