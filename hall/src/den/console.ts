/**
 * The console on the stand's shelf: our own woodgrain-and-black wedge with a
 * chunky POWER lever, a RESET lever, two difficulty switches (Seat 1 and
 * Seat 2; prompt 01 turns them into the Pro switch), the cartridge in its slot
 * wearing the current game's label, and The Counter: two flip digits showing
 * the slot (01–32) above 32 lamps, the last two shaped differently because
 * they stand for the merged games' other cartridge versions.
 *
 * Moving parts are groups with data-ref attributes; den-view.ts animates them.
 */
import { COUNTER_SLOTS, isVersionPlace } from '../data/cycle.ts';
import { LAYOUT } from './geometry.ts';
import { LABEL_SIZE } from './label.ts';
import { n, roundedRectPath, woodgrainPath } from './svg.ts';

export function consoleDefs(): string {
  return `
    <linearGradient id="den-chrome" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--den-chrome-dark)"/>
      <stop offset="0.45" stop-color="var(--den-chrome)"/>
      <stop offset="1" stop-color="var(--den-chrome-dark)"/>
    </linearGradient>
    <radialGradient id="den-lever-knob" cx="0.35" cy="0.3" r="0.75">
      <stop offset="0" stop-color="#ff9a6b"/>
      <stop offset="0.55" stop-color="#d2551f"/>
      <stop offset="1" stop-color="#7c2a0c"/>
    </radialGradient>
    <radialGradient id="den-reset-knob" cx="0.35" cy="0.3" r="0.75">
      <stop offset="0" stop-color="#6a6560"/>
      <stop offset="1" stop-color="#14110f"/>
    </radialGradient>
    <linearGradient id="den-flap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2724"/>
      <stop offset="1" stop-color="#1a1715"/>
    </linearGradient>`;
}

function body(): string {
  const { console: c } = LAYOUT;
  const deckDepth = 30;
  const faceTop = c.y + deckDepth;
  const faceHeight = c.height - deckDepth;
  let ribs = '';
  const ribCount = Math.floor((c.width - 40) / 19);
  for (let i = 0; i <= ribCount; i++) ribs += `M${c.x + 24 + i * 19} ${c.y + 4}l-6 ${deckDepth - 6}`;
  return (
    `<g class="console">` +
    `<ellipse cx="${c.x + c.width / 2}" cy="${c.y + c.height + 1}" rx="${c.width / 2 + 6}" ry="6" fill="#000" opacity="0.5"/>` +
    // Deck: ribbed black top seen from above.
    `<path d="M${c.x + 18} ${c.y}H${c.x + c.width - 18}L${c.x + c.width} ${faceTop}H${c.x}Z" fill="var(--den-console-top)"/>` +
    `<path d="${ribs}" stroke="#000" stroke-opacity="0.45" stroke-width="2"/>` +
    `<path d="M${c.x + 18} ${c.y}H${c.x + c.width - 18}" stroke="#fff" stroke-opacity="0.1" stroke-width="2"/>` +
    // Front face: black with a woodgrain fascia and a chrome rule.
    `<rect x="${c.x}" y="${faceTop}" width="${c.width}" height="${faceHeight}" rx="4" fill="var(--den-console)"/>` +
    `<rect x="${c.x + 6}" y="${faceTop + 18}" width="${c.width - 12}" height="${faceHeight - 26}" rx="3" fill="var(--den-console-wood)"/>` +
    `<path d="${woodgrainPath(c.x + 6, faceTop + 18, c.width - 12, faceHeight - 26, { lines: 8, seed: 'console-fascia' })}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="1"/>` +
    `<rect x="${c.x}" y="${faceTop + 12}" width="${c.width}" height="3" fill="url(#den-chrome)"/>` +
    `<text x="${LAYOUT.powerLever.x + LAYOUT.powerLever.width / 2}" y="${faceTop + 10}" text-anchor="middle" fill="var(--den-chrome)" font-family="var(--font-label)" font-weight="800" font-size="8" letter-spacing="1.4">POWER</text>` +
    `<text x="${LAYOUT.resetLever.x + LAYOUT.resetLever.width / 2}" y="${faceTop + 10}" text-anchor="middle" fill="var(--den-chrome)" font-family="var(--font-label)" font-weight="800" font-size="8" letter-spacing="1.4">RESET</text>` +
    `<text x="${LAYOUT.switches.x + LAYOUT.switches.width / 2}" y="${faceTop + 10}" text-anchor="middle" fill="var(--den-chrome)" font-family="var(--font-label)" font-weight="800" font-size="7" letter-spacing="1">AM · PRO</text>` +
    `<text x="${c.x + c.width - 12}" y="${faceTop + 40}" text-anchor="end" fill="#f4e4c8" fill-opacity="0.75" font-family="var(--font-display)" font-style="italic" font-weight="700" font-size="11">Woodgrain '88</text>` +
    `</g>`
  );
}

/** A lever on the deck that rotates about its base. */
function lever(
  ref: string,
  area: { x: number; y: number; width: number; height: number },
  knobFill: string,
  knobR: number,
  label: string,
): string {
  const pivotX = area.x + area.width / 2;
  const pivotY = area.y + area.height - 6;
  return (
    `<g class="hotspot lever" data-ref="${ref}" tabindex="0" role="button" aria-label="${label}">` +
    // An unpainted hit area the size of the slot, so a press still lands while
    // the arm is swinging back.
    `<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" fill="transparent"/>` +
    `<rect x="${pivotX - 16}" y="${pivotY - 6}" width="32" height="12" rx="6" fill="#0b0908"/>` +
    `<g data-ref="${ref}-arm" class="lever-arm">` +
    `<rect x="${pivotX - 3.5}" y="${area.y + knobR}" width="7" height="${pivotY - area.y - knobR}" rx="3" fill="url(#den-chrome)"/>` +
    `<circle cx="${pivotX}" cy="${area.y + knobR}" r="${knobR + 1.5}" fill="#000" opacity="0.35"/>` +
    `<circle cx="${pivotX}" cy="${area.y + knobR - 1}" r="${knobR}" fill="${knobFill}"/>` +
    `<ellipse cx="${pivotX - knobR * 0.35}" cy="${area.y + knobR * 0.6}" rx="${knobR * 0.35}" ry="${knobR * 0.22}" fill="#fff" opacity="0.45"/>` +
    `</g>` +
    `<ellipse cx="${pivotX}" cy="${pivotY}" rx="9" ry="4" fill="url(#den-chrome)"/>` +
    `</g>`
  );
}

function switches(): string {
  const { switches: s } = LAYOUT;
  const one = (x: number, ref: string, label: string) =>
    `<g class="hotspot difficulty" data-ref="${ref}" tabindex="0" role="button" aria-label="Seat ${label} difficulty switch: the Pro switch arrives in the next update">` +
    `<rect x="${x}" y="${s.y}" width="22" height="${s.height}" rx="4" fill="#0b0908"/>` +
    `<rect class="difficulty-thumb" x="${x + 3}" y="${s.y + 3}" width="9" height="${s.height - 6}" rx="2" fill="url(#den-chrome)"/>` +
    `<text x="${x + 11}" y="${s.y - 4}" text-anchor="middle" fill="var(--den-chrome)" font-family="var(--font-label)" font-weight="800" font-size="7.5">${label}</text>` +
    `</g>`;
  return one(s.x, 'switch-1', '1') + one(s.x + 30, 'switch-2', '2');
}

function cartridgeSlot(): string {
  const { cartridgeSlot: slot } = LAYOUT;
  const labelWidth = slot.width - 14;
  const labelScale = labelWidth / LABEL_SIZE.width;
  return (
    `<g class="cartridge-in-slot">` +
    `<rect x="${slot.x - 6}" y="${slot.y + slot.height - 8}" width="${slot.width + 12}" height="12" rx="3" fill="#0b0908"/>` +
    `<path d="${roundedRectPath(slot.x, slot.y, slot.width, slot.height, 6)}" fill="#1c1917"/>` +
    `<path d="M${slot.x + 6} ${slot.y + slot.height - 10}h${slot.width - 12}" stroke="#000" stroke-width="5" opacity="0.5"/>` +
    `<g data-ref="console-label" transform="translate(${slot.x + 7} ${slot.y + 5}) scale(${n(labelScale)})"></g>` +
    `</g>`
  );
}

function flipDigit(index: number, x: number, y: number): string {
  const w = 30;
  const h = 44;
  return (
    `<g class="flip-digit" data-ref="counter-digit-${index}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#den-flap)"/>` +
    `<text class="flip-digit-text" x="${x + w / 2}" y="${y + h - 9.5}" text-anchor="middle" fill="#f4ead8" font-family="var(--font-label)" font-weight="800" font-size="33">0</text>` +
    `<g class="flip-flap">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h / 2}" rx="4" fill="url(#den-flap)"/>` +
    `<text class="flip-flap-text" x="${x + w / 2}" y="${y + h - 9.5}" text-anchor="middle" fill="#f4ead8" font-family="var(--font-label)" font-weight="800" font-size="33" clip-path="inset(0 0 50% 0)">0</text>` +
    `</g>` +
    `<rect x="${x}" y="${y + h / 2 - 0.8}" width="${w}" height="1.6" fill="#000" opacity="0.8"/>` +
    `<circle cx="${x + 1.5}" cy="${y + h / 2}" r="1.6" fill="var(--den-chrome-dark)"/>` +
    `<circle cx="${x + w - 1.5}" cy="${y + h / 2}" r="1.6" fill="var(--den-chrome-dark)"/>` +
    `</g>`
  );
}

function counter(): string {
  const { counter: c } = LAYOUT;
  const lampPitch = 6.1;
  const lampsLeft = c.x + (c.width - lampPitch * 15) / 2;
  let lamps = '';
  for (let slot = 1; slot <= COUNTER_SLOTS; slot++) {
    const row = slot <= 16 ? 0 : 1;
    const col = (slot - 1) % 16;
    const lx = lampsLeft + col * lampPitch;
    const ly = c.y + 94 + row * 9;
    lamps += isVersionPlace(slot)
      ? `<path class="lamp lamp--version" data-slot="${slot}" d="M${n(lx)} ${ly - 2.8}l2.8 2.8l-2.8 2.8l-2.8 -2.8Z"/>`
      : `<circle class="lamp" data-slot="${slot}" cx="${n(lx)}" cy="${ly}" r="2.2"/>`;
    // The lamps are tiny; an unpainted cell around each makes it easy to hover.
    lamps += `<rect class="lamp-hit" data-slot="${slot}" x="${n(lx - lampPitch / 2)}" y="${ly - 4.5}" width="${lampPitch}" height="9" fill="transparent"/>`;
  }
  const digitsLeft = c.x + (c.width - 64) / 2;
  const bodyHeight = c.height - 8;
  return (
    `<g class="counter">` +
    // A short cable back to the console: the Counter is an add-on.
    `<path d="M${c.x + 2} ${c.y + bodyHeight - 22}C${c.x - 10} ${c.y + bodyHeight - 22} ${c.x - 8} ${c.y + bodyHeight - 4} ${c.x - 18} ${c.y + bodyHeight - 6}" fill="none" stroke="#14110f" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="${c.x + c.width / 2}" cy="${c.y + c.height - 1}" rx="${c.width / 2 + 2}" ry="5" fill="#000" opacity="0.5"/>` +
    `<rect x="${c.x + 10}" y="${c.y + bodyHeight - 2}" width="12" height="8" rx="2" fill="var(--den-trim)"/>` +
    `<rect x="${c.x + c.width - 22}" y="${c.y + bodyHeight - 2}" width="12" height="8" rx="2" fill="var(--den-trim)"/>` +
    `<path d="${roundedRectPath(c.x, c.y, c.width, bodyHeight, 8)}" fill="var(--den-console-wood)"/>` +
    `<path d="${woodgrainPath(c.x, c.y, c.width, bodyHeight, { lines: 10, seed: 'counter' })}" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="1"/>` +
    `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="3" rx="1.5" fill="#fff" opacity="0.14"/>` +
    // Name plate.
    `<rect x="${c.x + c.width / 2 - 30}" y="${c.y + 7}" width="60" height="13" rx="2" fill="url(#den-chrome)"/>` +
    `<text x="${c.x + c.width / 2}" y="${c.y + 16.8}" text-anchor="middle" fill="var(--den-trim)" font-family="var(--font-label)" font-weight="800" font-size="8.5" letter-spacing="1.6">SLOT</text>` +
    // Flip-digit window.
    `<path d="${roundedRectPath(digitsLeft - 8, c.y + 26, 80, 56, 5)}" fill="#0f0d0c" stroke="url(#den-chrome)" stroke-width="2"/>` +
    flipDigit(0, digitsLeft, c.y + 32) +
    flipDigit(1, digitsLeft + 34, c.y + 32) +
    // The 32 lamps, 31 and 32 shaped for the other cartridge versions.
    `<rect x="${c.x + 6}" y="${c.y + 86}" width="${c.width - 12}" height="26" rx="4" fill="#0f0d0c"/>` +
    `<g data-ref="counter-lamps">${lamps}</g>` +
    `</g>`
  );
}

export function consoleAndCounter(): string {
  return (
    `<g aria-hidden="true">${body()}${cartridgeSlot()}</g>` +
    lever(
      'power',
      LAYOUT.powerLever,
      'url(#den-lever-knob)',
      11,
      'POWER lever: switch to the next game (P), or back (Shift+P)',
    ) +
    lever('reset', LAYOUT.resetLever, 'url(#den-reset-knob)', 8, 'RESET lever: restart what is on the TV') +
    switches() +
    `<g aria-hidden="true">${counter()}</g>`
  );
}
