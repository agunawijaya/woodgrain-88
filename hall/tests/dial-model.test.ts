/**
 * Tests for the channel dial model: numbering, grouping, navigation, remote
 * typing, surprise selection, dial angles, and state immutability.
 */
import type { ChannelDef } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import {
  channelAtAngle,
  createDialState,
  dialAngle,
  dialChannels,
  dialGroups,
  dialReduce,
  DIAL_SWEEP_DEGREES,
  TYPE_TIMEOUT_MS,
  type DialState,
} from '../src/channels/dial-model.ts';

function createSampleDefs(count: number): ChannelDef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `channel-${index + 1}`,
    kind: 'original' as const,
    title: `Channel ${index + 1}`,
    description: `Description for channel ${index + 1}`,
  }));
}

function freezeState(state: DialState): DialState {
  Object.freeze(state.channels);
  for (const channel of state.channels) {
    Object.freeze(channel);
  }
  return Object.freeze({ ...state });
}

describe('dialChannels and dialGroups', () => {
  it('numbers channels from 1 and respects group runs including remix and returning groups', () => {
    const defs: ChannelDef[] = [
      { id: 'ch-1', kind: 'original', title: 'Open Sky', description: 'desc' },
      { id: 'ch-2', kind: 'original', title: 'Biplane A', description: 'desc', group: 'Biplanes' },
      { id: 'ch-3', kind: 'original', title: 'Biplane B', description: 'desc', group: 'Biplanes' },
      { id: 'ch-4', kind: 'original', title: 'Jets A', description: 'desc', group: 'Jets' },
      { id: 'ch-5', kind: 'original', title: 'Biplane C', description: 'desc', group: 'Biplanes' },
      { id: 'ch-6', kind: 'remix', title: 'Turbo Sky', description: 'desc', unlockedBy: 'patch-1' },
      {
        id: 'ch-7',
        kind: 'remix',
        title: 'Night Flight',
        description: 'desc',
        group: 'Night',
        unlockedBy: 'patch-2',
      },
    ];

    const isUnlocked = (id: string) => id === 'ch-7';
    const channels = dialChannels(defs, isUnlocked);

    expect(channels).toHaveLength(7);
    expect(channels[0]).toEqual({
      id: 'ch-1',
      number: 1,
      title: 'Open Sky',
      kind: 'original',
      group: null,
      locked: false,
    });
    expect(channels[1]).toEqual({
      id: 'ch-2',
      number: 2,
      title: 'Biplane A',
      kind: 'original',
      group: 'Biplanes',
      locked: false,
    });
    expect(channels[4]).toEqual({
      id: 'ch-5',
      number: 5,
      title: 'Biplane C',
      kind: 'original',
      group: 'Biplanes',
      locked: false,
    });
    expect(channels[5]).toEqual({
      id: 'ch-6',
      number: 6,
      title: 'Turbo Sky',
      kind: 'remix',
      group: 'Remix',
      locked: true,
    });
    expect(channels[6]).toEqual({
      id: 'ch-7',
      number: 7,
      title: 'Night Flight',
      kind: 'remix',
      group: 'Night',
      locked: false,
    });

    const groups = dialGroups(channels);
    expect(groups).toHaveLength(6);
    expect(groups[0]?.group).toBeNull();
    expect(groups[0]?.channels.map((c) => c.id)).toEqual(['ch-1']);
    expect(groups[1]?.group).toBe('Biplanes');
    expect(groups[1]?.channels.map((c) => c.id)).toEqual(['ch-2', 'ch-3']);
    expect(groups[2]?.group).toBe('Jets');
    expect(groups[2]?.channels.map((c) => c.id)).toEqual(['ch-4']);
    expect(groups[3]?.group).toBe('Biplanes');
    expect(groups[3]?.channels.map((c) => c.id)).toEqual(['ch-5']);
    expect(groups[4]?.group).toBe('Remix');
    expect(groups[4]?.channels.map((c) => c.id)).toEqual(['ch-6']);
    expect(groups[5]?.group).toBe('Night');
    expect(groups[5]?.channels.map((c) => c.id)).toEqual(['ch-7']);
  });
});

describe('createDialState', () => {
  it('throws on an empty channel list', () => {
    expect(() => createDialState([])).toThrow();
  });

  it('selects the requested channel if present or defaults to the first', () => {
    const channels = dialChannels(createSampleDefs(3), () => true);
    const defaultState = createDialState(channels);
    expect(defaultState.selected).toBe('channel-1');
    expect(defaultState.typed).toBe('');
    expect(defaultState.typedAt).toBeNull();
    expect(defaultState.message).toBeNull();

    const specificState = createDialState(channels, 'channel-2');
    expect(specificState.selected).toBe('channel-2');

    const unknownState = createDialState(channels, 'unknown-id');
    expect(unknownState.selected).toBe('channel-1');
  });
});

describe('moving and navigation', () => {
  it('wraps arrows at both ends, moves to Home and End, and steps through large turns', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const startState = createDialState(channels);

    // ArrowLeft wraps from first to last
    const prev = dialReduce(startState, { type: 'key', key: 'ArrowLeft', at: 100 });
    expect(prev.state.selected).toBe('channel-30');
    expect(prev.commit).toBeNull();

    // ArrowRight wraps from last to first
    const next = dialReduce(prev.state, { type: 'key', key: 'ArrowRight', at: 110 });
    expect(next.state.selected).toBe('channel-1');

    // ArrowUp wraps backward
    const up = dialReduce(startState, { type: 'key', key: 'ArrowUp', at: 120 });
    expect(up.state.selected).toBe('channel-30');

    // ArrowDown advances forward
    const down = dialReduce(startState, { type: 'key', key: 'ArrowDown', at: 130 });
    expect(down.state.selected).toBe('channel-2');

    // Home goes to first channel
    const home = dialReduce(prev.state, { type: 'key', key: 'Home', at: 140 });
    expect(home.state.selected).toBe('channel-1');

    // End goes to last channel
    const end = dialReduce(startState, { type: 'key', key: 'End', at: 150 });
    expect(end.state.selected).toBe('channel-30');

    // Turn with small positive and negative steps
    const turnForward = dialReduce(startState, { type: 'turn', steps: 3 });
    expect(turnForward.state.selected).toBe('channel-4');

    const turnBackward = dialReduce(startState, { type: 'turn', steps: -1 });
    expect(turnBackward.state.selected).toBe('channel-30');

    // Turn with large positive and negative steps
    const largeTurnPos = dialReduce(startState, { type: 'turn', steps: 100 });
    // 0 + 100 = 100 % 30 = index 10 (channel-11)
    expect(largeTurnPos.state.selected).toBe('channel-11');

    const largeTurnNeg = dialReduce(startState, { type: 'turn', steps: -100 });
    // (0 - 100) % 30 = -10 => index 20 (channel-21)
    expect(largeTurnNeg.state.selected).toBe('channel-21');
  });

  it('navigates group runs with PageDown and PageUp without wrapping at the edges', () => {
    const defs: ChannelDef[] = [
      { id: 'ch-1', kind: 'original', title: 'C1', description: 'd', group: 'A' },
      { id: 'ch-2', kind: 'original', title: 'C2', description: 'd', group: 'A' },
      { id: 'ch-3', kind: 'original', title: 'C3', description: 'd', group: 'B' },
      { id: 'ch-4', kind: 'original', title: 'C4', description: 'd', group: 'C' },
      { id: 'ch-5', kind: 'original', title: 'C5', description: 'd', group: 'C' },
    ];
    const channels = dialChannels(defs, () => true);
    const state = createDialState(channels, 'ch-1');

    // PageUp at start stays put
    const atStart = dialReduce(state, { type: 'key', key: 'PageUp', at: 100 });
    expect(atStart.state.selected).toBe('ch-1');

    // PageDown moves to first channel of next group run B
    const toB = dialReduce(state, { type: 'key', key: 'PageDown', at: 110 });
    expect(toB.state.selected).toBe('ch-3');

    // PageDown moves to first channel of next group run C
    const toC = dialReduce(toB.state, { type: 'key', key: 'PageDown', at: 120 });
    expect(toC.state.selected).toBe('ch-4');

    // PageDown at end stays put
    const atEnd = dialReduce(toC.state, { type: 'key', key: 'PageDown', at: 130 });
    expect(atEnd.state.selected).toBe('ch-4');

    // PageUp moves to first channel of previous group run B
    const backToB = dialReduce(atEnd.state, { type: 'key', key: 'PageUp', at: 140 });
    expect(backToB.state.selected).toBe('ch-3');

    // PageUp moves to first channel of previous group run A
    const backToA = dialReduce(backToB.state, { type: 'key', key: 'PageUp', at: 150 });
    expect(backToA.state.selected).toBe('ch-1');

    // From second channel of group A, PageUp stays put at the first run edge
    const stateAtCh2 = createDialState(channels, 'ch-2');
    const pageUpFromCh2 = dialReduce(stateAtCh2, { type: 'key', key: 'PageUp', at: 160 });
    expect(pageUpFromCh2.state.selected).toBe('ch-2');

    // From second channel of group C, PageDown stays put at the last run edge
    const stateAtCh5 = createDialState(channels, 'ch-5');
    const pageDownFromCh5 = dialReduce(stateAtCh5, { type: 'key', key: 'PageDown', at: 170 });
    expect(pageDownFromCh5.state.selected).toBe('ch-5');
  });
});

describe('remote typing', () => {
  it('types 1, 4, Enter with 30 channels to commit 14', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const startState = createDialState(channels);

    // Type '1': 1 * 10 = 10 <= 30, so waits for another digit
    const step1 = dialReduce(startState, { type: 'key', key: '1', at: 1000 });
    expect(step1.state.selected).toBe('channel-1');
    expect(step1.state.typed).toBe('1');
    expect(step1.state.typedAt).toBe(1000);
    expect(step1.commit).toBeNull();

    // Type '4': 14 * 10 = 140 > 30, so number completes at once
    const step2 = dialReduce(step1.state, { type: 'key', key: '4', at: 1200 });
    expect(step2.state.selected).toBe('channel-14');
    expect(step2.state.typed).toBe('');
    expect(step2.state.typedAt).toBeNull();
    expect(step2.commit).toBeNull();

    // Press Enter to commit channel-14
    const step3 = dialReduce(step2.state, { type: 'key', key: 'Enter', at: 1400 });
    expect(step3.state.selected).toBe('channel-14');
    expect(step3.commit).toBe('channel-14');
    expect(step3.state.message).toBeNull();
  });

  it('completes 4 at once with 30 channels, and selects 2 after waiting for timeout tick', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const startState = createDialState(channels, 'channel-10');

    // Type '4': 4 * 10 = 40 > 30, complete at once
    const four = dialReduce(startState, { type: 'key', key: '4', at: 1000 });
    expect(four.state.selected).toBe('channel-4');
    expect(four.state.typed).toBe('');
    expect(four.state.typedAt).toBeNull();
    expect(four.commit).toBeNull();

    // Type '2': 2 * 10 = 20 <= 30, waits for another digit
    const two = dialReduce(four.state, { type: 'key', key: '2', at: 2000 });
    expect(two.state.selected).toBe('channel-2');
    expect(two.state.typed).toBe('2');
    expect(two.state.typedAt).toBe(2000);

    // Tick before timeout does not clear typed
    const earlyTick = dialReduce(two.state, { type: 'tick', at: 2000 + TYPE_TIMEOUT_MS - 1 });
    expect(earlyTick.state.typed).toBe('2');
    expect(earlyTick.state.typedAt).toBe(2000);
    expect(earlyTick.state.selected).toBe('channel-2');

    // Tick at timeout selects 2 and clears typed
    const timeoutTick = dialReduce(two.state, { type: 'tick', at: 2000 + TYPE_TIMEOUT_MS });
    expect(timeoutTick.state.typed).toBe('');
    expect(timeoutTick.state.typedAt).toBeNull();
    expect(timeoutTick.state.selected).toBe('channel-2');
    expect(timeoutTick.commit).toBeNull();
  });

  it('sets "No channel 35" when typing 3 then 5 with 30 channels', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const startState = createDialState(channels);

    const three = dialReduce(startState, { type: 'key', key: '3', at: 1000 });
    expect(three.state.typed).toBe('3');
    expect(three.state.selected).toBe('channel-3');

    const five = dialReduce(three.state, { type: 'key', key: '5', at: 1100 });
    expect(five.state.typed).toBe('');
    expect(five.state.typedAt).toBeNull();
    expect(five.state.selected).toBe('channel-3');
    expect(five.state.message).toBe('No channel 35');
    expect(five.commit).toBeNull();
  });

  it('ignores leading zeros and removes the last typed digit on Backspace', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const startState = createDialState(channels);

    // Leading zero is ignored
    const zero = dialReduce(startState, { type: 'key', key: '0', at: 1000 });
    expect(zero.state.typed).toBe('');
    expect(zero.state.typedAt).toBeNull();
    expect(zero.state.selected).toBe('channel-1');

    // Type '2'
    const two = dialReduce(zero.state, { type: 'key', key: '2', at: 1100 });
    expect(two.state.typed).toBe('2');
    expect(two.state.selected).toBe('channel-2');

    // Backspace removes '2'
    const backspace = dialReduce(two.state, { type: 'key', key: 'Backspace', at: 1200 });
    expect(backspace.state.typed).toBe('');
    expect(backspace.state.typedAt).toBeNull();
    expect(backspace.state.selected).toBe('channel-2');
    expect(backspace.commit).toBeNull();

    // Backspace when empty does not throw and leaves typed empty
    const emptyBackspace = dialReduce(backspace.state, { type: 'key', key: 'Backspace', at: 1300 });
    expect(emptyBackspace.state.typed).toBe('');
    expect(emptyBackspace.commit).toBeNull();

    // Unhandled key changes nothing
    const unhandled = dialReduce(startState, { type: 'key', key: 'x', at: 1400 });
    expect(unhandled.commit).toBeNull();
    expect(unhandled.state.selected).toBe(startState.selected);
  });

  it('resolves half-typed number upon pressing Enter before committing', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const startState = createDialState(channels, 'channel-10');

    // Type '2' (incomplete with 30 channels)
    const typed = dialReduce(startState, { type: 'key', key: '2', at: 1000 });
    expect(typed.state.typed).toBe('2');

    // Enter resolves to channel 2 and commits it
    const outcome = dialReduce(typed.state, { type: 'key', key: 'Enter', at: 1100 });
    expect(outcome.state.selected).toBe('channel-2');
    expect(outcome.state.typed).toBe('');
    expect(outcome.commit).toBe('channel-2');
  });
});

describe('locked channels and picking', () => {
  it('prevents commit and displays locked message on Enter and pick', () => {
    const defs: ChannelDef[] = [
      { id: 'ch-1', kind: 'original', title: 'Open Skies', description: 'd' },
      { id: 'ch-2', kind: 'remix', title: 'Night Paint', description: 'd', unlockedBy: 'p1' },
    ];
    const channels = dialChannels(defs, () => false);
    const startState = createDialState(channels, 'ch-1');

    // Select locked channel via arrow
    const onLocked = dialReduce(startState, { type: 'key', key: 'ArrowRight', at: 100 });
    expect(onLocked.state.selected).toBe('ch-2');

    // Enter on locked channel
    const enterLocked = dialReduce(onLocked.state, { type: 'key', key: 'Enter', at: 110 });
    expect(enterLocked.commit).toBeNull();
    expect(enterLocked.state.message).toBe('Night Paint is locked');

    // Pick locked channel directly from channel 1
    const pickLocked = dialReduce(startState, { type: 'pick', id: 'ch-2' });
    expect(pickLocked.state.selected).toBe('ch-2');
    expect(pickLocked.commit).toBeNull();
    expect(pickLocked.state.message).toBe('Night Paint is locked');

    // Pick unlocked channel directly commits it and clears message
    const pickUnlocked = dialReduce(pickLocked.state, { type: 'pick', id: 'ch-1' });
    expect(pickUnlocked.state.selected).toBe('ch-1');
    expect(pickUnlocked.commit).toBe('ch-1');
    expect(pickUnlocked.state.message).toBeNull();

    // Pick unknown channel changes nothing
    const pickUnknown = dialReduce(startState, { type: 'pick', id: 'unknown-id' });
    expect(pickUnknown.state.selected).toBe('ch-1');
    expect(pickUnknown.commit).toBeNull();
  });
});

describe('surprise', () => {
  it('selects deterministically by seed, never picks current channel, and handles the single unlocked channel case', () => {
    const defs: ChannelDef[] = [
      { id: 'ch-1', kind: 'original', title: 'A', description: 'd' },
      { id: 'ch-2', kind: 'original', title: 'B', description: 'd' },
      { id: 'ch-3', kind: 'original', title: 'C', description: 'd' },
      { id: 'ch-4', kind: 'remix', title: 'D', description: 'd', unlockedBy: 'p1' },
    ];
    // ch-1, ch-2, ch-3 unlocked; ch-4 locked
    const channels = dialChannels(defs, (id) => id !== 'ch-4');
    const state = createDialState(channels, 'ch-1');

    // Deterministic with seed
    const out1 = dialReduce(state, { type: 'surprise', seed: 42 });
    const out2 = dialReduce(state, { type: 'surprise', seed: 42 });
    expect(out1.commit).toBe(out2.commit);
    expect(out1.state.selected).toBe(out2.state.selected);

    // key 's' or 'S' uses action.at as seed
    const outKeyS = dialReduce(state, { type: 'key', key: 's', at: 42 });
    const outKeyUpperS = dialReduce(state, { type: 'key', key: 'S', at: 42 });
    expect(outKeyS.commit).toBe(out1.commit);
    expect(outKeyUpperS.commit).toBe(out1.commit);

    // Never selects the currently selected channel across multiple seeds
    for (let seed = 1; seed <= 20; seed++) {
      const outcome = dialReduce(state, { type: 'surprise', seed });
      expect(outcome.commit).not.toBe('ch-1');
      expect(outcome.commit).not.toBe('ch-4'); // ch-4 is locked
      expect(['ch-2', 'ch-3']).toContain(outcome.commit);
      expect(outcome.state.selected).toBe(outcome.commit);
    }

    // Single unlocked channel commits itself when selected
    const singleUnlockedDefs: ChannelDef[] = [
      { id: 'only-open', kind: 'original', title: 'Only Open', description: 'd' },
      { id: 'locked-1', kind: 'remix', title: 'Locked 1', description: 'd', unlockedBy: 'p1' },
      { id: 'locked-2', kind: 'remix', title: 'Locked 2', description: 'd', unlockedBy: 'p2' },
    ];
    const singleUnlockedChannels = dialChannels(singleUnlockedDefs, () => false);
    const singleOpenState = createDialState(singleUnlockedChannels, 'only-open');

    const singleOutcome = dialReduce(singleOpenState, { type: 'surprise', seed: 999 });
    expect(singleOutcome.commit).toBe('only-open');
    expect(singleOutcome.state.selected).toBe('only-open');
  });
});

describe('dialAngle and channelAtAngle', () => {
  it('round-trips all channels in a multi-channel list across the sweep', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);

    expect(dialAngle(channels, 'channel-1')).toBe(-DIAL_SWEEP_DEGREES / 2);
    expect(dialAngle(channels, 'channel-30')).toBe(DIAL_SWEEP_DEGREES / 2);

    for (const channel of channels) {
      const angle = dialAngle(channels, channel.id);
      const inverted = channelAtAngle(channels, angle);
      expect(inverted.id).toBe(channel.id);
    }

    // Clamps beyond the sweep boundaries
    expect(channelAtAngle(channels, -200).id).toBe('channel-1');
    expect(channelAtAngle(channels, 200).id).toBe('channel-30');
  });

  it('handles a single channel correctly with 0 angle and round trips', () => {
    const single = dialChannels(createSampleDefs(1), () => true);
    expect(dialAngle(single, 'channel-1')).toBe(0);
    expect(channelAtAngle(single, 0).id).toBe('channel-1');
    expect(channelAtAngle(single, -150).id).toBe('channel-1');
    expect(channelAtAngle(single, 150).id).toBe('channel-1');
  });
});

describe('immutability', () => {
  it('never mutates input state and returns a new state object', () => {
    const channels = dialChannels(createSampleDefs(30), (id) => id !== 'channel-2');
    const originalState = freezeState(createDialState(channels, 'channel-1'));

    const actions = [
      { type: 'key' as const, key: 'ArrowRight', at: 100 },
      { type: 'key' as const, key: 'ArrowLeft', at: 100 },
      { type: 'key' as const, key: '1', at: 100 },
      { type: 'key' as const, key: 'Enter', at: 100 },
      { type: 'key' as const, key: 'Backspace', at: 100 },
      { type: 'key' as const, key: 's', at: 100 },
      { type: 'turn' as const, steps: 5 },
      { type: 'pick' as const, id: 'channel-3' },
      { type: 'surprise' as const, seed: 77 },
      { type: 'tick' as const, at: 100 },
    ];

    for (const action of actions) {
      const outcome = dialReduce(originalState, action);
      expect(outcome.state).not.toBe(originalState);
      expect(originalState.selected).toBe('channel-1');
    }
  });

  it('clears message on other actions while preserving message on tick and valid digit keys', () => {
    const channels = dialChannels(createSampleDefs(30), () => true);
    const stateWithMessage: DialState = freezeState({
      ...createDialState(channels, 'channel-1'),
      message: 'Persistent Note',
    });

    // Tick preserves message
    const tickOutcome = dialReduce(stateWithMessage, { type: 'tick', at: 100 });
    expect(tickOutcome.state.message).toBe('Persistent Note');

    // Valid digit key preserves message
    const digitOutcome = dialReduce(stateWithMessage, { type: 'key', key: '1', at: 100 });
    expect(digitOutcome.state.message).toBe('Persistent Note');

    // Turn clears message
    const turnOutcome = dialReduce(stateWithMessage, { type: 'turn', steps: 1 });
    expect(turnOutcome.state.message).toBeNull();

    // Arrow clears message
    const arrowOutcome = dialReduce(stateWithMessage, { type: 'key', key: 'ArrowRight', at: 200 });
    expect(arrowOutcome.state.message).toBeNull();

    // Backspace clears message
    const backspaceOutcome = dialReduce(stateWithMessage, {
      type: 'key',
      key: 'Backspace',
      at: 300,
    });
    expect(backspaceOutcome.state.message).toBeNull();
  });
});
