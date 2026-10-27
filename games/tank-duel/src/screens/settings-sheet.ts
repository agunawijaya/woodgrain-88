/**
 * Settings sheet for Tank Duel: scoring rule, cartridge wiring, reverse gear and own ricochets switches,
 * practice aim line, explosion scale, team colour-blind palette,
 * engine and effects volume sliders, and a link to the Hall settings.
 */
import type { TankSettings, TankSettingsStore } from '../app/settings.ts';
import { createSheet } from './sheet.ts';
import { escapeText } from './style.ts';

export interface SettingsSheetOptions {
  readonly host: HTMLElement;
  readonly settings: TankSettingsStore;
  /** The Hall's own settings (appearance, camera shake, controls). */
  readonly onAllSettings: () => void;
  readonly onClose: () => void;
}

const STYLE = /* css */ `
.td-settings-list {
  display: grid;
  gap: 16px;
}
.td-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(54, 64, 28, 0.2);
}
.td-screens[data-appearance='dark'] .td-settings-row {
  border-bottom-color: rgba(242, 162, 44, 0.15);
}
.td-settings-info {
  display: grid;
  gap: 4px;
  flex: 1;
}
.td-settings-note {
  margin: 0;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--td-ink-soft);
  line-height: 1.35;
}
.td-switch {
  appearance: none;
  border: 0;
  cursor: pointer;
  width: 52px;
  height: 28px;
  border-radius: 999px;
  background: rgba(31, 23, 15, 0.25);
  position: relative;
  transition: background 120ms ease;
  padding: 2px;
  flex-shrink: 0;
}
.td-screens[data-appearance='dark'] .td-switch {
  background: rgba(255, 255, 255, 0.2);
}
.td-switch[aria-checked='true'] {
  background: var(--td-olive);
}
.td-screens[data-appearance='dark'] .td-switch[aria-checked='true'] {
  background: var(--td-mustard);
}
.td-switch::after {
  content: '';
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform 120ms cubic-bezier(0.2, 0.9, 0.3, 1);
}
.td-switch[aria-checked='true']::after {
  transform: translateX(24px);
}
.td-switch:focus-visible {
  outline: 3px solid var(--td-focus);
  outline-offset: 2px;
}
.td-volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.td-volume-slider {
  cursor: pointer;
  accent-color: var(--td-olive);
  width: clamp(100px, 16vw, 150px);
}
.td-screens[data-appearance='dark'] .td-volume-slider {
  accent-color: var(--td-mustard);
}
.td-volume-value {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 14px;
  min-width: 3.2em;
  text-align: right;
  color: var(--td-panel-ink);
}
.td-settings-footer {
  padding-top: 4px;
  display: flex;
  justify-content: flex-start;
}
`;

/** Sets up Arrow key navigation across buttons in a radiogroup. */
function attachArrowKeys(
  group: readonly HTMLButtonElement[],
  choose: (button: HTMLButtonElement) => void,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    const index = group.findIndex((button) => button === document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = group[(index + step + group.length) % group.length];
    if (!next) return;
    choose(next);
    next.focus();
  };
}

export function createSettingsSheet(options: SettingsSheetOptions): { dispose(): void } {
  const sheet = createSheet({
    host: options.host,
    title: 'Settings',
    onClose: options.onClose,
  });

  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.append(style);

  const container = document.createElement('div');
  container.className = 'td-settings-list';

  const initial = options.settings.get();

  const scoringLabelId = 'td-label-scoring';
  const wiringLabelId = 'td-label-wiring';
  const reverseLabelId = 'td-label-reverse';
  const ricochetLabelId = 'td-label-ricochets';
  const aimLineLabelId = 'td-label-aimline';
  const explosionsLabelId = 'td-label-explosions';
  const coloursLabelId = 'td-label-colours';
  const engineLabelId = 'td-label-engine-vol';
  const effectsLabelId = 'td-label-effects-vol';

  const enginePercent = Math.round(initial.engineVolume * 100);
  const effectsPercent = Math.round(initial.effectsVolume * 100);

  container.innerHTML =
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${scoringLabelId}">Scoring</span>` +
    `<p class="td-settings-note">Timed round (the original) or first to 10.</p>` +
    `</div>` +
    `<div class="td-toggle td-toggle-scoring" role="radiogroup" aria-labelledby="${scoringLabelId}">` +
    `<button type="button" role="radio" data-rule="timed" ` +
    `aria-checked="${String(initial.scoring === 'timed')}" ` +
    `tabindex="${initial.scoring === 'timed' ? 0 : -1}">Timed round · 2:44</button>` +
    `<button type="button" role="radio" data-rule="first-to-10" ` +
    `aria-checked="${String(initial.scoring === 'first-to-10')}" ` +
    `tabindex="${initial.scoring === 'first-to-10' ? 0 : -1}">First to 10</button>` +
    `</div>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${wiringLabelId}">Cartridge wiring</span>` +
    `<p class="td-settings-note">The 32-in-1 cartridge swapped the biplane's turn and throttle. ` +
    `Turn on to fly it that way.</p>` +
    `</div>` +
    `<button type="button" role="switch" class="td-switch" data-setting="wiring" ` +
    `aria-checked="${String(initial.wiring)}" aria-labelledby="${wiringLabelId}"></button>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${reverseLabelId}">Reverse gear</span>` +
    `<p class="td-settings-note">Not in 1977: pull back to back a tank away slowly. ` +
    `The Kids get it too.</p>` +
    `</div>` +
    `<button type="button" role="switch" class="td-switch" data-setting="reverseGear" ` +
    `aria-checked="${String(initial.reverseGear)}" aria-labelledby="${reverseLabelId}"></button>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${ricochetLabelId}">Own ricochets</span>` +
    `<p class="td-settings-note">Not in 1977: a shell that has bounced can hit you too, and ` +
    `your rival gets the point. Bouncing channels only.</p>` +
    `</div>` +
    `<button type="button" role="switch" class="td-switch" data-setting="ownRicochets" ` +
    `aria-checked="${String(initial.ownRicochets)}" aria-labelledby="${ricochetLabelId}"></button>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${aimLineLabelId}">Aim line in practice</span>` +
    `<p class="td-settings-note">A faint line shows where a shell would bank. Practice only.</p>` +
    `</div>` +
    `<button type="button" role="switch" class="td-switch" data-setting="aimLine" ` +
    `aria-checked="${String(initial.aimLine)}" aria-labelledby="${aimLineLabelId}"></button>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${explosionsLabelId}">Explosions</span>` +
    `<p class="td-settings-note">Explosion size and smoke.</p>` +
    `</div>` +
    `<div class="td-toggle td-toggle-explosions" role="radiogroup" ` +
    `aria-labelledby="${explosionsLabelId}">` +
    `<button type="button" role="radio" data-explosions="full" ` +
    `aria-checked="${String(initial.explosions === 'full')}" ` +
    `tabindex="${initial.explosions === 'full' ? 0 : -1}">Full</button>` +
    `<button type="button" role="radio" data-explosions="reduced" ` +
    `aria-checked="${String(initial.explosions === 'reduced')}" ` +
    `tabindex="${initial.explosions === 'reduced' ? 0 : -1}">Reduced</button>` +
    `</div>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${coloursLabelId}">Team colours</span>` +
    `<p class="td-settings-note">Table and player markings.</p>` +
    `</div>` +
    `<div class="td-toggle td-toggle-colours" role="radiogroup" aria-labelledby="${coloursLabelId}">` +
    `<button type="button" role="radio" data-team-colours="standard" ` +
    `aria-checked="${String(initial.teamColours === 'standard')}" ` +
    `tabindex="${initial.teamColours === 'standard' ? 0 : -1}">Orange and blue</button>` +
    `<button type="button" role="radio" data-team-colours="colour-blind" ` +
    `aria-checked="${String(initial.teamColours === 'colour-blind')}" ` +
    `tabindex="${initial.teamColours === 'colour-blind' ? 0 : -1}">Colour-blind safe</button>` +
    `</div>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${engineLabelId}">Engine sound</span>` +
    `<p class="td-settings-note">Hum of tank motors and aircraft propellers.</p>` +
    `</div>` +
    `<div class="td-volume-control">` +
    `<input type="range" class="td-volume-slider" data-setting="engineVolume" ` +
    `min="0" max="100" step="5" value="${enginePercent}" aria-labelledby="${engineLabelId}">` +
    `<span class="td-volume-value" data-value-for="engineVolume">${enginePercent}%</span>` +
    `</div>` +
    `</div>` +
    `<div class="td-settings-row">` +
    `<div class="td-settings-info">` +
    `<span class="td-label" id="${effectsLabelId}">Effects</span>` +
    `<p class="td-settings-note">Shots, wall ricochets and explosions.</p>` +
    `</div>` +
    `<div class="td-volume-control">` +
    `<input type="range" class="td-volume-slider" data-setting="effectsVolume" ` +
    `min="0" max="100" step="5" value="${effectsPercent}" aria-labelledby="${effectsLabelId}">` +
    `<span class="td-volume-value" data-value-for="effectsVolume">${effectsPercent}%</span>` +
    `</div>` +
    `</div>` +
    `<div class="td-settings-footer">` +
    `<button type="button" class="td-link">` +
    `${escapeText('Camera shake, appearance and controls')}</button>` +
    `</div>`;

  sheet.body.append(container);

  const scoringButtons = [
    ...container.querySelectorAll<HTMLButtonElement>('.td-toggle-scoring button'),
  ];
  const explosionsButtons = [
    ...container.querySelectorAll<HTMLButtonElement>('.td-toggle-explosions button'),
  ];
  const colourButtons = [
    ...container.querySelectorAll<HTMLButtonElement>('.td-toggle-colours button'),
  ];

  const wiringSwitch = container.querySelector<HTMLButtonElement>('[data-setting="wiring"]');
  const reverseSwitch = container.querySelector<HTMLButtonElement>('[data-setting="reverseGear"]');
  const ricochetSwitch = container.querySelector<HTMLButtonElement>(
    '[data-setting="ownRicochets"]',
  );
  const aimLineSwitch = container.querySelector<HTMLButtonElement>('[data-setting="aimLine"]');
  const engineSlider = container.querySelector<HTMLInputElement>(
    'input[data-setting="engineVolume"]',
  );
  const effectsSlider = container.querySelector<HTMLInputElement>(
    'input[data-setting="effectsVolume"]',
  );
  const engineDisplay = container.querySelector<HTMLElement>('[data-value-for="engineVolume"]');
  const effectsDisplay = container.querySelector<HTMLElement>('[data-value-for="effectsVolume"]');

  function render(settings: TankSettings): void {
    for (const button of scoringButtons) {
      const match = button.dataset.rule === settings.scoring;
      button.setAttribute('aria-checked', String(match));
      button.tabIndex = match ? 0 : -1;
    }
    for (const button of explosionsButtons) {
      const match = button.dataset.explosions === settings.explosions;
      button.setAttribute('aria-checked', String(match));
      button.tabIndex = match ? 0 : -1;
    }
    for (const button of colourButtons) {
      const match = button.dataset.teamColours === settings.teamColours;
      button.setAttribute('aria-checked', String(match));
      button.tabIndex = match ? 0 : -1;
    }
    if (wiringSwitch) {
      wiringSwitch.setAttribute('aria-checked', String(settings.wiring));
    }
    if (reverseSwitch) {
      reverseSwitch.setAttribute('aria-checked', String(settings.reverseGear));
    }
    if (ricochetSwitch) {
      ricochetSwitch.setAttribute('aria-checked', String(settings.ownRicochets));
    }
    if (aimLineSwitch) {
      aimLineSwitch.setAttribute('aria-checked', String(settings.aimLine));
    }
    const engPct = Math.round(settings.engineVolume * 100);
    if (engineSlider && Number(engineSlider.value) !== engPct) {
      engineSlider.value = String(engPct);
    }
    if (engineDisplay) {
      engineDisplay.textContent = `${engPct}%`;
    }
    const effPct = Math.round(settings.effectsVolume * 100);
    if (effectsSlider && Number(effectsSlider.value) !== effPct) {
      effectsSlider.value = String(effPct);
    }
    if (effectsDisplay) {
      effectsDisplay.textContent = `${effPct}%`;
    }
  }

  function chooseScoring(button: HTMLButtonElement): void {
    const rule = button.dataset.rule === 'first-to-10' ? 'first-to-10' : 'timed';
    options.settings.update({ scoring: rule });
  }

  function chooseExplosions(button: HTMLButtonElement): void {
    const choice = button.dataset.explosions === 'reduced' ? 'reduced' : 'full';
    options.settings.update({ explosions: choice });
  }

  function chooseColours(button: HTMLButtonElement): void {
    const choice = button.dataset.teamColours === 'colour-blind' ? 'colour-blind' : 'standard';
    options.settings.update({ teamColours: choice });
  }

  function handleClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const scoringBtn = target.closest<HTMLButtonElement>('.td-toggle-scoring button');
    if (scoringBtn) {
      chooseScoring(scoringBtn);
      return;
    }

    const expBtn = target.closest<HTMLButtonElement>('.td-toggle-explosions button');
    if (expBtn) {
      chooseExplosions(expBtn);
      return;
    }

    const colBtn = target.closest<HTMLButtonElement>('.td-toggle-colours button');
    if (colBtn) {
      chooseColours(colBtn);
      return;
    }

    const switchBtn = target.closest<HTMLButtonElement>('.td-switch');
    if (switchBtn) {
      const setting = switchBtn.dataset.setting;
      if (setting === 'wiring') {
        const next = !options.settings.get().wiring;
        options.settings.update({ wiring: next });
      } else if (setting === 'reverseGear') {
        options.settings.update({ reverseGear: !options.settings.get().reverseGear });
      } else if (setting === 'ownRicochets') {
        options.settings.update({ ownRicochets: !options.settings.get().ownRicochets });
      } else if (setting === 'aimLine') {
        const next = !options.settings.get().aimLine;
        options.settings.update({ aimLine: next });
      }
      return;
    }

    if (target.closest('.td-link')) {
      options.onAllSettings();
    }
  }

  function handleSliderInput(event: Event): void {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    if (!target) return;
    const value = Math.max(0, Math.min(100, Number(target.value)));
    if (target.dataset.setting === 'engineVolume') {
      options.settings.update({ engineVolume: value / 100 });
    } else if (target.dataset.setting === 'effectsVolume') {
      options.settings.update({ effectsVolume: value / 100 });
    }
  }

  const scoringToggle = container.querySelector<HTMLElement>('.td-toggle-scoring');
  const explosionsToggle = container.querySelector<HTMLElement>('.td-toggle-explosions');
  const coloursToggle = container.querySelector<HTMLElement>('.td-toggle-colours');

  const scoringKeys = scoringToggle ? attachArrowKeys(scoringButtons, chooseScoring) : null;
  const explosionsKeys = explosionsToggle
    ? attachArrowKeys(explosionsButtons, chooseExplosions)
    : null;
  const coloursKeys = coloursToggle ? attachArrowKeys(colourButtons, chooseColours) : null;

  if (scoringToggle && scoringKeys) {
    scoringToggle.addEventListener('keydown', scoringKeys);
  }
  if (explosionsToggle && explosionsKeys) {
    explosionsToggle.addEventListener('keydown', explosionsKeys);
  }
  if (coloursToggle && coloursKeys) {
    coloursToggle.addEventListener('keydown', coloursKeys);
  }

  container.addEventListener('click', handleClick);
  engineSlider?.addEventListener('input', handleSliderInput);
  engineSlider?.addEventListener('change', handleSliderInput);
  effectsSlider?.addEventListener('input', handleSliderInput);
  effectsSlider?.addEventListener('change', handleSliderInput);

  const unsubscribe = options.settings.onChange(render);

  return {
    dispose() {
      unsubscribe();
      if (scoringToggle && scoringKeys) {
        scoringToggle.removeEventListener('keydown', scoringKeys);
      }
      if (explosionsToggle && explosionsKeys) {
        explosionsToggle.removeEventListener('keydown', explosionsKeys);
      }
      if (coloursToggle && coloursKeys) {
        coloursToggle.removeEventListener('keydown', coloursKeys);
      }
      container.removeEventListener('click', handleClick);
      engineSlider?.removeEventListener('input', handleSliderInput);
      engineSlider?.removeEventListener('change', handleSliderInput);
      effectsSlider?.removeEventListener('input', handleSliderInput);
      effectsSlider?.removeEventListener('change', handleSliderInput);
      sheet.dispose();
    },
  };
}
