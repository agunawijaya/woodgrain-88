/**
 * Dev-only fake GameContext: builds a faithful context for Hot & Cold using
 * the kit's real input, loop, audio and RNG, with in-memory stores that never
 * touch browser storage.
 */
import {
  createAudioEngine,
  createInput,
  createLoop,
  createRng,
  kidById,
  type Appearance,
  type AudioEngine,
  type DifficultySwitches,
  type GameContext,
  type GameEvent,
  type GameLoop,
  type GameManifest,
  type GameResult,
  type GameSettingsStore,
  type GameView,
  type InputController,
  type KidId,
  type LoopOptions,
  type MemoryMode,
  type PauseItem,
  type ResultReceipt,
  type Rng,
  type RunInfo,
  type RunMode,
  type RunRecord,
  type SaveSlot,
  type SeatInfo,
  type Unsubscribe,
} from '@woodgrain-88/kit';

export interface HarnessLog {
  readonly events: GameEvent[];
  readonly results: GameResult[];
  view: GameView;
  pauseItems: readonly PauseItem[];
}

export interface FakeContextOptions {
  readonly manifest: GameManifest;
  readonly host: HTMLElement;
  readonly run: RunInfo;
  /** Seat 2's Kid, or null for a second person. */
  readonly kid: string | null;
  readonly appearance: 'light' | 'dark';
  readonly reducedMotion: boolean;
  readonly switches: DifficultySwitches;
  readonly kids: MemoryMode;
  /** Simulation steps per loop step, for tests that need a whole match quickly. Default 1. */
  readonly speed?: number;
  /** Seeds the game's own settings store (`hc.look`, say), as if the player had chosen them
   *  before: a URL option for a test or a screenshot, never the game's own default. */
  readonly initialGameSettings?: Readonly<Record<string, unknown>>;
  /** Called when the game asks for the pause menu, settings, How to play or the Hall. */
  readonly chrome: {
    openPause(): void;
    openSettings(): void;
    openHowToPlay(): void;
    backToHall(): void;
    viewChanged(view: GameView): void;
  };
}

export interface FakeContext {
  readonly context: GameContext;
  readonly log: HarnessLog;
  /** Pauses or resumes every loop the game made, as the Hall's pause menu does. */
  setPaused(paused: boolean): void;
  setAppearance(appearance: 'light' | 'dark'): void;
  setSwitches(switches: DifficultySwitches): void;
  dispose(): void;
}

export function createFakeContext(options: FakeContextOptions): FakeContext {
  const log: HarnessLog = {
    events: [],
    results: [],
    view: 'menu',
    pauseItems: [],
  };

  const seats: readonly SeatInfo[] = [
    { seat: 1, kind: 'human', name: 'Player 1' },
    options.kid !== null && options.kid !== 'person'
      ? {
          seat: 2,
          kind: 'bot',
          kid: options.kid as KidId,
          name: kidById(options.kid as KidId).name,
        }
      : { seat: 2, kind: 'human', name: 'Player 2' },
  ];

  const gameSettings = new Map<string, unknown>(Object.entries(options.initialGameSettings ?? {}));
  const gameStore: GameSettingsStore = {
    get<T>(key: string, fallback: T): T {
      const stored = gameSettings.get(key);
      return stored === undefined ? fallback : (stored as T);
    },
    set(key: string, value: unknown): void {
      gameSettings.set(key, value);
    },
  };

  let savedVersion: number | null = null;
  let savedState: unknown = null;
  const save: SaveSlot = {
    load(version: number): unknown {
      return savedVersion === version ? savedState : null;
    },
    store(version: number, state: unknown): void {
      savedVersion = version;
      savedState = state;
    },
    clear(): void {
      savedVersion = null;
      savedState = null;
    },
  };

  const recordsList: RunRecord[] = [];
  const records = {
    best(channel: string, mode: RunMode): RunRecord | null {
      const topList = this.top(channel, mode);
      return topList[0] ?? null;
    },
    top(channel: string, mode: RunMode): RunRecord[] {
      return recordsList
        .filter((r) => r.channel === channel && r.mode === mode)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    },
  };

  let currentAppearance: Appearance = options.appearance;
  const appearanceListeners = new Set<(appearance: Appearance) => void>();

  let currentSwitches: DifficultySwitches = { ...options.switches };
  const switchListeners = new Set<(switches: DifficultySwitches) => void>();

  const loops = new Set<GameLoop>();

  const rng: Rng = createRng(options.run.seed);
  const input: InputController = createInput({
    pointerTarget: options.host,
    layout: 'split',
  });
  const audio: AudioEngine = createAudioEngine();

  const stopInputPause = input.onPause(() => {
    if (log.view === 'play') {
      options.chrome.openPause();
    } else if (log.view === 'menu') {
      options.chrome.backToHall();
    }
  });

  const context: GameContext = {
    manifest: options.manifest,
    run: options.run,
    rng,
    seats,
    input,
    audio,
    settings: {
      appearance: () => currentAppearance,
      onAppearance(listener: (appearance: Appearance) => void): Unsubscribe {
        appearanceListeners.add(listener);
        return () => appearanceListeners.delete(listener);
      },
      reducedMotion: () => options.reducedMotion,
      onReducedMotion(): Unsubscribe {
        return () => undefined;
      },
      screenShake: () => true,
      crtEnabled: () => false,
      colorBlindHints: () => false,
      kids: () => options.kids,
      game: gameStore,
    },
    difficulty: {
      get: () => currentSwitches,
      onChange(listener: (switches: DifficultySwitches) => void): Unsubscribe {
        switchListeners.add(listener);
        return () => switchListeners.delete(listener);
      },
    },
    save,
    patches: {
      status: () => [],
    },
    records,
    createLoop(loopOptions: LoopOptions): GameLoop {
      const speed = Math.max(1, Math.round(options.speed ?? 1));
      const fastForward: LoopOptions =
        speed > 1 && loopOptions.update
          ? {
              ...loopOptions,
              update: (dt, tick) => {
                for (let step = 0; step < speed; step++)
                  loopOptions.update?.(dt, tick * speed + step);
              },
            }
          : loopOptions;
      // As the Hall does, a stopped loop is let go rather than kept with its finished match.
      const loop = createLoop({
        ...fastForward,
        autoPause: false,
        onStop: () => {
          loops.delete(loop);
          loopOptions.onStop?.();
        },
      });
      loops.add(loop);
      return loop;
    },
    emit(event: GameEvent): void {
      log.events.push(event);
    },
    reportResult(result: GameResult): ResultReceipt {
      log.results.push(result);
      let newBest = false;
      let rank: number | null = null;

      if (Number.isFinite(result.score)) {
        const currentBoard = recordsList
          .filter((r) => r.channel === options.run.channel && r.mode === options.run.mode)
          .sort((a, b) => b.score - a.score);

        const isTopScore =
          currentBoard.length === 0 ||
          (currentBoard[0] !== undefined && result.score > currentBoard[0].score);

        let insertIndex = currentBoard.length;
        for (let i = 0; i < currentBoard.length; i++) {
          const candidate = currentBoard[i];
          if (candidate !== undefined && result.score > candidate.score) {
            insertIndex = i;
            break;
          }
        }

        const record: RunRecord = {
          score: result.score,
          at: new Date().toISOString(),
          seed: options.run.seed,
          durationMs: result.durationMs,
          channel: options.run.channel,
          mode: options.run.mode,
        };
        recordsList.push(record);

        rank = insertIndex < 10 ? insertIndex + 1 : null;
        newBest = rank === 1 && isTopScore;
      }

      return {
        newBest,
        rank,
        patchesEarned: [],
        micro: null,
      };
    },
    share: {
      challengeLink(score: number): string {
        return `#challenge-${score}`;
      },
      card(): string {
        return '<svg></svg>';
      },
      copy: () => Promise.resolve(true),
    },
    setView(view: GameView): void {
      log.view = view;
      options.chrome.viewChanged(view);
    },
    setPauseItems(items: readonly PauseItem[]): void {
      log.pauseItems = items;
    },
    requestPause(): void {
      options.chrome.openPause();
    },
    openSettings(): void {
      options.chrome.openSettings();
    },
    openHowToPlay(): void {
      options.chrome.openHowToPlay();
    },
    backToHall(): void {
      options.chrome.backToHall();
    },
    forgetGameData(): void {
      gameSettings.clear();
      save.clear();
      recordsList.length = 0;
    },
  };

  return {
    context,
    log,
    setPaused(paused: boolean): void {
      for (const loop of loops) {
        if (paused) {
          loop.pause();
        } else {
          loop.resume();
        }
      }
    },
    setAppearance(appearance: 'light' | 'dark'): void {
      currentAppearance = appearance;
      for (const listener of appearanceListeners) {
        listener(appearance);
      }
    },
    setSwitches(switches: DifficultySwitches): void {
      currentSwitches = { ...switches };
      for (const listener of switchListeners) {
        listener(currentSwitches);
      }
    },
    dispose(): void {
      stopInputPause();
      input.dispose();
      audio.dispose();
      for (const loop of loops) {
        loop.stop();
      }
      loops.clear();
      appearanceListeners.clear();
      switchListeners.clear();
    },
  };
}
