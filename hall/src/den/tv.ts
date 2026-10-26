/**
 * The television and its stand: a walnut-cabinet CRT with a silver bezel, a
 * speaker grille and two chunky knobs, rabbit-ear antenna on top, and a low
 * stand with an open shelf where the console lives. The picture itself is an
 * HTML canvas (the kit's CRT) laid over the screen opening; this file draws
 * everything around it. The lamp on the stand's end is the room's warm light
 * at night.
 */
import { LAYOUT } from './geometry.ts';
import { n, roundedRectPath, woodgrainPath } from './svg.ts';

export function tvDefs(): string {
  const { tv } = LAYOUT;
  return `
    <linearGradient id="den-note-paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe27a"/>
      <stop offset="0.5" stop-color="#ffe789"/>
      <stop offset="1" stop-color="#f3cf5c"/>
    </linearGradient>
    <linearGradient id="den-bezel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--den-bezel)"/>
      <stop offset="1" stop-color="var(--den-bezel-dark)"/>
    </linearGradient>
    <linearGradient id="den-cabinet-shine" x1="${tv.x}" y1="${tv.y}" x2="${tv.x + tv.width}" y2="${tv.y + tv.height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
      <stop offset="0.4" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.25"/>
    </linearGradient>
    <radialGradient id="den-knob" cx="0.38" cy="0.32" r="0.8">
      <stop offset="0" stop-color="var(--den-chrome)"/>
      <stop offset="1" stop-color="var(--den-chrome-dark)"/>
    </radialGradient>
    <pattern id="den-grille" patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill="var(--den-tv-wood)"/>
      <circle cx="3" cy="3" r="1.5" fill="#000" opacity="0.55"/>
    </pattern>
    <radialGradient id="den-lamp-glow" cx="0.5" cy="0.6" r="0.6">
      <stop offset="0" stop-color="#fff6dc" stop-opacity="0.95"/>
      <stop offset="1" stop-color="var(--den-lamp-shade)" stop-opacity="0"/>
    </radialGradient>`;
}

function stand(): string {
  const { stand: s, compartment: c } = LAYOUT;
  const topDepth = 14;
  return (
    `<g class="stand">` +
    `<ellipse cx="${s.x + s.width / 2}" cy="${s.y + s.height + 2}" rx="${s.width / 2 + 10}" ry="10" fill="#000" opacity="0.32"/>` +
    // Top face, seen slightly from above.
    `<path d="M${s.x + 10} ${s.y - topDepth}H${s.x + s.width - 10}L${s.x + s.width} ${s.y}H${s.x}Z" fill="var(--den-tv-wood-light)"/>` +
    `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="var(--den-tv-wood)"/>` +
    `<path d="${woodgrainPath(s.x, s.y, s.width, s.height, { lines: 16, seed: 'stand' })}" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="1"/>` +
    `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="4" fill="#fff" opacity="0.12"/>` +
    // The open shelf: dark inside, with a back wall and a floor.
    `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="4" fill="#120c0a"/>` +
    `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="4" fill="var(--den-tv-wood)" opacity="0.35"/>` +
    `<path d="M${c.x + 18} ${c.y + c.height - 34}H${c.x + c.width - 18}L${c.x + c.width} ${c.y + c.height}H${c.x}Z" fill="var(--den-tv-wood-light)" opacity="0.75"/>` +
    `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="4" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="3"/>` +
    // Feet.
    `<rect x="${s.x + 16}" y="${s.y + s.height - 4}" width="26" height="8" rx="2" fill="var(--den-trim)"/>` +
    `<rect x="${s.x + s.width - 42}" y="${s.y + s.height - 4}" width="26" height="8" rx="2" fill="var(--den-trim)"/>` +
    `</g>`
  );
}

function antenna(): string {
  const { tv } = LAYOUT;
  const baseX = tv.x + 190;
  const baseY = tv.y - 4;
  return (
    `<g class="antenna">` +
    `<path d="M${baseX} ${baseY - 10}L${baseX - 92} ${baseY - 132}" stroke="var(--den-chrome)" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M${baseX} ${baseY - 10}L${baseX + 84} ${baseY - 146}" stroke="var(--den-chrome)" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M${baseX} ${baseY - 10}L${baseX - 92} ${baseY - 132}" stroke="#fff" stroke-opacity="0.5" stroke-width="1" stroke-linecap="round"/>` +
    `<circle cx="${baseX - 92}" cy="${baseY - 132}" r="3.5" fill="var(--den-chrome)"/>` +
    `<circle cx="${baseX + 84}" cy="${baseY - 146}" r="3.5" fill="var(--den-chrome)"/>` +
    `<path d="M${baseX - 26} ${baseY}a26 16 0 0 1 52 0Z" fill="var(--den-console)"/>` +
    `<path d="M${baseX - 18} ${baseY - 6}a18 9 0 0 1 22 -7" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="2"/>` +
    `</g>`
  );
}

function cabinet(): string {
  const { tv, screen } = LAYOUT;
  const control = { x: screen.x + screen.width + 22, y: tv.y + 26, width: tv.x + tv.width - (screen.x + screen.width + 22) - 18 };
  const bezel = { x: screen.x - 14, y: screen.y - 14, width: screen.width + 28, height: screen.height + 28 };
  return (
    `<g class="tv">` +
    `<rect x="${tv.x + 6}" y="${tv.y + tv.height - 2}" width="${tv.width - 12}" height="8" fill="#000" opacity="0.35"/>` +
    // Top face and right side for the three-quarter view.
    `<path d="M${tv.x + 8} ${tv.y - 10}H${tv.x + tv.width - 2}L${tv.x + tv.width + 8} ${tv.y}H${tv.x}Z" fill="var(--den-tv-wood-light)"/>` +
    `<path d="M${tv.x + tv.width} ${tv.y}L${tv.x + tv.width + 8} ${tv.y - 10}V${tv.y + tv.height - 12}L${tv.x + tv.width} ${tv.y + tv.height}Z" fill="#000" opacity="0.35"/>` +
    `<path d="${roundedRectPath(tv.x, tv.y, tv.width, tv.height, 14)}" fill="var(--den-tv-wood)"/>` +
    `<path d="${woodgrainPath(tv.x + 4, tv.y + 4, tv.width - 8, tv.height - 8, { lines: 22, seed: 'tv-cabinet' })}" fill="none" stroke="#000" stroke-opacity="0.2" stroke-width="1"/>` +
    `<path d="${roundedRectPath(tv.x, tv.y, tv.width, tv.height, 14)}" fill="url(#den-cabinet-shine)"/>` +
    // Bezel around the screen.
    `<path d="${roundedRectPath(bezel.x, bezel.y, bezel.width, bezel.height, 22)}" fill="url(#den-bezel)"/>` +
    `<path d="${roundedRectPath(bezel.x + 5, bezel.y + 5, bezel.width - 10, bezel.height - 10, 18)}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="2"/>` +
    `<path data-ref="screen-glass" d="${roundedRectPath(screen.x, screen.y, screen.width, screen.height, 18)}" fill="var(--den-glass-off)"/>` +
    // Control column: speaker grille, two knobs and the maker's plate.
    `<rect x="${control.x}" y="${control.y}" width="${control.width}" height="92" rx="6" fill="url(#den-grille)" stroke="#000" stroke-opacity="0.3"/>` +
    knob(control.x + control.width / 2, control.y + 128, 'channel') +
    knob(control.x + control.width / 2, control.y + 186, 'volume') +
    `<rect x="${control.x + 4}" y="${control.y + 218}" width="${control.width - 8}" height="14" rx="2" fill="url(#den-bezel)"/>` +
    `<text x="${control.x + control.width / 2}" y="${control.y + 228.5}" text-anchor="middle" fill="var(--den-trim)" font-family="var(--font-label)" font-weight="800" font-size="8.5" letter-spacing="1.2">WOODGRAIN</text>` +
    `<circle data-ref="tv-power-light" cx="${control.x + control.width - 9}" cy="${control.y + 246}" r="3" fill="#ff5a3c"/>` +
    // Short chrome feet.
    `<rect x="${tv.x + 30}" y="${tv.y + tv.height}" width="20" height="6" rx="2" fill="var(--den-chrome-dark)"/>` +
    `<rect x="${tv.x + tv.width - 50}" y="${tv.y + tv.height}" width="20" height="6" rx="2" fill="var(--den-chrome-dark)"/>` +
    `</g>`
  );
}

function knob(cx: number, cy: number, name: string): string {
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ticks += `M${n(cx + Math.cos(a) * 20)} ${n(cy + Math.sin(a) * 20)}L${n(cx + Math.cos(a) * 23)} ${n(cy + Math.sin(a) * 23)}`;
  }
  return (
    `<g class="knob knob--${name}">` +
    `<path d="${ticks}" stroke="var(--den-bezel)" stroke-width="1.5" opacity="0.7"/>` +
    `<circle cx="${cx}" cy="${cy + 2}" r="17" fill="#000" opacity="0.35"/>` +
    `<circle cx="${cx}" cy="${cy}" r="17" fill="url(#den-knob)"/>` +
    `<rect x="${cx - 2.5}" y="${cy - 15}" width="5" height="12" rx="2" fill="var(--den-trim)"/>` +
    `</g>`
  );
}

export function lamp(): string {
  const { lamp: l } = LAYOUT;
  const cx = l.x + l.width / 2;
  const shadeTop = l.y;
  const shadeBottom = l.y + 62;
  const baseTop = shadeBottom + 4;
  const base = `M${cx - 8} ${baseTop}C${cx - 30} ${baseTop + 14} ${cx - 30} ${l.y + l.height - 12} ${cx - 16} ${l.y + l.height}H${cx + 16}C${cx + 30} ${l.y + l.height - 12} ${cx + 30} ${baseTop + 14} ${cx + 8} ${baseTop}Z`;
  let pleats = '';
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pleats += `M${n(cx - 20 + t * 40)} ${shadeTop}L${n(cx - 30 + t * 60)} ${shadeBottom}`;
  }
  return (
    `<g class="lamp">` +
    `<ellipse class="lamp-pool-table" cx="${cx}" cy="${l.y + l.height}" rx="40" ry="6" fill="#000" opacity="0.25"/>` +
    `<path d="${base}" fill="var(--den-lamp-base)"/>` +
    `<path d="M${cx - 10} ${baseTop + 16}C${cx - 22} ${baseTop + 30} ${cx - 20} ${l.y + l.height - 20} ${cx - 12} ${l.y + l.height - 8}" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="${cx - 1.5}" y="${shadeBottom - 4}" width="3" height="10" fill="var(--den-chrome-dark)"/>` +
    `<path class="lamp-shade" d="M${cx - 20} ${shadeTop}H${cx + 20}L${cx + 30} ${shadeBottom}H${cx - 30}Z" fill="var(--den-lamp-shade)"/>` +
    `<path d="${pleats}" stroke="#000" stroke-opacity="0.12" stroke-width="1"/>` +
    `<path class="lamp-bulb" d="M${cx - 20} ${shadeTop}H${cx + 20}L${cx + 30} ${shadeBottom}H${cx - 30}Z" fill="url(#den-lamp-glow)"/>` +
    `</g>`
  );
}

export function tvAndStand(): string {
  return stand() + antenna() + cabinet();
}

/** A sticky note on the TV's corner, in someone's handwriting: the room's own hint. */
/**
 * Only the gummed strip at the top is stuck to the rail; the lower half hangs
 * free over the open shelf, so its shadow falls further away and the bottom
 * corner lifts.
 */
export function stickyNote(): string {
  const { stickyNote: note } = LAYOUT;
  const { x, y, width: w, height: h } = note;
  const cx = x + w / 2;
  const curl = 13;
  const paper = `M${x} ${y}H${x + w}V${y + h - curl}Q${x + w - 3} ${y + h - 2} ${x + w - curl - 1} ${y + h}H${x}Z`;
  const flap = `M${x + w} ${y + h - curl}Q${x + w - 9} ${y + h - 9} ${x + w - curl - 1} ${y + h}Q${x + w - 4} ${y + h - 4} ${x + w} ${y + h - curl}Z`;
  const shadow = `M${x + 1.5} ${y + 2}H${x + w + 1.5}L${x + w + 5} ${y + h + 5}H${x + 5}Z`;
  return (
    `<g class="sticky-note" aria-hidden="true" transform="rotate(3 ${cx} ${y})">` +
    `<path d="${shadow}" fill="#000" opacity="0.32"/>` +
    `<path d="${paper}" fill="url(#den-note-paper)"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="10" fill="#f5cf4f"/>` +
    `<path d="${flap}" fill="#e9c24c"/>` +
    `<path d="M${x + w - curl - 1} ${y + h}Q${x + w - 4} ${y + h - 4} ${x + w} ${y + h - curl}" fill="none" stroke="#fff3b8" stroke-width="0.8" opacity="0.8"/>` +
    `<text x="${cx}" y="${y + 27}" text-anchor="middle" fill="#3a2a8a" font-family="var(--font-hand)" font-size="13">flip the</text>` +
    `<text x="${cx}" y="${y + 42}" text-anchor="middle" fill="#3a2a8a" font-family="var(--font-hand)" font-size="13">POWER switch!</text>` +
    `<text x="${cx}" y="${y + 60}" text-anchor="middle" fill="#b8433a" font-family="var(--font-hand)" font-size="12">(or press P)</text>` +
    `</g>`
  );
}
