/**
 * Light in the Den. By day, late sun falls through the high window's blinds
 * in warm shafts that land as stripes on the carpet. By night the room sinks
 * into a blue-brown dark, cut open by three lights: the television (tinted
 * with whatever is on screen, through the --tv-tint variable), the lamp's warm
 * pool, and a soft strip under each shelf that keeps every label readable.
 *
 * Both layers are always in the document; CSS cross-fades them when the
 * appearance changes, and --tv-power dims the TV's share during a power cycle.
 */
import { FLOOR_Y, LAYOUT, WALL } from './geometry.ts';
import { n } from './svg.ts';

const SHAFT_DIRECTION = { x: -0.62, y: 1 };

function screenCentre() {
  const { screen } = LAYOUT;
  return { x: screen.x + screen.width / 2, y: screen.y + screen.height / 2 };
}

function lampCentre() {
  const { lamp } = LAYOUT;
  return { x: lamp.x + lamp.width / 2, y: lamp.y + 40 };
}

export function lightingDefs(): string {
  const tv = screenCentre();
  const lampAt = lampCentre();
  return `
    <linearGradient id="den-shaft" x1="0.9" y1="0" x2="0.1" y2="1">
      <stop offset="0" stop-color="var(--den-sun)" stop-opacity="0.42"/>
      <stop offset="0.55" stop-color="var(--den-sun)" stop-opacity="0.16"/>
      <stop offset="1" stop-color="var(--den-sun)" stop-opacity="0.22"/>
    </linearGradient>
    <filter id="den-soft-light" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
    <filter id="den-soft-patch" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <radialGradient id="den-window-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="var(--den-sun)" stop-opacity="0.5"/>
      <stop offset="1" stop-color="var(--den-sun)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="den-tv-glow" cx="${tv.x}" cy="${tv.y}" r="560" gradientUnits="userSpaceOnUse" gradientTransform="translate(${tv.x} ${tv.y}) scale(1 0.78) translate(${-tv.x} ${-tv.y})">
      <stop offset="0" style="stop-color: var(--tv-tint); stop-opacity: 0.7"/>
      <stop offset="0.3" style="stop-color: var(--tv-tint); stop-opacity: 0.4"/>
      <stop offset="0.65" style="stop-color: var(--tv-tint); stop-opacity: 0.14"/>
      <stop offset="1" style="stop-color: var(--tv-tint); stop-opacity: 0"/>
    </radialGradient>
    <radialGradient id="den-lamp-pool" cx="${lampAt.x}" cy="${lampAt.y + 40}" r="320" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffc77a" stop-opacity="0.75"/>
      <stop offset="0.4" stop-color="#ff9f4a" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ff9f4a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="den-hole" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000" stop-opacity="1"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="den-strip-glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd696" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#ffd696" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="den-intro-pool" cx="${LAYOUT.console.x + 70}" cy="${LAYOUT.console.y + 20}" r="320" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <mask id="den-intro-mask" maskUnits="userSpaceOnUse" x="-3200" y="-2400" width="8000" height="5600">
      <rect x="-3200" y="-2400" width="8000" height="5600" fill="#fff"/>
      <rect x="-3200" y="-2400" width="8000" height="5600" fill="url(#den-intro-pool)"/>
    </mask>
    <mask id="den-night-mask" maskUnits="userSpaceOnUse" x="-3200" y="-2400" width="8000" height="5600">
      <rect x="-3200" y="-2400" width="8000" height="5600" fill="#fff"/>
      <g class="night-hole night-hole--tv"><ellipse cx="${tv.x}" cy="${tv.y + 60}" rx="430" ry="330" fill="url(#den-hole)"/></g>
      <ellipse cx="${lampAt.x}" cy="${lampAt.y + 60}" rx="230" ry="220" fill="url(#den-hole)" opacity="0.85"/>
      ${stripHoles()}
    </mask>`;
}

function stripHoles(): string {
  let holes = '';
  for (let row = 0; row < 4; row++) {
    const top = WALL.firstRowY + row * WALL.rowHeight;
    holes += `<rect x="${WALL.innerX}" y="${top}" width="${WALL.innerWidth}" height="${WALL.rowHeight - 6}" fill="#000" opacity="0.62"/>`;
  }
  return holes;
}

function shafts(): string {
  const { window: w } = LAYOUT;
  const bottom = FLOOR_Y + 210;
  const length = (bottom - (w.y + w.height)) / SHAFT_DIRECTION.y;
  const dx = SHAFT_DIRECTION.x * length;
  let polygons = '';
  let patches = '';
  const starts = [962, 1070, 1178, 1286, 1394, 1502];
  starts.forEach((x0, i) => {
    const width = 22 + (i % 3) * 5;
    const top = w.y + w.height;
    polygons += `<path d="M${x0} ${top}h${width}l${n(dx)} ${n(length)}h${-width * 1.7}Z" fill="url(#den-shaft)"/>`;
    // Where each shaft lands on the carpet: a warm stripe of late sun.
    const floorT = (FLOOR_Y + 40 - top) / SHAFT_DIRECTION.y;
    const fx = x0 + SHAFT_DIRECTION.x * floorT;
    patches += `<path d="M${n(fx)} ${FLOOR_Y + 40}h${n(width * 1.4)}l-60 170h${n(-width * 2)}Z" fill="var(--den-sun)"/>`;
  });
  return (
    `<g class="sun-shafts" filter="url(#den-soft-light)" style="mix-blend-mode: screen" opacity="0.7">${polygons}</g>` +
    `<g class="sun-patches" filter="url(#den-soft-patch)" style="mix-blend-mode: overlay" opacity="0.55">${patches}</g>`
  );
}

export function daylight(): string {
  const { window: w } = LAYOUT;
  return (
    `<g class="daylight" aria-hidden="true">` +
    `<ellipse cx="${w.x + w.width / 2}" cy="${w.y + w.height / 2}" rx="${w.width * 0.7}" ry="${w.height * 1.6}" fill="url(#den-window-glow)" style="mix-blend-mode: screen"/>` +
    shafts() +
    `<rect x="-3200" y="-2400" width="8000" height="5600" fill="#ffb066" opacity="0.07" style="mix-blend-mode: soft-light"/>` +
    `</g>`
  );
}

export function nightlight(): string {
  let strips = '';
  for (let row = 0; row < 4; row++) {
    const top = WALL.firstRowY + row * WALL.rowHeight;
    strips +=
      `<rect x="${WALL.innerX}" y="${top + 2}" width="${WALL.innerWidth}" height="2.5" fill="#ffe2b0" opacity="0.9"/>` +
      `<rect x="${WALL.innerX}" y="${top + 4}" width="${WALL.innerWidth}" height="70" fill="url(#den-strip-glow)"/>`;
  }
  return (
    `<g class="nightlight" aria-hidden="true">` +
    `<rect x="-3200" y="-2400" width="8000" height="5600" fill="#0b0714" opacity="0.66" mask="url(#den-night-mask)"/>` +
    `<g class="tv-light" style="mix-blend-mode: screen"><rect x="-3200" y="-2400" width="8000" height="5600" fill="url(#den-tv-glow)"/></g>` +
    `<g style="mix-blend-mode: screen"><rect x="-3200" y="-2400" width="8000" height="5600" fill="url(#den-lamp-pool)"/></g>` +
    `<g style="mix-blend-mode: screen">${strips}</g>` +
    `</g>`
  );
}

/** A full-room dimmer for the power-cycle dip (opacity driven from CSS). */
export function dimmer(): string {
  return `<rect class="room-dimmer" x="-3200" y="-2400" width="8000" height="5600" fill="#000" opacity="0" aria-hidden="true"/>`;
}
