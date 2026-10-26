/**
 * Patch art: every patch in the collection is embroidered by this one
 * generator, so 120-odd patches from 30 games look like they came off the
 * same machine. A game only supplies data (its emblem and colours); the tier
 * decides the shape: round for Club, a shield for Pro, a star-edged badge for
 * Legend and a hexagon of hidden stitches for the secret one.
 *
 * Each patch is layered like the real thing: a twill ground with a slight
 * puff, a merrowed border of tight stitches, and the emblem in raised satin
 * stitch with its own shadow. Gold-thread patches swap the border and emblem
 * thread for a metallic gradient and carry a sheen element the Hall animates
 * (and holds still under reduced motion). The output is a standalone SVG
 * string, usable inline, in a share card, or in an exported jacket.
 */
import { mix } from './color.ts';
import type { PatchTier } from './patches.ts';
import { createRng } from './rng.ts';

export type PatchShape = 'round' | 'shield' | 'star' | 'hex';

export const PATCH_SHAPES: Readonly<Record<PatchTier, PatchShape>> = {
  club: 'round',
  pro: 'shield',
  legend: 'star',
  secret: 'hex',
};

export interface PatchArtInput {
  tier: PatchTier;
  /** The game's emblem: path data on a 24×24 grid, drawn as one round-capped stroke. */
  emblem: string;
  /** The twill ground, the emblem thread and the border thread. */
  colours: { ground: string; thread: string; border: string };
  gold: boolean;
  /**
   * 'earned' is the finished patch; 'locked' a dashed outline with a faint
   * emblem, sewn nowhere yet; 'secret' the "?" of an unearned secret patch.
   */
  state: 'earned' | 'locked' | 'secret';
  /** Keeps each patch's texture stable and its ids unique in a document. */
  seed: string;
  /** Becomes the SVG's accessible name; leave out for decoration. */
  title?: string;
}

const SIZE = 100;
const GOLD_STOPS: readonly [number, string][] = [
  [0, '#fff1b0'],
  [0.28, '#e2b84a'],
  [0.55, '#a8761c'],
  [0.78, '#f4d777'],
  [1, '#b8862a'],
];

function shapePath(shape: PatchShape): string {
  switch (shape) {
    case 'round':
      return 'M50 6a44 44 0 1 1 0 88a44 44 0 1 1 0-88Z';
    case 'shield':
      return 'M50 5L88 16C88 30 88 40 87 52C85 72 71 87 50 96C29 87 15 72 13 52C12 40 12 30 12 16Z';
    case 'star':
      return starPath(12, 46, 39);
    case 'hex':
      return hexPath(45);
  }
}

function starPath(points: number, outer: number, inner: number): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    d += `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
  }
  return `${d}Z`;
}

function hexPath(radius: number): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${round(50 + radius * Math.cos(angle))} ${round(50 + radius * Math.sin(angle))}`;
  }
  return `${d}Z`;
}

const round = (value: number) => Math.round(value * 100) / 100;

function escapeText(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function idPrefix(seed: string): string {
  return `patch-${seed.replace(/[^a-z0-9-]/gi, '-')}`;
}

function goldGradient(id: string): string {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
    GOLD_STOPS.map(([offset, colour]) => `<stop offset="${offset}" stop-color="${colour}"/>`).join('') +
    `</linearGradient>`
  );
}

/** The emblem, scaled from its 24-unit grid to sit in the middle of the patch. */
function emblemTransform(shape: PatchShape): string {
  // The shield's point pulls the visual centre down a little.
  const offsetY = shape === 'shield' ? -3 : 0;
  return `translate(${50 - 12 * 2.35} ${50 - 12 * 2.35 + offsetY}) scale(2.35)`;
}

function lockedPatch(input: PatchArtInput, shape: PatchShape, outline: string): string {
  const faintEmblem =
    input.state === 'secret'
      ? `<text x="50" y="62" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="40" fill="currentColor" opacity="0.55">?</text>`
      : `<g transform="${emblemTransform(shape)}" opacity="0.28"><path d="${escapeText(input.emblem)}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return (
    `<path d="${outline}" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.55" stroke-width="2.2" stroke-dasharray="4 3.5" stroke-linejoin="round"/>` +
    faintEmblem
  );
}

function earnedPatch(input: PatchArtInput, shape: PatchShape, outline: string): string {
  const id = idPrefix(input.seed);
  const rng = createRng(`patch-art/${input.seed}`);
  // Each patch's twill runs at a slightly different angle, as real ones do.
  const twillAngle = rng.float(-38, -26);
  const satinAngle = rng.float(34, 52);
  // A secret patch is sewn tone-on-tone: the emblem only shows by its stitches.
  const plainThread = input.tier === 'secret' ? mix(input.colours.ground, '#000000', 0.32) : input.colours.thread;
  const threadPaint = input.gold ? `url(#${id}-gold)` : plainThread;
  const borderPaint = input.gold ? `url(#${id}-gold)` : input.colours.border;
  const emblem = escapeText(input.emblem);
  const defs =
    `<defs>` +
    `<clipPath id="${id}-clip"><path d="${outline}"/></clipPath>` +
    `<pattern id="${id}-twill" patternUnits="userSpaceOnUse" width="2.4" height="2.4" patternTransform="rotate(${round(twillAngle)})">` +
    `<rect width="2.4" height="1.1" fill="#000" opacity="0.16"/><rect y="1.2" width="2.4" height="0.5" fill="#fff" opacity="0.08"/></pattern>` +
    `<pattern id="${id}-satin" patternUnits="userSpaceOnUse" width="0.9" height="0.9" patternTransform="rotate(${round(satinAngle)})">` +
    `<rect width="0.9" height="0.35" fill="#fff" opacity="0.42"/><rect y="0.45" width="0.9" height="0.2" fill="#000" opacity="0.18"/></pattern>` +
    `<mask id="${id}-emblem-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">` +
    `<g transform="${emblemTransform(shape)}"><path d="${emblem}" fill="none" stroke="#fff" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/></g></mask>` +
    `<radialGradient id="${id}-puff" cx="0.36" cy="0.3" r="0.8">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.32"/></radialGradient>` +
    (input.gold ? goldGradient(`${id}-gold`) : '') +
    `</defs>`;
  return (
    defs +
    // Lying on the fabric: a soft shadow under the patch's raised edge.
    `<path d="${outline}" transform="translate(1.4 2.4)" fill="#000" opacity="0.3"/>` +
    `<path d="${outline}" fill="${input.colours.ground}"/>` +
    `<g clip-path="url(#${id}-clip)">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id}-twill)"/>` +
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id}-puff)"/>` +
    `</g>` +
    // The emblem in raised satin stitch: its shadow, the thread, the stitch texture, a lit edge.
    `<g transform="${emblemTransform(shape)}">` +
    `<path d="${emblem}" transform="translate(0.36 0.48)" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${emblem}" fill="none" stroke="${threadPaint}" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>` +
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id}-satin)" mask="url(#${id}-emblem-mask)"/>` +
    `<g transform="${emblemTransform(shape)}">` +
    `<path d="${emblem}" transform="translate(-0.25 -0.32)" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>` +
    // The merrowed border: a thick roll of thread, its stitches, and the seam inside it.
    `<path d="${outline}" fill="none" stroke="${borderPaint}" stroke-width="6.5" stroke-linejoin="round"/>` +
    `<path d="${outline}" fill="none" stroke="#000" stroke-opacity="0.32" stroke-width="6.5" stroke-dasharray="0.7 1.3" stroke-linejoin="round"/>` +
    `<path d="${outline}" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="2" stroke-dasharray="0.7 1.3" stroke-dashoffset="0.4" stroke-linejoin="round"/>` +
    `<path d="${outline}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="0.8" transform="translate(50 50) scale(0.9) translate(-50 -50)" stroke-linejoin="round"/>` +
    // A Legend patch carries a second ring of running stitch inside its border.
    (input.tier === 'legend'
      ? `<path d="${outline}" fill="none" stroke="${borderPaint}" stroke-width="1.3" stroke-dasharray="2.2 1.6" stroke-linecap="round" transform="translate(50 50) scale(0.8) translate(-50 -50)"/>`
      : '') +
    (input.gold
      ? `<g clip-path="url(#${id}-clip)"><rect class="patch-gold-sheen" x="-60" y="-10" width="26" height="120" fill="#fff" opacity="0.32" transform="rotate(20 50 50)"/></g>`
      : '')
  );
}

/** One patch as a standalone SVG, `size` pixels square. */
export function patchSvg(input: PatchArtInput, size = 96): string {
  const shape = PATCH_SHAPES[input.tier];
  const outline = shapePath(shape);
  const label = input.title === undefined ? 'aria-hidden="true"' : `role="img" aria-label="${escapeText(input.title)}"`;
  const body = input.state === 'earned' ? earnedPatch(input, shape, outline) : lockedPatch(input, shape, outline);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${size}" height="${size}" class="patch-art patch-art--${input.tier}${input.gold ? ' is-gold' : ''}" ${label}>${body}</svg>`;
}
