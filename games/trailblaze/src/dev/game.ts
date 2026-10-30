/**
 * Dev-only harness entry point for Trailblaze: parses URL options to drive the run,
 * mounts the real module with a fake context and Hall-like chrome, and provides lead shortcuts.
 */
import '@fontsource-variable/atkinson-hyperlegible-next/wght';
import '@fontsource-variable/big-shoulders-display/wght';

import {
  briefFor,
  kidById,
  randomSeed,
  type Appearance,
  type Challenge,
  type DifficultySwitches,
  type GameInstance,
  type GameView,
  type KidId,
  type MemoryMode,
  type MicroBrief,
  type RunInfo,
  type RunMode,
  type SwitchPosition,
} from '@woodgrain-88/kit';
import { manifest } from '../manifest.ts';
import { trailblaze } from '../module.ts';
import { createFakeChrome, type FakeChrome } from './fake-chrome.ts';
import { createFakeContext, type FakeContext, type HarnessLog } from './fake-context.ts';

declare global {
  interface Window {
    __trailblaze?: {
      readonly log: HarnessLog;
      readonly instance: GameInstance;
      readonly fake: FakeContext;
    };
  }
}

const params = new URLSearchParams(window.location.search);

const rawMode = params.get('mode') ?? 'normal';
let mode: RunMode = 'normal';
if (rawMode === 'micro') {
  mode = 'power-cycle-run';
} else if (
  rawMode === 'daily' ||
  rawMode === 'challenge' ||
  rawMode === 'power-cycle-run' ||
  rawMode === 'versus-night'
) {
  mode = rawMode;
}

const seed = params.has('seed') ? Number(params.get('seed')) : randomSeed();

let channel = params.get('channel') ?? manifest.channels[0]?.id ?? 'game-1';
let microBrief: MicroBrief | undefined;

if (rawMode === 'micro') {
  const microId = params.get('micro');
  const microDef =
    trailblaze.microChallenges?.find((m) => m.id === microId) ?? trailblaze.microChallenges?.[0];
  if (microDef) {
    microBrief = briefFor(microDef);
    channel = microDef.channel;
  }
}

const dailyNumber = params.has('daily') ? Number(params.get('daily')) : undefined;

let challenge: Challenge | undefined;
if (params.has('challenge')) {
  challenge = {
    game: manifest.id,
    channel,
    seed,
    score: Number(params.get('challenge')),
  };
}

const run: RunInfo = {
  mode,
  seed,
  channel,
  ...(dailyNumber !== undefined ? { dailyNumber } : {}),
  ...(microBrief !== undefined ? { micro: microBrief } : {}),
  ...(challenge !== undefined ? { challenge } : {}),
};

const kidParam = params.get('kid');
const kid = kidParam === 'person' ? null : (kidParam ?? 'lou');

const appearanceParam = params.get('appearance');
let appearance: Appearance =
  appearanceParam === 'light' || appearanceParam === 'dark'
    ? appearanceParam
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

const reducedMotion =
  params.get('reduced') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const leftPos: SwitchPosition = params.get('left') === 'A' ? 'A' : 'B';
const rightPos: SwitchPosition = params.get('right') === 'A' ? 'A' : 'B';
let switches: DifficultySwitches = { left: leftPos, right: rightPos };

const kids: MemoryMode = params.get('kids') === 'sharp' ? 'sharp' : 'human';

const host = document.getElementById('host');
if (!host) {
  throw new Error('Harness page requires #host element');
}

const shortcutHint = document.createElement('div');
shortcutHint.className = 'fake-shortcuts-hint';
shortcutHint.style.cssText =
  'position: fixed; bottom: 8px; left: 16px; font-size: 11px; font-family: monospace; color: #aaa; background: rgba(0, 0, 0, 0.65); padding: 4px 8px; border-radius: 4px; pointer-events: none; z-index: 30; line-height: 1.4;';

function updateShortcutHint(): void {
  shortcutHint.textContent = `F2: ${appearance} | F3: left ${switches.left} | F4: right ${switches.right}`;
}
updateShortcutHint();
document.body.append(shortcutHint);

function showHowToPlayDialog(): void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: grid; place-items: center; z-index: 110;';

  const card = document.createElement('div');
  card.style.cssText =
    'background: #222; color: #eee; border-radius: 12px; border: 1px solid #444; padding: 24px; width: min(480px, calc(100vw - 32px)); max-height: 80vh; overflow-y: auto; font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;';

  const rows = trailblaze.howToPlay.controls
    .map(
      (c) =>
        `<tr><td style="padding: 4px 0; font-weight: 700;">${c.keys.join(', ')}</td><td style="padding: 4px 0;">${c.does} ${c.seat ? `(Seat ${c.seat})` : ''}</td></tr>`,
    )
    .join('');

  const tipsList = trailblaze.howToPlay.tips
    ? `<h3 style="margin: 8px 0 0; font-size: 14px; text-transform: uppercase; color: #aaa;">Tips</h3><ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.4;">${trailblaze.howToPlay.tips.map((t) => `<li>${t}</li>`).join('')}</ul>`
    : '';

  card.innerHTML = `
    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">How to play</h2>
    <p style="margin: 0; line-height: 1.4; font-size: 14px;">${trailblaze.howToPlay.goal}</p>
    <h3 style="margin: 8px 0 0; font-size: 14px; text-transform: uppercase; color: #aaa;">Controls</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">${rows}</table>
    ${tipsList}
    <button type="button" style="margin-top: 8px; min-height: 40px; border-radius: 8px; border: 1px solid #555; background: #333; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;">Close</button>
  `;

  card.querySelector('button')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) backdrop.remove();
  });

  backdrop.append(card);
  document.body.append(backdrop);
}

function showSettingsDialog(): void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: grid; place-items: center; z-index: 110;';

  const card = document.createElement('div');
  card.style.cssText =
    'background: #222; color: #eee; border-radius: 12px; border: 1px solid #444; padding: 24px; width: min(400px, calc(100vw - 32px)); font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;';

  card.innerHTML = `
    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Harness Settings</h2>
    <div style="font-size: 14px; display: flex; flex-direction: column; gap: 8px;">
      <div><strong>Appearance:</strong> ${appearance} (Press F2 to toggle)</div>
      <div><strong>Left Switch:</strong> ${switches.left} (Press F3 to toggle)</div>
      <div><strong>Right Switch:</strong> ${switches.right} (Press F4 to toggle)</div>
      <div><strong>Reduced Motion:</strong> ${reducedMotion ? 'Yes' : 'No'}</div>
      <div><strong>Seat 2:</strong> ${kid ? kidById(kid as KidId).name : 'Player 2'}</div>
    </div>
    <button type="button" style="margin-top: 8px; min-height: 40px; border-radius: 8px; border: 1px solid #555; background: #333; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;">Close</button>
  `;

  card.querySelector('button')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) backdrop.remove();
  });

  backdrop.append(card);
  document.body.append(backdrop);
}

// Both are set once the page is built; the callbacks below only run after that.
let instance: GameInstance | null = null;
let fakeChrome: FakeChrome | null = null;

/** The Hall would ask first when a run would be lost; the harness just says what it would do. */
function handleBackToHall(): void {
  const losing = instance?.leaveCheck() === 'would-lose-progress';
  document.body.dataset.leftToHall = losing ? 'asked' : 'left';
}

const speed = Number(params.get('speed') ?? '1');

const fake = createFakeContext({
  manifest,
  host,
  run,
  kid,
  appearance,
  reducedMotion,
  switches,
  kids,
  speed,
  chrome: {
    openPause(): void {
      fake.setPaused(true);
      instance?.pause('menu');
      fakeChrome?.openPause();
    },
    openSettings(): void {
      showSettingsDialog();
    },
    openHowToPlay(): void {
      showHowToPlayDialog();
    },
    backToHall(): void {
      handleBackToHall();
    },
    viewChanged(view: GameView): void {
      fakeChrome?.showView(view);
      shortcutHint.style.display = view === 'menu' ? 'block' : 'none';
    },
  },
});

fakeChrome = createFakeChrome({
  host: document.body,
  pauseItems: () => fake.log.pauseItems,
  onResume(): void {
    fake.setPaused(false);
    instance?.resume();
  },
  onGameMenu(): void {
    fake.setPaused(false);
    instance?.gameMenu();
  },
  onBackToHall(): void {
    handleBackToHall();
  },
  onHowToPlay(): void {
    showHowToPlayDialog();
  },
  onSettings(): void {
    showSettingsDialog();
  },
});

// ?look= sets the look before the game reads its settings, for pictures and tests.
const lookParam = params.get('look');
if (lookParam) fake.context.settings.game.set('tb.look', lookParam);

instance = trailblaze.mount(host, fake.context);

window.__trailblaze = {
  log: fake.log,
  instance,
  fake,
};

window.addEventListener('keydown', (event) => {
  if (event.code === 'F2') {
    event.preventDefault();
    appearance = appearance === 'light' ? 'dark' : 'light';
    fake.setAppearance(appearance);
    updateShortcutHint();
  } else if (event.code === 'F3') {
    event.preventDefault();
    switches = { ...switches, left: switches.left === 'A' ? 'B' : 'A' };
    fake.setSwitches(switches);
    updateShortcutHint();
  } else if (event.code === 'F4') {
    event.preventDefault();
    switches = { ...switches, right: switches.right === 'A' ? 'B' : 'A' };
    fake.setSwitches(switches);
    updateShortcutHint();
  }
});
