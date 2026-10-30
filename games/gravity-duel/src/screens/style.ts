/**
 * Shared styling for Gravity Duel's screens: the accent colours (day
 * `#6a4fa0`, night `#c3a9ff`, from the Hall's placeholder), AA-checked text
 * on both appearances, cards, buttons and toggles every screen reuses.
 */

export const DISPLAY_FONT = '"Big Shoulders Display Variable", "Arial Narrow", sans-serif';
export const LEGIBLE_FONT = '"Atkinson Hyperlegible Next Variable", Verdana, sans-serif';

const STYLE = /* css */ `
.gd-screens {
  --gd-accent: #6a4fa0;
  --gd-seat-0: #ff8a2a;
  --gd-seat-0-deep: #b4501b;
  --gd-seat-1: #38a8ff;
  --gd-seat-1-deep: #1d68ad;

  --gd-panel-bg: rgba(250, 246, 238, 0.92);
  --gd-text: #1b1430;
  --gd-muted: #4a4360;
  --gd-border: rgba(27, 20, 48, 0.16);
  --gd-shadow: 0 16px 36px rgba(27, 20, 48, 0.18);
  --gd-focus: #2c1f52;
  --gd-focus-halo: #ffffff;
  --gd-well: rgba(27, 20, 48, 0.08);
  /* The results panel's fade over the frozen field behind it. */
  --gd-scrim: linear-gradient(90deg, rgba(250, 246, 238, 0.85), rgba(250, 246, 238, 0.3) 48%, transparent 75%);

  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  color: var(--gd-text);
  font-family: ${LEGIBLE_FONT};
}

.gd-screens[data-appearance='dark'] {
  --gd-accent: #c3a9ff;
  --gd-panel-bg: rgba(16, 12, 28, 0.88);
  --gd-text: #f1ecff;
  --gd-muted: #b8aed6;
  --gd-border: rgba(195, 169, 255, 0.22);
  --gd-shadow: 0 18px 44px rgba(0, 0, 0, 0.65);
  --gd-focus: #c3a9ff;
  --gd-focus-halo: #000000;
  --gd-well: rgba(0, 0, 0, 0.35);
  --gd-scrim: linear-gradient(90deg, rgba(16, 12, 28, 0.9), rgba(16, 12, 28, 0.4) 48%, transparent 75%);
}

.gd-screens[data-palette='colour-blind'] {
  --gd-seat-0: #ffb000;
  --gd-seat-0-deep: #a66f00;
  --gd-seat-1: #648fff;
  --gd-seat-1-deep: #3555b0;
}

.gd-screens > * { pointer-events: auto; }
.gd-screens [hidden] { display: none !important; }
.gd-screen { position: absolute; inset: 0; display: grid; }
.gd-screen[hidden] { display: none; }
.gd-scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.35); pointer-events: none; }

.gd-display {
  font-family: ${DISPLAY_FONT};
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 0.95;
}

.gd-hidden-text {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.gd-label {
  font: 700 clamp(11px, 1.4vh, 13px)/1.2 ${LEGIBLE_FONT};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gd-muted);
}

.gd-card {
  position: relative;
  background: var(--gd-panel-bg);
  color: var(--gd-text);
  border: 1px solid var(--gd-border);
  border-radius: 10px;
  box-shadow: var(--gd-shadow);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.gd-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: var(--gd-accent);
}

.gd-button {
  appearance: none;
  border: 1px solid var(--gd-border);
  margin: 0;
  cursor: pointer;
  font: 700 clamp(14px, 1.8vh, 17px)/1.15 ${LEGIBLE_FONT};
  color: var(--gd-text);
  background: var(--gd-panel-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  min-height: 42px;
  padding: 0.5em 1.1em;
  border-radius: 8px;
  box-shadow: 0 2px 0 var(--gd-border);
  transition: transform 90ms ease-out, filter 90ms ease-out;
}

.gd-button:hover { filter: brightness(1.08); }
.gd-button:active { transform: translateY(2px); }

.gd-button:focus-visible,
.gd-toggle button:focus-visible,
.gd-photo:focus-visible,
.gd-link:focus-visible {
  outline: 3px solid var(--gd-focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--gd-focus-halo);
}

.gd-button.is-primary {
  border-color: transparent;
  color: #ffffff;
  background: var(--gd-accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 3px 0 #4c3878;
  font-family: ${DISPLAY_FONT};
  font-size: clamp(19px, 2.6vh, 26px);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.gd-screens[data-appearance='dark'] .gd-button.is-primary {
  color: #1a1030;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 3px 0 #8a71c4, 0 0 22px rgba(195, 169, 255, 0.35);
}

.gd-button[disabled] {
  cursor: not-allowed;
  opacity: 0.45;
  filter: none;
  transform: none;
}

.gd-key {
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

.gd-link {
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
  font: 700 clamp(14px, 1.8vh, 16px)/1.2 ${LEGIBLE_FONT};
  color: var(--gd-text);
  padding: 0.4em 0.2em;
  min-height: 40px;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.25em;
  text-decoration-color: var(--gd-accent);
}

.gd-toggle {
  display: inline-grid;
  grid-auto-flow: column;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: var(--gd-well);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.16);
}

.gd-toggle button {
  appearance: none;
  border: 0;
  cursor: pointer;
  min-height: 36px;
  padding: 0 0.9em;
  border-radius: 999px;
  background: transparent;
  color: var(--gd-text);
  font: 700 clamp(13px, 1.6vh, 15px)/1 ${LEGIBLE_FONT};
  white-space: nowrap;
}

.gd-toggle button[aria-checked='true'] {
  background: var(--gd-accent);
  color: #ffffff;
  box-shadow: 0 2px 0 #4c3878;
}

.gd-screens[data-appearance='dark'] .gd-toggle button[aria-checked='true'] {
  color: #1a1030;
}

.gd-toggle button[disabled] {
  cursor: not-allowed;
  opacity: 0.45;
}

.gd-photo {
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
  color: #1b1430;
  border-radius: 3px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.26);
}

.gd-photo svg { display: block; width: 100%; height: auto; border-radius: 1px; }
.gd-photo .gd-style-line {
  font: 700 clamp(10px, 1.3vh, 12px)/1.2 ${LEGIBLE_FONT};
  text-align: center;
}

.gd-photo[aria-checked='true'] {
  box-shadow: 0 0 0 3px var(--gd-accent), 0 16px 26px rgba(0, 0, 0, 0.4);
}

.gd-screens[data-appearance='dark'] .gd-photo {
  background: #ede6d6;
  filter: brightness(0.92);
}

.gd-wordmark {
  display: inline-grid;
  gap: 4px;
  align-items: start;
}

.gd-wordmark-title {
  font-family: ${DISPLAY_FONT};
  font-size: clamp(32px, 5.4vh, 60px);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 0.9;
  color: var(--gd-text);
}

.gd-wordmark-strokes {
  display: block;
  width: 90px;
  height: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .gd-button, .gd-photo { transition: none; }
}
`;

const STYLE_ID = 'gd-screen-style';

/** Adds the screens' stylesheet inside `host` once. */
export function ensureScreenStyle(host: HTMLElement): void {
  if (host.querySelector(`#${STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  host.prepend(style);
}

/**
 * The wordmark "GRAVITY DUEL" in the collection's display face, with two
 * short strokes under it, orange then blue, the two ships' own colours.
 */
export function wordmarkMarkup(): string {
  return (
    '<div class="gd-wordmark">' +
    '<span class="gd-wordmark-title">GRAVITY DUEL</span>' +
    '<svg class="gd-wordmark-strokes" viewBox="0 0 90 8" width="90" height="8" aria-hidden="true">' +
    '<line x1="2" y1="4" x2="40" y2="4" stroke="var(--gd-seat-0)" stroke-width="3" stroke-linecap="round"/>' +
    '<line x1="50" y1="4" x2="88" y2="4" stroke="var(--gd-seat-1)" stroke-width="3" stroke-linecap="round"/>' +
    '</svg>' +
    '</div>'
  );
}

/** Escapes text for markup built with template strings. */
export function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
