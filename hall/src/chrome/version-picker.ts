/**
 * The "Cartridge version" choice for a merged game, on its details overlay
 * and in its settings. Picking a version saves it in the game's own settings
 * namespace, so every later run plays it unless a Den channel asks for the
 * other one.
 */
import { findVersion, resolveVersion, VERSION_SETTING, type GameManifest } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { escapeXml } from '../den/svg.ts';

const INPUT_NAME = 'cartridgeVersion';

/** The version the player last picked for this game, or its default. */
export function chosenVersion(services: Services, manifest: GameManifest): string | undefined {
  return resolveVersion(
    manifest,
    services.settings.game(manifest.id).get<string | undefined>(VERSION_SETTING, undefined),
  );
}

function noteFor(manifest: GameManifest, versionId: string): string {
  const version = findVersion(manifest, versionId);
  return version
    ? `${version.description} Program ${version.cartridgeSlot} on the 1988 cartridge.`
    : '';
}

/** Empty for a game without versions. */
export function versionPickerMarkup(
  manifest: GameManifest,
  selectedId: string | undefined,
): string {
  if (!manifest.versions || selectedId === undefined) return '';
  const options = manifest.versions
    .map(
      (version) =>
        `<label class="choice"><input type="radio" name="${INPUT_NAME}" value="${escapeXml(version.id)}"${version.id === selectedId ? ' checked' : ''}/><span>${escapeXml(version.label)}</span></label>`,
    )
    .join('');
  return (
    `<div class="version-picker">` +
    `<div class="choices" role="radiogroup" aria-label="Cartridge version">${options}</div>` +
    `<p class="settings-note version-note" data-ref="version-note" aria-live="polite">${escapeXml(noteFor(manifest, selectedId))}</p>` +
    `</div>`
  );
}

/**
 * Saves the pick and updates the note under the choices. `onPick` lets the
 * host follow along (the details overlay's Play button uses the new choice).
 */
export function bindVersionPicker(
  root: HTMLElement,
  services: Services,
  manifest: GameManifest,
  onPick?: (versionId: string) => void,
): void {
  root.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== INPUT_NAME) return;
    const version = findVersion(manifest, input.value);
    if (!version) return;
    services.settings.game(manifest.id).set(VERSION_SETTING, version.id);
    const note = root.querySelector<HTMLElement>('[data-ref="version-note"]');
    if (note) note.textContent = noteFor(manifest, version.id);
    onPick?.(version.id);
  });
}

/** True when a change event came from the picker, so other form handlers can skip it. */
export function isVersionInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.name === INPUT_NAME;
}
