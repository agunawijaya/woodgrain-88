/**
 * Channels: a game's variations, tuned like TV channels rather than picked
 * from a menu of numbers. Every variation of the original program is a
 * channel and open from the first play, as on the cartridge ("Game 1–27").
 * Remix channels are rule sets we design per game; each names the patch that
 * opens it.
 *
 * A channel id is stable forever: records, challenge links and progress are
 * keyed by it.
 */
import type { Repository } from './store/repos.ts';
import { emptyGameProgress } from './store/schema.ts';
import type { GameProgressData, ProgressData } from './store/types.ts';

export type ChannelKind = 'original' | 'remix';

export interface ChannelDef {
  /** kebab-case, unique within the game, never renamed. */
  id: string;
  kind: ChannelKind;
  /** At most 24 characters. */
  title: string;
  /** One line, at most 90 characters. */
  description: string;
  /** For games with many variations: the strip heading it sits under, e.g. "Biplanes". At most 20 characters. */
  group?: string;
  /** An original channel's variation number(s) on the cartridge, so details can say "Game 14 on the cartridge". */
  originalGame?: readonly number[];
  /** A remix channel's opening patch: the id of one of the game's own patches. */
  unlockedBy?: string;
}

export interface ChannelState extends ChannelDef {
  unlocked: boolean;
  /** Position in the game's list, from 0. */
  index: number;
}

/** Decides whether a channel is open; recorded unlocks count as open regardless. */
export type UnlockRule = (
  gameId: string,
  channel: ChannelDef,
  index: number,
  progress: GameProgressData | undefined,
) => boolean;

/** Originals are always open; a remix opens once its patch has been earned. */
export const ORIGINALS_OPEN_REMIX_BY_PATCH: UnlockRule = (_gameId, channel, _index, progress) =>
  channel.kind === 'original' ||
  (channel.unlockedBy !== undefined && Boolean(progress?.patches[channel.unlockedBy]?.earnedAt));

/**
 * The largest original offers 36 selectable variations (nine rule sets in four
 * mazes) and two others 27; 64 leaves room for a full set of originals plus a
 * dozen remixes while keeping the channel picker one screen tall.
 */
export const MAX_CHANNELS = 64;
const MAX_GROUP_LENGTH = 20;

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
  const rule = options.rule ?? ORIGINALS_OPEN_REMIX_BY_PATCH;
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

/**
 * Problems with a game's channel list: count 1–MAX_CHANNELS with at least one
 * original, ids kebab-case and unique, lengths, and the kind rules (an
 * original never needs unlocking; a remix always names its patch).
 */
export function validateChannels(channels: readonly ChannelDef[]): string[] {
  const problems: string[] = [];

  if (channels.length < 1 || channels.length > MAX_CHANNELS) {
    problems.push(`Channel count must be between 1 and ${MAX_CHANNELS}, got ${channels.length}.`);
  }
  if (!channels.some((channel) => channel.kind === 'original')) {
    problems.push('At least one channel must be an original variation.');
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
    problems.push(...kindProblems(channel));
  }

  return problems;
}

function kindProblems(channel: ChannelDef): string[] {
  const problems: string[] = [];
  if (channel.group !== undefined && (channel.group.trim().length < 1 || channel.group.length > MAX_GROUP_LENGTH)) {
    problems.push(`Channel "${channel.id}" group must be 1–${MAX_GROUP_LENGTH} characters.`);
  }
  if (channel.kind === 'original') {
    if (channel.unlockedBy !== undefined) problems.push(`Original channel "${channel.id}" cannot need unlocking.`);
    if (channel.originalGame?.some((game) => !Number.isInteger(game) || game < 1 || game > MAX_CHANNELS)) {
      problems.push(`Channel "${channel.id}" originalGame numbers must be whole numbers 1–${MAX_CHANNELS}.`);
    }
  } else {
    if (channel.unlockedBy === undefined || !KEBAB_ID_RE.test(channel.unlockedBy)) {
      problems.push(`Remix channel "${channel.id}" must name the patch that opens it.`);
    }
    if (channel.originalGame !== undefined) problems.push(`Remix channel "${channel.id}" has no original game number.`);
  }
  return problems;
}

/** A game's remix channels must each be opened by one of its own patches. */
export function validateRemixUnlocks(channels: readonly ChannelDef[], patchIds: readonly string[]): string[] {
  return channels
    .filter((channel) => channel.kind === 'remix' && channel.unlockedBy !== undefined && !patchIds.includes(channel.unlockedBy))
    .map((channel) => `Remix channel "${channel.id}" names unknown patch "${channel.unlockedBy ?? ''}".`);
}

/** A channel's number on the dial: 1 for the first in the manifest's order, 0 if the id is unknown. */
export function channelNumber(channels: readonly ChannelDef[], id: string): number {
  return channels.findIndex((channel) => channel.id === id) + 1;
}
