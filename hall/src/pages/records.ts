/**
 * The Records page: every personal best, the couch versus tally, play
 * statistics across the collection, and the save file (export and import).
 * Only the player's own runs: there are no initials and no leaderboards.
 */
import type { Services } from '../app/services.ts';
import { counterDigits } from '../data/cycle.ts';
import { escapeXml } from '../den/svg.ts';

export interface RecordsPage {
  readonly element: HTMLElement;
  dispose(): void;
}

function minutes(ms: number): string {
  const total = Math.round(ms / 60000);
  return total < 60 ? `${total} min` : `${Math.floor(total / 60)} h ${total % 60} min`;
}

export function createRecordsPage(options: { services: Services; onOpenSettings(): void }): RecordsPage {
  const { services } = options;
  const element = document.createElement('article');
  element.className = 'page page--records';
  element.setAttribute('aria-labelledby', 'records-title');

  const render = () => {
    const totals = services.stats.totals();
    const manifests = services.registry.manifests;
    const rows = manifests.map((manifest) => {
      const best = services.records.bestOverall(manifest.id, manifest.scoreOrder);
      const stats = services.stats.game(manifest.id);
      return (
        `<tr><td>${counterDigits(manifest.slot)}</td><th scope="row">${escapeXml(manifest.title)}</th>` +
        `<td>${best ? best.score.toLocaleString('en-GB') : '—'}</td><td>${stats.plays}</td>` +
        `<td>${stats.timePlayedMs ? minutes(stats.timePlayedMs) : '—'}</td>` +
        `<td>${manifest.versus === 'none' ? '—' : `${stats.versusWins[1]} – ${stats.versusWins[2]}`}</td>` +
        `<td>${stats.lastPlayedAt ? new Date(stats.lastPlayedAt).toLocaleDateString() : '—'}</td></tr>`
      );
    }).join('');
    element.innerHTML =
      `<div class="page-inner">` +
      `<h1 id="records-title" class="page-title">Records</h1>` +
      `<p class="page-lede">Your bests and your history, kept in this browser.</p>` +
      `<dl class="records-totals">` +
      `<div><dt>Plays</dt><dd>${totals.plays}</dd></div>` +
      `<div><dt>Games played</dt><dd>${totals.gamesPlayed} / ${manifests.length}</dd></div>` +
      `<div><dt>Time in the Den</dt><dd>${minutes(totals.timePlayedMs)}</dd></div>` +
      `<div><dt>Couch versus matches</dt><dd>${totals.versusMatches}</dd></div>` +
      `</dl>` +
      `<div class="table-scroll"><table class="records-table"><caption>Every game</caption>` +
      `<thead><tr><th scope="col">Slot</th><th scope="col">Game</th><th scope="col">Best</th><th scope="col">Plays</th><th scope="col">Time</th><th scope="col">Versus (seat 1 – seat 2)</th><th scope="col">Last played</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></div>` +
      `<section><h2>Your save file</h2><p>Move your Den to another browser, or keep a backup.</p>` +
      `<button type="button" class="button" data-do="data">Export or import in Settings</button></section>` +
      `</div>`;
  };
  element.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-do="data"]')) options.onOpenSettings();
  });
  const stops = [services.repos.records.onChange(render), services.repos.stats.onChange(render)];
  render();
  return {
    element,
    dispose() {
      for (const stop of stops) stop();
      element.remove();
    },
  };
}
