/**
 * The Kids screen, opened from the corkboard: the six Neighbourhood Kids'
 * school photos pinned up large, each with an index card (how they play, a
 * short bio, your record against them across every game), and the Block
 * Ladder beside them, climbed one kid at a time from Pip up to Grandpa Lou.
 * A win with your switch on A gets its own little gold "A" on the ladder.
 */
import { BLOCK_LADDER, blockLadder, KIDS, type DenLifeData, type KidId } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { portraitImage } from '../den/corkboard.ts';
import { kidPortraitSvg } from '../den/kid-portrait.ts';
import { escapeXml } from '../den/svg.ts';

export interface KidsView {
  readonly element: HTMLElement;
  dispose(): void;
}

const TILTS = [-3, 2, -1.5, 2.5, -2, 1.5];
const TACKS = ['#d8432f', '#2f6fb8', '#e6b32a', '#3c9a5f', '#d8432f', '#8a4fb0'];

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** The ladder: two pine rails, a rung per kid from the bottom up, each with the kid's photo. */
function ladderSvg(kids: DenLifeData['kids']): string {
  const view = blockLadder(kids);
  const width = 300;
  const rungGap = 96;
  const bottom = 620;
  // Leaning a little, wider at the foot; the names stand to the right of it.
  const rails = `<path d="M44 30L34 650M150 30L160 650" stroke="url(#ladder-pine)" stroke-width="14" stroke-linecap="round"/>`;
  const rungs = BLOCK_LADDER.map((kid, index) => {
    const y = bottom - index * rungGap;
    const climbed = index < view.rung;
    const next = view.next === kid;
    const onA = view.beatenOnA.includes(kid);
    const name = KIDS.find((candidate) => candidate.id === kid)?.name ?? kid;
    const state = climbed ? 'beaten' : next ? 'next to beat' : 'waiting';
    return (
      `<g class="ladder-rung${climbed ? ' is-climbed' : ''}${next ? ' is-next' : ''}" aria-label="Rung ${index + 1}: ${escapeXml(name)}, ${state}${onA ? ', beaten on A' : ''}" role="listitem">` +
      `<rect x="36" y="${y - 7}" width="122" height="14" rx="5" fill="${climbed ? 'url(#ladder-gold)' : 'url(#ladder-pine)'}"/>` +
      `<rect x="36" y="${y - 7}" width="122" height="4" rx="2" fill="#fff" opacity="0.2"/>` +
      `<circle cx="97" cy="${y - 36}" r="28" fill="#fbf8f1" stroke="${climbed ? '#c8962e' : '#8a6a44'}" stroke-width="3"/>` +
      `<clipPath id="ladder-face-${kid}"><circle cx="97" cy="${y - 36}" r="24"/></clipPath>` +
      `<g clip-path="url(#ladder-face-${kid})">${portraitImage(kid, 70, y - 67, 54, 68)}</g>` +
      `<text x="184" y="${y - 38}" font-family="var(--font-hand)" font-size="22" fill="var(--ink)">${escapeXml(name)}</text>` +
      `<text x="184" y="${y - 18}" font-family="var(--font-ui)" font-weight="700" font-size="13" fill="var(--ink-soft)">${climbed ? 'Beaten' : next ? 'Next up' : ''}</text>` +
      (climbed ? `<path d="M126 ${y - 66}l3 6 6.6.9-4.8 4.6 1.2 6.6-6-3.2-5.9 3.2 1.1-6.6-4.8-4.6 6.6-.9Z" fill="#f2c14e" stroke="#b8862a" stroke-width="1"/>` : '') +
      (onA ? `<g transform="translate(250 ${y - 24})"><circle r="11" fill="url(#ladder-gold)" stroke="#8a5f12"/><text y="5" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="14" fill="#4a3208">A</text></g>` : '') +
      (next ? `<path class="ladder-next" d="M8 ${y - 36}h14m-6 -6l6 6-6 6" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
      `</g>`
    );
  }).join('');
  const crown = view.champion
    ? `<g class="ladder-champion"><path d="M85 52l-6 30 10-6 6 8 2-32ZM109 52l6 30-10-6-6 8-2-32Z" fill="#2f5fb8"/><circle cx="97" cy="34" r="26" fill="#2f5fb8"/><circle cx="97" cy="34" r="15" fill="#f2c14e" stroke="#b8862a" stroke-width="2"/><text x="97" y="39" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="14" fill="#6b4a12">1st</text><text x="184" y="40" font-family="var(--font-hand)" font-size="22" fill="var(--ink)">Block champion</text></g>`
    : '';
  return (
    `<svg class="ladder-svg" viewBox="0 0 ${width} 660" role="list" aria-label="The Block Ladder, from the bottom rung up">` +
    `<defs>` +
    `<linearGradient id="ladder-pine" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#a8703e"/></linearGradient>` +
    `<linearGradient id="ladder-gold" x1="0" x2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset="0.45" stop-color="#e2b84a"/><stop offset="1" stop-color="#a8761c"/></linearGradient>` +
    `</defs>` +
    rails +
    rungs +
    crown +
    `</svg>`
  );
}

export function createKidsView(options: { services: Services; onBack(): void }): KidsView {
  const { services } = options;
  const element = document.createElement('section');
  element.className = 'den-life-screen kids-screen';
  element.setAttribute('aria-labelledby', 'kids-title');

  const render = () => {
    const kids = services.repos.progress.get().den.kids;
    const view = blockLadder(kids);
    const cards = BLOCK_LADDER.map((id: KidId, index) => {
      const kid = KIDS.find((candidate) => candidate.id === id);
      if (!kid) return '';
      const record = kids[id];
      const wins = record?.wins ?? 0;
      const beaten = wins > 0;
      const recordLine = record
        ? `You won <strong>${wins}</strong>, lost ${record.losses}${record.draws ? `, drew ${record.draws}` : ''}${record.winsOnA ? ` · ${plural(record.winsOnA, 'win')} on A` : ''}`
        : 'Not played yet';
      return (
        `<article class="kid-card" style="--tilt: ${TILTS[index] ?? 0}deg; --tack: ${TACKS[index] ?? '#d8432f'}" aria-labelledby="kid-${id}-name">` +
        `<figure class="kid-polaroid">` +
        `<span class="kid-tack" aria-hidden="true"></span>` +
        `<span class="kid-photo">${kidPortraitSvg(kid, { expression: 'photo', idPrefix: `kids-${id}` })}</span>` +
        `<figcaption id="kid-${id}-name">${escapeXml(kid.name)}</figcaption>` +
        (beaten ? `<span class="kid-star" role="img" aria-label="Beaten at least once"></span>` : '') +
        `</figure>` +
        `<div class="kid-index-card">` +
        `<p class="kid-style">${escapeXml(kid.style)}</p>` +
        `<p class="kid-bio">${escapeXml(kid.bio)}</p>` +
        `<p class="kid-record">${recordLine}</p>` +
        `</div>` +
        `</article>`
      );
    }).join('');
    const ladderNote = view.champion
      ? 'Block champion. Every kid on the street has lost to you at least once.'
      : view.rung === 0
        ? 'Beat Pip once, in any game, to climb the first rung.'
        : `${view.rung} of 6 rungs climbed. Next up: ${KIDS.find((kid) => kid.id === view.next)?.name ?? ''}.`;
    element.innerHTML =
      `<header class="den-life-head">` +
      `<button type="button" class="button button--quiet" data-do="back">← Back to the Hall</button>` +
      `<div class="den-life-heading"><p class="den-life-kicker">The corkboard</p><h1 id="kids-title">The Neighbourhood Kids</h1></div>` +
      `<p class="den-life-note">Every bot seat in every game is one of these six. Each plays the same way whatever the game.</p>` +
      `</header>` +
      `<div class="kids-layout">` +
      `<div class="kids-cork">${cards}</div>` +
      `<aside class="ladder-panel" aria-labelledby="ladder-title">` +
      `<h2 id="ladder-title">The Block Ladder</h2>` +
      `<p class="ladder-note">${escapeXml(ladderNote)}</p>` +
      ladderSvg(kids) +
      `</aside>` +
      `</div>`;
  };

  element.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-do="back"]')) options.onBack();
  });
  render();
  // The photos go up on the cork as the screen opens.
  services.audio.play('tack-click');
  const stop = services.repos.progress.onChange(render);
  return {
    element,
    dispose() {
      stop();
      element.remove();
    },
  };
}
