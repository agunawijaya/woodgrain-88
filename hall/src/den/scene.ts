/**
 * Assembles The Den's SVG from its parts, back to front: room, jacket and
 * calendar, the Label Wall, the TV and stand, the console, the pads on the
 * rug, the beanbag and the cat, then the day and night light layers and, on top of
 * everything, one focus indicator so keyboard focus is visible even in the
 * dark.
 *
 * Interactive objects are focusable groups (role="button") in the Tab order
 * the prompt asks for: TV, console, wall row by row, calendar, jacket, pads.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import { cat, catDefs } from './cat.ts';
import { calendar, jacket, pothos, roomBack, roomDefs, roomFront } from './room.ts';
import { consoleAndCounter, consoleDefs } from './console.ts';
import { CORE, LAYOUT } from './geometry.ts';
import { daylight, dimmer, lightingDefs, nightlight } from './lighting.ts';
import { attrs, n, roundedRectPath } from './svg.ts';
import { lamp, stickyNote, tvAndStand, tvDefs } from './tv.ts';
import { introHandMarkup } from './intro.ts';
import { labelWall, wallDefs } from './wall.ts';

// The label names the button and carries any words printed on the drawing
// (the TV's badge, the calendar's date), so the drawing itself is hidden from
// screen readers rather than read twice.
function hotspot(ref: string, label: string, content: string, extra: Record<string, string> = {}): string {
  return `<g ${attrs({ class: `hotspot hotspot--${ref}`, 'data-ref': ref, tabindex: 0, role: 'button', 'aria-label': label, ...extra })}><g aria-hidden="true">${content}</g></g>`;
}

function joystick(cx: number, baseY: number, tilt: number): string {
  const w = 52;
  const top = baseY - 22;
  return (
    `<g class="joystick">` +
    `<ellipse cx="${cx}" cy="${baseY + 16}" rx="34" ry="8" fill="#000" opacity="0.35"/>` +
    `<path d="M${cx - w / 2 + 6} ${top}h${w - 12}l6 10v18a4 4 0 0 1 -4 4h${-(w - 4)}a4 4 0 0 1 -4 -4v-18Z" fill="var(--den-console)"/>` +
    `<path d="M${cx - w / 2 + 6} ${top}h${w - 12}l6 10h${-w}Z" fill="var(--den-console-top)"/>` +
    `<rect x="${cx - w / 2 + 3}" y="${top + 18}" width="${w - 6}" height="9" rx="2" fill="var(--den-console-wood)"/>` +
    `<circle cx="${cx + 16}" cy="${top + 5}" r="4.5" fill="#d2551f"/>` +
    `<g transform="rotate(${tilt} ${cx} ${top + 4})">` +
    `<rect x="${cx - 3.5}" y="${top - 40}" width="7" height="44" rx="3.5" fill="#1a1716"/>` +
    `<circle cx="${cx}" cy="${top - 42}" r="9" fill="url(#den-lever-knob)"/>` +
    `<ellipse cx="${cx - 3}" cy="${top - 46}" rx="3" ry="2" fill="#fff" opacity="0.4"/>` +
    `</g>` +
    `</g>`
  );
}

function pads(): string {
  const { pads: p } = LAYOUT;
  const left = { x: p.x + 50, y: p.y + 58 };
  const right = { x: p.x + p.width - 50, y: p.y + 70 };
  // Each cable leaves the back of its pad, slumps across the rug in a lazy S
  // and climbs over the stand's lip to the console, like a real coiled lead.
  const cable = (d: string) =>
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="5" stroke-linecap="round" transform="translate(1.5 3)"/>` +
    `<path d="${d}" fill="none" stroke="#1d1613" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#7a6354" stroke-width="1" stroke-linecap="round" opacity="0.55" transform="translate(-0.9 -1)"/>`;
  const leftCable = `M${left.x - 4} ${left.y - 18}C${left.x - 30} ${left.y - 4} ${left.x - 92} ${left.y - 2} ${left.x - 84} ${left.y - 36}S${left.x - 22} ${left.y - 62} ${left.x - 40} ${left.y - 88}S${left.x - 66} ${left.y - 116} ${left.x - 50} ${left.y - 128}`;
  const rightCable = `M${right.x + 2} ${right.y - 18}C${right.x + 16} ${right.y - 40} ${right.x - 34} ${right.y - 40} ${right.x - 26} ${right.y - 68}S${right.x + 14} ${right.y - 106} ${right.x - 8} ${right.y - 140}`;
  return cable(leftCable) + cable(rightCable) + joystick(left.x, left.y, -12) + joystick(right.x, right.y, 9);
}

function focusRingBox(): string {
  return `<path class="focus-indicator" data-ref="focus-indicator" d="" aria-hidden="true"/>`;
}

export function focusRingPath(box: { x: number; y: number; width: number; height: number }): string {
  const pad = 7;
  return roundedRectPath(n(box.x - pad), n(box.y - pad), n(box.width + pad * 2), n(box.height + pad * 2), 10);
}

export function denSceneMarkup(manifests: readonly GameManifest[]): string {
  return (
    `<svg class="den-scene" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CORE.width} ${CORE.height}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="The Den">` +
    `<defs>${roomDefs()}${catDefs()}${tvDefs()}${consoleDefs()}${wallDefs()}${lightingDefs()}</defs>` +
    `<g class="layer-room" aria-hidden="true">${roomBack()}</g>` +
    hotspot('tv', 'The Woodgrain TV', tvAndStand()) +
    `<g aria-hidden="true">${lamp()}</g>` +
    `<g class="layer-console">${consoleAndCounter()}</g>` +
    stickyNote() +
    `<g class="layer-wall" data-ref="wall">${labelWall(manifests)}</g>` +
    `<g aria-hidden="true">${pothos()}</g>` +
    hotspot('calendar', "Calendar: today's Power Cycle", calendar()) +
    hotspot('jacket', 'Denim jacket: your profile', jacket()) +
    hotspot('pads', 'Two pads: Versus Night, coming in the next update', pads()) +
    `<g aria-hidden="true">${roomFront()}</g>` +
    cat() +
    daylight() +
    nightlight() +
    dimmer() +
    `<rect class="intro-dark" x="-3200" y="-2400" width="8000" height="5600" fill="#07040b" mask="url(#den-intro-mask)" aria-hidden="true"/>` +
    introHandMarkup() +
    focusRingBox() +
    `</svg>`
  );
}
