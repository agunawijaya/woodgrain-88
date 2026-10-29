/**
 * Visual styling and shared CSS for Trailblaze screens and overlays:
 * day and night palettes, seat-tinted top edges, display wordmark,
 * Kid polaroids, and focus management.
 */

export const DISPLAY_FONT = '"Big Shoulders Display Variable", "Arial Narrow", sans-serif';
export const LEGIBLE_FONT = '"Atkinson Hyperlegible Next Variable", Verdana, sans-serif';

const STYLE = /* css */ `
.tb-screens {
  --tb-seat-0: #ff8a2a;
  --tb-seat-0-deep: #b4501b;
  --tb-seat-1: #38a8ff;
  --tb-seat-1-deep: #1d68ad;
  --tb-seat-2: #2ec4b6;
  --tb-seat-2-deep: #0f8b8d;
  --tb-seat-3: #ff5964;
  --tb-seat-3-deep: #d62246;

  --tb-font-display: ${DISPLAY_FONT};
  --tb-font-legible: ${LEGIBLE_FONT};

  /* Day appearance defaults */
  --tb-panel-bg: rgba(250, 246, 238, 0.92);
  --tb-text: #1b2a41;
  --tb-muted: #4a5a72;
  --tb-border: rgba(27, 42, 65, 0.16);
  --tb-edge: linear-gradient(90deg, var(--tb-seat-0-deep), var(--tb-seat-1-deep));
  --tb-shadow: 0 16px 36px rgba(27, 42, 65, 0.18);
  --tb-focus: #0b1a2e;
  --tb-focus-halo: #ffffff;
  --tb-scrim: linear-gradient(90deg, rgba(250, 246, 238, 0.85), rgba(250, 246, 238, 0.3) 48%, transparent 75%);
  --tb-well: rgba(27, 42, 65, 0.08);

  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  color: var(--tb-text);
  font-family: ${LEGIBLE_FONT};
}

.tb-screens[data-appearance='dark'] {
  /* Night appearance */
  --tb-panel-bg: rgba(12, 18, 32, 0.88);
  --tb-text: #eef2f8;
  --tb-muted: #9fb0c8;
  --tb-border: rgba(159, 176, 200, 0.2);
  --tb-edge: linear-gradient(90deg, var(--tb-seat-0), var(--tb-seat-1));
  --tb-shadow: 0 18px 44px rgba(0, 0, 0, 0.65);
  --tb-focus: #64b5f6;
  --tb-focus-halo: #000000;
  --tb-scrim: linear-gradient(90deg, rgba(8, 12, 22, 0.9), rgba(8, 12, 22, 0.4) 48%, transparent 75%);
  --tb-well: rgba(0, 0, 0, 0.35);
}

.tb-screens[data-palette='colour-blind'] {
  --tb-seat-0: #ffb000;
  --tb-seat-0-deep: #a66f00;
  --tb-seat-1: #648fff;
  --tb-seat-1-deep: #3555b0;
}

.tb-screens > * { pointer-events: auto; }
.tb-screens [hidden] { display: none !important; }
.tb-screen { position: absolute; inset: 0; display: grid; }
.tb-screen[hidden] { display: none; }
.tb-scrim { position: absolute; inset: 0; background: var(--tb-scrim); pointer-events: none; }

/* ——— Type ——— */
.tb-display {
  font-family: ${DISPLAY_FONT};
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 0.95;
}

.tb-hidden-text {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.tb-label {
  font: 700 clamp(11px, 1.4vh, 13px)/1.2 ${LEGIBLE_FONT};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tb-muted);
}

.tb-wordmark {
  display: inline-grid;
  gap: 4px;
  align-items: start;
}

.tb-wordmark-title {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(38px, 6.5vh, 76px);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 0.9;
  color: var(--tb-text);
}

.tb-wordmark-trail {
  display: block;
  width: 110px;
  height: 12px;
}

/* ——— Panel card ——— */
.tb-card {
  position: relative;
  background: var(--tb-panel-bg);
  color: var(--tb-text);
  border: 1px solid var(--tb-border);
  border-radius: 10px;
  box-shadow: var(--tb-shadow);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.tb-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: var(--tb-edge);
}

/* ——— Buttons ——— */
.tb-button {
  appearance: none;
  border: 1px solid var(--tb-border);
  margin: 0;
  cursor: pointer;
  font: 700 clamp(14px, 1.8vh, 17px)/1.15 ${LEGIBLE_FONT};
  color: var(--tb-text);
  background: var(--tb-panel-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  min-height: 42px;
  padding: 0.5em 1.1em;
  border-radius: 8px;
  box-shadow: 0 2px 0 var(--tb-border);
  transition: transform 90ms ease-out, filter 90ms ease-out;
}

.tb-button:hover { filter: brightness(1.06); }
.tb-button:active { transform: translateY(2px); }

.tb-button:focus-visible,
.tb-toggle button:focus-visible,
.tb-photo:focus-visible,
.tb-link:focus-visible {
  outline: 3px solid var(--tb-focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--tb-focus-halo);
}

/* Selected and primary buttons use the right rider's colour (seat 1), never a third accent */
.tb-button.is-primary {
  border-color: transparent;
  color: #ffffff;
  background: var(--tb-seat-1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 3px 0 var(--tb-seat-1-deep);
  font-family: ${DISPLAY_FONT};
  font-size: clamp(19px, 2.6vh, 26px);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tb-screens[data-appearance='dark'] .tb-button.is-primary {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 3px 0 #0f4068, 0 0 22px rgba(56, 168, 255, 0.35);
}

.tb-button[disabled] {
  cursor: not-allowed;
  opacity: 0.45;
  filter: none;
  transform: none;
}

.tb-key {
  display: inline-grid;
  place-items: center;
  min-width: 1.6em;
  height: 1.6em;
  padding: 0 0.35em;
  border-radius: 4px;
  border: 1px solid currentColor;
  font: 700 0.65em/1 ${LEGIBLE_FONT};
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.85;
}

.tb-link {
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
  font: 700 clamp(14px, 1.8vh, 16px)/1.2 ${LEGIBLE_FONT};
  color: var(--tb-text);
  padding: 0.4em 0.2em;
  min-height: 40px;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.25em;
  text-decoration-color: var(--tb-seat-1);
}

/* ——— Radio / Toggle switch ——— */
.tb-toggle {
  display: inline-grid;
  grid-auto-flow: column;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: var(--tb-well);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.16);
}

.tb-toggle button {
  appearance: none;
  border: 0;
  cursor: pointer;
  min-height: 36px;
  padding: 0 0.9em;
  border-radius: 999px;
  background: transparent;
  color: var(--tb-text);
  font: 700 clamp(13px, 1.6vh, 15px)/1 ${LEGIBLE_FONT};
  white-space: nowrap;
}

.tb-toggle button[aria-checked='true'] {
  background: var(--tb-seat-1);
  color: #ffffff;
  box-shadow: 0 2px 0 var(--tb-seat-1-deep);
}

.tb-screens[data-appearance='dark'] .tb-toggle button[aria-checked='true'] {
  background: var(--tb-seat-1);
  color: #06101e;
}

.tb-toggle button[disabled] {
  cursor: not-allowed;
  opacity: 0.45;
}

/* ——— Kid & Computer polaroids ——— */
.tb-photo {
  appearance: none;
  border: 0;
  cursor: pointer;
  display: grid;
  gap: 4px;
  flex: 1 1 0;
  max-width: 120px;
  min-width: 64px;
  box-sizing: border-box;
  padding: 6px 6px 9px;
  background: #fbf7ee;
  color: #1b2a41;
  border-radius: 3px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.26);
  transform: rotate(var(--tilt, 0deg));
  transition: transform 140ms cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 140ms ease-out;
}

.tb-photo svg { display: block; width: 100%; height: auto; border-radius: 1px; }
.tb-photo .tb-hand {
  font: 700 clamp(11px, 1.4vh, 14px)/1.15 ${LEGIBLE_FONT};
  text-align: center;
  white-space: normal;
  overflow-wrap: normal;
  word-break: normal;
}

.tb-photo[data-opponent='lou'] .tb-hand,
.tb-photo[data-opponent='computer'] .tb-hand {
  font-size: clamp(9.5px, 1.2vh, 12px);
  line-height: 1.1;
}

.tb-photo[aria-checked='true'] {
  transform: translateY(-6px) rotate(0deg) scale(1.06);
  box-shadow: 0 0 0 3px var(--tb-seat-1), 0 16px 26px rgba(0, 0, 0, 0.4);
}

.tb-screens[data-appearance='dark'] .tb-photo {
  background: #ede6d6;
  filter: brightness(0.92);
}

.tb-screens[data-appearance='dark'] .tb-photo[aria-checked='true'] {
  filter: none;
  box-shadow: 0 0 0 3px var(--tb-seat-1), 0 0 20px rgba(56, 168, 255, 0.4), 0 16px 26px rgba(0, 0, 0, 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .tb-button, .tb-photo { transition: none; }
}
`;

const STYLE_ID = 'tb-screen-style';

/** Adds the screens' stylesheet inside `host` once. */
export function ensureScreenStyle(host: HTMLElement): void {
  if (host.querySelector(`#${STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  host.prepend(style);
}

/** Escapes text for markup built with template strings. */
export function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * The wordmark "TRAILBLAZE" in the collection's display face, with two trails,
 * orange and blue, each making one right-angle turn, stopping a cell apart.
 */
export function wordmarkMarkup(): string {
  return (
    '<div class="tb-wordmark">' +
    '<span class="tb-wordmark-title">TRAILBLAZE</span>' +
    '<svg class="tb-wordmark-trail" viewBox="0 0 110 12" width="110" height="12" aria-hidden="true">' +
    '<path d="M 2 2 L 48 2 L 48 10" fill="none" stroke="var(--tb-seat-0)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M 108 10 L 62 10 L 62 2" fill="none" stroke="var(--tb-seat-1)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
    '</div>'
  );
}

/**
 * Computer 1977 portrait: a plain beige box with a dark slot and one red lamp,
 * no logos, no console shapes.
 */
export function computerPortraitSvg(): string {
  return (
    '<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg" aria-label="Computer 1977">' +
    '<rect width="100" height="100" fill="#44392b" rx="2"/>' +
    '<rect x="8" y="10" width="84" height="80" rx="3" fill="#d9ceb6" stroke="#b4a78a" stroke-width="2"/>' +
    '<rect x="18" y="24" width="64" height="14" rx="2" fill="#1b1c20"/>' +
    '<rect x="22" y="29" width="56" height="4" fill="#0d0e10"/>' +
    '<circle cx="30" cy="58" r="5" fill="#e53935"/>' +
    '<circle cx="28.5" cy="56.5" r="1.5" fill="#ff8a80"/>' +
    '<line x1="42" y1="58" x2="80" y2="58" stroke="#a0947a" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="42" y1="64" x2="72" y2="64" stroke="#a0947a" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>'
  );
}
