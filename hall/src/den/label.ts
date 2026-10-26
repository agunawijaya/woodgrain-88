/**
 * Cartridge labels, drawn from each manifest's `label` data on one shared
 * template: a title band across the top, a pattern field with the game's
 * motif in a badge, and the slot number on a tab. Coming-soon cartridges wear
 * a strip of masking tape with "soon" written on it in marker, so the wall
 * still reads as thirty different cartridges while saying plainly that none
 * of them is ready yet.
 *
 * Labels are drawn at 112×88 units and scaled by whoever places them (the
 * wall, the list view, the console's cartridge slot).
 */
import { createRng, type GameManifest, type LabelPattern } from '@woodgrain-88/kit';
import { counterDigits } from '../data/cycle.ts';
import { attrs, escapeXml, n } from './svg.ts';

export const LABEL_SIZE = { width: 112, height: 88 } as const;
const BAND_HEIGHT = 28;
const FIELD = { x: 0, y: BAND_HEIGHT, width: LABEL_SIZE.width, height: LABEL_SIZE.height - BAND_HEIGHT };

/** Rough advance of Big Shoulders Display ExtraBold capitals, in ems; good enough to decide squeezing. */
const TITLE_ADVANCE_EM = 0.44;
const TITLE_SIZE = 19;
const TITLE_MAX_WIDTH = 102;

export interface PatternLayer {
  d: string;
  kind: 'fill' | 'stroke';
  width: number;
  opacity: number;
}

/**
 * A pattern as path layers inside the 112×60 label field, so the SVG labels
 * and the TV's canvas slates draw exactly the same pattern.
 */
export function patternLayers(pattern: LabelPattern, seed: string): PatternLayer[] {
  const { x, y, width, height } = FIELD;
  const rng = createRng(seed);
  const fill = (d: string, opacity = 1): PatternLayer => ({ d, kind: 'fill', width: 0, opacity });
  const stroke = (d: string, w: number, opacity = 1): PatternLayer => ({ d, kind: 'stroke', width: w, opacity });
  let d = '';
  switch (pattern) {
    case 'stripes':
      for (let i = -height; i < width + height; i += 12) d += `M${x + i} ${y - 4}h6v${height + 8}h-6Z`;
      return [fill(d)];
    case 'sunburst': {
      const cx = x + 18;
      const cy = y + height + 6;
      for (let a = -100; a < 10; a += 10) {
        const r1 = (a * Math.PI) / 180;
        const r2 = ((a + 5) * Math.PI) / 180;
        d += `M${cx} ${cy}L${n(cx + Math.cos(r1) * 160)} ${n(cy + Math.sin(r1) * 160)}L${n(cx + Math.cos(r2) * 160)} ${n(cy + Math.sin(r2) * 160)}Z`;
      }
      return [fill(d)];
    }
    case 'checker':
      for (let row = 0; row * 10 < height; row++) {
        for (let col = 0; col * 10 < width; col++) if ((row + col) % 2 === 0) d += `M${x + col * 10} ${y + row * 10}h10v10h-10Z`;
      }
      return [fill(d)];
    case 'waves':
      for (let row = 0; row < 8; row++) {
        d += `M${x - 4} ${y + 4 + row * 8}`;
        for (let i = 0; i < 9; i++) d += `q7 -5 14 0`;
      }
      return [stroke(d, 2.2)];
    case 'grid':
      for (let gx = x + 6; gx < x + width; gx += 12) d += `M${gx} ${y}v${height}`;
      for (let gy = y + 6; gy < y + height; gy += 12) d += `M${x} ${gy}h${width}`;
      return [stroke(d, 1.4)];
    case 'dots':
      for (let row = 0; row * 10 < height + 10; row++) {
        for (let col = 0; col * 12 < width + 12; col++) {
          const cx = x + col * 12 + (row % 2) * 6;
          const cy = y + row * 10 + 4;
          d += `M${cx - 2.6} ${cy}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
        }
      }
      return [fill(d)];
    case 'chevrons':
      for (let row = -1; row < 7; row++) {
        d += `M${x - 6} ${y + row * 10}`;
        for (let i = 0; i < 10; i++) d += `l6 6l6 -6`;
      }
      return [stroke(d, 3)];
    case 'rings':
      for (let r = 6; r < 110; r += 9) d += `M${x + width - 22 + r} ${y + height / 2}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`;
      return [stroke(d, 3)];
    case 'diamonds':
      for (let row = 0; row * 10 < height + 10; row++) {
        for (let col = 0; col * 14 < width + 14; col++) {
          const cx = x + col * 14 + (row % 2) * 7;
          const cy = y + row * 10;
          d += `M${cx} ${cy - 5}l5 5l-5 5l-5 -5Z`;
        }
      }
      return [fill(d)];
    case 'bricks':
      for (let row = 0; row * 10 < height; row++) {
        for (let col = -1; col * 20 < width + 20; col++) d += `M${x + col * 20 + (row % 2) * 10 + 1} ${y + row * 10 + 1}h18v8h-18Z`;
      }
      return [fill(d)];
    case 'zigzag':
      for (let row = 0; row < 8; row++) {
        d += `M${x - 4} ${y + 6 + row * 8}`;
        for (let i = 0; i < 12; i++) d += `l5 -4l5 4`;
      }
      return [stroke(d, 2.2)];
    case 'scales':
      for (let row = 0; row < 8; row++) {
        for (let col = -1; col * 14 < width + 14; col++) {
          const cx = x + col * 14 + (row % 2) * 7;
          d += `M${cx - 7} ${y + row * 8}a7 7 0 0 0 14 0`;
        }
      }
      return [stroke(d, 1.8)];
    case 'plaid': {
      let bands = '';
      for (let gx = x; gx < x + width; gx += 22) bands += `M${gx} ${y}h8v${height}h-8Z`;
      for (let gy = y; gy < y + height; gy += 22) bands += `M${x} ${gy}h${width}v8h${-width}Z`;
      let lines = '';
      for (let gx = x + 14; gx < x + width; gx += 22) lines += `M${gx} ${y}v${height}`;
      for (let gy = y + 14; gy < y + height; gy += 22) lines += `M${x} ${gy}h${width}`;
      return [fill(bands, 0.55), stroke(lines, 1)];
    }
    case 'stars':
      for (let i = 0; i < 22; i++) {
        const sx = x + rng.float(2, width - 2);
        const sy = y + rng.float(2, height - 2);
        const s = rng.float(1.2, 3.4);
        d += `M${n(sx)} ${n(sy - s)}l${n(s * 0.35)} ${n(s * 0.65)}l${n(s * 0.65)} ${n(s * 0.35)}l${n(-s * 0.65)} ${n(s * 0.35)}l${n(-s * 0.35)} ${n(s * 0.65)}l${n(-s * 0.35)} ${n(-s * 0.65)}l${n(-s * 0.65)} ${n(-s * 0.35)}l${n(s * 0.65)} ${n(-s * 0.35)}Z`;
      }
      return [fill(d)];
    case 'ripples':
      for (const [cx, cy] of [
        [x + 30, y + 40],
        [x + 92, y + 14],
      ] as const) {
        for (let r = 5; r < 60; r += 7) d += `M${cx + r} ${cy}a${r} ${n(r * 0.55)} 0 1 0 ${-2 * r} 0a${r} ${n(r * 0.55)} 0 1 0 ${2 * r} 0`;
      }
      return [stroke(d, 1.6)];
    case 'blocks':
      for (let i = 0; i < 14; i++) {
        const bw = rng.int(8, 26);
        const bh = rng.int(6, 18);
        d += `M${rng.int(x - 6, x + width - 4)} ${rng.int(y - 4, y + height - 4)}h${bw}v${bh}h${-bw}Z`;
      }
      return [fill(d)];
  }
}

function patternMarkup(pattern: LabelPattern, ink: string, seed: string): string {
  return patternLayers(pattern, seed)
    .map((layer) =>
      layer.kind === 'fill'
        ? `<path d="${layer.d}" fill="${ink}" opacity="${layer.opacity}"/>`
        : `<path d="${layer.d}" fill="none" stroke="${ink}" stroke-width="${layer.width}" stroke-linecap="round" opacity="${layer.opacity}"/>`,
    )
    .join('');
}

export const LABEL_FIELD = FIELD;

function titleMarkup(title: string, color: string): string {
  const text = title.toUpperCase();
  const estimated = text.length * TITLE_SIZE * TITLE_ADVANCE_EM;
  const squeeze = estimated > TITLE_MAX_WIDTH ? { textLength: TITLE_MAX_WIDTH, lengthAdjust: 'spacingAndGlyphs' } : {};
  return `<text ${attrs({
    x: LABEL_SIZE.width / 2,
    y: 20.5,
    'text-anchor': 'middle',
    fill: color,
    'font-family': 'var(--font-label)',
    'font-weight': 800,
    'font-size': TITLE_SIZE,
    'letter-spacing': 0.4,
    ...squeeze,
  })}>${escapeXml(text)}</text>`;
}

function motifMarkup(manifest: GameManifest): string {
  const { label } = manifest;
  const cx = FIELD.x + FIELD.width - 26;
  const cy = FIELD.y + FIELD.height / 2;
  const scale = 1.25;
  return (
    `<circle cx="${cx}" cy="${cy}" r="21" fill="${label.band}" stroke="${label.bandText}" stroke-width="2"/>` +
    `<g transform="translate(${n(cx - 12 * scale)} ${n(cy - 12 * scale)}) scale(${scale})">` +
    `<path d="${escapeXml(label.motif ?? manifest.emblem)}" fill="none" stroke="${label.bandText}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
  );
}

function slotTabMarkup(manifest: GameManifest): string {
  const { label } = manifest;
  return (
    `<rect x="5" y="${LABEL_SIZE.height - 22}" width="26" height="17" rx="3" fill="${label.band}" stroke="${label.bandText}" stroke-width="1.5"/>` +
    `<text x="18" y="${LABEL_SIZE.height - 8.5}" text-anchor="middle" fill="${label.bandText}" font-family="var(--font-label)" font-weight="800" font-size="13">${counterDigits(manifest.slot)}</text>`
  );
}

function soonTapeMarkup(seed: string): string {
  const rng = createRng(`tape/${seed}`);
  const tilt = rng.float(-9, -4);
  const torn = (x: number, dir: 1 | -1) => {
    let d = '';
    for (let i = 0; i <= 4; i++) d += `L${n(x + dir * rng.float(0, 2.4))} ${n(-9 + i * 4.5)}`;
    return d;
  };
  const shape = `M-40 -9${torn(40, 1).replace('L', 'L')}L40 9L-40 9${torn(-40, -1)}Z`;
  return (
    `<g class="soon-tape" transform="translate(${LABEL_SIZE.width / 2 - 10} ${FIELD.y + 30}) rotate(${n(tilt)})">` +
    `<path d="${shape}" fill="var(--den-tape)" opacity="0.94"/>` +
    `<path d="M-40 -6.5H40M-40 6.5H40" stroke="#000" stroke-opacity="0.06" stroke-width="1"/>` +
    `<text x="0" y="5.5" text-anchor="middle" fill="#2c3e8f" font-family="var(--font-hand)" font-size="17">soon</text>` +
    `</g>`
  );
}

export interface LabelOptions {
  /** Unique within the document: used for the clip path id. */
  idPrefix: string;
}

/** One cartridge label as an SVG group in 112×88 local units. */
export function labelSvg(manifest: GameManifest, options: LabelOptions): string {
  const { label } = manifest;
  const clipId = `${options.idPrefix}-clip`;
  const angle = label.angle ?? 0;
  const field = FIELD;
  return (
    `<g class="label">` +
    `<clipPath id="${clipId}"><rect x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}"/></clipPath>` +
    `<rect width="${LABEL_SIZE.width}" height="${LABEL_SIZE.height}" rx="3" fill="${label.paper}"/>` +
    `<g clip-path="url(#${clipId})"><g transform="rotate(${angle} ${field.x + field.width / 2} ${field.y + field.height / 2})">${patternMarkup(label.pattern, label.ink, manifest.id)}</g></g>` +
    `<rect width="${LABEL_SIZE.width}" height="${BAND_HEIGHT}" rx="3" fill="${label.band}"/>` +
    `<rect y="${BAND_HEIGHT - 3}" width="${LABEL_SIZE.width}" height="3" fill="${label.band}"/>` +
    // The spaces never render; they keep the printed words apart for tools
    // that read the label's text in order (title, slot tab, tape).
    [
      titleMarkup(manifest.title, label.bandText),
      motifMarkup(manifest),
      slotTabMarkup(manifest),
      manifest.status === 'coming-soon' ? soonTapeMarkup(manifest.id) : '',
    ].join(' ') +
    `<rect width="${LABEL_SIZE.width}" height="${LABEL_SIZE.height}" rx="3" fill="none" stroke="#000" stroke-opacity="0.18"/>` +
    `</g>`
  );
}

/** A standalone <svg> for HTML contexts (list view, cards). */
export function labelDocument(manifest: GameManifest, idPrefix: string, title?: string): string {
  const titleMarkupText = title ? `<title>${escapeXml(title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LABEL_SIZE.width} ${LABEL_SIZE.height}" role="img" aria-hidden="${title ? 'false' : 'true'}">${titleMarkupText}${labelSvg(manifest, { idPrefix })}</svg>`;
}
