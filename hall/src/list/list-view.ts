/**
 * The Label Wall as a list (#/list): the same thirty cartridge labels in an
 * accessible grid with filters by family and by players. It is the default
 * on narrow screens, where the Den's room would be too small to read.
 */
import { FAMILIES, type Family, type GameManifest } from '@woodgrain-88/kit';
import { counterDigits } from '../data/cycle.ts';
import { FAMILY_NAMES } from '../data/registry.ts';
import { labelDocument } from '../den/label.ts';
import { escapeXml } from '../den/svg.ts';

type PlayersFilter = 'all' | 'solo' | 'versus';

export interface ListView {
  readonly element: HTMLElement;
  dispose(): void;
}

export interface ListViewOptions {
  manifests: readonly GameManifest[];
  onOpenGame(id: string): void;
}

function playersLabel(manifest: GameManifest): string {
  return manifest.players === '1P'
    ? '1 player'
    : manifest.players === '2P'
      ? '2 players'
      : '1–2 players';
}

function matches(manifest: GameManifest, family: Family | 'all', players: PlayersFilter): boolean {
  if (family !== 'all' && manifest.family !== family) return false;
  if (players === 'solo' && manifest.players === '2P') return false;
  if (players === 'versus' && manifest.versus === 'none') return false;
  return true;
}

export function createListView(options: ListViewOptions): ListView {
  const element = document.createElement('section');
  element.className = 'list-view';
  element.setAttribute('aria-labelledby', 'list-title');
  let family: Family | 'all' = 'all';
  let players: PlayersFilter = 'all';

  const filterButton = (group: string, value: string, label: string, active: boolean) =>
    `<button type="button" class="filter-chip" data-group="${group}" data-value="${value}" aria-pressed="${active}">${label}</button>`;

  const render = () => {
    const shown = options.manifests.filter((manifest) => matches(manifest, family, players));
    element.innerHTML =
      `<div class="list-inner">` +
      `<header class="list-head">` +
      `<h1 id="list-title" class="list-title">The Label Wall</h1>` +
      `<p class="list-lede">Thirty games from one 1988 cartridge, each rebuilt from scratch. The first ones are on their way.</p>` +
      `<div class="list-filters">` +
      `<div class="filter-group" role="group" aria-label="Family">` +
      filterButton('family', 'all', 'All', family === 'all') +
      FAMILIES.map((f) => filterButton('family', f, FAMILY_NAMES[f], family === f)).join('') +
      `</div>` +
      `<div class="filter-group" role="group" aria-label="Players">` +
      filterButton('players', 'all', 'Any players', players === 'all') +
      filterButton('players', 'solo', 'Solo', players === 'solo') +
      filterButton('players', 'versus', 'Couch versus', players === 'versus') +
      `</div>` +
      `</div>` +
      `<p class="list-count" aria-live="polite">${shown.length} of ${options.manifests.length} games</p>` +
      `</header>` +
      `<ul class="list-grid">` +
      shown
        .map(
          (manifest) =>
            `<li><a class="list-card" href="#/game/${manifest.id}" data-game="${manifest.id}" style="--card-accent-day: ${manifest.accent.day}; --card-accent-night: ${manifest.accent.night}">` +
            `<span class="list-card-label">${labelDocument(manifest, `list-${manifest.id}`)}</span>` +
            `<span class="list-card-text">` +
            `<span class="list-card-kicker">${counterDigits(manifest.slot)} · ${FAMILY_NAMES[manifest.family]}</span>` +
            `<span class="list-card-title">${escapeXml(manifest.title)}</span>` +
            `<span class="list-card-tagline">${escapeXml(manifest.tagline)}</span>` +
            `<span class="list-card-meta">${playersLabel(manifest)}${manifest.versus !== 'none' ? ' · couch versus' : ''}${manifest.status === 'coming-soon' ? ' · <strong>soon</strong>' : ''}</span>` +
            `</span></a></li>`,
        )
        .join('') +
      `</ul>` +
      `</div>`;
  };

  element.addEventListener('click', (event) => {
    const chip = (event.target as Element).closest<HTMLButtonElement>('.filter-chip');
    if (chip) {
      if (chip.dataset.group === 'family') family = (chip.dataset.value ?? 'all') as Family | 'all';
      if (chip.dataset.group === 'players')
        players = (chip.dataset.value ?? 'all') as PlayersFilter;
      render();
      element
        .querySelector<HTMLButtonElement>(
          `.filter-chip[data-group="${chip.dataset.group}"][data-value="${chip.dataset.value}"]`,
        )
        ?.focus();
      return;
    }
    const card = (event.target as Element).closest<HTMLAnchorElement>('.list-card');
    if (card?.dataset.game) {
      event.preventDefault();
      options.onOpenGame(card.dataset.game);
    }
  });

  render();
  return {
    element,
    dispose() {
      element.remove();
    },
  };
}
