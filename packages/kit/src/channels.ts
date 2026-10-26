/**
 * Channels: each game's curated variations, a nod to the numbered game
 * variations of the original cartridges ("Game 1–27"), presented as TV
 * channels you tune into rather than a menu of numbers.
 *
 * A channel id is stable forever: records, challenge links and progress are
 * keyed by it. Whether a channel is open is data; prompt 01 supplies the
 * unlock rule, and until then every channel is open.
 */
import type { Repository } from './store/repos.ts';
import { emptyGameProgress } from './store/schema.ts';
import type { GameProgressData, ProgressData } from './store/types.ts';

export interface ChannelDef {
  /** kebab-case, unique within the game, never renamed. */
  id: string;
  /** At most 24 characters. */
  title: string;
  /** One line, at most 90 characters. */
  description: string;
}

export interface ChannelState extends ChannelDef {
  unlocked: boolean;
  /** Position in the game's list, from 0. */
  index: number;
}

/** Decides whether a channel is open. Prompt 01 replaces the default. */
export type UnlockRule = (
  gameId: string,
  channel: ChannelDef,
  index: number,
  progress: GameProgressData | undefined,
) => boolean;

export const EVERY_CHANNEL_OPEN: UnlockRule = () => true;

export const MAX_CHANNELS = 8;

export interface ChannelRegistry {
  /** The game's channels in manifest order with their unlock state; [] for an unknown game. */
  list(gameId: string): ChannelState[];
  get(gameId: string, channelId: string): ChannelState | null;
  /** The first channel in the manifest. Throws for a game without channels. */
  defaultChannel(gameId: string): ChannelDef;
  isUnlocked(gameId: string, channelId: string): boolean;
  /** Records an unlock in progress; returns true only when it was not already recorded. */
  unlock(gameId: string, channelId: string): boolean;
}

export interface ChannelRegistryOptions {
  games: readonly { id: string; channels: readonly ChannelDef[] }[];
  progress: Repository<ProgressData>;
  rule?: UnlockRule;
  now?: () => Date;
}

const KEBAB_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_TITLE_LENGTH = 24;
const MAX_DESCRIPTION_LENGTH = 90;

/**
 * A channel counts as unlocked when the rule says so or when progress has an
 * unlock recorded for it.
 */
export function createChannelRegistry(options: ChannelRegistryOptions): ChannelRegistry {
  const rule = options.rule ?? EVERY_CHANNEL_OPEN;
  const now = options.now ?? (() => new Date());
  const gamesMap = new Map<string, readonly ChannelDef[]>(
    options.games.map((game) => [game.id, game.channels]),
  );

  function list(gameId: string): ChannelState[] {
    const channels = gamesMap.get(gameId);
    if (channels === undefined) {
      return [];
    }
    const gameProgress = options.progress.get().games[gameId];
    return channels.map((channel, index) => ({
      ...channel,
      index,
      unlocked:
        gameProgress?.channels[channel.id] !== undefined ||
        rule(gameId, channel, index, gameProgress),
    }));
  }

  function get(gameId: string, channelId: string): ChannelState | null {
    const state = list(gameId).find((item) => item.id === channelId);
    return state ?? null;
  }

  function defaultChannel(gameId: string): ChannelDef {
    const channels = gamesMap.get(gameId);
    const first = channels?.[0];
    if (first === undefined) {
      throw new Error(`${gameId} has no channels`);
    }
    return first;
  }

  function isUnlocked(gameId: string, channelId: string): boolean {
    const state = get(gameId, channelId);
    return state?.unlocked === true;
  }

  function unlock(gameId: string, channelId: string): boolean {
    const existing = options.progress.get().games[gameId]?.channels[channelId];
    if (existing !== undefined) {
      return false;
    }
    const unlockedAt = now().toISOString();
    options.progress.update((draft) => {
      const gameEntry = (draft.games[gameId] ??= emptyGameProgress());
      gameEntry.channels[channelId] = { unlockedAt };
    });
    return true;
  }

  return {
    list,
    get,
    defaultChannel,
    isUnlocked,
    unlock,
  };
}

/** Problems with a game's channel list: count 1–MAX_CHANNELS, ids kebab-case and unique, lengths. */
export function validateChannels(channels: readonly ChannelDef[]): string[] {
  const problems: string[] = [];

  if (channels.length < 1 || channels.length > MAX_CHANNELS) {
    problems.push(`Channel count must be between 1 and ${MAX_CHANNELS}, got ${channels.length}.`);
  }

  const seen = new Set<string>();
  for (const channel of channels) {
    if (!KEBAB_ID_RE.test(channel.id)) {
      problems.push(`Channel id "${channel.id}" must be kebab-case.`);
    }
    if (seen.has(channel.id)) {
      problems.push(`Duplicate channel id "${channel.id}".`);
    } else {
      seen.add(channel.id);
    }
    if (channel.title.trim().length < 1 || channel.title.length > MAX_TITLE_LENGTH) {
      problems.push(`Channel "${channel.id}" title must be 1–${MAX_TITLE_LENGTH} characters.`);
    }
    if (
      channel.description.trim().length < 1 ||
      channel.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      problems.push(
        `Channel "${channel.id}" description must be 1–${MAX_DESCRIPTION_LENGTH} characters.`,
      );
    }
  }

  return problems;
}
