/**
 * The match's sound: hums per rider that follow the speed-up and stop on a
 * crash, the look's cues for turns, gaps, traps, points and the win, played
 * through a fake kit audio engine that records what it was asked to do.
 */
import type { AudioEngine, HeldSound, PlayOptions, SoundDef } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import { createMatchSound } from '../../src/audio/match-sound.ts';
import { HUM_PITCH, LOOK_SOUNDS } from '../../src/audio/sounds.ts';
import { createMatch, startMatch } from '../../src/engine/match.ts';
import { variationRules } from '../../src/engine/variations.ts';
import type { MatchEvent } from '../../src/engine/types.ts';

interface FakeHum {
  readonly changes: { pitch?: number; gain?: number; pan?: number }[];
  stopped: boolean;
}

function fakeAudio() {
  const played: { def: SoundDef; options: PlayOptions | undefined }[] = [];
  const hums: FakeHum[] = [];
  const audio = {
    playDef(def: SoundDef, options?: PlayOptions) {
      played.push({ def, options });
    },
    hold(): HeldSound {
      const hum: FakeHum = { changes: [], stopped: false };
      hums.push(hum);
      return {
        set(change) {
          hum.changes.push(change);
        },
        stop() {
          hum.stopped = true;
        },
      };
    },
  } as unknown as AudioEngine;
  return { audio, played, hums };
}

function duelOn(variation: number) {
  const match = createMatch({
    rules: variationRules(variation),
    players: 2,
    switches: ['B', 'B'],
    target: 10,
  });
  startMatch(match);
  return match;
}

describe('match sound', () => {
  it('hums once per rider from the round, climbing with the speed-up', () => {
    const { audio, hums } = fakeAudio();
    const sound = createMatchSound(audio, 'neon');
    const match = duelOn(3);
    sound.hear({ type: 'round', round: 1 }, match);
    expect(hums).toHaveLength(2);
    sound.hear({ type: 'speed', stage: 2, period: 9 }, match);
    for (const hum of hums) expect(hum.changes.at(-1)?.pitch).toBe(HUM_PITCH[2]);
  });

  it("stops a crashed rider's hum and plays the look's crash", () => {
    const { audio, played, hums } = fakeAudio();
    const sound = createMatchSound(audio, 'trains');
    const match = duelOn(1);
    sound.hear({ type: 'round', round: 1 }, match);
    sound.hear(
      { type: 'crash', crashes: [{ seat: 1, cell: match.riders[1]?.cell ?? 0, into: 0 }] },
      match,
    );
    expect(hums[1]?.stopped).toBe(true);
    expect(hums[0]?.stopped).toBe(false);
    expect(played.at(-1)?.def).toBe(LOOK_SOUNDS.trains.cues.crash);
    expect(played.at(-1)?.options?.pan).toBeGreaterThan(0);
  });

  it('hisses a gap when a rider moves without laying trail on a gaps channel', () => {
    const { audio, played } = fakeAudio();
    const sound = createMatchSound(audio, 'ice');
    const match = duelOn(7);
    const step: MatchEvent = {
      type: 'step',
      laid: [{ cell: match.riders[0]?.cell ?? 0, seat: 0, entered: 'right', left: 'right' }],
      erased: [],
      moves: [
        { seat: 0, from: 1, to: 2, heading: 'right', wrapped: false, ticks: 15 },
        { seat: 1, from: 5, to: 4, heading: 'left', wrapped: false, ticks: 15 },
      ],
      period: 15,
    };
    sound.hear(step, match);
    expect(played.map((entry) => entry.def)).toEqual([LOOK_SOUNDS.ice.cues.gap]);
  });

  it('falls quiet and plays the win when the match is over', () => {
    const { audio, played, hums } = fakeAudio();
    const sound = createMatchSound(audio, 'mummy');
    const match = duelOn(1);
    sound.hear({ type: 'round', round: 1 }, match);
    sound.hear({ type: 'over', winner: 0, scores: [10, 4] }, match);
    expect(hums.every((hum) => hum.stopped)).toBe(true);
    expect(played.at(-1)?.def).toBe(LOOK_SOUNDS.mummy.cues.win);
  });

  it('counts down and says go', () => {
    const { audio, played } = fakeAudio();
    const sound = createMatchSound(audio, 'neon');
    sound.countdown(3);
    sound.countdown(0);
    expect(played.map((entry) => entry.def)).toEqual([
      LOOK_SOUNDS.neon.cues.count,
      LOOK_SOUNDS.neon.cues.go,
    ]);
  });
});
