/**
 * The room itself: pine-panelled walls, the shag carpet with its braided rug,
 * the high basement window with venetian blinds, the door with the denim
 * jacket on its hook, the wall calendar, the beanbag and a trailing pothos.
 * All colours come from the --den-* tokens, so day and night are both
 * designed in tokens.css and switch live.
 */
import { FLOOR_Y, LAYOUT, type Rect } from './geometry.ts';
import { n, roundedRectPath, shagPath, woodgrainPath } from './svg.ts';

const FAR = { left: -3200, right: 4800, top: -2400, bottom: 3200 };

export function roomDefs(): string {
  const plank = 44;
  const planks = [0, 1, 2]
    .map((i) => {
      const tone =
        ['var(--den-wall)', 'var(--den-wall-light)', 'var(--den-wall-dark)'][i] ??
        'var(--den-wall)';
      const opacity = [1, 0.55, 0.45][i] ?? 1;
      return (
        `<rect x="${i * plank}" y="0" width="${plank}" height="900" fill="var(--den-wall)"/>` +
        `<rect x="${i * plank}" y="0" width="${plank}" height="900" fill="${tone}" opacity="${opacity}"/>` +
        `<path d="${woodgrainPath(i * plank + 3, 0, plank - 6, 900, { lines: 7, seed: `plank-${i}`, vertical: true })}" fill="none" stroke="var(--den-groove)" stroke-opacity="0.28" stroke-width="1.1"/>` +
        `<rect x="${i * plank + plank - 2.5}" y="0" width="2.5" height="900" fill="var(--den-groove)" opacity="0.85"/>` +
        `<rect x="${i * plank}" y="0" width="1.2" height="900" fill="var(--den-wall-light)" opacity="0.6"/>`
      );
    })
    .join('');
  return `
    <pattern id="den-panelling" patternUnits="userSpaceOnUse" x="0" y="0" width="${plank * 3}" height="900">${planks}</pattern>
    <pattern id="den-shag" patternUnits="userSpaceOnUse" width="96" height="48">
      <rect width="96" height="48" fill="var(--den-carpet)"/>
      <path d="${shagPath(0, 4, 96, 44, 120, 'shag-dark')}" stroke="var(--den-carpet-dark)" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
      <path d="${shagPath(0, 4, 96, 44, 90, 'shag-light')}" stroke="var(--den-carpet-light)" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
    </pattern>
    <linearGradient id="den-floor-shade" x1="0" y1="${FLOOR_Y}" x2="0" y2="${FLOOR_Y + 220}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000" stop-opacity="0.38"/>
      <stop offset="0.12" stop-color="#000" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="den-sky" x1="0" y1="${LAYOUT.window.y}" x2="0" y2="${LAYOUT.window.y + LAYOUT.window.height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="var(--den-sky-top)"/>
      <stop offset="1" stop-color="var(--den-sky-bottom)"/>
    </linearGradient>
    <clipPath id="den-beanbag-clip"><path d="M14 170C-2 150 4 112 28 92C46 76 58 46 88 26C112 8 150 2 182 10C214 18 236 44 246 72C262 96 292 124 286 154C282 172 262 180 238 180Q214 186 188 182Q150 187 112 183Q76 187 46 182Q26 180 14 170Z"/></clipPath>
    <radialGradient id="den-beanbag-dent" cx="0.55" cy="0.25" r="0.75">
      <stop offset="0" stop-color="#3b2a08" stop-opacity="0.42"/>
      <stop offset="0.5" stop-color="#3b2a08" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#3b2a08" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="den-beanbag-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.3"/>
    </linearGradient>
    <radialGradient id="den-beanbag-shade" cx="0.42" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="0.6" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.32"/>
    </radialGradient>
    <linearGradient id="den-denim-shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.25"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.22"/>
    </linearGradient>`;
}

function wall(): string {
  const width = FAR.right - FAR.left;
  return (
    `<rect x="${FAR.left}" y="${FAR.top}" width="${width}" height="${FLOOR_Y - FAR.top}" fill="url(#den-panelling)"/>` +
    // Crown moulding and a sliver of ceiling, only seen in tall windows.
    `<rect x="${FAR.left}" y="${FAR.top}" width="${width}" height="${-60 - FAR.top}" fill="var(--den-ceiling)"/>` +
    `<rect x="${FAR.left}" y="-62" width="${width}" height="16" fill="var(--den-trim)"/>` +
    `<rect x="${FAR.left}" y="-48" width="${width}" height="4" fill="var(--den-wall-light)" opacity="0.5"/>` +
    // Baseboard.
    `<rect x="${FAR.left}" y="${FLOOR_Y - 16}" width="${width}" height="18" fill="var(--den-trim)"/>` +
    `<rect x="${FAR.left}" y="${FLOOR_Y - 16}" width="${width}" height="3" fill="var(--den-wall-light)" opacity="0.35"/>`
  );
}

function carpet(): string {
  const width = FAR.right - FAR.left;
  return (
    `<rect x="${FAR.left}" y="${FLOOR_Y}" width="${width}" height="${FAR.bottom - FLOOR_Y}" fill="url(#den-shag)"/>` +
    `<rect x="${FAR.left}" y="${FLOOR_Y}" width="${width}" height="240" fill="url(#den-floor-shade)"/>`
  );
}

function rug(): string {
  const { x, y, width, height } = LAYOUT.rug;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const colours = [
    'var(--den-rug-3)',
    'var(--den-rug-1)',
    'var(--den-rug-2)',
    'var(--den-rug-4)',
    'var(--den-rug-1)',
    'var(--den-rug-3)',
    'var(--den-rug-2)',
    'var(--den-rug-1)',
    'var(--den-rug-4)',
  ];
  let rings = `<ellipse cx="${cx}" cy="${cy + 6}" rx="${width / 2 + 6}" ry="${height / 2 + 4}" fill="#000" opacity="0.22"/>`;
  colours.forEach((colour, i) => {
    const inset = i * 13;
    rings += `<ellipse cx="${cx}" cy="${cy}" rx="${width / 2 - inset}" ry="${n(height / 2 - inset * (height / width))}" fill="${colour}"/>`;
    // The braid: a dashed line of slanted stitches along each ring.
    rings += `<ellipse cx="${cx}" cy="${cy}" rx="${width / 2 - inset - 6.5}" ry="${n(height / 2 - (inset + 6.5) * (height / width))}" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="5" stroke-dasharray="2.4 3.2"/>`;
  });
  rings += `<ellipse cx="${cx - 40}" cy="${cy - 18}" rx="${width / 3}" ry="${height / 5}" fill="#fff" opacity="0.06"/>`;
  return `<g class="rug">${rings}</g>`;
}

function blinds(): string {
  const { x, y, width, height } = LAYOUT.window;
  const inner = { x: x + 10, y: y + 10, width: width - 20, height: height - 20 };
  const slatCount = 12;
  const pitch = inner.height / slatCount;
  let slats = '';
  for (let i = 0; i < slatCount; i++) {
    const sy = inner.y + i * pitch + pitch / 2;
    slats +=
      `<g class="slat">` +
      `<rect x="${inner.x - 4}" y="${n(sy - 1.6)}" width="${inner.width + 8}" height="3.2" rx="1" fill="var(--den-slat)"/>` +
      `<rect x="${inner.x - 4}" y="${n(sy + 1)}" width="${inner.width + 8}" height="1" fill="var(--den-slat-edge)"/>` +
      `</g>`;
  }
  return (
    `<g class="window">` +
    `<rect x="${x - 8}" y="${y - 8}" width="${width + 16}" height="${height + 22}" rx="3" fill="var(--den-trim)"/>` +
    `<rect x="${inner.x}" y="${inner.y}" width="${inner.width}" height="${inner.height}" fill="url(#den-sky)"/>` +
    // Garden beyond the glass: a hedge line and a fence, seen from below ground level.
    `<circle class="window-sun" cx="${inner.x + inner.width * 0.72}" cy="${inner.y + inner.height * 0.62}" r="30" fill="#fff4d6" opacity="0.85"/>` +
    `<path class="window-garden" d="M${inner.x} ${inner.y + inner.height - 30}q40 -16 80 -6t90 -8t95 6t100 -10t90 8t95 -4t86 6V${inner.y + inner.height}H${inner.x}Z" fill="var(--den-leaf)" opacity="0.9"/>` +
    `<path class="window-garden" d="M${inner.x} ${inner.y + inner.height - 14}h${inner.width}v14H${inner.x}Z" fill="var(--den-leaf-dark)"/>` +
    `<path class="window-garden" d="${Array.from({ length: 22 }, (_, i) => `M${inner.x + 12 + i * 29} ${inner.y + inner.height}v-34l4 -5l4 5v34`).join('')}" fill="var(--den-door)" opacity="0.7"/>` +
    `<rect x="${inner.x}" y="${inner.y + inner.height / 2 - 2}" width="${inner.width}" height="5" fill="var(--den-trim)"/>` +
    `<rect x="${x + width / 2 - 3}" y="${inner.y}" width="6" height="${inner.height}" fill="var(--den-trim)"/>` +
    `<g class="slats">${slats}</g>` +
    `<rect x="${inner.x - 6}" y="${inner.y - 6}" width="${inner.width + 12}" height="9" rx="2" fill="var(--den-slat)"/>` +
    `<path d="M${inner.x + 120} ${inner.y}v${inner.height + 26}M${inner.x + inner.width - 120} ${inner.y}v${inner.height + 26}" stroke="var(--den-slat-edge)" stroke-width="1.2"/>` +
    `<circle cx="${inner.x + 120}" cy="${inner.y + inner.height + 28}" r="3.5" fill="var(--den-slat)"/>` +
    `<rect x="${x - 14}" y="${y + height + 8}" width="${width + 28}" height="9" rx="2" fill="var(--den-trim)"/>` +
    `</g>`
  );
}

function door(): string {
  const { x, y, width, height } = LAYOUT.door;
  const casing = 12;
  const slab = { x: x + casing, y: y + casing, width: width - casing * 2, height: height - casing };
  const panel = (px: number, py: number, pw: number, ph: number) =>
    `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="3" fill="none" stroke="var(--den-door-edge)" stroke-width="3"/>` +
    `<rect x="${px + 6}" y="${py + 6}" width="${pw - 12}" height="${ph - 12}" rx="2" fill="#fff" opacity="0.07"/>`;
  const colW = (slab.width - 30) / 2;
  return (
    `<g class="door">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="var(--den-trim)"/>` +
    `<rect x="${slab.x}" y="${slab.y}" width="${slab.width}" height="${slab.height}" fill="var(--den-door)"/>` +
    panel(slab.x + 10, slab.y + 14, colW, 150) +
    panel(slab.x + 20 + colW, slab.y + 14, colW, 150) +
    panel(slab.x + 10, slab.y + 180, colW, 140) +
    panel(slab.x + 20 + colW, slab.y + 180, colW, 140) +
    panel(slab.x + 10, slab.y + 336, colW, 170) +
    panel(slab.x + 20 + colW, slab.y + 336, colW, 170) +
    `<rect x="${slab.x + slab.width - 4}" y="${slab.y}" width="4" height="${slab.height}" fill="#000" opacity="0.12"/>` +
    `<circle cx="${slab.x + slab.width - 16}" cy="${y + 300}" r="8" fill="var(--den-stitch)" stroke="#000" stroke-opacity="0.25"/>` +
    `<circle cx="${slab.x + slab.width - 18}" cy="${y + 298}" r="3" fill="#fff" opacity="0.5"/>` +
    `</g>`
  );
}

/** The denim jacket on a hanger hooked over the door, wearing the patches sewn on its front. */
export function jacket(): string {
  const { x, y, width } = LAYOUT.jacket;
  const cx = x + width / 2;
  const top = y;
  const doorTop = LAYOUT.door.y + 12;
  const shoulder = { dx: 56, dy: 24 };
  // The wire hanger: a hook over the door's top edge and a neck down into the
  // collar. Its arms are inside the jacket, under the shoulders, so all that
  // shows of them is where they cross the open collar (drawn further down).
  const hanger = `M${cx + 13} ${doorTop + 10}C${cx + 13} ${doorTop - 4} ${cx} ${doorTop - 6} ${cx} ${doorTop + 8}V${top + 6}`;
  // The jacket hangs from the hanger's arms: its shoulder seams follow them.
  const body =
    `M${cx - 14} ${top + 2}` +
    `L${cx - shoulder.dx - 4} ${top + shoulder.dy + 2}` +
    `C${cx - 66} ${top + 34} ${cx - 66} ${top + 50} ${cx - 64} ${top + 66}` +
    `L${cx - 66} ${top + 222}Q${cx} ${top + 234} ${cx + 66} ${top + 222}` +
    `L${cx + 64} ${top + 66}` +
    `C${cx + 66} ${top + 50} ${cx + 66} ${top + 34} ${cx + shoulder.dx + 4} ${top + shoulder.dy + 2}` +
    `L${cx + 14} ${top + 2}Z`;
  const leftSleeve = `M${cx - 60} ${top + 30}C${cx - 78} ${top + 52} ${cx - 84} ${top + 132} ${cx - 80} ${top + 206}L${cx - 61} ${top + 210}C${cx - 61} ${top + 150} ${cx - 60} ${top + 96} ${cx - 52} ${top + 62}Z`;
  const rightSleeve = `M${cx + 60} ${top + 30}C${cx + 78} ${top + 52} ${cx + 84} ${top + 132} ${cx + 80} ${top + 206}L${cx + 61} ${top + 210}C${cx + 61} ${top + 150} ${cx + 60} ${top + 96} ${cx + 52} ${top + 62}Z`;
  const lining = `M${cx - 14} ${top + 2}L${cx + 14} ${top + 2}L${cx + 6} ${top + 64}L${cx} ${top + 40}L${cx - 6} ${top + 64}Z`;
  const collarLeft = `M${cx - 14} ${top + 1}C${cx - 24} ${top + 6} ${cx - 30} ${top + 12} ${cx - 32} ${top + 20}L${cx - 6} ${top + 66}L${cx - 4} ${top + 30}Z`;
  const collarRight = `M${cx + 14} ${top + 1}C${cx + 24} ${top + 6} ${cx + 30} ${top + 12} ${cx + 32} ${top + 20}L${cx + 6} ${top + 66}L${cx + 4} ${top + 30}Z`;
  const stitch =
    'stroke="var(--den-stitch)" stroke-width="1.4" stroke-dasharray="3 2.4" fill="none"';
  return (
    `<g class="jacket">` +
    `<path d="${hanger}" fill="none" stroke="var(--den-chrome-dark)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${leftSleeve}" fill="var(--den-denim-dark)"/>` +
    `<path d="${rightSleeve}" fill="var(--den-denim-dark)"/>` +
    `<path d="${body}" fill="var(--den-denim)"/>` +
    `<path d="${body}" fill="url(#den-denim-shade)"/>` +
    `<path d="${lining}" fill="#1f3550"/>` +
    // Inside the open collar: the hanger's neck meeting its two arms, which run
    // on under the shoulders, a little below the shoulder line.
    `<path d="M${cx} ${top - 2}V${top + 6}M${cx - 14} ${top + 13.8}L${cx} ${top + 6}L${cx + 14} ${top + 13.8}" fill="none" stroke="var(--den-chrome-dark)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${cx - shoulder.dx - 4} ${top + shoulder.dy + 2}L${cx - 14} ${top + 2}M${cx + shoulder.dx + 4} ${top + shoulder.dy + 2}L${cx + 14} ${top + 2}" ${stitch}/>` +
    `<path d="M${cx} ${top + 64}V${top + 228}" stroke="var(--den-denim-dark)" stroke-width="2.5"/>` +
    `<path d="M${cx - 4} ${top + 64}V${top + 226}M${cx + 4} ${top + 64}V${top + 226}" ${stitch}/>` +
    `<path d="M${cx - 64} ${top + 196}Q${cx} ${top + 206} ${cx + 64} ${top + 196}" ${stitch}/>` +
    `<path d="M${cx - 50} ${top + 84}h34v28h-34ZM${cx + 16} ${top + 84}h34v28h-34Z" fill="var(--den-denim-dark)" opacity="0.55"/>` +
    `<path d="M${cx - 50} ${top + 84}h34l-4 12h-26ZM${cx + 16} ${top + 84}h34l-4 12h-26Z" fill="var(--den-denim)" stroke="var(--den-stitch)" stroke-width="1.2" stroke-dasharray="2.5 2"/>` +
    [0, 1, 2, 3, 4]
      .map(
        (i) => `<circle cx="${cx + 7}" cy="${top + 90 + i * 30}" r="3" fill="var(--den-chrome)"/>`,
      )
      .join('') +
    `<path d="${collarLeft}" fill="var(--den-denim-dark)"/>` +
    `<path d="${collarRight}" fill="var(--den-denim-dark)"/>` +
    // The patches sewn on the front of the jacket, small, filled in by the Den view.
    `<g data-ref="jacket-patches"></g>` +
    // A glint on the shoulder while there are patches the player has not looked at yet.
    `<path class="jacket-glint" d="M${cx + 40} ${top + 30}l2.2 6.8 6.8 2.2-6.8 2.2-2.2 6.8-2.2-6.8-6.8-2.2 6.8-2.2Z" fill="#fff8dc"/>` +
    `</g>`
  );
}

/** The calendar's picture; the day grid starts below it. */
export const CALENDAR_PHOTO_HEIGHT = 52;

/**
 * The wall calendar. Its page is filled in by the Den view: the month, today's
 * date, a day grid with the streak ticked off (Den Life), the streak sticker in
 * the photo's corner and today's daily number and channel along the bottom.
 */
export function calendar(): string {
  const { x, y, width, height } = LAYOUT.calendar;
  const photoH = CALENDAR_PHOTO_HEIGHT;
  return (
    `<g class="calendar">` +
    `<circle cx="${x + width / 2}" cy="${y - 10}" r="2.5" fill="var(--den-chrome-dark)"/>` +
    `<path d="M${x + width / 2} ${y - 10}L${x + 18} ${y + 4}M${x + width / 2} ${y - 10}L${x + width - 18} ${y + 4}" stroke="var(--den-chrome-dark)" stroke-width="1"/>` +
    `<rect x="${x + 3}" y="${y + 4}" width="${width}" height="${height}" fill="#000" opacity="0.18"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="var(--den-calendar)"/>` +
    // The month's picture: a sunset over two hills, painted in bands.
    `<rect x="${x + 6}" y="${y + 6}" width="${width - 12}" height="${photoH}" fill="#f6b04f"/>` +
    `<rect x="${x + 6}" y="${y + 6}" width="${width - 12}" height="${photoH * 0.45}" fill="#e2733a"/>` +
    `<rect x="${x + 6}" y="${y + 6}" width="${width - 12}" height="${photoH * 0.2}" fill="#b8433a"/>` +
    `<circle cx="${x + width / 2 + 8}" cy="${y + photoH * 0.68}" r="11" fill="#ffe7a8"/>` +
    `<path d="M${x + 6} ${y + photoH + 6}V${y + photoH * 0.78}q20 -14 40 -2q16 -10 40 0V${y + photoH + 6}Z" fill="#7a3b4a"/>` +
    `<path d="M${x + 6} ${y + photoH + 6}V${y + photoH * 0.9}q26 -8 50 0q14 -5 30 2V${y + photoH + 6}Z" fill="#4c2a3c"/>` +
    `<path d="M${x + 4} ${y + photoH + 10}h${width - 8}" stroke="var(--den-chrome-dark)" stroke-width="2" stroke-dasharray="2 3"/>` +
    `<g data-ref="calendar-streak"></g>` +
    // The spaces between the date lines never render; they keep the words
    // apart for tools that read the calendar in order.
    `<text data-ref="calendar-month" x="${x + 7}" y="${y + photoH + 24}" fill="var(--den-trim)" font-family="var(--font-label)" font-weight="800" font-size="11" letter-spacing="0.6"></text> ` +
    `<text data-ref="calendar-day" x="${x + width - 7}" y="${y + photoH + 27}" text-anchor="end" fill="#b8433a" font-family="var(--font-display)" font-weight="700" font-size="19"></text> ` +
    `<g data-ref="calendar-grid"></g>` +
    ` ` +
    `<text data-ref="calendar-daily" x="${x + width / 2}" y="${y + height - 5}" text-anchor="middle" fill="var(--den-trim)" font-family="var(--font-hand)" font-size="10.5"></text>` +
    `</g>`
  );
}

/**
 * A slouched teardrop beanbag in mustard canvas. It is sewn from tall panels
 * that meet at a round cap on top, so the seams read like lines of longitude
 * bending round its belly; someone has sat in it, leaving a dent with creases
 * running out of it, and the fabric bunches where it meets the carpet.
 * Drawn in its own 290×182 box; the first one sits at LAYOUT.beanbag, and a
 * second, teal one arrives with ten Versus Night series.
 */
export function beanbag(
  rect: Rect = LAYOUT.beanbag,
  tone: { fill: string; dark: string } = MUSTARD,
): string {
  const { x, y, width } = rect;
  const scale = width / 290;
  const shape =
    'M14 170C-2 150 4 112 28 92C46 76 58 46 88 26C112 8 150 2 182 10C214 18 236 44 246 72' +
    'C262 96 292 124 286 154C282 172 262 180 238 180Q214 186 188 182Q150 187 112 183Q76 187 46 182Q26 180 14 170Z';
  // The round cap where the panels meet, tipped back a little; it sits just
  // under the crest of the bag, and is clipped to the bag so it never shows outside it.
  const cap = 'M120 19C130 9 172 7 184 16C172 25 132 27 120 19Z';
  // Panel seams from the cap down to the floor; the middle two disappear into the dent.
  const seams = [
    'M122 20C96 38 64 72 52 108C44 132 42 154 46 180',
    'M140 25C132 36 124 48 118 62',
    'M166 24C180 34 192 46 202 58',
    'M182 17C220 38 256 74 266 108C272 132 272 152 266 176',
    'M120 112C116 136 116 160 120 184',
    'M214 108C220 132 222 156 218 182',
  ];
  // Where somebody sat: a dent pushed into the front of the bag.
  const dent =
    'M78 90C92 66 136 52 182 54C218 56 244 70 252 92C238 110 196 118 150 116C114 114 88 106 78 90Z';
  const lip = 'M92 100C124 114 204 114 238 100';
  // Creases running out of the dent, each a shadow with a lit ridge beside it.
  const creases = [
    ['M96 98C88 112 76 122 62 128', 'M100 101C92 115 80 126 66 132'],
    ['M138 108C136 122 130 134 120 144', 'M142 109C141 124 135 137 125 147'],
    ['M196 108C202 120 206 132 204 146', 'M200 107C207 119 211 132 209 147'],
    ['M236 96C248 106 258 118 262 132', 'M239 100C250 110 259 122 263 136'],
  ];
  // Fabric bunching on the carpet.
  const floorFolds =
    'M28 166Q38 158 52 164M70 176Q84 166 98 174M176 178Q192 168 208 176M240 170Q254 162 268 166';
  const seamMarkup = seams
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${tone.dark}" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>` +
        `<path d="${d}" transform="translate(2 0)" fill="none" stroke="#fff" stroke-width="0.9" stroke-dasharray="2.4 2.6" stroke-linecap="round" opacity="0.35"/>`,
    )
    .join('');
  const creaseMarkup = creases
    .map(
      ([shadow, ridge]) =>
        `<path d="${shadow}" fill="none" stroke="${tone.dark}" stroke-width="3" stroke-linecap="round" opacity="0.4"/>` +
        `<path d="${ridge}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.2"/>`,
    )
    .join('');
  return (
    `<g class="beanbag" transform="translate(${x} ${y}) scale(${n(scale)})">` +
    `<ellipse cx="148" cy="178" rx="150" ry="13" fill="#000" opacity="0.32"/>` +
    `<path d="${shape}" fill="${tone.fill}"/>` +
    `<path d="${shape}" fill="url(#den-beanbag-shade)"/>` +
    `<g clip-path="url(#den-beanbag-clip)">` +
    seamMarkup +
    `<path d="${dent}" fill="url(#den-beanbag-dent)"/>` +
    `<path d="${lip}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.18"/>` +
    creaseMarkup +
    `<path d="${floorFolds}" fill="none" stroke="${tone.dark}" stroke-width="2.4" stroke-linecap="round" opacity="0.45"/>` +
    `<rect x="0" y="120" width="290" height="70" fill="url(#den-beanbag-floor)"/>` +
    `<path d="${cap}" fill="${tone.dark}" opacity="0.35"/>` +
    `<path d="${cap}" fill="none" stroke="#fff" stroke-width="0.9" stroke-dasharray="2.4 2.6" opacity="0.4"/>` +
    `</g>` +
    // A soft sheen where the window light rolls over the shoulder.
    `<path d="M70 52C88 30 120 16 152 14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.16"/>` +
    `<path d="M232 56C246 74 256 92 262 110" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.1"/>` +
    `</g>`
  );
}

function pothos(): string {
  const { x, y } = LAYOUT.pothos;
  const potTop = y + 18;
  const leaf = (lx: number, ly: number, angle: number, size = 1) =>
    `<path transform="translate(${n(lx)} ${n(ly)}) rotate(${n(angle)}) scale(${size})" d="M0 0C-7 -4 -9 -12 -4 -16C-1 -18 0 -16 0 -14C0 -16 1 -18 4 -16C9 -12 7 -4 0 0Z" fill="var(--den-leaf)" stroke="var(--den-leaf-dark)" stroke-width="0.8"/>`;
  let vines = '';
  let leaves = '';
  const vineStarts = [
    [x + 58, potTop + 12, 1],
    [x + 70, potTop + 8, 1.4],
  ] as const;
  vineStarts.forEach(([vx, vy, sway], v) => {
    let d = `M${vx} ${vy}`;
    let px = vx;
    let py = vy;
    for (let i = 0; i < 9; i++) {
      const nx = vx + 10 + Math.sin(i * 0.9 + v) * 6 * sway;
      const ny = py + 30 + v * 4;
      d += `Q${n(px + 12)} ${n((py + ny) / 2)} ${n(nx)} ${n(ny)}`;
      leaves += leaf(nx, ny, i % 2 === 0 ? -50 : 60, 0.9 + (i % 3) * 0.08);
      px = nx;
      py = ny;
    }
    vines += `<path d="${d}" fill="none" stroke="var(--den-leaf-dark)" stroke-width="1.6"/>`;
  });
  const crown = [
    [x + 24, potTop - 2, -40],
    [x + 34, potTop - 10, -10],
    [x + 46, potTop - 6, 20],
    [x + 56, potTop - 2, 50],
    [x + 16, potTop + 2, -70],
    [x + 40, potTop - 16, 5],
  ]
    .map(([lx, ly, a]) => leaf(lx ?? 0, ly ?? 0, a ?? 0, 1.25))
    .join('');
  return (
    `<g class="pothos">` +
    vines +
    leaves +
    `<path d="M${x + 6} ${potTop}h56l-6 38h-44Z" fill="var(--den-pot)"/>` +
    `<rect x="${x + 2}" y="${potTop - 4}" width="64" height="10" rx="2" fill="var(--den-pot)"/>` +
    `<rect x="${x + 2}" y="${potTop - 4}" width="64" height="3" rx="1.5" fill="#fff" opacity="0.18"/>` +
    crown +
    `</g>`
  );
}

/** A sunburst wall clock above the TV; den-view.ts sets the hands to the real time. */
export function wallClock(): string {
  const { x, y, width } = LAYOUT.clock;
  const cx = x + width / 2;
  const cy = y + width / 2;
  let rays = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const long = i % 2 === 0;
    const inner = 18;
    const outer = long ? width / 2 : width / 2 - 10;
    rays += `M${n(cx + Math.cos(a) * inner)} ${n(cy + Math.sin(a) * inner)}L${n(cx + Math.cos(a) * outer)} ${n(cy + Math.sin(a) * outer)}`;
  }
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ticks += `M${n(cx + Math.cos(a) * 13)} ${n(cy + Math.sin(a) * 13)}L${n(cx + Math.cos(a) * 15.5)} ${n(cy + Math.sin(a) * 15.5)}`;
  }
  return (
    `<g class="wall-clock" aria-hidden="true">` +
    `<path d="${rays}" stroke="#000" stroke-opacity="0.2" stroke-width="3" stroke-linecap="round" transform="translate(2 3)"/>` +
    `<path d="${rays}" stroke="var(--den-stitch)" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="19" fill="var(--den-calendar)" stroke="var(--den-stitch)" stroke-width="2.5"/>` +
    `<path d="${ticks}" stroke="var(--den-trim)" stroke-width="1.4" stroke-linecap="round"/>` +
    `<line data-ref="clock-hour" class="clock-hand" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 9}" stroke="var(--den-trim)" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line data-ref="clock-minute" class="clock-hand" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 14}" stroke="var(--den-trim)" stroke-width="1.6" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="1.8" fill="var(--den-pot)"/>` +
    `</g>`
  );
}

export function roomBack(): string {
  return wall() + carpet() + rug() + blinds() + door() + wallClock();
}

const MUSTARD = { fill: 'var(--den-beanbag)', dark: 'var(--den-beanbag-dark)' };
export const TEAL_BEANBAG = { fill: 'var(--den-beanbag-2)', dark: 'var(--den-beanbag-2-dark)' };

export function roomFront(): string {
  return beanbag();
}

export { pothos, roundedRectPath };
