import { describe, expect, it } from 'vitest';
import { createAudioEngine } from '../src/audio.ts';

describe('audio engine', () => {
  it('gives a silent held sound before unlock and without WebAudio, and never throws', async () => {
    const engine = createAudioEngine({ createContext: () => null });
    const early = engine.hold({ wave: 'sawtooth', freq: 60 });
    expect(() => {
      early.set({ pitch: 1.4, gain: 0.5, pan: -0.3 });
      early.stop();
      early.stop();
    }).not.toThrow();
    await engine.unlock();
    const late = engine.hold([{ wave: 'noise', freq: 400 }], { channel: 'ambience' });
    expect(() => late.set({ pitch: 2 })).not.toThrow();
    engine.dispose();
  });
});
