/**
 * The Den's room sound, off by default: a slow clock tick, cars passing far
 * off by day, crickets by night. Everything is synthesised on the ambience
 * channel and kept very quiet; it stops whenever the Den is hidden.
 */
import type { Appearance, AudioEngine, SoundDef } from '@woodgrain-88/kit';

const TICK: SoundDef = [
  {
    wave: 'noise',
    freq: 4200,
    duration: 0.006,
    gain: 0.18,
    envelope: { attack: 0.001, decay: 0.005, sustain: 0.1, release: 0.01 },
  },
  { wave: 'triangle', freq: 2100, duration: 0.008, gain: 0.04 },
];

const CAR: SoundDef = {
  wave: 'noise',
  freq: [380, 900],
  duration: 2.6,
  gain: 0.12,
  lowpass: 700,
  envelope: { attack: 1.4, decay: 0.6, sustain: 0.5, release: 1.6 },
};

function crickets(pitch: number): SoundDef {
  return Array.from({ length: 4 }, (_, i) => ({
    wave: 'sine' as const,
    freq: 4300 * pitch,
    duration: 0.035,
    gain: 0.05,
    delay: i * 0.07,
    envelope: { attack: 0.004, decay: 0.02, sustain: 0.3, release: 0.02 },
  }));
}

export interface Ambience {
  setEnabled(on: boolean): void;
  setAppearance(appearance: Appearance): void;
  dispose(): void;
}

export function createAmbience(audio: AudioEngine, appearance: Appearance): Ambience {
  let enabled = false;
  let time = appearance;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  // A tiny counter instead of Math.random: the room's sounds only need to vary, not be random.
  let step = 0;
  const vary = (span: number) => (((step++ * 7919) % 1000) / 1000) * span;

  const scheduleWorld = () => {
    if (!enabled) return;
    const wait = time === 'dark' ? 2500 + vary(4000) : 6000 + vary(7000);
    timers.push(
      setTimeout(() => {
        if (!enabled || document.visibilityState === 'hidden') {
          scheduleWorld();
          return;
        }
        if (time === 'dark')
          audio.playDef(crickets(0.92 + vary(0.16)), { channel: 'ambience', pan: vary(1.6) - 0.8 });
        else audio.playDef(CAR, { channel: 'ambience', pan: vary(1.4) - 0.7 });
        scheduleWorld();
      }, wait),
    );
  };

  const stop = () => {
    for (const timer of timers.splice(0)) clearTimeout(timer);
    if (tickTimer !== null) clearInterval(tickTimer);
    tickTimer = null;
  };

  return {
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      stop();
      if (!on) return;
      tickTimer = setInterval(() => {
        if (document.visibilityState !== 'hidden')
          audio.playDef(TICK, { channel: 'ambience', pan: 0.35 });
      }, 1000);
      scheduleWorld();
    },
    setAppearance(next) {
      time = next;
    },
    dispose() {
      enabled = false;
      stop();
    },
  };
}
