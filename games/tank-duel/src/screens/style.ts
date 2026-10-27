/**
 * The look of every Tank Duel screen around the table: enamel tin plates with
 * rivets, a mustard band like the cartridge label's, stencil-spaced capitals,
 * Kid photos with handwritten captions. By day the plates are painted and lit
 * by the window; by night they glow from behind like a scoreboard under the
 * desk lamp. Screens build markup with these class names and call
 * `ensureScreenStyle` once; nothing here touches the document outside the
 * game's host.
 */

const STYLE = /* css */ `
.td-screens {
  --td-olive: #4d5a2b;
  --td-olive-deep: #36401c;
  --td-cream: #f4e9cc;
  --td-sand: #d9c296;
  --td-mustard: #f2a22c;
  --td-rust: #a8442a;
  --td-ink: #1f170f;
  --td-ink-soft: #4a3b2a;
  --td-plate: var(--td-olive);
  --td-plate-ink: var(--td-cream);
  --td-panel: rgba(244, 233, 204, 0.92);
  --td-panel-ink: var(--td-ink);
  --td-panel-edge: rgba(54, 64, 28, 0.55);
  --td-scrim: linear-gradient(90deg, rgba(24, 18, 10, 0.55), rgba(24, 18, 10, 0.12) 46%, transparent 70%);
  --td-glow: transparent;
  --td-focus: #fff6dc;
  --td-focus-ring: #1f170f;
  --td-team-0: #ff8a2a;
  --td-team-1: #38a8ff;
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  color: var(--td-panel-ink);
  font-family: 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
}
.td-screens[data-appearance='dark'] {
  --td-plate: #2b3317;
  --td-plate-ink: #fff3d6;
  --td-panel: rgba(18, 16, 12, 0.86);
  --td-panel-ink: #f4e9cc;
  --td-panel-edge: rgba(242, 162, 44, 0.35);
  --td-scrim: linear-gradient(90deg, rgba(4, 4, 8, 0.78), rgba(4, 4, 8, 0.3) 48%, transparent 72%);
  --td-glow: rgba(242, 162, 44, 0.32);
  --td-ink-soft: #cdbb98;
  --td-focus: #ffd27a;
  --td-focus-ring: #000000;
}
.td-screens[data-team-colours='colour-blind'] {
  --td-team-0: #ffb000;
  --td-team-1: #648fff;
}
.td-screens > * { pointer-events: auto; }
.td-screen {
  position: absolute;
  inset: 0;
  display: grid;
}
.td-screen[hidden] { display: none; }
.td-scrim { position: absolute; inset: 0; background: var(--td-scrim); pointer-events: none; }

/* ——— Display type ——— */
.td-display {
  font-family: 'Big Shoulders Display Variable', 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 0.95;
}
.td-hand { font-family: 'Patrick Hand', 'Comic Sans MS', cursive; }

/* ——— Enamel plate: the title, the score, the big buttons ——— */
.td-plate {
  position: relative;
  border-radius: 12px;
  color: var(--td-plate-ink);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent 42%),
    radial-gradient(140% 90% at 20% 0%, rgba(255, 255, 255, 0.12), transparent 60%),
    var(--td-plate);
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.28),
    inset 0 2px 0 rgba(255, 255, 255, 0.3),
    inset 0 0 0 2px rgba(0, 0, 0, 0.12),
    0 3px 0 rgba(0, 0, 0, 0.35),
    0 10px 22px rgba(0, 0, 0, 0.32);
}
.td-screens[data-appearance='dark'] .td-plate {
  background:
    radial-gradient(120% 140% at 50% 0%, rgba(255, 220, 160, 0.16), transparent 60%),
    var(--td-plate);
  box-shadow:
    inset 0 0 0 1px rgba(255, 236, 200, 0.2),
    0 0 26px var(--td-glow),
    0 6px 16px rgba(0, 0, 0, 0.6);
}
.td-rivets::before,
.td-rivets::after {
  content: '';
  position: absolute;
  top: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.75), rgba(0, 0, 0, 0.45));
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
}
.td-rivets::before { left: 10px; }
.td-rivets::after { right: 10px; }

/* ——— Buttons ——— */
.td-button {
  appearance: none;
  border: 0;
  margin: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  min-height: 44px;
  padding: 0.55em 1.2em;
  transition: transform 90ms ease-out, filter 90ms ease-out;
}
.td-button:hover { filter: brightness(1.08); }
.td-button:active { transform: translateY(2px); }
.td-button:focus-visible {
  outline: 3px solid var(--td-focus);
  outline-offset: 3px;
  box-shadow: 0 0 0 7px var(--td-focus-ring);
}
.td-button.td-plate { font-size: clamp(18px, 2.4vh, 26px); }
.td-button.is-primary {
  --td-plate: var(--td-mustard);
  --td-plate-ink: #22160a;
}
.td-screens[data-appearance='dark'] .td-button.is-primary {
  --td-plate: #d88a16;
  --td-glow: rgba(242, 162, 44, 0.55);
}
.td-key {
  display: inline-grid;
  place-items: center;
  min-width: 1.5em;
  height: 1.5em;
  padding: 0 0.3em;
  border-radius: 5px;
  border: 1px solid currentColor;
  font: 700 0.62em/1 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
  letter-spacing: 0;
  opacity: 0.8;
}
.td-link {
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
  font: 700 clamp(15px, 1.9vh, 19px)/1.2 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
  color: var(--td-panel-ink);
  padding: 0.5em 0.2em;
  min-height: 44px;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.25em;
  text-decoration-color: color-mix(in srgb, var(--td-mustard) 70%, transparent);
}
.td-link:focus-visible { outline: 3px solid var(--td-focus); outline-offset: 2px; border-radius: 4px; }

/* ——— Panels ——— */
.td-panel {
  background: var(--td-panel);
  color: var(--td-panel-ink);
  border: 1px solid var(--td-panel-edge);
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
}
.td-label {
  font: 700 clamp(12px, 1.45vh, 14px)/1.2 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--td-ink-soft);
}

/* ——— Two-way switch (scoring rule, settings) ——— */
.td-toggle {
  display: inline-grid;
  grid-auto-flow: column;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(31, 23, 15, 0.18);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}
.td-screens[data-appearance='dark'] .td-toggle { background: rgba(0, 0, 0, 0.45); }
.td-toggle button {
  appearance: none;
  border: 0;
  cursor: pointer;
  min-height: 40px;
  padding: 0 1em;
  border-radius: 999px;
  background: transparent;
  color: var(--td-panel-ink);
  font: 700 clamp(14px, 1.8vh, 17px)/1 'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif;
}
.td-toggle button[aria-checked='true'] {
  background: var(--td-olive);
  color: var(--td-cream);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 0 rgba(0, 0, 0, 0.35);
}
.td-screens[data-appearance='dark'] .td-toggle button[aria-checked='true'] {
  background: var(--td-mustard);
  color: #22160a;
}
.td-toggle button:focus-visible { outline: 3px solid var(--td-focus); outline-offset: 2px; }

/* ——— Kid photos ——— */
.td-photo {
  appearance: none;
  border: 0;
  cursor: pointer;
  display: grid;
  gap: 4px;
  width: clamp(92px, 9.4vw, 136px);
  padding: 7px 7px 10px;
  background: #fbf7ee;
  color: #2a2016;
  border-radius: 3px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12), 0 10px 18px rgba(0, 0, 0, 0.35);
  transform: rotate(var(--tilt, 0deg));
  transition: transform 160ms cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 160ms ease-out;
}
.td-photo svg { display: block; width: 100%; height: auto; border-radius: 1px; }
.td-photo .td-hand { font-size: clamp(17px, 2.1vh, 22px); line-height: 1; text-align: center; }
.td-photo[aria-checked='true'] {
  transform: translateY(-10px) rotate(0deg) scale(1.08);
  box-shadow: 0 0 0 3px var(--td-mustard), 0 18px 28px rgba(0, 0, 0, 0.45);
}
.td-photo:focus-visible { outline: 3px solid var(--td-focus); outline-offset: 4px; }
.td-screens[data-appearance='dark'] .td-photo { background: #efe6d3; filter: brightness(0.92); }
.td-screens[data-appearance='dark'] .td-photo[aria-checked='true'] {
  filter: none;
  box-shadow: 0 0 0 3px var(--td-mustard), 0 0 28px rgba(242, 162, 44, 0.45), 0 18px 28px rgba(0, 0, 0, 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .td-button, .td-photo { transition: none; }
}
`;

const STYLE_ID = 'td-screen-style';

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
