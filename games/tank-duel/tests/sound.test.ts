/**
 * The match's sound hooks from 1977: the ricochet ping rises with every bounce, and the two sides'
 * explosions sound at different pitches. A hidden vehicle makes no sound.
 */
import type { AudioEngine, HeldSound, PlayOptions } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createMatchSound } from '../src/audio/match-sound.ts';
import { channelById } from '../src/engine/channels.ts';
import { createMatch, createWorld } from '../src/engine/match.ts';
import type { MatchEvent } from '../src/engine/types.ts';
import { vec } from '../src/engine/vec.ts';

interface Played {
  readonly name: string;
  readonly options: PlayOptions;
}

function fakeAudio(): { audio: AudioEngine; played: Played[]; held: { gain: number }[] } {
  const played: Played[] = [];
  const held: { gain: number }[] = [];
  const audio: AudioEngine = {
    unlock: () => Promise.resolve(),
    unlocked: true,
    register: () => undefined,
    play: (name, options = {}) => played.push({ name, options }),
    playDef: () => undefined,
    hold: (): HeldSound => {
      const voice = { gain: 0 };
      held.push(voice);
      return { set: (change) => (voice.gain = change.gain ?? voice.gain), stop: () => undefined };
    },
    music: { play: () => undefined, stop: () => undefined, playing: false },
    setVolumes: () => undefined,
    silence: () => undefined,
    dispose: () => undefined,
  };
  return { audio, played, held };
}

const volumes = () => ({ engines: 1, effects: 1 });

describe('match sound', () => {
  it('plays each ricochet higher than the bounce before it', () => {
    const { audio, played } = fakeAudio();
    const sound = createMatchSound({ audio, revealed: () => true, volumes });
    const state = createMatch(
      channelById('game-6'),
      { scoring: 'timed', handicap: [false, false], wiring: false },
      createWorld(channelById('game-6')),
    );
    const bounce = (bounces: number): MatchEvent => ({
      kind: 'bounced',
      side: 0,
      at: vec(32, 20),
      normal: vec(1, 0),
      bounces,
      corner: false,
    });
    sound.step(state, [bounce(1), bounce(2), bounce(3)]);
    const pitches = played.filter((p) => p.name === 'ricochet').map((p) => p.options.pitch ?? 1);
    expect(pitches).toHaveLength(3);
    expect(pitches[1]).toBeGreaterThan(pitches[0] ?? 0);
    expect(pitches[2]).toBeGreaterThan(pitches[1] ?? 0);
  });

  it('gives each side its own explosion pitch', () => {
    const { audio, played } = fakeAudio();
    const sound = createMatchSound({ audio, revealed: () => true, volumes });
    const channel = channelById('game-1');
    const state = createMatch(
      channel,
      { scoring: 'timed', handicap: [false, false], wiring: false },
      createWorld(channel),
    );
    const hit = (victim: 0 | 1): MatchEvent => ({
      kind: 'hit',
      shooter: victim === 0 ? 1 : 0,
      victim,
      vehicle: 0,
      at: vec(20, 20),
      direction: vec(1, 0),
      bounces: 0,
      points: 1,
      path: [],
    });
    sound.step(state, [hit(0)]);
    sound.step(state, [hit(1)]);
    const pitches = played.filter((p) => p.name === 'explosion').map((p) => p.options.pitch);
    expect(pitches).toHaveLength(2);
    expect(pitches[0]).not.toBe(pitches[1]);
  });

  it('keeps a hidden vehicle silent', () => {
    const { audio, held } = fakeAudio();
    const sound = createMatchSound({ audio, revealed: () => false, volumes });
    const channel = channelById('game-11');
    const state = createMatch(
      channel,
      { scoring: 'timed', handicap: [false, false], wiring: false },
      createWorld(channel),
    );
    sound.frame(state);
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((voice) => voice.gain === 0)).toBe(true);
  });
});
