/**
 * How to play, interactive: seven short steps on the real engine, the
 * player flying the orange ship on the arrows, each advancing itself once its own test
 * passes (or on Enter). A plain 2D sketch is enough to see the field; the
 * real looks are the controller's, not this screen's.
 */
import { createMatch, stepMatch } from '../engine/match.ts';
import {
  CARTRIDGE_MATCH_TICKS,
  CENTRE_RADIUS,
  CENTRE_X,
  CENTRE_Y,
  FIELD_HEIGHT,
  FINE_PER_UNIT,
  FIELD_WIDTH,
  IDLE,
  SHIP_RADIUS,
  SUBPIXELS,
  TICKS_PER_SECOND,
  type Body,
  type Controls,
  type Match,
} from '../engine/types.ts';
import { variation } from '../engine/variations.ts';
import { ensureScreenStyle } from './style.ts';

export interface TutorialOptions {
  readonly host: HTMLElement;
  readonly onDone: () => void;
}

export interface TutorialScreen {
  dispose(): void;
}

interface Step {
  readonly instruction: string;
  /** A fresh match for this step; variation 1 unless the step needs the cloak, the star or docking. */
  readonly variationNumber: number;
  /** Sets the field up for the lesson, where the cartridge's own start would not teach it. */
  arrange?(match: Match): void;
  /** True once the step is done, given the match and what has happened since it started. */
  done(match: Readonly<Match>, progress: StepProgress): boolean;
}

/** What a step tracks since it began, for its own done() check. */
interface StepProgress {
  startHeading: number;
  turnedSteps: number;
  startX: number;
  startY: number;
  movedSteps: number;
  wasFast: boolean;
  slowedAfterFast: boolean;
  fired: boolean;
  hit: boolean;
  tries: number;
  cloakedOnce: boolean;
  uncloakedAfter: boolean;
  docked: boolean;
}

function freshProgress(): StepProgress {
  return {
    startHeading: 0,
    turnedSteps: 0,
    startX: 0,
    startY: 0,
    movedSteps: 0,
    wasFast: false,
    slowedAfterFast: false,
    fired: false,
    hit: false,
    tries: 0,
    cloakedOnce: false,
    uncloakedAfter: false,
    docked: false,
  };
}

/** The stopping lesson: fast enough to need a turn-round burn, and slow enough to call it stopped. */
const LESSON_FAST_UNITS = 6;
const LESSON_STOPPED_UNITS = 3;

/** How far ahead of the ship, in steps, the docking lesson's pod waits. */
const TUTORIAL_POD_AHEAD = 16;

function placeAtRest(body: Body, x: number, y: number): void {
  body.x = x;
  body.y = y;
  body.prevX = x;
  body.prevY = y;
  body.vx = 0;
  body.vy = 0;
}

const STEPS: readonly Step[] = [
  {
    instruction: 'Turn: ← and →.',
    variationNumber: 1,
    done: (match, progress) => {
      const heading = match.ships[0].heading;
      const delta = Math.abs(heading - progress.startHeading);
      progress.turnedSteps = Math.max(progress.turnedSteps, Math.min(delta, 16 - delta));
      return progress.turnedSteps >= 8; // half the 16 headings
    },
  },
  {
    instruction: 'Thrust: ↑. You keep drifting after you let go.',
    variationNumber: 1,
    done: (match, progress) => {
      const ship = match.ships[0];
      const dx = ship.x / SUBPIXELS - progress.startX;
      const dy = ship.y / SUBPIXELS - progress.startY;
      progress.movedSteps = Math.max(progress.movedSteps, Math.hypot(dx, dy));
      return progress.movedSteps >= 20;
    },
  },
  {
    instruction: 'Get going, then turn round and thrust the other way to stop.',
    variationNumber: 1,
    done: (match, progress) => {
      const ship = match.ships[0];
      const speed = Math.hypot(ship.vx, ship.vy) / FINE_PER_UNIT;
      if (speed > LESSON_FAST_UNITS) progress.wasFast = true;
      if (progress.wasFast && speed < LESSON_STOPPED_UNITS) progress.slowedAfterFast = true;
      return progress.slowedAfterFast;
    },
  },
  {
    instruction: 'Fire: Enter. Your missile adds your own speed.',
    variationNumber: 1,
    done: (_match, progress) => progress.fired,
  },
  {
    instruction: 'The star pulls everything, missiles too. Bend a shot round it.',
    variationNumber: 4,
    arrange: (match) => {
      // A still target behind the star, so a bent shot has something to hit.
      placeAtRest(match.ships[1], CENTRE_X, CENTRE_Y - (CENTRE_RADIUS + 12) * SUBPIXELS);
    },
    done: (_match, progress) => progress.hit || progress.tries >= 3,
  },
  {
    instruction:
      'Pull ↓ on its own to cloak. Cloaking costs fuel, and you cannot steer while hidden.',
    variationNumber: 2,
    done: (_match, progress) => progress.cloakedOnce && progress.uncloakedAfter,
  },
  {
    instruction: 'Docking: drift gently into the pod. Too fast and it slips away.',
    variationNumber: 14,
    arrange: (match) => {
      // The first pod waits, still, straight ahead: a short burn and a coast reach it.
      const ship = match.ships[0];
      placeAtRest(match.shots[0], ship.x + TUTORIAL_POD_AHEAD * SUBPIXELS, ship.y);
    },
    done: (_match, progress) => progress.docked,
  },
];

const KEYS: Readonly<Record<keyof Controls, string>> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  thrust: 'ArrowUp',
  cloak: 'ArrowDown',
  fire: 'Enter',
};

const STYLE = /* css */ `
.gd-tutorial { display: grid; place-items: center; padding: clamp(10px, 3vh, 28px); box-sizing: border-box; }
.gd-tutorial-panel { width: min(640px, 92vw); padding: 20px; display: grid; gap: 14px; justify-items: center; }
.gd-tutorial-canvas { background: #0c0a16; border-radius: 6px; width: 100%; max-width: 480px; height: auto; }
.gd-tutorial-instruction { font-weight: 800; font-size: clamp(16px, 2.4vh, 20px); text-align: center; }
.gd-tutorial-step { color: var(--gd-muted); font-size: 0.85em; }
`;

export function createTutorialScreen(options: TutorialOptions): TutorialScreen {
  ensureScreenStyle(options.host);
  const root = document.createElement('div');
  root.className = 'gd-screen gd-tutorial';
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);

  const panel = document.createElement('div');
  panel.className = 'gd-card gd-tutorial-panel';
  const instruction = document.createElement('p');
  instruction.className = 'gd-tutorial-instruction';
  const stepLabel = document.createElement('p');
  stepLabel.className = 'gd-tutorial-step';
  const canvas = document.createElement('canvas');
  canvas.className = 'gd-tutorial-canvas';
  canvas.width = 480;
  canvas.height = Math.round((480 * FIELD_HEIGHT) / FIELD_WIDTH);
  panel.append(instruction, canvas, stepLabel);
  root.append(panel);
  options.host.append(root);

  const held = new Set<string>();
  // A tap can start and end inside one frame; it still counts for the next tick.
  const tapped = new Set<string>();
  const onKeyDown = (event: KeyboardEvent): void => {
    held.add(event.code);
    if (!event.repeat) tapped.add(event.code);
    if (event.code === 'Enter' && stepIndex < STEPS.length) advanceIfAllowed();
    if (event.code.startsWith('Arrow') || event.code === 'Enter') event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    held.delete(event.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function pressed(code: string): boolean {
    return held.has(code) || tapped.has(code);
  }

  function controls(): Controls {
    return {
      left: pressed(KEYS.left),
      right: pressed(KEYS.right),
      thrust: pressed(KEYS.thrust),
      cloak: pressed(KEYS.cloak),
      fire: pressed(KEYS.fire),
    };
  }

  let stepIndex = 0;
  let match: Match = startStep(0);
  let progress = freshProgress();

  function startStep(index: number): Match {
    const step = STEPS[index];
    const built = createMatch({
      rules: variation(step?.variationNumber ?? 1),
      switches: ['B', 'B'],
      target: 10,
      clockTicks: CARTRIDGE_MATCH_TICKS,
      seed: index + 1,
    });
    step?.arrange?.(built);
    return built;
  }

  function advanceIfAllowed(): void {
    const step = STEPS[stepIndex];
    if (!step) return;
    if (!step.done(match, progress)) return;
    stepIndex += 1;
    if (stepIndex >= STEPS.length) {
      options.onDone();
      return;
    }
    match = startStep(stepIndex);
    progress = freshProgress();
    const ship = match.ships[0];
    progress.startHeading = ship.heading;
    progress.startX = ship.x / SUBPIXELS;
    progress.startY = ship.y / SUBPIXELS;
  }

  function trackMoment(onStarStep: boolean): void {
    for (const event of match.events) {
      if (event.kind === 'fired' && event.seat === 0) {
        progress.fired = true;
        if (onStarStep) progress.tries += 1;
      }
      if (event.kind === 'hit' && event.shooter === 0) progress.hit = true;
      if (event.kind === 'cloak' && event.seat === 0 && event.on) progress.cloakedOnce = true;
      if (event.kind === 'cloak' && event.seat === 0 && !event.on && progress.cloakedOnce) {
        progress.uncloakedAfter = true;
      }
      if (event.kind === 'docked' && event.seat === 0) progress.docked = true;
    }
  }

  function tick(): void {
    const current = STEPS[stepIndex];
    if (!current) return;
    stepMatch(match, [controls(), IDLE]);
    tapped.clear();
    trackMoment(current.variationNumber === 4);
    if (current.done(match, progress)) advanceIfAllowed();
  }

  function draw(): void {
    const pen = canvas.getContext('2d');
    if (!pen) return;
    const scale = canvas.width / FIELD_WIDTH;
    pen.fillStyle = '#0c0a16';
    pen.fillRect(0, 0, canvas.width, canvas.height);
    const rules = match.setup.rules;
    if (rules.centre !== 'none') {
      pen.fillStyle = '#f6e27f';
      pen.beginPath();
      pen.arc(
        (CENTRE_X / SUBPIXELS) * scale,
        (CENTRE_Y / SUBPIXELS) * scale,
        CENTRE_RADIUS * scale,
        0,
        Math.PI * 2,
      );
      pen.fill();
    }
    const colours = ['#ff8a2a', '#38a8ff'] as const;
    for (const seat of [0, 1] as const) {
      const ship = match.ships[seat];
      if (!ship.present) continue;
      const x = (ship.x / SUBPIXELS) * scale;
      const y = (ship.y / SUBPIXELS) * scale;
      pen.save();
      pen.translate(x, y);
      pen.rotate(-(ship.heading * Math.PI) / 8);
      pen.strokeStyle = colours[seat];
      pen.globalAlpha = ship.cloaked ? 0.3 : 1;
      pen.beginPath();
      pen.moveTo(SHIP_RADIUS * scale * 1.4, 0);
      pen.lineTo(-SHIP_RADIUS * scale, SHIP_RADIUS * scale * 0.8);
      pen.lineTo(-SHIP_RADIUS * scale, -SHIP_RADIUS * scale * 0.8);
      pen.closePath();
      pen.stroke();
      pen.restore();
      pen.globalAlpha = 1;
    }
    if (match.setup.rules.mode === 'duel') {
      const shot = match.shots[0];
      if (shot.live) {
        pen.fillStyle = colours[0];
        pen.beginPath();
        pen.arc((shot.x / SUBPIXELS) * scale, (shot.y / SUBPIXELS) * scale, 2, 0, Math.PI * 2);
        pen.fill();
      }
    } else {
      for (const shot of match.shots) {
        if (!shot.live) continue;
        pen.strokeStyle = '#c3a9ff';
        pen.beginPath();
        pen.arc((shot.x / SUBPIXELS) * scale, (shot.y / SUBPIXELS) * scale, 2.5, 0, Math.PI * 2);
        pen.stroke();
      }
    }
  }

  function render(): void {
    const step = STEPS[stepIndex];
    instruction.textContent = step?.instruction ?? '';
    stepLabel.textContent = `Step ${String(Math.min(stepIndex + 1, STEPS.length))} of ${String(STEPS.length)}`;
    draw();
  }

  let frameId = 0;
  let last = performance.now();
  // Ticks owed carry over between frames: a 60 Hz frame is less than one 50 Hz tick.
  let owed = 0;
  function loop(now: number): void {
    const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
    last = now;
    owed += dt * TICKS_PER_SECOND;
    while (owed >= 1 && stepIndex < STEPS.length) {
      tick();
      owed -= 1;
    }
    render();
    frameId = requestAnimationFrame(loop);
  }
  {
    const ship = match.ships[0];
    progress.startHeading = ship.heading;
    progress.startX = ship.x / SUBPIXELS;
    progress.startY = ship.y / SUBPIXELS;
  }
  frameId = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      root.remove();
    },
  };
}
