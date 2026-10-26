/**
 * The About page: the story of the 1988 cartridge and of this project, the
 * thirty games beside the originals that inspired them (with the two merged
 * pairs explained), how it was built, credits, and "Replay the intro".
 *
 * This is one of the two places (with CREDITS.md) where original titles and
 * publisher names may appear; `pnpm check` allows them here and nowhere else
 * in the Hall. Every fact on this page has a source recorded in CREDITS.md;
 * years stay "late 1970s / early 1980s" until a cited source confirms them.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import { counterDigits } from '../data/cycle.ts';
import { FAMILY_NAMES } from '../data/registry.ts';
import { escapeXml } from '../den/svg.ts';

export interface AboutPage {
  readonly element: HTMLElement;
  dispose(): void;
}

const SOURCE_URL = 'https://www.computinghistory.org.uk/det/37482/32%20In%201/';

function yearText(manifest: GameManifest): string {
  return manifest.inspiredBy.year === null ? 'late 1970s / early 1980s' : String(manifest.inspiredBy.year);
}

function slotsText(manifest: GameManifest): string {
  const slots = manifest.inspiredBy.cartridgeSlots;
  return slots.length > 1 ? `slots ${slots.join(' and ')}` : `slot ${slots[0] ?? '?'}`;
}

export function createAboutPage(options: {
  manifests: readonly GameManifest[];
  onReplayIntro(): void;
}): AboutPage {
  const element = document.createElement('article');
  element.className = 'page page--about';
  element.setAttribute('aria-labelledby', 'about-title');
  const rows = options.manifests.map(
    (m) =>
      `<tr><td>${counterDigits(m.slot)}</td><th scope="row">${escapeXml(m.title)}</th><td>${FAMILY_NAMES[m.family]}</td>` +
      `<td>${escapeXml(m.inspiredBy.originalTitle)}</td><td>${escapeXml(m.inspiredBy.publisher)}, ${yearText(m)}</td><td>${slotsText(m)}</td></tr>`,
  ).join('');
  element.innerHTML =
    `<div class="page-inner">` +
    `<h1 id="about-title" class="page-title">About Woodgrain '88</h1>` +
    `<p class="page-lede">Thirty small games from one 1988 cartridge, each rebuilt from scratch for people who play today, and for the ones who played then.</p>` +
    `<section><h2>The cartridge</h2>` +
    `<p>In 1988 Atari released a cartridge called "32 in 1". It was not sold in the United States but in Europe and other countries, and in the UK it came bundled with some consoles; boxed copies with their manual are rare today. <a href="${SOURCE_URL}" rel="noreferrer">(Centre for Computing History)</a></p>` +
    `<p>It had no menu. Each of its 32 games is a complete little program, and a circuit in the cartridge picked which one the console saw when it was switched on, so every power-on brought up a different game. Pressing RESET only restarted the game you were already playing; to reach another, you switched the console off and on again. That is why The Den has a power switch.</p>` +
    `<p>The copy we studied is the PAL version, catalogue number CX26163P: a 64 KB image holding 32 programs of 2 KB each.</p>` +
    `</section>` +
    `<section><h2>30 games, not 32</h2>` +
    `<p>Comparing the 32 programs byte by byte turned up two near-twins. The road-crossing game appears twice, the second copy differing in 59 of its 2,048 bytes: solid lane lines, new colours and a different hero, but the same game. The fishing game also appears twice, differing in 45 bytes: new colours and anglers, and one change that is easy to miss, the left and right difficulty switches are swapped. So the cartridge holds 30 distinct games. Here each pair is one game with both cartridge versions in it: pick the one you want in the game's settings or on its details, or tune the Den to channel 31 or 32. Finishing a run with each version lights its own lamp on the Counter, so all 32 can still glow.</p>` +
    `</section>` +
    `<section><h2>The thirty games</h2>` +
    `<div class="table-scroll"><table class="about-table"><caption>Our games and the originals that inspired them</caption>` +
    `<thead><tr><th scope="col">Slot</th><th scope="col">Our game</th><th scope="col">Family</th><th scope="col">Inspired by</th><th scope="col">Publisher, year</th><th scope="col">On the cartridge</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>` +
    `<p class="page-note">Years are shown once a cited source confirms them. Original titles belong to their owners and appear here only to credit them.</p>` +
    `</section>` +
    `<section><h2>How we built it</h2>` +
    `<p>Nothing here is emulated or copied. We read how each original program behaves (its rules, its timings, its quirks), wrote those findings down in our own words, and then built every game again in new code, with new art, new sound and new levels. All of it is drawn and synthesised in your browser; there are no images, no audio files and no network calls.</p>` +
    `<p>Woodgrain '88 is free and open source. The code is MIT licensed; our art, music and words are CC BY 4.0.</p>` +
    `</section>` +
    `<section><h2>Credits</h2>` +
    `<p>With thanks to Atari, Activision, US Games and CommaVid, whose games we grew up with, and to the Centre for Computing History for keeping the cartridge's story. Type: Fraunces, Atkinson Hyperlegible Next, Big Shoulders Display and Patrick Hand, all under the SIL Open Font License.</p>` +
    `<button type="button" class="button" data-do="intro">Replay the intro</button>` +
    `</section>` +
    `</div>`;
  element.querySelector('[data-do="intro"]')?.addEventListener('click', () => options.onReplayIntro());
  return {
    element,
    dispose() {
      element.remove();
    },
  };
}
