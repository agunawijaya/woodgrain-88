/**
 * How a game's patches look: the kit's patch-art generator fed with the
 * game's own label colours. Each tier takes the colours in a different order
 * (Club on the title band, Pro on the label paper, Legend on the ink) so a
 * game's set reads as a family without four copies of the same disc.
 */
import { patchSvg, type GameManifest, type PatchArtInput, type PatchTier } from '@woodgrain-88/kit';

export type PatchLookState = PatchArtInput['state'];

/** Whoever a patch belongs to: a game, or the Den itself (Block champion). */
export type PatchOwner = Pick<GameManifest, 'id' | 'title' | 'emblem' | 'label'>;

function coloursFor(manifest: PatchOwner, tier: PatchTier): PatchArtInput['colours'] {
  const { paper, ink, band, bandText } = manifest.label;
  switch (tier) {
    case 'club':
      return { ground: band, thread: bandText, border: ink };
    case 'pro':
      return { ground: paper, thread: ink, border: band };
    case 'legend':
      return { ground: ink, thread: paper, border: band };
    case 'secret':
      return { ground: band, thread: band, border: ink };
  }
}

export interface PatchLook {
  manifest: PatchOwner;
  patchId: string;
  tier: PatchTier;
  state: PatchLookState;
  gold: boolean;
  title?: string;
}

/**
 * One patch as SVG. `context` keeps its gradient and filter ids apart from
 * the same patch drawn elsewhere on the page (the drawer and the jacket).
 */
export function patchArt(look: PatchLook, size = 96, context = ''): string {
  return patchSvg(
    {
      tier: look.tier,
      emblem: look.manifest.emblem,
      colours: coloursFor(look.manifest, look.tier),
      gold: look.gold,
      state: look.state,
      seed: `${look.manifest.id}-${look.patchId}${context ? `-${context}` : ''}`,
      ...(look.title === undefined ? {} : { title: look.title }),
    },
    size,
  );
}

/**
 * The gold thread's sheen for a patch drawn as a picture, where the page's
 * styles cannot reach it; it holds still for players who reduce motion.
 */
const PICTURE_SHEEN =
  '<style>.patch-gold-sheen{animation:sheen 5.5s ease-in-out infinite}@keyframes sheen{0%,70%,100%{opacity:0}82%{opacity:.85}}@media (prefers-reduced-motion:reduce){.patch-gold-sheen{animation:none;opacity:.35}}</style>';

/** A patch as a data URL: one picture to paint, however many filters its embroidery uses. */
function patchPicture(look: PatchLook): string {
  // Untitled: the surrounding drawing or tile carries the name.
  const svg = patchArt({ manifest: look.manifest, patchId: look.patchId, tier: look.tier, state: look.state, gold: look.gold }, 96, 'image');
  const withSheen = look.gold ? svg.replace(/^(<svg[^>]*>)/, `$1${PICTURE_SHEEN}`) : svg;
  return `data:image/svg+xml,${encodeURIComponent(withSheen)}`;
}

/** The patch as an `<image>` inside a larger SVG (the jacket, the door jacket). */
export function patchImage(look: PatchLook, x: number, y: number, size: number, extra = ''): string {
  return `<image href="${patchPicture(look)}" x="${x}" y="${y}" width="${size}" height="${size}" ${extra}/>`;
}

/** The patch as an `<img>` for HTML (the drawer's tiles). */
export function patchImg(look: PatchLook, size: number): string {
  // Not draggable: the page's own drag (the jacket's) moves patches, not the browser's image drag.
  return `<img src="${patchPicture(look)}" width="${size}" height="${size}" alt="" decoding="async" draggable="false">`;
}
