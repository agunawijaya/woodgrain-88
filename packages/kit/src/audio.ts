/**
 * Every sound in Woodgrain '88 is synthesised here at runtime; the repo holds
 * no audio files. A sound effect is data (waveform, pitch glide, envelope,
 * filter) so a game's whole sound palette reads as one table it can tune.
 *
 * `tia: true` snaps pitches to the coarse steps an old console's frequency
 * divider could reach, a flavour of the period rather than a copy of any
 * original sound.
 *
 * Browsers only start audio after a user gesture, so the engine stays silent
 * until `unlock()` is called from a click or key press. Without WebAudio (tests,
 * old browsers) every call is a harmless no-op.
 */

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';
export type SoundChannel = 'sfx' | 'music' | 'ambience';

export interface SoundEnvelope {
  /** Seconds to full level. */
  attack: number;
  /** Seconds from full level down to the sustain level. */
  decay: number;
  /** 0–1 of full level, held until release. */
  sustain: number;
  /** Seconds to silence after the voice's duration. */
  release: number;
}

export interface Voice {
  wave: Wave;
  /** Hz. A pair glides from the first to the second over the duration. For noise: the band's centre. */
  freq: number | readonly [number, number];
  /** Seconds before the release starts. */
  duration: number;
  envelope?: Partial<SoundEnvelope>;
  /** 0–1. Default 0.5. */
  gain?: number;
  /** Low-pass cutoff in Hz. */
  lowpass?: number;
  /** Seconds after the sound starts. */
  delay?: number;
  vibrato?: { cents: number; rate: number };
  tia?: boolean;
}

/** One voice, or several layered into one sound. */
export type SoundDef = Voice | readonly Voice[];
export type SoundBank = Readonly<Record<string, SoundDef>>;

export interface PlayOptions {
  channel?: SoundChannel;
  /** -1 (left) to 1 (right). */
  pan?: number;
  /** Multiplies every frequency; 2 is an octave up. */
  pitch?: number;
  /** Multiplies the voice gain. */
  gain?: number;
}

export interface Track {
  wave: Wave;
  /** Space-separated steps: a note like "C4" or "F#3", "." for rest, "-" to hold the previous note. */
  steps: string;
  gain?: number;
  envelope?: Partial<SoundEnvelope>;
  lowpass?: number;
  tia?: boolean;
}

export interface Song {
  bpm: number;
  /** Steps per beat; 4 means each step is a sixteenth note. Default 4. */
  stepsPerBeat?: number;
  tracks: readonly Track[];
  loop: boolean;
}

export interface Sequencer {
  play(song: Song): void;
  stop(): void;
  readonly playing: boolean;
}

export interface AudioEngine {
  /** Call from a user gesture; resolves once sound can play. */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  register(bank: SoundBank): void;
  play(name: string, options?: PlayOptions): void;
  playDef(def: SoundDef, options?: PlayOptions): void;
  readonly music: Sequencer;
  /** Effective gains (already multiplied by master and mute) per channel. */
  setVolumes(volumes: Readonly<Record<SoundChannel, number>>): void;
  /** Cuts every sound immediately and stops the music (the pause menu, leaving a game). */
  silence(): void;
  dispose(): void;
}

const DEFAULT_ENVELOPE: SoundEnvelope = { attack: 0.005, decay: 0.05, sustain: 0.7, release: 0.08 };
const NOTE_INDEX: Readonly<Record<string, number>> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** "A4" → 440. Returns null for anything that is not a note name with an octave. */
export function noteToFrequency(note: string): number | null {
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!match) return null;
  const index = NOTE_INDEX[match[1] ?? ''];
  if (index === undefined) return null;
  const semitonesFromA4 = index - 9 + (Number(match[2]) - 4) * 12;
  return 440 * 2 ** (semitonesFromA4 / 12);
}

// An old console divided a ~30 kHz clock by a small integer, so only a
// ladder of pitches existed, increasingly sparse towards the top.
const TIA_CLOCK = 30_000;
export function tiaPitch(frequency: number): number {
  const divider = Math.max(1, Math.min(32, Math.round(TIA_CLOCK / frequency / 2)));
  return TIA_CLOCK / divider / 2;
}

interface Graph {
  context: AudioContext;
  channels: Record<SoundChannel, GainNode>;
  noise: AudioBuffer;
}

export interface AudioEngineOptions {
  createContext?: () => AudioContext | null;
}

function defaultContext(): AudioContext | null {
  return typeof AudioContext === 'function' ? new AudioContext() : null;
}

function makeNoise(context: AudioContext): AudioBuffer {
  const seconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const samples = buffer.getChannelData(0);
  // A fixed linear congruential sequence: noise that sounds the same every run.
  let state = 0x2545f491;
  for (let i = 0; i < samples.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    samples[i] = state / 2147483648 - 1;
  }
  return buffer;
}

function scheduleEnvelope(param: AudioParam, start: number, peak: number, voice: Voice): number {
  const env = { ...DEFAULT_ENVELOPE, ...voice.envelope };
  const sustainLevel = Math.max(0.0001, peak * env.sustain);
  param.setValueAtTime(0.0001, start);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + env.attack);
  param.exponentialRampToValueAtTime(sustainLevel, start + env.attack + env.decay);
  const releaseAt = start + Math.max(voice.duration, env.attack + env.decay);
  param.setValueAtTime(sustainLevel, releaseAt);
  param.exponentialRampToValueAtTime(0.0001, releaseAt + env.release);
  return releaseAt + env.release;
}

function playVoice(
  graph: Graph,
  voice: Voice,
  options: PlayOptions,
  at: number,
): AudioScheduledSourceNode {
  const { context } = graph;
  const start = at + (voice.delay ?? 0);
  const pitch = options.pitch ?? 1;
  const [fromHz, toHz] = typeof voice.freq === 'number' ? [voice.freq, voice.freq] : voice.freq;
  const shape = (hz: number) => (voice.tia ? tiaPitch(hz * pitch) : hz * pitch);

  const amp = context.createGain();
  const end = scheduleEnvelope(amp.gain, start, (voice.gain ?? 0.5) * (options.gain ?? 1), voice);

  let source: AudioScheduledSourceNode;
  let head: AudioNode;
  if (voice.wave === 'noise') {
    const noise = context.createBufferSource();
    noise.buffer = graph.noise;
    noise.loop = true;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(shape(fromHz), start);
    band.frequency.exponentialRampToValueAtTime(Math.max(20, shape(toHz)), end);
    noise.connect(band);
    source = noise;
    head = band;
  } else {
    const osc = context.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(shape(fromHz), start);
    if (toHz !== fromHz)
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, shape(toHz)), start + voice.duration);
    if (voice.vibrato) {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = voice.vibrato.rate;
      depth.gain.value = voice.vibrato.cents;
      lfo.connect(depth).connect(osc.detune);
      lfo.start(start);
      lfo.stop(end);
    }
    source = osc;
    head = osc;
  }

  let tail: AudioNode = head;
  if (voice.lowpass) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = voice.lowpass;
    tail.connect(filter);
    tail = filter;
  }
  tail.connect(amp);
  if (options.pan) {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, options.pan));
    amp.connect(panner).connect(graph.channels[options.channel ?? 'sfx']);
  } else {
    amp.connect(graph.channels[options.channel ?? 'sfx']);
  }
  source.start(start);
  source.stop(end + 0.02);
  return source;
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const createContext = options.createContext ?? defaultContext;
  const bank = new Map<string, SoundDef>();
  const live = new Set<AudioScheduledSourceNode>();
  let graph: Graph | null = null;
  let unlocked = false;
  let volumes: Record<SoundChannel, number> = { sfx: 0.8, music: 0.6, ambience: 0.3 };

  const ensureGraph = (): Graph | null => {
    if (graph) return graph;
    const context = createContext();
    if (!context) return null;
    const master = context.createDynamicsCompressor();
    master.connect(context.destination);
    const channel = (name: SoundChannel) => {
      const gain = context.createGain();
      gain.gain.value = volumes[name];
      gain.connect(master);
      return gain;
    };
    graph = {
      context,
      channels: { sfx: channel('sfx'), music: channel('music'), ambience: channel('ambience') },
      noise: makeNoise(context),
    };
    return graph;
  };

  const track = (source: AudioScheduledSourceNode) => {
    live.add(source);
    source.onended = () => live.delete(source);
  };

  const playDef = (def: SoundDef, playOptions: PlayOptions = {}) => {
    if (!unlocked) return;
    const g = ensureGraph();
    if (!g) return;
    const voices: readonly Voice[] = Array.isArray(def) ? def : [def as Voice];
    for (const voice of voices) track(playVoice(g, voice, playOptions, g.context.currentTime));
  };

  const music = createSequencer({
    graph: () => (unlocked ? ensureGraph() : null),
    onSource: track,
  });

  return {
    async unlock() {
      const g = ensureGraph();
      if (!g) return;
      if (g.context.state === 'suspended') await g.context.resume();
      unlocked = true;
    },
    get unlocked() {
      return unlocked;
    },
    register(sounds) {
      for (const [name, def] of Object.entries(sounds)) bank.set(name, def);
    },
    play(name, playOptions) {
      const def = bank.get(name);
      if (!def) {
        console.warn(`Unknown sound "${name}"`);
        return;
      }
      playDef(def, playOptions);
    },
    playDef,
    music,
    setVolumes(next) {
      volumes = { ...next };
      if (!graph) return;
      const now = graph.context.currentTime;
      for (const name of ['sfx', 'music', 'ambience'] as const) {
        graph.channels[name].gain.setTargetAtTime(volumes[name], now, 0.02);
      }
    },
    silence() {
      music.stop();
      for (const source of live) {
        try {
          source.stop();
        } catch {
          // Already stopped: nothing to cut.
        }
      }
      live.clear();
    },
    dispose() {
      this.silence();
      void graph?.context.close();
      graph = null;
    },
  };
}

interface SequencerDeps {
  graph(): Graph | null;
  onSource(source: AudioScheduledSourceNode): void;
}

// Notes are scheduled a little ahead of time on the audio clock, from a
// coarse JavaScript timer, so timer jitter never reaches the rhythm.
const LOOKAHEAD_SECONDS = 0.12;
const SCHEDULER_INTERVAL_MS = 30;

function createSequencer(deps: SequencerDeps): Sequencer {
  let song: Song | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let step = 0;
  let nextStepTime = 0;
  let parsed: { tracks: { track: Track; steps: string[] }[]; length: number } | null = null;

  const stepSeconds = (s: Song) => 60 / s.bpm / (s.stepsPerBeat ?? 4);

  /** How many steps a note at `index` lasts, counting the "-" holds after it. */
  const heldSteps = (steps: string[], index: number) => {
    let length = 1;
    while (steps[index + length] === '-') length++;
    return length;
  };

  const tick = () => {
    const g = deps.graph();
    if (!g || !song || !parsed) return;
    while (nextStepTime < g.context.currentTime + LOOKAHEAD_SECONDS) {
      if (step >= parsed.length) {
        if (!song.loop) {
          stop();
          return;
        }
        step = 0;
      }
      for (const { track, steps } of parsed.tracks) {
        const token = steps[step % steps.length] ?? '.';
        const frequency = noteToFrequency(token);
        if (frequency === null) continue;
        const voice: Voice = {
          wave: track.wave,
          freq: frequency,
          duration: heldSteps(steps, step % steps.length) * stepSeconds(song) * 0.9,
          gain: track.gain ?? 0.3,
          ...(track.envelope ? { envelope: track.envelope } : {}),
          ...(track.lowpass ? { lowpass: track.lowpass } : {}),
          ...(track.tia ? { tia: true } : {}),
        };
        deps.onSource(playVoice(g, voice, { channel: 'music' }, nextStepTime));
      }
      step++;
      nextStepTime += stepSeconds(song);
    }
  };

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    song = null;
    parsed = null;
  }

  return {
    play(next) {
      stop();
      const g = deps.graph();
      if (!g) return;
      song = next;
      const tracks = next.tracks.map((track) => ({
        track,
        steps: track.steps.trim().split(/\s+/),
      }));
      parsed = { tracks, length: Math.max(1, ...tracks.map((t) => t.steps.length)) };
      step = 0;
      nextStepTime = g.context.currentTime + 0.05;
      timer = setInterval(tick, SCHEDULER_INTERVAL_MS);
      tick();
    },
    stop,
    get playing() {
      return song !== null;
    },
  };
}
