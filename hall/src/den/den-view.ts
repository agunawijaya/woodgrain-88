/**
 * The Den as a living view: lays the SVG room out to the window, puts the
 * kit's CRT over the TV opening, and runs the room's moments: the power
 * switch (click, drag, P, Shift+P, holding P), the wall labels tuning the TV
 * as you hover or focus them, the Counter's flips, the RESET lever, the two
 * difficulty switches (click, drag, [ and ]), the TV tinting the room at
 * night, and the game card for whatever is on. Den Life's pieces of the room
 * are filled in by den-life-layer.ts.
 */
import {
  canPlanRun,
  createCrt,
  powerCycleOfTheDay,
  toHex,
  type Appearance,
  type CrtScreen,
  type DemoHandle,
  type Rgb,
  type SwitchPosition,
  type TransitionTiming,
} from '@woodgrain-88/kit';
import type { SwitchSide } from '../app/den-life.ts';
import type { Services } from '../app/services.ts';
import {
  counterDigits,
  counterPlaces,
  nextSlot,
  isVersionPlace,
  placeFinished,
  type CounterPlace,
  type Direction,
} from '../data/cycle.ts';
import { createGameCard, type GameCard } from './game-card.ts';
import { fitCore, LAYOUT, toScreen, wallSlot, type Fit } from './geometry.ts';
import { labelSvg } from './label.ts';
import { focusRingPath, denSceneMarkup } from './scene.ts';
import { createAmbience } from './ambience.ts';
import { createDenLifeLayer } from './den-life-layer.ts';
import { createLogoSurface } from './intro.ts';
import { slateDemo, SLATE_SIZE } from './slate.ts';

export interface DenViewOptions {
  services: Services;
  /** `version` is set when the channel plays a particular cartridge version. */
  onOpenGame(id: string, version?: string): void;
  onOpenDetails(id: string, version?: string): void;
  onOpenList(): void;
  onShowShortcuts(): void;
  onOpenJacket(): void;
  onOpenKids(): void;
  onOpenVersus(): void;
  onOpenCalendar(): void;
  /** Holding POWER (or P) for a second, once five games can make a run. */
  onStartRun(): void;
  /**
   * The channel the TV was on when the player last left the room. Coming back from a game lands on
   * the channel it was played from, not on the day's Power Cycle.
   */
  startSlot?: number;
}

export interface DenView {
  readonly element: HTMLElement;
  readonly slot: number;
  /** Flip the power switch, as the lever, P and Shift+P do. */
  powerCycle(direction: Direction): Promise<void>;
  /** The first-visit intro (also "Replay the intro"); any key or click skips it. */
  playIntro(): Promise<void>;
  tuneTo(slot: number): void;
  /** The stage HTML overlays (the Run's cards) are laid on. */
  readonly stage: HTMLElement;
  /** Power Cycle Run: the switch flips itself to the game's channel; `onSnow` fires as the snow starts. */
  runFlip(gameId: string, timing: TransitionTiming, onSnow?: () => void): Promise<void>;
  /** While a run is on, the game card steps aside for the run's own cards. */
  setRunning(running: boolean): void;
  /** Lays an element over the game card's corner of the room, and keeps it there on resize. */
  placeAtCard(element: HTMLElement): () => void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 240;
const HOVER_TUNE_DELAY_MS = 140;
const TINT_SAMPLE_MS = 1000;
const LEVER_THROW_DEGREES = 34;
const DRAG_TRIGGER_PX = 18;
const SWITCH_DRAG_PX = 6;
const HOLD_TO_RUN_MS = 1000;

const SWITCH_SEAT: Record<SwitchSide, number> = { left: 1, right: 2 };
const SWITCH_KEY: Partial<Record<string, SwitchSide>> = { '[': 'left', ']': 'right' };

function query<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new (...args: never[]) => T,
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`The Den is missing ${selector}`);
  return found;
}

/** Keeps the TV's light pleasant: never muddy, never neon, whatever the picture. */
function roomTint(sample: Rgb): string {
  const max = Math.max(sample.r, sample.g, sample.b, 1);
  const lift = Math.min(1.6, 200 / max);
  const r = Math.min(255, sample.r * lift);
  const g = Math.min(255, sample.g * lift);
  const b = Math.min(255, sample.b * lift);
  const grey = (r + g + b) / 3;
  const calm = 0.7;
  return toHex({
    r: grey + (r - grey) * calm,
    g: grey + (g - grey) * calm,
    b: grey + (b - grey) * calm,
  });
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

export function createDenView(options: DenViewOptions): DenView {
  const { services } = options;
  const { settings, audio } = services;

  const element = document.createElement('section');
  element.className = 'den';
  element.setAttribute('aria-label', 'The Den');
  element.innerHTML =
    `<h1 class="sr-only">The Den</h1>` +
    `<div class="den-stage">${denSceneMarkup(services.registry.manifests)}` +
    `<div class="crt-host" aria-hidden="true"></div>` +
    `<div class="crt-glass" aria-hidden="true"></div>` +
    `<div class="den-tooltip" role="status" aria-live="polite" hidden></div>` +
    `</div>` +
    `<p class="sr-only" aria-live="polite" data-ref="announcer"></p>`;

  const stage = query(element, '.den-stage', HTMLDivElement);
  const svg = query(element, 'svg.den-scene', SVGSVGElement);
  const crtHost = query(element, '.crt-host', HTMLDivElement);
  const glass = query(element, '.crt-glass', HTMLDivElement);
  const tooltip = query(element, '.den-tooltip', HTMLDivElement);
  const announcer = query(element, '[data-ref="announcer"]', HTMLParagraphElement);
  const focusIndicator = query(svg, '[data-ref="focus-indicator"]', SVGPathElement);
  const powerArm = query(svg, '[data-ref="power-arm"]', SVGGElement);
  const resetArm = query(svg, '[data-ref="reset-arm"]', SVGGElement);
  const consoleLabel = query(svg, '[data-ref="console-label"]', SVGGElement);
  const lamps = [...svg.querySelectorAll<SVGElement>('[data-ref="counter-lamps"] .lamp')];
  const digits = [0, 1].map((i) => query(svg, `[data-ref="counter-digit-${i}"]`, SVGGElement));
  const cartridges = [...svg.querySelectorAll<SVGGElement>('.cartridge')];
  const tvPowerLight = query(svg, '[data-ref="tv-power-light"]', SVGCircleElement);
  const powerHoldRing = query(svg, '[data-ref="power-hold-ring"]', SVGCircleElement);
  const life = createDenLifeLayer(svg, services);

  const crt: CrtScreen = createCrt(crtHost, {
    effects: settings.crtEnabled(),
    reducedMotion: settings.reducedMotion(),
    scanlineRows: SLATE_SIZE.height / 1.5,
  });

  const today = new Date();
  const powerCycleGame = powerCycleOfTheDay(services.registry.manifests, today);
  let slot = options.startSlot ?? powerCycleGame?.slot ?? 1;
  let demo: DemoHandle | null = null;
  let busy = false;
  let queued: Direction | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdLoop = false;
  let comicSnow = 0;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let tint: Rgb = { r: 120, g: 150, b: 220 };
  let fit: Fit = fitCore({ width: 1600, height: 900 });

  const card: GameCard = createGameCard({
    services,
    onPlay: (id, version) => options.onOpenGame(id, version),
    onDetails: (id, version) => options.onOpenDetails(id, version),
  });
  stage.append(card.element);
  // The game card's corner of the room; the Run's cards take the same place.
  const cardSpots = new Set<HTMLElement>([card.element]);

  // ——— Layout ———
  const layout = () => {
    // Not in the document yet: the resize observer lays it out once it is.
    if (stage.clientWidth === 0 || stage.clientHeight === 0) return;
    fit = fitCore({ width: stage.clientWidth, height: stage.clientHeight });
    const { viewBox } = fit;
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    const screenBox = toScreen(LAYOUT.screen, fit);
    for (const layer of [crtHost, glass]) {
      Object.assign(layer.style, {
        left: `${screenBox.x}px`,
        top: `${screenBox.y}px`,
        width: `${screenBox.width}px`,
        height: `${screenBox.height}px`,
        borderRadius: `${18 * fit.scale}px`,
      });
    }
    for (const spot of cardSpots) placeAtCardSpot(spot);
  };
  const placeAtCardSpot = (target: HTMLElement) => {
    const cardBox = toScreen(LAYOUT.card, fit);
    Object.assign(target.style, {
      left: `${cardBox.x}px`,
      top: `${cardBox.y}px`,
      width: `${cardBox.width}px`,
      fontSize: `${Math.max(12, 15 * fit.scale)}px`,
    });
  };
  const resizeObserver = new ResizeObserver(layout);
  resizeObserver.observe(stage);

  // ——— Appearance ———
  const ambience = createAmbience(audio, settings.appearance());
  const applyAppearance = (appearance: Appearance) => {
    element.dataset.time = appearance === 'dark' ? 'night' : 'day';
    demo?.setAppearance(appearance);
    ambience.setAppearance(appearance);
  };
  applyAppearance(settings.appearance());
  const stopAppearance = settings.onAppearance(applyAppearance);
  const stopMotion = settings.onReducedMotion((reduced) => {
    crt.setReducedMotion(reduced);
    crt.setEffects(settings.crtEnabled());
  });
  // The room sound waits for the first click or key: browsers keep audio locked until then.
  const syncAmbience = () => ambience.setEnabled(settings.get().roomAmbience && audio.unlocked);
  const stopSettings = settings.onChange(() => {
    crt.setEffects(settings.crtEnabled());
    syncAmbience();
  });
  const unlockAndSync = () => void audio.unlock().then(syncAmbience);
  window.addEventListener('pointerdown', unlockAndSync, { once: true });
  window.addEventListener('keydown', unlockAndSync, { once: true });

  // ——— What is on ———
  const places = counterPlaces(services.registry.manifests);
  // The registry always fills all 32 places (a Hall test holds it to that).
  const placeAt = (target: number): CounterPlace => {
    const place = places.find((candidate) => candidate.slot === target);
    if (!place) throw new Error(`Counter place ${target} has nothing on it`);
    return place;
  };

  // Each call bumps the token, so a module that finishes loading after the
  // player has already moved on never replaces the newer picture.
  let demoToken = 0;
  const startDemo = (target: number) => {
    demo?.dispose();
    const token = ++demoToken;
    const { manifest, version } = placeAt(target);
    const entry = services.registry.entryById(manifest.id);
    const context = {
      appearance: settings.appearance(),
      reducedMotion: settings.reducedMotion(),
      width: SLATE_SIZE.width,
      height: SLATE_SIZE.height,
      ...(version ? { version: version.id } : {}),
    };
    const offscreen = document.createElement('div');
    demo = slateDemo(offscreen, manifest, context, target);
    crt.setSource(demo.surface);
    if (!entry?.load) return;
    void entry.load().then((module) => {
      if (token !== demoToken) return;
      demo?.dispose();
      demo = module.demo(offscreen, target, context);
      crt.setSource(demo.surface);
    });
  };

  const showCounter = (target: number, animate: boolean) => {
    const text = counterDigits(target);
    digits.forEach((digit, i) => {
      const value = text[i] ?? '0';
      const face = query(digit, '.flip-digit-text', SVGTextElement);
      const flapText = query(digit, '.flip-flap-text', SVGTextElement);
      if (face.textContent === value) return;
      if (animate && !settings.reducedMotion()) {
        flapText.textContent = face.textContent;
        digit.classList.remove('is-flipping');
        // Restart the flap animation from its first frame.
        void digit.getBoundingClientRect();
        digit.classList.add('is-flipping');
      }
      face.textContent = value;
    });
    lamps.forEach((lamp) =>
      lamp.classList.toggle('is-current', Number(lamp.dataset.slot) === target),
    );
    lightPlayedLamps();
  };

  // The Counter's lamps: one for each game with a patch earned, and the last
  // two for the merged games' other cartridge versions, once finished.
  const lightPlayedLamps = () => {
    const progress = services.repos.progress.get();
    for (const lamp of lamps) {
      lamp.classList.toggle(
        'is-played',
        placeFinished(placeAt(Number(lamp.dataset.slot)), progress),
      );
    }
  };

  const showCartridge = (target: number) => {
    const { manifest } = placeAt(target);
    consoleLabel.innerHTML = labelSvg(manifest, { idPrefix: 'console-slot' });
    cartridges.forEach((cartridge) =>
      cartridge.classList.toggle('is-tuned', cartridge.dataset.game === manifest.id),
    );
  };

  const glowOnWall = (target: number) => {
    const { manifest } = placeAt(target);
    const cartridge = cartridges.find((c) => c.dataset.game === manifest.id);
    if (!cartridge) return;
    cartridge.classList.remove('is-glowing');
    void cartridge.getBoundingClientRect();
    cartridge.classList.add('is-glowing');
  };

  const announce = (target: number) => {
    const { manifest, version } = placeAt(target);
    const versionText = version ? `, ${version.label} version` : '';
    announcer.textContent = `Channel ${target}: ${manifest.title}${versionText}. ${manifest.status === 'coming-soon' ? 'Coming soon.' : ''}`;
  };

  const setSlot = (target: number, animateCounter: boolean) => {
    slot = target;
    startDemo(target);
    showCounter(target, animateCounter);
    showCartridge(target);
    card.show(placeAt(target));
    announce(target);
  };

  // ——— The power switch ———
  const throwLever = (direction: Direction) => {
    if (settings.reducedMotion()) return;
    powerArm.style.transition = 'transform 90ms cubic-bezier(0.3, 1.6, 0.6, 1)';
    powerArm.style.transform = `rotate(${direction * LEVER_THROW_DEGREES}deg)`;
    setTimeout(() => {
      powerArm.style.transition = 'transform 420ms cubic-bezier(0.2, 1.8, 0.4, 1)';
      powerArm.style.transform = 'rotate(0deg)';
    }, 260);
  };

  const powerCycle = async (direction: Direction, quick = false): Promise<void> => {
    if (busy) {
      queued = direction;
      return;
    }
    busy = true;
    void audio.unlock();
    audio.play('power-clunk', { pitch: quick ? 1.15 : 1 });
    throwLever(direction);
    element.classList.add('is-power-cycling');
    tvPowerLight.classList.add('is-off');
    const target = nextSlot(slot, direction);
    audio.play('tube-off');
    await crt.powerOff();
    setSlot(target, true);
    audio.play('flip-tick');
    glowOnWall(target);
    audio.play('static-hiss', { gain: quick ? 0.7 : 1 });
    if (!quick) audio.play('degauss');
    tvPowerLight.classList.remove('is-off');
    // While the set shows snow it throws a cold, flickering light into the room.
    element.classList.remove('is-power-cycling');
    element.classList.add('is-snowing');
    await crt.powerOn({ snowMs: quick ? 140 : 300 });
    element.classList.remove('is-snowing');
    setTimeout(sampleTint, 60);
    busy = false;
    if (queued !== null) {
      const next = queued;
      queued = null;
      void powerCycle(next, quick);
    }
  };

  // ——— Power Cycle Run: the switch flips by itself ———
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const runFlip = async (
    target: number,
    timing: TransitionTiming,
    onSnow?: () => void,
  ): Promise<void> => {
    busy = true;
    void audio.unlock();
    if (settings.reducedMotion()) {
      // A quick cross-fade instead of the whole performance.
      setSlot(target, false);
      onSnow?.();
      await crt.snow(160, 0.6);
      busy = false;
      return;
    }
    // The run's sound follows its own setting, on top of the effects volume.
    const gain = { quiet: 0.5, normal: 1, loud: 1.4 }[settings.get().runSound];
    element.style.setProperty('--run-dim-ms', `${timing.dimMs}ms`);
    element.style.setProperty('--run-slide-ms', `${timing.slideMs}ms`);
    element.classList.add('is-run-dimming');
    // The fifth flip is the fastest, and the room can barely keep up.
    const frantic = timing.dimMs < 250;
    element.classList.toggle('is-frantic', frantic);
    if (frantic) crt.setSnowFloor(0.3);
    await wait(timing.dimMs);
    audio.play('power-clunk', { pitch: 1 + (1 - timing.dimMs / 400), gain });
    throwLever(1);
    tvPowerLight.classList.add('is-off');
    audio.play('tube-off', { gain });
    await crt.powerOff();
    // The next cartridge slides into the console and the Counter flips over to it.
    consoleLabel.classList.remove('is-sliding');
    void consoleLabel.getBoundingClientRect();
    consoleLabel.classList.add('is-sliding');
    setSlot(target, true);
    glowOnWall(target);
    audio.play('flip-tick', { gain });
    await wait(Math.max(timing.slideMs, timing.flipMs));
    tvPowerLight.classList.remove('is-off');
    audio.play('static-hiss', { gain });
    element.classList.add('is-snowing');
    onSnow?.();
    await crt.powerOn({ snowMs: timing.snowMs });
    element.classList.remove('is-snowing', 'is-run-dimming', 'is-frantic');
    crt.setSnowFloor(0);
    setTimeout(sampleTint, 60);
    busy = false;
  };

  const slotOf = (gameId: string): number =>
    places.find((place) => place.manifest.id === gameId && !isVersionPlace(place.slot))?.slot ??
    slot;

  // Holding the switch starts a Power Cycle Run once five games can make one;
  // until then holding it is the old joke: flip after flip, the snow growing comic.
  let runHold: ReturnType<typeof setTimeout> | null = null;
  const canStartRun = () => canPlanRun(services.denLife.runCandidates());
  const beginRunHold = () => {
    powerHoldRing.classList.add('is-holding');
    runHold = setTimeout(() => {
      cancelRunHold();
      // The press became a hold: letting go now must not flip the switch as well.
      dragStart = null;
      options.onStartRun();
    }, HOLD_TO_RUN_MS);
  };
  const cancelRunHold = () => {
    if (runHold !== null) clearTimeout(runHold);
    runHold = null;
    powerHoldRing.classList.remove('is-holding');
  };

  const startHold = (direction: Direction) => {
    void powerCycle(direction);
    if (canStartRun()) {
      beginRunHold();
      return;
    }
    holdTimer = setTimeout(() => {
      holdLoop = true;
      const step = () => {
        if (!holdLoop) return;
        // Holding the switch is deliberately a little absurd: the snow grows comic.
        comicSnow = Math.min(0.55, comicSnow + 0.06);
        crt.setSnowFloor(comicSnow);
        void powerCycle(direction, true);
        holdTimer = setTimeout(step, HOLD_INTERVAL_MS);
      };
      step();
    }, HOLD_DELAY_MS);
  };

  const endHold = () => {
    cancelRunHold();
    holdLoop = false;
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    if (comicSnow > 0) {
      const settle = () => {
        comicSnow = Math.max(0, comicSnow - 0.05);
        crt.setSnowFloor(comicSnow);
        if (comicSnow > 0) setTimeout(settle, 60);
      };
      settle();
    }
  };

  // ——— Tuning from the wall ———
  const tuneTo = (target: number) => {
    if (target === slot || busy) return;
    audio.play('channel-blip');
    void crt.snow(140, 0.9);
    setSlot(target, true);
    glowOnWall(target);
  };

  // ——— Pointer and keyboard on hotspots ———
  const hotspot = (ref: string) => query(svg, `[data-ref="${ref}"]`, SVGGElement);
  const power = hotspot('power');
  const reset = hotspot('reset');

  let dragStart: { x: number; pointer: number } | null = null;
  let dragFired = false;
  power.addEventListener('pointerdown', (event) => {
    dragStart = { x: event.clientX, pointer: event.pointerId };
    dragFired = false;
    power.setPointerCapture(event.pointerId);
    if (canStartRun()) beginRunHold();
  });
  power.addEventListener('pointermove', (event) => {
    if (!dragStart || dragFired || settings.reducedMotion()) return;
    const dx = event.clientX - dragStart.x;
    const angle = Math.max(-LEVER_THROW_DEGREES, Math.min(LEVER_THROW_DEGREES, dx * 0.9));
    powerArm.style.transition = 'none';
    powerArm.style.transform = `rotate(${angle}deg)`;
    if (Math.abs(dx) > DRAG_TRIGGER_PX) {
      cancelRunHold();
      dragFired = true;
      void powerCycle(dx > 0 ? 1 : -1);
    }
  });
  power.addEventListener('pointerup', (event) => {
    cancelRunHold();
    if (dragStart && !dragFired) void powerCycle(event.shiftKey ? -1 : 1);
    dragStart = null;
  });
  power.addEventListener('pointercancel', cancelRunHold);
  power.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void powerCycle(event.shiftKey ? -1 : 1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      void powerCycle(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  const pressReset = () => {
    audio.play('reset-rasp');
    if (!settings.reducedMotion()) {
      resetArm.style.transition = 'transform 80ms ease-out';
      resetArm.style.transform = 'rotate(28deg)';
      setTimeout(() => {
        resetArm.style.transition = 'transform 360ms cubic-bezier(0.2, 1.8, 0.4, 1)';
        resetArm.style.transform = 'rotate(0deg)';
      }, 180);
    }
    // RESET restarted the game already on screen; it never changed channel.
    startDemo(slot);
    void crt.roll();
  };
  reset.addEventListener('click', pressReset);
  reset.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pressReset();
    }
  });

  const showTooltip = (text: string, anchor: Element, below = false) => {
    const box = anchor.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.hidden = false;
    tooltip.classList.toggle('is-below', below);
    tooltip.style.left = `${box.left - stageBox.left + box.width / 2}px`;
    tooltip.style.top = `${(below ? box.bottom : box.top) - stageBox.top}px`;
  };
  const hideTooltip = () => {
    tooltip.hidden = true;
  };

  // Objects that open a Den Life screen or view, with what their tooltip says.
  const opens: [ref: string, tip: string, open: () => void][] = [
    ['jacket', 'The jacket: sew on your patches', () => options.onOpenJacket()],
    ['calendar', '', () => options.onOpenCalendar()],
    ['corkboard', 'The Neighbourhood Kids and the Block Ladder', () => options.onOpenKids()],
    ['chalkboard', 'Versus Night: two players, best of 3 or 5', () => options.onOpenVersus()],
    ['pads', 'Versus Night: two players, best of 3 or 5', () => options.onOpenVersus()],
  ];
  for (const [ref, tip, open] of opens) {
    const target = hotspot(ref);
    // The calendar writes its own, changing tooltip below.
    if (tip) {
      target.addEventListener('pointerenter', () => showTooltip(tip, target));
      target.addEventListener('pointerleave', hideTooltip);
      target.addEventListener('focus', () => showTooltip(tip, target));
      target.addEventListener('blur', hideTooltip);
    }
    target.addEventListener('click', open);
    target.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  }

  // ——— The difficulty switches ———
  const switchSpots: Record<SwitchSide, SVGGElement> = {
    left: hotspot('switch-left'),
    right: hotspot('switch-right'),
  };
  const switchWords = (position: SwitchPosition) => (position === 'A' ? 'A, hard' : 'B, easy');
  const switchTip = (side: SwitchSide) => {
    const position = services.denLife.switches()[side];
    const gold =
      position === 'A' && side === 'left' ? '. Patches earned now are sewn in gold thread' : '';
    return `Seat ${SWITCH_SEAT[side]} difficulty switch: ${switchWords(position)}${gold}`;
  };
  const showSwitches = () => {
    for (const side of ['left', 'right'] as const) {
      const position = services.denLife.switches()[side];
      switchSpots[side].classList.toggle('is-a', position === 'A');
      switchSpots[side].setAttribute(
        'aria-label',
        `Seat ${SWITCH_SEAT[side]} difficulty switch: ${switchWords(position)}`,
      );
    }
  };
  const setSwitch = (side: SwitchSide, position: SwitchPosition) => {
    if (services.denLife.switches()[side] === position) return;
    void audio.unlock();
    audio.play('switch-snick', { pitch: position === 'A' ? 1.12 : 1 });
    services.denLife.setSwitch(side, position);
    if (!tooltip.hidden) showTooltip(switchTip(side), switchSpots[side]);
    announcer.textContent = switchTip(side);
  };
  const flipSwitch = (side: SwitchSide) =>
    setSwitch(side, services.denLife.switches()[side] === 'A' ? 'B' : 'A');
  for (const side of ['left', 'right'] as const) {
    const spot = switchSpots[side];
    let pressX: number | null = null;
    let dragged = false;
    spot.addEventListener('pointerdown', (event) => {
      pressX = event.clientX;
      dragged = false;
      spot.setPointerCapture(event.pointerId);
    });
    spot.addEventListener('pointermove', (event) => {
      if (pressX === null) return;
      const dx = event.clientX - pressX;
      if (Math.abs(dx) < SWITCH_DRAG_PX) return;
      dragged = true;
      // A sits to the left of the slot, B to the right.
      setSwitch(side, dx < 0 ? 'A' : 'B');
    });
    spot.addEventListener('pointerup', () => {
      if (pressX !== null && !dragged) flipSwitch(side);
      pressX = null;
    });
    spot.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        flipSwitch(side);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setSwitch(side, event.key === 'ArrowLeft' ? 'A' : 'B');
      }
    });
    spot.addEventListener('pointerenter', () => showTooltip(switchTip(side), spot));
    spot.addEventListener('pointerleave', hideTooltip);
    spot.addEventListener('focus', () => showTooltip(switchTip(side), spot));
    spot.addEventListener('blur', hideTooltip);
  }
  showSwitches();
  const stopSwitches = services.denLife.onChange(showSwitches);

  const tv = hotspot('tv');
  const openCurrent = () => {
    const { manifest, version } = placeAt(slot);
    options.onOpenGame(manifest.id, version?.id);
  };
  tv.addEventListener('click', openCurrent);
  tv.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCurrent();
    }
  });

  const calendarSpot = hotspot('calendar');
  calendarSpot.addEventListener('pointerenter', () =>
    showTooltip(life.calendarSummary(), calendarSpot),
  );
  calendarSpot.addEventListener('pointerleave', hideTooltip);
  calendarSpot.addEventListener('focus', () => showTooltip(life.calendarSummary(), calendarSpot));
  calendarSpot.addEventListener('blur', hideTooltip);

  // Hovering a Counter lamp names what it stands for and whether it is lit.
  const lampTip = (lampSlot: number) => {
    const place = placeAt(lampSlot);
    const what = place.version
      ? `${place.manifest.title}, ${place.version.label} version`
      : place.manifest.title;
    const lit = placeFinished(place, services.repos.progress.get());
    const state = lit
      ? isVersionPlace(place.slot)
        ? 'finished'
        : 'first patch earned'
      : isVersionPlace(place.slot)
        ? 'lights up when you finish a run with it'
        : 'lights up with your first patch';
    return `Lamp ${lampSlot} · ${what} · ${state}`;
  };
  const counterLamps = query(svg, '[data-ref="counter-lamps"]', SVGGElement);
  counterLamps.addEventListener('pointerover', (event) => {
    const cell = (event.target as Element).closest<SVGRectElement>('.lamp-hit');
    if (cell) showTooltip(lampTip(Number(cell.dataset.slot)), cell, true);
  });
  counterLamps.addEventListener('pointerleave', hideTooltip);

  // ——— The wall ———
  const cartridgeGrid = cartridges.map((cartridge) => ({
    element: cartridge,
    row: Number(cartridge.closest<SVGGElement>('.wall-row')?.dataset.row ?? 0),
    slot: Number(cartridge.dataset.slot),
  }));

  const neighbour = (from: SVGGElement, key: string): SVGGElement | null => {
    const here = cartridgeGrid.find((c) => c.element === from);
    if (!here) return null;
    const row = cartridgeGrid.filter((c) => c.row === here.row);
    const column = row.indexOf(here);
    if (key === 'ArrowRight') return row[column + 1]?.element ?? null;
    if (key === 'ArrowLeft') return row[column - 1]?.element ?? null;
    const targetRow = cartridgeGrid.filter(
      (c) => c.row === here.row + (key === 'ArrowDown' ? 1 : -1),
    );
    if (targetRow.length === 0) return null;
    return (targetRow[Math.min(column, targetRow.length - 1)] ?? targetRow[0])?.element ?? null;
  };

  for (const { element: cartridge, slot: cartridgeSlot } of cartridgeGrid) {
    cartridge.addEventListener('pointerenter', () => {
      if (hoverTimer !== null) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => tuneTo(cartridgeSlot), HOVER_TUNE_DELAY_MS);
    });
    cartridge.addEventListener('pointerleave', () => {
      if (hoverTimer !== null) clearTimeout(hoverTimer);
    });
    cartridge.addEventListener('focus', () => tuneTo(cartridgeSlot));
    cartridge.addEventListener('click', () => {
      tuneTo(cartridgeSlot);
      card.focusPrimary();
    });
    cartridge.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        tuneTo(cartridgeSlot);
        card.focusPrimary();
        return;
      }
      if (event.key.startsWith('Arrow')) {
        const next = neighbour(cartridge, event.key);
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
    });
  }

  // ——— Focus indicator: drawn above the night so it is always visible ———
  const placeFocus = (target: Element) => {
    if (!(target instanceof SVGGraphicsElement) || !target.matches(':focus-visible')) {
      focusIndicator.classList.remove('is-visible');
      return;
    }
    let box: { x: number; y: number; width: number; height: number };
    const cartridge = cartridgeGrid.find((c) => c.element === target);
    if (cartridge) {
      const row = cartridge.row;
      const column = cartridgeGrid.filter((c) => c.row === row).indexOf(cartridge);
      const slotBox = wallSlot(row, column);
      box = { ...slotBox, y: slotBox.y - 8 };
    } else {
      box = target.getBBox();
    }
    focusIndicator.setAttribute('d', focusRingPath(box));
    focusIndicator.classList.add('is-visible');
  };
  svg.addEventListener('focusin', (event) => {
    if (event.target instanceof Element) placeFocus(event.target);
  });
  svg.addEventListener('focusout', () => focusIndicator.classList.remove('is-visible'));

  // ——— Keys anywhere in the Den ———
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      if (event.repeat) return;
      startHold(event.shiftKey ? -1 : 1);
    } else if (SWITCH_KEY[event.key]) {
      flipSwitch(SWITCH_KEY[event.key] ?? 'left');
    } else if (event.key === 'l' || event.key === 'L') {
      options.onOpenList();
    } else if (event.key === '?') {
      options.onShowShortcuts();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'p' || event.key === 'P') endHold();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ——— The TV lights the room at night ———
  const sampleTint = () => {
    const sample = crt.sampleColor();
    if (!sample) return;
    tint = mixRgb(tint, sample, 0.45);
    element.style.setProperty('--tv-tint', roomTint(tint));
  };
  element.style.setProperty('--tv-tint', roomTint(tint));
  const tintTimer = setInterval(sampleTint, TINT_SAMPLE_MS);

  // ——— The wall clock keeps the room's real time ———
  const hourHand = query(svg, '[data-ref="clock-hour"]', SVGLineElement);
  const minuteHand = query(svg, '[data-ref="clock-minute"]', SVGLineElement);
  const clockCentre = {
    x: LAYOUT.clock.x + LAYOUT.clock.width / 2,
    y: LAYOUT.clock.y + LAYOUT.clock.height / 2,
  };
  const setClock = () => {
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    hourHand.setAttribute('transform', `rotate(${hours * 30} ${clockCentre.x} ${clockCentre.y})`);
    minuteHand.setAttribute(
      'transform',
      `rotate(${minutes * 6} ${clockCentre.x} ${clockCentre.y})`,
    );
  };
  setClock();
  const clockTimer = setInterval(setClock, 20_000);

  setSlot(slot, false);
  layout();
  // A first sample once the slate has drawn, so the night tint starts right.
  setTimeout(sampleTint, 120);

  // ——— The intro: a dark room, a hand on the switch, the set warming up ———
  const playIntro = (): Promise<void> =>
    new Promise((resolve) => {
      const timers: ReturnType<typeof setTimeout>[] = [];
      const at = (ms: number, step: () => void) => timers.push(setTimeout(step, ms));
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        for (const timer of timers) clearTimeout(timer);
        window.removeEventListener('keydown', skip, true);
        window.removeEventListener('pointerdown', skip, true);
        element.classList.remove('is-intro', 'is-intro-lit', 'is-intro-hand');
        startDemo(slot);
        void crt.powerOn({ snowMs: 160, roll: false });
        settings.update((draft) => {
          draft.introSeen = true;
        });
        resolve();
      };
      const skip = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        finish();
      };
      window.addEventListener('keydown', skip, true);
      window.addEventListener('pointerdown', skip, true);

      demo?.dispose();
      demo = null;
      // Any picture still loading belongs to the room before the intro: drop it.
      demoToken++;
      crt.setSource(createLogoSurface());
      element.classList.add('is-intro');
      void crt.powerOff();
      if (settings.reducedMotion()) {
        at(80, () => {
          element.classList.add('is-intro-lit');
          void crt.powerOn();
        });
        at(1400, finish);
        return;
      }
      at(350, () => element.classList.add('is-intro-hand'));
      at(1300, () => {
        throwLever(1);
        audio.play('power-clunk');
      });
      at(1550, () => {
        element.classList.remove('is-intro-hand');
        audio.play('static-hiss');
        void crt.powerOn({ snowMs: 1100, roll: true });
      });
      at(3000, () => element.classList.add('is-intro-lit'));
      at(4500, finish);
    });

  return {
    element,
    get slot() {
      return slot;
    },
    powerCycle: (direction) => powerCycle(direction),
    playIntro,
    tuneTo,
    stage,
    runFlip: (gameId, timing, onSnow) => runFlip(slotOf(gameId), timing, onSnow),
    setRunning(running) {
      element.classList.toggle('is-running', running);
    },
    placeAtCard(target) {
      cardSpots.add(target);
      placeAtCardSpot(target);
      return () => cardSpots.delete(target);
    },
    pause() {
      life.setActive(false);
      demo?.pause();
      crt.pause();
    },
    resume() {
      // The view is built before it is attached; laying out here, in the same
      // task as the attach, keeps the card and the screen from being painted at
      // the corner first and then jumping into place.
      layout();
      demo?.resume();
      crt.resume();
      life.setActive(true);
    },
    dispose() {
      endHold();
      clearInterval(tintTimer);
      clearInterval(clockTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      resizeObserver.disconnect();
      stopAppearance();
      stopMotion();
      stopSettings();
      stopSwitches();
      life.dispose();
      ambience.dispose();
      window.removeEventListener('pointerdown', unlockAndSync);
      window.removeEventListener('keydown', unlockAndSync);
      demo?.dispose();
      crt.dispose();
      card.dispose();
      element.remove();
    },
  };
}
