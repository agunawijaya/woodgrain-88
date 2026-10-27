/**
 * The channel picker: a chunky 1988 TV dial beside a channel strip. Turn the
 * knob (drag it, scroll on it, or use the arrows), click a channel on the
 * strip, or type its number like on a remote (1, 4, Enter); S picks a
 * surprise. The little display above the knob shows what is being typed or
 * tuned. Locked Remix channels can be tuned to, to read which patch opens
 * them, but not played.
 *
 * All the rules are in dial-model.ts; this file draws and listens.
 */
import type { GameManifest } from '@woodgrain-88/kit';
import type { Services } from '../app/services.ts';
import { openDialog, type Dialog } from '../chrome/dialog.ts';
import { escapeXml, n } from '../den/svg.ts';
import {
  channelAtAngle,
  createDialState,
  dialAngle,
  dialChannels,
  dialGroups,
  dialReduce,
  type DialAction,
  type DialState,
} from './dial-model.ts';

const TICK_MS = 250;
const KNOB = { cx: 120, cy: 128, r: 70 };

/** Tick marks and numbers round the knob: every channel when there are few, every fifth when there are many. */
function bezel(state: DialState): string {
  const count = state.channels.length;
  return state.channels
    .map((channel) => {
      const angle = (dialAngle(state.channels, channel.id) - 90) * (Math.PI / 180);
      const labelled =
        count <= 14 || channel.number === 1 || channel.number === count || channel.number % 5 === 0;
      const inner = KNOB.r + 8;
      const outer = KNOB.r + (labelled ? 18 : 13);
      const x = (r: number) => n(KNOB.cx + r * Math.cos(angle));
      const y = (r: number) => n(KNOB.cy + r * Math.sin(angle));
      return (
        `<path d="M${x(inner)} ${y(inner)}L${x(outer)} ${y(outer)}" stroke="var(--dial-ink)" stroke-width="${labelled ? 2.4 : 1.3}" stroke-linecap="round"/>` +
        (labelled
          ? `<text x="${x(KNOB.r + 30)}" y="${y(KNOB.r + 30)}" dy="0.35em" text-anchor="middle" font-family="var(--font-label)" font-weight="800" font-size="13" fill="var(--dial-ink)">${channel.number}</text>`
          : '')
      );
    })
    .join('');
}

function knob(state: DialState): string {
  let ridges = '';
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    ridges += `<path d="M${n(KNOB.cx + (KNOB.r - 2) * Math.cos(angle))} ${n(KNOB.cy + (KNOB.r - 2) * Math.sin(angle))}L${n(KNOB.cx + (KNOB.r - 11) * Math.cos(angle))} ${n(KNOB.cy + (KNOB.r - 11) * Math.sin(angle))}" stroke="#000" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
  }
  return (
    `<circle cx="${KNOB.cx}" cy="${KNOB.cy + 5}" r="${KNOB.r}" fill="#000" opacity="0.3"/>` +
    `<g class="dial-knob" style="transform: rotate(${n(dialAngle(state.channels, state.selected))}deg); transform-origin: ${KNOB.cx}px ${KNOB.cy}px">` +
    `<circle cx="${KNOB.cx}" cy="${KNOB.cy}" r="${KNOB.r}" fill="url(#dial-bakelite)"/>` +
    ridges +
    `<circle cx="${KNOB.cx}" cy="${KNOB.cy}" r="${KNOB.r - 16}" fill="url(#dial-cap)"/>` +
    `<path d="M${KNOB.cx} ${KNOB.cy - KNOB.r + 6}V${KNOB.cy - KNOB.r + 34}" stroke="#ffd76a" stroke-width="5" stroke-linecap="round"/>` +
    `</g>`
  );
}

export function openChannelPicker(options: {
  services: Services;
  manifest: GameManifest;
  current: string;
  /** The verb on the play button, e.g. "Play" or "Switch to". */
  verb?: string;
  /** False for a game that is not on the shelf yet: the dial only shows its channels. */
  canPlay?: boolean;
  onPlay(channelId: string): void;
}): Dialog {
  const { services, manifest } = options;
  const unlocked = new Set(
    services.channels
      .list(manifest.id)
      .filter((channel) => channel.unlocked)
      .map((channel) => channel.id),
  );
  const channels = dialChannels(manifest.channels, (id) => unlocked.has(id));
  let state = createDialState(channels, options.current);
  const dialog = openDialog({
    title: `${manifest.title}: channels`,
    className: 'dialog--dial',
    closeButton: true,
  });

  /** Which patch opens a locked Remix channel, in words. */
  const opensWith = (id: string) => {
    const patchId = manifest.channels.find((channel) => channel.id === id)?.unlockedBy;
    const patch = services.denLife
      .patchesFor(manifest.id)
      .find((candidate) => candidate.id === patchId);
    return patch ? `Opens with the ${patch.title} patch` : 'Opens with one of this game’s patches';
  };

  const describe = (id: string) => {
    const def = manifest.channels.find((channel) => channel.id === id);
    const channel = state.channels.find((candidate) => candidate.id === id);
    if (!def || !channel) return '';
    const original = def.originalGame?.length
      ? ` · Game ${def.originalGame.join(' and ')} on the cartridge`
      : '';
    return `${def.description}${original}${channel.locked ? ` · ${opensWith(id)}` : ''}`;
  };

  const render = () => {
    const selected = state.channels.find((channel) => channel.id === state.selected);
    const display =
      state.typed !== '' ? `${state.typed}–` : String(selected?.number ?? '').padStart(2, '0');
    const strip = dialGroups(state.channels)
      .map(
        (group) =>
          `<div class="dial-group">${group.group ? `<h3>${escapeXml(group.group)}</h3>` : ''}<ul>${group.channels
            .map(
              (channel) =>
                `<li><button type="button" class="dial-chip${channel.id === state.selected ? ' is-selected' : ''}${channel.locked ? ' is-locked' : ''}" data-pick="${channel.id}" aria-pressed="${channel.id === state.selected}"><span class="dial-chip-number">${channel.number}</span>${escapeXml(channel.title)}${channel.locked ? `<span class="dial-lock" aria-hidden="true"></span><span class="sr-only">, locked. ${escapeXml(opensWith(channel.id))}</span>` : ''}</button></li>`,
            )
            .join('')}</ul></div>`,
      )
      .join('');
    dialog.body.innerHTML =
      `<div class="dial-layout">` +
      `<div class="dial-set">` +
      `<p class="dial-display" aria-hidden="true">CH <strong>${escapeXml(display)}</strong></p>` +
      `<svg class="dial-svg" viewBox="0 0 240 240" role="slider" tabindex="0" aria-label="Channel dial" aria-valuemin="1" aria-valuemax="${state.channels.length}" aria-valuenow="${selected?.number ?? 1}" aria-valuetext="${escapeXml(`Channel ${selected?.number ?? ''}: ${selected?.title ?? ''}${selected?.locked ? ', locked' : ''}`)}">` +
      `<defs><radialGradient id="dial-bakelite" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#6b4a32"/><stop offset="0.7" stop-color="#3a2618"/><stop offset="1" stop-color="#22160e"/></radialGradient>` +
      `<radialGradient id="dial-cap" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#e9e2d4"/><stop offset="0.6" stop-color="#a59f97"/><stop offset="1" stop-color="#6d6862"/></radialGradient></defs>` +
      `<circle cx="${KNOB.cx}" cy="${KNOB.cy}" r="${KNOB.r + 22}" fill="var(--dial-plate)"/>` +
      bezel(state) +
      knob(state) +
      `</svg>` +
      `<p class="dial-message" role="status">${escapeXml(state.message ?? describe(state.selected))}</p>` +
      `</div>` +
      `<div class="dial-strip">${strip}</div>` +
      `</div>` +
      `<p class="dial-help">Turn the knob, pick from the strip, or type a number and press Enter. <span class="kbd">S</span> for a surprise.</p>` +
      (options.canPlay === false
        ? `<p class="dial-help">Channels open with the game.</p>`
        : `<div class="button-row">` +
          `<button type="button" class="button" data-do="surprise">Surprise me</button>` +
          `<button type="button" class="button button--primary" data-do="play"${selected?.locked ? ' aria-disabled="true"' : ''}>${escapeXml(options.verb ?? 'Play')} channel ${selected?.number ?? ''}</button>` +
          `</div>`);
  };

  const apply = (action: DialAction, keepFocus = '.dial-svg') => {
    const outcome = dialReduce(state, action);
    const turned = outcome.state.selected !== state.selected;
    state = outcome.state;
    if (turned) services.audio.play('channel-blip', { gain: 0.5 });
    if (outcome.commit && options.canPlay !== false) {
      dialog.close();
      options.onPlay(outcome.commit);
      return;
    }
    render();
    dialog.body.querySelector<HTMLElement>(keepFocus)?.focus();
  };

  // Dragging the knob: the pointer's angle round the centre picks the channel.
  let dragging = false;
  const angleAt = (event: PointerEvent, svg: SVGSVGElement) => {
    const box = svg.getBoundingClientRect();
    const scale = box.width / 240;
    const dx = event.clientX - (box.left + KNOB.cx * scale);
    const dy = event.clientY - (box.top + KNOB.cy * scale);
    return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  };
  dialog.body.addEventListener('pointerdown', (event) => {
    const svg = (event.target as Element).closest<SVGSVGElement>('.dial-svg');
    if (!svg) return;
    dragging = true;
    svg.setPointerCapture(event.pointerId);
  });
  dialog.body.addEventListener('pointermove', (event) => {
    const svg = (event.target as Element).closest<SVGSVGElement>('.dial-svg');
    if (!dragging || !svg) return;
    const angle = angleAt(event, svg);
    // Past the bottom of the sweep, stay at whichever end is nearer.
    const folded = angle > 180 ? angle - 360 : angle;
    const target = channelAtAngle(state.channels, folded);
    if (target.id !== state.selected)
      apply({
        type: 'turn',
        steps: target.number - (state.channels.find((c) => c.id === state.selected)?.number ?? 1),
      });
  });
  dialog.body.addEventListener('pointerup', () => {
    dragging = false;
  });
  dialog.body.addEventListener(
    'wheel',
    (event) => {
      if (!(event.target as Element).closest('.dial-svg')) return;
      event.preventDefault();
      apply({ type: 'turn', steps: event.deltaY > 0 ? 1 : -1 });
    },
    { passive: false },
  );

  dialog.body.addEventListener('click', (event) => {
    const target = event.target as Element;
    const pick = target.closest<HTMLElement>('[data-pick]')?.dataset.pick;
    if (pick) apply({ type: 'pick', id: pick }, `[data-pick="${pick}"]`);
    const action = target.closest<HTMLElement>('[data-do]')?.dataset.do;
    if (action === 'surprise') apply({ type: 'surprise', seed: Math.round(performance.now()) });
    if (action === 'play') apply({ type: 'key', key: 'Enter', at: performance.now() });
  });
  dialog.element.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const onStrip = (event.target as Element).closest('[data-pick]');
    // On the strip, Enter and Space press the chip; everywhere else the dial takes the keys.
    if (onStrip && (event.key === 'Enter' || event.key === ' ')) return;
    if (
      (event.target as Element).closest('[data-do]') &&
      (event.key === 'Enter' || event.key === ' ')
    )
      return;
    const handled =
      /^(Arrow(Up|Down|Left|Right)|Home|End|Page(Up|Down)|Enter|Backspace|[0-9sS])$/.test(
        event.key,
      );
    if (!handled) return;
    event.preventDefault();
    apply({ type: 'key', key: event.key, at: performance.now() });
  });
  const ticker = setInterval(() => {
    if (!dialog.open) {
      clearInterval(ticker);
      return;
    }
    if (state.typed !== '') {
      const outcome = dialReduce(state, { type: 'tick', at: performance.now() });
      if (outcome.state.typed !== state.typed) {
        state = outcome.state;
        const focused = document.activeElement;
        render();
        if (focused?.classList.contains('dial-svg'))
          dialog.body.querySelector<HTMLElement>('.dial-svg')?.focus();
      }
    }
  }, TICK_MS);

  render();
  dialog.body.querySelector<HTMLElement>('.dial-svg')?.focus();
  return dialog;
}
