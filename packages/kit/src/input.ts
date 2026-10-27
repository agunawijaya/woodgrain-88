/**
 * Input for one or two players on one machine (docs/adr/0003-loop-input-seats.md).
 *
 * Games ask for actions ("fire"), never keys. Each action belongs to a seat:
 * seat 1 is the arrow keys (+ Enter/L) or the first gamepad, seat 2 the left
 * half of the keyboard (WASD + Space/F) or the second gamepad. When one person
 * plays alone ("solo" layout, which a game sets whenever only one person
 * plays) seat 1 answers to both halves of the keyboard and every gamepad.
 *
 * Presses are buffered between simulation steps, so a tap that starts and
 * ends between two ticks still arrives as `pressed` (and `released`) on the
 * next `poll()`. OS key repeat is ignored. Escape is reserved: it never maps
 * to an action and always means "pause".
 */
import { createEmitter, type Unsubscribe } from './emitter.ts';

export type Seat = 1 | 2;
export const SEATS: readonly Seat[] = [1, 2];

export const STANDARD_ACTIONS = ['up', 'down', 'left', 'right', 'fire', 'alt'] as const;
export type StandardAction = (typeof STANDARD_ACTIONS)[number];

/** Games may add their own action names beside the standard six. */
export type Action = StandardAction | (string & {});

export type Layout = 'solo' | 'split';

/** Gamepad inputs use the W3C "standard" mapping indices. */
export type PadInput = { button: number } | { axis: number; direction: -1 | 1 };

export interface SeatBindings {
  /** Action → KeyboardEvent.code values. */
  keys: Record<string, readonly string[]>;
  /** Action → gamepad buttons or axis directions. */
  pad: Record<string, readonly PadInput[]>;
}

export type Bindings = Record<Seat, SeatBindings>;

export const RESERVED_CODES: readonly string[] = ['Escape'];

const STANDARD_PAD: SeatBindings['pad'] = {
  up: [{ button: 12 }, { axis: 1, direction: -1 }],
  down: [{ button: 13 }, { axis: 1, direction: 1 }],
  left: [{ button: 14 }, { axis: 0, direction: -1 }],
  right: [{ button: 15 }, { axis: 0, direction: 1 }],
  fire: [{ button: 0 }],
  alt: [{ button: 1 }, { button: 2 }],
};

/** Gamepad Start pauses, like Escape. */
const PAD_PAUSE_BUTTON = 9;

/**
 * The owner's rule: alone, the arrow keys; two on one keyboard, the first player keeps the arrows
 * and the second takes WASD.
 */
export const DEFAULT_BINDINGS: Bindings = {
  1: {
    keys: {
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
      fire: ['Enter', 'NumpadEnter'],
      alt: ['KeyL'],
    },
    pad: STANDARD_PAD,
  },
  2: {
    keys: {
      up: ['KeyW'],
      down: ['KeyS'],
      left: ['KeyA'],
      right: ['KeyD'],
      fire: ['Space'],
      alt: ['KeyF'],
    },
    pad: STANDARD_PAD,
  },
};

/** What one seat did since the previous poll. */
export interface SeatFrame {
  held: ReadonlySet<Action>;
  pressed: ReadonlySet<Action>;
  released: ReadonlySet<Action>;
  /** Directional intent in [-1, 1], from keys, the d-pad or the left stick. */
  axis: { x: number; y: number };
  /** Whether a gamepad is currently driving this seat. */
  usingPad: boolean;
}

export interface InputFrame {
  seats: Record<Seat, SeatFrame>;
  /** How many polls have happened, so games can stamp replays. */
  poll: number;
}

export interface PointerState {
  /** Position in the pointer target's CSS pixels; null before the first move. */
  x: number | null;
  y: number | null;
  down: boolean;
  /** True for the first poll after a press / release. */
  pressed: boolean;
  released: boolean;
  kind: 'mouse' | 'touch' | 'pen' | null;
}

export interface InputOptions {
  layout?: Layout;
  bindings?: Bindings;
  /** Keyboard events come from here. Default: window. */
  keyTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /** Pointer events come from here (usually the game's host element). */
  pointerTarget?: HTMLElement | null;
  /** Gamepad source, injectable for tests. Default: navigator.getGamepads. */
  gamepads?: () => readonly (Gamepad | null)[];
  /** Which seat each connected gamepad drives, by index. Default [1, 2]. */
  padSeats?: readonly Seat[];
}

export interface InputController {
  /** Call once per simulation step; returns what changed since the last call. */
  poll(): InputFrame;
  readonly pointer: PointerState;
  readonly layout: Layout;
  setLayout(layout: Layout): void;
  setBindings(bindings: Bindings): void;
  /** Escape or gamepad Start. */
  onPause(listener: () => void): Unsubscribe;
  /** Forget everything held, e.g. after the pause menu closes. */
  reset(): void;
  dispose(): void;
}

const STICK_DEADZONE = 0.4;

const CONTROLS =
  'button, input, select, textarea, a[href], [contenteditable], [role="radio"], [role="switch"], [role="slider"], [role="tab"]';

/** Whether a key event was aimed at a focused form control (a game's own menu, a dialog). */
function isOnControl(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    typeof Element !== 'undefined' && target instanceof Element && target.closest(CONTROLS) !== null
  );
}

/** Problems with a set of bindings: reserved keys, or one key driving both seats. */
export function validateBindings(bindings: Bindings, layout: Layout): string[] {
  const problems: string[] = [];
  const owner = new Map<string, string>();
  for (const seat of SEATS) {
    for (const [action, codes] of Object.entries(bindings[seat].keys)) {
      for (const code of codes) {
        if (RESERVED_CODES.includes(code)) problems.push(`${code} is reserved for pause`);
        const previous = owner.get(code);
        const here = `seat ${seat} ${action}`;
        if (previous && layout === 'split' && !previous.startsWith(`seat ${seat} `)) {
          problems.push(`${code} is bound to both ${previous} and ${here}`);
        }
        owner.set(code, here);
      }
    }
  }
  return problems;
}

/** A copy of `bindings` with `code` moved to one seat's action, taken away from anywhere else. */
export function rebind(bindings: Bindings, seat: Seat, action: string, code: string): Bindings {
  if (RESERVED_CODES.includes(code)) throw new Error(`${code} is reserved for pause`);
  const copy: Bindings = {
    1: { keys: { ...bindings[1].keys }, pad: bindings[1].pad },
    2: { keys: { ...bindings[2].keys }, pad: bindings[2].pad },
  };
  for (const s of SEATS) {
    for (const [name, codes] of Object.entries(copy[s].keys)) {
      copy[s].keys[name] = codes.filter((existing) => existing !== code);
    }
  }
  copy[seat].keys[action] = [code];
  return copy;
}

interface SeatState {
  heldKeys: Map<Action, number>;
  pressed: Set<Action>;
  released: Set<Action>;
  padHeld: Set<Action>;
}

function emptySeatState(): SeatState {
  return { heldKeys: new Map(), pressed: new Set(), released: new Set(), padHeld: new Set() };
}

export function createInput(options: InputOptions = {}): InputController {
  let layout: Layout = options.layout ?? 'split';
  let bindings: Bindings = options.bindings ?? DEFAULT_BINDINGS;
  const keyTarget = options.keyTarget ?? window;
  const pointerTarget = options.pointerTarget ?? null;
  const readPads =
    options.gamepads ??
    (() =>
      typeof navigator !== 'undefined' && 'getGamepads' in navigator
        ? navigator.getGamepads()
        : []);
  const padSeats = options.padSeats ?? [1, 2];

  const seats: Record<Seat, SeatState> = { 1: emptySeatState(), 2: emptySeatState() };
  const pauseRequests = createEmitter<undefined>();
  let pollCount = 0;
  let padPauseHeld = false;

  const pointer: PointerState = {
    x: null,
    y: null,
    down: false,
    pressed: false,
    released: false,
    kind: null,
  };
  let pointerPressedPending = false;
  let pointerReleasedPending = false;

  /** Every (seat, action) a key code drives under the current layout. */
  function actionsForCode(code: string): { seat: Seat; action: Action }[] {
    const matches: { seat: Seat; action: Action }[] = [];
    for (const seat of SEATS) {
      for (const [action, codes] of Object.entries(bindings[seat].keys)) {
        if (codes.includes(code)) matches.push({ seat: layout === 'solo' ? 1 : seat, action });
      }
    }
    return matches;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      if (!event.repeat) pauseRequests.emit(undefined);
      return;
    }
    // A key pressed on a menu button, slider or field is that control's, not a seat's.
    if (isOnControl(event)) return;
    const matches = actionsForCode(event.code);
    if (matches.length === 0) return;
    // Arrows and Space would otherwise scroll the page under the game.
    event.preventDefault();
    if (event.repeat) return;
    for (const { seat, action } of matches) {
      const state = seats[seat];
      const count = state.heldKeys.get(action) ?? 0;
      if (count === 0 && !state.padHeld.has(action)) state.pressed.add(action);
      state.heldKeys.set(action, count + 1);
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    for (const { seat, action } of actionsForCode(event.code)) {
      const state = seats[seat];
      const count = state.heldKeys.get(action) ?? 0;
      if (count <= 1) {
        state.heldKeys.delete(action);
        if (!state.padHeld.has(action)) state.released.add(action);
      } else {
        state.heldKeys.set(action, count - 1);
      }
    }
  };

  const releaseEverything = () => {
    for (const seat of SEATS) {
      const state = seats[seat];
      for (const action of state.heldKeys.keys()) state.released.add(action);
      state.heldKeys.clear();
    }
  };

  const toLocal = (event: PointerEvent) => {
    const rect = pointerTarget?.getBoundingClientRect();
    pointer.x = event.clientX - (rect?.left ?? 0);
    pointer.y = event.clientY - (rect?.top ?? 0);
    pointer.kind =
      event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
  };
  const onPointerMove = (event: PointerEvent) => toLocal(event);
  const onPointerDown = (event: PointerEvent) => {
    toLocal(event);
    pointer.down = true;
    pointerPressedPending = true;
  };
  const onPointerUp = (event: PointerEvent) => {
    toLocal(event);
    pointer.down = false;
    pointerReleasedPending = true;
  };

  keyTarget.addEventListener('keydown', onKeyDown as EventListener);
  keyTarget.addEventListener('keyup', onKeyUp as EventListener);
  keyTarget.addEventListener('blur', releaseEverything);
  pointerTarget?.addEventListener('pointermove', onPointerMove);
  pointerTarget?.addEventListener('pointerdown', onPointerDown);
  pointerTarget?.addEventListener('pointerup', onPointerUp);
  pointerTarget?.addEventListener('pointercancel', onPointerUp);

  function padActive(pad: Gamepad, input: PadInput): boolean {
    if ('button' in input) return pad.buttons[input.button]?.pressed ?? false;
    const value = pad.axes[input.axis] ?? 0;
    return input.direction < 0 ? value < -STICK_DEADZONE : value > STICK_DEADZONE;
  }

  /** Folds gamepad state into the seats as edges; returns which seats a pad drives. */
  function readGamepads(): Set<Seat> {
    const nowHeld: Record<Seat, Set<Action>> = { 1: new Set(), 2: new Set() };
    const driven = new Set<Seat>();
    let pauseHeld = false;
    for (const [index, pad] of readPads().entries()) {
      const assigned = padSeats[index];
      if (!pad?.connected || !assigned) continue;
      const seat: Seat = layout === 'solo' ? 1 : assigned;
      driven.add(seat);
      if (pad.buttons[PAD_PAUSE_BUTTON]?.pressed) pauseHeld = true;
      for (const [action, inputs] of Object.entries(bindings[seat].pad)) {
        if (inputs.some((input) => padActive(pad, input))) nowHeld[seat].add(action);
      }
    }
    if (pauseHeld && !padPauseHeld) pauseRequests.emit(undefined);
    padPauseHeld = pauseHeld;

    for (const seat of SEATS) {
      const state = seats[seat];
      for (const action of nowHeld[seat]) {
        if (!state.padHeld.has(action) && !state.heldKeys.has(action)) state.pressed.add(action);
      }
      for (const action of state.padHeld) {
        if (!nowHeld[seat].has(action) && !state.heldKeys.has(action)) state.released.add(action);
      }
      state.padHeld = nowHeld[seat];
    }
    return driven;
  }

  function stickAxis(seat: Seat): { x: number; y: number } | null {
    for (const [index, pad] of readPads().entries()) {
      const assigned = padSeats[index];
      if (!pad?.connected || !assigned || (layout === 'solo' ? 1 : assigned) !== seat) continue;
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (Math.hypot(x, y) > STICK_DEADZONE) return { x, y };
    }
    return null;
  }

  function frameFor(seat: Seat, usingPad: boolean): SeatFrame {
    const state = seats[seat];
    const held = new Set<Action>([...state.heldKeys.keys(), ...state.padHeld]);
    const digital = {
      x: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
      y: (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
    };
    const frame: SeatFrame = {
      held,
      pressed: new Set(state.pressed),
      released: new Set(state.released),
      axis: stickAxis(seat) ?? digital,
      usingPad,
    };
    state.pressed.clear();
    state.released.clear();
    return frame;
  }

  return {
    poll() {
      const driven = readGamepads();
      pointer.pressed = pointerPressedPending;
      pointer.released = pointerReleasedPending;
      pointerPressedPending = false;
      pointerReleasedPending = false;
      pollCount++;
      return {
        seats: { 1: frameFor(1, driven.has(1)), 2: frameFor(2, driven.has(2)) },
        poll: pollCount,
      };
    },
    pointer,
    get layout() {
      return layout;
    },
    setLayout(next) {
      releaseEverything();
      layout = next;
    },
    setBindings(next) {
      releaseEverything();
      bindings = next;
    },
    onPause(listener) {
      return pauseRequests.on(listener);
    },
    reset() {
      for (const seat of SEATS) seats[seat] = emptySeatState();
      pointer.down = false;
      pointerPressedPending = false;
      pointerReleasedPending = false;
    },
    dispose() {
      keyTarget.removeEventListener('keydown', onKeyDown as EventListener);
      keyTarget.removeEventListener('keyup', onKeyUp as EventListener);
      keyTarget.removeEventListener('blur', releaseEverything);
      pointerTarget?.removeEventListener('pointermove', onPointerMove);
      pointerTarget?.removeEventListener('pointerdown', onPointerDown);
      pointerTarget?.removeEventListener('pointerup', onPointerUp);
      pointerTarget?.removeEventListener('pointercancel', onPointerUp);
      pauseRequests.clear();
    },
  };
}
