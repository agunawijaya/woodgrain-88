/**
 * The How to play panel every game gets from its module's `howToPlay` card:
 * the goal in a sentence or two, the controls as a table (both seats where
 * they differ), and a few tips.
 */
import type { GameModule } from '@woodgrain-88/kit';
import { escapeXml } from '../den/svg.ts';
import { openDialog } from './dialog.ts';

export function showHowToPlay(module: Pick<GameModule, 'manifest' | 'howToPlay'>): void {
  const { manifest, howToPlay } = module;
  const dialog = openDialog({
    title: `How to play ${manifest.title}`,
    className: 'dialog--how',
    closeButton: true,
  });
  const rows = howToPlay.controls
    .map(
      (hint) =>
        `<tr><td>${hint.keys.map((key) => `<span class="kbd">${escapeXml(key)}</span>`).join(' ')}</td>` +
        `<td>${escapeXml(hint.does)}</td><td>${hint.seat ? `Seat ${hint.seat}` : 'Everyone'}</td></tr>`,
    )
    .join('');
  dialog.body.innerHTML =
    `<p class="dialog-text">${escapeXml(howToPlay.goal)}</p>` +
    `<table class="controls-table"><thead><tr><th scope="col">Keys</th><th scope="col">Does</th><th scope="col">For</th></tr></thead><tbody>${rows}</tbody></table>` +
    (howToPlay.tips?.length
      ? `<ul class="tips">${howToPlay.tips.map((tip) => `<li>${escapeXml(tip)}</li>`).join('')}</ul>`
      : '') +
    `<p class="dialog-note">Gamepads work too: the first pad drives seat 1, the second seat 2. Start pauses.</p>` +
    `<div class="dialog-actions"><button type="button" class="button button--primary" data-close>Got it</button></div>`;
  dialog.body.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
}
