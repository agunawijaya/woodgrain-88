/**
 * Gravity Duel's own settings sheet: look, controls, match length, the
 * trajectory guide (with its reason when forced off), ship colours,
 * reduced effects and camera. The rest of the Den's settings live behind
 * "All settings".
 */
import type { GravitySettingsStore } from '../app/settings.ts';
import { LOOK_IDS, lookById } from '../look/looks.ts';
import type { ControlScheme } from '../session/controls.ts';
import { createSheet, type Sheet } from './sheet.ts';

export interface SettingsSheetOptions {
  readonly host: HTMLElement;
  readonly settings: GravitySettingsStore;
  /** True when the guide must stay off: Daily, challenge links and micro-challenges. */
  readonly guideForced: boolean;
  /** True only for a lone player: Follow needs one ship to follow. */
  readonly followAvailable: boolean;
  readonly onAllSettings: () => void;
  readonly onClose: () => void;
}

export interface SettingsSheet {
  dispose(): void;
}

const GUIDE_FORCED_REASON = 'Daily, challenge and record runs are flown without the guide.';

const STYLE = /* css */ `
.gd-settings-row { display: grid; gap: 6px; }
.gd-settings-note { color: var(--gd-muted); font-size: 0.85em; }
`;

function radioRow<T extends string | number>(
  label: string,
  options: readonly { readonly value: T; readonly text: string }[],
  current: T,
  onPick: (value: T) => void,
  disabled = false,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'gd-settings-row';
  const heading = document.createElement('span');
  heading.className = 'gd-label';
  heading.textContent = label;
  const toggle = document.createElement('div');
  toggle.className = 'gd-toggle';
  toggle.setAttribute('role', 'radiogroup');
  toggle.setAttribute('aria-label', label);
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(option.value === current));
    button.disabled = disabled;
    button.textContent = option.text;
    button.addEventListener('click', () => onPick(option.value));
    toggle.append(button);
  }
  row.append(heading, toggle);
  return row;
}

export function createSettingsSheet(options: SettingsSheetOptions): SettingsSheet {
  const sheet: Sheet = createSheet({
    host: options.host,
    title: 'Gravity Duel settings',
    onClose: options.onClose,
  });
  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.append(style);

  const current = options.settings.get();

  sheet.body.append(
    radioRow(
      'Look',
      LOOK_IDS.map((id) => ({ value: id, text: lookById(id).name })),
      current.look,
      (value) => options.settings.update({ look: value }),
    ),
  );

  sheet.body.append(
    radioRow<ControlScheme>(
      'Controls',
      [
        { value: 'classic', text: 'Classic' },
        { value: 'modern', text: 'Modern' },
      ],
      current.scheme,
      (value) => options.settings.update({ scheme: value }),
    ),
  );

  sheet.body.append(
    radioRow(
      'Match length',
      [
        { value: 10 as const, text: 'Cartridge (10 or 12 min)' },
        { value: 5 as const, text: 'Short (5 or 4 min)' },
      ],
      current.matchLength,
      (value) => options.settings.update({ matchLength: value }),
    ),
  );

  const guideRow = radioRow(
    'Trajectory guide',
    [
      { value: 'on' as const, text: 'On' },
      { value: 'off' as const, text: 'Off' },
    ],
    options.guideForced ? 'off' : current.guide ? 'on' : 'off',
    (value) => options.settings.update({ guide: value === 'on' }),
    options.guideForced,
  );
  sheet.body.append(guideRow);
  if (options.guideForced) {
    const note = document.createElement('p');
    note.className = 'gd-settings-note';
    note.textContent = GUIDE_FORCED_REASON;
    sheet.body.append(note);
  }

  sheet.body.append(
    radioRow(
      'Ship colours',
      [
        { value: 'standard' as const, text: 'Standard' },
        { value: 'colour-blind' as const, text: 'Colour-blind safe' },
      ],
      current.colourBlind ? 'colour-blind' : 'standard',
      (value) => options.settings.update({ colourBlind: value === 'colour-blind' }),
    ),
  );

  sheet.body.append(
    radioRow(
      'Reduced effects',
      [
        { value: 'on' as const, text: 'On' },
        { value: 'off' as const, text: 'Off' },
      ],
      current.reducedEffects ? 'on' : 'off',
      (value) => options.settings.update({ reducedEffects: value === 'on' }),
    ),
  );

  sheet.body.append(
    radioRow(
      'Camera',
      [
        { value: 'overhead' as const, text: 'Overhead' },
        { value: 'follow' as const, text: 'Follow' },
      ],
      current.camera,
      (value) => options.settings.update({ camera: value }),
      !options.followAvailable,
    ),
  );
  if (!options.followAvailable) {
    const note = document.createElement('p');
    note.className = 'gd-settings-note';
    note.textContent = 'Follow is offered only to a lone player.';
    sheet.body.append(note);
  }

  const allSettings = document.createElement('button');
  allSettings.type = 'button';
  allSettings.className = 'gd-link';
  allSettings.textContent = 'All settings';
  allSettings.addEventListener('click', options.onAllSettings);
  sheet.body.append(allSettings);

  return { dispose: () => sheet.dispose() };
}
