/**
 * Settings: appearance (Light / Dark / System), sound, motion, the CRT look,
 * Den Life (growth in the room, sharing, Versus Night length, Run sound),
 * controls for both seats (layout, rebinding, gamepads), the intro, and the
 * player's data (export, import with a preview first, forget everything).
 */
import {
  applyImport,
  DEFAULT_BINDINGS,
  downloadText,
  exportAll,
  exportFileName,
  previewImport,
  rebind,
  SEATS,
  SHARP_KIDS_NOTE,
  STANDARD_ACTIONS,
  validateBindings,
  type Bindings,
  type GameManifest,
  type Seat,
  type SettingsData,
} from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { escapeXml } from '../den/svg.ts';
import { confirmDialog, openDialog, toast } from './dialog.ts';
import {
  bindVersionPicker,
  chosenVersion,
  isVersionInput,
  versionPickerMarkup,
} from './version-picker.ts';

export interface SettingsPanelOptions {
  services: Services;
  /** Set when the panel is opened from inside a game: its own settings come first. */
  game?: GameManifest;
  onReplayIntro(): void;
}

const ACTION_LABELS: Record<string, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  fire: 'Fire',
  alt: 'Second button',
};

function keyName(code: string): string {
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Arrow/, '')
    .replace('Space', 'Space')
    .replace('NumpadEnter', 'Num Enter');
}

function radio(name: string, value: string, label: string, checked: boolean): string {
  return `<label class="choice"><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}/><span>${label}</span></label>`;
}

function toggle(name: string, label: string, checked: boolean, hint = ''): string {
  return (
    `<label class="toggle"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}/><span class="toggle-track" aria-hidden="true"></span>` +
    `<span class="toggle-text">${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`
  );
}

function slider(name: string, label: string, value: number): string {
  return `<label class="slider"><span>${label}</span><input type="range" name="${name}" min="0" max="100" step="5" value="${Math.round(value * 100)}"/></label>`;
}

function bindingsTable(bindings: Bindings): string {
  return SEATS.map(
    (seat) =>
      `<fieldset class="seat-bindings"><legend>Seat ${seat}</legend>` +
      STANDARD_ACTIONS.map(
        (action) =>
          `<div class="binding-row"><span>${ACTION_LABELS[action] ?? action}</span>` +
          `<button type="button" class="button button--quiet binding-key" data-seat="${seat}" data-action="${action}" aria-label="Seat ${seat} ${ACTION_LABELS[action] ?? action}: ${(bindings[seat].keys[action] ?? []).map(keyName).join(' or ')}. Press to change">` +
          `${(bindings[seat].keys[action] ?? []).map((code) => `<span class="kbd">${escapeXml(keyName(code))}</span>`).join(' ')}</button></div>`,
      ).join('') +
      `</fieldset>`,
  ).join('');
}

function padStatus(): string {
  const pads =
    typeof navigator !== 'undefined' && 'getGamepads' in navigator ? navigator.getGamepads() : [];
  const connected = [...pads].filter((pad): pad is Gamepad => pad?.connected === true);
  if (connected.length === 0) return 'No gamepad found. Press a button on one to wake it up.';
  return connected
    .map(
      (pad, i) =>
        `Gamepad ${i + 1} (${pad.id.split('(')[0]?.trim() ?? 'pad'}) drives seat ${i + 1}`,
    )
    .join(' · ');
}

export function openSettingsPanel(options: SettingsPanelOptions): void {
  const { services } = options;
  const { settings } = services;
  const dialog = openDialog({
    title: 'Settings',
    className: 'dialog--settings',
    closeButton: true,
  });
  let listening: { seat: Seat; action: string } | null = null;

  // Only merged games have settings of their own so far: the cartridge version.
  const gameSection = () => {
    const { game } = options;
    if (!game?.versions) return '';
    return (
      `<section><h3>${escapeXml(game.title)}</h3>` +
      versionPickerMarkup(game, chosenVersion(services, game)) +
      `<p class="settings-note">A new version applies from the next game you start. In the Den, each channel plays its own version.</p>` +
      `</section>`
    );
  };
  if (options.game) bindVersionPicker(dialog.body, services, options.game);

  const render = () => {
    const s: SettingsData = settings.get();
    const bindings = s.controls.bindings ?? DEFAULT_BINDINGS;
    dialog.body.innerHTML =
      `<form class="settings-form" novalidate>` +
      gameSection() +
      `<section><h3>Appearance</h3><div class="choices" role="radiogroup" aria-label="Appearance">` +
      radio('appearance', 'light', 'Day', s.appearance === 'light') +
      radio('appearance', 'dark', 'Night', s.appearance === 'dark') +
      radio('appearance', 'system', 'Follow my system', s.appearance === 'system') +
      `</div></section>` +
      `<section><h3>Sound</h3>` +
      toggle('muted', 'Mute everything', s.muted) +
      slider('master', 'Master', s.volume.master) +
      slider('sfx', 'Effects', s.volume.sfx) +
      slider('music', 'Music', s.volume.music) +
      slider('ambience', 'Room sound', s.volume.ambience) +
      toggle(
        'roomAmbience',
        'Room sound in the Den',
        s.roomAmbience,
        'A quiet clock, the street by day, crickets by night',
      ) +
      `</section>` +
      `<section><h3>Motion and the TV</h3><div class="choices" role="radiogroup" aria-label="Reduced motion">` +
      radio('reducedMotion', 'system', 'Motion: follow my system', s.reducedMotion === 'system') +
      radio('reducedMotion', 'on', 'Reduce motion', s.reducedMotion === 'on') +
      radio('reducedMotion', 'off', 'Full motion', s.reducedMotion === 'off') +
      `</div>` +
      toggle('screenShake', 'Screen shake', s.screenShake) +
      toggle(
        'crtEffects',
        'CRT look (curve, scanlines, glow)',
        s.crtEffects,
        'Always off when motion is reduced',
      ) +
      toggle(
        'colorBlindHints',
        'Colour-blind hints',
        s.colorBlindHints,
        'Shapes and patterns wherever colour carries meaning',
      ) +
      `</section>` +
      `<section><h3>Den Life</h3>` +
      toggle(
        'showGrowth',
        'Show what the room has grown',
        s.showGrowth,
        'Trophies, posters, lights and the rest. Hiding them forgets nothing',
      ) +
      toggle(
        'shareWithName',
        'Put my name on share lines',
        s.shareWithName,
        'Off: share lines carry no name at all',
      ) +
      `<p class="settings-note">The Neighbourhood Kids</p>` +
      `<div class="choices" role="radiogroup" aria-label="The Neighbourhood Kids">` +
      radio('kids', 'human', 'Human', s.kids === 'human') +
      radio('kids', 'sharp', 'Sharp (harder)', s.kids === 'sharp') +
      `</div>` +
      `<p class="settings-note">${escapeXml(SHARP_KIDS_NOTE)}</p>` +
      `<p class="settings-note">Versus Night series length</p>` +
      `<div class="choices" role="radiogroup" aria-label="Versus Night series length">` +
      radio('versusBestOf', '3', 'Best of 3', s.versusBestOf === 3) +
      radio('versusBestOf', '5', 'Best of 5', s.versusBestOf === 5) +
      `</div>` +
      `<p class="settings-note">Power Cycle Run sound</p>` +
      `<div class="choices" role="radiogroup" aria-label="Power Cycle Run sound">` +
      radio('runSound', 'quiet', 'Quiet', s.runSound === 'quiet') +
      radio('runSound', 'normal', 'Normal', s.runSound === 'normal') +
      radio('runSound', 'loud', 'Loud', s.runSound === 'loud') +
      `</div>` +
      `</section>` +
      `<section><h3>Controls</h3>` +
      `<p class="settings-note">Playing alone, every key below steers you. Two on one keyboard: player 1 keeps the arrows, player 2 takes WASD.</p>` +
      `<p class="settings-note" aria-live="polite">${escapeXml(padStatus())}</p>` +
      `<div class="seat-grid">${bindingsTable(bindings)}</div>` +
      `<p class="settings-note" data-ref="listen" aria-live="assertive">${listening ? `Press a key for seat ${listening.seat} ${ACTION_LABELS[listening.action] ?? listening.action}. Escape cancels.` : 'Escape always pauses; it cannot be bound.'}</p>` +
      `<button type="button" class="button button--quiet" data-do="reset-keys">Restore the default keys</button>` +
      `</section>` +
      `<section><h3>Your data</h3><p class="settings-note">Everything stays in this browser. Move it to another one with a save file.</p>` +
      `<div class="button-row">` +
      `<button type="button" class="button" data-do="export">Export save file</button>` +
      `<label class="button file-button">Import save file<input type="file" accept="application/json,.json" data-do="import" hidden/></label>` +
      `<button type="button" class="button" data-do="intro">Show the intro again</button>` +
      `<button type="button" class="button button--danger" data-do="forget">Forget my data</button>` +
      `</div>${services.repos.persistent ? '' : '<p class="settings-note">Your browser is not keeping data right now (private mode?), so progress lasts until you close this tab.</p>'}</section>` +
      `<div class="dialog-actions"><button type="button" class="button button--primary" data-do="close">Done</button></div>` +
      `</form>`;
  };

  const save = (change: (draft: SettingsData) => void) => settings.update(change);

  dialog.body.addEventListener('change', (event) => {
    if (isVersionInput(event.target)) return;
    const target = event.target as HTMLInputElement;
    const { name } = target;
    if (target.type === 'file') {
      void importFile(target);
      return;
    }
    save((draft) => {
      if (name === 'appearance') draft.appearance = target.value as SettingsData['appearance'];
      else if (name === 'reducedMotion')
        draft.reducedMotion = target.value as SettingsData['reducedMotion'];
      else if (name === 'versusBestOf') draft.versusBestOf = target.value === '5' ? 5 : 3;
      else if (name === 'runSound') draft.runSound = target.value as SettingsData['runSound'];
      else if (name === 'kids') draft.kids = target.value === 'sharp' ? 'sharp' : 'human';
      else if (
        name === 'muted' ||
        name === 'screenShake' ||
        name === 'crtEffects' ||
        name === 'colorBlindHints' ||
        name === 'roomAmbience' ||
        name === 'showGrowth' ||
        name === 'shareWithName'
      ) {
        draft[name] = target.checked;
      } else if (name === 'master' || name === 'sfx' || name === 'music' || name === 'ambience') {
        draft.volume[name] = Number(target.value) / 100;
      }
    });
  });

  const importFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    const preview = previewImport(await file.text());
    if (!preview.ok) {
      toast(preview.error);
      return;
    }
    const { summary } = preview;
    const ok = await confirmDialog({
      title: 'Import this save?',
      message:
        `Saved ${new Date(summary.exportedAt).toLocaleString()}` +
        `${summary.displayName ? ` by ${summary.displayName}` : ''}: ${summary.runs} runs across ${summary.gamesWithRecords} games, ` +
        `${summary.patchesEarned} patches, ${summary.sessions} sessions. It replaces what is in this browser now.`,
      confirm: 'Import',
      cancel: 'Cancel',
    });
    if (!ok) return;
    applyImport(services.repos, preview.bundle);
    toast('Save imported');
    render();
  };

  dialog.body.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.classList.contains('binding-key')) {
      listening = {
        seat: Number(button.dataset.seat) as Seat,
        action: button.dataset.action ?? 'fire',
      };
      render();
      dialog.body
        .querySelector<HTMLButtonElement>(
          `.binding-key[data-seat="${listening.seat}"][data-action="${listening.action}"]`,
        )
        ?.focus();
      return;
    }
    switch (button.dataset.do) {
      case 'close':
        dialog.close();
        break;
      case 'reset-keys':
        save((draft) => {
          draft.controls.bindings = null;
        });
        render();
        break;
      case 'export': {
        const bundle = exportAll(services.repos);
        downloadText(exportFileName(), JSON.stringify(bundle, null, 2), 'application/json');
        break;
      }
      case 'intro':
        dialog.close();
        options.onReplayIntro();
        break;
      case 'forget':
        void confirmDialog({
          title: 'Forget everything?',
          message:
            'Your name, records, stats, saves, patches and settings will be cleared from this browser. This cannot be undone.',
          confirm: 'Forget everything',
          cancel: 'Keep it',
        }).then((ok) => {
          if (!ok) return;
          services.repos.forgetAll();
          toast('All data forgotten');
          render();
        });
        break;
    }
  });

  // Rebinding: the next key pressed becomes the binding (Escape cancels).
  dialog.element.addEventListener(
    'keydown',
    (event) => {
      if (!listening) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.code !== 'Escape') {
        const current = settings.get().controls.bindings ?? DEFAULT_BINDINGS;
        const next = rebind(current, listening.seat, listening.action, event.code);
        // Keys must work for two players sharing the keyboard, so check them as split.
        const problems = validateBindings(next, 'split');
        if (problems.length > 0) toast(problems[0] ?? 'That key cannot be used');
        else save((draft) => (draft.controls.bindings = next));
      }
      const focusAgain = listening;
      listening = null;
      render();
      dialog.body
        .querySelector<HTMLButtonElement>(
          `.binding-key[data-seat="${focusAgain.seat}"][data-action="${focusAgain.action}"]`,
        )
        ?.focus();
    },
    true,
  );

  const onPad = () => render();
  window.addEventListener('gamepadconnected', onPad);
  window.addEventListener('gamepaddisconnected', onPad);
  const observer = new MutationObserver(() => {
    if (!dialog.open) {
      window.removeEventListener('gamepadconnected', onPad);
      window.removeEventListener('gamepaddisconnected', onPad);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
  render();
}
