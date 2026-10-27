/**
 * The profile panel behind the jacket and the top bar's name chip: your
 * display name and the colour of your avatar. Patches and the jacket itself
 * arrive in prompt 01.
 */
import type { Services } from '../app/services.ts';
import { escapeXml } from '../den/svg.ts';
import { openDialog, toast } from './dialog.ts';

export function openProfilePanel(services: Services): void {
  const dialog = openDialog({
    title: 'Your jacket',
    className: 'dialog--profile',
    closeButton: true,
  });
  const profile = services.profile.get();
  dialog.body.innerHTML =
    `<form class="profile-form" novalidate>` +
    `<label class="field"><span>Display name</span><input name="name" type="text" maxlength="20" autocomplete="nickname" value="${escapeXml(profile.displayName)}" aria-describedby="name-help"/></label>` +
    `<p id="name-help" class="settings-note" aria-live="polite">1 to 20 characters. Only you see it, on your cards and share cards.</p>` +
    `<label class="slider"><span>Avatar colour</span><input name="hue" type="range" min="0" max="359" value="${profile.avatar.hue}"/></label>` +
    `<p class="settings-note">Patches are sewn on in the next update.</p>` +
    `<div class="dialog-actions"><button type="submit" class="button button--primary">Save</button></div>` +
    `</form>`;
  const form = dialog.body.querySelector<HTMLFormElement>('form');
  const help = dialog.body.querySelector<HTMLParagraphElement>('#name-help');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const rawName = data.get('name');
    const check = services.profile.rename(typeof rawName === 'string' ? rawName : '');
    if (!check.ok) {
      if (help) help.textContent = check.reason;
      return;
    }
    services.profile.setAvatar({
      ...services.profile.get().avatar,
      hue: Number(data.get('hue') ?? 28),
    });
    toast(`Hello, ${check.value}`);
    dialog.close();
  });
}

export function openShortcuts(): void {
  const dialog = openDialog({
    title: 'Keyboard shortcuts',
    className: 'dialog--shortcuts',
    closeButton: true,
  });
  const rows: [string, string][] = [
    ['P', 'Flip the power switch: next game'],
    ['Shift + P', 'Flip it backwards'],
    ['Hold P', 'Keep flipping, the 1988 way'],
    ['Tab', 'Move between the TV, the console, the wall, the calendar, the jacket and the pads'],
    ['Arrow keys', 'Move along the Label Wall'],
    ['Enter', 'Open the card for the focused game'],
    ['L', 'The Label Wall as a list'],
    ['Esc', 'In a game: pause and menu. On a game menu: back to the Hall'],
    ['?', 'This list'],
  ];
  dialog.body.innerHTML =
    `<dl class="shortcuts">${rows.map(([key, does]) => `<div><dt><span class="kbd">${escapeXml(key)}</span></dt><dd>${escapeXml(does)}</dd></div>`).join('')}</dl>` +
    `<div class="dialog-actions"><button type="button" class="button button--primary" data-close>Close</button></div>`;
  dialog.body.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
}
