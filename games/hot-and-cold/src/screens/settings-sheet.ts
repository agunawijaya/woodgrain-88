/**
 * Settings sheet for Hot & Cold: look, clues visibility, possibility fog,
 * match length, numeral colours, seat colours, effects intensity, effects volume,
 * and a link to the Den's settings.
 */
import type { HotColdSettings, HotColdSettingsStore } from '../app/settings.ts';
import { createSheet } from './sheet.ts';
import { escapeText } from './style.ts';

export interface SettingsSheetOptions {
  readonly host: HTMLElement;
  readonly settings: HotColdSettingsStore;
  /**
   * Why the possibility fog cannot be turned on for this run (daily, challenge link); null when
   * it can.
   */
  readonly fogLocked: string | null;
  /** Opens the Den's own settings (appearance, Kid memory, controls). */
  readonly onAllSettings: () => void;
  readonly onClose: () => void;
}

const STYLE = /* css */ `
.hc-settings-list {
  display: grid;
  gap: 16px;
}
.hc-settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--hc-paper-edge);
}
.hc-settings-info {
  display: grid;
  gap: 4px;
  flex: 1;
}
.hc-settings-note {
  margin: 0;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--hc-ink-soft);
  line-height: 1.35;
}
.hc-volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.hc-volume-slider {
  cursor: pointer;
  accent-color: var(--hc-hot, #e0461a);
  width: clamp(100px, 16vw, 150px);
}
.hc-volume-value {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 14px;
  min-width: 3.2em;
  text-align: right;
  color: var(--hc-ink);
}
.hc-settings-footer {
  padding-top: 4px;
  display: flex;
  justify-content: flex-start;
}
`;

type ToggleField = Exclude<keyof HotColdSettings, 'effectsVolume'>;

interface ToggleRowDef {
  readonly field: ToggleField;
  readonly label: string;
  readonly help: string;
  readonly options: readonly { readonly label: string; readonly value: string }[];
}

const ROWS: readonly ToggleRowDef[] = [
  {
    field: 'look',
    label: 'Look',
    help: "Changes only the picture: the rules, timing and sounds' meanings stay the same.",
    options: [
      { label: 'Polar Expedition', value: 'polar' },
      { label: 'Tabletop Board', value: 'tabletop' },
      { label: 'Radar Room', value: 'radar' },
    ],
  },
  {
    field: 'clues',
    label: 'Clues',
    help: 'Notebook keeps every clue on the field. Classic Memory shows a clue only while reveal is held, as in 1978. The Kids play by the same rule.',
    options: [
      { label: 'Notebook', value: 'notebook' },
      { label: 'Classic Memory', value: 'classic' },
    ],
  },
  {
    field: 'fog',
    label: 'Possibility fog',
    help: 'Squares that can no longer hide the flag go dim. Runs with the fog on do not count for records.',
    options: [
      { label: 'Off', value: 'false' },
      { label: 'On', value: 'true' },
    ],
  },
  {
    field: 'matchLength',
    label: 'Match length',
    help: 'Cartridge plays to 15 or 75, as in 1978. Short plays races and turns to 5, hunts to 25 and the clock to 30.',
    options: [
      { label: 'Cartridge', value: 'cartridge' },
      { label: 'Short', value: 'short' },
    ],
  },
  {
    field: 'clueColours',
    label: 'Clue colours',
    help: 'The colours of the numbers, from cold to hot.',
    options: [
      { label: 'Standard', value: 'standard' },
      { label: 'Colour-blind safe', value: 'colour-blind' },
    ],
  },
  {
    field: 'seatColours',
    label: 'Seat colours',
    help: "The two explorers' colours.",
    options: [
      { label: 'Orange and blue', value: 'standard' },
      { label: 'Amber and periwinkle', value: 'colour-blind' },
    ],
  },
  {
    field: 'effects',
    label: 'Effects',
    help: 'Blasts, confetti and flares. Reduced motion always quietens them.',
    options: [
      { label: 'Full', value: 'full' },
      { label: 'Reduced', value: 'reduced' },
    ],
  },
];

/** Arrow keys move the choice inside a switch, as on any form. */
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
    if (!next || next.disabled) return;
    choose(next);
    next.focus();
  };
}

export function createSettingsSheet(options: SettingsSheetOptions): { dispose(): void } {
  const sheet = createSheet({
    host: options.host,
    title: 'Hot & Cold settings',
    onClose: options.onClose,
  });

  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.append(style);

  const container = document.createElement('div');
  container.className = 'hc-settings-list';

  const initial = options.settings.get();
  const fogLocked = options.fogLocked;

  /** A row's option as the settings hold it: the fog's on and off are true and false. */
  const isChosen = (settings: HotColdSettings, field: ToggleField, value: string): boolean =>
    String(settings[field]) === value;

  const rowMarkup = (row: ToggleRowDef): string => {
    const labelId = `hc-label-${row.field}`;
    const locked = row.field === 'fog' && fogLocked !== null;
    const buttons = row.options
      .map((option) => {
        const chosen = isChosen(initial, row.field, option.value);
        return (
          `<button type="button" role="radio" data-field="${row.field}" data-value="${option.value}" ` +
          `aria-checked="${String(chosen)}" tabindex="${chosen ? 0 : -1}"${locked ? ' disabled' : ''}>` +
          `${escapeText(option.label)}</button>`
        );
      })
      .join('');
    return (
      `<div class="hc-settings-row">` +
      `<div class="hc-settings-info">` +
      `<span class="hc-label" id="${labelId}">${escapeText(row.label)}</span>` +
      `<p class="hc-settings-note" data-note-for="${row.field}">${escapeText(locked ? fogLocked : row.help)}</p>` +
      `</div>` +
      `<div class="hc-toggle" role="radiogroup" aria-labelledby="${labelId}" data-field="${row.field}">` +
      buttons +
      `</div></div>`
    );
  };

  const percent = (volume: number) => Math.round(volume * 100);
  container.innerHTML =
    ROWS.map(rowMarkup).join('') +
    `<div class="hc-settings-row">` +
    `<div class="hc-settings-info">` +
    `<span class="hc-label" id="hc-label-effects-volume">Effects volume</span>` +
    `<p class="hc-settings-note">Steps, pings and fanfares.</p>` +
    `</div>` +
    `<div class="hc-volume-control">` +
    `<input type="range" class="hc-volume-slider" min="0" max="100" step="5" ` +
    `value="${percent(initial.effectsVolume)}" aria-labelledby="hc-label-effects-volume">` +
    `<span class="hc-volume-value">${percent(initial.effectsVolume)}%</span>` +
    `</div></div>` +
    `<div class="hc-settings-footer">` +
    `<button type="button" class="hc-link" data-all-settings>All settings…</button>` +
    `</div>`;
  sheet.body.append(container);

  const radios = [...container.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
  const volumeSlider = container.querySelector<HTMLInputElement>('.hc-volume-slider');
  const volumeValue = container.querySelector<HTMLElement>('.hc-volume-value');

  function render(settings: HotColdSettings): void {
    for (const button of radios) {
      const field = button.dataset.field as ToggleField;
      const chosen = isChosen(settings, field, button.dataset.value ?? '');
      button.setAttribute('aria-checked', String(chosen));
      button.tabIndex = chosen ? 0 : -1;
    }
    const volume = percent(settings.effectsVolume);
    if (volumeSlider && Number(volumeSlider.value) !== volume) volumeSlider.value = String(volume);
    if (volumeValue) volumeValue.textContent = `${volume}%`;
  }

  /** The store parses every value it is given, so a stray one simply changes nothing. */
  function choose(button: HTMLButtonElement): void {
    if (button.disabled) return;
    const field = button.dataset.field as ToggleField;
    const value = button.dataset.value ?? '';
    options.settings.update({
      [field]: field === 'fog' ? value === 'true' : value,
    });
  }

  container.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const radio = target?.closest<HTMLButtonElement>('button[role="radio"]');
    if (radio) choose(radio);
    else if (target?.closest('[data-all-settings]')) options.onAllSettings();
  });
  for (const group of container.querySelectorAll<HTMLElement>('.hc-toggle')) {
    const buttons = [...group.querySelectorAll<HTMLButtonElement>('button')];
    group.addEventListener('keydown', attachArrowKeys(buttons, choose));
  }
  volumeSlider?.addEventListener('input', () => {
    options.settings.update({ effectsVolume: Number(volumeSlider.value) / 100 });
  });

  const unsubscribe = options.settings.onChange(render);

  return {
    dispose() {
      unsubscribe();
      sheet.dispose();
    },
  };
}
