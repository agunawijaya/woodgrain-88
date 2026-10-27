// @vitest-environment happy-dom
/**
 * Tests for Tank Duel's match screens: pre-match cards and readiness flow,
 * results breakdown and replay companion, and the Neighbourhood Kids' lines.
 */
import { describe, expect, it, vi } from 'vitest';
import type {
  GameLoop,
  InputController,
  LoopOptions,
  PatchEarned,
  ResultReceipt,
  Seat,
  SeatFrame,
} from '@woodgrain-88/kit';
import { DEFAULT_BINDINGS, KID_IDS } from '@woodgrain-88/kit';
import { KID_LINES, kidLine, type KidMood } from '../src/copy/kid-lines.ts';
import { CHANNELS } from '../src/engine/channels.ts';
import type { ChannelRules, MatchState } from '../src/engine/types.ts';
import { createPrematchScreen } from '../src/screens/prematch.ts';
import { createResultsScreen } from '../src/screens/results.ts';
import type { HudSeat } from '../src/ui/hud.ts';

interface MockInput {
  readonly input: InputController;
  readonly setSeatFrame: (seat: Seat, frame: Partial<SeatFrame>) => void;
}

function createMockInput(): MockInput {
  const currentFrames: Record<Seat, SeatFrame> = {
    1: {
      held: new Set(),
      pressed: new Set(),
      released: new Set(),
      axis: { x: 0, y: 0 },
      usingPad: false,
    },
    2: {
      held: new Set(),
      pressed: new Set(),
      released: new Set(),
      axis: { x: 0, y: 0 },
      usingPad: false,
    },
  };

  const input: InputController = {
    poll: () => ({
      seats: {
        1: { ...currentFrames[1] },
        2: { ...currentFrames[2] },
      },
      poll: 1,
    }),
    pointer: { x: null, y: null, down: false, pressed: false, released: false, kind: null },
    layout: 'split',
    setLayout: () => undefined,
    bindings: DEFAULT_BINDINGS,
    setBindings: () => undefined,
    onPause: () => () => undefined,
    reset: () => undefined,
    dispose: () => undefined,
  };

  return {
    input,
    setSeatFrame: (seat: Seat, partial: Partial<SeatFrame>) => {
      currentFrames[seat] = {
        held: partial.held ?? new Set(),
        pressed: partial.pressed ?? new Set(),
        released: partial.released ?? new Set(),
        axis: partial.axis ?? { x: 0, y: 0 },
        usingPad: partial.usingPad ?? false,
      };
    },
  };
}

interface MockLoopFactory {
  readonly createLoop: (options: LoopOptions) => GameLoop;
  readonly step: (dt: number) => void;
  readonly isStopped: () => boolean;
}

function createMockLoopFactory(): MockLoopFactory {
  let updateCallback: ((dt: number, tick: number) => void) | undefined;
  let running = false;
  let tickCount = 0;

  return {
    createLoop: (options: LoopOptions): GameLoop => {
      updateCallback = (dt, tick) => options.update?.(dt, tick);
      return {
        start: () => {
          running = true;
        },
        stop: () => {
          running = false;
        },
        pause: () => undefined,
        resume: () => undefined,
        invalidate: () => undefined,
        step: () => undefined,
        get running() {
          return running;
        },
        get paused() {
          return false;
        },
        get ticks() {
          return tickCount;
        },
        get stalls() {
          return 0;
        },
      };
    },
    step: (dt: number) => {
      if (running && updateCallback) {
        updateCallback(dt, tickCount++);
      }
    },
    isStopped: () => !running,
  };
}

function createDummyMatchState(
  winner: 0 | 1 | null,
  scores: readonly [number, number] = [5, 3],
): MatchState {
  const channel = CHANNELS[0];
  if (!channel) throw new Error('channel required');
  return {
    channel,
    options: {
      scoring: 'timed',
      handicap: [false, false],
      wiring: false,
    },
    time: 164.25,
    clock: 0,
    scores,
    vehicles: [],
    shells: [null, null],
    reload: [0, 0],
    fireHeld: [false, false],
    freeze: null,
    fuel: [0, 0],
    radar: { next: 0, showing: 0 },
    round: 1,
    over: true,
    winner,
  };
}

describe('Kid lines', () => {
  const moods: readonly KidMood[] = ['won', 'lost', 'draw'];

  it('provides exactly 3 lines per Kid per mood, each at most 60 characters', () => {
    let totalLines = 0;
    for (const kidId of KID_IDS) {
      const kidLines = KID_LINES[kidId];
      expect(kidLines).toBeDefined();
      for (const mood of moods) {
        const lines = kidLines[mood];
        expect(lines).toBeDefined();
        expect(lines).toHaveLength(3);
        for (const line of lines) {
          totalLines++;
          expect(line.length).toBeGreaterThan(0);
          expect(line.length).toBeLessThanOrEqual(60);
        }
      }
    }
    expect(totalLines).toBe(54);
  });

  it('picks lines deterministically from seed', () => {
    const lineA = kidLine('dee', 'won', 12345);
    const lineB = kidLine('dee', 'won', 12345);
    expect(lineA).toBe(lineB);

    const first = kidLine('dee', 'won', 0);
    const second = kidLine('dee', 'won', 1);
    const third = kidLine('dee', 'won', 2);
    const wrapped = kidLine('dee', 'won', 3);

    expect(wrapped).toBe(first);
    expect(first).toBe(KID_LINES.dee.won[0]);
    expect(second).toBe(KID_LINES.dee.won[1]);
    expect(third).toBe(KID_LINES.dee.won[2]);
  });
});

describe('Pre-match screen', () => {
  const channel: ChannelRules =
    CHANNELS[0] ??
    (() => {
      throw new Error('missing channel');
    })();
  const commanders: readonly [HudSeat, HudSeat] = [
    { name: 'Player 1', note: 'WASD · Space' },
    { name: 'Dee', note: 'Switch B' },
  ];

  it('human seat becomes ready only on a fire press', () => {
    const host = document.createElement('div');
    const mockInput = createMockInput();
    const mockLoop = createMockLoopFactory();
    const onReady = vi.fn();
    const onBack = vi.fn();

    const prematch = createPrematchScreen({
      host,
      channel,
      commanders,
      kids: [null, 'dee'],
      input: mockInput.input,
      createLoop: mockLoop.createLoop,
      humans: [true, false],
      onReady,
      onBack,
    });

    const stamps = host.querySelectorAll('.td-ready-stamp');
    const seat1Stamp = stamps[0];
    expect(seat1Stamp).toBeDefined();
    expect(seat1Stamp?.hasAttribute('hidden')).toBe(true);

    // Stepping without fire press leaves seat 1 unready
    mockLoop.step(0.5);
    expect(seat1Stamp?.hasAttribute('hidden')).toBe(true);

    // Pressing fire marks seat 1 ready
    mockInput.setSeatFrame(1, { pressed: new Set(['fire']) });
    mockLoop.step(0.016);
    expect(seat1Stamp?.hasAttribute('hidden')).toBe(false);

    prematch.dispose();
  });

  it('Kid seats become ready on their own after about 0.9s', () => {
    const host = document.createElement('div');
    const mockInput = createMockInput();
    const mockLoop = createMockLoopFactory();
    const onReady = vi.fn();
    const onBack = vi.fn();

    const prematch = createPrematchScreen({
      host,
      channel,
      commanders,
      kids: [null, 'dee'],
      input: mockInput.input,
      createLoop: mockLoop.createLoop,
      humans: [true, false],
      onReady,
      onBack,
    });

    const stamps = host.querySelectorAll('.td-ready-stamp');
    const kidStamp = stamps[1];
    expect(kidStamp).toBeDefined();
    expect(kidStamp?.hasAttribute('hidden')).toBe(true);

    // Before 0.9s Kid is not ready
    mockLoop.step(0.8);
    expect(kidStamp?.hasAttribute('hidden')).toBe(true);

    // At 0.9s Kid becomes ready
    mockLoop.step(0.15);
    expect(kidStamp?.hasAttribute('hidden')).toBe(false);

    prematch.dispose();
  });

  it('calls onReady exactly once, 0.5s after both are ready', () => {
    const host = document.createElement('div');
    const mockInput = createMockInput();
    const mockLoop = createMockLoopFactory();
    const onReady = vi.fn();
    const onBack = vi.fn();

    const prematch = createPrematchScreen({
      host,
      channel,
      commanders,
      kids: [null, 'dee'],
      input: mockInput.input,
      createLoop: mockLoop.createLoop,
      humans: [true, false],
      onReady,
      onBack,
    });

    // Human readies at 0.1s
    mockInput.setSeatFrame(1, { pressed: new Set(['fire']) });
    mockLoop.step(0.1);
    mockInput.setSeatFrame(1, { pressed: new Set() });
    expect(onReady).not.toHaveBeenCalled();

    // Kid readies at 0.9s total
    mockLoop.step(0.85);
    expect(onReady).not.toHaveBeenCalled();

    // 0.4s later: not yet called
    mockLoop.step(0.4);
    expect(onReady).not.toHaveBeenCalled();

    // 0.15s later (past 0.5s): onReady is called once
    mockLoop.step(0.15);
    expect(onReady).toHaveBeenCalledTimes(1);

    // Further steps do not re-trigger onReady
    mockLoop.step(1.0);
    expect(onReady).toHaveBeenCalledTimes(1);

    prematch.dispose();
  });

  it('Back button calls onBack', () => {
    const host = document.createElement('div');
    const mockInput = createMockInput();
    const mockLoop = createMockLoopFactory();
    const onReady = vi.fn();
    const onBack = vi.fn();

    const prematch = createPrematchScreen({
      host,
      channel,
      commanders,
      kids: [null, 'dee'],
      input: mockInput.input,
      createLoop: mockLoop.createLoop,
      humans: [true, false],
      onReady,
      onBack,
    });

    const backButton = host.querySelector<HTMLButtonElement>('.td-prematch-back');
    expect(backButton).not.toBeNull();
    backButton?.click();
    expect(onBack).toHaveBeenCalledTimes(1);

    prematch.dispose();
  });

  it('dispose removes markup and stops the loop', () => {
    const host = document.createElement('div');
    const mockInput = createMockInput();
    const mockLoop = createMockLoopFactory();
    const onReady = vi.fn();
    const onBack = vi.fn();

    const prematch = createPrematchScreen({
      host,
      channel,
      commanders,
      kids: [null, 'dee'],
      input: mockInput.input,
      createLoop: mockLoop.createLoop,
      humans: [true, false],
      onReady,
      onBack,
    });

    expect(host.querySelector('.td-prematch')).not.toBeNull();
    expect(mockLoop.isStopped()).toBe(false);

    prematch.dispose();

    expect(host.querySelector('.td-prematch')).toBeNull();
    expect(host.children.length).toBe(0);
    expect(mockLoop.isStopped()).toBe(true);
  });
});

describe('Results screen', () => {
  const channel: ChannelRules =
    CHANNELS[0] ??
    (() => {
      throw new Error('missing channel');
    })();
  const seats: readonly [HudSeat, HudSeat] = [
    { name: 'Ace', note: 'Player 1' },
    { name: 'Dee', note: 'Rival' },
  ];

  it('displays the correct banner text for win, loss, draw, and versus', () => {
    const host = document.createElement('div');

    // 1. Win against Kid
    const winResults = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0, [10, 4]),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt: null,
      bestBank: 0,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });
    const winBanner = host.querySelector('.td-results-banner');
    expect(winBanner?.textContent).toContain('You win');
    winResults.dispose();

    // 2. Loss against Kid
    const lossResults = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(1, [3, 10]),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt: null,
      bestBank: 0,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });
    const lossBanner = host.querySelector('.td-results-banner');
    expect(lossBanner?.textContent).toContain('Dee wins');
    lossResults.dispose();

    // 3. Draw against Kid
    const drawResults = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(null, [7, 7]),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt: null,
      bestBank: 0,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });
    const drawBanner = host.querySelector('.td-results-banner');
    expect(drawBanner?.textContent).toContain('Draw');
    drawResults.dispose();

    // 4. Versus win (seat 1)
    const vsSeats: readonly [HudSeat, HudSeat] = [
      { name: 'Robin', note: '' },
      { name: 'Terry', note: '' },
    ];
    const vsResults = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0, [8, 5]),
      seats: vsSeats,
      kids: [null, null],
      versus: true,
      receipt: null,
      bestBank: 0,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });
    const vsBanner = host.querySelector('.td-results-banner');
    expect(vsBanner?.textContent).toContain('Robin wins');
    const winnerRibbon = host.querySelector('.td-winner-ribbon');
    expect(winnerRibbon).not.toBeNull();
    vsResults.dispose();
  });

  it('orders buttons correctly and uses Rematch in versus mode', () => {
    const host = document.createElement('div');

    // Solo mode: Play again (R), Game menu, Back to the Hall (H)
    const soloResults = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt: null,
      bestBank: 0,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });

    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.td-results-actions button')];
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.textContent).toContain('Play again');
    expect(buttons[0]?.textContent).toContain('R');
    expect(buttons[1]?.textContent).toContain('Game menu');
    expect(buttons[2]?.textContent).toContain('Back to the Hall');
    expect(buttons[2]?.textContent).toContain('H');
    soloResults.dispose();

    // Versus mode: Rematch (R), Game menu, Back to the Hall (H)
    const vsResults = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0),
      seats,
      kids: [null, null],
      versus: true,
      receipt: null,
      bestBank: 0,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });
    const vsButtons = [...host.querySelectorAll<HTMLButtonElement>('.td-results-actions button')];
    expect(vsButtons[0]?.textContent).toContain('Rematch');
    vsResults.dispose();
  });

  it('R and H keyboard shortcuts call their respective handlers', () => {
    const host = document.createElement('div');
    const onPlayAgain = vi.fn();
    const onGameMenu = vi.fn();
    const onBackToHall = vi.fn();

    const results = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt: null,
      bestBank: 0,
      onPlayAgain,
      onGameMenu,
      onBackToHall,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true }));
    expect(onBackToHall).toHaveBeenCalledTimes(1);

    // Modifier combinations are ignored
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyR', ctrlKey: true, bubbles: true }),
    );
    expect(onPlayAgain).toHaveBeenCalledTimes(1);

    results.dispose();
  });

  it('shows patches only when earned in receipt', () => {
    const host = document.createElement('div');

    const dummyPatch: PatchEarned = {
      game: 'tank-duel',
      patch: {
        id: 'ricochet',
        tier: 'club',
        title: 'Ricochet',
        description: 'Score 10 hits with shells that bounced off a wall.',
        goal: { metric: { kind: 'sum', event: 'hit', field: 'banked' }, target: 10 },
      },
      gold: true,
      at: '2026-10-26T12:00:00Z',
      upgradedToGold: false,
    };

    const receipt: ResultReceipt = {
      newBest: true,
      rank: 2,
      patchesEarned: [dummyPatch],
      micro: null,
    };

    const results = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt,
      bestBank: 3,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });

    const patchElements = host.querySelectorAll('.td-patch-earned');
    expect(patchElements).toHaveLength(1);
    expect(patchElements[0]?.textContent).toContain('Ricochet');
    expect(patchElements[0]?.textContent).toContain('Gold thread');

    const facts = host.querySelectorAll('.td-fact-row');
    expect(facts.length).toBeGreaterThan(0);
    const factsText = host.querySelector('.td-results-facts')?.textContent;
    expect(factsText).toContain('Best bank ×3');
    expect(factsText).toContain('New best on this channel');
    expect(factsText).toContain('Rank 2 on this channel');

    results.dispose();
  });

  it('practice mode shows no facts or patches', () => {
    const host = document.createElement('div');

    const results = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0),
      seats,
      kids: [null, null],
      versus: false,
      receipt: null,
      bestBank: 4,
      onPlayAgain: vi.fn(),
      onGameMenu: vi.fn(),
      onBackToHall: vi.fn(),
    });

    expect(host.querySelector('.td-results-facts')).toBeNull();
    expect(host.querySelector('.td-results-patches')).toBeNull();

    results.dispose();
  });

  it('dispose removes the key listener and clears DOM elements', () => {
    const host = document.createElement('div');
    const onPlayAgain = vi.fn();
    const onBackToHall = vi.fn();

    const results = createResultsScreen({
      host,
      channel,
      final: createDummyMatchState(0),
      seats,
      kids: [null, 'dee'],
      versus: false,
      receipt: null,
      bestBank: 0,
      onPlayAgain,
      onGameMenu: vi.fn(),
      onBackToHall,
    });

    expect(host.querySelector('.td-results')).not.toBeNull();
    results.dispose();

    expect(host.querySelector('.td-results')).toBeNull();
    expect(host.children.length).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true }));
    expect(onPlayAgain).not.toHaveBeenCalled();
    expect(onBackToHall).not.toHaveBeenCalled();
  });
});
