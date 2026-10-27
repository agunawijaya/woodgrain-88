/**
 * The channel picker's model: a 1988 TV dial. Channels are numbered from 1
 * in the manifest's order and grouped on a strip; the player turns the knob,
 * clicks a channel, uses the arrows, types a number on the "remote" (1, 4,
 * Enter) or asks for a surprise. No DOM: the picker view turns pointer and
 * key events into `dialReduce` actions and plays whatever comes back as
 * `commit`.
 *
 * A locked Remix channel can be tuned to, so the player can read what opens
 * it, but never played.
 */
import { createRng, type ChannelDef, type ChannelKind } from '@woodgrain-88/kit';

export interface DialChannel {
  id: string;
  /** 1-based position in the manifest's order. */
  number: number;
  title: string;
  kind: ChannelKind;
  /** The strip heading: the channel's `group`, else "Remix" for a remix channel, else null. */
  group: string | null;
  locked: boolean;
}

export interface DialGroup {
  group: string | null;
  channels: DialChannel[];
}

export interface DialState {
  readonly channels: readonly DialChannel[];
  readonly selected: string;
  /** Digits typed on the remote so far, '' when none. */
  readonly typed: string;
  /** When the last digit was typed (ms, the caller's clock), null when none. */
  readonly typedAt: number | null;
  /** One short line for the player (a wrong number, a locked channel), null when none. */
  readonly message: string | null;
}

export type DialAction =
  | { type: 'key'; key: string; at: number }
  | { type: 'turn'; steps: number }
  | { type: 'pick'; id: string }
  | { type: 'surprise'; seed: number }
  | { type: 'tick'; at: number };

export interface DialOutcome {
  state: DialState;
  /** The channel to play now, or null when the action only moved the selection. */
  commit: string | null;
}

/** After this long without another digit, a half-typed number is dropped. */
export const TYPE_TIMEOUT_MS = 1500;
/** The knob sweeps from -150° to +150°; channel 1 at -150, the last at +150. */
export const DIAL_SWEEP_DEGREES = 300;

export function dialChannels(
  defs: readonly ChannelDef[],
  isUnlocked: (id: string) => boolean,
): DialChannel[] {
  return defs.map((def, index) => ({
    id: def.id,
    number: index + 1,
    title: def.title,
    kind: def.kind,
    group: def.group?.trim() ? def.group : def.kind === 'remix' ? 'Remix' : null,
    locked: def.kind === 'remix' && !isUnlocked(def.id),
  }));
}

/** Consecutive runs of the same group, in order (a group that comes back later is a new run). */
export function dialGroups(channels: readonly DialChannel[]): DialGroup[] {
  const groups: DialGroup[] = [];
  for (const channel of channels) {
    const current = groups.at(-1);
    if (current?.group === channel.group) current.channels.push(channel);
    else groups.push({ group: channel.group, channels: [channel] });
  }
  return groups;
}

/** Starts on `selected` if it exists, else the first channel. Throws on an empty list. */
export function createDialState(channels: readonly DialChannel[], selected?: string): DialState {
  const first = channels[0];
  if (!first) throw new RangeError('A dial needs at least one channel');
  return {
    channels,
    selected: channels.some((channel) => channel.id === selected)
      ? (selected ?? first.id)
      : first.id,
    typed: '',
    typedAt: null,
    message: null,
  };
}

/** The knob's angle for a channel; a single channel sits at 0. */
export function dialAngle(channels: readonly DialChannel[], id: string): number {
  const index = channels.findIndex((channel) => channel.id === id);
  if (channels.length <= 1 || index === -1) return 0;
  return -DIAL_SWEEP_DEGREES / 2 + (index / (channels.length - 1)) * DIAL_SWEEP_DEGREES;
}

/** The channel nearest to a knob angle (for dragging the knob), clamped to the sweep. */
export function channelAtAngle(channels: readonly DialChannel[], degrees: number): DialChannel {
  const first = channels[0];
  if (!first) throw new RangeError('A dial needs at least one channel');
  if (channels.length === 1 || !Number.isFinite(degrees)) return first;
  const half = DIAL_SWEEP_DEGREES / 2;
  const fraction = (Math.max(-half, Math.min(half, degrees)) + half) / DIAL_SWEEP_DEGREES;
  return channels[Math.round(fraction * (channels.length - 1))] ?? first;
}

export function dialReduce(state: DialState, action: DialAction): DialOutcome {
  switch (action.type) {
    case 'turn':
      return stay(moveBy(state, action.steps));
    case 'pick':
      return play(state, action.id);
    case 'surprise':
      return surprise(state, action.seed);
    case 'tick':
      return stay(expireTyping(state, action.at));
    case 'key':
      return onKey(state, action.key, action.at);
  }
}

// ——— Helpers ———

/** Every outcome carries its own state object, even when nothing changed. */
const stay = (state: DialState): DialOutcome => ({ state: { ...state }, commit: null });

/** The selection moved by something other than typing: the remote's half-typed number is dropped. */
function select(state: DialState, id: string, message: string | null = null): DialState {
  return { ...state, selected: id, typed: '', typedAt: null, message };
}

/** The channel a typed number stands for, if any. */
function channelNumbered(state: DialState, typed: string): DialChannel | undefined {
  const number = Number(typed);
  return Number.isInteger(number) && number >= 1 ? state.channels[number - 1] : undefined;
}

const indexOf = (state: DialState) =>
  Math.max(
    0,
    state.channels.findIndex((channel) => channel.id === state.selected),
  );

function moveBy(state: DialState, steps: number): DialState {
  const count = state.channels.length;
  const index = (((indexOf(state) + steps) % count) + count) % count;
  return select(state, state.channels[index]?.id ?? state.selected);
}

function moveTo(state: DialState, index: number): DialState {
  return select(state, state.channels[index]?.id ?? state.selected);
}

/** To the first channel of the next or previous group run; no wrapping. */
function page(state: DialState, direction: 1 | -1): DialState {
  const groups = dialGroups(state.channels);
  const here = groups.findIndex((group) =>
    group.channels.some((channel) => channel.id === state.selected),
  );
  const target = groups[here + direction]?.channels[0];
  return select(state, target?.id ?? state.selected);
}

/** Commits a channel when it is open; a locked one is selected with a line saying so. */
function play(state: DialState, id: string): DialOutcome {
  const channel = state.channels.find((candidate) => candidate.id === id);
  if (!channel) return stay(state);
  if (channel.locked) return stay(select(state, channel.id, `${channel.title} is locked`));
  return { state: select(state, channel.id), commit: channel.id };
}

function surprise(state: DialState, seed: number): DialOutcome {
  const open = state.channels.filter((channel) => !channel.locked);
  const others = open.filter((channel) => channel.id !== state.selected);
  const chosen = others.length > 0 ? createRng(seed).pick(others) : open[0];
  return chosen ? play(state, chosen.id) : stay(state);
}

function enter(state: DialState): DialOutcome {
  const typed = state.typed === '' ? undefined : channelNumbered(state, state.typed);
  return play(state, typed?.id ?? state.selected);
}

function typeDigit(state: DialState, digit: string, at: number): DialState {
  // A leading zero means nothing on a remote.
  if (state.typed === '' && digit === '0') return state;
  const typed = state.typed + digit;
  const channel = channelNumbered(state, typed);
  if (!channel)
    return { ...state, typed: '', typedAt: null, message: `No channel ${Number(typed)}` };
  // Complete when no longer number could still be a channel: with 30 channels, 4 is, 2 is not.
  const complete = Number(typed) * 10 > state.channels.length;
  return {
    ...state,
    selected: channel.id,
    typed: complete ? '' : typed,
    typedAt: complete ? null : at,
  };
}

function backspace(state: DialState): DialState {
  if (state.typed === '') return { ...state, message: null };
  const typed = state.typed.slice(0, -1);
  return {
    ...state,
    selected: channelNumbered(state, typed)?.id ?? state.selected,
    typed,
    typedAt: typed === '' ? null : state.typedAt,
    message: null,
  };
}

/** A half-typed number left long enough counts as typed, then the remote is clear again. */
function expireTyping(state: DialState, at: number): DialState {
  if (state.typed === '' || state.typedAt === null || at - state.typedAt < TYPE_TIMEOUT_MS)
    return state;
  return {
    ...state,
    selected: channelNumbered(state, state.typed)?.id ?? state.selected,
    typed: '',
    typedAt: null,
  };
}

function onKey(state: DialState, key: string, at: number): DialOutcome {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return stay(moveBy(state, 1));
    case 'ArrowLeft':
    case 'ArrowUp':
      return stay(moveBy(state, -1));
    case 'Home':
      return stay(moveTo(state, 0));
    case 'End':
      return stay(moveTo(state, state.channels.length - 1));
    case 'PageDown':
      return stay(page(state, 1));
    case 'PageUp':
      return stay(page(state, -1));
    case 'Enter':
      return enter(state);
    case 'Backspace':
      return stay(backspace(state));
    case 's':
    case 'S':
      return surprise(state, at);
    default:
      return stay(/^\d$/.test(key) ? typeDigit(state, key, at) : state);
  }
}
