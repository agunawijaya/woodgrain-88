/**
 * The corkboard on the Den wall: the six Neighbourhood Kids pinned up as
 * Polaroids with thumbtacks. A kid you have beaten gets a gold star sticker
 * in the corner of their photo, and the Block champion's rosette is pinned
 * to the frame. Clicking it opens the Kids view.
 *
 * The photos are each kid's school portrait drawn once into an image, so the
 * board costs nothing to repaint while the room animates around it.
 */
import { BLOCK_LADDER, createRng, kidById, type KidId } from '@woodgrain-88/kit';
import { LAYOUT } from './geometry.ts';
import { kidPortraitSvg } from './kid-portrait.ts';
import { n } from './svg.ts';

const TACK_COLOURS = ['#d8432f', '#2f6fb8', '#e6b32a', '#3c9a5f', '#d8432f', '#8a4fb0'];

function corkTexture(x: number, y: number, width: number, height: number): string {
  const rng = createRng('cork');
  let speckles = '';
  for (let i = 0; i < 170; i++) {
    const tone = rng.chance(0.55) ? '#8a5a2e' : '#e2b77a';
    speckles += `<circle cx="${n(x + rng.float(0, width))}" cy="${n(y + rng.float(0, height))}" r="${n(rng.float(0.4, 1.3))}" fill="${tone}" opacity="${n(rng.float(0.35, 0.8))}"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#c08a52"/>${speckles}`;
}

/** A portrait as an image, so the scene repaints a picture instead of re-running its filters. */
export function portraitImage(kid: KidId, x: number, y: number, width: number, height: number, expression: 'photo' | 'win' | 'lose' = 'photo'): string {
  const svg = kidPortraitSvg(kidById(kid), { expression, idPrefix: `pin-${kid}-${expression}` });
  return `<image href="data:image/svg+xml,${encodeURIComponent(svg)}" x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="xMidYMid slice"/>`;
}

function polaroid(kid: KidId, cx: number, cy: number, tilt: number, tack: string, beaten: boolean): string {
  const w = 34;
  const h = 41;
  const photo = 28;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const name = kidById(kid).name.replace('Grandpa ', 'Gramps ');
  return (
    `<g class="polaroid" data-kid="${kid}" transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})">` +
    // A soft shadow that is deeper at the bottom, where the print curls away from the cork.
    `<path d="M${n(left + 1)} ${n(top + 2)}h${w}v${h - 1}q-${w / 2} 3 -${w} 1Z" fill="#000" opacity="0.32"/>` +
    `<rect x="${n(left)}" y="${n(top)}" width="${w}" height="${h}" fill="#fbf8f1"/>` +
    `<rect x="${n(left)}" y="${n(top)}" width="${w}" height="${h}" fill="url(#den-polaroid-sheen)"/>` +
    `<rect x="${n(left + 3)}" y="${n(top + 3)}" width="${photo}" height="${photo}" fill="#1d1a22"/>` +
    portraitImage(kid, left + 3, top + 3, photo, photo) +
    `<text x="${n(cx)}" y="${n(top + h - 3.2)}" text-anchor="middle" font-family="var(--font-hand)" font-size="6.6" fill="#2b2a6e">${name}</text>` +
    (beaten
      ? `<path d="M${n(left + w - 6)} ${n(top + 5)}l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.7 1.4.5-3-2.1-2.1 3-.4Z" fill="#f2c14e" stroke="#b8862a" stroke-width="0.5"/>`
      : '') +
    `</g>` +
    // The tack stays upright: it was pushed in after the photo tilted.
    `<circle cx="${n(cx)}" cy="${n(top + 1.5)}" r="2.6" fill="#000" opacity="0.3" transform="translate(0.8 1.1)"/>` +
    `<circle cx="${n(cx)}" cy="${n(top + 1.5)}" r="2.6" fill="${tack}"/>` +
    `<circle cx="${n(cx - 0.8)}" cy="${n(top + 0.7)}" r="0.9" fill="#fff" opacity="0.6"/>`
  );
}

function rosette(x: number, y: number): string {
  // A champion's rosette: pleated blue ring, gold centre, two tails.
  let pleats = '';
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16;
    pleats += `<path d="M${n(x)} ${n(y)}L${n(x + 9 * Math.cos(angle - 0.18))} ${n(y + 9 * Math.sin(angle - 0.18))}L${n(x + 9 * Math.cos(angle + 0.18))} ${n(y + 9 * Math.sin(angle + 0.18))}Z" fill="${i % 2 === 0 ? '#2f5fb8' : '#4a7fd8'}"/>`;
  }
  return (
    `<g class="growth-item growth-ribbon" data-growth="ribbon">` +
    `<path d="M${n(x - 4)} ${n(y + 4)}l-3 18 4-3 3 4 2-17ZM${n(x + 4)} ${n(y + 4)}l3 18-4-3-3 4-2-17Z" fill="#2f5fb8"/>` +
    pleats +
    `<circle cx="${n(x)}" cy="${n(y)}" r="5.2" fill="#f2c14e" stroke="#b8862a" stroke-width="0.8"/>` +
    `<text x="${n(x)}" y="${n(y + 1.6)}" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="4.4" fill="#6b4a12">1st</text>` +
    `</g>`
  );
}

/** The board itself; `beaten` lists the kids with at least one win against them. */
export function corkboard(beaten: ReadonlySet<KidId>, champion: boolean): string {
  const { x, y, width, height } = LAYOUT.corkboard;
  const inset = 6;
  const rng = createRng('polaroid-tilt');
  const cols = 3;
  const cellW = (width - inset * 2) / cols;
  const cellH = (height - inset * 2) / 2;
  // Pinned in Block Ladder order, bottom rung first, reading like a list of who to beat next.
  const pins = BLOCK_LADDER.map((kid, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = x + inset + cellW * (col + 0.5) + rng.float(-2, 2);
    const cy = y + inset + cellH * (row + 0.5) + 2 + rng.float(-1.5, 1.5);
    return polaroid(kid, cx, cy, rng.float(-7, 7), TACK_COLOURS[index] ?? '#d8432f', beaten.has(kid));
  }).join('');
  return (
    `<g class="corkboard">` +
    `<rect x="${x + 3}" y="${y + 4}" width="${width}" height="${height}" rx="3" fill="#000" opacity="0.3"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="var(--den-trim)"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="3" rx="1.5" fill="#fff" opacity="0.18"/>` +
    corkTexture(x + inset - 1, y + inset - 1, width - inset * 2 + 2, height - inset * 2 + 2) +
    `<rect x="${x + inset - 1}" y="${y + inset - 1}" width="${width - inset * 2 + 2}" height="${height - inset * 2 + 2}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.2"/>` +
    pins +
    (champion ? rosette(x + width - 4, y + 8) : '') +
    `</g>`
  );
}
