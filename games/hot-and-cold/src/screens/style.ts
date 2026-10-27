/**
 * The look of every Hot & Cold screen around the field: an explorer's field
 * notebook. Cards of cream paper edged with a thermometer band that runs from
 * ice blue to ember red, the title in tall display capitals, Kid photos with
 * handwritten captions. By day the cards are paper in the sun; by night they
 * are slate with the band glowing like a heater element. The screens look the
 * same over all three looks, so the chrome never fights the field. Screens
 * build markup with these class names and call `ensureScreenStyle` once.
 */
import { DISPLAY_FONT, LEGIBLE_FONT } from '../look/glyphs.ts';

const HAND_FONT = "'Patrick Hand', 'Comic Sans MS', cursive";

const STYLE = /* css */ `
.hc-screens {
  --hc-hot: #e0461a;
  --hc-hot-deep: #b8320c;
  --hc-warm: #ffb02e;
  --hc-cold: #2f8fe0;
  --hc-ice: #bfe3ff;
  --hc-ink: #1b2330;
  --hc-ink-soft: #566173;
  --hc-paper: rgba(251, 247, 236, 0.95);
  --hc-paper-edge: rgba(27, 35, 48, 0.16);
  --hc-well: rgba(27, 35, 48, 0.08);
  --hc-scrim: linear-gradient(90deg, rgba(10, 20, 36, 0.5), rgba(10, 20, 36, 0.12) 46%, transparent 70%);
  --hc-shadow: 0 18px 40px rgba(16, 28, 48, 0.26);
  --hc-glow: transparent;
  --hc-focus: #0b1a2e;
  --hc-focus-halo: #ffffff;
  --hc-seat-0: #ff8a2a;
  --hc-seat-1: #38a8ff;
  --hc-band: linear-gradient(90deg, #2f8fe0, #7cc6ff 30%, #ffd23f 62%, #ff8a2a 82%, #e0461a);
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  color: var(--hc-ink);
  font-family: ${LEGIBLE_FONT};
}
.hc-screens[data-appearance='dark'] {
  --hc-ink: #edf2fa;
  --hc-ink-soft: #a9b5c8;
  --hc-paper: rgba(16, 21, 32, 0.9);
  --hc-paper-edge: rgba(150, 190, 255, 0.22);
  --hc-well: rgba(0, 0, 0, 0.35);
  --hc-scrim: linear-gradient(90deg, rgba(2, 4, 10, 0.78), rgba(2, 4, 10, 0.3) 48%, transparent 72%);
  --hc-shadow: 0 18px 44px rgba(0, 0, 0, 0.6);
  --hc-glow: rgba(255, 120, 50, 0.4);
  --hc-focus: #ffd27a;
  --hc-focus-halo: #000000;
}
.hc-screens[data-seat-colours='colour-blind'] {
  --hc-seat-0: #ffb000;
  --hc-seat-1: #648fff;
}
.hc-screens > * { pointer-events: auto; }
.hc-screens [hidden] { display: none !important; }
.hc-screen { position: absolute; inset: 0; display: grid; }
.hc-screen[hidden] { display: none; }
.hc-scrim { position: absolute; inset: 0; background: var(--hc-scrim); pointer-events: none; }

/* ——— Type ——— */
.hc-display {
  font-family: ${DISPLAY_FONT};
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 0.95;
}
.hc-hand { font-family: ${HAND_FONT}; }
.hc-hidden-text {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.hc-label {
  font: 700 clamp(12px, 1.45vh, 14px)/1.2 ${LEGIBLE_FONT};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--hc-ink-soft);
}
.hc-wordmark { display: inline-flex; gap: 0.18em; align-items: baseline; }
.hc-wordmark .is-hot { color: var(--hc-hot); }
.hc-wordmark .is-cold { color: var(--hc-cold); }
.hc-screens[data-appearance='dark'] .hc-wordmark .is-hot {
  color: #ff7a45;
  text-shadow: 0 0 18px rgba(255, 110, 50, 0.55);
}
.hc-screens[data-appearance='dark'] .hc-wordmark .is-cold {
  color: #8fd0ff;
  text-shadow: 0 0 18px rgba(110, 190, 255, 0.5);
}

/* ——— Notebook card ——— */
.hc-card {
  position: relative;
  background: var(--hc-paper);
  color: var(--hc-ink);
  border: 1px solid var(--hc-paper-edge);
  border-radius: 12px;
  box-shadow: var(--hc-shadow);
  backdrop-filter: blur(6px);
  overflow: hidden;
}
.hc-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: var(--hc-band);
}
.hc-screens[data-appearance='dark'] .hc-card::before { box-shadow: 0 0 14px var(--hc-glow); }

/* ——— Buttons ——— */
.hc-button {
  appearance: none;
  border: 1px solid var(--hc-paper-edge);
  margin: 0;
  cursor: pointer;
  font: 700 clamp(15px, 1.9vh, 18px)/1.15 ${LEGIBLE_FONT};
  color: var(--hc-ink);
  background: var(--hc-paper);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  min-height: 44px;
  padding: 0.55em 1.2em;
  border-radius: 10px;
  box-shadow: 0 2px 0 var(--hc-paper-edge);
  transition: transform 90ms ease-out, filter 90ms ease-out;
}
.hc-button:hover { filter: brightness(1.06); }
.hc-button:active { transform: translateY(2px); }
.hc-button:focus-visible,
.hc-toggle button:focus-visible,
.hc-photo:focus-visible,
.hc-link:focus-visible {
  outline: 3px solid var(--hc-focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--hc-focus-halo);
}
.hc-button.is-primary {
  border-color: transparent;
  color: #ffffff;
  background: linear-gradient(180deg, #e9581f, var(--hc-hot-deep));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 3px 0 #8a2508, 0 10px 20px rgba(184, 50, 12, 0.3);
  font-family: ${DISPLAY_FONT};
  font-size: clamp(20px, 2.8vh, 30px);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.hc-screens[data-appearance='dark'] .hc-button.is-primary {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 3px 0 #5a1804, 0 0 26px rgba(255, 110, 40, 0.45);
}
.hc-button.is-cold {
  border-color: transparent;
  color: #ffffff;
  background: linear-gradient(180deg, #2f86d4, #1d63a8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 3px 0 #123f6c;
}
.hc-button[disabled] { cursor: not-allowed; opacity: 0.5; filter: none; transform: none; }
.hc-key {
  display: inline-grid;
  place-items: center;
  min-width: 1.6em;
  height: 1.6em;
  padding: 0 0.35em;
  border-radius: 5px;
  border: 1px solid currentColor;
  font: 700 0.62em/1 ${LEGIBLE_FONT};
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.85;
}
.hc-link {
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
  font: 700 clamp(15px, 1.9vh, 18px)/1.2 ${LEGIBLE_FONT};
  color: var(--hc-ink);
  padding: 0.5em 0.2em;
  min-height: 44px;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.25em;
  text-decoration-color: color-mix(in srgb, var(--hc-hot) 70%, transparent);
}

/* ——— Choice switch (clues, look, settings) ——— */
.hc-toggle {
  display: inline-grid;
  grid-auto-flow: column;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--hc-well);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.18);
}
.hc-toggle button {
  appearance: none;
  border: 0;
  cursor: pointer;
  min-height: 40px;
  padding: 0 1em;
  border-radius: 999px;
  background: transparent;
  color: var(--hc-ink);
  font: 700 clamp(14px, 1.75vh, 16px)/1 ${LEGIBLE_FONT};
  white-space: nowrap;
}
.hc-toggle button[aria-checked='true'] {
  background: var(--hc-ink);
  color: var(--hc-paper);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.hc-screens[data-appearance='dark'] .hc-toggle button[aria-checked='true'] {
  background: #ffd9a8;
  color: #1a1206;
}
.hc-toggle button[disabled] { cursor: not-allowed; opacity: 0.45; }
.hc-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.25em 0.7em;
  border-radius: 999px;
  font: 700 clamp(12px, 1.45vh, 14px)/1.2 ${LEGIBLE_FONT};
  background: var(--hc-well);
  color: var(--hc-ink);
}
.hc-badge.is-classic { background: color-mix(in srgb, var(--hc-cold) 22%, transparent); }
.hc-badge.is-notebook { background: color-mix(in srgb, var(--hc-warm) 30%, transparent); }

/* ——— Kid photos ——— */
.hc-photo {
  appearance: none;
  border: 0;
  cursor: pointer;
  display: grid;
  gap: 4px;
  width: clamp(80px, 8.4vw, 124px);
  padding: 7px 7px 10px;
  background: #fbf7ee;
  color: #2a2016;
  border-radius: 3px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12), 0 10px 18px rgba(0, 0, 0, 0.3);
  transform: rotate(var(--tilt, 0deg));
  transition: transform 160ms cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 160ms ease-out;
}
.hc-photo svg { display: block; width: 100%; height: auto; border-radius: 1px; }
.hc-photo .hc-hand { font-size: clamp(16px, 2vh, 21px); line-height: 1; text-align: center; }
.hc-photo[aria-checked='true'] {
  transform: translateY(-8px) rotate(0deg) scale(1.07);
  box-shadow: 0 0 0 3px var(--hc-hot), 0 18px 28px rgba(0, 0, 0, 0.4);
}
.hc-screens[data-appearance='dark'] .hc-photo { background: #efe6d3; filter: brightness(0.9); }
.hc-screens[data-appearance='dark'] .hc-photo[aria-checked='true'] {
  filter: none;
  box-shadow: 0 0 0 3px #ff7a45, 0 0 26px rgba(255, 110, 50, 0.45), 0 18px 28px rgba(0, 0, 0, 0.6);
}
.hc-swatch {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  border-radius: 50%;
  background: var(--seat);
  box-shadow: 0 0 0 2px var(--hc-paper), 0 0 0 3px var(--hc-paper-edge);
  vertical-align: -0.1em;
}

@media (prefers-reduced-motion: reduce) {
  .hc-button, .hc-photo { transition: none; }
}
`;

const STYLE_ID = 'hc-screen-style';

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

/** The title as the screens set it: HOT in ember, COLD in ice. */
export function wordmarkMarkup(): string {
  return (
    '<span class="hc-wordmark hc-display">' +
    '<span class="is-hot">Hot</span><span aria-hidden="true">&amp;</span>' +
    '<span class="hc-hidden-text"> and </span><span class="is-cold">Cold</span></span>'
  );
}
