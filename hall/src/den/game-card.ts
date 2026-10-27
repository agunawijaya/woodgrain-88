/**
 * The card beside the TV for whatever is on: the game's emblem and title, its
 * tagline, who it is for (with a "Couch versus" badge where two people can
 * play), your best and your patches, and the two ways in, Play and Details.
 * For a merged game it names the cartridge version the channel plays, and
 * both ways in open that version.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { counterDigits, type CounterPlace } from '../data/cycle.ts';
import { FAMILY_NAMES } from '../data/registry.ts';
import { escapeXml } from './svg.ts';

export interface GameCard {
  readonly element: HTMLElement;
  show(place: CounterPlace): void;
  focusPrimary(): void;
  dispose(): void;
}

export interface GameCardOptions {
  services: Services;
  onPlay(id: string, version?: string): void;
  onDetails(id: string, version?: string): void;
}

function playersText(manifest: GameManifest): string {
  if (manifest.players === '1P') return '1 player';
  if (manifest.players === '2P') return '2 players';
  return '1 or 2 players';
}

function emblemBadge(manifest: GameManifest): string {
  const { label } = manifest;
  return (
    `<svg class="game-card-emblem" viewBox="0 0 48 48" aria-hidden="true">` +
    `<circle cx="24" cy="24" r="22" fill="${label.band}" stroke="${label.bandText}" stroke-width="2.5"/>` +
    `<g transform="translate(9 9) scale(1.25)"><path d="${escapeXml(manifest.emblem)}" fill="none" stroke="${label.bandText}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></g>` +
    `</svg>`
  );
}

export function createGameCard(options: GameCardOptions): GameCard {
  const element = document.createElement('article');
  element.className = 'game-card';
  element.setAttribute('aria-live', 'polite');
  let current: CounterPlace | null = null;

  element.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button || !current || button.getAttribute('aria-disabled') === 'true') return;
    const { manifest, version } = current;
    if (button.dataset.action === 'play') options.onPlay(manifest.id, version?.id);
    if (button.dataset.action === 'details') options.onDetails(manifest.id, version?.id);
  });

  const renderGame = ({ slot, manifest, version }: CounterPlace) => {
    const { services } = options;
    const best = services.records.bestOverall(manifest.id, manifest.scoreOrder);
    // Den Life knows every game's patches, including those of games not loaded yet.
    const patches = services.denLife.patchesFor(manifest.id);
    const progress = services.repos.progress.get().games[manifest.id]?.patches ?? {};
    const earned = patches.filter((patch) => progress[patch.id]?.earnedAt).length;
    const couch = manifest.versus !== 'none';
    const soon = manifest.status === 'coming-soon';
    element.style.setProperty('--card-accent-day', manifest.accent.day);
    element.style.setProperty('--card-accent-night', manifest.accent.night);
    element.innerHTML =
      `<div class="game-card-head">${emblemBadge(manifest)}<div>` +
      `<p class="game-card-kicker">CH ${counterDigits(slot)} · ${FAMILY_NAMES[manifest.family]}${version ? ` · ${escapeXml(version.label)} version` : ''}</p>` +
      `<h2 class="game-card-title">${escapeXml(manifest.title)}</h2></div></div>` +
      `<p class="game-card-tagline">${escapeXml(manifest.tagline)}</p>` +
      `<ul class="game-card-facts">` +
      `<li>${playersText(manifest)}</li>` +
      (couch ? `<li class="game-card-badge">Couch versus</li>` : '') +
      `<li>${manifest.sessionMinutes[0]}–${manifest.sessionMinutes[1]} min</li>` +
      `</ul>` +
      `<dl class="game-card-stats">` +
      `<div><dt>Your best</dt><dd>${best ? best.score.toLocaleString('en-GB') : '—'}</dd></div>` +
      `<div><dt>Patches</dt><dd>${earned} / ${patches.length}</dd></div>` +
      `</dl>` +
      `<div class="game-card-actions">` +
      (soon
        ? `<button type="button" class="button button--primary" data-action="play" aria-disabled="true">Coming soon</button>`
        : `<button type="button" class="button button--primary" data-action="play">Play</button>`) +
      `<button type="button" class="button" data-action="details">Details</button>` +
      `</div>`;
  };

  return {
    element,
    show(place) {
      current = place;
      element.classList.remove('is-arriving');
      void element.getBoundingClientRect();
      element.classList.add('is-arriving');
      renderGame(place);
    },
    focusPrimary() {
      const target =
        element.querySelector<HTMLButtonElement>(
          'button[data-action="play"]:not([aria-disabled="true"])',
        ) ?? element.querySelector<HTMLButtonElement>('button[data-action="details"]');
      target?.focus();
    },
    dispose() {
      element.remove();
    },
  };
}
