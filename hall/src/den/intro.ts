/**
 * Pieces of the first-visit intro: the shadow of a hand that reaches in to
 * flip the POWER lever, and the picture the set warms up to, the Woodgrain '88
 * logo on a warm test card.
 */
import { LAYOUT } from './geometry.ts';
import { SLATE_SIZE } from './slate.ts';

const HAND =
  'M-6 0C-6 -6 4 -6 4 0V40C10 34 22 34 22 42V50C28 46 38 48 38 56V62C44 60 52 64 52 72V112C52 150 30 176 2 176H-24C-50 176 -66 150 -70 126L-84 78C-88 64 -70 58 -62 70L-46 94V0Z';

/** A hand silhouette with a finger raised, hidden below the console until the intro moves it in. */
export function introHandMarkup(): string {
  const { powerLever } = LAYOUT;
  const tipX = powerLever.x + powerLever.width / 2;
  const tipY = powerLever.y + 8;
  return (
    `<g class="intro-hand" aria-hidden="true" transform="translate(${tipX} ${tipY})">` +
    `<g class="intro-hand-move">` +
    `<path d="${HAND}" fill="#050307" opacity="0.92"/>` +
    // A thin warm rim, as if the hallway light were behind the hand.
    `<path d="${HAND}" fill="none" stroke="#ffb066" stroke-opacity="0.45" stroke-width="2.5"/>` +
    `</g></g>`
  );
}

/** The warm test card with the logo that the snow resolves into. */
export function createLogoSurface(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SLATE_SIZE.width;
  canvas.height = SLATE_SIZE.height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const { width, height } = SLATE_SIZE;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#2a1630');
  sky.addColorStop(0.55, '#b8433a');
  sky.addColorStop(1, '#f6b04f');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  // Sunset stripes behind the name, a nod to the decade's stickers.
  const stripes = ['#ffd166', '#f28a4c', '#c4501a', '#7a3b4a'];
  stripes.forEach((colour, i) => {
    context.fillStyle = colour;
    context.fillRect(0, 196 + i * 14, width, 9);
  });
  context.fillStyle = 'rgba(0,0,0,0.25)';
  context.fillRect(0, 146, width, 100);
  context.textAlign = 'center';
  context.fillStyle = '#fff4dc';
  context.font = 'italic 700 58px Fraunces Variable, Fraunces, Georgia, serif';
  context.fillText('Woodgrain', width / 2, 196);
  context.fillStyle = '#ffd166';
  context.font = '800 46px Big Shoulders Display Variable, Arial Narrow, sans-serif';
  context.fillText("'88", width / 2, 240);
  context.fillStyle = 'rgba(255,244,220,0.85)';
  context.font = '600 15px Atkinson Hyperlegible Next Variable, system-ui, sans-serif';
  context.fillText('thirty games · one power switch', width / 2, 300);
  return canvas;
}
