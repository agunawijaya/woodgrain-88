/**
 * The Label Wall: a built-in pine shelf unit with a teal felt back and four
 * shelves, one per family (Duels, Brain, Sports, Arcade), each marked with a
 * strip of embossed label-maker tape. Cartridges stand upright, labels out,
 * in slot order; the shorter rows end in a few things that live on shelves
 * (a trophy, a snow globe, board-game boxes, a bookend).
 *
 * Every cartridge is a focusable button; den-view.ts wires hover, focus,
 * arrow keys and Enter.
 */
import { FAMILIES, type Family, type GameManifest } from '@woodgrain-88/kit';
import { counterDigits } from '../data/cycle.ts';
import { FAMILY_NAMES, wallRows } from '../data/registry.ts';
import { LAYOUT, WALL, wallSlot, type Rect } from './geometry.ts';
import { LABEL_SIZE, labelSvg } from './label.ts';
import { attrs, n, roundedRectPath, woodgrainPath } from './svg.ts';

export function wallDefs(): string {
  return `
    <pattern id="den-felt" patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" fill="var(--den-shelf-back)"/>
      <path d="M0 0l8 8M8 0l-8 8" stroke="var(--den-shelf-back-light)" stroke-width="0.6" opacity="0.5"/>
    </pattern>
    <linearGradient id="den-shelf-shadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>`;
}

function shelfUnit(): string {
  const { shelf: s } = LAYOUT;
  const side = 16;
  let boards = '';
  for (let row = 0; row < FAMILIES.length; row++) {
    const top = WALL.firstRowY + row * WALL.rowHeight;
    const boardY = top + WALL.rowHeight - WALL.boardHeight;
    boards +=
      `<rect x="${s.x + side}" y="${top}" width="${s.width - side * 2}" height="18" fill="url(#den-shelf-shadow)"/>` +
      `<rect x="${s.x + side}" y="${boardY}" width="${s.width - side * 2}" height="${WALL.boardHeight}" fill="var(--den-shelf)"/>` +
      `<rect x="${s.x + side}" y="${boardY}" width="${s.width - side * 2}" height="2.5" fill="#fff" opacity="0.18"/>` +
      `<rect class="shelf-strip" x="${s.x + side}" y="${top + 2}" width="${s.width - side * 2}" height="3" fill="var(--den-lamp-shade)" opacity="0"/>`;
  }
  return (
    `<g class="shelf-unit">` +
    `<rect x="${s.x + 6}" y="${s.y + 6}" width="${s.width}" height="${s.height}" fill="#000" opacity="0.25"/>` +
    `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="var(--den-shelf)"/>` +
    `<rect x="${s.x + side}" y="${s.y + side}" width="${s.width - side * 2}" height="${s.height - side - 6}" fill="url(#den-felt)"/>` +
    `<path d="${woodgrainPath(s.x, s.y, side, s.height, { lines: 4, seed: 'shelf-left', vertical: true })}${woodgrainPath(s.x + s.width - side, s.y, side, s.height, { lines: 4, seed: 'shelf-right', vertical: true })}${woodgrainPath(s.x, s.y, s.width, side, { lines: 3, seed: 'shelf-top' })}" fill="none" stroke="var(--den-shelf-dark)" stroke-opacity="0.5" stroke-width="1"/>` +
    boards +
    `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="3" fill="#fff" opacity="0.2"/>` +
    `</g>`
  );
}

/** Embossed label-maker tape on the shelf edge. */
function tape(text: string, x: number, y: number): string {
  const width = text.length * 7.4 + 14;
  return (
    `<g class="dymo">` +
    `<rect x="${x}" y="${y}" width="${n(width)}" height="11" rx="1.5" fill="#1d1b1a"/>` +
    `<rect x="${x}" y="${y}" width="${n(width)}" height="2" rx="1" fill="#fff" opacity="0.12"/>` +
    `<text x="${n(x + width / 2)}" y="${y + 8.6}" text-anchor="middle" fill="#f7f3ea" font-family="var(--font-label)" font-weight="700" font-size="9" letter-spacing="2.2">${text}</text>` +
    `</g>`
  );
}

function cartridge(manifest: GameManifest, slot: Rect): string {
  const { label } = WALL;
  const scale = label.width / LABEL_SIZE.width;
  const soon = manifest.status === 'coming-soon';
  const ribs = Array.from(
    { length: 5 },
    (_, i) => `M${slot.x + 8} ${slot.y + slot.height - 22 + i * 4}h${slot.width - 16}`,
  ).join('');
  return (
    `<g ${attrs({
      class: 'cartridge',
      tabindex: 0,
      role: 'button',
      'data-game': manifest.id,
      'data-slot': manifest.slot,
      // The name repeats the label's printed words (title, tab, tape) so speech
      // input can say what it sees; the description spells them out.
      'aria-label': `${manifest.title}, ${counterDigits(manifest.slot)}${soon ? ', soon' : ''}`,
      'aria-description': `Slot ${manifest.slot}${soon ? ', coming soon' : ''}`,
    })}>` +
    `<g class="cartridge-lift" aria-hidden="true">` +
    `<rect x="${slot.x + 3}" y="${slot.y + 4}" width="${slot.width}" height="${slot.height}" rx="5" fill="#000" opacity="0.35"/>` +
    `<path d="${roundedRectPath(slot.x, slot.y, slot.width, slot.height, 5)}" fill="#24201e"/>` +
    `<path d="M${slot.x} ${slot.y + 5}a5 5 0 0 1 5 -5h${slot.width - 10}a5 5 0 0 1 5 5v2H${slot.x}Z" fill="#3a3430"/>` +
    `<path d="${ribs}" stroke="#000" stroke-opacity="0.55" stroke-width="1.6"/>` +
    `<g transform="translate(${slot.x + label.inset} ${slot.y + label.top}) scale(${n(scale)})">${labelSvg(manifest, { idPrefix: `wall-${manifest.id}` })}</g>` +
    `<path class="focus-ring" d="${roundedRectPath(slot.x - 4, slot.y - 4, slot.width + 8, slot.height + 8, 8)}"/>` +
    `</g>` +
    `</g>`
  );
}

function trophy(slot: Rect): string {
  const cx = slot.x + slot.width / 2;
  const bottom = slot.y + slot.height;
  return (
    `<g class="shelf-prop">` +
    `<rect x="${cx - 16}" y="${bottom - 12}" width="32" height="12" rx="2" fill="var(--den-trim)"/>` +
    `<rect x="${cx - 4}" y="${bottom - 30}" width="8" height="18" fill="var(--den-stitch)"/>` +
    `<path d="M${cx - 18} ${bottom - 62}h36c0 18 -8 30 -18 32c-10 -2 -18 -14 -18 -32Z" fill="var(--den-stitch)"/>` +
    `<path d="M${cx - 18} ${bottom - 58}c-10 0 -10 14 2 16M${cx + 18} ${bottom - 58}c10 0 10 14 -2 16" fill="none" stroke="var(--den-stitch)" stroke-width="3"/>` +
    `<path d="M${cx - 10} ${bottom - 58}c0 10 3 18 6 20" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/>` +
    `</g>`
  );
}

function snowGlobe(slot: Rect): string {
  const cx = slot.x + slot.width / 2;
  const bottom = slot.y + slot.height;
  return (
    `<g class="shelf-prop">` +
    `<path d="M${cx - 20} ${bottom}l4 -12h32l4 12Z" fill="var(--den-tv-wood)"/>` +
    `<circle cx="${cx}" cy="${bottom - 32}" r="22" fill="#cfe8f3" opacity="0.85"/>` +
    `<path d="M${cx - 12} ${bottom - 18}l12 -20l12 20Z" fill="var(--den-leaf-dark)"/>` +
    `<circle cx="${cx - 8}" cy="${bottom - 40}" r="1.5" fill="#fff"/><circle cx="${cx + 6}" cy="${bottom - 46}" r="1.2" fill="#fff"/><circle cx="${cx + 10}" cy="${bottom - 30}" r="1.4" fill="#fff"/>` +
    `<ellipse cx="${cx - 8}" cy="${bottom - 42}" rx="6" ry="10" fill="#fff" opacity="0.35" transform="rotate(-30 ${cx - 8} ${bottom - 42})"/>` +
    `</g>`
  );
}

function boxes(slot: Rect): string {
  const bottom = slot.y + slot.height;
  const colours = ['#c4501a', '#1d6f6c', '#d9a21b', '#5a3e7a'];
  return (
    `<g class="shelf-prop">` +
    colours
      .map(
        (colour, i) =>
          `<rect x="${slot.x - 4 + i * 3}" y="${bottom - 14 - i * 14}" width="${slot.width + 22 - i * 8}" height="14" rx="1.5" fill="${colour}"/>` +
          `<rect x="${slot.x + i * 3}" y="${bottom - 9 - i * 14}" width="${18 + i * 4}" height="4" rx="1" fill="#fff" opacity="0.55"/>`,
      )
      .join('') +
    `</g>`
  );
}

function bookend(slot: Rect): string {
  const bottom = slot.y + slot.height;
  return (
    `<g class="shelf-prop">` +
    `<path d="M${slot.x + 18} ${bottom}V${bottom - 70}h10v60h26v10Z" fill="var(--den-chrome-dark)"/>` +
    `<rect x="${slot.x + 2}" y="${bottom - 64}" width="14" height="64" rx="1" fill="#7a3b4a"/>` +
    `<rect x="${slot.x - 12}" y="${bottom - 58}" width="13" height="58" rx="1" fill="#2f5d8a"/>` +
    `</g>`
  );
}

const FILLERS: Readonly<Record<Family, ((slot: Rect) => string)[]>> = {
  duels: [trophy, () => '', snowGlobe],
  brain: [() => '', boxes],
  sports: [],
  arcade: [bookend],
};

export function labelWall(manifests: readonly GameManifest[]): string {
  const rows = wallRows(manifests);
  let markup = shelfUnit();
  FAMILIES.forEach((family, rowIndex) => {
    const games = rows[family];
    markup += `<g class="wall-row" role="group" aria-label="${FAMILY_NAMES[family]}" data-row="${rowIndex}">`;
    games.forEach((manifest, column) => {
      markup += cartridge(manifest, wallSlot(rowIndex, column));
    });
    markup += `</g>`;
    FILLERS[family].forEach((draw, i) => {
      const column = games.length + i;
      if (column < WALL.columns) markup += draw(wallSlot(rowIndex, column));
    });
    const boardY = WALL.firstRowY + rowIndex * WALL.rowHeight + WALL.rowHeight - WALL.boardHeight;
    markup += tape(FAMILY_NAMES[family].toUpperCase(), WALL.innerX + 6, boardY + 0.5);
  });
  return markup;
}
