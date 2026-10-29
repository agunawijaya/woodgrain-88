/**
 * Settings sheet for Trailblaze: arena look (four swatches), match length (10 / 5),
 * camera view (overhead / chase), colour-blind rider palette, reduced effects,
 * and a speed-up preview animating the five pace stages.
 */
import type { TrailblazeSettings, TrailblazeSettingsStore } from '../app/settings.ts';
import type { LookId } from '../look/look.ts';
import { createSheet } from './sheet.ts';
import { LEGIBLE_FONT } from './style.ts';

export interface SettingsSheetOptions {
  readonly host: HTMLElement;
  readonly settings: TrailblazeSettingsStore;
  readonly onAllSettings?: () => void;
  readonly onClose: () => void;
}

const LOOK_SWATCHES: Readonly<
  Record<LookId, { name: string; bg: string; s0: string; s1: string }>
> = {
  neon: { name: 'Neon Grid', bg: '#060b14', s0: '#ff8a2a', s1: '#38a8ff' },
  trains: { name: 'Toy Trains', bg: '#233320', s0: '#d87a2a', s1: '#3c8cd8' },
  mummy: { name: "Mummy's Wrap", bg: '#dfd4be', s0: '#c06820', s1: '#2878b8' },
  ice: { name: 'Ice Trail', bg: '#dceaf5', s0: '#e67828', s1: '#207cd4' },
};

const STYLE = /* css */ `
.tb-settings-list {
  display: grid;
  gap: 16px;
  font-family: ${LEGIBLE_FONT};
}

.tb-settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--tb-border);
}

.tb-settings-info {
  display: grid;
  gap: 4px;
  flex: 1;
  min-width: 200px;
}

.tb-settings-label {
  font-weight: 700;
  font-size: clamp(14px, 1.8vh, 16px);
  color: var(--tb-text);
}

.tb-settings-note {
  margin: 0;
  font-size: clamp(12px, 1.5vh, 14px);
  color: var(--tb-muted);
  line-height: 1.35;
}

/* Speed-up preview */
.tb-speedup-preview {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 12px;
  background: var(--tb-well);
  border-radius: 6px;
}

.tb-preview-bar {
  width: 12px;
  border-radius: 2px;
  background: var(--tb-border);
  transition: background 80ms ease, box-shadow 80ms ease;
}

.tb-preview-bar:nth-child(1) { height: 12px; }
.tb-preview-bar:nth-child(2) { height: 18px; }
.tb-preview-bar:nth-child(3) { height: 24px; }
.tb-preview-bar:nth-child(4) { height: 30px; }
.tb-preview-bar:nth-child(5) { height: 36px; }

.tb-preview-bar.is-lit {
  background: var(--tb-seat-1);
  box-shadow: 0 0 8px rgba(56, 168, 255, 0.7);
}

.tb-swatch-opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tb-swatch-box {
  width: 22px;
  height: 14px;
  border-radius: 2px;
  display: inline-block;
  vertical-align: middle;
}

.tb-settings-footer {
  padding-top: 4px;
  display: flex;
  justify-content: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .tb-preview-bar {
    background: var(--tb-seat-1) !important;
    box-shadow: none !important;
    transition: none !important;
  }
}
`;

function swatchSvg(lookId: LookId): string {
  const { bg, s0, s1 } = LOOK_SWATCHES[lookId];
  return (
    `<svg class="tb-swatch-box" viewBox="0 0 22 14" aria-hidden="true">` +
    `<rect width="22" height="14" fill="${bg}" rx="1"/>` +
    `<line x1="2" y1="4" x2="10" y2="4" stroke="${s0}" stroke-width="2"/>` +
    `<line x1="20" y1="10" x2="12" y2="10" stroke="${s1}" stroke-width="2"/>` +
    `</svg>`
  );
}

export function createSettingsSheet(options: SettingsSheetOptions): { dispose(): void } {
  const sheet = createSheet({
    host: options.host,
    title: 'Settings',
    onClose: options.onClose,
  });

  const style = document.createElement('style');
  style.textContent = STYLE;
  sheet.body.prepend(style);

  const container = document.createElement('div');
  container.className = 'tb-settings-list';

  let currentSettings = options.settings.get();
  let animationTimer: ReturnType<typeof setTimeout> | null = null;
  let activePreviewBar = 0;

  // Pace intervals in ms: 15, 12, 9, 6, 3 ticks of 20ms = 300, 240, 180, 120, 60ms
  const PACES_MS = [300, 240, 180, 120, 60];

  function schedulePreviewStep(): void {
    if (animationTimer !== null) clearTimeout(animationTimer);
    const delay = PACES_MS[activePreviewBar] ?? 200;
    animationTimer = setTimeout(() => {
      activePreviewBar = (activePreviewBar + 1) % PACES_MS.length;
      updatePreviewBars();
      schedulePreviewStep();
    }, delay);
  }

  function updatePreviewBars(): void {
    const bars = container.querySelectorAll<HTMLElement>('.tb-preview-bar');
    bars.forEach((bar, idx) => {
      bar.classList.toggle('is-lit', idx === activePreviewBar);
    });
  }

  function render(): void {
    container.innerHTML =
      // 1. Look
      `<div class="tb-settings-row">` +
      `<div class="tb-settings-info">` +
      `<span class="tb-settings-label" id="tb-set-look">Look</span>` +
      `<p class="tb-settings-note">Changes only the picture: the rules, 40×20 grid and step timing stay the same.</p>` +
      `</div>` +
      `<div class="tb-toggle" role="radiogroup" aria-labelledby="tb-set-look" data-field="look">` +
      (['neon', 'trains', 'mummy', 'ice'] as const)
        .map(
          (l) =>
            `<button type="button" role="radio" data-field="look" data-val="${l}" aria-checked="${String(currentSettings.look === l)}">` +
            `<span class="tb-swatch-opt">${swatchSvg(l)}<span>${LOOK_SWATCHES[l].name}</span></span></button>`,
        )
        .join('') +
      `</div></div>` +
      // 2. Match length
      `<div class="tb-settings-row">` +
      `<div class="tb-settings-info">` +
      `<span class="tb-settings-label" id="tb-set-length">Match length</span>` +
      `<p class="tb-settings-note">First to 10 is the 1977 cartridge default; First to 5 for quicker duels.</p>` +
      `</div>` +
      `<div class="tb-toggle" role="radiogroup" aria-labelledby="tb-set-length" data-field="matchLength">` +
      `<button type="button" role="radio" data-field="matchLength" data-val="10" aria-checked="${String(currentSettings.matchLength === 10)}">10</button>` +
      `<button type="button" role="radio" data-field="matchLength" data-val="5" aria-checked="${String(currentSettings.matchLength === 5)}">5</button>` +
      `</div></div>` +
      // 3. Camera
      `<div class="tb-settings-row">` +
      `<div class="tb-settings-info">` +
      `<span class="tb-settings-label" id="tb-set-camera">Camera view</span>` +
      `<p class="tb-settings-note">Overhead frames the table from above; Chase tilts lower behind your rider.</p>` +
      `</div>` +
      `<div class="tb-toggle" role="radiogroup" aria-labelledby="tb-set-camera" data-field="camera">` +
      `<button type="button" role="radio" data-field="camera" data-val="overhead" aria-checked="${String(currentSettings.camera === 'overhead')}">Overhead</button>` +
      `<button type="button" role="radio" data-field="camera" data-val="chase" aria-checked="${String(currentSettings.camera === 'chase')}">Chase</button>` +
      `</div></div>` +
      // 4. Colour-blind riders
      `<div class="tb-settings-row">` +
      `<div class="tb-settings-info">` +
      `<span class="tb-settings-label" id="tb-set-cb">Colour-blind riders</span>` +
      `<p class="tb-settings-note">Swaps orange and sky blue for high-contrast amber and periwinkle.</p>` +
      `</div>` +
      `<div class="tb-toggle" role="radiogroup" aria-labelledby="tb-set-cb" data-field="colourBlind">` +
      `<button type="button" role="radio" data-field="colourBlind" data-val="false" aria-checked="${String(!currentSettings.colourBlind)}">Standard</button>` +
      `<button type="button" role="radio" data-field="colourBlind" data-val="true" aria-checked="${String(currentSettings.colourBlind)}">Colour-blind</button>` +
      `</div></div>` +
      // 5. Reduced effects
      `<div class="tb-settings-row">` +
      `<div class="tb-settings-info">` +
      `<span class="tb-settings-label" id="tb-set-effects">Reduced effects</span>` +
      `<p class="tb-settings-note">Mutes screen shake, wall flash and crash sparks.</p>` +
      `</div>` +
      `<div class="tb-toggle" role="radiogroup" aria-labelledby="tb-set-effects" data-field="reducedEffects">` +
      `<button type="button" role="radio" data-field="reducedEffects" data-val="false" aria-checked="${String(!currentSettings.reducedEffects)}">Full</button>` +
      `<button type="button" role="radio" data-field="reducedEffects" data-val="true" aria-checked="${String(currentSettings.reducedEffects)}">Reduced</button>` +
      `</div></div>` +
      // 6. Speed-up preview
      `<div class="tb-settings-row">` +
      `<div class="tb-settings-info">` +
      `<span class="tb-settings-label">Speed-up preview</span>` +
      `<p class="tb-settings-note">The five step periods on speed-up channels (15, 12, 9, 6 and 3 ticks of 20 ms).</p>` +
      `</div>` +
      `<div class="tb-speedup-preview" role="img" aria-label="Speed-up rhythm preview">` +
      `<div class="tb-preview-bar"></div>` +
      `<div class="tb-preview-bar"></div>` +
      `<div class="tb-preview-bar"></div>` +
      `<div class="tb-preview-bar"></div>` +
      `<div class="tb-preview-bar"></div>` +
      `</div></div>` +
      (options.onAllSettings
        ? `<div class="tb-settings-footer"><button type="button" class="tb-link" data-action="all-settings">All console settings…</button></div>`
        : '');

    updatePreviewBars();
  }

  container.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-action="all-settings"]')) {
      options.onAllSettings?.();
      return;
    }

    const btn = target.closest<HTMLButtonElement>('button[data-field]');
    if (!btn) return;

    const rawField = btn.dataset.field;
    const rawVal = btn.dataset.val;
    if (rawField === undefined || rawVal === undefined) return;

    const field = rawField as keyof TrailblazeSettings;
    let parsedVal: unknown = rawVal;
    if (field === 'matchLength') parsedVal = Number(rawVal);
    if (field === 'colourBlind' || field === 'reducedEffects') parsedVal = rawVal === 'true';

    const patch: Partial<TrailblazeSettings> = { [field]: parsedVal };
    currentSettings = options.settings.update(patch);
    render();
  });

  render();
  schedulePreviewStep();
  sheet.body.append(container);

  const unsub = options.settings.onChange((next) => {
    currentSettings = next;
    render();
  });

  return {
    dispose() {
      if (animationTimer !== null) clearTimeout(animationTimer);
      unsub();
      sheet.dispose();
    },
  };
}
